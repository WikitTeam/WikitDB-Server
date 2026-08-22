import prisma from '../../lib/prisma';
const config = require('../../wikitdb.config.js');
const { DEFAULT_GQL_ENDPOINT, getGraphQLEndpoint } = require('../../utils/graphql');
const { cached } = require('../../utils/cache');
const { singleFlight } = require('../../utils/singleFlight');
const { wikitLimiter } = require('../../utils/rateLimiter');
import { withLogging } from '../../utils/logRequest';

function isCromEnabled(site) {
    // 只有配置了 CROM_API 的站点才走 crom 排行（brcn、na）
    // rule、if 等仅有 ATTRIBUTION_PAGE 的站点走 Wikit CIL + 归属补录
    if (site === 'global') return true;
    const w = config.SUPPORT_WIKI.find(x => x.PARAM === site);
    return !!(w && w.CROM_API);
}

/** 读取归属分数（原始对象 { [username小写]: { name, score, pages, average } }），无数据返回 null */
async function loadAttributionScores(site) {
    if (!isCromEnabled(site)) return null;
    if (site === 'global') {
        const settings = await prisma.setting.findMany({ where: { key: { startsWith: 'author_score:' } } });
        const agg = {};
        for (const s of settings) {
            const scores = s.value; // lib/prisma 已自动解析
            if (!scores) continue;
            for (const [k, v] of Object.entries(scores)) {
                if (!agg[k]) agg[k] = { name: v.name, score: 0 };
                agg[k].score += v.score || 0;
            }
        }
        return Object.keys(agg).length > 0 ? agg : null;
    }

    const rec = await prisma.setting.findUnique({ where: { key: `author_score:${site}` } });
    if (rec && rec.value && Object.keys(rec.value).length > 0) return rec.value;
    return null;
}

/**
 * 合并归属分数与 Wikit 全量排行榜：
 *  - 归属页登记过的作者：使用归属分数（修正后的权威分数）
 *  - 其余活跃作者：使用 Wikit 评分补齐，保证所有活跃作者都在榜
 */
function mergeRanking(attributionScores, wikitRanking) {
    const merged = {};
    for (const [k, v] of Object.entries(attributionScores)) {
        merged[k] = { name: v.name || k, value: v.score || 0 };
    }
    for (const item of wikitRanking || []) {
        const key = String(item.name || '').toLowerCase();
        if (key && !merged[key]) {
            merged[key] = { name: item.name, value: Number(item.value) || 0 };
        }
    }
    return Object.values(merged)
        .sort((a, b) => b.value - a.value)
        .map((v, i) => ({ rank: i + 1, name: v.name, value: Math.round(v.value * 100) / 100 }));
}

