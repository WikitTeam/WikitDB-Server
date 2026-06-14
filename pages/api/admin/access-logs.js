import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

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

export default withAdmin(handler);
