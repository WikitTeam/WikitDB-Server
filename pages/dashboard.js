import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const config = require('../wikitdb.config.js');

// 独立的持仓卡片组件 (内部自动获取实时现价并计算盈亏)
const TradeCard = ({ trade, onSettled }) => {
    const [currentPrice, setCurrentPrice] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const openPrice = 100; // 基准发行价
    const leverage = parseInt(trade.leverage) || 1;

    useEffect(() => {
        if (trade.status === 'open') {
            fetch(`https://wikit.unitreaty.org/module/data-source?site=${trade.site}&page=${trade.pageId}`)
                .then(res => res.json())
                .then(data => {
                    setCurrentPrice(100 + (data.rating || 0));
                })
                .catch(() => setCurrentPrice(openPrice));
        } else {
            setCurrentPrice(openPrice + (trade.realizedPnl / (trade.margin * leverage) * openPrice));
        }
    }, [trade]);

    // 计算盈亏 (简化版逻辑：价格变动比例 * 保证金 * 杠杆)
    let pnl = 0;
    if (currentPrice !== null) {
        const priceDiff = trade.direction === 'long' ? (currentPrice - openPrice) : (openPrice - currentPrice);
        const ratio = priceDiff / openPrice;
        pnl = trade.margin * leverage * ratio;
    }

    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-500' : 'text-red-500';
    const bgColor = isProfit ? 'bg-green-500/10' : 'bg-red-500/10';

    const handleClose = async () => {
        if (!confirm('确定要按当前价格平仓吗？')) return;
        setIsLoading(true);
        const username = localStorage.getItem('username');

        try {
            const res = await fetch('/api/trade/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, tradeId: trade.id, realizedPnl: pnl })
            });
            if (res.ok) {
                onSettled();
            } else {
                const data = await res.json();
                alert(data.error || '平仓失败');
            }
        } catch (e) {
            alert('网络错误');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-500 transition-colors shadow-lg flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${trade.direction === 'long' ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-red-500 border-red-500/30 bg-red-500/10'}`}>
                            {trade.direction === 'long' ? '做多 LONG' : '做空 SHORT'} · {trade.leverage}
                        </span>
                        <div className="text-gray-500 text-xs mt-2 uppercase tracking-widest">{trade.site}</div>
                    </div>
                    {trade.status === 'open' ? (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">持仓中</span>
                    ) : (
                        <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">已平仓</span>
                    )}
                </div>

                <Link href={`/page?site=${trade.site}&page=${trade.pageId}`} className="text-lg font-bold text-white hover:text-blue-400 transition-colors line-clamp-2 leading-tight mb-4">
                    {trade.pageTitle || trade.pageId}
                </Link>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="text-gray-500 text-xs mb-1">开仓价 / 现价</div>
                        <div className="font-mono text-sm text-gray-300">
                            {openPrice.toFixed(2)} <i className="fa-solid fa-arrow-right mx-1 text-gray-600"></i> 
                            <span className="text-white font-bold">{currentPrice !== null ? currentPrice.toFixed(2) : '...'}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs mb-1">投入保证金</div>
                        <div className="font-mono text-sm font-bold text-white">{trade.margin.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-end">
                <div>
                    <div className="text-gray-500 text-xs mb-1">{trade.status === 'open' ? '当前浮动盈亏' : '最终实现盈亏'}</div>
                    <div className={`font-mono text-lg font-black ${pnlColor}`}>
                        {isProfit ? '+' : ''}{trade.status === 'open' ? pnl.toFixed(2) : trade.realizedPnl.toFixed(2)}
                    </div>
                </div>
                
                {trade.status === 'open' && (
                    <button 
                        onClick={handleClose}
                        disabled={isLoading || currentPrice === null}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors shadow-lg"
                    >
                        {isLoading ? '结算中...' : '平仓'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default function Dashboard() {
    const router = useRouter();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('positions'); // positions | gacha | history

    const fetchData = async () => {
        const username = localStorage.getItem('username');
        if (!username) {
            router.push('/login');
            return;
        }

        try {
            const res = await fetch(`/api/dashboard?username=${encodeURIComponent(username)}`);
            if (res.ok) {
                const data = await res.json();
                setUserData(data);
            }
        } catch (e) {
            console.error('获取数据失败', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">读取档案中...</div>;
    if (!userData) return <div className="min-h-screen bg-gray-950 text-red-500 flex items-center justify-center">数据异常</div>;

    const openTrades = userData.trades.filter(t => t.status === 'open');
    const closedTrades = userData.trades.filter(t => t.status === 'closed');
    const totalMargin = openTrades.reduce((sum, t) => sum + t.margin, 0);

    const getRarityColor = (rarity) => {
        switch(rarity) {
            case 'SSR': return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
            case 'SR': return 'text-purple-400 border-purple-500/50 bg-purple-500/10';
            case 'R': return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
            default: return 'text-gray-400 border-gray-600 bg-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white pb-16">
            <Head>
                <title>个人控制台 - {config.SITE_NAME}</title>
            </Head>

            {/* 顶部多巴胺看板 */}
            <div className="bg-gray-900 border-b border-gray-800 pt-16 pb-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                        <i className="fa-solid fa-wallet text-blue-500"></i> 我的资产控制台
                    </h1>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl shadow-inner">
                            <div className="text-gray-400 text-sm font-medium mb-2 uppercase tracking-widest">账户可用余额</div>
                            <div className="text-4xl font-black font-mono text-white">
                                {userData.balance.toFixed(2)}
                            </div>
                        </div>
                        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl shadow-inner">
                            <div className="text-gray-400 text-sm font-medium mb-2 uppercase tracking-widest">持仓锁定保证金</div>
                            <div className="text-4xl font-black font-mono text-gray-300">
                                {totalMargin.toFixed(2)}
                            </div>
                        </div>
                        <div className="bg-blue-900/20 border border-blue-800/50 p-6 rounded-2xl shadow-inner">
                            <div className="text-blue-400 text-sm font-medium mb-2 uppercase tracking-widest">总计平仓次数</div>
                            <div className="text-4xl font-black font-mono text-blue-400">
                                {closedTrades.length}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 导航与内容区 */}
            <div className="max-w-6xl mx-auto px-6 mt-8">
                <div className="flex space-x-8 border-b border-gray-800 mb-8">
                    <button onClick={() => setActiveTab('positions')} className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'positions' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                        当前持仓 ({openTrades.length})
                    </button>
                    <button onClick={() => setActiveTab('gacha')} className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'gacha' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
                        盲盒图鉴 ({userData.gachas.length})
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'history' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}>
                        已平仓历史
                    </button>
                </div>

                {/* 选项卡内容 */}
                {activeTab === 'positions' && (
                    <div>
                        {openTrades.length === 0 ? (
                            <div className="text-center py-20 text-gray-600 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
                                <i className="fa-solid fa-box-open text-4xl mb-4 opacity-50"></i>
                                <p>当前没有任何持仓订单</p>
                                <Link href="/" className="text-blue-500 hover:underline mt-2 inline-block">去大盘看看</Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {openTrades.map(trade => (
                                    <TradeCard key={trade.id} trade={trade} onSettled={fetchData} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'gacha' && (
                    <div>
                        {userData.gachas.length === 0 ? (
                            <div className="text-center py-20 text-gray-600 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
                                <p>图鉴空空如也</p>
                                <Link href="/tools/gacha" className="text-purple-500 hover:underline mt-2 inline-block">去抽第一发盲盒</Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {userData.gachas.map(item => (
                                    <Link key={item.id} href={`/page?site=${item.site}&page=${item.pageId}`} className={`block aspect-[3/4] rounded-xl border p-4 flex flex-col justify-between transition-transform hover:-translate-y-1 hover:shadow-xl ${getRarityColor(item.rarity)}`}>
                                        <div className="flex justify-between">
                                            <span className="font-black italic">{item.rarity}</span>
                                        </div>
                                        <div className="text-center">
                                            <h3 className="font-bold text-white text-sm line-clamp-3">{item.title}</h3>
                                        </div>
                                        <div className="text-xs opacity-70 text-center font-mono">
                                            SCORE: {item.score}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div>
                        {closedTrades.length === 0 ? (
                            <div className="text-center py-20 text-gray-600">没有历史交易记录</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60 hover:opacity-100 transition-opacity">
                                {closedTrades.map(trade => (
                                    <TradeCard key={trade.id} trade={trade} onSettled={fetchData} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
