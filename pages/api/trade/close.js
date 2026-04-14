import prisma from '../../../lib/prisma';
import { verifyToken } from '../../../utils/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) return res.status(401).json({ error: '未授权的访问' });
    const username = decoded.username;

    const { tradeId, currentScore } = req.body;

    if (!tradeId || currentScore === undefined) {
        return res.status(400).json({ error: '参数不完整' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: { trades: true }
        });
        if (!user) return res.status(404).json({ error: '用户不存在' });

        // 在数据库里找到这笔状态为 open 的订单
        const tradeRecord = user.trades.find(t => t.data && t.data.id === tradeId && t.data.status === 'open');
        if (!tradeRecord) return res.status(404).json({ error: '找不到该开仓记录或已被平仓' });

        const tradeData = tradeRecord.data;
        const openScore = Number(tradeData.lockType) || 0;
        const scoreDiff = Number(currentScore) - openScore;
        
        // 盈亏计算
        let pnl = 0;
        if (tradeData.direction === 'up') {
            pnl = scoreDiff * (tradeData.margin * 0.1) * tradeData.leverage;
        } else if (tradeData.direction === 'down') {
            pnl = -scoreDiff * (tradeData.margin * 0.1) * tradeData.leverage;
        }

        // 计算最终返还金额（如果亏损超过本金则爆仓归零）
        let finalReturn = tradeData.margin + pnl;
        if (finalReturn < 0) finalReturn = 0; 

        const newBalance = user.balance + finalReturn;

        // 更新订单状态
        tradeData.status = 'closed';
        tradeData.closeTime = Date.now();
        tradeData.closeScore = currentScore;
        tradeData.pnl = pnl;
        tradeData.finalReturn = finalReturn;

        // 执行结算事务
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { balance: newBalance }
            }),
            prisma.trade.update({
                where: { id: tradeRecord.id },
                data: { data: tradeData }
            })
        ]);

        return res.status(200).json({ 
            success: true, 
            message: '平仓成功',
            newBalance, 
            pnl,
            finalReturn
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: '平仓结算失败' });
    }
}