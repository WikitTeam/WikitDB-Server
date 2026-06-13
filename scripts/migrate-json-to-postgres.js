const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJSON(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return { nextId: 1, records: [] };
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return { nextId: 1, records: [] };
    }
}

async function resetSequence(table, nextId) {
    if (nextId > 1) {
        await prisma.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('${table}', 'id'), ${nextId - 1});`
        );
    }
}

async function main() {
    console.log('Starting JSON → PostgreSQL migration...\n');

    // 1. Users
    const users = loadJSON('users.json');
    for (const u of users.records) {
        await prisma.user.create({
            data: {
                id: u.id,
                username: u.username,
                password: u.password,
                email: u.email || null,
                balance: u.balance ?? 10000,
                wikidotAccount: u.wikidotAccount || null,
                isAdmin: u.isAdmin || false,
                status: u.status || 'active',
                createdAt: new Date(u.createdAt),
            }
        });
    }
    await resetSequence('users', users.nextId);
    console.log(`✓ Users: ${users.records.length} migrated`);

    // 2. Trades
    const trades = loadJSON('trades.json');
    for (const t of trades.records) {
        await prisma.trade.create({
            data: {
                id: t.id,
                userId: t.userId,
                type: t.type || 'BUY',
                amount: t.amount || 0,
                target: t.target || '',
                status: t.status || 'COMPLETED',
                description: typeof t.description === 'object' ? JSON.stringify(t.description) : (t.description || null),
                createdAt: new Date(t.createdAt),
            }
        });
    }
    await resetSequence('trades', trades.nextId);
    console.log(`✓ Trades: ${trades.records.length} migrated`);

    // 3. Gachas
    const gachas = loadJSON('gachas.json');
    for (const g of gachas.records) {
        await prisma.gacha.create({
            data: {
                id: g.id,
                userId: g.userId,
                poolId: g.poolId || 'DEFAULT',
                result: g.result,
                cost: g.cost || 0,
                createdAt: new Date(g.createdAt),
            }
        });
    }
    await resetSequence('gachas', gachas.nextId);
    console.log(`✓ Gachas: ${gachas.records.length} migrated`);

    // 4. Images
    const images = loadJSON('images.json');
    for (const i of images.records) {
        await prisma.image.create({
            data: {
                id: i.id,
                uploaderId: i.uploaderId,
                createdAt: new Date(i.createdAt),
            }
        });
    }
    await resetSequence('images', images.nextId);
    console.log(`✓ Images: ${images.records.length} migrated`);

    // 5. Settings
    const settings = loadJSON('settings.json');
    for (const s of settings.records) {
        const value = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        await prisma.setting.create({
            data: {
                key: s.key,
                value,
                createdAt: new Date(s.createdAt),
            }
        });
    }
    console.log(`✓ Settings: ${settings.records.length} migrated`);

    // 6. Access Logs
    const accessLogs = loadJSON('access-logs.json');
    for (const l of accessLogs.records) {
        await prisma.accessLog.create({
            data: {
                id: l.id,
                method: l.method || 'GET',
                path: l.path || '/',
                status: l.status || null,
                ip: l.ip || null,
                userAgent: l.userAgent || null,
                username: l.username || null,
                duration: l.duration || null,
                createdAt: new Date(l.createdAt),
            }
        });
    }
    await resetSequence('access_logs', accessLogs.nextId);
    console.log(`✓ Access Logs: ${accessLogs.records.length} migrated`);

    // 7. Forum Categories
    const forumCats = loadJSON('forum-categories.json');
    for (const c of forumCats.records) {
        await prisma.forumCategory.create({
            data: {
                id: c.id,
                siteParam: c.siteParam,
                categoryId: c.categoryId,
                title: c.title || '',
                description: c.description || '',
                threadsCount: c.threadsCount || 0,
                postsCount: c.postsCount || 0,
                lastSyncedAt: c.lastSyncedAt ? new Date(c.lastSyncedAt) : null,
                createdAt: new Date(c.createdAt),
            }
        });
    }
    await resetSequence('forum_categories', forumCats.nextId);
    console.log(`✓ Forum Categories: ${forumCats.records.length} migrated`);

    // 8. Forum Threads
    const forumThreads = loadJSON('forum-threads.json');
    for (const t of forumThreads.records) {
        await prisma.forumThread.create({
            data: {
                id: t.id,
                siteParam: t.siteParam,
                threadId: t.threadId,
                categoryId: t.categoryId,
                title: t.title || '',
                createdBy: t.createdBy || '',
                postCount: t.postCount || 0,
                isSticky: t.isSticky || false,
                isLocked: t.isLocked || false,
                lastSyncedAt: t.lastSyncedAt ? new Date(t.lastSyncedAt) : null,
                createdAt: new Date(t.createdAt),
            }
        });
    }
    await resetSequence('forum_threads', forumThreads.nextId);
    console.log(`✓ Forum Threads: ${forumThreads.records.length} migrated`);

    // 9. Forum Posts
    const forumPosts = loadJSON('forum-posts.json');
    for (const p of forumPosts.records) {
        await prisma.forumPost.create({
            data: {
                id: p.id,
                siteParam: p.siteParam,
                postId: p.postId,
                threadId: p.threadId,
                parentId: p.parentId || null,
                title: p.title || '',
                contentHtml: p.contentHtml || '',
                author: p.author || '',
                authorId: p.authorId || null,
                createdAt: new Date(p.createdAt),
            }
        });
    }
    await resetSequence('forum_posts', forumPosts.nextId);
    console.log(`✓ Forum Posts: ${forumPosts.records.length} migrated`);

    console.log('\n✓ Migration complete!');
}

main()
    .catch(e => { console.error('Migration failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
