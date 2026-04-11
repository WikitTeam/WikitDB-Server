import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
    if (req.method === 'GET') {
        // 增加分页支持，防止大批量读取造成性能瓶颈
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;

        const [usersData, total] = await Promise.all([
            prisma.user.findMany({
                orderBy: { balance: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            }),
            prisma.user.count()
        ]);

        const users = usersData.map(u => ({
            username: u.username,
            wikidotAccount: u.wikidotAccount || '',
            balance: u.balance || 0,
            role: u.isAdmin ? 'admin' : 'user',
            status: u.status || 'active',
            createdAt: u.createdAt
        }));

        return res.status(200).json({ 
            users, 
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    }

    if (req.method === 'POST') {
        const { targetUser, action } = req.body;
        const operator = req.admin.username; // 从 withAdmin 挂载的数据中获取

        if (!targetUser || !action) {
            return res.status(400).json({ error: '参数不完整' });
        }

        if (targetUser === operator && (action === 'ban' || action === 'demote' || action === 'delete')) {
            return res.status(403).json({ error: `安全限制：你不能对自己的账号(${targetUser})执行该操作` });
        }

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
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdmin(handler);
