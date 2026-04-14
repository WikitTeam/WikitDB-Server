import prisma from '../../../lib/prisma';
import { withAuth } from '../../../utils/withAuth';
import { validateNumberRange } from '../../../utils/security';

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = req.user;
    const { betAmount, betSide } = req.body;

    try {
        const amount = validateNumberRange(betAmount, 1, 10000);
        if (amount === null) return res.status(400).json({ error: '下注金额无效（范围 1-10000）' });
        if (Number(user.balance || 0) < amount) return res.status(400).json({ error: '账户余额不足' });

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

        let winner = 'draw';
        const leftRating = leftPage.rating || 0;
        const rightRating = rightPage.rating || 0;
        
        if (leftRating > rightRating) winner = 'left';
        if (rightRating > leftRating) winner = 'right';

        let reward = 0;
        if (winner === betSide) {
            reward = amount * 2;
        } else if (winner === 'draw') {
            reward = amount;
        }

        const netChange = reward - amount;

        const result = await prisma.$transaction(async (tx) => {
            const dbUser = await tx.user.findUnique({
                where: { id: user.id },
                select: { balance: true }
            });

            if (dbUser.balance.lt(amount)) {
                throw new Error('账户余额不足');
            }

            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    balance: {
                        increment: netChange
                    }
                }
            });

            await tx.trade.create({
                data: {
                    userId: user.id,
                    type: 'BUY',
                    amount: amount,
                    target: 'DEATHMATCH',
                    description: `生死斗下注: ${amount}, 选择: ${betSide}, 结果: ${winner}, 奖励: ${reward}`,
                    status: 'COMPLETED'
                }
            });

            if (reward > 0) {
                await tx.trade.create({
                    data: {
                        userId: user.id,
                        type: 'SELL',
                        amount: reward,
                        target: 'DEATHMATCH_REWARD',
                        description: `生死斗奖励: ${reward}`,
                        status: 'COMPLETED'
                    }
                });
            }

            return updatedUser.balance;
        });

        return res.status(200).json({ success: true, leftPage, rightPage, winner, reward, newBalance: result });

    } catch (e) {
        console.error('Deathmatch error:', e);
        return res.status(500).json({ error: e.message || '服务器内部错误' });
    }
}

export default withAuth(handler);