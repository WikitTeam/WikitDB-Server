import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // 检索所有匿名回复类型的交易记录，并包含关联用户信息
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
                createdAt: 'desc'
            },
            take: 100
        });

        // 格式化输出数据，统一结构
        const formattedLogs = logs.map(log => ({
            id: log.id,
            username: log.user?.username || 'System',
            wiki: log.data?.wiki || 'N/A',
            threadId: log.data?.targetThread || 'N/A',
            content: log.data?.content || '（无历史内容记录）',
            cost: log.data?.cost || 0,
            time: log.data?.time ? new Date(log.data.time).toLocaleString() : log.createdAt.toLocaleString()
        }));

        return res.status(200).json({ logs: formattedLogs });

    } catch (error) {
        console.error('Fetch Anon Logs Failure:', error);
        return res.status(500).json({ error: '审计日志检索失败' });
    }
}

export default withAdmin(handler);