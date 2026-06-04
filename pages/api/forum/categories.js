import prisma from '../../../lib/prisma';
import { withLogging } from '../../../utils/logRequest';
const { cached } = require('../../../utils/cache');
const config = require('../../../wikitdb.config.js');

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { site } = req.query;
    if (!site) return res.status(400).json({ error: '缺少 site 参数' });

    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) return res.status(404).json({ error: '未找到该站点配置' });

    const cacheKey = `forum-categories:${site}`;
    const categories = await cached(cacheKey, async () => {
        return prisma.forumCategory.findMany({ where: { siteParam: site } });
    }, 10 * 60 * 1000);

    res.status(200).json({ site, siteName: wikiConfig.NAME, categories });
}

export default withLogging(handler);
