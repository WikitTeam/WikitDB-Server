const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');
const https = require('https');
const prisma = require('./lib/prisma');
const config = require('./wikitdb.config.js');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const request = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 15000
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

let botCookieCache = null;

async function getBotCookie() {
    if (botCookieCache) return botCookieCache;
    const user = process.env.WIKIDOT_BOT_USER;
    const pass = process.env.WIKIDOT_BOT_PASS;
    if (!user || !pass) {
        console.log("未配置机器人账号，将以访客身份进行抓取...");
        return null;
    }

    try {
        const payload = new URLSearchParams({ login: user, password: pass, action: 'Login2Action', event: 'login' });
        const res = await axios.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'WikitDB-Bot/1.0' },
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });
        let sessionId = '';
        const cookies = res.headers['set-cookie'] || [];
        for (const c of cookies) {
            if (c.includes('WIKIDOT_SESSION_ID=')) {
                sessionId = c.split('WIKIDOT_SESSION_ID=')[1].split(';')[0];
            }
        }
        if (sessionId) {
            botCookieCache = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;
            console.log("机器人账号登录成功，已获取受限站点抓取权限。");
        }
    } catch (e) {
        console.error('获取 Bot Cookie 失败:', e.message);
    }
    return botCookieCache;
}

let isRunning = false;

