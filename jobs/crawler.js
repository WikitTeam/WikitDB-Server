/**
 * 评分 / 讨论区爬虫，按时间片推进。
 * 每一片都把游标写进 settings，调用结束即可销毁进程。
 * 整轮间隔仍是 3 小时，由外部调度反复调用，而不是进程内 node-cron。
 */
const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const prisma = require('../lib/prisma');
const { loadEffectiveConfig } = require('../utils/siteConfig');
const { buildBackupArgs, getWikiName } = require('../utils/wikitBackup');
const { appendJobLogs } = require('../utils/jobLog');
const { withJobLock } = require('../utils/jobLock');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const request = axios.create({ httpAgent, httpsAgent, timeout: 15000 });

const CRAWL_INTERVAL_MS = 3 * 60 * 60 * 1000;
const DEFAULT_BUDGET_MS = 45 * 1000;
const CONCURRENCY = 3;
const CURSOR_KEY = 'crawler:cursor';
const STATUS_KEY = 'crawler:status';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logBuffer = [];

function logLine(...args) {
    const line = args.map(String).join(' ');
    console.log(line);
    logBuffer.push(`[${new Date().toLocaleString()}] ${line}`);
}

async function flushLogs() {
    if (logBuffer.length === 0) return;
    const lines = logBuffer.splice(0, logBuffer.length);
    await appendJobLogs('crawler', lines);
}

function normalize(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        try { return JSON.parse(value); } catch (e) { return null; }
    }
    return value;
}

async function readJsonSetting(key) {
    const row = await prisma.setting.findUnique({ where: { key } });
    return normalize(row && row.value);
}

async function writeJsonSetting(key, value) {
    await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
    });
}

function buildSiteStatus(siteConfig) {
    return {
        param: siteConfig.PARAM,
        name: siteConfig.NAME,
        status: 'pending',
        pagesFound: 0,
        pagesProcessed: 0,
        votes: 0,
        discussions: 0,
        errors: 0,
        startedAt: null,
        finishedAt: null,
        lastRun: null,
        error: null,
    };
}

function freshCursor(sites, previous) {
    return {
        phase: 'list',
        siteIndex: 0,
        listPage: 1,
        totalPages: 1,
        listErrors: 0,
        pages: [],
        pageOffset: 0,
        siteVotes: 0,
        siteDiscussions: 0,
        siteErrors: 0,
        userVotesMap: {},
        nextCycleAt: 0,
        status: {
            running: true,
            startedAt: Date.now(),
            finishedAt: null,
            currentSite: null,
            currentStage: 'list',
            overall: { totalSites: sites.length, doneSites: 0 },
            sites: sites.map(buildSiteStatus),
            lastRun: previous && previous.status ? previous.status.lastRun : null,
        },
    };
}

function summary(cursor, extra = {}) {
    return {
        phase: cursor ? cursor.phase : 'idle',
        siteIndex: cursor ? cursor.siteIndex : 0,
        pageOffset: cursor ? cursor.pageOffset : 0,
        pages: cursor && cursor.pages ? cursor.pages.length : 0,
        nextCycleAt: cursor ? cursor.nextCycleAt : null,
        ...extra,
    };
}

let botCookieCache = null;

async function getBotCookie() {
    if (botCookieCache) return botCookieCache;
    const user = process.env.WIKIDOT_BOT_USER;
    const pass = process.env.WIKIDOT_BOT_PASS;
    if (!user || !pass) {
        logLine('未配置机器人账号，将以访客身份进行抓取...');
        return null;
    }
    try {
        const payload = new URLSearchParams({ login: user, password: pass, action: 'Login2Action', event: 'login' });
        const res = await axios.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'WikitDB-Bot/1.0' },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
        });
        let sessionId = '';
        const cookies = res.headers['set-cookie'] || [];
        for (const c of cookies) {
            if (c.includes('WIKIDOT_SESSION_ID=')) sessionId = c.split('WIKIDOT_SESSION_ID=')[1].split(';')[0];
        }
        if (sessionId) {
            botCookieCache = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;
            logLine('机器人账号登录成功，已获取受限站点抓取权限。');
        }
    } catch (e) {
        console.error('获取 Bot Cookie 失败:', e.message);
    }
    return botCookieCache;
}

