const { PrismaClient } = require('@prisma/client');

/**
 * 无服务器温启动会复用同一个实例。
 * 客户端必须挂在 globalThis 上，否则每次冷启动路径重复 new 会打满数据库连接。
 * 在 Vercel 上如果连接串没写 connection_limit，默认补 1，避免一个函数占一整池连接。
 */
function serverlessDatabaseUrl(url) {
    if (!url || !process.env.VERCEL) return url;
    if (/[?&]connection_limit=/.test(url)) return url;
    const join = url.includes('?') ? '&' : '?';
    return `${url}${join}connection_limit=1`;
}

function createClient() {
    const url = serverlessDatabaseUrl(process.env.DATABASE_URL);
    const options = url && url !== process.env.DATABASE_URL
        ? { datasources: { db: { url } } }
        : undefined;
    return new PrismaClient(options);
}

const prismaBase = global.__prisma || createClient();
global.__prisma = prismaBase;

const prisma = prismaBase.$extends({
    query: {
        setting: {
            async findUnique({ args, query }) {
                const result = await query(args);
                if (result && result.value) {
                    try { result.value = JSON.parse(result.value); } catch { /* 保持原字符串 */ }
                }
                return result;
            },
            async findFirst({ args, query }) {
                const result = await query(args);
                if (result && result.value) {
                    try { result.value = JSON.parse(result.value); } catch { /* 保持原字符串 */ }
                }
                return result;
            },
            async findMany({ args, query }) {
                const results = await query(args);
                results.forEach(r => {
                    if (r && r.value) {
                        try { r.value = JSON.parse(r.value); } catch { /* 保持原字符串 */ }
                    }
                });
                return results;
            },
            async create({ args, query }) {
                if (args.data && args.data.value !== undefined && typeof args.data.value !== 'string') {
                    args.data.value = JSON.stringify(args.data.value);
                }
                const result = await query(args);
                if (result && result.value) {
                    try { result.value = JSON.parse(result.value); } catch { /* 保持原字符串 */ }
                }
                return result;
            },
            async update({ args, query }) {
                if (args.data && args.data.value !== undefined && typeof args.data.value !== 'string') {
                    args.data.value = JSON.stringify(args.data.value);
                }
                const result = await query(args);
                if (result && result.value) {
                    try { result.value = JSON.parse(result.value); } catch { /* 保持原字符串 */ }
                }
                return result;
            },
            async upsert({ args, query }) {
                if (args.create && args.create.value !== undefined && typeof args.create.value !== 'string') {
                    args.create.value = JSON.stringify(args.create.value);
                }
                if (args.update && args.update.value !== undefined && typeof args.update.value !== 'string') {
                    args.update.value = JSON.stringify(args.update.value);
                }
                const result = await query(args);
                if (result && result.value) {
                    try { result.value = JSON.parse(result.value); } catch { /* 保持原字符串 */ }
                }
                return result;
            },
        }
    }
});

module.exports = prisma;
module.exports.default = prisma;
module.exports.prisma = prisma;
