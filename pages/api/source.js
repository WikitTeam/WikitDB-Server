import * as cheerio from 'cheerio';
const config = require('../../wikitdb.config.js');

export default async function handler(req, res) {
    const { site, page } = req.query;

    if (!site || !page || page === 'undefined') {
        return res.status(400).json({ error: '缺少有效的 site 或 page 参数' });
    }

    let rawPage = page.split('|')[0].split('#')[0].trim().toLowerCase();
    const pageName = rawPage.replace(/\/$/, '').split('/').pop();

    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) {
        return res.status(404).json({ error: '未找到该站点配置' });
    }

    const actualWikiName = wikiConfig.URL.replace(/^https?:\/\//i, '').split('.')[0];
    const baseUrl = wikiConfig.URL.replace(/\/$/, '');
    const secureUrl = `${baseUrl}/${pageName}`;

    try {
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        };

        const [gqlResponse, htmlResponse] = await Promise.allSettled([
            fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query { article(wiki: "${actualWikiName}", page: "${pageName}") { page_id } }`
                }),
                cache: 'no-store'
            }),
            fetch(secureUrl, { 
                headers: fetchHeaders,
                cache: 'no-store'
            })
        ]);

        let gqlData = null;
        if (gqlResponse.status === 'fulfilled' && gqlResponse.value.ok) {
            try {
                const gqlJson = await gqlResponse.value.json();
                if (gqlJson.data && gqlJson.data.article) {
                    gqlData = gqlJson.data.article;
                }
            } catch (e) {}
        }

        let html = '';
        if (htmlResponse.status === 'fulfilled' && htmlResponse.value.ok) {
            html = await htmlResponse.value.text();
        }

        let pageId = gqlData?.page_id || null;
        if (!pageId && html) {
            const idMatch = html.match(/pageId\s*[:=]\s*['"]?(\d+)['"]?/i) || html.match(/page_id\s*[:=]\s*['"]?(\d+)['"]?/i);
            if (idMatch && idMatch[1]) {
                pageId = idMatch[1];
            }
        }

        let sourceCode = '源码抓取失败：未能在原站网页中解析到 pageId。';

        if (pageId) {
            const origin = new URL(secureUrl).origin;
            const ajaxUrl = `${origin}/ajax-module-connector.php`;
            
            const ajaxHeaders = {
                'User-Agent': fetchHeaders['User-Agent'],
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': origin,
                'Referer': secureUrl,
                'Cookie': 'wikidot_token7=123456;'
            };

            const srcRes = await fetch(ajaxUrl, {
                method: 'POST',
                headers: ajaxHeaders,
                body: `page_id=${pageId}&moduleName=viewsource/ViewSourceModule&wikidot_token7=123456`,
                cache: 'no-store'
            });

            if (srcRes.ok) {
                try {
                    const data = await srcRes.json();
                    if (data.status === 'ok') {
                        const $src = cheerio.load(data.body);
                        let rawHtml = $src('.page-source').html() || data.body || '';
                        sourceCode = rawHtml.trim();
                    } else {
                        sourceCode = `请求源码失败，原站返回: ${data.status}`;
                    }
                } catch(e) {
                    sourceCode = `解析源码数据异常: ${e.message}`;
                }
            } else {
                sourceCode = `请求源码网络错误，可能被原站拦截`;
            }
        } else {
            return res.status(500).json({ error: sourceCode });
        }

        res.status(200).json({ sourceCode });
    } catch (error) {
        res.status(500).json({ error: '详情页抓取失败', details: error.message });
    }
}
