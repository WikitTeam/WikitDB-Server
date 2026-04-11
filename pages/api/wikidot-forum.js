import prisma from '../../lib/prisma';
import * as cheerio from 'cheerio';
import axios from 'axios';

const config = require('../../wikitdb.config.js');

let botCookieCache = null;

// 简单的 HTML 清洗函数，剔除恶意脚本和内联事件
function sanitizeHtml(html) {
    if (!html) return '';
    // 移除 script 标签及其内容
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // 移除 onXXX 事件处理器
    sanitized = sanitized.replace(/\son\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/\son\w+='[^']*'/gi, '');
    // 移除 javascript: 伪协议
    sanitized = sanitized.replace(/href="javascript:[^"]*"/gi, 'href="#"');
    return sanitized;
}

async function getBotCookie() {
    if (botCookieCache) return botCookieCache;
    const user = process.env.WIKIDOT_BOT_USER;
    const pass = process.env.WIKIDOT_BOT_PASS;
    if (!user || !pass) return null;

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
        if (sessionId) botCookieCache = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;
    } catch (e) {
        console.error('获取 Bot Cookie 失败:', e.message);
    }
    return botCookieCache;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { wiki, pageId } = req.query;
    if (!wiki || !pageId) return res.status(400).json({ error: 'Missing parameters' });

    try {
        const cacheKey = `forum_v8:${wiki}:${pageId}`;
        
        const record = await prisma.setting.findUnique({ where: { key: cacheKey } });
        if (record && record.value) {
            try {
                const parsed = JSON.parse(record.value);
                if (parsed && parsed.threadId && parsed.total > 0) return res.status(200).json(parsed);
            } catch (e) {}
        }

        const siteConfig = config.SUPPORT_WIKI.find(s => s.PARAM === wiki);
        if (!siteConfig) return res.status(404).json({ error: 'Site config not found' });

        const baseUrl = siteConfig.URL.replace(/\/$/, '');
        const pageUrl = `${baseUrl}/${pageId}`;

        const botCookie = await getBotCookie();
        const reqHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
        if (botCookie) reqHeaders['Cookie'] = botCookie;

        let pageHtml;
        try {
            const pageRes = await axios.get(pageUrl, { headers: reqHeaders, timeout: 12000 });
            pageHtml = pageRes.data;
        } catch (e) {
            return res.status(500).json({ error: `Connection failed` });
        }

        const $page = cheerio.load(pageHtml);
        let threadId = null;

        let href = $page('#discuss-button').attr('href');
        if (!href) href = $page('#page-info a').filter((_, el) => ($page(el).attr('href')||'').includes('/forum/t-')).attr('href');
        
        if (href) {
            const match = href.match(/\/forum\/t-(\d+)/);
            if (match) threadId = match[1];
        }

        if (!threadId) {
            const emptyData = { threadId: null, url: '', total: 0, threads: [] };
            return res.status(200).json(emptyData);
        }

        const forumUrl = `${baseUrl}/forum/t-${threadId}`;
        const forumRes = await axios.get(forumUrl, { headers: reqHeaders, timeout: 12000 });
        const $forum = cheerio.load(forumRes.data);
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
            const $printUser = $el.find('.head .printuser, .info .printuser').first();
            if ($printUser.length) author = $printUser.text().trim();

            let userid = null;
            const headHtml = $el.find('.head, .info').html() || '';
            const srcMatch = headHtml.match(/avatar\.php\?userid=(\d+)/i);
            if (srcMatch) userid = srcMatch[1];

            let avatarUrl = userid 
                ? `https://www.wikidot.com/avatar.php?userid=${userid}&timestamp=${Math.floor(Date.now()/1000)}`
                : `https://www.wikidot.com/avatar.php?account=default`;

            // 【XSS 防护】：在存入数据库/返回前端前清洗 HTML
            const rawContentHtml = $el.find('.content').html() || '';
            const contentHtml = sanitizeHtml(rawContentHtml);

            const odate = $el.find('.odate').first();
            const timestamp = odate.text().trim();

            posts.push({ postId, parentId, author, avatarUrl, timestamp, contentHtml, children: [] });
        }

        const postMap = {};
        const rootPosts = [];
        posts.forEach(p => postMap[p.postId] = p);
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

        return res.status(200).json(forumData);

    } catch (err) {
        console.error('Forum Fetch Failure:', err);
        return res.status(500).json({ error: `Audit Engine Error` });
    }
}