async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { site = 'global' } = req.query;

    try {
        // 1. 读取归属分数（归属页登记的作者，可能为 null）
        let attributionScores = null;
        try {
            attributionScores = await loadAttributionScores(site);
        } catch (e) {
            console.error('[ranking] 归属分数读取失败:', e.message);
        }

        const fetchGraphQL = async (queryStr, variables, endpoint = DEFAULT_GQL_ENDPOINT) => {
            await wikitLimiter.wait(8000);
            const gqlRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryStr, variables }),
                cache: 'no-store'
            });

            const text = await gqlRes.text();

            try {
                const json = JSON.parse(text);

                if (json.errors) {
                    throw new Error(json.errors[0].message);
                }

                if (json.data && json.data.authorRanking) {
                    return json.data.authorRanking;
                }

                return [];
            } catch (e) {
                if (e.name === 'SyntaxError') {
                    throw new Error(`Wikit 接口崩溃 (非 JSON): ${text.substring(0, 60)}...`);
                }
                throw e;
            }
        };

        // 2. Wikit 全量作者排行榜（归属分数不完整时用它补齐所有活跃作者）
        //    缓存 10 分钟 + 请求去重
        let wikitRanking = null;
        try {
            const cacheKey = `ranking:${site}`;
            wikitRanking = await singleFlight(cacheKey, () =>
                cached(cacheKey, async () => {
                    if (site === 'global') {
                        return fetchGraphQL(`query { authorRanking(by: RATING) { rank name value } }`);
                    }

                    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
                    if (!wikiConfig) throw new Error('NOT_FOUND');

                    let actualWikiName = '';
                    try {
                        const urlObj = new URL(wikiConfig.URL);
                        actualWikiName = urlObj.hostname.replace(/^www\./i, '').split('.')[0];
                    } catch (e) {
                        actualWikiName = wikiConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
                    }

                    return fetchGraphQL(
                        `query($wiki: String!) { authorRanking(wiki: $wiki, by: RATING) { rank name value } }`,
                        { wiki: actualWikiName },
                        getGraphQLEndpoint(wikiConfig)
                    );
                }, 10 * 60 * 1000)
            );
        } catch (error) {
            if (error && error.message === 'NOT_FOUND') {
                return res.status(404).json({ error: '未找到指定的站点配置' });
            }
            console.error('[ranking] Wikit 排行榜获取失败:', error && error.message);
            wikitRanking = null;
        }

        // 2.5 非 crom 站点（rule、if 等）：虽然排行榜主排序依据为 Wikit CIL，
        //     但仍需把归属页登记过的作者并入榜单，避免归属作者因 Wikit 活跃分不足而被「消失」。
        //     规则：Wikit 已收录的作者，若 Wikit value=0 且归属分数>0，则用归属分数替代；
        //     Wikit 未收录的作者，补录进来并使用归属分数。
        //     数据源：author_score:{site}（与作者详情页归属展示同一条 setting 记录）
        if (!isCromEnabled(site) && site !== 'global' && Array.isArray(wikitRanking)) {
            try {
                const attrRec = await prisma.setting.findUnique({ where: { key: `author_score:${site}` } });
                const value = attrRec && attrRec.value;
                if (value && typeof value === 'object' && Object.keys(value).length > 0) {
                    // 避免污染缓存里的原数组
                    wikitRanking = [...wikitRanking];
                    const existing = new Map(
                        wikitRanking.map(a => [String(a.name || '').toLowerCase(), a])
                    );
                    for (const [k, v] of Object.entries(value)) {
                        const displayName = (v && v.name) || k;
                        const key = String(displayName).toLowerCase() || String(k).toLowerCase();
                        if (!key) continue;
                        const attScore = Number(v && typeof v === 'object' ? (v.score || 0) : 0);
                        if (existing.has(key)) {
                            // Wikit 已收录：保留 Wikit 的排名和 value，
                            // 只有当 Wikit value 为 0 且归属分数 > 0 时，才用归属分数替代
                            // （避免归属登记的作者挂 0 分看起来像没分数）
                            const cur = existing.get(key);
                            const wikitValue = Number(cur.value || 0);
                            if (wikitValue === 0 && attScore > 0) {
                                cur.value = Math.round(attScore * 100) / 100;
                            }
                        } else {
                            // Wikit 未收录：补录进来，value 使用归属分数（而非 0），
                            // 这样作者不会被错误显示为「没分数」。
                            existing.set(key, {
                                name: displayName,
                                value: Math.round(attScore * 100) / 100
                            });
                            wikitRanking.push(existing.get(key));
                        }
                    }
                    // 重新按 value 降序并重新编号 rank
                    wikitRanking
                        .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
                        .forEach((a, i) => { a.rank = i + 1; });
                }
            } catch (e) {
                console.error(`[ranking] ${site}归属作者补录失败（不影响Wikit主榜）:`, e.message);
            }
        }

        // 3. 合并：归属分数优先，未登记归属的活跃作者用 Wikit 评分补齐
        let ranking;
        let source;
        if (attributionScores) {
            // Wikit 不可用时仅返回归属榜，仍保证可用
            ranking = mergeRanking(attributionScores, wikitRanking || []);
            source = 'attribution';
        } else if (wikitRanking) {
            ranking = wikitRanking;
        } else {
            return res.status(500).json({ error: '排行榜数据获取失败' });
        }

        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
        res.status(200).json(source ? { site, source, ranking } : { site, ranking });

    } catch (error) {
        if (error.message === 'NOT_FOUND') {
            return res.status(404).json({ error: '未找到指定的站点配置' });
        }
        res.status(500).json({ error: '排行榜数据获取失败' });
    }
}

export default withLogging(handler);

