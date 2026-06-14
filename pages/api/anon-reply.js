import prisma from '../../lib/prisma';
import { withAuth } from '../../utils/withAuth';
import axios from 'axios';
import { debitBalance } from '../../utils/balance';

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
    const { wiki, threadId, content } = req.body;
    const displayUser = user.username;

    if (!wiki || !/^\d+$/.test(String(threadId)) || !content || !content.trim()) {
        return res.status(400).json({ error: '请求参数不完整' });
    }

    if (content.length > 2000) {
        return res.status(400).json({ error: '内容长度不能超过 2000 个字符' });
    }

    try {
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentAnonCount = await prisma.trade.count({
            where: { 
                userId: user.id, 
                createdAt: { gte: tenMinsAgo },
                target: 'ANON_REPLY'
            }
        });

        if (recentAnonCount >= 5) {
            console.log(`[${new Date().toLocaleString()}] 代理回复拦截：用户 ${displayUser} 处于冷却期`);
            return res.status(429).json({ error: '发送太频繁，十分钟内仅限发送 5 条评论' });
        }

        const COST = 100;
        const siteConfig = config.SUPPORT_WIKI.find(s => s.PARAM === wiki);
        if (!siteConfig) return res.status(404).json({ error: '站点配置不存在' });
        
        const baseUrl = siteConfig.URL.replace(/\/$/, '');
        const botCookie = await getBotCookie();
        
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

        const reservation = await prisma.$transaction(async (tx) => {
            const debitedUser = await debitBalance(tx, user.id, COST);
            const trade = await tx.trade.create({
                data: {
                    userId: user.id,
                    type: 'TRANSFER',
                    amount: COST,
                    target: 'ANON_REPLY',
                    description: JSON.stringify({ threadId, wiki, content: content.trim() }),
                    status: 'PENDING'
                }
            });
            return { balance: debitedUser.balance, tradeId: trade.id };
        });

        try {
            const wdRes = await axios.post(`${baseUrl}/ajax-module-connector.php`, payload.toString(), {
                headers: {
                    'Cookie': botCookie,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': COMMON_UA
                },
                timeout: 15000
            });

            if (wdRes.data && wdRes.data.status === 'ok') {
                await prisma.trade.update({
                    where: { id: reservation.tradeId },
                    data: { status: 'COMPLETED' }
                });
                return res.status(200).json({ success: true, newBalance: reservation.balance });
            }

            throw new Error(wdRes.data?.message || '原站拒收评论');
        } catch (sendError) {
            await prisma.$transaction(async (tx) => {
                const pending = await tx.trade.updateMany({
                    where: { id: reservation.tradeId, status: 'PENDING' },
                    data: { status: 'FAILED' }
                });
                if (pending.count === 1) {
                    await tx.user.update({
                        where: { id: user.id },
                        data: { balance: { increment: COST } }
                    });
                }
            });
            console.error('Anon Reply Send Error:', sendError.message);
            return res.status(502).json({ error: '原站拒收评论，费用已退回' });
        }
    } catch (error) {
        console.error('Anon Reply Error:', error);
        return res.status(500).json({ error: '系统内部错误' });
    }
}


export default withAuth(handler);
