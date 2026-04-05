import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

const SECRET = process.env.JWT_SECRET || 'WIKIT_DB_SECURE_KEY_882910';

export function signToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(req) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return null;
    
    try {
        return jwt.verify(token, SECRET);
    } catch (e) {
        return null;
    }
}
