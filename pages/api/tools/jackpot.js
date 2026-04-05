import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    const { action, number } = req.body;

    if (req.method === 'GET') {
        const poolRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_pool' } });
        const ticketsRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_tickets' } });
        
        const pool = poolRecord ? Number(poolRecord.value) : 0;
        const tickets = ticketsRecord ? JSON.parse(ticketsRecord.value) : {};
        
        return res.status(200).json({ pool, tickets });
    }

    if (req.method === 'POST') {
        if (action === 'buy') {
            const decoded = verifyToken(req);
            if (!decoded || !decoded.username) return res.status(401).json({ error: '未授权的访问' });
            const username = decoded.username; 

            if (!number) return res.status(400).json({ error: '参数不完整' });
            
            const user = await prisma.user.findUnique({ where: { username } });
            if (!user) return res.status(404).json({ error: '用户不存在' });

            if (user.balance < 50) return res.status(400).json({ error: '余额不足 (需要 ¥50)' });

            const newBalance = user.balance - 50;
            await prisma.user.update({ where: { username }, data: { balance: newBalance } });
            
            // 处理奖池累加
            const poolRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_pool' } });
            const currentPool = poolRecord ? Number(poolRecord.value) : 0;
            await prisma.setting.upsert({
                where: { key: 'jackpot_pool' },
                update: { value: String(currentPool + 50) },
                create: { key: 'jackpot_pool', value: String(currentPool + 50) }
            });

            // 处理彩票记录
            const ticketsRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_tickets' } });
            const tickets = ticketsRecord ? JSON.parse(ticketsRecord.value) : {};
            tickets[username] = number;
            
            await prisma.setting.upsert({
                where: { key: 'jackpot_tickets' },
                update: { value: JSON.stringify(tickets) },
                create: { key: 'jackpot_tickets', value: JSON.stringify(tickets) }
            });

            return res.status(200).json({ success: true, newBalance });
        }

        if (action === 'draw') {
            const poolRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_pool' } });
            const ticketsRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_tickets' } });
            
            const pool = poolRecord ? Number(poolRecord.value) : 0;
            const tickets = ticketsRecord ? JSON.parse(ticketsRecord.value) : {};
            
            const winningNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            const winners = [];

            for (const [uname, num] of Object.entries(tickets)) {
                if (num === winningNumber) winners.push(uname);
            }

            // 发放奖金
            if (winners.length > 0) {
                const prize = Math.floor(pool / winners.length);
                for (const winner of winners) {
                    const wUser = await prisma.user.findUnique({ where: { username: winner } });
                    if (wUser) {
                        await prisma.user.update({
                            where: { username: winner },
                            data: { balance: wUser.balance + prize }
                        });
                    }
                }
            }

            // 清空当期奖池
            await prisma.setting.deleteMany({
                where: { key: { in: ['jackpot_pool', 'jackpot_tickets'] } }
            });

            return res.status(200).json({ winningNumber, winners, totalPrize: pool });
        }
    }
}