async function runCrawler() {
    if (isRunning) {
        console.log(`[${new Date().toLocaleString()}] 警告：上一轮爬虫尚未结束，跳过本次触发。`);
        return;
    }
    isRunning = true;

    try {
        const botCookie = await getBotCookie();
        const baseHeaders = { 'User-Agent': 'Mozilla/5.0' };
        if (botCookie) baseHeaders['Cookie'] = botCookie;

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
                            const { data: html } = await request.get(secureUrl, { headers: baseHeaders });
                            
                            const $page = cheerio.load(html);
                            let threadId = null;
                            
                            let href = $page('#discuss-button').attr('href');
                            if (!href) href = $page('#page-info a').filter((_, el) => ($page(el).attr('href')||'').includes('/forum/t-')).attr('href');
                            if (!href) href = $page('#page-content').parent().find('a').filter((_, el) => {
                                const text = $page(el).text().toLowerCase();
                                return (text.includes('discuss') || text.includes('讨论') || text.includes('评论')) && ($page(el).attr('href')||'').includes('/forum/t-');
                            }).attr('href');

                            if (href) {
                                const match = href.match(/\/forum\/t-(\d+)/);
                                if (match) threadId = match[1];
                            }

                            const cacheKey = `forum_v7:${wikiParam}:${pageNode.page}`;

                            if (threadId) {
                                try {
                                    const forumUrl = `${baseUrl}/forum/t-${threadId}`;
                                    const { data: forumHtml } = await request.get(forumUrl, { headers: baseHeaders });
                                    const $forum = cheerio.load(forumHtml);
                                    const posts = [];
                                    const userIdCache = {};
                                    
                                    const postElements = $forum('.post').toArray();
                                    for (const el of postElements) {
                                        const $el = $forum(el);
                                        const postId = ($el.attr('id') || '').replace('post-', '');
                                        if (!postId) continue;

                                        let parentId = null;
                                        const $parentContainer = $el.parent('.post-container').parent('.post-container');
                                        if ($parentContainer.length) {
                                            const $parentPost = $parentContainer.children('.post').first();
                                            parentId = ($parentPost.attr('id') || '').replace('post-', '');
                                        }

                                        let author = '未知用户';
                                        const $printUser = $el.find('.head .printuser').length ? $el.find('.head .printuser').first() : $el.find('.info .printuser').first();
                                        
                                        if ($printUser.length) {
                                            const $links = $printUser.find('a');
                                            if ($links.length) author = $links.last().text().trim();
                                            else author = $printUser.text().trim();
                                        } else {
                                            author = $el.find('.head .author, .info .author').first().text().trim() || '未知用户';
                                        }
                                        author = author.replace(/[\r\n\t]+/g, '').trim();

                                        let userid = null;
                                        const headHtml = $el.find('.head').html() || $el.find('.info').html() || $el.html() || '';
                                        const srcMatch = headHtml.match(/avatar\.php\?userid=(\d+)/i);
                                        const clickMatch = headHtml.match(/userInfo\(\s*(\d+)\s*\)/i);
                                        const karmaMatch = headHtml.match(/userkarma\.php\?u=(\d+)/i);

                                        if (srcMatch) userid = srcMatch[1];
                                        else if (clickMatch) userid = clickMatch[1];
                                        else if (karmaMatch) userid = karmaMatch[1];

                                        if (!userid && author !== '未知用户') {
                                            if (userIdCache[author]) {
                                                userid = userIdCache[author];
                                            } else {
                                                try {
                                                    const lookupRes = await axios.get(`https://www.wikidot.com/quickmodule.php?module=UserLookupQModule&q=${encodeURIComponent(author)}`, { timeout: 5000 });
                                                    if (lookupRes.data && lookupRes.data.users && lookupRes.data.users.length > 0) {
                                                        userid = lookupRes.data.users[0].user_id;
                                                        userIdCache[author] = userid;
                                                    }
                                                } catch (lookupErr) {
                                                    // 忽略查询报错
                                                }
                                            }
                                        }

                                        let avatarUrl = '';
                                        if (userid) {
                                            const currentTs = Math.floor(Date.now() / 1000);
                                            avatarUrl = `https://www.wikidot.com/avatar.php?userid=${userid}&timestamp=${currentTs}`;
                                        } else {
                                            avatarUrl = `https://www.wikidot.com/avatar.php?account=default`;
                                        }

                                        const contentHtml = $el.find('.content').html() || '';
                                        const odate = $el.find('.odate').first();
                                        const odateClass = odate.attr('class') || '';
                                        const timeMatch = odateClass.match(/time_(\d+)/);
                                        
                                        let timestamp = odate.text().trim();
                                        if (timeMatch) {
                                            const dateObj = new Date(parseInt(timeMatch[1]) * 1000);
                                            timestamp = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                                        } else if (odate.attr('title')) timestamp = odate.attr('title');

                                        posts.push({ postId, parentId, author, avatarUrl, timestamp, contentHtml, children: [] });
                                    }
                                    
                                    const postMap = {};
                                    const rootPosts = [];
                                    posts.forEach(p => { p.children = []; postMap[p.postId] = p; });
                                    posts.forEach(p => { 
                                        if (p.parentId && postMap[p.parentId]) postMap[p.parentId].children.push(p); 
                                        else rootPosts.push(p); 
                                    });
                                    
                                    const forumData = { threadId, url: forumUrl, total: posts.length, threads: rootPosts };
                                    
                                    await prisma.setting.upsert({
                                        where: { key: cacheKey },
                                        update: { value: JSON.stringify(forumData) },
                                        create: { key: cacheKey, value: JSON.stringify(forumData) }
                                    });
                                    console.log(`[成功] 讨论区入库: ${pageNode.page} (${posts.length}条)`);
                                } catch (forumErr) {
                                    console.error(`[失败] ${pageNode.page} 讨论区抓取报错: ${forumErr.message}`);
                                }
                            } else {
                                const emptyData = { threadId: null, url: '', total: 0, threads: [] };
                                await prisma.setting.upsert({
                                    where: { key: cacheKey },
                                    update: { value: JSON.stringify(emptyData) },
                                    create: { key: cacheKey, value: JSON.stringify(emptyData) }
                                });
                            }

                            let pageId = null;
                            const idMatch = html.match(/pageId\s*[:=]\s*['"]?(\d+)['"]?/i) || html.match(/page_id\s*[:=]\s*['"]?(\d+)['"]?/i);
                            if (idMatch) pageId = idMatch[1];
                            if (!pageId) { success = true; return; }

                            const origin = new URL(secureUrl).origin;
                            const ajaxUrl = `${origin}/ajax-module-connector.php`;
                            
                            const ajaxHeaders = {
                                'User-Agent': 'Mozilla/5.0',
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                'Cookie': botCookie ? botCookie : 'wikidot_token7=123456;'
                            };
                            const { data: rateData } = await request.post(ajaxUrl, `pageId=${pageId}&page_id=${pageId}&moduleName=pagerate/WhoRatedPageModule&wikidot_token7=123456`, {
                                headers: ajaxHeaders
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