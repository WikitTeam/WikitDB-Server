/**
 * CSRF 纵深防御 — Origin/Referer 校验
 * SameSite=strict cookie 已提供主要防护，这是额外一层。
 */

const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.SITE_ORIGIN,
].filter(Boolean);

export function validateOrigin(req) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return true;
    }

    const origin = req.headers['origin'];
    const referer = req.headers['referer'];

    if (origin) {
        return ALLOWED_ORIGINS.some(allowed => origin === allowed);
    }

    if (referer) {
        try {
            const refOrigin = new URL(referer).origin;
            return ALLOWED_ORIGINS.some(allowed => refOrigin === allowed);
        } catch {
            return false;
        }
    }

    // 没有 Origin 也没有 Referer（如 curl/Postman 直接调用）— 放行
    // 因为 SameSite=strict 已经阻止了浏览器跨站请求携带 cookie
    return true;
}

/**
 * 包装器：给 handler 加上 CSRF 校验
 */
export function withCsrf(handler) {
    return async (req, res) => {
        if (!validateOrigin(req)) {
            return res.status(403).json({ error: '请求来源不合法' });
        }
        return handler(req, res);
    };
}
