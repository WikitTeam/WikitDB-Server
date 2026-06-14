import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
    if (req.method === 'POST') {
        const { message } = req.body;
        if (message) {
            await prisma.setting.upsert({
                where: { key: 'system_broadcast' },
                update: { value: message },
                create: { key: 'system_broadcast', value: message }
            });
        } else {
            await prisma.setting.deleteMany({
                where: { key: 'system_broadcast' }
            });
        }
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function getBroadcast(req, res) {
    const setting = await prisma.setting.findUnique({
        where: { key: 'system_broadcast' }
    });
    return res.status(200).json({ message: setting?.value || '' });
}

export default function route(req, res) {
    if (req.method === 'GET') return getBroadcast(req, res);
    return withAdmin(handler)(req, res);
}
