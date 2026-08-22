import * as cheerio from 'cheerio';
import axios from 'axios';
import { withLogging } from '../../utils/logRequest';
import prisma from '../../lib/prisma';
const { DEFAULT_GQL_ENDPOINT } = require('../../utils/graphql');
const { cached } = require('../../utils/cache');
const { singleFlight } = require('../../utils/singleFlight');
const { wikitLimiter } = require('../../utils/rateLimiter');
const config = require('../../wikitdb.config.js');

async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name } = req.query;

    if (!name || typeof name !== 'string' || name.trim().length > 100) {
        return res.status(400).json({ error: '缺少有效的 name 参数' });
    }

    try {
        const queryName = name.trim();
        const cacheKey = `author:${queryName.toLowerCase()}`;

        // DEBUG MODE: 用 __diag=1 绕过缓存直接输出 attribution join 诊断信息
        if (req.query.__diag === '1') {
            const lower = queryName.toLowerCase();
            const resp = {};
            resp.queryName = queryName;
            resp.lower = lower;

            const scoreSettings = await prisma.setting.findMany({ where: { key: { startsWith: 'author_score:' } } }).catch(() => []);
            resp.author_score_keys = scoreSettings.map(s => s.key);
            const relevantSiteParams = new Set();
            const matchedScores = [];
            for (const s of scoreSettings) {
                const sp = s.key.replace('author_score:', '');
                const siteCfg = config.SUPPORT_WIKI.find(w => w.PARAM === sp);
                if (siteCfg && !siteCfg.ATTRIBUTION_PAGE && !siteCfg.CROM_API) continue;
                const obj = s.value || {};
                const e = obj[lower];
                if (e) {
                    matchedScores.push({ siteParam: sp, entry: e });
                    relevantSiteParams.add(sp);
                }
            }
            resp.author_score_matches = matchedScores;
            resp.relevantSiteParams = Array.from(relevantSiteParams);

            const attrRows = await prisma.authorAttribution.findMany({ where: { username: lower } }).catch(e => ({ error: e.message }));
            resp.author_attributions_all_sites = Array.isArray(attrRows) ? {
                total: attrRows.length,
                bySiteParamCount: attrRows.reduce((acc, r) => { acc[r.siteParam] = (acc[r.siteParam]||0) + 1; return acc; }, {}),
                sample: attrRows.slice(0, 12)
            } : attrRows;

            if (Array.isArray(attrRows) && relevantSiteParams.size > 0) {
                const filtered = attrRows.filter(r => relevantSiteParams.has(r.siteParam));
                resp.author_attributions_filtered = {
                    count: filtered.length,
                    sample: filtered.slice(0, 12)
                };
                const neededScoreKeys = Array.from(new Set(filtered.map(r => `page_scores:${r.siteParam}`)));
                resp.neededPageScoreKeys = neededScoreKeys;
                const pageScoreSettings = neededScoreKeys.length > 0
                    ? await prisma.setting.findMany({ where: { key: { in: neededScoreKeys } } }).catch(e => [])
                    : [];
                resp.page_scores_summary = pageScoreSettings.map(ps => {
                    const sp = ps.key.replace('page_scores:', '');
                    const arr = Array.isArray(ps.value) ? ps.value : [];
                    return { key: ps.key, count: arr.length, sample: arr.slice(0, 3).map(r => ({page:r.page, title:r.title, rating:r.rating})) };
                });
            }
            return res.status(200).json(resp);
        }

        // DEBUG BYPASS: __nocache=1 强制跳过 singleFlight + TTL 缓存，实时重算（用于 build 升级后缓存清旧版）
        const bypassCache = req.query.__nocache === '1';
        const authorCompute = async () => {
                const accountName = queryName.toLowerCase().replace(/_/g, '-').replace(/ /g, '-');

                let globalRank = '无记录';
                let totalRating = 0;
                let totalPages = 0;
                let siteStats = [];
                let parsedFromRankApi = false;
                let userid = null;
                let articlesData = [];

                const request = axios.create({ timeout: 10000 });

                try {
                    await wikitLimiter.wait(8000);
                    const [rankRes, gqlRes] = await Promise.allSettled([
                        request.get(`https://wikit.unitreaty.org/wikidot/rank?user=${encodeURIComponent(queryName)}`),
                        request.post(DEFAULT_GQL_ENDPOINT, {
                            query: `query($author: String!) { articles(author: $author, page: 1, pageSize: 500) { nodes { title wiki page rating created_at author_id } } }`,
                            variables: { author: queryName }
                        })
                    ]);

                    if (rankRes.status === 'fulfilled' && rankRes.value.data) {
                        const rankHtml = typeof rankRes.value.data === 'string' ? rankRes.value.data : '';
                        const cleanHtml = rankHtml.replace(/<br\s*\/?>/gi, '\n');
                        const $rank = cheerio.load(cleanHtml);
                        const lines = $rank.text().split('\n').map(l => l.trim()).filter(l => l);

                        if (lines.length > 0 && lines[0].includes('总排名')) {
                            parsedFromRankApi = true;
                            const globalRankMatch = lines[0].match(/总排名#(\d+)/);
                            if (globalRankMatch) globalRank = globalRankMatch[1];

                            const globalRatingMatch = lines[0].match(/总分(-?\d+)分/);
                            if (globalRatingMatch) totalRating = parseInt(globalRatingMatch[1], 10);

                            const globalPagesMatch = lines[0].match(/创建页面(?:总数)?(\d+)个/);
                            if (globalPagesMatch) totalPages = parseInt(globalPagesMatch[1], 10);

                            for (let i = 1; i < lines.length; i++) {
                                const line = lines[i];
                                const siteMatch = line.match(/在(.*?)中的排名#(\d+)\s*总分(-?\d+)分\s*创建页面(?:总数)?(\d+)个/);
                                if (siteMatch) {
                                    siteStats.push({
                                        wiki: siteMatch[1].trim(),
                                        rank: siteMatch[2],
                                        rating: parseInt(siteMatch[3], 10),
                                        count: parseInt(siteMatch[4], 10)
                                    });
                                }
                            }
                        }
                    }

                    if (gqlRes.status === 'fulfilled' && gqlRes.value.data) {
                        const gqlJson = gqlRes.value.data;
                        if (!gqlJson.errors && gqlJson.data && gqlJson.data.articles) {
                            articlesData = gqlJson.data.articles.nodes || [];
                            if (articlesData.length > 0 && articlesData[0].author_id) {
                                userid = articlesData[0].author_id;
                            }
                        }
                    }
                } catch (e) {
                    console.log("Wikit API 请求出现异常...");
                }

                let voteRecords = [];
                let favoriteAuthors = [];

                if (userid) {
                    try {
                        await wikitLimiter.wait(8000);
                        const [favRes, recentRes] = await Promise.allSettled([
                            request.post(DEFAULT_GQL_ENDPOINT, {
                                query: `query($uid: String!) { userVotedAuthorRank(uid: $uid) { rank name positiveVotes negativeVotes totalScore } }`,
                                variables: { uid: String(userid) }
                            }),
                            request.post(DEFAULT_GQL_ENDPOINT, {
                                query: `query($uid: String!) { userRecentVotes(uid: $uid, limit: 50) { wiki page title old new type time } }`,
                                variables: { uid: String(userid) }
                            })
                        ]);

                        if (favRes.status === 'fulfilled' && favRes.value.data?.data?.userVotedAuthorRank) {
                            favoriteAuthors = favRes.value.data.data.userVotedAuthorRank;
                        }
                        if (recentRes.status === 'fulfilled' && recentRes.value.data?.data?.userRecentVotes) {
                            voteRecords = recentRes.value.data.data.userRecentVotes;
                        }
                    } catch (e) {
                        console.error("获取投票数据失败:", e);
                    }
                }

                // 归属分数（作者名下，跨站点聚合自站点归属资料页）
                // 仅统计配置了归属资料页 / CROM_API 的站点（如 brcn、na），其他站点（rule、dfc 等）走 Wikit
                let attribution = { score: 0, pages: 0, average: 0, sites: [] };
                let fromAttribution = false;
                // 归属页面清单：从 author_attributions + page_scores 合并而来，
                // 用于「所有发布页面」列表 + 作者活力图（即使是归属-only 作者也能看到东西）
                let attributionPages = [];
                try {
                    const scoreSettings = await prisma.setting.findMany({ where: { key: { startsWith: 'author_score:' } } });
                    const sites = [];
                    let totalScore = 0, totalAttPages = 0;
                    // 收集需要拉归属页面清单的站点 PARAM 集合
                    const relevantSiteParams = new Set();
                    for (const s of scoreSettings) {
                        const siteParam = s.key.replace('author_score:', '');
                        const siteCfg = config.SUPPORT_WIKI.find(w => w.PARAM === siteParam);
                        // 跳过未配置 crom / 归属页的站点
                        if (siteCfg && !siteCfg.ATTRIBUTION_PAGE && !siteCfg.CROM_API) continue;
                        const scores = s.value; // lib/prisma 已自动解析为对象
                        const entry = scores && scores[queryName.toLowerCase()];
                        if (entry) {
                            sites.push({
                                site: siteParam,
                                siteName: siteCfg ? siteCfg.NAME : siteParam,
                                score: entry.score || 0,
                                pages: entry.pages || 0,
                                average: entry.average || 0
                            });
                            totalScore += entry.score || 0;
                            totalAttPages += entry.pages || 0;
                            relevantSiteParams.add(siteParam);
                        }
                    }
                    attribution = {
                        score: Math.round(totalScore * 100) / 100,
                        pages: totalAttPages,
                        average: totalAttPages ? Math.round((totalScore / totalAttPages) * 100) / 100 : 0,
                        sites
                    };
                    if (totalAttPages > 0) fromAttribution = true;

                    // ===== 构建归属页面清单（author_attributions + author_score.pageNames + 可选 CROM 实时补全） =====
                    // 先读 page_scores:${siteParam} 所有需要的站点，一次性缓存，避免重复读
                    // 也一次性建立 siteParam -> WIKIT_ID 映射
                    const paramToWikiId = new Map(); // siteParam -> WIKIT_ID
                    const paramToSiteCfg = new Map();
                    for (const w of config.SUPPORT_WIKI) {
                        paramToWikiId.set(w.PARAM, w.WIKIT_ID || w.PARAM);
                        paramToSiteCfg.set(w.PARAM, w);
                    }
                    // 预先打包每个站点的 author_score 作者条目（包含 pageNames 字段）
                    const entryBySite = new Map(); // siteParam -> entry object
                    const scoreSettingsBySp = new Map();
                    for (const s of scoreSettings) {
                        const sp = s.key.replace('author_score:', '');
                        scoreSettingsBySp.set(sp, s);
                        const scores = s.value || {};
                        const entry = scores[queryName.toLowerCase()];
                        if (entry && relevantSiteParams.has(sp)) entryBySite.set(sp, entry);
                    }
                    if (relevantSiteParams.size > 0) {
                        // 1. author_attributions 表（来自归属资料页 scrape 后落库的每条作者-页面-角色三元组）
                        const attrRows = await prisma.authorAttribution.findMany({
                            where: {
                                username: queryName.toLowerCase(),
                                siteParam: { in: Array.from(relevantSiteParams) }
                            }
                        }).catch(e => { console.error('[authors] 查归属页面清单失败:', e.message); return []; });

                        // 把需要 page_scores 查询的站点 PARAM 收集齐：
                        //   - attrRows 中出现过的站点
                        //   - 拥有 author_score.entry.pageNames[] 的站点（即使没 author_attributions 行也要查 page_scores 拼 title）
                        const needPageScoreFor = new Set();
                        for (const r of (attrRows || [])) needPageScoreFor.add(r.siteParam);
                        for (const [sp, entry] of entryBySite) {
                            if (Array.isArray(entry.pageNames) && entry.pageNames.length > 0) needPageScoreFor.add(sp);
                        }
                        const pageScoreKeys = Array.from(needPageScoreFor).map(sp => `page_scores:${sp}`);
                        const pageScoreSettings = pageScoreKeys.length > 0
                            ? await prisma.setting.findMany({ where: { key: { in: pageScoreKeys } } }).catch(() => [])
                            : [];
                        const pageScoreBySite = new Map(); // siteParam -> Map(pageSlug -> {title, rating, upvotes, downvotes})
                        const pageScoreIndexBySite = new Map(); // siteParam -> Map(pageSlug -> createdAt ISO)
                        for (const ps of pageScoreSettings) {
                            const sp = ps.key.replace('page_scores:', '');
                            const arr = Array.isArray(ps.value) ? ps.value : [];
                            const m = new Map();
                            for (const r of arr) {
                                const slug = String(r && (r.page || '')).trim();
                                if (!slug) continue;
                                m.set(slug.toLowerCase(), {
                                    title: String(r.title || r.page || slug),
                                    rating: Number(r.rating != null ? r.rating : 0) || 0,
                                    upvotes: Number(r.upvotes != null ? r.upvotes : 0) || 0,
                                    downvotes: Number(r.downvotes != null ? r.downvotes : 0) || 0
                                });
                            }
                            pageScoreBySite.set(sp, m);
                        }
                        // 查 pages_index（若有）拿到页面 createdAt 精确时间（用于活力图时间轴）
                        try {
                            const idxKeys = Array.from(needPageScoreFor).map(sp => `pages_index:${sp}`);
                            if (idxKeys.length) {
                                const idxSettings = await prisma.setting.findMany({ where: { key: { in: idxKeys } } }).catch(() => []);
                                for (const ix of idxSettings) {
                                    const sp = ix.key.replace('pages_index:', '');
                                    const arr = Array.isArray(ix.value) ? ix.value : [];
                                    const mm = new Map();
                                    for (const r of arr) {
                                        const slug = String(r && (r.page || '')).trim();
                                        if (!slug || !r.createdAt) continue;
                                        mm.set(slug.toLowerCase(), String(r.createdAt));
                                    }
                                    pageScoreIndexBySite.set(sp, mm);
                                }
                            }
                        } catch (_) { /* 忽略 pages_index 不影响功能 */ }

                        const seen = new Set(); // `${sp}|${slugNorm}`
                        const pushPage = (sp, pageSlug, type, dateIsh, fallbackCreatedAt) => {
                            if (!pageSlug) return;
                            const slugNorm = String(pageSlug).trim().toLowerCase();
                            if (!slugNorm) return;
                            const dedupeKey = `${sp}|${slugNorm}`;
                            if (seen.has(dedupeKey)) return;
                            seen.add(dedupeKey);
                            const scoreMap = pageScoreBySite.get(sp);
                            const scoreInfo = scoreMap ? (scoreMap.get(slugNorm) || scoreMap.get(String(pageSlug).trim())) : null;
                            const idxMap = pageScoreIndexBySite.get(sp);
                            const idxDate = idxMap ? (idxMap.get(slugNorm) || idxMap.get(String(pageSlug).trim())) : null;
                            const wikiId = paramToWikiId.get(sp) || sp;
                            // created_at 优先级：pages_index.createdAt（精确） > 归属行 date (YYYY-MM-DD) > 归属行 createdAt > fallback > 空串
                            let isoDate = idxDate && String(idxDate).trim();
                            if (!isoDate) isoDate = dateIsh && String(dateIsh).trim();
                            if (isoDate && /^\d{4}-\d{1,2}-\d{1,2}$/.test(isoDate)) isoDate = `${isoDate}T00:00:00+00:00`;
                            if (!isoDate && fallbackCreatedAt) isoDate = fallbackCreatedAt;
                            if (isoDate && isoDate.startsWith('/')) isoDate = '';
                            // 安全兜底：不能 new Date().getTime() 出 NaN
                            try { if (isoDate && isNaN(new Date(isoDate).getTime())) isoDate = ''; } catch (_) { isoDate = ''; }
                            const title = scoreInfo && scoreInfo.title ? scoreInfo.title : String(pageSlug);
                            const rating = scoreInfo ? scoreInfo.rating : 0;
                            attributionPages.push({
                                page: String(pageSlug),
                                title,
                                wiki: wikiId,
                                rating,
                                created_at: isoDate,
                                _attributionType: type || '作者',
                                _attributionSiteParam: sp
                            });
                        };

                        // A: author_attributions 逐条入列
                        for (const r of (attrRows || [])) {
                            const fallback = r.createdAt ? new Date(r.createdAt).toISOString() : '';
                            pushPage(r.siteParam, r.page, r.type || '作者', r.date || '', fallback);
                        }

                        // B: author_score entry.pageNames 补全（fallback 聚合路径: rule 等非 CROM 站点通常有此字段）
                        //    解决：作者归属贡献页补录了但 author_attributions 未写入（罕见）或被抹掉的情况
                        for (const [sp, entry] of entryBySite) {
                            const pns = Array.isArray(entry.pageNames) ? entry.pageNames : [];
                            for (const pageName of pns) {
                                // date 未知：留空（后续若有 pages_index.createdAt 会被优先用）
                                pushPage(sp, pageName, '作者', '', null);
                            }
                        }

                        // C: 对 CROM-authoritative 站点（brcn/na），若物理归属行数不足 crom 统计 aggregate，则尝试 LIVE CROM 查该作者作品页清单
                        //    注意：CROM 强要求 User-Agent 头；有复杂限流（返回 "Please wait for N seconds"）
                        //    必须按建议时间 sleep 后重试，否则一律被 ban 拿不到任何页面。每作者最多 3 次重试。
                        const cromEntries = [];
                        for (const [sp, entry] of entryBySite) {
                            const siteCfg = paramToSiteCfg.get(sp);
                            if (siteCfg && siteCfg.CROM_API) {
                                const aggregatePages = Number(entry.pages || 0) | 0;
                                const currentForSite = attributionPages.filter(p => p._attributionSiteParam === sp).length;
                                if (aggregatePages > 0 && currentForSite < aggregatePages) {
                                    cromEntries.push({ sp, entry, siteCfg, aggregatePages, currentForSite });
                                }
                            }
                        }
                        if (cromEntries.length > 0) {
                            const throttleRe = /too often|rate.?limit|Please wait for/i;
                            const waitRe = /wait for (\d+) seconds?/i;
                            try {
                                const cromRequests = cromEntries.map(async ({ sp, entry, siteCfg }) => {
                                    const cromHttpBase = (siteCfg.URL || '').replace(/\/+$/, '').replace(/^https:/, 'http:');
                                    const uname = entry.unixName || entry.name || queryName;
                                    // CROM complexity 上限 600：first=500 + wikidotInfo 3 字段 ≈ 1000 直接被拒。
                                    // 与 utils/crom.js fetchCromSitePages 一致使用 first=50，配合 hasNextPage+endCursor 分页循环拉全量。
                                    const q = `{ user(name: ${JSON.stringify(String(uname))}) { attributedPages(first: 50, filter: {url: {startsWith: ${JSON.stringify(cromHttpBase + '/')}}}) { edges { node { url wikidotInfo { title rating createdAt } } } pageInfo { hasNextPage endCursor } } } }`;
                                    const endpoint = siteCfg.CROM_API || 'https://api.crom.avn.sh/graphql';
                                    const headers = {
                                        'User-Agent': 'WikitDB-AuthorsAPI/1.0 (+https://www.wikitdb.cn)'
                                    };
                                    let added = 0;
                                    const MAX_ATT = 3;
                                    let cursor = null;
                                    let pagesFetchedTotal = 0;
                                    let totalCountSeen = null;
                                    const attempts = [];
                                    for (let round = 0; (round === 0 || cursor); round++) {
                                        let queryThisRound = q;
                                        if (cursor) {
                                            queryThisRound = `{ user(name: ${JSON.stringify(String(uname))}) { attributedPages(first: 50, after: ${JSON.stringify(cursor)}, filter: {url: {startsWith: ${JSON.stringify(cromHttpBase + '/')}}}) { edges { node { url wikidotInfo { title rating createdAt } } } pageInfo { hasNextPage endCursor } } } }`;
                                        }
                                        let succ = false;
                                        for (let att = 0; att < MAX_ATT; att++) {
                                            let res;
                                            try {
                                                res = await axios.post(endpoint, { query: queryThisRound }, { timeout: 30000, headers, validateStatus: () => true });
                                            } catch (e) {
                                                attempts.push({ round, att, ax_err: String(e.message || e).slice(0,120) });
                                                await new Promise(r => setTimeout(r, 3000 + att * 1500));
                                                continue;
                                            }
                                            const errs = res && res.data && res.data.errors;
                                            const errTxt = errs ? JSON.stringify(errs) : '';
                                            const status = res && res.status;
                                            attempts.push({ round, att, status, http_body_bytes: (res && res.data ? JSON.stringify(res.data).length : 0), err_preview: errTxt ? errTxt.slice(0,200) : '' });
                                            if (errs && throttleRe.test(errTxt)) {
                                                const mw = waitRe.exec(errTxt);
                                                const waitSec = mw ? parseInt(mw[1], 10) : 30;
                                                await new Promise(r => setTimeout(r, (waitSec + 5) * 1000));
                                                continue;
                                            }
                                            if (errs) {
                                                await new Promise(r => setTimeout(r, 1500 * (att + 1)));
                                                continue;
                                            }
                                            const conn = res && res.data && res.data.data && res.data.data.user && res.data.data.user.attributedPages;
                                            const edges = conn && conn.edges ? conn.edges : [];
                                            // attributedPages PageConnection 没有 totalCount 字段（与 top-level pages Connection 不同）；跳过赋值，保留 null 即可
                                            for (const e of edges) {
                                                const node = e && e.node; if (!node) continue;
                                                const url = node.url || '';
                                                const idx = url.lastIndexOf('/');
                                                const slug = idx >= 0 ? decodeURIComponent(url.slice(idx + 1)) : '';
                                                if (!slug) continue;
                                                const info = node.wikidotInfo || {};
                                                const rating = typeof info.rating === 'number' ? info.rating : 0;
                                                const title = info.title || slug;
                                                const cat = info.createdAt;
                                                let isoDate = cat ? String(cat) : '';
                                                if (isoDate && /^\d{4}-\d{1,2}-\d{1,2}$/.test(isoDate)) isoDate = `${isoDate}T00:00:00+00:00`;
                                                try { if (isoDate && isNaN(new Date(isoDate).getTime())) isoDate = ''; } catch (_) { isoDate = ''; }
                                                const slugNorm = slug.toLowerCase();
                                                const dedupeKey = `${sp}|${slugNorm}`;
                                                if (seen.has(dedupeKey)) continue;
                                                seen.add(dedupeKey);
                                                attributionPages.push({
                                                    page: slug,
                                                    title: String(title),
                                                    wiki: paramToWikiId.get(sp) || sp,
                                                    rating,
                                                    created_at: isoDate,
                                                    _attributionType: '作者',
                                                    _attributionSiteParam: sp,
                                                    _source: 'crom-live'
                                                });
                                                added++;
                                            }
                                            pagesFetchedTotal += edges.length;
                                            const pi = conn && conn.pageInfo;
                                            if (pi && pi.hasNextPage && pi.endCursor) cursor = pi.endCursor; else cursor = null;
                                            succ = true;
                                            break;
                                        }
                                        if (!succ) break;
                                    }
                                    if (added > 0 || pagesFetchedTotal > 0 || bypassCache) {
                                        console.info('[authors CROM live]', {
                                            author: queryName, siteParam: sp, unixName: entry.unixName || entry.name || null,
                                            aggregate: entry.pages, totalCount_fromCrom: totalCountSeen,
                                            edgesFetched: pagesFetchedTotal, uniqueAdded: added,
                                            attempts
                                        });
                                    }
                                    return { sp, added, fetched: pagesFetchedTotal, totalCountSeen };
                                });
                                await Promise.all(cromRequests);
                            } catch (e) {
                                console.error('[authors] CROM 补全作者作品页失败:', e.message);
                            }
                        }
                    }
                } catch (e) {
                    console.error('获取归属分数失败:', e.message);
                }

                // Wikit 无数据但归属资料存在：仍返回该作者的归属档案 + 归属页面列表
                if (!parsedFromRankApi && articlesData.length === 0) {
                    if (fromAttribution) {
                        const accountName2 = queryName.toLowerCase().replace(/_/g, '-').replace(/ /g, '-');
                        return {
                            name: queryName,
                            avatar: `https://www.wikidot.com/avatar.php?account=${accountName2}`,
                            globalRank: '无记录',
                            totalRating: attribution.score,
                            totalPages: attribution.pages,
                            averageRating: attribution.average,
                            siteStats: attribution.sites.map(s => ({ wiki: s.siteName, rank: '归属', rating: s.score, count: s.pages })),
                            attribution,
                            fromAttribution: true,
                            pages: attributionPages,
                            voteRecords: [],
                            favoriteAuthors: []
                        };
                    }
                    throw new Error('NOT_FOUND');
                }

                if (!parsedFromRankApi && articlesData.length > 0) {
                    let calcGlobalRating = 0;
                    const siteStatsMap = {};
                    articlesData.forEach(article => {
                        const r = article.rating || 0;
                        calcGlobalRating += r;

                        const w = article.wiki;
                        if (!siteStatsMap[w]) siteStatsMap[w] = { wiki: w, count: 0, rating: 0, rank: '无记录' };
                        siteStatsMap[w].count += 1;
                        siteStatsMap[w].rating += r;
                    });
                    totalPages = articlesData.length;
                    totalRating = calcGlobalRating;
                    siteStats = Object.values(siteStatsMap).sort((a, b) => b.count - a.count);
                }

                let averageRating = 0;
                if (totalPages > 0) averageRating = (totalRating / totalPages).toFixed(1);

                const avatarUrl = userid
                    ? `http://www.wikidot.com/avatar.php?userid=${userid}`
                    : `https://www.wikidot.com/avatar.php?account=${accountName}`;

                // Wikit articlesData 与归属归属 attributionPages 合并（按 wiki+page 去重）
                // 场景：Wikit 只收录了「正式页面」，crom/归属页还登记了 component / art / fragment 等组件页，
                // 合起来让作者列表更完整，活力图月份更多柱。
                let mergedPages = Array.isArray(articlesData) ? [...articlesData] : [];
                if (attributionPages && attributionPages.length > 0) {
                    const wikitKey = new Set(
                        mergedPages.map(p => `${String(p.wiki || '').toLowerCase()}|${String(p.page || '').trim().toLowerCase()}`)
                    );
                    for (const ap of attributionPages) {
                        const k = `${String(ap.wiki || '').toLowerCase()}|${String(ap.page || '').trim().toLowerCase()}`;
                        if (wikitKey.has(k)) continue;
                        wikitKey.add(k);
                        mergedPages.push(ap);
                    }
                }

                return {
                    name: queryName,
                    avatar: avatarUrl,
                    globalRank,
                    totalRating,
                    totalPages,
                    averageRating,
                    siteStats,
                    attribution,
                    pages: mergedPages,
                    voteRecords,
                    favoriteAuthors
                };
        };

        const authorData = bypassCache
            ? (await (async () => {
                  try { return await authorCompute(); }
                  catch (e) { if (e.message === 'NOT_FOUND') return 'NOT_FOUND'; throw e; }
              })())
            : await singleFlight(cacheKey, () =>
                  cached(cacheKey, authorCompute, 5 * 60 * 1000)
              );

        if (authorData === 'NOT_FOUND') {
            return res.status(404).json({
                error: '未查找到该作者',
                details: '未能从 Wikit 获取该用户的任何数据。'
            });
        }

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json(authorData);
    } catch (error) {
        if (error.message === 'NOT_FOUND') {
            return res.status(404).json({
                error: '未查找到该作者',
                details: '未能从 Wikit 获取该用户的任何数据。'
            });
        }
        console.error('获取作者信息异常:', error);
        return res.status(500).json({ error: '获取作者信息失败' });
    }
}

export default withLogging(handler);
