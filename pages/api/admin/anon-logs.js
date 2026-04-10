import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // 严苛的安全校验，防止普通用户越权偷窥
    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) {
        return res.status(401).json({ error: '未授权访问' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { username: decoded.username } });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足：仅限管理员访问' });
        }

        // 去交易记录表里，把所有 action 为 'anon_reply' 的记录全部捞出来，并连带查出发送者的名字
        const logs = await prisma.trade.findMany({
            where: {
                data: {
                    path: ['action'],
                    equals: 'anon_reply'
                }
            },
            include: {
                user: {
                    select: {
                        username: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc' // 最新的排在最前面
            },
            take: 100 // 默认拉取最近的 100 条防止卡顿
        });

        // 格式化数据，方便前端表格直接渲染
        const formattedLogs = logs.map(log => ({
            id: log.id,
            username: log.user?.username || '未知用户',
            wiki: log.data?.wiki || '未知站点',
            threadId: log.data?.targetThread || '未知帖子',
            content: log.data?.content || '（旧数据无内容记录）',
            cost: log.data?.cost || 100,
            time: log.data?.time ? new Date(log.data.time).toLocaleString() : log.createdAt.toLocaleString()
        }));

        return res.status(200).json({ logs: formattedLogs });

    } catch (error) {
        console.error('获取匿名日志失败:', error);
        return res.status(500).json({ error: '内部服务器错误' });
    }
}