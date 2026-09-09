import prisma from '../../../lib/prisma';
import { signToken, serializeAuthCookie } from '../../../utils/auth';

/**
 * 开发环境身份切换
 *
 *   /api/dev/login?as=staff            以职员身份登录并跳转首页
 *   /api/dev/login?as=admin&next=/admin 以管理员身份登录并跳转 /admin
 *   /api/dev/login?as=logout           清除登录态
 *
 * 依赖 scripts/dev-seed.js 先造好账号。
 *
 * 安全：这是能直接签发任意角色 JWT 的后门接口，设了两道独立的闸，任一不满足即 404：
 *   1. NODE_ENV 必须是非 production（Next 构建/启动时的默认闸）
 *   2. 必须显式设置 ENABLE_DEV_LOGIN=1（自托管 docker、preview 环境常漏设 NODE_ENV，
 *      单靠第一道闸会在这些场景下把后门暴露出去）
 * 也就是说，即便部署时忘了设 NODE_ENV，只要没显式打开 ENABLE_DEV_LOGIN，接口就不可用。
 */

const ROLES = {
    user: 'dev_user',
    staff: 'dev_staff',
    admin: 'dev_admin',
};

// 模块加载时求值：生产构建下该分支整体不可达，打包器可据此消除
const DEV_LOGIN_ENABLED =
    process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === '1';

export default async function handler(req, res) {
    if (!DEV_LOGIN_ENABLED) {
        return res.status(404).json({ error: 'Not found' });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { as = 'user', next = '/' } = req.query;
    const target = safeNext(next);

    // 登出：清 httpOnly cookie，同时让页面脚本清掉 localStorage 里的用户名
    if (as === 'logout') {
        res.setHeader('Set-Cookie', serializeAuthCookie('', { maxAge: 0 }));
        return sendBootstrap(res, '', target);
    }

    const username = ROLES[as];
    if (!username) {
        return res.status(400).json({
            error: `未知身份「${as}」，可用：${Object.keys(ROLES).join(' / ')} / logout`,
        });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        return res.status(404).json({
            error: `账号 ${username} 不存在，先运行：node scripts/dev-seed.js`,
        });
    }

    const token = signToken({ username: user.username, uid: user.id });
    res.setHeader('Set-Cookie', serializeAuthCookie(token));
    return sendBootstrap(res, user.username, target);
}

/**
 * 返回一个落地页而不是 302。
 *
 * Header 右上角的用户名读的是 localStorage，而权限走的是 httpOnly cookie
 * ——两个来源不一致，只设 cookie 会出现「职员面板入口在、但右上角仍显示登录」的割裂状态。
 * 所以这里顺带把 username 写进 localStorage，让切换后的状态跟真实登录一致。
 */
function sendBootstrap(res, username, target) {
    const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>dev login</title></head>
<body style="font:14px/1.6 system-ui;background:#18181b;color:#e4e4e7;padding:2rem">
<p>身份已切换为 <b>${escapeHtml(username || '未登录')}</b>，正在跳转…</p>
<script>
try {
  if (${JSON.stringify(username || '')}) {
    localStorage.setItem('username', ${JSON.stringify(username)});
  } else {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
  }
} catch (e) {}
setTimeout(function () { location.replace(${JSON.stringify(target)}); }, 300);
</script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

/** 只接受站内绝对路径，挡掉协议相对 URL（//evil.com）这类开放重定向 */
function safeNext(next) {
    if (typeof next !== 'string') return '/';
    if (!next.startsWith('/') || next.startsWith('//')) return '/';
    return next;
}
