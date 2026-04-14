import prisma from '../../../lib/prisma';
import { withAuth } from '../../../utils/withAuth';
import { validateNumberRange } from '../../../utils/security';

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const user = req.user;
    const { target, amount, type } = req.body;

    const safeAmount = validateNumberRange(amount, 1, 100000);
    if (safeAmount === null) return res.status(400).json({ error: '交易金额异常（范围 1-100000）' });

    try {
        const result = await prisma.$transaction(async (tx) => {
            const dbUser = await tx.user.findUnique({
                where: { id: user.id },
                select: { balance: true }
            });

            if (dbUser.balance.lt(safeAmount)) {
                throw new Error('余额不足');
            }

            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    balance: {
                        decrement: safeAmount
                    }
                }
            });

            const trade = await tx.trade.create({
                data: {
                    userId: user.id,
                    type: type || 'BUY',
                    amount: safeAmount,
                    target: target,
                    status: 'COMPLETED',
                    description: `交易目标: ${target}`
                }
            });

            return { balance: updatedUser.balance, tradeId: trade.id };
        });

        return res.status(200).json({
            message: '交易成功',
            newBalance: result.balance,
            tradeId: result.tradeId
        });

    } catch (error) {
        console.error('Trade critical failure:', error.message);
        return res.status(400).json({ error: error.message || '交易处理失败' });
    }
}

export default withAuth(handler);
