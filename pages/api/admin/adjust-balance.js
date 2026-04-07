import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();
const SUPER_ADMIN = 'Laimu_slime';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 核心安全修复：拦截未授权调用
    const decoded = verifyToken(req);
    if (!decoded || !decoded.username) {
        return res.status(401).json({ error: '未登录' });
    }
    const realOperator = decoded.username;

    // 鉴权
    let isAuthorized = realOperator === SUPER_ADMIN;
    if (!isAuthorized) {
        const caller = await prisma.user.findUnique({ where: { username: realOperator } });
        if (caller && caller.isAdmin) isAuthorized = true;
    }
    if (!isAuthorized) return res.status(403).json({ error: '越权拦截' });

    const { targetUser, amount, note } = req.body;

    if (!targetUser || amount === undefined) {
        return res.status(400).json({ error: '参数不完整' });
    }

    const adjustAmount = Number(amount);
    if (isNaN(adjustAmount) || adjustAmount === 0) {
        return res.status(400).json({ error: '调账金额必须是有效的非零数字' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username: targetUser }
        });
        
        if (!user) return res.status(404).json({ error: '目标用户不存在' });

        const oldBalance = user.balance !== null ? Number(user.balance) : 10000;
        const newBalance = oldBalance + adjustAmount;

        if (newBalance < 0) {
            return res.status(400).json({ error: `扣款失败。用户当前仅剩 ${oldBalance.toFixed(2)}` });
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { balance: newBalance }
            }),
            prisma.trade.create({
                data: {
                    userId: user.id,
                    data: {
                        time: Date.now(),
                        operator: realOperator, // 使用服务器提取的真实身份，而非前端伪造的
                        action: 'adjust_balance',
                        target: targetUser,
                        details: `强制调账: ${adjustAmount > 0 ? '+' : ''}${adjustAmount} (备注: ${note || '无'})`
                    }
                }
            })
        ]);

        return res.status(200).json({ success: true, newBalance });

    } catch (e) {
        console.error('Adjust Balance Error:', e);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}