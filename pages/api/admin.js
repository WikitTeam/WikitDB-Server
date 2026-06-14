import prisma from '../../lib/prisma';
import { withAdmin } from '../../utils/withAdmin';
import { validateNumberRange } from '../../utils/security';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    const { action, targetUser, amount } = req.body;

    try {
        if (action === 'check') {
            const adminUsers = await prisma.user.findMany({
                where: { isAdmin: true },
                select: { username: true }
            });
            const adminSet = adminUsers.map(u => u.username);
            return res.status(200).json({ isAdmin: true, admins: adminSet });
        }

        if (action === 'add_admin') {
            if (!targetUser) return res.status(400).json({ error: '缺少目标用户' });
            await prisma.user.update({
                where: { username: targetUser },
                data: { isAdmin: true }
            });
            return res.status(200).json({ message: '添加成功' });
        }

        if (action === 'remove_admin') {
            if (!targetUser) return res.status(400).json({ error: '缺少目标用户' });
            if (targetUser === req.admin.username) return res.status(400).json({ error: '不能移除自己的管理员权限' });
            await prisma.user.update({
                where: { username: targetUser },
                data: { isAdmin: false }
            });
            return res.status(200).json({ message: '移除成功' });
        }

        if (action === 'give_money') {
            if (!targetUser || !amount) return res.status(400).json({ error: '参数不完整' });
            const safeAmount = validateNumberRange(amount, -1000000, 1000000);
            if (safeAmount === null || safeAmount === 0) {
                return res.status(400).json({ error: '金额必须是 -1000000 到 1000000 之间的非零数字' });
            }
            
            const user = await prisma.user.findUnique({
                where: { username: targetUser }
            });
            
            if (!user) return res.status(404).json({ error: '找不到该用户' });

            let updated;
            if (safeAmount < 0) {
                const changed = await prisma.user.updateMany({
                    where: {
                        id: user.id,
                        balance: { gte: Math.abs(safeAmount) }
                    },
                    data: { balance: { increment: safeAmount } }
                });
                if (changed.count !== 1) {
                    return res.status(400).json({ error: '调整后余额不能为负数' });
                }
                updated = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { balance: true }
                });
            } else {
                updated = await prisma.user.update({
                    where: { id: user.id },
                    data: { balance: { increment: safeAmount } },
                    select: { balance: true }
                });
            }
            
            return res.status(200).json({ message: '资金变更成功', newBalance: updated.balance });
        }

        return res.status(400).json({ error: '未知操作' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}

export default withAdmin(handler);
