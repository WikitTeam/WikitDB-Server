import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';
import { loadEffectiveConfig } from '../../../utils/siteConfig';

/**
 * 爬虫状态 API
 * GET /api/admin/crawler-status
 */
async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const record = await prisma.setting.findUnique({ where: { key: 'crawler:status' } });
        let status = record && record.value !== undefined ? record.value : null;
        if (status && typeof status === 'string') {
            try { status = JSON.parse(status); } catch (e) { status = null; }
        }

        let configuredSites = [];
        try {
            configuredSites = ((await loadEffectiveConfig()).SUPPORT_WIKI) || [];
        } catch (e) {
            configuredSites = [];
        }

        const recorded = (status && Array.isArray(status.sites)) ? status.sites : [];

        const merged = configuredSites.map(cfg => {
            const existing = recorded.find(s => s && s.param === cfg.PARAM);
            if (existing) return { ...existing, name: cfg.NAME || existing.name };
            return {
                param: cfg.PARAM,
                name: cfg.NAME || cfg.PARAM,
                status: 'pending',
                pagesFound: 0,
                pagesProcessed: 0,
                votes: 0,
                discussions: 0,
                errors: 0,
                startedAt: null,
                finishedAt: null,
                lastRun: null,
                error: null
            };
        });

        if (status && typeof status === 'object' && !status.running) {
            status = {
                ...status,
                overall: {
                    totalSites: merged.length,
                    doneSites: merged.filter(s => s.status === 'done').length,
                }
            };
        }

        return res.status(200).json({ status, sites: merged });
    } catch (error) {
        console.error('[crawler-status] 读取失败:', error);
        return res.status(500).json({ error: '读取爬取状态失败' });
    }
}

export default withAdmin(handler);
