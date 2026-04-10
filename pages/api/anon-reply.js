import { PrismaClient } from '@prisma/client';
import axios from 'axios';

// 【核心修复1】：引入配置文件，用于反查真实网址
const config = require('../../wikitdb.config.js');
const prisma = new PrismaClient();

// 内存缓存机器人 Cookie
let botCookieCache = null;

async function getBotCookie() {
    if (botCookieCache) return botCookieCache;

    const user = process.env.WIKIDOT_BOT_USER;
    const pass = process.env.WIKIDOT_BOT_PASS;

    if (!user || !pass) throw new Error('服务器未配置机器人账号密码');

    const payload = new URLSearchParams({
        login: user,
        password: pass,
        action: 'Login2Action',
        event: 'login'
    });

    const res = await axios.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', payload.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
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

    if (!sessionId) {
        throw new Error('机器人账号登录原站失败，请检查账号密码是否正确');
    }

    botCookieCache = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;
    return botCookieCache;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { username, wiki, threadId, content } = req.body;

    if (!username) {
        return res.status(401).json({ error: '未登录，无法使用匿名回复' });
    }

    if (!wiki || !threadId || !content || !content.trim()) {
        return res.status(400).json({ error: '请求参数不完整' });
    }

    if (content.length > 500) {
        return res.status(400).json({ error: '评论内容过长，请控制在500字以内' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ error: '找不到用户档案' });

        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentTrades = await prisma.trade.findMany({
            where: {
                userId: user.id,
                createdAt: { gte: tenMinsAgo }
            }
        });

        const hasRecentAnon = recentTrades.some(t => t.data && t.data.action === 'anon_reply');
        if (hasRecentAnon) {
            return res.status(429).json({ error: '发送太频繁，十分钟内仅限发送一条匿名评论' });
        }

        const COST = 100;
        const currentBalance = user.balance !== null ? Number(user.balance) : 10000;

        if (currentBalance < COST) {
            return res.status(400).json({ error: `余额不足，匿名发送需要消耗 ${COST}` });
        }

        // 【核心修复2】：通过代号查找真实的站点 URL
        const siteConfig = config.SUPPORT_WIKI.find(s => s.PARAM === wiki);
        if (!siteConfig) {
            return res.status(404).json({ error: '配置文件中未找到该站点，无法发帖' });
        }
        
        const baseUrl = siteConfig.URL.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/ajax-module-connector.php`;

        let botCookie;
        try {
            botCookie = await getBotCookie();
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }

        const finalContent = `**[WikitDB 匿名留言]**\n\n${content.trim()}`;
        
        // 【核心修复3】：补齐 Wikidot 发帖接口需要的空参数
        const payload = new URLSearchParams({
            action: 'ForumAction',
            event: 'savePost',
            title: '',           // 防报错，留空
            parentId: '',        // 防报错，表示回复主楼
            threadId: threadId,
            source: finalContent,
            wikidot_token7: '123456'
        });

        const axiosConfig = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': botCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        };

        let wdData;
        try {
            const wdRes = await axios.post(targetUrl, payload.toString(), axiosConfig);
            wdData = wdRes.data;
        } catch (e) {
            return res.status(500).json({ error: '原站接口响应异常，可能被防火墙拦截' });
        }

        if (wdData.status !== 'ok') {
            console.log('发帖回执异常，检测到 Cookie 可能失效，正在自动重新登录...');
            botCookieCache = null;
            botCookie = await getBotCookie();
            axiosConfig.headers['Cookie'] = botCookie;
            
            try {
                const retryRes = await axios.post(targetUrl, payload.toString(), axiosConfig);
                wdData = retryRes.data;
            } catch (e) {
                return res.status(500).json({ error: '重试发送失败，原站可能拒绝连接' });
            }
        }

        if (wdData && wdData.status === 'ok') {
            const newBalance = currentBalance - COST;

            await prisma.$transaction([
                prisma.user.update({
                    where: { id: user.id },
                    data: { balance: newBalance }
                }),
                prisma.trade.create({
                    data: {
                        userId: user.id,
                        data: {
                            action: 'anon_reply',
                            targetThread: threadId,
                            cost: COST,
                            time: Date.now()
                        }
                    }
                })
            ]);

            return res.status(200).json({ success: true, newBalance });
        } else {
            console.log("原站返回的错误体:", wdData);
            return res.status(500).json({ error: '原站拒收评论，请确保机器人账号已经加入了该站点' });
        }

    } catch (error) {
        console.error('匿名评论发送内部失败:', error);
        return res.status(500).json({ error: '服务器处理请求时发生内部错误' });
    }
}