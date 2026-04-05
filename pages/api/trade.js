import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    const { username, site, pageId, pageTitle, direction, lockType, margin, leverage } = req.body;

    if (!username) {
        return res.status(401).json({ error: '你还没有登录，无法开仓' });
    }

    const marginNum = Number(margin);
    if (isNaN(marginNum) || marginNum <= 0) {
        return res.status(400).json({ error: '请输入有效的保证金金额' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(404).json({ error: '找不到该用户' });
        }

        const currentBalance = user.balance !== null ? Number(user.balance) : 10000;
        const fee = marginNum * 0.01;
        const totalCost = marginNum + fee;

        if (currentBalance < totalCost) {
            return res.status(400).json({ error: `余额不足！开仓需 ${totalCost.toFixed(2)} (含手续费)，当前可用 ${currentBalance.toFixed(2)}` });
        }

        const newBalance = currentBalance - totalCost;

        const tradeRecord = {
            id: Date.now().toString(),
            username,
            site,
            pageId,
            pageTitle,
            direction, 
            lockType,  
            margin: marginNum, 
            leverage,  
            fee,
            status: 'open',
            openTime: Date.now()
        };

        // 用事务保证扣钱和生成流水同时成功
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { balance: newBalance }
            }),
            prisma.trade.create({
                data: {
                    userId: user.id,
                    data: tradeRecord
                }
            })
        ]);

        res.status(200).json({ 
            message: '开仓成功', 
            tradeId: tradeRecord.id,
            newBalance 
        });
    } catch (error) {
        res.status(500).json({ error: '数据库写入失败' });
    }
}