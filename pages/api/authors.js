import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    const { name } = req.query;

    if (!name) {
        return res.status(400).json({ error: '缺少有效的 name 参数' });
    }

    try {
        const queryName = name.trim();
        const accountName = queryName.toLowerCase().replace(/_/g, '-').replace(/ /g, '-');
        
        let globalRank = '无记录';
        let totalRating = 0;
        let totalPages = 0;
        let siteStats = [];
        let parsedFromRankApi = false;
        let userid = null;
        let articlesData = [];

        const [rankRes, gqlRes] = await Promise.allSettled([
            fetch(`https://wikit.unitreaty.org/wikidot/rank?user=${encodeURIComponent(queryName)}`, {
                method: 'GET',
                cache: 'no-store'
            }),
            fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query: `query { articles(author: "${queryName}", page: 1, pageSize: 500) { nodes { title wiki page rating created_at author_id } } }` 
                }),
                cache: 'no-store'
            })
        ]);

        if (rankRes.status === 'fulfilled' && rankRes.value.ok) {
            const rankHtml = await rankRes.value.text();
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

        if (gqlRes.status === 'fulfilled' && gqlRes.value.ok) {
            const gqlJson = await gqlRes.value.json();
            if (!gqlJson.errors && gqlJson.data && gqlJson.data.articles) {
                articlesData = gqlJson.data.articles.nodes || [];
                if (articlesData.length > 0 && articlesData[0].author_id) {
                    userid = articlesData[0].author_id;
                }
            }
        }

        let voteRecords = [];
        let favoriteAuthors = [];
        
        try {
            const voteKey = `user_votes_${accountName}`;
            const setting = await prisma.setting.findUnique({ where: { key: voteKey } });
            
            if (setting && setting.value) {
                const allVotes = JSON.parse(setting.value);
                voteRecords = allVotes;
                
                const authorCounts = {};
                allVotes.forEach(v => {
                    if (v.vote === '+1' && v.author && v.author !== '未知') {
                        authorCounts[v.author] = (authorCounts[v.author] || 0) + 1;
                    }
                });
                
                favoriteAuthors = Object.entries(authorCounts)
                    .map(([author, count]) => ({ author, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5); 
            }
        } catch (e) {
            console.error("提取投票记录失败:", e);
        }

        if (!parsedFromRankApi && articlesData.length === 0 && voteRecords.length === 0) {
            return res.status(404).json({ 
                error: '未查找到该作者', 
                details: '在数据库中未找到该用户的发文或投票记录。请检查用户名拼写是否正确。' 
            });
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

        const avatarUrl = userid ? `http://www.wikidot.com/avatar.php?userid=${userid}&timestamp=${Date.now()}` : `https://www.wikidot.com/avatar.php?account=${accountName}`;

        const authorData = {
            name: queryName,
            avatar: avatarUrl,
            globalRank: globalRank,
            totalRating: totalRating,
            totalPages: totalPages,
            averageRating: averageRating,
            siteStats: siteStats,
            pages: articlesData,
            voteRecords: voteRecords.slice(0, 100),
            favoriteAuthors: favoriteAuthors
        };

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.status(200).json(authorData);
    } catch (error) {
        res.status(500).json({ error: '获取作者信息失败', details: error.message });
    }
}