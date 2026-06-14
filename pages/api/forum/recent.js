import prisma from '../../../lib/prisma';
import { withLogging } from '../../../utils/logRequest';
import { sanitizeRichHtml } from '../../../utils/htmlSanitizer';
const { cached } = require('../../../utils/cache');
const config = require('../../../wikitdb.config.js');

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { site, limit = '20' } = req.query;
    if (!site) return res.status(400).json({ error: '缺少 site 参数' });

    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) return res.status(404).json({ error: '未找到该站点配置' });

    const count = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const cacheKey = `forum-recent:${site}:${count}`;
    const posts = await cached(cacheKey, async () => {
        const recentPosts = await prisma.forumPost.findMany({
            where: { siteParam: site },
            orderBy: { id: 'desc' },
            take: count
        });

        const threadIds = [...new Set(recentPosts.map(p => p.threadId))];
        const threads = await prisma.forumThread.findMany({
            where: { siteParam: site, threadId: { in: threadIds } }
        });
        const threadMap = {};
        threads.forEach(t => { threadMap[t.threadId] = t; });

        return recentPosts.map(p => ({
            ...p,
            contentHtml: sanitizeRichHtml(p.contentHtml),
            threadTitle: threadMap[p.threadId]?.title || ''
        }));
    }, 3 * 60 * 1000);

    res.status(200).json({ site, posts });
}

export default withLogging(handler);
