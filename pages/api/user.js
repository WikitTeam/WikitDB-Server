import prisma from '../../lib/prisma';
import { verifyToken } from '../../utils/auth';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: '请求参数不完整：缺少用户名' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            return res.status(404).json({ error: '目标用户不存在' });
        }

        // 只有已登录且查询自己时才返回敏感信息
        const decoded = verifyToken(req);
        const isSelf = decoded && decoded.username === username;

        const response = { username: user.username, status: user.status || 'active' };

        if (isSelf) {
            response.balance = user.balance !== null ? Number(user.balance) : 10000;
            response.isAdmin = user.isAdmin;
        }

        res.status(200).json(response);
    } catch (error) {
        console.error('Fetch User Error:', error);
        res.status(500).json({ error: '获取用户信息失败，请稍后重试' });
    }
}