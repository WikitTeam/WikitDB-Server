import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const setting = await prisma.setting.findUnique({
                where: { key: 'system_broadcast' }
            });
            return res.status(200).json({ message: setting?.value || '' });
        } catch (error) {
            return res.status(500).json({ error: '读取失败' });
        }
    }

    if (req.method === 'POST') {
        try {
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
        } catch (error) {
            return res.status(500).json({ error: '写入失败' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
