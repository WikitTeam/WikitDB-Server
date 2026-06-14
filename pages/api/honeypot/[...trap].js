import prisma from '../../../lib/prisma';
import { getClientIp } from '../../../utils/security';

export default async function handler(req, res) {
    const ip = getClientIp(req);
    const path = `/api/honeypot/${(req.query.trap || []).join('/')}`;

    await prisma.accessLog.create({
        data: {
            type: 'honeypot',
            ip,
            path,
            method: req.method,
            userAgent: req.headers['user-agent'] || '',
            payload: req.method !== 'GET' ? '[REDACTED]' : '',
            headers: JSON.stringify({
                origin: req.headers['origin'] || '',
                referer: req.headers['referer'] || '',
            }),
            createdAt: new Date().toISOString(),
        }
    });

    // Simulate believable slow responses to waste attacker time
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    if (path.includes('login') || path.includes('auth')) {
        return res.status(403).json({ error: 'Invalid credentials', code: 'AUTH_FAILED' });
    }
    if (path.includes('upload') || path.includes('file')) {
        return res.status(413).json({ error: 'File too large' });
    }
    if (path.includes('sql') || path.includes('db') || path.includes('dump')) {
        return res.status(500).json({ error: 'Internal server error' });
    }
    return res.status(404).json({ error: 'Not found' });
}
