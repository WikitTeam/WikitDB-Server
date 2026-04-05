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
                return 'border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.3)] bg-gradient-to-b from-gray-900 to-yellow-900/40 text-yellow-400';
            case 'SR':
                return 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-gradient-to-b from-gray-900 to-purple-900/40 text-purple-400';
            case 'R':
                return 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-gradient-to-b from-gray-900 to-blue-900/30 text-blue-400';
            case 'N':
            default:
                return 'border-gray-700 bg-gray-800 text-gray-400';
        }
    };

    return (
        <div className="flex flex-col items-center py-8 px-4 w-full">
            <Head>
                <title>页面盲盒机 - {config.SITE_NAME}</title>
            </Head>

            <div className="w-full max-w-2xl flex justify-between items-center mb-12">
                <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
                    <i className="fa-solid fa-arrow-left mr-2"></i> 返回工具箱
                </button>
                <div className="bg-gray-800 border border-gray-700 px-4 py-2 rounded-lg font-mono flex items-center gap-3 shadow">
                    <span className="text-gray-400 text-sm">可用资产</span>
                    <span className="text-white font-bold text-lg">{balance !== null ? balance.toFixed(2) : '---'}</span>
                </div>
            </div>

            <div className="text-center mb-12">
                <h1 className="text-3xl md:text-4xl font-bold tracking-widest mb-4 text-white">
                    数据档案馆盲盒
                </h1>
                <p className="text-gray-400 text-sm">每次抽取消耗 100 资产，随机获取未知页面进行开仓。</p>
            </div>

            <div className="w-full max-w-sm aspect-[3/4] relative perspective-1000 mb-12">
                {!result && !isDrawing && (
                    <div className="absolute inset-0 bg-gray-900 border-2 border-gray-700 rounded-2xl flex items-center justify-center shadow-xl transition-transform duration-500 hover:scale-105">
                        <div className="text-gray-500 flex flex-col items-center">
                            <i className="fa-solid fa-box-open text-6xl mb-4 opacity-50"></i>
                            <span className="tracking-widest font-bold">WIKIT DB</span>
                        </div>
                    </div>
                )}

                {isDrawing && (
                    <div className="absolute inset-0 bg-gray-900 border-2 border-blue-500/50 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)] animate-pulse">
                        <div className="flex flex-col items-center">
                            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-blue-500 mb-4"></i>
                            <span className="text-blue-400 font-bold tracking-widest animate-bounce">检索档案中...</span>
                        </div>
                    </div>
                )}

                {result && !isDrawing && (
                    <div className={`absolute inset-0 border-2 rounded-2xl p-6 flex flex-col justify-between transition-all duration-700 animate-fade-in-up ${getRarityStyle(result.rarity)}`}>
                        <div className="flex justify-between items-start">
                            <span className="text-3xl font-black italic tracking-tighter">{result.rarity}</span>
                            <span className="bg-black/50 px-3 py-1 rounded text-xs font-mono border border-current">
                                SCORE: {result.score}
                            </span>
                        </div>
                        
                        <div className="text-center my-auto">
                            <div className="text-xs uppercase tracking-widest opacity-70 mb-2">{result.site}</div>
                            <h2 className="text-xl md:text-2xl font-bold text-white break-words leading-tight">
                                {result.title}
                            </h2>
                        </div>

                        <div className="flex justify-center">
                            <Link 
                                href={`/page?site=${result.site}&page=${result.pageId}`}
                                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-2 rounded-lg text-sm font-bold transition-colors backdrop-blur-sm"
                            >
                                去开仓炒单
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {error && <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-2 rounded mb-6">{error}</div>}

            <button 
                onClick={handleDraw}
                disabled={isDrawing || (balance !== null && balance < 100)}
                className="bg-gray-800 border border-gray-600 hover:bg-gray-700 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-bold tracking-widest px-12 py-3 rounded-lg shadow-lg transition-all"
            >
                {isDrawing ? '...' : '抽取 1 次 (100)'}
            </button>
        </div>
    );
}
