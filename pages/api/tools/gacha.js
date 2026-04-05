import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();
const GRAPHQL_ENDPOINT = 'https://wikit.unitreaty.org/apiv1/graphql';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 验证身份
    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) return res.status(401).json({ error: '未授权的访问' });
    const username = decoded.username; 

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ error: '用户不存在' });

        if ((user.balance || 0) < 200) {
            return res.status(400).json({ error: '余额不足，每次抽取需要 ¥200' });
        }

        const countRes = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `query { articles(page: 1, pageSize: 1) { pageInfo { total } } }` })
        });
        const countData = await countRes.json();
        
        if (countData.errors || !countData.data?.articles?.pageInfo?.total) {
            return res.status(500).json({ error: '数据库总容量读取失败' });
        }
        
        const total = countData.data.articles.pageInfo.total;
        const randomPage = Math.floor(Math.random() * total) + 1;

        const dataRes = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `query { articles(page: ${randomPage}, pageSize: 1) { nodes { wiki title rating author tags } } }` })
        });
        const dataJson = await dataRes.json();
        const article = dataJson.data?.articles?.nodes[0];

        if (!article) return res.status(500).json({ error: '节点数据抓取失败' });

        let newBalance = user.balance - 200;
        let reward = 0, rarity = 'N';
        const r = article.rating || 0;

        // 计算稀有度和奖励
        if (r >= 100) { rarity = 'SSR'; reward = 1000; } 
        else if (r >= 50) { rarity = 'SR'; reward = 500; } 
        else if (r >= 20) { rarity = 'R'; reward = 100; } 
        else if (r < 0) { rarity = 'CURSED'; reward = 0; }
        
        newBalance += reward;
        
        await prisma.user.update({
            where: { username },
            data: { balance: newBalance }
        });

        return res.status(200).json({ success: true, article, rarity, reward, newBalance });

    } catch (e) {
        return res.status(500).json({ error: '服务器内部错误' });
    }
}