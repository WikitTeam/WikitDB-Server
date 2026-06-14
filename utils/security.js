import prisma from '../lib/prisma';

/**
 * 转义 GraphQL 字符串参数，防止注入攻击
 */
export function sanitizeGraphQL(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/[\\"]/g, '')
        .replace(/[\n\r\t]/g, ' ')
        .replace(/[{}()]/g, '')
        .trim()
        .slice(0, 200);
}

/**
 * HTML 实体转义，防止 XSS
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 从请求中提取客户端 IP
 */
export function getClientIp(req) {
    const trustProxy = process.env.TRUST_PROXY === 'true';
    const forwarded = req.headers['x-forwarded-for'];
    if (trustProxy && forwarded) return String(forwarded).split(',')[0].trim();
    if (trustProxy && req.headers['x-real-ip']) return String(req.headers['x-real-ip']);
    return req.socket?.remoteAddress || 'unknown';
}

// 内存级 IP 限速器（轻量，不持久化）
const ipRateLimitStore = new Map();

/**
 * IP 级别限速（内存存储，进程重启清零）
 * @returns {boolean} true = 已超限
 */
export function ipRateLimit(ip, key, maxAttempts, windowMs) {
    const now = Date.now();
    const storeKey = `${key}:${ip}`;
    let attempts = ipRateLimitStore.get(storeKey) || [];
    attempts = attempts.filter(ts => now - ts < windowMs);

    if (attempts.length >= maxAttempts) return true;

    attempts.push(now);
    ipRateLimitStore.set(storeKey, attempts);

    // 定期清理过期条目防止内存泄漏
    if (ipRateLimitStore.size > 10000) {
        for (const [k, v] of ipRateLimitStore) {
            const valid = v.filter(ts => now - ts < windowMs);
            if (valid.length === 0) ipRateLimitStore.delete(k);
            else ipRateLimitStore.set(k, valid);
        }
    }

    return false;
}

/**
 * 通用速率限制器（基于 Setting 表，持久化）
 * @returns {boolean} true = 已超限，应拒绝请求
 */
export async function rateLimit(key, maxAttempts, windowMs) {
    const now = Date.now();
    const recordKey = `ratelimit:${key}`;

    const record = await prisma.setting.findUnique({ where: { key: recordKey } });
    let attempts = [];

    if (record && record.value) {
        try {
            const data = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
            attempts = (data.attempts || []).filter(ts => now - ts < windowMs);
        } catch (e) {
            attempts = [];
        }
    }

    if (attempts.length >= maxAttempts) {
        return true;
    }

    attempts.push(now);
    await prisma.setting.upsert({
        where: { key: recordKey },
        update: { value: JSON.stringify({ attempts }) },
        create: { key: recordKey, value: JSON.stringify({ attempts }) }
    });

    return false;
}

/**
 * 数值范围校验
 * @returns {number|null} 合法数值或 null
 */
export function validateNumberRange(val, min, max) {
    const num = Number(val);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}
