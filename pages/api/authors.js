import * as cheerio from 'cheerio';
import axios from 'axios';
import { withLogging } from '../../utils/logRequest';
import prisma from '../../lib/prisma';
const { DEFAULT_GQL_ENDPOINT } = require('../../utils/graphql');
const { cached } = require('../../utils/cache');
const { singleFlight } = require('../../utils/singleFlight');
const { wikitLimiter } = require('../../utils/rateLimiter');
const config = require('../../wikitdb.config.js');

// avatar.php 只认 userid（account= 已失效，一律 404）。
// 当 Wikit 未返回 author_id 时，从用户资料页 user:info/<unix名> 抓真实头像地址；
// 失败返回 null，前端走默认头像兜底。
async function resolveAvatarByName(request, unixName) {
    try {
        const resp = await request.get(`https://www.wikidot.com/user:info/${encodeURIComponent(unixName)}`);
        const html = typeof resp.data === 'string' ? resp.data : '';
        const m = html.match(/avatar\.php\?userid=(\d+)/);
        return m ? `https://www.wikidot.com/avatar.php?userid=${m[1]}` : null;
    } catch (e) {
        return null;
    }
}

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

        const authorData = await singleFlight(cacheKey, () =>
            cached(cacheKey, async () => {
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
                let attribution = { score: 0, pages: 0, average: 0, sites: [] };
                let fromAttribution = false;
                try {
                    const scoreSettings = await prisma.setting.findMany({ where: { key: { startsWith: 'author_score:' } } });
                    const sites = [];
                    let totalScore = 0, totalAttPages = 0;
                    for (const s of scoreSettings) {
                        const siteParam = s.key.replace('author_score:', '');
                        const scores = s.value; // lib/prisma 已自动解析为对象
                        const entry = scores && scores[queryName.toLowerCase()];
                        if (entry) {
                            const siteCfg = config.SUPPORT_WIKI.find(w => w.PARAM === siteParam);
                            sites.push({
                                site: siteParam,
                                siteName: siteCfg ? siteCfg.NAME : siteParam,
                                score: entry.score || 0,
                                pages: entry.pages || 0,
                                average: entry.average || 0
                            });
                            totalScore += entry.score || 0;
                            totalAttPages += entry.pages || 0;
                        }
                    }
                    attribution = {
                        score: Math.round(totalScore * 100) / 100,
                        pages: totalAttPages,
                        average: totalAttPages ? Math.round((totalScore / totalAttPages) * 100) / 100 : 0,
                        sites
                    };
                    if (totalAttPages > 0) fromAttribution = true;
                } catch (e) {
                    console.error('获取归属分数失败:', e.message);
                }

                // Wikit 无数据但归属资料存在：仍返回该作者的归属档案
                if (!parsedFromRankApi && articlesData.length === 0) {
                    if (fromAttribution) {
                        const accountName2 = queryName.toLowerCase().replace(/_/g, '-').replace(/ /g, '-');
                        return {
                            name: queryName,
                            avatar: await resolveAvatarByName(request, accountName2),
                            globalRank: '无记录',
                            totalRating: attribution.score,
                            totalPages: attribution.pages,
                            averageRating: attribution.average,
                            siteStats: attribution.sites.map(s => ({ wiki: s.siteName, rank: '归属', rating: s.score, count: s.pages })),
                            attribution,
                            fromAttribution: true,
                            pages: [],
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

                // 必须 https：http 会 302 到 http 的 CloudFront 地址，
                // 在 https 页面下被浏览器混合内容策略拦截，导致头像永远加载失败
                const avatarUrl = userid
                    ? `https://www.wikidot.com/avatar.php?userid=${userid}`
                    : await resolveAvatarByName(request, accountName);

                return {
                    name: queryName,
                    avatar: avatarUrl,
                    globalRank,
                    totalRating,
                    totalPages,
                    averageRating,
                    siteStats,
                    attribution,
                    pages: articlesData,
                    voteRecords,
                    favoriteAuthors
                };
            }, 5 * 60 * 1000)
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
