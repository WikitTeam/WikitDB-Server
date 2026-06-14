const { PrismaClient } = require('@prisma/client');

let prismaBase;

if (process.env.NODE_ENV === 'production') {
    prismaBase = new PrismaClient();
} else {
    if (!global.__prisma) {
        global.__prisma = new PrismaClient();
    }
    prismaBase = global.__prisma;
}

const prisma = prismaBase.$extends({
    query: {
        setting: {
            async findUnique({ args, query }) {
                const result = await query(args);
                if (result && result.value) {
                    try { result.value = JSON.parse(result.value); } catch {}
                }
                return result;
            },
            async findFirst({ args, query }) {
                const result = await query(args);
                if (result && result.value) {
                    try { result.value = JSON.parse(result.value); } catch {}
                }
                return result;
            },
            async findMany({ args, query }) {
                const results = await query(args);
                results.forEach(r => {
                    if (r && r.value) {
                        try { r.value = JSON.parse(r.value); } catch {}
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
                    try { result.value = JSON.parse(result.value); } catch {}
                }
                return result;
            },
            async update({ args, query }) {
                if (args.data && args.data.value !== undefined && typeof args.data.value !== 'string') {
                    args.data.value = JSON.stringify(args.data.value);
                }
                const result = await query(args);
                if (result && result.value) {
                    try { result.value = JSON.parse(result.value); } catch {}
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
                    try { result.value = JSON.parse(result.value); } catch {}
                }
                return result;
            },
        }
    }
});

module.exports = prisma;
module.exports.default = prisma;
module.exports.prisma = prisma;
