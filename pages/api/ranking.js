const config = require('../../wikitdb.config.js');
const { withLogging } = require('../../utils/logRequest');

async function handler(req, res) {
    // 核心改造 1：接收前端传来的特定站点参数，如果没传，默认获取全站(global)
    const { site = 'global' } = req.query;

    try {
        const fetchGraphQL = async (queryStr, variables) => {
            const gqlRes = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
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

        let rankingData = [];

        // 核心改造 2：按需查询逻辑，要什么查什么，绝不多查
        if (site === 'global') {
            rankingData = await fetchGraphQL(`query { authorRanking(by: RATING) { rank name value } }`);
        } else {
            const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
            if (!wikiConfig) {
                return res.status(404).json({ error: '未找到指定的站点配置' });
            }

            let actualWikiName = '';
            try {
                const urlObj = new URL(wikiConfig.URL);
                actualWikiName = urlObj.hostname.replace(/^www\./i, '').split('.')[0];
            } catch (e) {
                actualWikiName = wikiConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
            }

            rankingData = await fetchGraphQL(
                `query($wiki: String!) { authorRanking(wiki: $wiki, by: RATING) { rank name value } }`,
                { wiki: actualWikiName }
            );
        }

        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
        // 将查询到的所属站点标识和数组一起返回给前端
        res.status(200).json({ site, ranking: rankingData });

    } catch (error) {
        res.status(500).json({ error: '排行榜数据获取失败', details: error.message });
    }
}

export default withLogging(handler);
