import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from './Header.module.css';
const config = require('../wikitdb.config.js');

// 高清矢量 Logo 组件：亮/暗主题各渲染一份，靠 dark: 变体切换显隐（无闪烁、无需 JS）
const HighDefLogoSVG = ({ className }) => (
    <>
        <img
            src="/img/wikit-logo-black.svg"
            alt="Logo"
            className={`${className} dark:hidden`}
            onError={(e) => { e.target.src = '/img/logo.svg'; }} // 降级处理
        />
        <img
            src="/img/wikit-logo-white.svg"
            alt=""
            aria-hidden="true"
            className={`${className} hidden dark:block`}
            onError={(e) => { e.target.src = '/img/logo.svg'; }} // 降级处理
        />
    </>
);

// 顶栏导航项。子路由（如 /tools/gacha）同样高亮父级入口。
// tone 用于个别需要差异化文字色的入口（如职员面板）。
const NAV_ITEMS = [
    { href: '/pages', label: '页面' },
    { href: '/authors', label: '作者' },
    { href: '/tools', label: '工具' },
];
const NAV_ITEMS_TAIL = [
    { href: '/forums', label: '论坛' },
    { href: '/about', label: '关于' },
];
const STAFF_ITEM = { href: '/staff-panel', label: '职员面板', tone: 'text-primary-600 dark:text-primary-500' };
const DEFAULT_TONE = 'text-zinc-600 dark:text-zinc-300';

