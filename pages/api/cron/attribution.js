import { authorizeCron } from '../../../utils/cronAuth';

export const config = { maxDuration: 60 };

/** GET/POST /api/cron/attribution */
export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!authorizeCron(req)) return res.status(401).json({ error: '未授权的调度请求' });

    const force = req.query.force === '1' || req.query.force === 'true';
    try {
        const { runAttributionSlice } = require('../../../jobs/attribution');
        const result = await runAttributionSlice({ force });
        return res.status(200).json({ ok: true, result });
    } catch (error) {
        console.error('[cron/attribution]', error);
        return res.status(500).json({ error: error.message || '归属同步失败' });
    }
}
