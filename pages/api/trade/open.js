import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 校验登录状态
    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) return res.status(401).json({ error: '未授权的访问' });
    const username = decoded.username;

    const { site, pageId, pageTitle, direction, lockType, margin, leverage } = req.body;
    const marginNum = Number(margin);

    if (isNaN(marginNum) || marginNum <= 0) {
        return res.status(400).json({ error: '请输入有效的保证金金额' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ error: '用户不存在' });

        const currentBalance = user.balance !== null ? Number(user.balance) : 10000;
        const fee = marginNum * 0.01; // 1% 手续费
        const totalCost = marginNum + fee;

        if (currentBalance < totalCost) {
            return res.status(400).json({ error: `余额不足！开仓需 ¥${totalCost.toFixed(2)} (含手续费)，当前可用 ¥${currentBalance.toFixed(2)}` });
        }

        const newBalance = currentBalance - totalCost;

        const tradeData = {
            id: Date.now().toString(),
            username,
            site,
            pageId,
            pageTitle,
            direction, 
            lockType,  
            margin: marginNum, 
            leverage: Number(leverage) || 1,  
            fee,
            status: 'open',
            openTime: Date.now()
        };

        // 使用事务确保扣款和记录同时成功
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { balance: newBalance }
            }),
            prisma.trade.create({
                data: {
                    userId: user.id,
                    data: tradeData
                }
            })
        ]);

        return res.status(200).json({ success: true, message: '开仓成功', newBalance, tradeId: tradeData.id });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: '数据库写入失败' });
    }
}