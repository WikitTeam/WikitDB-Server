import prisma from '../../lib/prisma';
import { withAuth } from '../../utils/withAuth';

async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '仅支持 GET 请求' });
    }

    const username = req.user.username;

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
        const trades = user.trades || [];
        const gachas = user.gachas || [];

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

export default withAuth(handler);