function wikiHost(siteConfig) {
    return siteConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
}

async function fetchListPage(cursor, siteConfig) {
    const wikiParam = siteConfig.PARAM;
    const actualWikiName = wikiHost(siteConfig);
    try {
        logLine(`获取 [${wikiParam}] 清单 第 ${cursor.listPage} 页...`);
        const res = await request.get(`https://wikit.unitreaty.org/listpages?wiki=${actualWikiName}&p=${cursor.listPage}`);
        const lines = String(res.data).split('\n').map((l) => l.trim()).filter(Boolean);
        let countThisPage = 0;
        lines.forEach((line) => {
            if (line.startsWith('Total Pages:')) {
                cursor.totalPages = parseInt(line.replace('Total Pages:', '').trim(), 10) || 1;
            } else if (line.includes('http') && line.includes('|')) {
                const parts = line.split('|').map((item) => item.trim());
                if (parts.length >= 7) {
                    const url = parts[0];
                    const pageSlug = url.split('/').pop();
                    let author = parts[6] || '未知';
                    const match = author.match(/^(.*?)\s*\(\d+\)$/);
                    if (match) author = match[1].trim();
                    cursor.pages.push({
                        page: pageSlug,
                        title: parts[1],
                        author,
                        wiki: wikiParam,
                        rating: parseInt(parts[3], 10) || 0,
                        upvotes: parseInt(parts[4], 10) || 0,
                        downvotes: parseInt(parts[5], 10) || 0,
                    });
                    countThisPage++;
                }
            }
        });
        logLine(`成功 ${countThisPage} 篇`);
        cursor.listErrors = 0;
        await sleep(400);
        if (cursor.listPage >= cursor.totalPages) {
            cursor.phase = 'pages';
            cursor.pageOffset = 0;
            const siteStatus = cursor.status.sites.find((s) => s.param === wikiParam);
            if (siteStatus) {
                siteStatus.pagesFound = cursor.pages.length;
                cursor.status.currentStage = 'crawl';
            }
        } else {
            cursor.listPage += 1;
        }
    } catch (e) {
        cursor.listErrors = (cursor.listErrors || 0) + 1;
        logLine(`[${wikiParam}] 清单第 ${cursor.listPage} 页失败 (${cursor.listErrors}): ${e.message}`);
        if (cursor.listErrors >= 3) {
            cursor.listPage += 1;
            cursor.listErrors = 0;
            if (cursor.listPage > cursor.totalPages) {
                cursor.phase = 'pages';
                cursor.pageOffset = 0;
            }
        } else {
            await sleep(1500);
        }
    }
}

async function flushVotes(userVotesMap) {
    for (const [user, newVotes] of Object.entries(userVotesMap)) {
        const key = `user_votes_${user.toLowerCase().replace(/_/g, '-').replace(/ /g, '-')}`;
        const record = await prisma.setting.findUnique({ where: { key } });
        const existingMap = new Map();
        if (record) {
            const parsed = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
            if (Array.isArray(parsed)) parsed.forEach((v) => existingMap.set(`${v.wiki}:${v.page}`, v));
        }
        newVotes.forEach((nv) => {
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
            update: { value: truncatedVotes },
            create: { key, value: truncatedVotes },
        });
    }
}

