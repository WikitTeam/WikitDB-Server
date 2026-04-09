import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import axios from 'axios';

const config = require('../../wikitdb.config.js');
const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: '仅支持 GET 请求' });

    const { wiki, pageId } = req.query;
    if (!wiki || !pageId) return res.status(400).json({ error: '缺少站点或页面参数' });

    try {
        // V6：最后一次强制洗牌，确保新逻辑生效，抛弃错乱头像
        const cacheKey = `forum_v6:${wiki}:${pageId}`;
        
        const record = await prisma.setting.findUnique({ where: { key: cacheKey } });
        if (record && record.value) {
            try {
                const parsed = JSON.parse(record.value);
                if (parsed && parsed.threadId && parsed.total > 0) {
                    return res.status(200).json(parsed);
                }
            } catch (e) {}
        }

        const siteConfig = config.SUPPORT_WIKI.find(s => s.PARAM === wiki);
        if (!siteConfig) return res.status(404).json({ error: '未找到该站点' });

        const baseUrl = siteConfig.URL.replace(/\/$/, '');
        const pageUrl = `${baseUrl}/${pageId}`;

        let pageHtml;
        try {
            const pageRes = await axios.get(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 12000
            });
            pageHtml = pageRes.data;
        } catch (e) {
            return res.status(500).json({ error: `文章连接失败` });
        }

        const $page = cheerio.load(pageHtml);
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

        if (!threadId) {
            const emptyData = { threadId: null, url: '', total: 0, threads: [] };
            await prisma.setting.upsert({
                where: { key: cacheKey },
                update: { value: JSON.stringify(emptyData) },
                create: { key: cacheKey, value: JSON.stringify(emptyData) }
            });
            return res.status(200).json(emptyData);
        }

        const forumUrl = `${baseUrl}/forum/t-${threadId}`;
        let forumHtml;
        try {
            const forumRes = await axios.get(forumUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 12000
            });
            forumHtml = forumRes.data;
        } catch (e) {
            return res.status(500).json({ error: `讨论区连接失败` });
        }

        const $forum = cheerio.load(forumHtml);
        const posts = [];

        $forum('.post').each((_, el) => {
            const $el = $forum(el);
            const postId = ($el.attr('id') || '').replace('post-', '');
            if (!postId) return;

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
                if ($links.length) {
                    author = $links.last().text().trim();
                } else {
                    author = $printUser.text().trim();
                }
            } else {
                author = $el.find('.head .author, .info .author').first().text().trim() || '未知用户';
            }
            author = author.replace(/[\r\n\t]+/g, '').trim();

            let userid = null;
            // 【终极暴力的地毯式提取】：不再局限于 .info！直接把整个帖子头部的所有 HTML 倒出来强行正则匹配！
            const headHtml = $el.find('.head').html() || $el.find('.info').html() || $el.html() || '';
            
            const srcMatch = headHtml.match(/avatar\.php\?userid=(\d+)/i);
            const clickMatch = headHtml.match(/userInfo\(\s*(\d+)\s*\)/i);
            const karmaMatch = headHtml.match(/userkarma\.php\?u=(\d+)/i);

            if (srcMatch) userid = srcMatch[1];
            else if (clickMatch) userid = clickMatch[1];
            else if (karmaMatch) userid = karmaMatch[1];

            let avatarUrl = '';
            if (userid) {
                // 完美复刻你给的接口：拿到ID后，加上时间戳！
                const currentTs = Math.floor(Date.now() / 1000);
                avatarUrl = `https://www.wikidot.com/avatar.php?userid=${userid}&timestamp=${currentTs}`;
            }
                
            const contentHtml = $el.find('.content').html() || '';
            const odate = $el.find('.odate').first();
            const odateClass = odate.attr('class') || '';
            const timeMatch = odateClass.match(/time_(\d+)/);
            
            let timestamp = odate.text().trim();
            if (timeMatch) {
                const dateObj = new Date(parseInt(timeMatch[1]) * 1000);
                timestamp = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
            } else if (odate.attr('title')) {
                timestamp = odate.attr('title');
            }

            posts.push({ postId, parentId, author, avatarUrl, timestamp, contentHtml, children: [] });
        });

        const postMap = {};
        const rootPosts = [];
        posts.forEach(p => postMap[p.postId] = p);
        posts.forEach(p => {
            if (p.parentId && postMap[p.parentId]) {
                postMap[p.parentId].children.push(p);
            } else {
                rootPosts.push(p);
            }
        });

        const forumData = { threadId, url: forumUrl, total: posts.length, threads: rootPosts };

        await prisma.setting.upsert({
            where: { key: cacheKey },
            update: { value: JSON.stringify(forumData) },
            create: { key: cacheKey, value: JSON.stringify(forumData) }
        });

        return res.status(200).json(forumData);

    } catch (err) {
        console.error('解析失败:', err);
        return res.status(500).json({ error: `解析引擎运行异常: ${err.message}` });
    }
}