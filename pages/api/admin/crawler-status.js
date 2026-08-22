import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';
import { loadSiteConfig } from '../../../utils/siteConfig';

/**
 * 爬虫状态 API
 * GET /api/admin/crawler-status
 * 返回：爬虫持久化的结构化状态（crawler:status），
 * 并与当前配置中的站点列表合并，保证新增/删除站点后状态表始终完整。
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
            configuredSites = (loadSiteConfig().SUPPORT_WIKI) || [];
        } catch (e) {
            configuredSites = [];
        }

        const recorded = (status && Array.isArray(status.sites)) ? status.sites : [];

        const merged = configuredSites.map(cfg => {
            const existing = recorded.find(s => s && s.param === cfg.PARAM);
            if (existing) {
                // crom 站点由 attribution 服务处理，auto-crawler 跳过；
                // 显示为 'skipped' 避免用户困惑（否则会一直显示 pending）
                if (cfg.CROM_API) {
                    return { ...existing, status: 'skipped', name: cfg.NAME || existing.name };
                }
                return { ...existing, name: cfg.NAME || existing.name };
            }
            // 新站点：crom 标记的直接显示为 skipped
            if (cfg.CROM_API) {
                return {
                    param: cfg.PARAM,
                    name: cfg.NAME || cfg.PARAM,
                    status: 'skipped',
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
            }
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

        // 用合并后的站点列表修正总进度统计，保证新增站点也能反映到进度里
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
