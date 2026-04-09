const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const config = require('./wikitdb.config.js');

// 加上连接池限制，防止爬虫把 Web 主站的通道挤占导致全站崩溃
const crawlerDbUrl = process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=3&pool_timeout=20';
const prisma = new PrismaClient({
    datasources: { db: { url: crawlerDbUrl } },
});

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
        console.log(`\n[${new Date().toLocaleString()}] 开始执行全站数据(评分+讨论区)爬取...`);
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
                    process.stdout.write(`获取 [${wikiParam}] 清单 第 ${pageNum} 页... `);
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
                            const { data: html } = await request.get(secureUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                            
                            // ============================================
                            // 核心新增：嗅探 threadId 并自动抓取论坛讨论区
                            // ============================================
                            const threadMatch = html.match(/\/forum\/t-(\d+)/i);
                            if (threadMatch) {
                                const threadId = threadMatch[1];
                                try {
                                    const forumUrl = `${baseUrl}/forum/t-${threadId}`;
                                    const { data: forumHtml } = await request.get(forumUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                                    const $forum = cheerio.load(forumHtml);
                                    const posts = [];
                                    
                                    function parseContainer(container, parentId = null) {
                                        const currentPost = $forum(container).children('.post').first();
                                        if (!currentPost.length) return;
                                        
                                        const postId = (currentPost.attr('id') || '').replace('post-', '');
                                        const author = currentPost.find('.info .printuser').first().text().trim() || 
                                                       currentPost.find('.author a').first().text().trim() || '未知';
                                        const contentHtml = currentPost.find('.content').first().html() || '';
                                        const odate = currentPost.find('.odate').first();
                                        const timestamp = odate.attr('title') || odate.text().trim() || '';
                                        
                                        posts.push({ postId, parentId, author, timestamp, contentHtml });
                                        $forum(container).children('.post-container').each((_, child) => parseContainer(child, postId));
                                    }
                                    
                                    $forum('#thread-container > .post-container').each((_, c) => parseContainer(c, null));
                                    
                                    const postMap = {};
                                    const rootPosts = [];
                                    posts.forEach(p => { p.children = []; postMap[p.postId] = p; });
                                    posts.forEach(p => { 
                                        if (p.parentId && postMap[p.parentId]) postMap[p.parentId].children.push(p); 
                                        else rootPosts.push(p); 
                                    });
                                    
                                    const forumData = { threadId, url: forumUrl, total: posts.length, threads: rootPosts };
                                    
                                    // 彻底本地化：将整栋楼的评论写进本地数据库
                                    const cacheKey = `forum_cache:${wikiParam}:${pageNode.page}`;
                                    await prisma.setting.upsert({
                                        where: { key: cacheKey },
                                        update: { value: JSON.stringify(forumData) },
                                        create: { key: cacheKey, value: JSON.stringify(forumData) }
                                    });
                                } catch (forumErr) {
                                    // 静默处理，不影响后续投票抓取
                                }
                            }
                            // ============================================

                            let pageId = null;
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

                // 定期落库防止内存溢出
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
                // 拟人化休眠，防死原站
                await sleep(2500);
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