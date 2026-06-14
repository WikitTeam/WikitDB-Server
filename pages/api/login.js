import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken, serializeAuthCookie } from '../../utils/auth';
import { rateLimit, ipRateLimit, getClientIp } from '../../utils/security';
import { withCsrf } from '../../utils/csrf';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只接受 POST 请求' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名或密码不能为空' });
    }

    try {
        const ip = getClientIp(req);

        // IP 级别限速：同一 IP 15 分钟内最多 20 次登录尝试
        if (ipRateLimit(ip, 'login', 20, 15 * 60 * 1000)) {
            return res.status(429).json({ error: '当前网络登录尝试过于频繁，请稍后再试' });
        }

        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            const limited = await rateLimit(`login:${username}`, 3, 5 * 60 * 1000);
            return res.status(limited ? 429 : 400).json({
                error: limited ? '登录尝试过于频繁，请 5 分钟后再试' : '用户名或密码错误'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            const limited = await rateLimit(`login:${username}`, 3, 5 * 60 * 1000);
            return res.status(limited ? 429 : 400).json({
                error: limited ? '登录尝试过于频繁，请 5 分钟后再试' : '用户名或密码错误'
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: '账号当前不可用' });
        }

        const token = signToken({ username: user.username, id: user.id });

        res.setHeader('Set-Cookie', serializeAuthCookie(token));

        res.status(200).json({
            message: '登录成功',
            username: user.username
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
}

export default withCsrf(handler);
