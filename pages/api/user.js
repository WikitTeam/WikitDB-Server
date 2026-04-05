import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '只支持 GET 请求' });
    }

    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: '缺少用户名参数' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username }
        });
        
        if (!user) {
            return res.status(404).json({ error: '找不到该用户' });
        }

        const balance = user.balance !== null ? Number(user.balance) : 10000;
        
        res.status(200).json({ 
            username: user.username,
            balance,
            isAdmin: user.isAdmin,
            status: user.status || 'active'
        });
    } catch (error) {
        res.status(500).json({ error: '获取用户信息失败' });
    }
}