import { NextResponse } from 'next/server';

const ipRequestCounts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 120;

function cleanupStore() {
    const now = Date.now();
    if (ipRequestCounts.size > 5000) {
        for (const [key, data] of ipRequestCounts) {
            if (now - data.windowStart > WINDOW_MS) {
                ipRequestCounts.delete(key);
            }
        }
    }
}

export function middleware(request) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';

    if (request.nextUrl.pathname.startsWith('/api/')) {
        const now = Date.now();
        const record = ipRequestCounts.get(ip);

        if (!record || now - record.windowStart > WINDOW_MS) {
            ipRequestCounts.set(ip, { count: 1, windowStart: now });
        } else {
            record.count++;
            if (record.count > MAX_REQUESTS_PER_MINUTE) {
                return NextResponse.json(
                    { error: '请求过于频繁，请稍后再试' },
                    { status: 429 }
                );
            }
        }

        cleanupStore();
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/:path*',
};
