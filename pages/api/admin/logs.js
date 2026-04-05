import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    try {
        // 直接从 Trade 表拉取最近的 200 条记录返回给前端
        const trades = await prisma.trade.findMany({
            orderBy: { id: 'desc' },
            take: 200
        });
        
        const logs = trades.map(t => t.data);
        return res.status(200).json({ logs });
    } catch (error) {
        return res.status(500).json({ error: '读取审计日志失败' });
    }
}