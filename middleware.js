import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 120;

// 没配 Upstash 时只在当前边缘实例里计数，跨实例不共享。
const ipRequestCounts = new Map();

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

function clientIp(request) {
    const trustProxy = process.env.TRUST_PROXY === 'true';
    return (trustProxy && request.headers.get('x-forwarded-for')?.split(',')[0]?.trim())
        || (trustProxy && request.headers.get('x-real-ip'))
        || request.ip
        || 'unknown';
}

function tooMany() {
    return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        { status: 429 }
    );
}

function memoryLimit(ip) {
    const now = Date.now();
    const record = ipRequestCounts.get(ip);
    if (!record || now - record.windowStart > WINDOW_MS) {
        ipRequestCounts.set(ip, { count: 1, windowStart: now });
        return false;
    }
    record.count += 1;
    if (ipRequestCounts.size > 5000) {
        for (const [key, data] of ipRequestCounts) {
            if (now - data.windowStart > WINDOW_MS) ipRequestCounts.delete(key);
        }
    }
    return record.count > MAX_REQUESTS_PER_MINUTE;
}

export async function middleware(request) {
    if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

    const ip = clientIp(request);

    if (redis) {
        try {
            const bucket = Math.floor(Date.now() / WINDOW_MS);
            const key = `rl:${ip}:${bucket}`;
            const count = await redis.incr(key);
            if (count === 1) await redis.expire(key, 70);
            if (count > MAX_REQUESTS_PER_MINUTE) return tooMany();
            return NextResponse.next();
        } catch (e) {
            // Redis 故障时退回本实例计数，不把整个 API 打挂。
        }
    }

    if (memoryLimit(ip)) return tooMany();
    return NextResponse.next();
}

export const config = {
    matcher: '/api/:path*',
};
