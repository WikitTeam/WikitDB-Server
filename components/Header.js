import React, { useState, useEffect } from 'react';
const config = require('../wikitdb.config.js');

// 高清矢量 Logo 组件
const HighDefLogoSVG = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className}>
        <g transform="translate(10,10)">
            <path d="M0 0 L 20 0 L 15 25 L 0 20 Z" fill="#34747B" />
            <path d="M 25 -5 L 45 5 L 40 30 L 25 25 L 20 20 Z" fill="#1C3D6A" />
            <path d="M 30 35 L 50 45 L 45 70 L 30 65 L 25 60 Z" fill="#E0524F" />
            <circle cx="65" cy="20" r="3" fill="#9CA3AF" />
            <circle cx="65" cy="40" r="3" fill="#9CA3AF" />
            <circle cx="65" cy="60" r="3" fill="#9CA3AF" />
        </g>
    </svg>
);

const Header = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [username, setUsername] = useState(null);
    const [broadcastMsg, setBroadcastMsg] = useState('');

    // 页面加载时从本地存储读取用户名，并拉取全站广播
    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
        }

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

            <header className="relative bg-gray-800/50 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white/10">
                <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
                    <div className="relative flex h-16 items-center justify-between">
                        <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                            <button
                                type="button"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white"
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
                                <span className="font-bold text-white text-lg tracking-wide">{config.SITE_NAME}</span>
                            </a>
                            <div className="hidden sm:ml-6 sm:block">
                                <div className="flex space-x-4 items-center h-full">
                                    <a href="/pages" className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white">
                                        <i className="fa-solid fa-file"></i> 页面
                                    </a>
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
                            </div>
                        </div>

                        <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
                            {username ? (
                                <>
                                    <span className="text-sm font-medium text-gray-300">{username}</span>
                                    <button
                                        onClick={handleLogout}
                                        className="rounded-md bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors"
                                    >
                                        退出
                                    </button>
                                </>
                            ) : (
                                <>
                                    <a href="/login" className="text-sm font-medium text-gray-300 hover:text-white">登录</a>
                                    <a href="/register" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">注册</a>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} sm:hidden`} id="mobile-menu">
                    <div className="space-y-1 px-2 pt-2 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                            <a href="/pages" className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white">
                                <i className="fa-solid fa-file"></i> 页面
                            </a>
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
