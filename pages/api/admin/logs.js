import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();
const SUPER_ADMIN = 'Laimu_slime';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) {
        return res.status(401).json({ error: '未登录' });
    }

    const user = await prisma.user.findUnique({ where: { username: decoded.username } });
    if (!user || (!user.isAdmin && user.username !== SUPER_ADMIN)) {
        return res.status(403).json({ error: '权限不足' });
    }

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