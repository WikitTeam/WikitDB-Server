const axios = require('axios');
const cheerio = require('cheerio');
const { wikidotLimiter } = require('./rateLimiter');
const { sanitizeRichHtml } = require('./htmlSanitizer');

let botCookieCache = null;
let cookieExpiry = 0;

async function getBotCookie() {
    if (botCookieCache && Date.now() < cookieExpiry) return botCookieCache;

    const user = process.env.WIKIDOT_BOT_USER;
    const pass = process.env.WIKIDOT_BOT_PASS;
    if (!user || !pass) return null;

    try {
        const payload = new URLSearchParams({
            login: user, password: pass,
            action: 'Login2Action', event: 'login'
        });
        const res = await axios.post(
            'https://www.wikidot.com/default--flow/login__LoginPopupScreen',
            payload.toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'WikitDB-Bot/1.0' },
                maxRedirects: 0,
                validateStatus: s => s >= 200 && s < 400
            }
        );
        const cookies = res.headers['set-cookie'] || [];
        for (const c of cookies) {
            if (c.includes('WIKIDOT_SESSION_ID=')) {
                const sessionId = c.split('WIKIDOT_SESSION_ID=')[1].split(';')[0];
                botCookieCache = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;
                cookieExpiry = Date.now() + 3600 * 1000;
                break;
            }
        }
    } catch (e) {
        console.error('获取 Bot Cookie 失败:', e.message);
    }
    return botCookieCache;
}

async function wikidotAjax(siteUrl, params) {
    await wikidotLimiter.wait(10000);

    const baseUrl = siteUrl.replace(/\/$/, '');
    const ajaxUrl = `${baseUrl}/ajax-module-connector.php`;
    const cookie = await getBotCookie();

    const body = new URLSearchParams({ wikidot_token7: '123456', ...params });
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie || 'wikidot_token7=123456;'
    };

    const res = await axios.post(ajaxUrl, body.toString(), { headers, timeout: 15000 });
    if (res.data && res.data.status === 'ok') {
        return res.data.body || '';
    }
    throw new Error(res.data?.message || 'Wikidot AJAX 请求失败');
}

async function fetchCategories(siteUrl) {
    const html = await wikidotAjax(siteUrl, { moduleName: 'forum/ForumStartModule', hidden: 'true' });
    const $ = cheerio.load(html);
    const categories = [];

    $('.forum-group').each((_, group) => {
        $(group).find('table.table tbody tr').each((_, row) => {
            const $row = $(row);
            const $link = $row.find('td.name .title a');
            if (!$link.length) return;

            const href = $link.attr('href') || '';
            const catMatch = href.match(/\/forum\/c-(\d+)/);
            if (!catMatch) return;

            const categoryId = catMatch[1];
            const title = $link.text().trim();
            const description = $row.find('td.name .description').text().trim();
            const threadsCount = parseInt($row.find('td.threads').text().trim(), 10) || 0;
            const postsCount = parseInt($row.find('td.posts').text().trim(), 10) || 0;

            categories.push({ categoryId, title, description, threadsCount, postsCount });
        });
    });

    return categories;
}

async function fetchThreads(siteUrl, categoryId, page = 1) {
    const html = await wikidotAjax(siteUrl, {
        moduleName: 'forum/ForumViewCategoryModule',
        c: categoryId,
        p: String(page)
    });
    const $ = cheerio.load(html);
    const threads = [];

    $('.forum-table tbody tr, table.table tbody tr').each((_, row) => {
        const $row = $(row);
        const $link = $row.find('td.name .title a, td.description .title a');
        if (!$link.length) return;

        const href = $link.attr('href') || '';
        const tMatch = href.match(/\/forum\/t-(\d+)/);
        if (!tMatch) return;

        const threadId = tMatch[1];
        const title = $link.text().trim();
        const createdBy = $row.find('td.started .printuser').text().trim() || '未知';
        const createdAt = $row.find('td.started .odate').text().trim();
        const postCount = parseInt($row.find('td.posts').text().trim(), 10) || 0;
        const isSticky = $row.hasClass('sticky') || $row.find('.sticky-icon').length > 0;

        threads.push({ threadId, title, createdBy, createdAt, postCount, isSticky, isLocked: false });
    });

    let maxPage = 1;
    const $pager = $('.pager .target, .pager span');
    $pager.each((_, el) => {
        const num = parseInt($(el).text().trim(), 10);
        if (num > maxPage) maxPage = num;
    });

    return { threads, maxPage };
}
async function fetchPosts(siteUrl, threadId, page = 1) {
    const html = await wikidotAjax(siteUrl, {
        moduleName: 'forum/ForumViewThreadModule',
        t: threadId,
        pageNo: String(page)
    });
    const $ = cheerio.load(html);
    const posts = [];

    $('.post').each((_, el) => {
        const $el = $(el);
        const postId = ($el.attr('id') || '').replace('post-', '');
        if (!postId) return;

        let parentId = null;
        const $parentContainer = $el.parent('.post-container').parent('.post-container');
        if ($parentContainer.length) {
            const $parentPost = $parentContainer.children('.post').first();
            parentId = ($parentPost.attr('id') || '').replace('post-', '');
        }

        const $printUser = $el.find('.head .printuser, .info .printuser').first();
        const author = $printUser.length ? $printUser.text().trim() : '未知用户';

        let authorId = null;
        const headHtml = $el.find('.head').html() || $el.find('.info').html() || '';
        const uidMatch = headHtml.match(/avatar\.php\?userid=(\d+)/i);
        if (uidMatch) authorId = uidMatch[1];

        const title = $el.find('.title').first().text().trim();
        const contentHtml = sanitizeRichHtml($el.find('.content').html() || '');
        const createdAt = $el.find('.odate').first().text().trim();

        posts.push({ postId, parentId, title, contentHtml, author, authorId, createdAt });
    });

    let maxPage = 1;
    const $pager = $('.pager .target, .pager span');
    $pager.each((_, el) => {
        const num = parseInt($(el).text().trim(), 10);
        if (num > maxPage) maxPage = num;
    });

    return { posts, maxPage };
}

async function fetchRecentPosts(siteUrl, limit = 20) {
    const html = await wikidotAjax(siteUrl, {
        moduleName: 'forum/ForumRecentPostsModule',
        limit: String(limit)
    });
    const $ = cheerio.load(html);
    const posts = [];

    $('.post-item, .forum-recent-post, table.table tbody tr').each((_, el) => {
        const $el = $(el);
        const $threadLink = $el.find('a[href*="/forum/t-"]');
        if (!$threadLink.length) return;

        const href = $threadLink.attr('href') || '';
        const tMatch = href.match(/\/forum\/t-(\d+)/);
        const threadId = tMatch ? tMatch[1] : null;
        const threadTitle = $threadLink.text().trim();
        const author = $el.find('.printuser').text().trim() || '未知';
        const createdAt = $el.find('.odate').text().trim();

        posts.push({ threadId, threadTitle, author, createdAt });
    });

    return posts;
}

module.exports = { wikidotAjax, fetchCategories, fetchThreads, fetchPosts, fetchRecentPosts };