const Header = () => {
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [username, setUsername] = useState(null);
    const [isStaff, setIsStaff] = useState(false);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    // null = 尚未挂载（服务端/首帧），挂载后以 <html> 实际类名为准
    const [theme, setTheme] = useState(null);

    const isChosen = (href) =>
        router.pathname === href || router.pathname.startsWith(href + '/');

    const navItems = isStaff
        ? [...NAV_ITEMS, STAFF_ITEM, ...NAV_ITEMS_TAIL]
        : [...NAV_ITEMS, ...NAV_ITEMS_TAIL];

    // _document.js 的内联脚本已在首屏前应用主题，这里直接读取实际状态
    useEffect(() => {
        setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }, []);

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        localStorage.setItem('theme', next);
        document.documentElement.classList.toggle('dark', next === 'dark');
    };

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
        }

        fetch('/api/user', { credentials: 'include' })
            .then(res => res.json())
            .then(me => {
                if (me && (me.isStaff || me.isAdmin)) {
                    setIsStaff(true);
                }
            })
            .catch(() => {});

        fetch('/api/admin/broadcast')
            .then(res => res.json())
            .then(data => {
                if (data && data.message) {
                    setBroadcastMsg(data.message);
                }
            })
            .catch(console.error);
    }, []);

    // 退出登录逻辑
    const handleLogout = async () => {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        }).catch(() => {});
        localStorage.removeItem('username');
        localStorage.removeItem('token');
        setUsername(null);
        window.location.reload();
    };

    return (
        <>
            {/* 全站紧急广播横幅 */}
            {broadcastMsg && (
                <div className="bg-red-600/90 backdrop-blur-sm px-4 py-2.5 text-center text-sm font-bold text-white shadow-md flex items-center justify-center gap-3 z-50 relative border-b border-red-500">
                    <i className="fa-solid fa-triangle-exclamation animate-pulse text-yellow-300"></i>
                    <span className="tracking-wide">{broadcastMsg}</span>
                    <i className="fa-solid fa-triangle-exclamation animate-pulse text-yellow-300"></i>
                </div>
            )}

            <header className="relative bg-zinc-100/80 dark:bg-zinc-900/75 backdrop-blur-md after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-zinc-200 dark:after:bg-zinc-700 sticky top-0 z-40">
                <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
                    <div className="relative flex h-16 items-center justify-between">
                        <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                            <button
                                type="button"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="relative inline-flex items-center justify-center rounded-md p-2 text-fg-2 hover:bg-sunken hover:text-fg transition-colors"
                            >
                                <span className="absolute -inset-0.5"></span>
                                <span className="sr-only">打开顶栏</span>
                                {isMobileMenuOpen ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="size-6">
                                        <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="size-6">
                                        <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <div className="h-full flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                            <Link href="/" className="flex shrink-0 items-center gap-2.5">
                                <HighDefLogoSVG className="h-10 w-10 drop-shadow-md" />
                                <span className="font-bold text-zinc-900 dark:text-white text-lg tracking-wide">
                                    <svg viewBox="-2 -2 254.05 92.5" xmlns="http://www.w3.org/2000/svg" className="h-[2.5rem]">
                                        <g id="svgGroup" stroke-linecap="round" fill-rule="nonzero" fill="currentColor" stroke="currentColor" stroke-width="0.5">
                                            <path d="M27.750 18.900L27.750 52.200C27.750 58.950 27 61.800 21.675 61.800C16.350 61.800 15.600 58.950 15.600 52.200L15.600 18.900L4.500 18.900L4.500 58.800C4.500 66.300 11.100 72.300 19.950 72.300C25.725 72.300 29.400 70.725 33.300 66.525C37.200 70.725 40.875 72.300 46.650 72.300C55.500 72.300 62.100 66.300 62.100 58.800L62.100 18.900L51 18.900L51 52.200C51 58.950 50.250 61.800 44.925 61.800C39.600 61.800 38.850 58.950 38.850 52.200L38.850 18.900ZM79.800 71.400L79.800 34.950L70.200 34.950L70.200 71.400ZM75 18.000C71.775 18.000 69.300 20.175 69.300 24.075C69.300 27.975 71.775 30.150 75 30.150C78.225 30.150 80.700 27.975 80.700 24.075C80.700 20.175 78.225 18.000 75 18.000ZM96.675 71.400L96.675 56.550L102.150 56.550C105.825 56.550 107.925 58.200 107.925 63.000L107.925 71.400L117.525 71.400L117.525 62.175C117.525 55.275 115.575 51.750 108.375 50.475L108.375 50.250C111.225 49.650 112.275 48.150 114.450 43.425L118.275 34.950L107.550 34.950L103.800 43.425C102.675 45.975 101.025 47.250 99.450 47.250L96.675 47.250L96.675 18.900L87.075 18.900L87.075 71.400ZM133.950 71.400L133.950 34.950L124.350 34.950L124.350 71.400ZM129.150 18.000C125.925 18.000 123.450 20.175 123.450 24.075C123.450 27.975 125.925 30.150 129.150 30.150C132.375 30.150 134.850 27.975 134.850 24.075C134.850 20.175 132.375 18.000 129.150 18.000ZM149.925 34.950L149.925 25.200L140.325 25.200L140.325 58.050C140.325 66.150 143.025 71.400 151.875 71.400L156.900 71.400L156.900 61.800L153.225 61.800C151.275 61.800 149.925 60.450 149.925 57.750L149.925 44.250L156.900 44.250L156.900 34.950ZM173.925 71.400L173.925 29.400L178.575 29.400C187.350 29.400 194.775 35.100 194.775 45.525C194.775 53.100 188.175 60.900 180.225 60.900L177.075 60.900L177.075 71.400L180.225 71.400C194.175 71.400 205.875 61.050 205.875 45.600C205.875 28.500 191.775 18.900 181.575 18.900L162.825 18.900L162.825 71.400ZM222.750 71.400L222.750 35.700C222.750 30.600 225.300 28.500 228.900 28.500C232.425 28.500 234.450 31.050 234.450 34.350C234.450 38.025 232.050 39.825 228.300 39.825L225.525 39.825L225.525 48.975L230.700 48.975C233.775 48.975 236.400 50.550 236.400 55.050C236.400 58.425 234.600 60.900 231.450 60.900L225.525 60.900L225.525 71.400L233.175 71.400C241.950 71.400 247.500 64.725 247.500 56.025C247.500 50.625 245.250 45.825 240.300 43.350C243.750 41.250 245.550 37.275 245.550 33.300C245.550 24.300 238.575 18.000 229.725 18.000C219.300 18.000 212.250 23.475 212.250 36.750L212.250 71.400Z" />
                                        </g>
                                    </svg>
                                </span>
                            </Link>
                            <div className="hidden sm:ml-6 sm:block h-full">
                                <div className="flex space-x-4 items-center h-full">
                                    {navItems.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            aria-current={isChosen(item.href) ? 'page' : undefined}
                                            className={`${styles.headerButton} ${isChosen(item.href) ? styles.chosen : ''} relative inline-flex h-full items-center justify-center px-3 py-2 text-sm tracking-[.35rem] font-medium ${item.tone || DEFAULT_TONE} hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors`}
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 移动端主题切换（顶栏右端） */}
                        <div className="flex items-center sm:hidden">
                            <button
                                type="button"
                                onClick={toggleTheme}
                                aria-label="切换明暗主题"
                                className="rounded-md p-2 w-9 text-fg-2 hover:text-fg transition-colors"
                            >
                                {theme && <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-lg`}></i>}
                            </button>
                        </div>

                        <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
                            <button
                                type="button"
                                onClick={toggleTheme}
                                aria-label="切换明暗主题"
                                title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
                                className="rounded-md p-2 w-9 text-fg-2 hover:text-fg transition-colors"
                            >
                                {theme && <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-lg`}></i>}
                            </button>
                            {username ? (
                                <>
                                    <span className="text-sm font-medium text-fg-2">{username}</span>
                                    <button
                                        onClick={handleLogout}
                                        className="rounded-md bg-sunken dark:bg-panel px-3 py-2 text-sm font-medium text-fg-2 hover:bg-panel dark:hover:bg-raised transition-colors"
                                    >
                                        退出
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link href="/login" className="text-sm font-medium text-fg-2 hover:text-fg transition-colors">登录</Link>
                                    <Link href="/register" className="rounded-md bg-accent-solid px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-solid-hover transition-all shadow-md hover:shadow-violet-500/20">注册</Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} sm:hidden border-t border-line`} id="mobile-menu">
                    <div className="space-y-1 px-2 pt-2 pb-3 bg-white dark:bg-canvas">
                        <div className="grid grid-cols-2 gap-2">
                            <Link href="/pages" className="rounded-md px-3 py-2 text-sm font-medium text-fg-2 hover:bg-sunken hover:text-fg">
                                <i className="fa-solid fa-file"></i> 页面
                            </Link>
                            {/* ... 其他链接同理 ... */}
                            <Link href="/authors" className="rounded-md px-3 py-2 text-sm font-medium text-fg-2 hover:bg-sunken hover:text-fg">
                                <i className="fa-solid fa-user"></i> 作者
                            </Link>
                            <Link href="/tools" className="rounded-md px-3 py-2 text-sm font-medium text-fg-2 hover:bg-sunken hover:text-fg">
                                <i className="fa-solid fa-toolbox"></i> 工具
                            </Link>
                            {isStaff && (
                                <Link href="/staff-panel" className="rounded-md px-3 py-2 text-sm font-medium text-accent hover:text-accent-hover">
                                    <i className="fa-solid fa-user-shield"></i> 职员面板
                                </Link>
                            )}
                            <Link href="/forums" className="rounded-md px-3 py-2 text-sm font-medium text-fg-2 hover:bg-sunken hover:text-fg">
                                <i className="fa-solid fa-comments"></i> 论坛
                            </Link>
                            <Link href="/about" className="rounded-md px-3 py-2 text-sm font-medium text-fg-2 hover:bg-sunken hover:text-fg">
                                <i className="fa-solid fa-circle-info"></i> 关于
                            </Link>
                        </div>

                        <div className="mt-4 border-t border-line pt-4 pb-2">
                            {username ? (
                                <div className="flex items-center justify-between px-3">
                                    <span className="text-sm font-medium text-fg-3">当前用户：{username}</span>
                                    <button
                                        onClick={handleLogout}
                                        className="rounded-md bg-panel px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-solid-hover transition-colors"
                                    >
                                        退出
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <Link href="/login" className="text-center rounded-md border border-line-strong px-3 py-2 text-sm font-medium text-fg-3 hover:bg-sunken">
                                        登录
                                    </Link>
                                    <Link href="/register" className="text-center rounded-md bg-accent-solid px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-solid-hover">
                                        注册
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
