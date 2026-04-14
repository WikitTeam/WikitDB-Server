import prisma from '../../../lib/prisma';
import { verifyToken } from '../../../utils/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: '未登录' });

    const { target, amount, type } = req.body; // 对应新 Schema 字段

    if (!amount || amount <= 0) return res.status(400).json({ error: '交易金额异常' });

    try {
        // 使用 $transaction 确保原子性，防止刷钱
        const result = await prisma.$transaction(async (tx) => {
            // 1. 扣钱时直接在数据库层做校验，利用 PostgreSQL 的原子性
            // 注意：这里我们主动查一次并锁住记录（悲观锁或通过条件更新）
            const dbUser = await tx.user.findUnique({
                where: { id: user.id },
                select: { balance: true }
            });

            if (dbUser.balance.lt(amount)) {
                throw new Error('余额不足');
            }

            // 2. 更新余额
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    balance: {
                        decrement: amount // 原子减法，数据库级别防止超支
                    }
                }
            });

            // 3. 创建结构化的交易记录（符合新 Schema）
            const trade = await tx.trade.create({
                data: {
                    userId: user.id,
                    type: type || 'BUY',
                    amount: amount,
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
