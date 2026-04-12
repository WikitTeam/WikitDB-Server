import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

export function signToken(payload) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('致命错误: 环境变量中未配置 JWT_SECRET');
        throw new Error('服务器安全配置缺失');
    }
    return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyToken(req) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    
    if (!token) {
        // console.log('[Auth] No auth_token found in cookies');
        return null;
    }
    
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('[Auth Critical] JWT_SECRET is not defined in environment variables!');
            return null;
        }
        return jwt.verify(token, secret);
    } catch (e) {
        console.error('[Auth Error] Token verification failed:', e.message);
        return null;
    }
}