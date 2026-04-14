import prisma from '../../../lib/prisma';
import { withAdmin } from '../../../utils/withAdmin';
import { validateNumberRange } from '../../../utils/security';

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { action, amount, rate } = req.body;

    try {
        if (action === 'airdrop') {
            const safeAmount = validateNumberRange(amount, 1, 100000);
            if (safeAmount === null) return res.status(400).json({ error: '空投金额无效（范围 1-100000）' });

            const result = await prisma.user.updateMany({
                data: {
                    balance: {
                        increment: safeAmount
                    }
                }
            });
            return res.status(200).json({ success: true, affected: result.count });
        }

        if (action === 'tax') {
            const safeRate = validateNumberRange(rate, 0.01, 100);
            if (safeRate === null) return res.status(400).json({ error: '税率无效（范围 0.01-100）' });

            const affected = await prisma.$executeRaw`UPDATE "User" SET balance = balance - (balance * ${safeRate} / 100)`;
            return res.status(200).json({ success: true, affected });
        }

        return res.status(400).json({ error: '未知的宏观调控指令' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: '宏观调控执行失败' });
    }
}

export default withAdmin(handler);