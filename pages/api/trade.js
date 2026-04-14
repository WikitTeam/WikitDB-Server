import prisma from '../../lib/prisma';
import { verifyToken } from '../../utils/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) {
        return res.status(401).json({ error: '你还没有登录，无法开仓' });
    }
    const username = decoded.username;

    const { site, pageId, pageTitle, direction, lockType, margin, leverage } = req.body;

    const marginNum = Number(margin);
    if (isNaN(marginNum) || marginNum <= 0) {
        return res.status(400).json({ error: '请输入有效的保证金金额' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(404).json({ error: '找不到该用户' });
        }

        const fee = marginNum * 0.01;
        const totalCost = marginNum + fee;

        const result = await prisma.$transaction(async (tx) => {
            const dbUser = await tx.user.findUnique({
                where: { id: user.id },
                select: { balance: true }
            });

            if (Number(dbUser.balance) < totalCost) {
                throw new Error(`余额不足！开仓需 ${totalCost.toFixed(2)} (含手续费)`);
            }

            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    balance: { decrement: totalCost }
                }
            });

            const trade = await tx.trade.create({
                data: {
                    userId: user.id,
                    type: direction === 'up' ? 'BUY' : 'SELL', // Using BUY for long, SELL for short
                    amount: marginNum,
                    target: pageId,
                    description: JSON.stringify({
                        site,
                        pageTitle,
                        direction,
                        lockType,
                        leverage,
                        fee,
                        openTime: Date.now()
                    }),
                    status: 'OPEN' // Custom status for futures
                }
            });

            return { tradeId: trade.id, newBalance: updatedUser.balance };
        });

        res.status(200).json({ 
            message: '开仓成功', 
            tradeId: result.tradeId,
            newBalance: result.newBalance 
        });
    } catch (error) {
        console.error(error);
        res.status(error.message.includes('余额不足') ? 400 : 500).json({ error: error.message || '数据库写入失败' });
    }
}