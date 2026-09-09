/**
 * 开发环境身份调试 —— 种子数据
 *
 * 本地注册流程走不通（check 步骤要去外部 Wikidot 站点做活体验证，
 * submit 步骤依赖 SMTP 邮件验证码），所以直接往库里写账号。
 *
 * 用法：node scripts/dev-seed.js
 *
 * 创建三个固定身份：
 *   dev_user   普通成员（无特权）
 *   dev_staff  职员（staffSites = ["brcn","x"]，只能审这两个站）
 *   dev_admin  管理员（全部站点 + admin 面板）
 *
 * 同时造若干 proxy_posts 审核单，覆盖全部状态，供职员面板 UI 调试。
 * 重复执行是幂等的（upsert + 按 username/page 去重）。
 *
 * 安全：本脚本会直接写库且口令固定，因此生产环境（NODE_ENV=production）
 * 一律拒绝执行；口令优先取 DEV_SEED_PASSWORD，未设置时才回退到默认值。
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// 生产环境硬闸：误连生产库执行会写入带已知口令的账号
if (process.env.NODE_ENV === 'production') {
    console.error('[dev-seed] 拒绝执行：NODE_ENV=production。本脚本仅供本地开发使用。');
    process.exit(1);
}

// 第二道闸：DATABASE_URL 指向非本地库时拒绝，避免误对线上库写种子账号
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !/(localhost|127\.0\.0\.1|\[?::1\]?)/.test(dbUrl) && process.env.DEV_SEED_ALLOW_REMOTE !== '1') {
    console.error('[dev-seed] 拒绝执行：DATABASE_URL 不是本地库。确认目标无误请设置 DEV_SEED_ALLOW_REMOTE=1 后重试。');
    process.exit(1);
}

const prisma = new PrismaClient();

const PASSWORD = process.env.DEV_SEED_PASSWORD || 'wikitdb-dev-2026';

const ACCOUNTS = [
    { username: 'dev_user', isStaff: false, isAdmin: false, staffSites: null },
    { username: 'dev_staff', isStaff: true, isAdmin: false, staffSites: JSON.stringify(['brcn', 'x']) },
    { username: 'dev_admin', isStaff: false, isAdmin: true, staffSites: null },
];

const SAMPLE_SOURCE = `[[div class="test-block"]]
这是一条用于 UI 调试的示例代发内容。

+ 列表项一
+ 列表项二
[[/div]]`;

const SAMPLE_POSTS = [
    { site: 'brcn', siteName: 'The Bsckrooms中文维基', page: 'dev-sample-001', title: '示例：层级错乱的实体档案', status: 'pending', comments: '麻烦职员帮忙代发，谢谢' },
    { site: 'brcn', siteName: 'The Bsckrooms中文维基', page: 'dev-sample-002', title: '示例：待补充图片的文档', status: 'approved', comments: null, reviewNote: '内容没问题，已通过' },
    { site: 'x', siteName: 'The Backrooms X层群', page: 'dev-sample-003', title: '示例：X层群新条目', status: 'sent', comments: '急，今天想发出去' },
    { site: 'x', siteName: 'The Backrooms X层群', page: 'dev-sample-004', title: '示例：格式不合规草稿', status: 'rejected', comments: null, reviewNote: '标题格式不符合站点规范，请修改后重新提交' },
    { site: 'brcn', siteName: 'The Bsckrooms中文维基', page: 'dev-sample-005', title: '示例：发送失败的条目', status: 'failed', comments: null, sendResult: 'Wikidot 返回 503，稍后重试' },
    { site: 'dfc', siteName: '深林文学部', page: 'dev-sample-006', title: '示例：职员权限外的站点', status: 'pending', comments: '这条属于 dev_staff 权限之外，仅管理员可见' },
];

async function main() {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const ids = {};

    for (const acc of ACCOUNTS) {
        const user = await prisma.user.upsert({
            where: { username: acc.username },
            update: {
                password: passwordHash,
                isStaff: acc.isStaff,
                isAdmin: acc.isAdmin,
                staffSites: acc.staffSites,
                status: 'active',
            },
            create: {
                username: acc.username,
                password: passwordHash,
                isStaff: acc.isStaff,
                isAdmin: acc.isAdmin,
                staffSites: acc.staffSites,
                balance: 10000,
                status: 'active',
            },
        });
        ids[acc.username] = user.id;
    }

    // 审核单归属 dev_user（提交人），这样职员面板里能看到"别人提交的"
    const submitterId = ids.dev_user;
    let createdPosts = 0;

    for (const p of SAMPLE_POSTS) {
        const existing = await prisma.proxyPost.findFirst({
            where: { site: p.site, page: p.page },
        });
        if (existing) continue;

        await prisma.proxyPost.create({
            data: {
                userId: submitterId,
                username: 'dev_user',
                site: p.site,
                siteName: p.siteName,
                page: p.page,
                title: p.title,
                source: SAMPLE_SOURCE,
                comments: p.comments,
                status: p.status,
                reviewNote: p.reviewNote || null,
                reviewedBy: p.reviewNote ? 'dev_staff' : null,
                reviewedAt: p.reviewNote ? new Date() : null,
                sendResult: p.sendResult || null,
                sentAt: p.status === 'sent' ? new Date() : null,
            },
        });
        createdPosts++;
    }

    const total = await prisma.proxyPost.count();

    console.log('\n[dev-seed] 账号就绪（统一密码：%s）', PASSWORD);
    for (const acc of ACCOUNTS) {
        const role = acc.isAdmin ? '管理员' : acc.isStaff ? `职员 (${acc.staffSites})` : '普通成员';
        console.log('  - %s  %s', acc.username.padEnd(12), role);
    }
    console.log('[dev-seed] 本次新增审核单 %d 条，库中合计 %d 条', createdPosts, total);
    console.log('[dev-seed] 现在访问 http://localhost:3000/api/dev/login?as=staff 即可切换身份\n');
}

main()
    .catch((e) => {
        console.error('[dev-seed] 失败：', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