async function scrapeOne(pageNode, siteConfig, baseHeaders, cursor) {
    const baseUrl = siteConfig.URL.replace(/\/$/, '');
    const secureUrl = `${baseUrl}/${pageNode.page}`;
    const wikiParam = siteConfig.PARAM;
    let success = false;
    let attempt = 0;
    while (!success && attempt < 3) {
        attempt++;
        try {
            const { data: html } = await request.get(secureUrl, { headers: baseHeaders });
            const $page = cheerio.load(html);
            let threadId = null;
            let href = $page('#discuss-button').attr('href');
            if (!href) href = $page('#page-info a').filter((_, el) => ($page(el).attr('href') || '').includes('/forum/t-')).attr('href');
            if (!href) {
                href = $page('#page-content').parent().find('a').filter((_, el) => {
                    const text = $page(el).text().toLowerCase();
                    return (text.includes('discuss') || text.includes('讨论') || text.includes('评论')) && ($page(el).attr('href') || '').includes('/forum/t-');
                }).attr('href');
            }
            if (href) {
                const match = href.match(/\/forum\/t-(\d+)/);
                if (match) threadId = match[1];
            }
            const cacheKey = `forum_v7:${wikiParam}:${pageNode.page}`;
            if (threadId) {
                cursor.siteDiscussions++;
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
                            author = $links.length ? $links.last().text().trim() : $printUser.text().trim();
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
                            if (userIdCache[author]) userid = userIdCache[author];
                            else {
                                try {
                                    const lookupRes = await axios.get(`https://www.wikidot.com/quickmodule.php?module=UserLookupQModule&q=${encodeURIComponent(author)}`, { timeout: 5000 });
                                    if (lookupRes.data && lookupRes.data.users && lookupRes.data.users.length > 0) {
                                        userid = lookupRes.data.users[0].user_id;
                                        userIdCache[author] = userid;
                                    }
                                } catch (lookupErr) { /* 忽略 */ }
                            }
                        }
                        const currentTs = Math.floor(Date.now() / 1000);
                        const avatarUrl = userid
                            ? `https://www.wikidot.com/avatar.php?userid=${userid}&timestamp=${currentTs}`
                            : 'https://www.wikidot.com/avatar.php?account=default';
                        const contentHtml = $el.find('.content').html() || '';
                        const odate = $el.find('.odate').first();
                        const odateClass = odate.attr('class') || '';
                        const timeMatch = odateClass.match(/time_(\d+)/);
                        let timestamp = odate.text().trim();
                        if (timeMatch) {
                            const dateObj = new Date(parseInt(timeMatch[1], 10) * 1000);
                            timestamp = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                        } else if (odate.attr('title')) timestamp = odate.attr('title');
                        posts.push({ postId, parentId, author, avatarUrl, timestamp, contentHtml, children: [] });
                    }
                    const postMap = {};
                    const rootPosts = [];
                    posts.forEach((p) => { p.children = []; postMap[p.postId] = p; });
                    posts.forEach((p) => {
                        if (p.parentId && postMap[p.parentId]) postMap[p.parentId].children.push(p);
                        else rootPosts.push(p);
                    });
                    await prisma.setting.upsert({
                        where: { key: cacheKey },
                        update: { value: { threadId, url: forumUrl, total: posts.length, threads: rootPosts } },
                        create: { key: cacheKey, value: { threadId, url: forumUrl, total: posts.length, threads: rootPosts } },
                    });
                    logLine(`[成功] 讨论区入库: ${pageNode.page} (${posts.length}条)`);
                } catch (forumErr) {
                    console.error(`[失败] ${pageNode.page} 讨论区抓取报错: ${forumErr.message}`);
                }
            } else {
                await prisma.setting.upsert({
                    where: { key: cacheKey },
                    update: { value: { threadId: null, url: '', total: 0, threads: [] } },
                    create: { key: cacheKey, value: { threadId: null, url: '', total: 0, threads: [] } },
                });
            }

            let pageId = null;
            const idMatch = html.match(/pageId\s*[:=]\s*['"]?(\d+)['"]?/i) || html.match(/page_id\s*[:=]\s*['"]?(\d+)['"]?/i);
            if (idMatch) pageId = idMatch[1];
            if (!pageId) { success = true; return; }

            const origin = new URL(secureUrl).origin;
            const ajaxUrl = `${origin}/ajax-module-connector.php`;
            const botCookie = baseHeaders.Cookie;
            const { data: rateData } = await request.post(
                ajaxUrl,
                `pageId=${pageId}&page_id=${pageId}&moduleName=pagerate/WhoRatedPageModule&wikidot_token7=123456`,
                { headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Cookie: botCookie || 'wikidot_token7=123456;' } },
            );
            if (rateData.status === 'ok' && rateData.body) {
                const $rate = cheerio.load(rateData.body);
                $rate('.printuser').each((_, el) => {
                    const user = $rate(el).text().trim();
                    let vote = '+1';
                    let textAfter = '';
                    let curr = el.next;
                    while (curr) {
                        if (curr.type === 'tag' && (curr.tagName === 'br' || (curr.attribs && curr.attribs.class && curr.attribs.class.includes('printuser')))) break;
                        if (curr.type === 'text') textAfter += curr.data;
                        else if (curr.type === 'tag') textAfter += $rate(curr).text();
                        curr = curr.next;
                    }
                    if (textAfter.includes('-')) vote = '-1';
                    if (!cursor.userVotesMap[user]) cursor.userVotesMap[user] = [];
                    cursor.userVotesMap[user].push({
                        wiki: wikiParam, page: pageNode.page, title: pageNode.title, vote, author: pageNode.author, date: Date.now(),
                    });
                    cursor.siteVotes++;
                });
            }
            success = true;
        } catch (err) {
            cursor.siteErrors++;
            if (attempt < 3) await sleep(1000);
        }
    }
}

