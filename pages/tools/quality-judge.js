// pages/tools/quality-judge.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';

const PageTradeCard = ({ pageData, username, onTradeSuccess }) => {
    const [direction, setDirection] = useState('long');
    const [margin, setMargin] = useState(100);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [statusType, setStatusType] = useState(''); 

    const handleSubmit = async () => {
        if (!username) {
            setMessage('请先在顶栏登录');
            setStatusType('error');
            return;
        }
        
        const marginNum = Number(margin);
        if (isNaN(marginNum) || marginNum <= 0) {
            setMessage('请输入有效的金额');
            setStatusType('error');
            return;
        }

        setIsSubmitting(true);
        setMessage('');

        try {
            const res = await fetch('/api/trade/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username, // 强制使用系统读取的真实用户名
                    site: pageData.wiki,
                    pageId: pageData.page,
                    pageTitle: pageData.title,
                    direction,
                    lockType: 'none',
                    margin: marginNum,
                    leverage: 1
                })
            });

            const data = await res.json();
            
            if (!res.ok) {
                setMessage(data.error || '开仓失败');
                setStatusType('error');
            } else {
                setMessage('开仓成功！');
                setStatusType('success');
                onTradeSuccess(data.newBalance); // 通知父组件更新全局余额
            }
        } catch (error) {
            setMessage('网络错误，请检查接口');
            setStatusType('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gray-800/40 rounded-xl border border-gray-700 p-5 flex flex-col justify-between hover:border-gray-500 transition-colors shadow-lg">
            <div className="mb-4">
                <div className="text-white font-bold text-lg leading-snug break-all mb-2 line-clamp-2" title={pageData.title}>
                    {pageData.title}
                </div>
                <div className="flex gap-3 text-xs text-gray-400 font-mono">
                    <span className="bg-gray-900/80 px-2 py-1 rounded border border-gray-700">站点: {pageData.wiki}</span>
                    <span className="bg-blue-900/20 text-blue-400 px-2 py-1 rounded border border-blue-900/50">当前评分: {pageData.rating}</span>
                </div>
            </div>
            
            <div className="flex gap-3 mb-4 mt-auto">
                <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">方向</label>
                    <select 
                        value={direction}
                        onChange={(e) => setDirection(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                    >
                        <option value="long">做多 (看涨)</option>
                        <option value="short">做空 (看跌)</option>
                    </select>
                </div>
                <div className="flex-1 relative">
                    <label className="block text-xs text-gray-500 mb-1">保证金 (¥)</label>
                    <input 
                        type="number" 
                        min="1"
                        value={margin}
                        onChange={(e) => setMargin(e.target.value)}
                        disabled={!username}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm font-mono disabled:bg-gray-800 disabled:text-gray-500"
                        placeholder="金额"
                    />
                </div>
            </div>

            <button 
                onClick={handleSubmit}
                disabled={isSubmitting || !username}
                className={`w-full py-2.5 rounded-lg font-bold text-white text-sm transition-colors ${
                    !username ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                    isSubmitting ? 'bg-gray-600 cursor-not-allowed' : 
                    direction === 'long' ? 'bg-green-600 hover:bg-green-500 shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 
                    'bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]'
                }`}
            >
                {!username ? '未登录' : isSubmitting ? '正在提交...' : direction === 'long' ? '确认买入 (做多)' : '确认买入 (做空)'}
            </button>

            {message && (
                <div className={`mt-3 text-xs p-2.5 rounded-lg font-medium ${
                    statusType === 'success' ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-red-900/30 text-red-400 border border-red-800/50'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default function QualityJudge() {
    const [recentPages, setRecentPages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [username, setUsername] = useState(null);
    const [userBalance, setUserBalance] = useState(0);

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
            // 复用 author 接口的 query 功能去拉取真实余额
            fetch('/api/trade/author', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: storedUsername, authorName: 'System', action: 'query' })
            })
            .then(res => res.json())
            .then(data => {
                if(data.newBalance !== undefined) setUserBalance(data.newBalance);
            })
            .catch(console.error);
        }

        const fetchRecentPages = async () => {
            try {
                const query = {
                    query: `
                        query {
                            articles(page: 1, pageSize: 12) {
                                nodes {
                                    wiki
                                    page
                                    title
                                    rating
                                }
                            }
                        }
                    `
                };
                const res = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(query)
                });
                const result = await res.json();
                if (result.data && result.data.articles) {
                    setRecentPages(result.data.articles.nodes);
                }
            } catch (error) {
                console.error("拉取页面列表失败", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecentPages();
    }, []);

    return (
        <>
            <Head>
                <title>页面质量评断 (打新) - WikitDB</title>
            </Head>

            <div className="flex flex-col gap-6 pb-12">
                <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">页面质量评断与打新</h1>
                        <p className="mt-2 text-gray-400 text-sm">自动抓取各站最新发布的页面。在信息流中快速做多或做空未来的评分。</p>
                    </div>
                    
                    <div className="text-right hidden md:block">
                        {username ? (
                            <>
                                <div className="text-gray-400 text-sm">操作账户: <span className="text-gray-200">{username}</span></div>
                                <div className="text-2xl font-mono text-cyan-400">¥{userBalance.toFixed(2)}</div>
                            </>
                        ) : (
                            <div className="text-red-400 font-bold border border-red-900/50 bg-red-900/20 px-4 py-2 rounded-lg">
                                未登录，请先在顶栏登录
                            </div>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-20 text-blue-500 gap-3 font-mono">
                        正在接入全网节点拉取最新页面数据...
                    </div>
                ) : recentPages.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        暂无最新页面数据
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {recentPages.map((pageData) => (
                            <PageTradeCard 
                                key={`${pageData.wiki}-${pageData.page}`} 
                                pageData={pageData} 
                                username={username} 
                                onTradeSuccess={(newBal) => setUserBalance(newBal)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
