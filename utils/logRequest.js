import prisma from '../lib/prisma';
import { verifyToken } from './auth';
import { getClientIp } from './security';

const REDACTED_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'set-cookie']);
const REDACTED_BODY_KEYS = /password|token|secret|code|session|cookie/i;

function redactObject(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(redactObject);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        REDACTED_BODY_KEYS.test(key) ? '[REDACTED]' : redactObject(item)
    ]));
}

function formatHeaders(headers) {
    const entries = Object.entries(headers).map(([key, value]) => [
        key,
        REDACTED_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value
    ]);
    if (entries.length === 0) return '(empty)';
    const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
    return entries
        .map(([k, v]) => `    [${k}]${' '.repeat(maxKeyLen - k.length)} => ${v}`)
        .join('\n');
}

function printRequestLog(req) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const body = typeof req.body === 'object'
        ? JSON.stringify(redactObject(req.body), null, 2)
        : (req.body ? '[NON-JSON BODY OMITTED]' : '(empty)');

    console.log(
`===== NEW REQUEST =====
Time: ${timestamp}
Headers:
${formatHeaders(req.headers)}

Body: ${body}
=======================`
    );
}

export async function logRequest(req, res) {
    try {
        printRequestLog(req);

        const ip = getClientIp(req);

        let username = null;
        try {
            const decoded = verifyToken(req);
            if (decoded?.username) username = decoded.username;
        } catch (_) {}

        await prisma.accessLog.create({
            data: {
                method: req.method || 'GET',
                path: req.url?.split('?')[0] || req.url || '',
                status: res.statusCode ?? 200,
                ip,
                userAgent: req.headers['user-agent'] || null,
                username,
                duration: req._startTime ? Date.now() - req._startTime : null,
            }
        });
    } catch (e) {
        console.error('[AccessLog] 写入失败:', e.message);
    }
}

export function withLogging(handler) {
    return async (req, res) => {
        req._startTime = Date.now();

        const originalJson = res.json;
        res.json = function (body) {
            logRequest(req, res).catch(() => {});
            return originalJson.call(res, body);
        };

        return handler(req, res);
    };
}
