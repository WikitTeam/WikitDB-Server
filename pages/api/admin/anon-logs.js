import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { username } = req.query;

        // 如果提供了用户名，则按用户名过滤
        const whereClause = {
            data: {
                path: ['action'],
                equals: 'anon_reply'
            }
        };

        if (username) {
            whereClause.user = {
                username: username
            };
        }

        const logs = await prisma.trade.findMany({
            where: whereClause,
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

        const formattedLogs = logs.map(log => ({
            id: log.id,
            username: log.user?.username || 'System',
            wiki: log.data?.wiki || 'N/A',
            threadId: log.data?.targetThread || 'N/A',
            content: log.data?.content || '（内容已加密或丢失）',
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