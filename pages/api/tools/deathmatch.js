import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 验证身份
    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) return res.status(401).json({ error: '未授权的访问' });
    const username = decoded.username; 

    const { betAmount, betSide } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ error: '用户不存在' });

        const amount = Number(betAmount);
        if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: '下注金额无效' });
        if ((user.balance || 0) < amount) return res.status(400).json({ error: '账户余额不足' });

        const countRes = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `query { articles(page: 1, pageSize: 1) { pageInfo { total } } }` })
        });
        const countData = await countRes.json();
        if (countData.errors || !countData.data?.articles?.pageInfo?.total) {
            return res.status(500).json({ error: '无法获取数据库页面总数' });
        }
        
        const total = countData.data.articles.pageInfo.total;

        const fetchPage = async () => {
            const randomPage = Math.floor(Math.random() * total) + 1;
            const r = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `query { articles(page: ${randomPage}, pageSize: 1) { nodes { wiki title rating author } } }` })
            });
            const d = await r.json();
            return d.data?.articles?.nodes[0];
        };

        const [leftPage, rightPage] = await Promise.all([fetchPage(), fetchPage()]);
        if (!leftPage || !rightPage) return res.status(500).json({ error: '数据节点抓取失败' });

        let newBalance = user.balance - amount;
        let winner = 'draw';
        const leftRating = leftPage.rating || 0;
        const rightRating = rightPage.rating || 0;
        
        if (leftRating > rightRating) winner = 'left';
        if (rightRating > leftRating) winner = 'right';

        let reward = 0;
        if (winner === betSide) {
            reward = amount * 2;
            newBalance += reward;
        } else if (winner === 'draw') {
            reward = amount;
            newBalance += reward;
        }

        // 更新余额
        await prisma.user.update({
            where: { username },
            data: { balance: newBalance }
        });

        return res.status(200).json({ success: true, leftPage, rightPage, winner, reward, newBalance });

    } catch (e) {
        return res.status(500).json({ error: '服务器内部错误' });
    }
}