import prisma from '../lib/prisma';
import { verifyToken } from './auth';

export async function logRequest(req, res) {
    try {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket?.remoteAddress || null;

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
