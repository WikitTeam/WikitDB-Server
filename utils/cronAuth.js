/**
 * 定时任务入口鉴权。
 * Vercel Cron 会带 Authorization: Bearer $CRON_SECRET。
 * 未配置 CRON_SECRET 时拒绝（避免把爬虫端点暴露到公网）。
 * 本地手动调试可设 ALLOW_INSECURE_CRON=1。
 */
const crypto = require('crypto');

function header(req, name) {
    const headers = (req && req.headers) || {};
    const direct = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(direct)) return String(direct[0] || '');
    return direct ? String(direct) : '';
}

function tokenFromRequest(req) {
    const auth = header(req, 'authorization');
    if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
    return header(req, 'x-cron-secret').trim();
}

function safeEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function authorizeCron(req) {
    if (process.env.ALLOW_INSECURE_CRON === '1' && process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
        return true;
    }
    const secret = process.env.CRON_SECRET || '';
    if (!secret || secret.length < 16) return false;
    return safeEqual(tokenFromRequest(req), secret);
}

module.exports = { authorizeCron, tokenFromRequest };
