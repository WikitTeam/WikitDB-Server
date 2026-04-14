import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken, serializeAuthCookie } from '../../utils/auth';
import { rateLimit } from '../../utils/security';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只接受 POST 请求' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名或密码不能为空' });
    }

    try {
        // 速率限制：同一用户名 5 分钟内最多 5 次失败尝试
        const limited = await rateLimit(`login:${username}`, 5, 5 * 60 * 1000);
        if (limited) {
            return res.status(429).json({ error: '登录尝试过于频繁，请 5 分钟后再试' });
        }

        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) return res.status(400).json({ error: '用户名或密码错误' });

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) return res.status(400).json({ error: '用户名或密码错误' });

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