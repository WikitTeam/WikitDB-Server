// pages/tools/author-stock.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import TradingChart from '../../components/TradingChart';

export default function AuthorStock() {
    // 默认设为 null，等待从本地存储读取
    const [username, setUsername] = useState(null);
    const [selectedAuthor, setSelectedAuthor] = useState('Laimu_slime');
    const [chartData, setChartData] = useState([]);
    
    const [userBalance, setUserBalance] = useState(0);
    const [userPosition, setUserPosition] = useState(0);
    const [tradeAmount, setTradeAmount] = useState(10);

    // 组件挂载时，自动从本地读取真实登录状态
    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
            fetchUserData(storedUsername); // 拿到用户名后，去拉取他的真实余额
        }
    }, []);

    // 独立拉取用户余额和持仓的函数
    const fetchUserData = async (uname) => {
        try {
            // 这里我们复用一下获取用户信息的方法，或者直接让后端在查价时顺带返回
            // 为了简单，我们先通过查一下某作者股份来顺带拿到余额
            const res = await fetch('/api/trade/author', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: uname, 
                    authorName: selectedAuthor, 
                    action: 'query' // 假设后端支持纯查询操作
                })
            });
            const data = await res.json();
            if (res.ok) {
                setUserBalance(data.newBalance || 10000);
                setUserPosition(data.newPosition || 0);
            }
        } catch (error) {
            console.error("加载账户数据失败", error);
        }
    };

    // 监听作者变化时，重新拉取K线和该作者的持仓
    useEffect(() => {
        const fetchStockData = async () => {
            if (!selectedAuthor) return;
            try {
                const res = await fetch(`/api/trade/author-kline?author=${encodeURIComponent(selectedAuthor)}`);
                const result = await res.json();
                if (result.data) {
                    setChartData(result.data);
                }
            } catch (error) {
                console.error("加载图表数据失败", error);
            }
        };

        const delayDebounceFn = setTimeout(() => {
            fetchStockData();
            if (username) fetchUserData(username);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [selectedAuthor, username]);

    const handleBuy = async () => {
        if (!username) {
            alert('请先登录后再进行交易！');
            return;
        }
        if (chartData.length === 0) return;
        
        const amountNum = Number(tradeAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert('请输入有效的买入股数');
            return;
        }
        
        try {
            const res = await fetch('/api/trade/author', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, // 提交本地存储中真实的用户名
                    authorName: selectedAuthor, 
                    action: 'buy', 
                    amount: amountNum 
                })
            });
            const data = await res.json();
            
            if (res.ok) {
                setUserBalance(data.newBalance);
                setUserPosition(data.newPosition);
                alert(`成功买入 ${amountNum} 股！成交均价: ¥${data.executedPrice.toFixed(2)}`);
            } else {
                alert(data.error || '买入失败');
            }
        } catch (error) {
            alert('网络错误，请稍后再试');
        }
    };

    const handleSell = async () => {
        if (!username) {
            alert('请先登录后再进行交易！');
            return;
        }
        if (chartData.length === 0 || userPosition <= 0) return;
        
        const amountNum = Number(tradeAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert('请输入有效的卖出股数');
            return;
        }

        if (amountNum > userPosition) {
            alert(`持仓不足，你当前只有 ${userPosition} 股`);
            return;
        }
        
        try {
            const res = await fetch('/api/trade/author', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, // 提交本地存储中真实的用户名
                    authorName: selectedAuthor, 
                    action: 'sell', 
                    amount: amountNum 
                })
            });
            const data = await res.json();
            
            if (res.ok) {
                setUserBalance(data.newBalance);
                setUserPosition(data.newPosition);
                alert(`成功卖出 ${amountNum} 股！成交均价: ¥${data.executedPrice.toFixed(2)}`);
            } else {
                alert(data.error || '卖出失败');
            }
        } catch (error) {
            alert('网络错误，请稍后再试');
        }
    };

    return (
        <>
            <Head>
                <title>作者概念股 - WikitDB</title>
            </Head>

            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">作者概念股交易中心</h1>
                        <p className="mt-2 text-gray-400 text-sm">在这里投资你认为有潜力的创作者。股价与发文量、存活率挂钩。</p>
                    </div>
                    <div className="text-right">
                        {username ? (
                            <>
                                <div className="text-gray-400 text-sm">操作账户: <span className="text-gray-200">{username}</span></div>
                                <div className="text-2xl font-mono text-green-400">¥{userBalance.toFixed(2)}</div>
                            </>
                        ) : (
                            <div className="text-red-400 font-bold border border-red-900/50 bg-red-900/20 px-4 py-2 rounded-lg">
                                未登录，请先在顶栏登录
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 bg-gray-800/40 rounded-xl border border-gray-700 p-6 flex flex-col h-[500px]">
                        
                        <div className="space-y-4 mb-4">
                            {/* 删除了之前的交易账户输入框 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">搜索作者档案</label>
                                <input 
                                    type="text" 
                                    value={selectedAuthor}
                                    onChange={(e) => setSelectedAuthor(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center space-y-4 my-2">
                            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-400">当前持有</span>
                                    <span className="text-white font-mono font-bold">{userPosition} 股</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">最新报价</span>
                                    <span className="text-blue-400 font-mono font-bold">
                                        ¥{chartData.length > 0 ? chartData[chartData.length - 1].close.toFixed(2) : '0.00'}
                                    </span>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">交易数量 (股)</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={tradeAmount}
                                    onChange={(e) => setTradeAmount(e.target.value)}
                                    disabled={!username}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-auto">
                            <button 
                                onClick={handleBuy}
                                disabled={!username}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                买入看涨
                            </button>
                            <button 
                                onClick={handleSell}
                                disabled={!username}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                抛售平仓
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-gray-800/40 rounded-xl border border-gray-700 p-4 h-[500px]">
                        {chartData.length > 0 ? (
                            <TradingChart data={chartData} isCandle={true} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                正在查询数据或该作者暂无图表...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
