import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { targetUser, amount, note, operator } = req.body;

    if (!targetUser || amount === undefined || !operator) {
        return res.status(400).json({ error: '参数不完整' });
    }

    const adjustAmount = Number(amount);
    if (isNaN(adjustAmount) || adjustAmount === 0) {
        return res.status(400).json({ error: '调账金额必须是有效的非零数字' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username: targetUser }
        });
        
        if (!user) return res.status(404).json({ error: '目标用户不存在' });

        const oldBalance = user.balance !== null ? Number(user.balance) : 10000;
        const newBalance = oldBalance + adjustAmount;

        if (newBalance < 0) {
            return res.status(400).json({ error: `扣款失败。用户当前仅剩 ${oldBalance.toFixed(2)}，不足以扣除。` });
        }

        // 把余额更新和写入操作日志打包成一个事务，确保不会出现钱改了但日志没记上的情况
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
                        operator,
                        action: 'adjust_balance',
                        target: targetUser,
                        details: `强制调账: ${adjustAmount > 0 ? '+' : ''}${adjustAmount} (备注: ${note || '无'})`
                    }
                }
            })
        ]);

        return res.status(200).json({ success: true, newBalance });

    } catch (e) {
        console.error('Adjust Balance Error:', e);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}