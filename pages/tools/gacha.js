import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const config = require('../../wikitdb.config.js');

// 严禁在这里加 async！React 客户端组件不能是 async 函数
export default function Gacha() {
    const router = useRouter();
    const [balance, setBalance] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        // 确保这段代码只在客户端运行，避免 prerender 报错
        if (typeof window !== 'undefined') {
            const username = localStorage.getItem('username');
            if (!username) {
                alert('请先登录再进入抽卡机');
                router.push('/login');
                return;
            }
            fetchBalance(username);
        }
    }, []);

    const fetchBalance = async (username) => {
        try {
            const res = await fetch(`/api/user?username=${encodeURIComponent(username)}`);
            if (res.ok) {
                const data = await res.json();
                setBalance(data.balance);
            }
        } catch (e) {
            console.error('获取余额失败', e);
        }
    };

    const handleDraw = async () => {
        const username = localStorage.getItem('username');
        if (!username) return router.push('/login');

        if (balance !== null && balance < 100) {
            setError('余额不足！快去挂单赚钱吧。');
            return;
        }

        setError('');
        setResult(null);
        setIsDrawing(true);

        try {
            const res = await fetch('/api/tools/gacha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            const data = await res.json();

            if (res.ok) {
                setBalance(data.newBalance);
                setResult(data.result);
            } else {
                setError(data.error || '抽卡失败');
            }
        } catch (err) {
            setError('网络请求失败');
        } finally {
            setIsDrawing(false);
        }
    };

    const getRarityStyle = (rarity) => {
        switch (rarity) {
            case 'SSR':
                return 'border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.3)] bg-gradient-to-b from-panel to-yellow-500/10 text-amber-600 dark:text-amber-400';
            case 'SR':
                return 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-gradient-to-b from-panel to-purple-500/10 text-purple-600 dark:text-purple-400';
            case 'R':
                return 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-gradient-to-b from-panel to-blue-500/10 text-blue-600 dark:text-blue-400';
            case 'N':
            default:
                return 'border-line bg-panel text-fg-3';
        }
    };

    return (
        <div className="flex flex-col items-center py-8 px-4 w-full">
            <Head>
                <title>页面盲盒机 - {config.SITE_NAME}</title>
            </Head>

            <div className="w-full max-w-2xl flex justify-between items-center mb-12">
                <button onClick={() => router.back()} className="text-fg-3 hover:text-fg transition-colors">
                    <i className="fa-solid fa-arrow-left mr-2"></i> 返回工具箱
                </button>
                <div className="bg-panel border border-line px-4 py-2 rounded-lg font-mono flex items-center gap-3 shadow">
                    <span className="text-fg-3 text-sm">可用资产</span>
                    <span className="text-fg font-bold text-lg">{balance !== null ? balance.toFixed(2) : '---'}</span>
                </div>
            </div>

            <div className="text-center mb-12">
                <h1 className="text-3xl md:text-4xl font-bold tracking-widest mb-4 text-fg">
                    数据档案馆盲盒
                </h1>
                <p className="text-fg-3 text-sm">每次抽取消耗 100 资产，随机获取未知页面进行开仓。</p>
            </div>

            <div className="w-full max-w-sm aspect-[3/4] relative perspective-1000 mb-12">
                {!result && !isDrawing && (
                    <div className="absolute inset-0 bg-panel border-2 border-line rounded-2xl flex items-center justify-center shadow-xl transition-transform duration-500 hover:scale-105">
                        <div className="text-fg-3 flex flex-col items-center">
                            <i className="fa-solid fa-box-open text-6xl mb-4 opacity-50"></i>
                            <span className="tracking-widest font-bold">WIKIT DB</span>
                        </div>
                    </div>
                )}

                {isDrawing && (
                    <div className="absolute inset-0 bg-panel border-2 border-accent-line rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)] animate-pulse">
                        <div className="flex flex-col items-center">
                            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-accent mb-4"></i>
                            <span className="text-accent font-bold tracking-widest animate-bounce">检索档案中...</span>
                        </div>
                    </div>
                )}

                {result && !isDrawing && (
                    <div className={`absolute inset-0 border-2 rounded-2xl p-6 flex flex-col justify-between transition-all duration-700 animate-fade-in-up ${getRarityStyle(result.rarity)}`}>
                        <div className="flex justify-between items-start">
                            <span className="text-3xl font-black italic tracking-tighter">{result.rarity}</span>
                            <span className="bg-sunken px-3 py-1 rounded text-xs font-mono border border-current">
                                SCORE: {result.score}
                            </span>
                        </div>
                        
                        <div className="text-center my-auto">
                            <div className="text-xs uppercase tracking-widest opacity-70 mb-2">{result.site}</div>
                            <h2 className="text-xl md:text-2xl font-bold text-fg break-words leading-tight">
                                {result.title}
                            </h2>
                        </div>

                        <div className="flex justify-center">
                            <Link 
                                href={`/page?site=${result.site}&page=${result.pageId}`}
                                className="bg-raised hover:bg-sunken text-fg border border-line px-6 py-2 rounded-lg text-sm font-bold transition-colors backdrop-blur-sm"
                            >
                                去开仓炒单
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {error && <div className="text-red-600 dark:text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-2 rounded mb-6">{error}</div>}

            <button 
                onClick={handleDraw}
                disabled={isDrawing || (balance !== null && balance < 100)}
                className="bg-raised border border-line hover:bg-sunken hover:border-line-strong disabled:opacity-50 disabled:cursor-not-allowed text-fg text-lg font-bold tracking-widest px-12 py-3 rounded-lg shadow-lg transition-all"
            >
                {isDrawing ? '...' : '抽取 1 次 (100)'}
            </button>
        </div>
    );
}
