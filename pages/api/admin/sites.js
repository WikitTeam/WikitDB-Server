import { withAdmin } from '../../../utils/withAdmin';
import { loadEffectiveConfig, saveSiteConfig, validateSite } from '../../../utils/siteConfig';

/**
 * 站点管理 API
 * GET    /api/admin/sites          -> 有效站点列表（数据库覆盖优先）
 * POST   /api/admin/sites          -> 添加站点
 * PUT    /api/admin/sites          -> 编辑站点（body 传 { param: 原PARAM, ...站点字段 }）
 * DELETE /api/admin/sites          -> 删除站点（body 或 query 传 { param }）
 *
 * 写入 settings.site:config。磁盘可写时同步刷新 wikitdb.config.js。
 */
async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const config = await loadEffectiveConfig();
            return res.status(200).json({ sites: config.SUPPORT_WIKI, source: 'db-or-file' });
        }

        if (req.method === 'POST') {
            const result = validateSite(req.body);
            if (result.error) return res.status(400).json({ error: result.error });

            const config = await loadEffectiveConfig();

            if (config.SUPPORT_WIKI.some(s => s.PARAM === result.site.PARAM)) {
                return res.status(400).json({ error: `PARAM "${result.site.PARAM}" 已被使用` });
            }
            if (config.SUPPORT_WIKI.some(s => s.WIKIT_ID === result.site.WIKIT_ID)) {
                return res.status(400).json({ error: `WIKIT_ID "${result.site.WIKIT_ID}" 已被使用` });
            }

            config.SUPPORT_WIKI.push(result.site);
            await saveSiteConfig(config);
            return res.status(200).json({ success: true, sites: config.SUPPORT_WIKI });
        }

        if (req.method === 'PUT') {
            const param = String((req.body && req.body.param) || req.query.param || '').trim();
            if (!param) return res.status(400).json({ error: '缺少要编辑的站点 PARAM' });

            const result = validateSite(req.body);
            if (result.error) return res.status(400).json({ error: result.error });

            const config = await loadEffectiveConfig();
            const idx = config.SUPPORT_WIKI.findIndex(s => s.PARAM === param);
            if (idx === -1) return res.status(404).json({ error: '未找到该站点' });

            if (config.SUPPORT_WIKI.some((s, i) => i !== idx && s.PARAM === result.site.PARAM)) {
                return res.status(400).json({ error: `PARAM "${result.site.PARAM}" 已被其他站点使用` });
            }
            if (config.SUPPORT_WIKI.some((s, i) => i !== idx && s.WIKIT_ID === result.site.WIKIT_ID)) {
                return res.status(400).json({ error: `WIKIT_ID "${result.site.WIKIT_ID}" 已被其他站点使用` });
            }

            config.SUPPORT_WIKI[idx] = result.site;
            await saveSiteConfig(config);
            return res.status(200).json({ success: true, message: `站点 "${result.site.NAME}" 已更新`, sites: config.SUPPORT_WIKI });
        }

        if (req.method === 'DELETE') {
            const param = String((req.body && req.body.param) || req.query.param || '').trim();

            const config = await loadEffectiveConfig();
            if (config.SUPPORT_WIKI.length <= 1) {
                return res.status(400).json({ error: '至少需要保留一个站点，不能删除全部站点' });
            }

            const idx = config.SUPPORT_WIKI.findIndex(s => s.PARAM === param);
            if (idx === -1) return res.status(404).json({ error: '未找到该站点' });

            config.SUPPORT_WIKI.splice(idx, 1);
            await saveSiteConfig(config);
            return res.status(200).json({ success: true, sites: config.SUPPORT_WIKI });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('[sites] 处理失败:', error);
        return res.status(500).json({ error: '站点管理失败。无服务器部署会把站点写进数据库，请确认 DATABASE_URL 可用。' });
    }
}

export default withAdmin(handler);
