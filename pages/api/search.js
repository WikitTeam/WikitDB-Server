const config = require('../../wikitdb.config.js');
const { getGraphQLEndpoint } = require('../../utils/graphql');
const { cached } = require('../../utils/cache');
const { singleFlight } = require('../../utils/singleFlight');
const { wikitLimiter } = require('../../utils/rateLimiter');
import { withLogging } from '../../utils/logRequest';

async function handler(req, res) {
    const { site, q, p } = req.query;

    if (!site) return res.status(400).json({ error: '缺少 site 参数' });

    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) return res.status(404).json({ error: '未找到该站点配置' });

    let actualWikiName = '';
    try {
        const urlObj = new URL(wikiConfig.URL);
        actualWikiName = urlObj.hostname.replace(/^www\./i, '').split('.')[0];
    } catch (e) {
        actualWikiName = wikiConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
    }

    const keyword = q ? q.trim() : '';
    const currentPage = parseInt(p, 10) || 1;
    const pageSize = 50;

    const cacheKey = `search:${site}:${keyword}:${currentPage}`;

    try {
        const result = await singleFlight(cacheKey, () =>
            cached(cacheKey, async () => {
                await wikitLimiter.wait(8000);

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

                if (gqlJson.errors) {
                    throw new Error(gqlJson.errors[0].message);
                }

                let nodes = gqlJson.data?.articles?.nodes || [];
                let total = gqlJson.data?.articles?.pageInfo?.total || 0;

                nodes.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

                return { nodes, total };
            }, 3 * 60 * 1000)
        );

        res.status(200).json({
            siteName: wikiConfig.NAME,
            results: result.nodes,
            currentPage: currentPage,
            totalPages: Math.ceil(result.total / pageSize),
            totalCount: result.total
        });

    } catch (error) {
        try {
            await wikitLimiter.wait(8000);

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
            const totalPages = Math.ceil(total / pageSize);

            const slicedNodes = nodes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

            res.status(200).json({
                siteName: wikiConfig.NAME,
                results: slicedNodes,
                currentPage: currentPage,
                totalPages: totalPages === 0 ? 1 : totalPages,
                totalCount: total
            });
        } catch (err) {
            res.status(500).json({ error: '搜索执行失败' });
        }
    }
}

export default withLogging(handler);
