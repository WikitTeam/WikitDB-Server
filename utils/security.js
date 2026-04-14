import prisma from '../lib/prisma';

/**
 * 转义 GraphQL 字符串参数，防止注入攻击
 * 移除双引号和反斜杠等可能破坏查询结构的字符
 */
export function sanitizeGraphQL(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[\\"]/g, '').replace(/[\n\r\t]/g, ' ').trim();
}

/**
 * 通用速率限制器（基于 Setting 表）
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
