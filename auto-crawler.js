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
const request = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 15000
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

let isRunning = false;

async function runCrawler() {
    if (isRunning) {
        console.log(`[${new Date().toLocaleString()}] 警告：上一轮爬虫尚未结束，跳过本次触发。`);
        return;
    }
    isRunning = true;

    try {
        console.log(`\n[${new Date().toLocaleString()}] 开始执行全站评分表爬取...`);
        for (const siteConfig of config.SUPPORT_WIKI) {
            const wikiParam = siteConfig.PARAM;
            const actualWikiName = siteConfig.URL.replace(/^https?:\/\//i, '').split('.')[0];
            const baseUrl = siteConfig.URL.replace(/\/$/, '');

            let allPages = [];
            let pageNum = 1;
            let totalPages = 1;
            let hasMore = true;

            while (hasMore) {
                try {
                    process.stdout.write(`获取清单 第 ${pageNum} 页... `);
                    const res = await request.get(`https://wikit.unitreaty.org/listpages?wiki=${actualWikiName}&p=${pageNum}`);
                    const lines = res.data.split('\n').map(l => l.trim()).filter(Boolean);
                    let countThisPage = 0;

                    lines.forEach(line => {
                        if (line.startsWith('Total Pages:')) {
                            totalPages = parseInt(line.replace('Total Pages:', '').trim(), 10) || 1;
                        } else if (line.includes('http') && line.includes('|')) {
                            const parts = line.split('|').map(item => item.trim());
                            if (parts.length >= 7) {
                                const url = parts[0];
                                const pageSlug = url.split('/').pop();
                                let author = parts[6] || '未知';
                                const match = author.match(/^(.*?)\s*\(\d+\)$/);
                                if (match) author = match[1].trim();

                                allPages.push({ page: pageSlug, title: parts[1], author: author, wiki: wikiParam });
                                countThisPage++;
                            }
                        }
                    });
                    console.log(`成功 ${countThisPage} 篇`);
                    if (pageNum >= totalPages) hasMore = false;
                    else pageNum++;
                } catch (e) {
                    await sleep(3000);
                }
                await sleep(1000);
            }

            let userVotesMap = {};
            let count = 0;
            const CONCURRENCY = 3;

            for (let i = 0; i < allPages.length; i += CONCURRENCY) {
                const batch = allPages.slice(i, i + CONCURRENCY);
                await Promise.all(batch.map(async (pageNode) => {
                    const secureUrl = `${baseUrl}/${pageNode.page}`;
                    let success = false, attempt = 0;
                    while (!success && attempt < 3) {
                        attempt++;
                        try {
                            let pageId = null;
                            const { data: html } = await request.get(secureUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                            const idMatch = html.match(/pageId\s*[:=]\s*['"]?(\d+)['"]?/i) || html.match(/page_id\s*[:=]\s*['"]?(\d+)['"]?/i);
                            if (idMatch) pageId = idMatch[1];
                            if (!pageId) { success = true; return; }

                            const origin = new URL(secureUrl).origin;
                            const ajaxUrl = `${origin}/ajax-module-connector.php`;
                            const { data: rateData } = await request.post(ajaxUrl, `pageId=${pageId}&page_id=${pageId}&moduleName=pagerate/WhoRatedPageModule&wikidot_token7=123456`, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0',
                                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                    'Cookie': 'wikidot_token7=123456;'
                                }
                            });

                            if (rateData.status === 'ok' && rateData.body) {
                                const $rate = cheerio.load(rateData.body);
                                $rate('.printuser').each((_, el) => {
                                    const user = $rate(el).text().trim();
                                    let vote = '+1', textAfter = '', curr = el.next;
                                    while (curr) {
                                        if (curr.type === 'tag' && (curr.tagName === 'br' || (curr.attribs && curr.attribs.class && curr.attribs.class.includes('printuser')))) break;
                                        if (curr.type === 'text') textAfter += curr.data;
                                        else if (curr.type === 'tag') textAfter += $rate(curr).text();
                                        curr = curr.next;
                                    }
                                    if (textAfter.includes('-')) vote = '-1';
                                    if (!userVotesMap[user]) userVotesMap[user] = [];
                                    userVotesMap[user].push({ wiki: wikiParam, page: pageNode.page, title: pageNode.title, vote: vote, author: pageNode.author, date: Date.now() });
                                });
                            }
                            success = true;
                        } catch (err) {
                            if (attempt < 3) await sleep(2000);
                        }
                    }
                }));

                count += batch.length;
                console.log(`--- 当前进度: [${count}/${allPages.length}] ---`);

                if (count % 100 === 0 || count >= allPages.length) {
                    for (const [user, newVotes] of Object.entries(userVotesMap)) {
                        const key = `user_votes_${user.toLowerCase().replace(/_/g, '-').replace(/ /g, '-')}`;
                        const record = await prisma.setting.findUnique({ where: { key } });
                        let existingMap = new Map();
                        if (record) JSON.parse(record.value).forEach(v => existingMap.set(`${v.wiki}:${v.page}`, v));
                        
                        newVotes.forEach(nv => {
                            const id = `${nv.wiki}:${nv.page}`;
                            if (!existingMap.has(id)) existingMap.set(id, nv);
                            else if (existingMap.get(id).vote !== nv.vote) {
                                existingMap.get(id).vote = nv.vote;
                                existingMap.get(id).date = Date.now();
                            }
                        });

                        const truncatedVotes = Array.from(existingMap.values()).sort((a, b) => b.date - a.date).slice(0, 800);
                        await prisma.setting.upsert({
                            where: { key },
                            update: { value: JSON.stringify(truncatedVotes) },
                            create: { key, value: JSON.stringify(truncatedVotes) }
                        });
                    }
                    userVotesMap = {}; 
                }
                await sleep(1500);
            }
        }
    } catch (e) {
        console.error(`发生异常: ${e.message}`);
    } finally {
        isRunning = false;
    }
}

cron.schedule('0 */3 * * *', () => runCrawler());
runCrawler();