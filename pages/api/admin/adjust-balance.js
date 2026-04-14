import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { targetUser, amount, note } = req.body;
    const operator = req.admin.username;

    if (!targetUser || amount === undefined) {
        return res.status(400).json({ error: '请求参数不完整' });
    }

    const adjustAmount = Number(amount);
    if (isNaN(adjustAmount) || adjustAmount === 0) {
        return res.status(400).json({ error: '调整金额必须是非零有效数字' });
    }

    const user = await prisma.user.findUnique({
        where: { username: targetUser },
        select: { id: true, balance: true }
    });
    
    if (!user) return res.status(404).json({ error: '目标用户不存在' });

    try {
        const result = await prisma.$transaction(async (tx) => {
            const currentBalance = Number(user.balance);
            if (currentBalance + adjustAmount < 0) {
                throw new Error(`操作失败：用户账户可用余额不足（当前: ${currentBalance.toFixed(2)}）`);
            }

            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    balance: {
                        increment: adjustAmount
                    }
                }
            });

            const trade = await tx.trade.create({
                data: {
                    userId: user.id,
                    type: 'ADJUST',
                    amount: Math.abs(adjustAmount),
                    target: targetUser,
                    description: `系统调账: ${adjustAmount > 0 ? '+' : ''}${adjustAmount.toFixed(2)} (操作人: ${operator}, 备注: ${note || '无'})`,
                    status: 'COMPLETED'
                }
            });

            return { newBalance: updatedUser.balance };
        });

        return res.status(200).json({ success: true, newBalance: result.newBalance });
    } catch (error) {
        return res.status(400).json({ error: error.message || '调账处理失败' });
    }
}

export default withAdmin(handler);