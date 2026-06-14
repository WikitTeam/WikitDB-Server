import prisma from '../../../lib/prisma';
import { withAuth } from '../../../utils/withAuth';
import crypto from 'crypto';
import { debitBalance } from '../../../utils/balance';
import { runSerializable } from '../../../utils/transaction';

function parseTickets(record) {
    if (!record?.value) return {};
    return typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
}

async function handler(req, res) {
    const { action, number } = req.body || {};

    if (req.method === 'GET') {
        const poolRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_pool' } });
        const ticketsRecord = await prisma.setting.findUnique({ where: { key: 'jackpot_tickets' } });

        const pool = poolRecord ? Number(poolRecord.value) : 0;
        const tickets = parseTickets(ticketsRecord);

        return res.status(200).json({ pool, ticketCount: Object.keys(tickets).length });
    }

    if (req.method === 'POST') {
        if (action === 'buy') {
            const user = req.user;
            const username = user.username;

            // 校验号码格式：必须是 00-99 的两位数字符串
            if (!number || !/^\d{2}$/.test(number)) {
                return res.status(400).json({ error: '号码格式无效，请输入 00-99 的两位数字' });
            }
            
            const result = await runSerializable(prisma, async (tx) => {
                const ticketsRecord = await tx.setting.findUnique({ where: { key: 'jackpot_tickets' } });
                const tickets = parseTickets(ticketsRecord);
                if (tickets[username]) {
                    throw new Error('每期只能购买一张彩票');
                }

                const updatedUser = await debitBalance(tx, user.id, 50);

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
            if (!req.user.isAdmin) return res.status(403).json({ error: '仅管理员可执行开奖' });

            const drawResult = await runSerializable(prisma, async (tx) => {
                const poolRecord = await tx.setting.findUnique({ where: { key: 'jackpot_pool' } });
                const ticketsRecord = await tx.setting.findUnique({ where: { key: 'jackpot_tickets' } });
                const pool = poolRecord ? Number(poolRecord.value) : 0;
                const tickets = parseTickets(ticketsRecord);
                const winningNumber = crypto.randomInt(100).toString().padStart(2, '0');
                const winners = Object.entries(tickets)
                    .filter(([, num]) => num === winningNumber)
                    .map(([uname]) => uname);

                if (winners.length > 0) {
                    const prize = Math.floor(pool / winners.length);
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
                }

                await tx.setting.deleteMany({
                    where: { key: { in: ['jackpot_pool', 'jackpot_tickets'] } }
                });

                return { winningNumber, winners, totalPrize: pool };
            });

            return res.status(200).json(drawResult);
        }

        return res.status(400).json({ error: '未知操作' });
    }
}

export default function route(req, res) {
    if (req.method === 'GET') return handler(req, res);
    if (req.method === 'POST') return withAuth(handler)(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
}
