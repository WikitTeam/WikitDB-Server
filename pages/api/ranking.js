const config = require('../../wikitdb.config.js');
const { DEFAULT_GQL_ENDPOINT, getGraphQLEndpoint } = require('../../utils/graphql');
const { cached } = require('../../utils/cache');
const { singleFlight } = require('../../utils/singleFlight');
const { wikitLimiter } = require('../../utils/rateLimiter');
import { withLogging } from '../../utils/logRequest';

async function handler(req, res) {
    const { site = 'global' } = req.query;

    try {
        const fetchGraphQL = async (queryStr, variables, endpoint = DEFAULT_GQL_ENDPOINT) => {
            await wikitLimiter.wait(8000);
            const gqlRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryStr, variables }),
                cache: 'no-store'
            });

            const text = await gqlRes.text();

            try {
                const json = JSON.parse(text);

                if (json.errors) {
                    throw new Error(json.errors[0].message);
                }

                if (json.data && json.data.authorRanking) {
                    return json.data.authorRanking;
                }

                return [];
            } catch (e) {
                if (e.name === 'SyntaxError') {
                    throw new Error(`Wikit 接口崩溃 (非 JSON): ${text.substring(0, 60)}...`);
                }
                throw e;
            }
        };

        // 缓存 10 分钟 + 请求去重
        const cacheKey = `ranking:${site}`;
        const rankingData = await singleFlight(cacheKey, () =>
            cached(cacheKey, async () => {
                if (site === 'global') {
                    return fetchGraphQL(`query { authorRanking(by: RATING) { rank name value } }`);
                }

                const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
                if (!wikiConfig) throw new Error('NOT_FOUND');

                let actualWikiName = '';
                try {
                    const urlObj = new URL(wikiConfig.URL);
                    actualWikiName = urlObj.hostname.replace(/^www\./i, '').split('.')[0];
                } catch (e) {
                    actualWikiName = wikiConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
                }

                return fetchGraphQL(
                    `query($wiki: String!) { authorRanking(wiki: $wiki, by: RATING) { rank name value } }`,
                    { wiki: actualWikiName },
                    getGraphQLEndpoint(wikiConfig)
                );
            }, 10 * 60 * 1000)
        );

        if (rankingData === 'NOT_FOUND') {
            return res.status(404).json({ error: '未找到指定的站点配置' });
        }

        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
        res.status(200).json({ site, ranking: rankingData });

    } catch (error) {
        if (error.message === 'NOT_FOUND') {
            return res.status(404).json({ error: '未找到指定的站点配置' });
        }
        res.status(500).json({ error: '排行榜数据获取失败', details: error.message });
    }
}

export default withLogging(handler);
