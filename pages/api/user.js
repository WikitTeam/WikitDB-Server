import prisma from '../../lib/prisma';

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

        const balance = user.balance !== null ? Number(user.balance) : 10000;
        
        res.status(200).json({ 
            username: user.username,
            balance,
            isAdmin: user.isAdmin,
            status: user.status || 'active'
        });
    } catch (error) {
        console.error('Fetch User Error:', error);
        res.status(500).json({ error: '获取用户信息失败，请稍后重试' });
    }
}