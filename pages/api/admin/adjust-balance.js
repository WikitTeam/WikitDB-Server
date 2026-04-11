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
        where: { username: targetUser }
    });
    
    if (!user) return res.status(404).json({ error: '目标用户不存在' });

    const oldBalance = user.balance !== null ? Number(user.balance) : 10000;
    const newBalance = oldBalance + adjustAmount;

    if (newBalance < 0) {
        return res.status(400).json({ error: `操作失败：用户账户可用余额不足（当前: ${oldBalance.toFixed(2)}）` });
    }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: user.id },
            data: { balance: newBalance }
        }),
        prisma.trade.create({
            data: {
                userId: user.id,
                data: {
                    time: Date.now(),
                    operator: operator,
                    action: 'adjust_balance',
                    target: targetUser,
                    details: `系统调账: ${adjustAmount > 0 ? '+' : ''}${adjustAmount.toFixed(2)} (备注: ${note || '无'})`
                }
            }
        })
    ]);

    return res.status(200).json({ success: true, newBalance });
}

export default withAdmin(handler);