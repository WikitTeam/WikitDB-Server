import prisma from '../../lib/prisma';
import { verifyToken } from '../../utils/auth';

const GRAPHQL_ENDPOINT = 'https://wikit.unitreaty.org/apiv1/graphql';

const VALID_DIRECTIONS = ['long', 'short'];
const VALID_LOCK_TYPES = ['none', 'T1 (24h)', 'T3 (72h)', 'T7 (168h)'];
const VALID_LEVERAGES = [1, 2, 5, 10];

async function fetchAuthorScore(authorName) {
    const query = {
        query: `query($author: String!) { articles(author: $author, page: 1, pageSize: 500) { nodes { rating } } }`,
        variables: { author: authorName }
    };
    const res = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query)
    });
    if (!res.ok) throw new Error('分数获取失败');
    const result = await res.json();
    if (result.errors) throw new Error('分数查询异常');
    const articles = result.data?.articles?.nodes || [];
    let totalRating = 0;
    articles.forEach(a => { totalRating += (a.rating || 0); });
    return totalRating;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) {
        return res.status(401).json({ error: '你还没有登录，无法开仓' });
    }
    const username = decoded.username;

    const { site, pageId, pageTitle, direction, lockType, margin, leverage } = req.body;

    // 方向校验
    if (!VALID_DIRECTIONS.includes(direction)) {
        return res.status(400).json({ error: '无效的交易方向' });
    }

    // 锁仓类型校验
    if (!VALID_LOCK_TYPES.includes(lockType)) {
        return res.status(400).json({ error: '无效的锁仓类型' });
    }

    // 杠杆校验：兼容前端传入 "2x" 或数字 2
    const parsedLeverage = parseInt(String(leverage).replace('x', ''), 10);
    if (isNaN(parsedLeverage) || !VALID_LEVERAGES.includes(parsedLeverage)) {
        return res.status(400).json({ error: '无效的杠杆倍数（可选: 1, 2, 5, 10）' });
    }

    // 保证金校验
    const marginNum = Number(margin);
    if (isNaN(marginNum) || marginNum <= 0 || marginNum > 100000) {
        return res.status(400).json({ error: '保证金金额无效（范围 1-100000）' });
    }

    if (!pageId) {
        return res.status(400).json({ error: '缺少交易目标' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(404).json({ error: '找不到该用户' });
        }

        // 服务端获取当前分数作为开仓价，防止客户端伪造
        const openScore = await fetchAuthorScore(pageId);

        const fee = marginNum * 0.01;
        const totalCost = marginNum + fee;

        const result = await prisma.$transaction(async (tx) => {
            const dbUser = await tx.user.findUnique({
                where: { id: user.id },
                select: { balance: true }
            });

            if (Number(dbUser.balance) < totalCost) {
                throw new Error(`余额不足！开仓需 ${totalCost.toFixed(2)} (含手续费)`);
            }

            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    balance: { decrement: totalCost }
                }
            });

            const trade = await tx.trade.create({
                data: {
                    userId: user.id,
                    type: direction === 'long' ? 'BUY' : 'SELL',
                    amount: marginNum,
                    target: pageId,
                    description: JSON.stringify({
                        site,
                        pageTitle,
                        direction,
                        lockType,
                        leverage: parsedLeverage,
                        openScore,
                        fee,
                        openTime: Date.now()
                    }),
                    status: 'OPEN'
                }
            });

            return { tradeId: trade.id, newBalance: updatedUser.balance };
        });

        res.status(200).json({
            message: '开仓成功',
            tradeId: result.tradeId,
            newBalance: result.newBalance
        });
    } catch (error) {
        console.error(error);
        res.status(error.message.includes('余额不足') ? 400 : 500).json({ error: error.message || '数据库写入失败' });
    }
}