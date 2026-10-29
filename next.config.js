/** @type {import('next').NextConfig} */

// 允许嵌入的跨域 iframe（删除倒计时器等）
const ALLOWED_FRAME_DOMAINS = ['https://timer.backroomswiki.cn'];

// Next.js dev 模式（webpack/HMR runtime）内部使用 eval()，
// CSP 若不放行 'unsafe-eval' 会导致客户端渲染崩溃白屏。
// 仅在开发环境放宽，生产构建保持严格 CSP。
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
    async rewrites() {
        return [
            // Honeypot traps for common attack paths
            { source: '/wp-admin', destination: '/api/honeypot/wp-admin' },
            { source: '/wp-admin/:path*', destination: '/api/honeypot/wp-admin/:path*' },
            { source: '/wp-login.php', destination: '/api/honeypot/wp-login' },
            { source: '/administrator', destination: '/api/honeypot/administrator' },
            { source: '/phpmyadmin', destination: '/api/honeypot/phpmyadmin' },
            { source: '/phpmyadmin/:path*', destination: '/api/honeypot/phpmyadmin/:path*' },
            { source: '/.env', destination: '/api/honeypot/dotenv' },
            { source: '/.git/config', destination: '/api/honeypot/git-config' },
            { source: '/xmlrpc.php', destination: '/api/honeypot/xmlrpc' },
            { source: '/admin/login', destination: '/api/honeypot/admin-login' },
            { source: '/cgi-bin/:path*', destination: '/api/honeypot/cgi-bin/:path*' },
            { source: '/debug/:path*', destination: '/api/honeypot/debug/:path*' },
            { source: '/actuator/:path*', destination: '/api/honeypot/actuator/:path*' },
            { source: '/console', destination: '/api/honeypot/console' },
            { source: '/solr/:path*', destination: '/api/honeypot/solr/:path*' },
            { source: '/backup/:path*', destination: '/api/honeypot/backup/:path*' },
            { source: '/config.php', destination: '/api/honeypot/config-php' },
            { source: '/server-status', destination: '/api/honeypot/server-status' },
        ];
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
                    { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://wikit.unitreaty.org https://www.wikidot.com; frame-src 'self' ${ALLOWED_FRAME_DOMAINS.join(' ')}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
