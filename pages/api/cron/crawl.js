import { authorizeCron } from '../../../utils/cronAuth';

export const config = { maxDuration: 60 };

/**
 * GET/POST /api/cron/crawl
 * 无服务器调度入口。Vercel Cron 或 GitHub Actions 带 CRON_SECRET 调用。
 * 每次只推进一个时间片，游标在数据库里。
 */
export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!authorizeCron(req)) return res.status(401).json({ error: '未授权的调度请求' });

    const budget = Number(req.query.budget);
    const force = req.query.force === '1' || req.query.force === 'true';
    try {
        const { runCrawlSlice } = require('../../../jobs/crawler');
        const result = await runCrawlSlice({
            force,
            budgetMs: Number.isFinite(budget) && budget > 0 ? Math.min(budget * 1000, 50 * 1000) : undefined,
        });
        return res.status(200).json({ ok: true, result });
    } catch (error) {
        console.error('[cron/crawl]', error);
        return res.status(500).json({ error: error.message || '爬虫切片失败' });
    }
}
