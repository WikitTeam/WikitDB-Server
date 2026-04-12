import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from '../../utils/auth';
import { serialize } from 'cookie';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只接受 POST 请求' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名或密码不能为空' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username }
        });
        
        if (!user) return res.status(400).json({ error: '用户名或密码错误' });

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) return res.status(400).json({ error: '用户名或密码错误' });

        const token = signToken({ username: user.username });

        res.setHeader('Set-Cookie', serialize('auth_token', token, {
            httpOnly: true,
            secure: false, 
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
            domain: req.headers.host.split(':')[0] // 动态适配当前域名
        }));

        res.status(200).json({ 
            message: '登录成功',
            username: user.username
        });

    } catch (error) {
        res.status(500).json({ error: '数据库连接异常' });
    }
}