const prisma = require('../lib/prisma');
const { verifyToken } = require('../utils/auth');

async function logRequest(req, res, { status } = {}) {
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
                status: status ?? res.statusCode ?? 200,
                ip,
                userAgent: req.headers['user-agent'] || null,
                username,
                duration: req._startTime ? Date.now() - req._startTime : null,
            }
        });
    } catch (_) {
        // 日志写入失败不影响业务
    }
}

function withLogging(handler) {
    return async (req, res) => {
        req._startTime = Date.now();

        const originalEnd = res.end;
        res.end = function (...args) {
            originalEnd.apply(res, args);
            logRequest(req, res).catch(() => {});
        };

        return handler(req, res);
    };
}

module.exports = { logRequest, withLogging };
