import { serialize } from 'cookie';
import { validateOrigin } from '../../utils/csrf';

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: '请求来源不合法' });
    }
    res.setHeader('Set-Cookie', serialize('auth_token', '', {
        maxAge: -1,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    }));
    res.status(200).json({ success: true });
}
