import prisma from '../../../lib/prisma';
import { verifyToken } from '../../../utils/auth';

const SUPER_ADMIN = process.env.SUPER_ADMIN || 'Laimu_slime';

export default async function handler(req, res) {
    const decoded = verifyToken(req);
    if (!decoded?.username) return res.status(401).json({ error: '未登录' });

    const user = await prisma.user.findUnique({ where: { username: decoded.username } });
    if (!user || (!user.isAdmin && user.username !== SUPER_ADMIN)) {
        return res.status(403).json({ error: '权限不足' });
    }

    if (req.method === 'GET') {
        const take = Math.min(parseInt(req.query.limit) || 100, 500);
        const logs = await prisma.accessLog.findMany({
            where: { type: 'honeypot' },
            orderBy: { id: 'desc' },
            take,
        });
        return res.status(200).json({ logs });
    }

    if (req.method === 'DELETE') {
        const allLogs = await prisma.accessLog.findMany({ where: { type: 'honeypot' } });
        for (const log of allLogs) {
            await prisma.accessLog.delete({ where: { id: log.id } });
        }
        return res.status(200).json({ cleared: allLogs.length });
    }

    return res.status(405).end();
}
