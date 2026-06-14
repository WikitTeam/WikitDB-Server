import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    try {
        // 直接从 Trade 表拉取最近的 200 条记录返回给前端
        const trades = await prisma.trade.findMany({
            orderBy: { id: 'desc' },
            take: 200
        });
        
        const logs = trades.map((trade) => ({
            id: trade.id,
            userId: trade.userId,
            type: trade.type,
            amount: trade.amount,
            target: trade.target,
            status: trade.status,
            details: trade.description,
            createdAt: trade.createdAt
        }));
        return res.status(200).json({ logs });
    } catch (error) {
        return res.status(500).json({ error: '读取审计日志失败' });
    }
}

export default withAdmin(handler);
