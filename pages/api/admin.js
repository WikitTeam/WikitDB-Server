import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUPER_ADMIN = 'Laimu_slime';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    const { action, username, targetUser, amount } = req.body;

    if (!username) {
        return res.status(401).json({ error: '未登录' });
    }

    // 验证操作者权限
    let isAuthorized = username === SUPER_ADMIN;
    if (!isAuthorized) {
        const caller = await prisma.user.findUnique({
            where: { username: username }
        });
        if (caller && caller.isAdmin) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        return res.status(403).json({ error: '权限不足，仅限管理员访问' });
    }

    try {
        if (action === 'check') {
            // 从数据库里查出所有被标记为管理员的用户
            const adminUsers = await prisma.user.findMany({
                where: { isAdmin: true },
                select: { username: true }
            });
            const adminSet = adminUsers.map(u => u.username);
            
            // 过滤掉可能重复的创始人账号，合并返回给前端
            const admins = [SUPER_ADMIN, ...adminSet.filter(a => a !== SUPER_ADMIN)];
            return res.status(200).json({ isAdmin: true, admins });
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
            if (targetUser === SUPER_ADMIN) return res.status(400).json({ error: '不能移除创始人' });
            await prisma.user.update({
                where: { username: targetUser },
                data: { isAdmin: false }
            });
            return res.status(200).json({ message: '移除成功' });
        }

        if (action === 'give_money') {
            if (!targetUser || !amount) return res.status(400).json({ error: '参数不完整' });
            
            const user = await prisma.user.findUnique({
                where: { username: targetUser }
            });
            
            if (!user) return res.status(404).json({ error: '找不到该用户，请确认用户名是否正确' });

            const currentBalance = user.balance !== null ? Number(user.balance) : 10000;
            const newBalance = currentBalance + Number(amount);
            
            await prisma.user.update({
                where: { username: targetUser },
                data: { balance: newBalance }
            });
            
            return res.status(200).json({ message: '资金变更成功', newBalance });
        }

        return res.status(400).json({ error: '未知操作' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}