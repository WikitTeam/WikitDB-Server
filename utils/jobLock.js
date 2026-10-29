/**
 * 用 settings 行做互斥锁。
 * 无服务器平台会并发触发同一个 cron，锁保证同一任务只有一个切片在跑。
 */
function normalize(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        try { return JSON.parse(value); } catch (e) { return null; }
    }
    return value;
}

async function withJobLock(name, ttlMs, fn) {
    const prisma = require('../lib/prisma');
    const key = `lock:${name}`;
    const owner = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const until = Date.now() + ttlMs;

    let state;
    try {
        state = await prisma.$transaction(async (tx) => {
            const row = await tx.setting.findUnique({ where: { key } });
            const cur = normalize(row && row.value);
            if (cur && Number(cur.until) > Date.now()) return 'locked';
            const value = { owner, until };
            await tx.setting.upsert({
                where: { key },
                update: { value },
                create: { key, value },
            });
            return 'ok';
        }, { isolationLevel: 'Serializable' });
    } catch (e) {
        if (e.code === 'P2034') return { skipped: true, reason: 'locked' };
        throw e;
    }

    if (state !== 'ok') return { skipped: true, reason: 'locked' };

    try {
        return await fn();
    } finally {
        try {
            const row = await prisma.setting.findUnique({ where: { key } });
            const cur = normalize(row && row.value);
            if (cur && cur.owner === owner) {
                await prisma.setting.delete({ where: { key } });
            }
        } catch (e) { /* 锁过期由下一轮覆盖 */ }
    }
}

module.exports = { withJobLock };
