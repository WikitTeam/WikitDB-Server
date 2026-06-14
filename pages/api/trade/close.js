import prisma from '../../../lib/prisma';
import { withAuth } from '../../../utils/withAuth';
const { DEFAULT_GQL_ENDPOINT } = require('../../../utils/graphql');

const GRAPHQL_ENDPOINT = DEFAULT_GQL_ENDPOINT;

// 服务端获取作者当前分数，防止客户端伪造
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

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = req.user;
    const { tradeId } = req.body;

    if (!tradeId) {
        return res.status(400).json({ error: '参数不完整' });
    }

    try {
        // 在数据库里找到这笔状态为 OPEN 的订单
        const tradeRecord = await prisma.trade.findFirst({
            where: {
                id: Number(tradeId),
                userId: user.id,
                status: 'OPEN'
            }
        });

        if (!tradeRecord) return res.status(404).json({ error: '找不到该开仓记录或已被平仓' });

        const tradeData = JSON.parse(tradeRecord.description || '{}');
        const lockDurations = {
            'none': 0,
            'T1 (24h)': 24 * 60 * 60 * 1000,
            'T3 (72h)': 72 * 60 * 60 * 1000,
            'T7 (168h)': 168 * 60 * 60 * 1000
        };
        const lockDuration = lockDurations[tradeData.lockType] || 0;
        const openTime = Number(tradeData.openTime) || 0;
        if (lockDuration > 0 && Date.now() < openTime + lockDuration) {
            return res.status(409).json({
                error: '仓位仍在锁定期内',
                unlockAt: new Date(openTime + lockDuration).toISOString()
            });
        }

        // 优先使用 openScore（新数据），兼容旧数据的 lockType 字段
        const openScore = Number(tradeData.openScore) || 0;
        const margin = Number(tradeRecord.amount);

        // leverage 兼容处理：新数据存数字，旧数据可能是 "2x" 等字符串
        let leverage = Number(tradeData.leverage);
        if (isNaN(leverage)) {
            leverage = parseInt(String(tradeData.leverage).replace('x', ''), 10) || 1;
        }
        if (leverage < 1 || leverage > 10) leverage = 1;

        // 服务端获取当前分数，不再信任客户端传入
        const currentScore = await fetchAuthorScore(tradeRecord.target);
        const scoreDiff = currentScore - openScore;

        // 盈亏计算 — 兼容 long/short（新）和 up/down（旧）
        let pnl = 0;
        const direction = tradeData.direction;
        if (direction === 'up' || direction === 'long') {
            pnl = scoreDiff * (margin * 0.1) * leverage;
        } else if (direction === 'down' || direction === 'short') {
            pnl = -scoreDiff * (margin * 0.1) * leverage;
        }

        // 计算最终返还金额（如果亏损超过本金则爆仓归零）
        let finalReturn = margin + pnl;
        if (finalReturn < 0) finalReturn = 0;
        // 防止极端收益：上限为保证金的 20 倍
        const maxReturn = margin * 20;
        if (finalReturn > maxReturn) finalReturn = maxReturn;

        // 执行结算事务
        const result = await prisma.$transaction(async (tx) => {
            const closed = await tx.trade.updateMany({
                where: {
                    id: tradeRecord.id,
                    userId: user.id,
                    status: 'OPEN'
                },
                data: {
                    status: 'CLOSED',
                    description: JSON.stringify({
                        ...tradeData,
                        closeTime: Date.now(),
                        closeScore: currentScore,
                        pnl,
                        finalReturn
                    })
                }
            });

            if (closed.count !== 1) {
                throw new Error('交易已被其他请求平仓');
            }

            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: { balance: { increment: finalReturn } }
            });

            return { newBalance: updatedUser.balance };
        });

        return res.status(200).json({
            success: true,
            message: '平仓成功',
            newBalance: result.newBalance,
            pnl,
            finalReturn
        });

    } catch (error) {
        console.error(error);
        if (error.message === '交易已被其他请求平仓') {
            return res.status(409).json({ error: error.message });
        }
        return res.status(500).json({ error: '平仓结算失败' });
    }
}

export default withAuth(handler);
