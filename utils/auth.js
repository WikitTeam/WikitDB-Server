import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET is not defined in environment variables!');
}

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
};

export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
}

export function verifyToken(req) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET || 'dev_secret');
    } catch (e) {
        return null;
    }
}

export function serializeAuthCookie(token) {
    return serialize('auth_token', token, COOKIE_OPTIONS);
}