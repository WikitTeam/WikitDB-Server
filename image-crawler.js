const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const config = require('./wikitdb.config.js');

const prisma = new PrismaClient();

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const request = axios.create({ httpAgent, httpsAgent, timeout: 10000 });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let isRunning = false;

async function runImageCrawler() {
    if (isRunning) return;
    isRunning = true;

    try {
        console.log(`\n[${new Date().toLocaleString()}] 开始执行全站图片画廊爬取...`);
        for (const siteConfig of config.SUPPORT_WIKI) {
            const wikiParam = siteConfig.PARAM;
            const actualWikiName = siteConfig.URL.replace(/^https?:\/\//i, '').split('.')[0];
            const baseUrl = siteConfig.URL.replace(/\/$/, '');

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
                            if (parts.length >= 2) allPages.push({ slug: parts[0].split('/').pop(), title: parts[1] });
                        }
                    });
                    if (pageNum >= totalPages) hasMore = false;
                    else pageNum++;
                } catch (e) {
                    await sleep(3000);
                }
            }

            const siteImages = [];
            for (let i = 0; i < allPages.length; i += 5) {
                const batch = allPages.slice(i, i + 5);
                await Promise.all(batch.map(async (pageInfo) => {
                    try {
                        const pageUrl = `${baseUrl}/${pageInfo.slug}`;
                        const { data: html } = await request.get(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                        const $ = cheerio.load(html);

                        $('#page-content img').each((_, el) => {
                            let src = $(el).attr('src');
                            if (src) {
                                if (!src.startsWith('http')) src = src.startsWith('/') ? `${baseUrl}${src}` : `${baseUrl}/${src}`;
                                if (!src.includes('avatar.php') && !src.includes('local--favicon') && !src.includes('rating.png') && !src.includes('clear.png')) {
                                    siteImages.push({ src: src, pageSlug: pageInfo.slug, pageTitle: pageInfo.title, sourceUrl: pageUrl });
                                }
                            }
                        });
                    } catch (err) {}
                }));
                await sleep(1000);
            }

            try {
                const dbKey = `gallery_images_${wikiParam}`;
                await prisma.setting.upsert({
                    where: { key: dbKey },
                    update: { value: JSON.stringify(siteImages) },
                    create: { key: dbKey, value: JSON.stringify(siteImages) }
                });
            } catch (dbErr) {}
        }
    } catch (e) {} finally {
        isRunning = false;
    }
}

cron.schedule('0 */4 * * *', () => runImageCrawler());
runImageCrawler();