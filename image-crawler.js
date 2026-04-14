const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');
const https = require('https');
const prisma = require('./lib/prisma');
const config = require('./wikitdb.config.js');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const request = axios.create({ httpAgent, httpsAgent, timeout: 15000 });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let isRunning = false;

async function runPageArchiver() {
    if (isRunning) return;
    isRunning = true;

    try {
        console.log(`\n[${new Date().toLocaleString()}] 开始执行全站页面深度备份归档...`);
        for (const siteConfig of config.SUPPORT_WIKI) {
            const wikiParam = siteConfig.PARAM;
            const actualWikiName = siteConfig.URL.replace(/^https?:\/\//i, '').replace(/\/$/, '').split('.')[0];
            const baseUrl = siteConfig.URL.replace(/\/$/, '');

            console.log(`正在抓取站点 [${wikiParam}] 的列表...`);
            let allPages = [];
            let pageNum = 1, totalPages = 1, hasMore = true;

            while (hasMore) {
                try {
                    const res = await request.get(`https://wikit.unitreaty.org/listpages?wiki=${actualWikiName}&p=${pageNum}`);
                    const lines = res.data.split('\n').map(l => l.trim()).filter(Boolean);
                    lines.forEach(line => {
                        if (line.startsWith('Total Pages:')) totalPages = parseInt(line.replace('Total Pages:', '').trim(), 10) || 1;
                        else if (line.includes('http') && line.includes('|')) {
                            const parts = line.split('|').map(item => item.trim());
                            if (parts.length >= 2) {
                                allPages.push({ 
                                    slug: parts[0].split('/').pop(), 
                                    title: parts[1],
                                    sourceUrl: parts[0]
                                });
                            }
                        }
                    });
                    if (pageNum >= totalPages) hasMore = false;
                    else pageNum++;
                } catch (e) {
                    console.error(`列表获取失败 (P${pageNum}):`, e.message);
                    await sleep(3000);
                }
            }

            console.log(`[${wikiParam}] 共发现 ${allPages.length} 个页面，开始深度存档...`);

            // 批量深度采集
            for (let i = 0; i < allPages.length; i += 3) { // 降低并发以保护目标站点
                const batch = allPages.slice(i, i + 3);
                await Promise.all(batch.map(async (pageInfo) => {
                    try {
                        const { data: html } = await request.get(pageInfo.sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 WikitDB-Archiver' } });
                        const $ = cheerio.load(html);

                        // 1. 提取正文内容
                        const contentHtml = $('#page-content').html() || '';
                        
                        // 2. 提取元数据 (作者, 标签)
                        const author = $('.page-info-break').prev('a').text() || 'unknown';
                        const tags = $('.page-tags a').map((_, el) => $(el).text()).get().join(' ');

                        // 3. 提取图片资源
                        const images = [];
                        $('#page-content img').each((_, el) => {
                            let src = $(el).attr('src');
                            if (src) {
                                if (!src.startsWith('http')) src = src.startsWith('/') ? `${baseUrl}${src}` : `${baseUrl}/${src}`;
                                if (!src.includes('avatar.php') && !src.includes('local--favicon')) {
                                    images.push(src);
                                }
                            }
                        });

                        // 4. 存入数据库 (Upsert)
                        await prisma.pageArchive.upsert({
                            where: { wiki_slug: { wiki: wikiParam, slug: pageInfo.slug } },
                            update: {
                                title: pageInfo.title,
                                content: contentHtml,
                                author: author,
                                tags: tags,
                                images: images,
                                sourceUrl: pageInfo.sourceUrl
                            },
                            create: {
                                wiki: wikiParam,
                                slug: pageInfo.slug,
                                title: pageInfo.title,
                                content: contentHtml,
                                author: author,
                                tags: tags,
                                images: images,
                                sourceUrl: pageInfo.sourceUrl
                            }
                        });

                    } catch (err) {
                        // console.error(`页面存档失败 [${pageInfo.slug}]:`, err.message);
                    }
                }));
                if (i % 30 === 0) console.log(`[${wikiParam}] 已完成 ${i}/${allPages.length}...`);
                await sleep(500);
            }
        }
        console.log(`\n[${new Date().toLocaleString()}] 全站深度存档任务已全部完成。`);
    } catch (e) {
        console.error('Archiver 核心异常:', e);
    } finally {
        isRunning = false;
    }
}

// 每 12 小时运行一次 (全站深度存档负载较高)
cron.schedule('0 */12 * * *', () => runPageArchiver());
runPageArchiver();