function touchSite(cursor, siteConfig, patch) {
    const siteStatus = cursor.status.sites.find((s) => s.param === siteConfig.PARAM);
    if (!siteStatus) return;
    Object.assign(siteStatus, patch);
}

async function finishSite(cursor, siteConfig) {
    await flushVotes(cursor.userVotesMap || {});
    cursor.userVotesMap = {};
    touchSite(cursor, siteConfig, {
        status: 'done',
        finishedAt: Date.now(),
        lastRun: Date.now(),
        pagesProcessed: cursor.pageOffset,
        pagesFound: cursor.pages.length,
        votes: cursor.siteVotes,
        discussions: cursor.siteDiscussions,
        errors: cursor.siteErrors,
    });
    cursor.status.overall.doneSites = cursor.status.sites.filter((s) => s.status === 'done').length;
    cursor.status.currentSite = null;
    cursor.status.currentStage = 'done';
    cursor.siteIndex += 1;
    cursor.phase = 'list';
    cursor.listPage = 1;
    cursor.totalPages = 1;
    cursor.listErrors = 0;
    cursor.pages = [];
    cursor.pageOffset = 0;
    cursor.siteVotes = 0;
    cursor.siteDiscussions = 0;
    cursor.siteErrors = 0;
}

function finishCycle(cursor) {
    cursor.phase = 'idle';
    cursor.pages = [];
    cursor.userVotesMap = {};
    cursor.nextCycleAt = Date.now() + CRAWL_INTERVAL_MS;
    cursor.status.running = false;
    cursor.status.finishedAt = Date.now();
    cursor.status.lastRun = Date.now();
    cursor.status.currentSite = null;
    cursor.status.currentStage = '';
    cursor.status.overall.doneSites = cursor.status.sites.filter((s) => s.status === 'done').length;
    return cursor;
}

