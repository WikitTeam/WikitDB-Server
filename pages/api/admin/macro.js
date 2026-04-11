import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();
const SUPER_ADMIN = 'Laimu_slime';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) {
        return res.status(401).json({ error: '未登录' });
    }

    const user = await prisma.user.findUnique({ where: { username: decoded.username } });
    if (!user || (!user.isAdmin && user.username !== SUPER_ADMIN)) {
        return res.status(403).json({ error: '权限不足' });
    }

    const { action, amount, rate } = req.body;

    try {
        if (action === 'airdrop') {
            // 用数据库底层的批量更新指令，把所有人的余额直接加上空投的钱
            const result = await prisma.user.updateMany({
                data: {
                    balance: {
                        increment: Number(amount)
                    }
                }
            });
            return res.status(200).json({ success: true, affected: result.count });
        } 
        
        if (action === 'tax') {
            // Prisma 的 updateMany 默认不支持乘法操作，所以用原生 SQL 跑一遍扣税计算
            const safeRate = Number(rate);
            if (isNaN(safeRate)) throw new Error('无效的税率');
            
            const affected = await prisma.$executeRaw`UPDATE "User" SET balance = balance - (balance * ${safeRate} / 100)`;
            return res.status(200).json({ success: true, affected });
        }

        return res.status(400).json({ error: '未知的宏观调控指令' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: '宏观调控执行失败' });
    }
}