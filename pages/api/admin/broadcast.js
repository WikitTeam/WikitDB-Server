import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
    if (req.method === 'GET') {
        const setting = await prisma.setting.findUnique({
            where: { key: 'system_broadcast' }
        });
        return res.status(200).json({ message: setting?.value || '' });
    }

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

export default withAdmin(handler);
