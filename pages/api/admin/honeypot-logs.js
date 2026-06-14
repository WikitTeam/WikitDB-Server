import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
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

export default withAdmin(handler);
