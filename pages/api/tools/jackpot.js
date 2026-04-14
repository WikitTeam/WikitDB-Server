import prisma from '../../../lib/prisma';
import { verifyToken } from '../../../utils/auth';
import crypto from 'crypto';

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

            // 校验号码格式：必须是 00-99 的两位数字符串
            if (!number || !/^\d{2}$/.test(number)) {
                return res.status(400).json({ error: '号码格式无效，请输入 00-99 的两位数字' });
            }
            
            const user = await prisma.user.findUnique({ where: { username } });
            if (!user) return res.status(404).json({ error: '用户不存在' });

            const result = await prisma.$transaction(async (tx) => {
                const dbUser = await tx.user.findUnique({
                    where: { id: user.id },
                    select: { balance: true }
                });

                if (dbUser.balance.lt(50)) {
                    throw new Error('余额不足 (需要 ¥50)');
                }

                const updatedUser = await tx.user.update({
                    where: { id: user.id },
                    data: {
                        balance: {
                            decrement: 50
                        }
                    }
                });

                await tx.trade.create({
                    data: {
                        userId: user.id,
                        type: 'BUY',
                        amount: 50,
                        target: 'JACKPOT_TICKET',
                        description: `购买彩票: ${number}`,
                        status: 'COMPLETED'
                    }
                });

                // 处理奖池累加
                const poolRecord = await tx.setting.findUnique({ where: { key: 'jackpot_pool' } });
                const currentPool = poolRecord ? Number(poolRecord.value) : 0;
                await tx.setting.upsert({
                    where: { key: 'jackpot_pool' },
                    update: { value: String(currentPool + 50) },
                    create: { key: 'jackpot_pool', value: String(currentPool + 50) }
                });

                // 处理彩票记录
                const ticketsRecord = await tx.setting.findUnique({ where: { key: 'jackpot_tickets' } });
                const tickets = ticketsRecord ? JSON.parse(ticketsRecord.value) : {};
                tickets[username] = number;
                
                await tx.setting.upsert({
                    where: { key: 'jackpot_tickets' },
                    update: { value: JSON.stringify(tickets) },
                    create: { key: 'jackpot_tickets', value: JSON.stringify(tickets) }
                });

                return updatedUser.balance;
            });

            return res.status(200).json({ success: true, newBalance: result });
        }

        if (action === 'draw') {
            // 开奖需要管理员权限
            const drawDecoded = verifyToken(req);
            if (!drawDecoded || !drawDecoded.username) return res.status(401).json({ error: '未授权的访问' });
            const drawUser = await prisma.user.findUnique({ where: { username: drawDecoded.username } });
            if (!drawUser || !drawUser.isAdmin) return res.status(403).json({ error: '仅管理员可执行开奖' });

            const poolRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_pool' } });
            const ticketsRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_tickets' } });

            const pool = poolRecord ? Number(poolRecord.value) : 0;
            const tickets = ticketsRecord ? JSON.parse(ticketsRecord.value) : {};

            // 使用密码学安全的随机数
            const winningNumber = crypto.randomInt(100).toString().padStart(2, '0');
            const winners = [];

            for (const [uname, num] of Object.entries(tickets)) {
                if (num === winningNumber) winners.push(uname);
            }

            // 发放奖金
            if (winners.length > 0) {
                const prize = Math.floor(pool / winners.length);
                await prisma.$transaction(async (tx) => {
                    for (const winnerName of winners) {
                        const wUser = await tx.user.findUnique({ where: { username: winnerName } });
                        if (wUser) {
                            await tx.user.update({
                                where: { id: wUser.id },
                                data: {
                                    balance: {
                                        increment: prize
                                    }
                                }
                            });

                            await tx.trade.create({
                                data: {
                                    userId: wUser.id,
                                    type: 'SELL',
                                    amount: prize,
                                    target: 'JACKPOT_WIN',
                                    description: `中奖奖金: ${prize}, 中奖号码: ${winningNumber}`,
                                    status: 'COMPLETED'
                                }
                            });
                        }
                    }

                    // 清空当期奖池
                    await tx.setting.deleteMany({
                        where: { key: { in: ['jackpot_pool', 'jackpot_tickets'] } }
                    });
                });
            } else {
                // 如果无人中奖，也可以选择清空或保留，这里按原逻辑清空
                await prisma.setting.deleteMany({
                    where: { key: { in: ['jackpot_pool', 'jackpot_tickets'] } }
                });
            }

            return res.status(200).json({ winningNumber, winners, totalPrize: pool });
        }
    }
}