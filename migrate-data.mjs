import { Redis } from '@upstash/redis';
import { PrismaClient } from '@prisma/client';

// 连上你原来的 Upstash Redis 数据库
const redis = new Redis({
    url: 'https://cosmic-peacock-76441.upstash.io',
    token: 'gQAAAAAAASqZAAIncDEwNzkyNTBhYzQwYmY0MDQxYjJjNThjYTIzM2U5NDRiMnAxNzY0NDE',
});

const prisma = new PrismaClient();

async function main() {
    console.log('开始从 Redis 搬运数据到 PostgreSQL...');

    // 拿到所有的 user 相关的键
    const allUserKeys = await redis.keys('user:*');
    
    // 过滤出纯用户数据的键，排除掉后面带 trades 或者 gacha 的键
    const userKeys = allUserKeys.filter(key => key.split(':').length === 2);
    console.log(`扫描到 ${userKeys.length} 个用户数据，准备写入...`);

    // 1. 搬运用户的账号密码和余额等基本信息
    for (const key of userKeys) {
        const username = key.replace('user:', '');
        const userData = await redis.get(key);

        if (!userData) continue;

        await prisma.user.upsert({
            where: { username: username },
            update: {}, 
            create: {
                username: username,
                password: userData.password || '',
                wikidotAccount: userData.wikidotAccount || null,
                balance: userData.balance !== undefined ? Number(userData.balance) : 10000,
            }
        });
        console.log(`已搬运用户: ${username}`);
    }

    // 2. 搬运原来的全局管理员权限
    const admins = await redis.smembers('global:admins');
    if (admins && admins.length > 0) {
        console.log('正在恢复管理员权限...');
        for (const admin of admins) {
            try {
                await prisma.user.update({
                    where: { username: admin },
                    data: { isAdmin: true }
                });
            } catch (error) {
                // 如果 Redis 里记了管理员名字，但实际没这个用户数据，就直接跳过
            }
        }
    }

    // 3. 搬运历史交易记录和抽卡记录
    console.log('正在检查并搬运交易与抽卡历史...');
    for (const key of userKeys) {
        const username = key.replace('user:', '');
        const userRecord = await prisma.user.findUnique({ where: { username } });
        
        if (!userRecord) continue;

        const trades = await redis.lrange(`user:${username}:trades`, 0, -1);
        if (trades && trades.length > 0) {
            for (const trade of trades) {
                await prisma.trade.create({
                    data: {
                        data: trade,
                        userId: userRecord.id
                    }
                });
            }
            console.log(`搬运了 ${username} 的 ${trades.length} 条交易记录`);
        }

        const gachas = await redis.lrange(`user:${username}:gacha`, 0, -1);
        if (gachas && gachas.length > 0) {
            for (const gacha of gachas) {
                await prisma.gacha.create({
                    data: {
                        data: gacha,
                        userId: userRecord.id
                    }
                });
            }
            console.log(`搬运了 ${username} 的 ${gachas.length} 条抽卡记录`);
        }
    }

    console.log('全部数据搬运完成！');
}

main()
    .catch((e) => {
        console.error('迁移过程中出错:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });