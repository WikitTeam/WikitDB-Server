import prisma from '../../lib/prisma';
import { withAuth } from '../../utils/withAuth';
import axios from 'axios';

const config = require('../../wikitdb.config.js');

let botCookieCache = null;

const COMMON_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getBotCookie() {
    if (botCookieCache) return botCookieCache;
    const user = process.env.WIKIDOT_BOT_USER;
    const pass = process.env.WIKIDOT_BOT_PASS;

    if (!user || !pass) throw new Error('服务器未配置机器人账号凭据');

    const payload = new URLSearchParams({ login: user, password: pass, action: 'Login2Action', event: 'login' });
    const res = await axios.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', payload.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': COMMON_UA },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
    });

    let sessionId = '';
    const cookies = res.headers['set-cookie'] || [];
    for (const c of cookies) {
        if (c.includes('WIKIDOT_SESSION_ID=')) {
            const match = c.match(/WIKIDOT_SESSION_ID=([^;]+)/);
            if (match) sessionId = match[1];
        }
    }
    if (!sessionId) throw new Error('机器人登录失败');
    botCookieCache = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;
    return botCookieCache;
}

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = req.user;
    const { username, wiki, threadId, content } = req.body;
    const displayUser = username || user.username || 'Unknown';

    if (!wiki || !threadId || !content || !content.trim()) {
        return res.status(400).json({ error: '请求参数不完整' });
    }

    try {
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentTrades = await prisma.trade.findMany({
            where: { userId: user.id, createdAt: { gte: tenMinsAgo } }
        });

        // 允许 10 分钟内发送 5 条
        const recentAnonCount = recentTrades.filter(t => t.data && t.data.action === 'anon_reply').length;
        if (recentAnonCount >= 5) {
            console.log(`[${new Date().toLocaleString()}] 代理回复拦截：用户 ${displayUser} 处于冷却期`);
            return res.status(429).json({ error: '发送太频繁，十分钟内仅限发送 5 条评论' });
        }

        const COST = 100;
        const currentBalance = Number(user.balance || 0);
        if (currentBalance < COST) {
            console.log(`[${new Date().toLocaleString()}] 代理回复拦截：用户 ${displayUser} 余额不足`);
            return res.status(400).json({ error: `余额不足，发送需要 ${COST} 积分` });
        }

        const siteConfig = config.SUPPORT_WIKI.find(s => s.PARAM === wiki);
        if (!siteConfig) return res.status(404).json({ error: '站点配置不存在' });
        
        const baseUrl = siteConfig.URL.replace(/\/$/, '');
        const botCookie = await getBotCookie();
        
        // 拼接实名信息：WikitDB 用户名 + 绑定的 Wikidot 账号
        const linkedWd = user.wikidotAccount || '未绑定';
        const finalContent = `**[WikitDB 代理留言]**\n本消息由 WikitDB 用户 **${user.username}** 发送，其 Wikidot 账号为：**${linkedWd}**\n\n---\n\n${content.trim()}`;
        
        const payload = new URLSearchParams({
            action: 'ForumAction',
            event: 'savePost',
            title: '', 
            parentId: '', 
            threadId: threadId,
            source: finalContent,
            wikidot_token7: '123456'
        });

        const wdRes = await axios.post(`${baseUrl}/ajax-module-connector.php`, payload.toString(), {
            headers: { 
                'Cookie': botCookie, 
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': COMMON_UA
            }
        });

        if (wdRes.data && wdRes.data.status === 'ok') {
            const newBalance = currentBalance - COST;
            await prisma.$transaction([
                prisma.user.update({ where: { id: user.id }, data: { balance: newBalance } }),
                prisma.trade.create({
                    data: {
                        userId: user.id,
                        data: { action: 'anon_reply', targetThread: threadId, cost: COST, wiki, content: content.trim(), time: Date.now() }
                    }
                })
            ]);
            return res.status(200).json({ success: true, newBalance });
        } else {
            console.error('[Wikidot Error Response]:', JSON.stringify(wdRes.data));
            const errorMsg = wdRes.data && wdRes.data.message ? `原站拒绝: ${wdRes.data.message}` : '原站拒收评论，可能存在权限限制或 Token 失效';
            return res.status(500).json({ error: errorMsg });
        }
    } catch (error) {
        console.error('Anon Reply Error:', error);
        return res.status(500).json({ error: '系统内部错误' });
    }
}

export default withAuth(handler);