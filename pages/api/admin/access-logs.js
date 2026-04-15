import prisma from '../../../lib/prisma';
import { verifyToken } from '../../../utils/auth';

const SUPER_ADMIN = 'Laimu_slime';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    const decoded = verifyToken(req);
    if (!decoded?.username) return res.status(401).json({ error: '未登录' });

    const user = await prisma.user.findUnique({ where: { username: decoded.username } });
    if (!user || (!user.isAdmin && user.username !== SUPER_ADMIN)) {
        return res.status(403).json({ error: '权限不足' });
    }

    try {
        const { path, limit } = req.query;
        const where = path ? { path: { contains: path } } : {};
        const take = Math.min(parseInt(limit) || 200, 500);

        const logs = await prisma.accessLog.findMany({
            where,
            orderBy: { id: 'desc' },
            take,
        });

        return res.status(200).json({ logs });
    } catch (error) {
        return res.status(500).json({ error: '读取访问日志失败' });
    }
}
