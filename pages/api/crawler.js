import * as cheerio from 'cheerio';
const config = require('../../wikitdb.config.js');

export default async function handler(req, res) {
    const { site } = req.query;

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

    const baseUrl = wikiConfig.URL.replace(/\/$/, '');

    try {
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        };

        let links = [];
        let seen = new Set();
        let pageTitle = "全站页面索引";

        try {
            const pageSize = 100;
            const buildQuery = (page) => JSON.stringify({
                query: `query { articles(wiki: ["${actualWikiName}"], page: ${page}, pageSize: ${pageSize}) { nodes { title url page } pageInfo { total hasNextPage } } }`
            });

            const firstRes = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: buildQuery(1),
                cache: 'no-store'
            });

            if (firstRes.ok) {
                const firstJson = await firstRes.json();
                const articlesData = firstJson.data?.articles;

                const processNodes = (nodes) => {
                    if (!nodes) return;
                    nodes.forEach(node => {
                        const fullHref = node.url || `${baseUrl}/${node.page}`;
                        const text = node.title || node.page;
                        
                        if (fullHref.startsWith(baseUrl) && !fullHref.includes('/system:') && !fullHref.includes('/admin:') && !fullHref.includes('/component:') && !fullHref.includes('user:info')) {
                            if (!seen.has(fullHref)) {
                                seen.add(fullHref);
                                links.push({ text: text, href: fullHref });
                            }
                        }
                    });
                };

                processNodes(articlesData?.nodes);

                const totalItems = articlesData?.pageInfo?.total || 0;
                const totalPages = Math.ceil(totalItems / pageSize);

                if (totalPages > 1) {
                    const fetchPromises = [];
                    for (let i = 2; i <= totalPages; i++) {
                        fetchPromises.push(
                            fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: buildQuery(i),
                                cache: 'no-store'
                            }).then(res => res.json()).catch(() => null)
                        );
                    }

                    const results = await Promise.all(fetchPromises);
                    results.forEach(json => {
                        if (json && json.data && json.data.articles) {
                            processNodes(json.data.articles.nodes);
                        }
                    });
                }
            }
        } catch (e) {}

        if (links.length === 0) {
            try {
                const listAllUrl = `${baseUrl}/system:list-all-pages`;
                const listRes = await fetch(listAllUrl, { headers: fetchHeaders });
                
                if (listRes.ok) {
                    const listHtml = await listRes.text();
                    const $list = cheerio.load(listHtml);
                    
                    $list('#page-content a').each((i, el) => {
                        const href = $list(el).attr('href');
                        const text = $list(el).text().trim();
                        
                        if (href && text && !href.startsWith('javascript:') && !href.startsWith('#')) {
                            const fullHref = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? href : '/' + href}`;
                            
                            if (fullHref.startsWith(baseUrl) && !href.includes('/system:') && !href.includes('/admin:') && !href.includes('/component:') && !href.includes('user:info')) {
                                if (!seen.has(fullHref)) {
                                    seen.add(fullHref);
                                    links.push({ text: text, href: fullHref });
                                }
                            }
                        }
                    });
                }
            } catch (e) {}
        }

        if (links.length === 0) {
            try {
                const homeRes = await fetch(baseUrl, { headers: fetchHeaders });
                const homeHtml = await homeRes.text();
                const $home = cheerio.load(homeHtml);
                pageTitle = $home('title').text().trim() || "首页数据抓取";
                if (pageTitle.includes(' - ')) pageTitle = pageTitle.split(' - ')[0].trim();

                $home('#page-content a, #nav-side a, #top-bar a').each((i, el) => {
                    const href = $home(el).attr('href');
                    const text = $home(el).text().trim();
                    
                    if (href && text && !href.startsWith('javascript:') && !href.startsWith('#')) {
                        const fullHref = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? href : '/' + href}`;
                        
                        if (fullHref.startsWith(baseUrl) && !href.includes('/system:') && !href.includes('/admin:') && !href.includes('user:info')) {
                            if (!seen.has(fullHref)) {
                                seen.add(fullHref);
                                links.push({ text: text, href: fullHref });
                            }
                        }
                    }
                });
            } catch (e) {}
        }

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.status(200).json({
            siteName: wikiConfig.NAME,
            siteUrl: wikiConfig.URL,
            pageTitle: links.length > 0 ? (seen.size > 20 ? "Wikit API 全站索引" : pageTitle) : pageTitle,
            links: links
        });
    } catch (error) {
        res.status(500).json({ error: '全站页面抓取失败', details: error.message });
    }
}
