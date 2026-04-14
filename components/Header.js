import React, { useState, useEffect } from 'react';
const config = require('../wikitdb.config.js');

// 高清矢量 Logo 组件
const HighDefLogoSVG = ({ className }) => (
    <img 
        src="/img/logo.svg" 
        alt="Logo" 
        className={className}
        onError={(e) => { e.target.src = '/img/logo.png'; }} // 降级处理
    />
);

const Header = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [username, setUsername] = useState(null);
    const [broadcastMsg, setBroadcastMsg] = useState('');

    // 页面加载时从本地存储读取用户名、全站广播以及强制深色模式
    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
        }

        // 强制深色模式
        document.documentElement.classList.add('dark');

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
    const handleLogout = () => {
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

            <header className="relative bg-white/80 dark:bg-gray-800/50 backdrop-blur-md after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gray-200 dark:after:bg-white/10 sticky top-0 z-40">
                <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
                    <div className="relative flex h-16 items-center justify-between">
                        <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                            <button
                                type="button"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="relative inline-flex items-center justify-center rounded-md p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
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
                        <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                            <a href="/" className="flex shrink-0 items-center gap-2.5">
                                <HighDefLogoSVG className="h-10 w-10 drop-shadow-md" />
                                <span className="font-bold text-gray-900 dark:text-white text-lg tracking-wide">{config.SITE_NAME}</span>
                            </a>
                            <div className="hidden sm:ml-6 sm:block">
                                <div className="flex space-x-4 items-center h-full">
                                    <a href="/pages" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors">
                                        <i className="fa-solid fa-file"></i> 页面
                                    </a>
                                    <a href="/authors" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors">
                                        <i className="fa-solid fa-user"></i> 作者
                                    </a>
                                    <a href="/tools" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors">
                                        <i className="fa-solid fa-toolbox"></i> 工具
                                    </a>
                                    <a href="/about" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors">
                                        <i className="fa-solid fa-circle-info"></i> 关于
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
                            {username ? (
                                <>
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{username}</span>
                                    <button
                                        onClick={handleLogout}
                                        className="rounded-md bg-gray-200 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        退出
                                    </button>
                                </>
                            ) : (
                                <>
                                    <a href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">登录</a>
                                    <a href="/register" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-500/20">注册</a>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} sm:hidden border-t border-gray-100 dark:border-gray-700`} id="mobile-menu">
                    <div className="space-y-1 px-2 pt-2 pb-3 bg-white dark:bg-gray-900">
                        <div className="grid grid-cols-2 gap-2">
                            <a href="/pages" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white">
                                <i className="fa-solid fa-file"></i> 页面
                            </a>
                            {/* ... 其他链接同理 ... */}
                            <a href="/authors" className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white">
                                <i className="fa-solid fa-user"></i> 作者
                            </a>
                            <a href="/tools" className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white">
                                <i className="fa-solid fa-toolbox"></i> 工具
                            </a>
                            <a href="/about" className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white">
                                <i className="fa-solid fa-circle-info"></i> 关于
                            </a>
                        </div>

                        <div className="mt-4 border-t border-gray-700 pt-4 pb-2">
                            {username ? (
                                <div className="flex items-center justify-between px-3">
                                    <span className="text-sm font-medium text-gray-300">当前用户：{username}</span>
                                    <button
                                        onClick={handleLogout}
                                        className="rounded-md bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors"
                                    >
                                        退出
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <a href="/login" className="text-center rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700">
                                        登录
                                    </a>
                                    <a href="/register" className="text-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                                        注册
                                    </a>
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
