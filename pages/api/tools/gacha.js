import prisma from '../../../lib/prisma';
import { withAuth } from '../../../utils/withAuth';

const GRAPHQL_ENDPOINT = 'https://wikit.unitreaty.org/apiv1/graphql';

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = req.user;

    try {
        if (Number(user.balance || 0) < 200) {
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

        let reward = 0, rarity = 'N';
        const r = article.rating || 0;

        // 计算稀有度和奖励
        if (r >= 100) { rarity = 'SSR'; reward = 1000; } 
        else if (r >= 50) { rarity = 'SR'; reward = 500; } 
        else if (r >= 20) { rarity = 'R'; reward = 100; } 
        else if (r < 0) { rarity = 'CURSED'; reward = 0; }
        
        const result = await prisma.$transaction(async (tx) => {
            const dbUser = await tx.user.findUnique({
                where: { id: user.id },
                select: { balance: true }
            });

            if (dbUser.balance.lt(200)) {
                throw new Error('余额不足，每次抽取需要 ¥200');
            }

            const netChange = reward - 200;
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    balance: {
                        increment: netChange
                    }
                }
            });

            await tx.gacha.create({
                data: {
                    userId: user.id,
                    poolId: 'DEFAULT',
                    result: `${rarity}: ${article.title}`,
                    cost: 200
                }
            });

            await tx.trade.create({
                data: {
                    userId: user.id,
                    type: 'BUY',
                    amount: 200,
                    target: 'GACHA',
                    description: `抽卡消耗: 200, 结果: ${rarity}, 奖励: ${reward}`,
                    status: 'COMPLETED'
                }
            });

            if (reward > 0) {
                await tx.trade.create({
                    data: {
                        userId: user.id,
                        type: 'SELL',
                        amount: reward,
                        target: 'GACHA_REWARD',
                        description: `抽卡奖励: ${reward}`,
                        status: 'COMPLETED'
                    }
                });
            }

            return updatedUser.balance;
        });

        return res.status(200).json({ success: true, article, rarity, reward, newBalance: result });

    } catch (e) {
        console.error('Gacha error:', e);
        return res.status(500).json({ error: e.message || '服务器内部错误' });
    }
}

export default withAuth(handler);