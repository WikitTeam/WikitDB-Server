import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '仅支持 GET 请求' });
    }

    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: '缺少用户名' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                trades: { orderBy: { id: 'asc' } },
                gachas: { orderBy: { id: 'asc' } }
            }
        });

        if (!user) {
            return res.status(404).json({ error: '找不到该用户' });
        }

        const balance = user.balance !== null ? Number(user.balance) : 10000;
        const trades = user.trades.map(t => t.data);
        const gachas = user.gachas.map(g => g.data);

        res.status(200).json({
            balance,
            trades,
            gachas
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '获取控制台数据失败' });
    }
}