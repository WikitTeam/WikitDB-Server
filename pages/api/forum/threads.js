import prisma from '../../../lib/prisma';
import { withLogging } from '../../../utils/logRequest';
const { cached } = require('../../../utils/cache');
const config = require('../../../wikitdb.config.js');

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { site, category, p = '1', pageSize = '20' } = req.query;
    if (!site) return res.status(400).json({ error: '缺少 site 参数' });

    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) return res.status(404).json({ error: '未找到该站点配置' });

    const page = Math.min(Math.max(parseInt(p, 10) || 1, 1), 1000);
    const size = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 50);

    const cacheKey = `forum-threads:${site}:${category || 'all'}:${page}:${size}`;
    const result = await cached(cacheKey, async () => {
        const where = { siteParam: site };
        if (category) where.categoryId = category;

        const total = await prisma.forumThread.count({ where });
        const threads = await prisma.forumThread.findMany({
            where,
            orderBy: { lastSyncedAt: 'desc' },
            skip: (page - 1) * size,
            take: size
        });

        return { threads, total, totalPages: Math.ceil(total / size) };
    }, 5 * 60 * 1000);

    res.status(200).json({ site, currentPage: page, ...result });
}

export default withLogging(handler);
