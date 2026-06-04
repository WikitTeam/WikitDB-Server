import prisma from '../../../lib/prisma';
import { withLogging } from '../../../utils/logRequest';
const config = require('../../../wikitdb.config.js');

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { site, q, p = '1' } = req.query;
    if (!site) return res.status(400).json({ error: '缺少 site 参数' });
    if (!q || !q.trim()) return res.status(400).json({ error: '缺少搜索关键词' });

    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) return res.status(404).json({ error: '未找到该站点配置' });

    const page = parseInt(p, 10) || 1;
    const pageSize = 20;
    const keyword = q.trim().toLowerCase();

    const allPosts = await prisma.forumPost.findMany({ where: { siteParam: site } });

    const matched = allPosts.filter(post => {
        const titleMatch = post.title && post.title.toLowerCase().includes(keyword);
        const contentMatch = post.contentHtml && post.contentHtml.toLowerCase().includes(keyword);
        return titleMatch || contentMatch;
    });

    const total = matched.length;
    const paged = matched.slice((page - 1) * pageSize, page * pageSize);

    const threadIds = [...new Set(paged.map(p => p.threadId))];
    const threads = await prisma.forumThread.findMany({
        where: { siteParam: site, threadId: { in: threadIds } }
    });
    const threadMap = {};
    threads.forEach(t => { threadMap[t.threadId] = t; });

    const results = paged.map(p => ({
        ...p,
        threadTitle: threadMap[p.threadId]?.title || ''
    }));

    res.status(200).json({
        site, q: keyword, currentPage: page,
        results, total, totalPages: Math.ceil(total / pageSize)
    });
}

export default withLogging(handler);
