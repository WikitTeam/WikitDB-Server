import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const usersData = await prisma.user.findMany({
                orderBy: { balance: 'desc' }
            });

            const users = usersData.map(u => ({
                username: u.username,
                wikidotAccount: u.wikidotAccount || '',
                balance: u.balance || 0,
                role: u.isAdmin ? 'admin' : 'user',
                status: u.status || 'active',
                createdAt: u.createdAt
            }));

            return res.status(200).json({ users });
        } catch (error) {
            console.error("Admin Fetch Users Error:", error);
            return res.status(500).json({ error: '读取用户数据库失败' });
        }
    }

    if (req.method === 'POST') {
        const { targetUser, action, operator } = req.body;

        if (!targetUser || !action) {
            return res.status(400).json({ error: '参数不完整' });
        }

        if (targetUser === operator && (action === 'ban' || action === 'demote' || action === 'delete')) {
            return res.status(403).json({ error: `安全限制：你不能对自己的账号(${targetUser})执行该操作` });
        }

        try {
            const user = await prisma.user.findUnique({
                where: { username: targetUser }
            });

            if (!user) {
                return res.status(404).json({ error: '找不到目标用户' });
            }

            switch (action) {
                case 'ban':
                    await prisma.user.update({ where: { id: user.id }, data: { status: 'banned' } });
                    break;
                case 'unban':
                    await prisma.user.update({ where: { id: user.id }, data: { status: 'active' } });
                    break;
                case 'promote':
                    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
                    break;
                case 'demote':
                    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: false } });
                    break;
                case 'delete':
                    await prisma.$transaction([
                        prisma.trade.deleteMany({ where: { userId: user.id } }),
                        prisma.gacha.deleteMany({ where: { userId: user.id } }),
                        prisma.image.deleteMany({ where: { uploaderId: user.id } }),
                        prisma.user.delete({ where: { id: user.id } })
                    ]);
                    return res.status(200).json({ success: true, message: `用户 ${targetUser} 的所有档案已彻底抹除` });
                
                default:
                    return res.status(400).json({ error: '未知的操作类型' });
            }

            return res.status(200).json({ success: true, message: `已成功更新 ${targetUser} 的状态` });

        } catch (error) {
            console.error("Admin User Action Error:", error);
            return res.status(500).json({ error: '数据库操作失败' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
