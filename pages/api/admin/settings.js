import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { module, data } = req.body;
    
    try {
        if (module === 'bingo' || module === 'bounty') {
            const keyName = `config:${module}`;
            await prisma.setting.upsert({
                where: { key: keyName },
                update: { value: JSON.stringify(data) },
                create: { key: keyName, value: JSON.stringify(data) }
            });
            return res.status(200).json({ success: true });
        }
        
        return res.status(400).json({ error: '未知的设置模块' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: '设置保存失败' });
    }
}