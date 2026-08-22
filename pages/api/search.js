const config = require('../../wikitdb.config.js');
import prisma from '../../lib/prisma';
import { withLogging } from '../../utils/logRequest';
const { cached } = require('../../utils/cache');
const { singleFlight } = require('../../utils/singleFlight');
const { wikitLimiter } = require('../../utils/rateLimiter');
const { getGraphQLEndpoint } = require('../../utils/graphql');

function getActualWikiName(wikiConfig) {
    try {
        const urlObj = new URL(wikiConfig.URL);
        return urlObj.hostname.replace(/^www\./i, '').split('.')[0];
    } catch (e) {
        return wikiConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
    }
}

async function searchWithCromIndex(wikiParam, wikiConfig, keyword, currentPage, pageSize) {
    // 从 DB 取缓存好的 pages_index
    const setting = await prisma.setting.findUnique({ where: { key: `pages_index:${wikiParam}` } });
    if (!setting || !setting.value) return null;
    let pages = setting.value;
    // prisma.setting 的扩展在写入/读取时自动做 JSON 序列化/反序列化，
    // 但这里再加一层保险（防止老数据字符串、或扩展没生效）
    if (typeof pages === 'string') {
        try { pages = JSON.parse(pages); } catch (_) { return null; }
    }
    if (!Array.isArray(pages) || pages.length === 0) return null;

    let filtered = pages;
    if (keyword) {
        const lowerQ = keyword.toLowerCase();
        filtered = pages.filter(n => {
            const t = (n.title || '').toLowerCase();
            const p = (n.page || '').toLowerCase();
            if (t.includes(lowerQ) || p.includes(lowerQ)) return true;
            if (Array.isArray(n.tags)) {
                for (const tg of n.tags) if (String(tg).toLowerCase().includes(lowerQ)) return true;
            }
            return false;
        });
    }

    // 同 Wikit 原接口：按 created_at 倒序
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const total = filtered.length;
    const start = (currentPage - 1) * pageSize;
    const sliced = filtered.slice(start, start + pageSize).map(n => ({
        title: n.title,
        page: n.page,
        wiki: getActualWikiName(wikiConfig),
        rating: n.rating,
        created_at: n.createdAt
    }));
    return { nodes: sliced, total };
}

async function searchWithWikit(wikiConfig, keyword, currentPage, pageSize, withLimiter) {
    const actualWikiName = getActualWikiName(wikiConfig);
    if (withLimiter) await wikitLimiter.wait(8000);

    const variables = { wiki: [actualWikiName], page: currentPage, pageSize };
    let queryStr;
    if (keyword) {
        queryStr = `query($wiki: [String!]!, $title: String, $page: Int, $pageSize: Int) { articles(wiki: $wiki, title: $title, page: $page, pageSize: $pageSize) { nodes { title page wiki rating created_at } pageInfo { total } } }`;
        variables.title = `%${keyword}%`;
    } else {
        queryStr = `query($wiki: [String!]!, $page: Int, $pageSize: Int) { articles(wiki: $wiki, page: $page, pageSize: $pageSize) { nodes { title page wiki rating created_at } pageInfo { total } } }`;
    }
    const gqlRes = await fetch(getGraphQLEndpoint(wikiConfig), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryStr, variables }),
        cache: 'no-store'
    });
    if (!gqlRes.ok) throw new Error('Wikit API 网络异常');
    const gqlJson = await gqlRes.json();
    if (gqlJson.errors) throw new Error(gqlJson.errors[0].message);
    let nodes = gqlJson.data?.articles?.nodes || [];
    let total = gqlJson.data?.articles?.pageInfo?.total || 0;
    nodes.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return { nodes, total };
}

async function searchWithWikitFallback(wikiConfig, keyword, currentPage, pageSize, withLimiter) {
    const actualWikiName = getActualWikiName(wikiConfig);
    if (withLimiter) await wikitLimiter.wait(8000);
    const fallbackRes = await fetch(getGraphQLEndpoint(wikiConfig), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `query($wiki: [String!]!) { articles(wiki: $wiki, page: 1, pageSize: 2000) { nodes { title page wiki rating created_at } } }`,
            variables: { wiki: [actualWikiName] }
        }),
        cache: 'no-store'
    });
    const fallbackJson = await fallbackRes.json();
    let nodes = fallbackJson.data?.articles?.nodes || [];
    if (keyword) {
        const lowerQ = keyword.toLowerCase();
        nodes = nodes.filter(n =>
            (n.title && n.title.toLowerCase().includes(lowerQ)) ||
            (n.page && n.page.toLowerCase().includes(lowerQ))
        );
    }
    nodes.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const total = nodes.length;
    const sliced = nodes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return { nodes: sliced, total };
}

async function handler(req, res) {
    const { site, q, p } = req.query;
    if (!site) return res.status(400).json({ error: '缺少 site 参数' });
    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) return res.status(404).json({ error: '未找到该站点配置' });
    const wikiParam = wikiConfig.PARAM;
    const keyword = q ? q.trim().slice(0, 100) : '';
    const currentPage = parseInt(p, 10) || 1;
    const pageSize = 50;
    const cacheKey = `search:${site}:${keyword}:${currentPage}`;
    const cromEnabled = !!wikiConfig.CROM_API;

    try {
        const result = await singleFlight(cacheKey, () =>
            cached(cacheKey, async () => {
                if (cromEnabled) {
                    // 优先本地 crom 索引（无外部依赖、收录更全）
                    const r = await searchWithCromIndex(wikiParam, wikiConfig, keyword, currentPage, pageSize);
                    if (r) return r;
                }
                return await searchWithWikit(wikiConfig, keyword, currentPage, pageSize, true);
            }, 3 * 60 * 1000)
        );
        res.status(200).json({
            siteName: wikiConfig.NAME,
            results: result.nodes,
            currentPage,
            totalPages: Math.ceil(result.total / pageSize) || 1,
            totalCount: result.total
        });
    } catch (error) {
        try {
            let result;
            if (cromEnabled) {
                // crom 站点即使在异常路径也尝试本地 crom 索引
                result = await searchWithCromIndex(wikiParam, wikiConfig, keyword, currentPage, pageSize);
            }
            if (!result) {
                result = await searchWithWikitFallback(wikiConfig, keyword, currentPage, pageSize, !cromEnabled);
            }
            res.status(200).json({
                siteName: wikiConfig.NAME,
                results: result.nodes,
                currentPage,
                totalPages: Math.ceil(result.total / pageSize) || 1,
                totalCount: result.total
            });
        } catch (err) {
            res.status(500).json({ error: '搜索执行失败' });
        }
    }
}

export default withLogging(handler);
