import prisma from '../../lib/prisma';
import { withAuth } from '../../utils/withAuth';
import axios from 'axios';

const config = require('../../wikitdb.config.js');

// 内存缓存机器人 Cookie
let botCookieCache = null;

async function getBotCookie() {
    if (botCookieCache) return botCookieCache;

    const user = process.env.WIKIDOT_BOT_USER;
    const pass = process.env.WIKIDOT_BOT_PASS;

    if (!user || !pass) throw new Error('服务器未配置机器人账号凭据');

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
        throw new Error('机器人账号登录失败，请检查凭据有效性');
    }

    botCookieCache = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;
    return botCookieCache;
}

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 从 withAuth 中间件直接获取经过验证的用户
    const user = req.user;
    const { wiki, threadId, content } = req.body;

    if (!wiki || !threadId || !content || !content.trim()) {
        return res.status(400).json({ error: '请求参数不完整' });
    }

    if (content.length > 500) {
        return res.status(400).json({ error: '评论内容过长，请精简至 500 字以内' });
    }

    try {
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentTrades = await prisma.trade.findMany({
            where: {
                userId: user.id,
                createdAt: { gte: tenMinsAgo }
            }
        });

        const hasRecentAnon = recentTrades.some(t => t.data && t.data.action === 'anon_reply');
        if (hasRecentAnon) {
            return res.status(429).json({ error: '操作频率受限，请在 10 分钟后重试' });
        }

        const COST = 100;
        const currentBalance = user.balance !== null ? Number(user.balance) : 10000;

        if (currentBalance < COST) {
            return res.status(400).json({ error: `余额不足（所需: ${COST}）` });
        }

        const siteConfig = config.SUPPORT_WIKI.find(s => s.PARAM === wiki);
        if (!siteConfig) {
            return res.status(404).json({ error: '目标站点配置不存在' });
        }
        
        const baseUrl = siteConfig.URL.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/ajax-module-connector.php`;

        const botCookie = await getBotCookie();
        const finalContent = `**[WikitDB 匿名留言]**\n\n${content.trim()}`;
        
        const payload = new URLSearchParams({
            action: 'ForumAction',
            event: 'savePost',
            title: '',
            parentId: '',
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

        const wdRes = await axios.post(targetUrl, payload.toString(), axiosConfig);
        const wdData = wdRes.data;

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
            return res.status(500).json({ error: '原站拒收评论，请检查权限配置' });
        }

    } catch (error) {
        console.error('Anon Reply Process Error:', error);
        return res.status(500).json({ error: '系统内部处理异常' });
    }
}

export default withAuth(handler);