async function runCrawlSlice(opts = {}) {
    const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : DEFAULT_BUDGET_MS;
    const started = Date.now();
    const over = () => Date.now() - started >= budgetMs;

    return withJobLock('crawl', budgetMs + 30 * 1000, async () => {
        const sites = ((await loadEffectiveConfig()).SUPPORT_WIKI) || [];
        let cursor = await readJsonSetting(CURSOR_KEY);
        if (!cursor || cursor.phase === 'idle' || !cursor.status) {
            if (cursor && cursor.nextCycleAt && Date.now() < cursor.nextCycleAt && !opts.force) {
                return summary(cursor, { skipped: true, reason: 'cooldown' });
            }
            logLine(`\n[${new Date().toLocaleString()}] 开始执行全站数据(评分+讨论区)爬取...`);
            cursor = freshCursor(sites, cursor);
        }

        const botCookie = await getBotCookie();
        const baseHeaders = { 'User-Agent': 'Mozilla/5.0' };
        if (botCookie) baseHeaders.Cookie = botCookie;

        try {
            while (!over()) {
                if (cursor.siteIndex >= sites.length) {
                    cursor = finishCycle(cursor);
                    await writeJsonSetting(CURSOR_KEY, cursor);
                    await writeJsonSetting(STATUS_KEY, cursor.status);
                    logLine('本轮爬取结束。');
                    await flushLogs();
                    return summary(cursor, { done: true });
                }

                const siteConfig = sites[cursor.siteIndex];
                cursor.status.currentSite = siteConfig.PARAM;
                const siteStatus = cursor.status.sites.find((s) => s.param === siteConfig.PARAM);
                if (siteStatus && siteStatus.status === 'pending') {
                    siteStatus.status = 'running';
                    siteStatus.startedAt = Date.now();
                    siteStatus.error = null;
                }

                if (cursor.phase === 'list') {
                    cursor.status.currentStage = 'list';
                    await fetchListPage(cursor, siteConfig);
                } else if (cursor.pageOffset >= cursor.pages.length) {
                    await finishSite(cursor, siteConfig);
                } else {
                    cursor.status.currentStage = 'crawl';
                    const batch = cursor.pages.slice(cursor.pageOffset, cursor.pageOffset + CONCURRENCY);
                    await Promise.all(batch.map((pageNode) => scrapeOne(pageNode, siteConfig, baseHeaders, cursor)));
                    cursor.pageOffset += batch.length;
                    touchSite(cursor, siteConfig, {
                        pagesProcessed: cursor.pageOffset,
                        pagesFound: cursor.pages.length,
                        votes: cursor.siteVotes,
                        discussions: cursor.siteDiscussions,
                        errors: cursor.siteErrors,
                    });
                    if (cursor.pageOffset % 100 < CONCURRENCY || cursor.pageOffset >= cursor.pages.length) {
                        await flushVotes(cursor.userVotesMap || {});
                        cursor.userVotesMap = {};
                    }
                    logLine(`--- 当前进度: [${cursor.pageOffset}/${cursor.pages.length}] ${siteConfig.PARAM} ---`);
                    await sleep(2500);
                }

                await writeJsonSetting(CURSOR_KEY, cursor);
                await writeJsonSetting(STATUS_KEY, cursor.status);
            }
        } catch (e) {
            logLine(`发生异常: ${e.message}`);
            cursor.status.sites.forEach((s) => {
                if (s.status === 'running') {
                    s.status = 'error';
                    s.error = e.message;
                }
            });
            cursor.status.running = false;
            await writeJsonSetting(CURSOR_KEY, cursor);
            await writeJsonSetting(STATUS_KEY, cursor.status);
            await flushLogs();
            return summary(cursor, { done: false, error: e.message });
        }

        await flushLogs();
        return summary(cursor, { done: false });
    });
}

function runBackup() {
    if (process.env.VERCEL) {
        return Promise.resolve({
            skipped: true,
            reason: 'wikit CLI 需要本地二进制和磁盘，不能在无服务器函数里跑。请用 GitHub Actions 的备份工作流。',
        });
    }
    return withJobLock('backup', 6 * 60 * 60 * 1000, async () => {
        const config = await loadEffectiveConfig();
        const wikiNames = (config.SUPPORT_WIKI || []).map(getWikiName).filter(Boolean);
        if (wikiNames.length === 0) {
            logLine(`[${new Date().toLocaleString()}] 没有可备份的站点。`);
            await flushLogs();
            return { skipped: true, reason: 'no-wikis' };
        }
        const args = buildBackupArgs({ wikiNames, keepRemoved: true, baseDir: process.env.WIKIT_BASE_DIR || undefined });
        logLine(`[${new Date().toLocaleString()}] 开始 wikit 备份，共 ${wikiNames.length} 个站点。`);
        const code = await new Promise((resolve) => {
            const child = spawn('wikit', args, {
                cwd: process.cwd(),
                env: process.env,
                shell: false,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            child.stdout.on('data', (chunk) => logLine(`[wikit] ${chunk}`));
            child.stderr.on('data', (chunk) => logLine(`[wikit] ${chunk}`));
            child.on('error', (error) => {
                logLine(`无法启动 wikit: ${error.message}`);
                resolve(127);
            });
            child.on('close', (exitCode) => resolve(exitCode));
        });
        logLine(`Wikit 备份结束，退出码 ${code}。`);
        await flushLogs();
        return { done: true, exitCode: code };
    });
}

module.exports = {
    runCrawlSlice,
    runBackup,
    CRAWL_INTERVAL_MS,
    DEFAULT_BUDGET_MS,
};
