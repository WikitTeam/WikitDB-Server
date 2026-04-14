import prisma from '../../../lib/prisma';
import { withAuth } from '../../../utils/withAuth';

async function getHandler(req, res) {
    try {
        const configRecord = await prisma.setting.findUnique({ where: { key: 'config:bingo' } });
        let config = { tags: ['原创', '翻译', '搞笑', '微恐', '设定中心', '人事档案'], cost: 50 };

        if (configRecord && configRecord.value) {
            try { config = JSON.parse(configRecord.value); } catch(e) {}
        }
        return res.status(200).json(config);
    } catch (e) {
        return res.status(500).json({ error: '配置读取失败' });
    }
}

async function postHandler(req, res) {
    const user = req.user;
    const { selectedTags } = req.body;
    if (!selectedTags || selectedTags.length !== 3) return res.status(400).json({ error: '必须选择3个不同的标签' });

    try {
        const configRecord = await prisma.setting.findUnique({ where: { key: 'config:bingo' } });
        let config = null;
        if (configRecord && configRecord.value) {
            try { config = JSON.parse(configRecord.value); } catch(e) {}
        }

        const scanCost = config?.cost || 50;
        const allowedTags = config?.tags || ['原创', '翻译', '搞笑', '微恐', '设定中心', '人事档案'];

        // 校验标签必须在允许的标签池内
        const invalidTag = selectedTags.find(t => !allowedTags.includes(t));
        if (invalidTag) return res.status(400).json({ error: `无效的标签: ${invalidTag}` });

        if (Number(user.balance || 0) < scanCost) return res.status(400).json({ error: `余额不足，扫描需要 ¥${scanCost}` });

            const countRes = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `query { articles(page: 1, pageSize: 1) { pageInfo { total } } }` })
            });
            const countData = await countRes.json();
            if (!countData.data?.articles?.pageInfo?.total) return res.status(500).json({ error: '数据库通信失败' });
            
            const randomPage = Math.floor(Math.random() * countData.data.articles.pageInfo.total) + 1;

            const r = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `query { articles(page: ${randomPage}, pageSize: 1) { nodes { title rating tags } } }` })
            });
            const d = await r.json();
            const article = d.data?.articles?.nodes[0];
            if (!article) return res.status(500).json({ error: '数据节点抓取失败' });

            const articleTags = article.tags || [];
            let hitCount = 0;
            selectedTags.forEach(t => { if (articleTags.includes(t)) hitCount++; });

            let reward = 0;
            if (hitCount === 1) reward = scanCost;
            if (hitCount === 2) reward = scanCost * 10;
            if (hitCount === 3) reward = scanCost * 100;

            const netChange = reward - scanCost;

            const result = await prisma.$transaction(async (tx) => {
                const dbUser = await tx.user.findUnique({
                    where: { id: user.id },
                    select: { balance: true }
                });

                if (dbUser.balance.lt(scanCost)) {
                    throw new Error(`余额不足，扫描需要 ¥${scanCost}`);
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
                        amount: scanCost,
                        target: 'BINGO',
                        description: `Bingo扫描消耗: ${scanCost}, 命中数: ${hitCount}, 结果奖励: ${reward}`,
                        status: 'COMPLETED'
                    }
                });

                if (reward > 0) {
                    await tx.trade.create({
                        data: {
                            userId: user.id,
                            type: 'SELL',
                            amount: reward,
                            target: 'BINGO_REWARD',
                            description: `Bingo奖励: ${reward}`,
                            status: 'COMPLETED'
                        }
                    });
                }

                return updatedUser.balance;
            });

            return res.status(200).json({ success: true, article, hitCount, reward, newBalance: result });
        } catch (e) {
            console.error('Bingo error:', e);
            return res.status(500).json({ error: e.message || '服务器内部错误' });
        }
}

// GET 不需要鉴权，POST 需要
export default function handler(req, res) {
    if (req.method === 'GET') return getHandler(req, res);
    if (req.method === 'POST') return withAuth(postHandler)(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
}