import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TradingChart from '../components/TradingChart';

const config = require('../wikitdb.config.js');

const PageDetail = () => {
    const router = useRouter();
    const { site, page } = router.query;
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('评分');

    const [hpage, setHpage] = useState(1);
    const [maxHpage, setMaxHpage] = useState(1);
    const [historyLoading, setHistoryLoading] = useState(false);

    // 交易面板表单状态
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [tradeDirection, setTradeDirection] = useState('long'); 
    const [margin, setMargin] = useState('');
    const [lockType, setLockType] = useState('T1 (24h)');
    const [leverage, setLeverage] = useState('2x');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userBalance, setUserBalance] = useState(null); // 存储用户余额

    const tabs = ['源码', '信息', '历史', '评分'];

    const fetchPageData = async (signal) => {
        if (!site || !page) return;
        setLoading(true);
        setError(null);
        
        try {
            const apiUrl = `/api/page?site=${site}&page=${encodeURIComponent(page)}&hpage=${hpage}`;
            const fetchOptions = signal ? { signal } : {};
            const res = await fetch(apiUrl, fetchOptions);
            const result = await res.json();
            
            if (!res.ok) {
                throw new Error(result.details || result.error || '请求失败');
            }
            
            if (!signal || !signal.aborted) {
                setData(result);
                if (result.maxHistoryPage) setMaxHpage(result.maxHistoryPage);
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            if (!signal || !signal.aborted) {
                setError(err.message);
            }
        } finally {
            if (!signal || !signal.aborted) {
                setLoading(false);
            }
        }
    };

    const loadHistoryPage = async (newPage) => {
        if (newPage < 1 || newPage > maxHpage || newPage === hpage) return;
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/page?site=${site}&page=${encodeURIComponent(page)}&hpage=${newPage}`);
            const result = await res.json();
            if (res.ok) {
                setData(prev => ({ ...prev, historyHtml: result.historyHtml }));
                setHpage(newPage);
                if (result.maxHistoryPage) setMaxHpage(result.maxHistoryPage);
            }
        } catch (err) {
            console.error(err);
        }
        setHistoryLoading(false);
    };

    useEffect(() => {
        if (!router.isReady) return;
        
        const controller = new AbortController();
        fetchPageData(controller.signal);
        
        return () => {
            controller.abort();
        };
    }, [router.isReady, site, page]);

    const handleOpenTradeModal = async () => {
        const username = localStorage.getItem('username');
        if (!username) {
            alert('请先登录后再进行交易操作');
            router.push('/login');
            return;
        }

        // 打开弹窗时查询余额
        try {
            const res = await fetch(`/api/user?username=${encodeURIComponent(username)}`);
            if (res.ok) {
                const resData = await res.json();
                setUserBalance(resData.balance);
            } else {
                setUserBalance(0);
            }
        } catch (e) {
            setUserBalance(0);
        }

        setIsTradeModalOpen(true);
    };

    const handleTradeSubmit = async () => {
        const username = localStorage.getItem('username');
        if (!username) {
            alert('请先登录再操作开仓');
            router.push('/login');
            return;
        }

        const marginNum = Number(margin);
        if (!margin || isNaN(marginNum) || marginNum <= 0) {
            alert('请输入有效的保证金金额');
            return;
        }

        // 前端拦截余额不足
        const totalCost = marginNum * 1.01;
        if (userBalance !== null && totalCost > userBalance) {
            alert(`余额不足！开仓需要 ${totalCost.toFixed(2)}，当前可用 ${userBalance.toFixed(2)}`);
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    site,
                    pageId: page,
                    pageTitle: data.title,
                    direction: tradeDirection,
                    lockType,
                    margin,
                    leverage
                })
            });

            const result = await res.json();

            if (res.ok) {
                alert('开仓成功！交易已记录。');
                setIsTradeModalOpen(false);
                setMargin(''); 
            } else {
                alert(result.error || '开仓失败了');
            }
        } catch (err) {
            alert('提交请求时发生错误');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="py-12 text-center text-gray-400">正在接入大盘数据...</div>;
    }

    if (error) {
        return (
            <div className="py-12 text-center">
                <div className="text-red-400 mb-4">数据接入失败: {error}</div>
                <button onClick={() => router.back()} className="text-indigo-400 hover:text-indigo-300">返回上一页</button>
            </div>
        );
    }

    if (!data) return null;

    let chartData = [];
    let markers = [];

    if (data.scoreHistory && data.scoreHistory.length > 0) {
        chartData = data.scoreHistory.map((item, index, arr) => {
            let timeValue = item.date;
            if (timeValue === '初始记录' || timeValue === '开仓') {
                timeValue = data.scoreHistory[1]?.date || new Date().toISOString().split('T')[0];
            }

            const currentScore = 100 + item.score;
            const prevScore = index === 0 ? 100 : 100 + arr[index - 1].score;

            return {
                time: timeValue,
                value: currentScore, 
                open: prevScore,     
                close: currentScore, 
                high: Math.max(prevScore, currentScore) + 0.5,
                low: Math.min(prevScore, currentScore) - 0.5,
            };
        });

        markers = [
            {
                time: chartData[chartData.length - 1].time,
                position: 'belowBar',
                color: '#16a34a',
                shape: 'arrowUp',
                text: '做多',
            }
        ];
    }

    const marginAmount = Number(margin) || 0;
    const estFee = marginAmount * 0.01;
    const totalDeduct = marginAmount + estFee;

    return (
        <>
            <Head>
                <title>{`${data.title} - ${config.SITE_NAME}`}</title>
            </Head>

            {isTradeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl m-4">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                            开仓 <span className="text-gray-500 font-normal ml-2 text-base truncate max-w-[200px]">{data.title}</span>
                        </h2>
                        
                        <div className="flex gap-4 mb-6">
                            <button
                                onClick={() => setTradeDirection('long')}
                                className={`flex-1 py-2.5 rounded-lg border-2 font-bold transition-colors ${
                                    tradeDirection === 'long' 
                                        ? 'border-green-600 text-green-700 bg-green-50' 
                                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                做多
                            </button>
                            <button
                                onClick={() => setTradeDirection('short')}
                                className={`flex-1 py-2.5 rounded-lg border-2 font-bold transition-colors ${
                                    tradeDirection === 'short' 
                                        ? 'border-red-500 text-red-600 bg-red-50' 
                                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                做空
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                                <label className="block text-sm text-gray-500 mb-1.5">锁仓</label>
                                <select 
                                    value={lockType}
                                    onChange={(e) => setLockType(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm"
                                >
                                    <option value="T1 (24h)">T1 (24h)</option>
                                    <option value="T3 (72h)">T3 (72h)</option>
                                    <option value="T7 (168h)">T7 (168h)</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-sm text-gray-500">保证金</label>
                                    <span className="text-xs font-bold text-blue-600">
                                        可用: {userBalance !== null ? userBalance.toFixed(2) : '--'}
                                    </span>
                                </div>
                                <input 
                                    type="number" 
                                    value={margin}
                                    onChange={(e) => setMargin(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                                    placeholder="输入金额"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-500 mb-1.5">杠杆</label>
                                <select 
                                    value={leverage}
                                    onChange={(e) => setLeverage(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm"
                                >
                                    <option value="2x">2x</option>
                                    <option value="5x">5x</option>
                                    <option value="10x">10x</option>
                                </select>
                            </div>
                        </div>

                        <div className="text-sm text-gray-500 mb-8 mt-4 flex justify-between bg-gray-50 p-2 rounded">
                            <span>预估手续费 (1%): <strong className="text-gray-700">{estFee.toFixed(2)}</strong></span>
                            <span>总扣除: <strong className={totalDeduct > (userBalance || 0) ? 'text-red-500' : 'text-blue-600'}>{totalDeduct.toFixed(2)}</strong></span>
                        </div>

                        <div className="flex justify-end gap-3 mt-4">
                            <button 
                                onClick={() => setIsTradeModalOpen(false)} 
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleTradeSubmit} 
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors shadow-lg disabled:opacity-50"
                            >
                                {isSubmitting ? '处理中...' : '确认开仓'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="py-4">
                <div className="mb-4 text-sm text-gray-400">
                    页面详情
                </div>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 bg-gray-800/50 p-4 rounded-xl border border-white/10">
                    <div className="flex items-start gap-4">
                        <div className="mt-1 h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center overflow-hidden border border-gray-700 shrink-0">
                            {data.siteImg && <img src={data.siteImg} alt="site logo" className="h-8 w-8 object-contain" />}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white break-all">{data.title}</h1>
                            
                            <div className="mt-3 flex flex-col gap-2 text-sm text-gray-400">
                                {data.tags && data.tags.length > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-gray-500 shrink-0">页面标签:</span>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {data.tags.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 bg-gray-700/50 rounded text-gray-300 border border-gray-600/30">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-x-6 gap-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">创建者:</span>
                                        <div className="flex items-center text-indigo-400">
                                            {data.creatorAvatar && (
                                                <img src={data.creatorAvatar} alt="avatar" className="w-4 h-4 rounded-full mr-1.5 object-cover" />
                                            )}
                                            {data.creatorName}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">原网页最后更新:</span>
                                        <span>{data.lastUpdated}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">页面评分:</span>
                                        <div className="flex items-center">
                                            <span className={`font-medium ${data.rating && data.rating.toString().includes('+') ? 'text-red-500' : data.rating && data.rating.toString().includes('-') ? 'text-green-500' : 'text-gray-300'}`}>
                                                {data.rating}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                        <a 
                            href={data.originalUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
                        >
                            <i className="fa-solid fa-arrow-up-right-from-square mr-1"></i> 在原站打开
                        </a>
                        <button 
                            onClick={() => fetchPageData()}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                        >
                            <i className="fa-solid fa-rotate-right mr-1"></i> 刷新数据
                        </button>
                        <button 
                            onClick={() => router.back()}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                        >
                            <i className="fa-solid fa-arrow-left mr-1"></i> 返回
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors">
                        编辑
                    </button>
                    <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30 transition-colors">
                        强制覆盖
                    </button>
                    <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors">
                        删除
                    </button>
                </div>

                <div className="border-b border-gray-700 mb-6">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab
                                        ? 'border-indigo-500 text-indigo-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="bg-gray-800/30 rounded-xl p-6 border border-white/5 min-h-[400px]">
                    {activeTab === '源码' && (
                        <div className="bg-gray-900 p-4 rounded-lg overflow-x-auto border border-gray-700">
                            <div 
                                className="text-gray-300 text-sm whitespace-pre-wrap font-mono break-all"
                                dangerouslySetInnerHTML={{ __html: data.sourceCode }}
                            />
                        </div>
                    )}

                    {activeTab === '信息' && (
                        <div className="space-y-4 text-gray-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <div className="text-gray-500 text-sm mb-1">页面标题</div>
                                    <div className="font-medium text-white">{data.title}</div>
                                </div>
                                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <div className="text-gray-500 text-sm mb-1">来源站点</div>
                                    <div>{data.siteName}</div>
                                </div>
                                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <div className="text-gray-500 text-sm mb-1">创建者 / 搬运者</div>
                                    <div className="flex items-center">
                                        {data.creatorAvatar && (
                                            <img src={data.creatorAvatar} alt="avatar" className="w-5 h-5 rounded-full mr-2 object-cover" />
                                        )}
                                        {data.creatorName}
                                    </div>
                                </div>
                                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <div className="text-gray-500 text-sm mb-1">原站最后更新时间</div>
                                    <div>{data.lastUpdated}</div>
                                </div>
                            </div>
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <div className="text-gray-500 text-sm mb-1">完整原始链接</div>
                                <a href={data.originalUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline break-all">
                                    {data.originalUrl}
                                </a>
                            </div>
                        </div>
                    )}

                    {activeTab === '历史' && (
                        <div className="space-y-4">
                            <div className="bg-gray-900/50 p-0 rounded-lg overflow-x-auto border border-gray-700 relative">
                                {historyLoading && (
                                    <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center z-10">
                                        <span className="text-gray-300">读取中...</span>
                                    </div>
                                )}
                                <div 
                                    className="w-full text-sm text-gray-300 
                                    [&_table]:w-full [&_table]:text-left [&_table]:border-collapse [&_table]:min-w-max
                                    [&_th]:p-4 [&_th]:font-medium [&_th]:text-gray-400 [&_th]:border-b [&_th]:border-gray-700 [&_th]:bg-gray-800/50
                                    [&_td]:p-4 [&_td]:border-b [&_td]:border-gray-700/50
                                    [&_tr:last-child_td]:border-b-0
                                    [&_tr:hover_td]:bg-gray-800/80 [&_tr]:transition-colors
                                    [&_img]:inline-block [&_img]:w-5 [&_img]:h-5 [&_img]:rounded-full [&_img]:mr-2 [&_img]:align-middle [&_img]:object-cover [&_img]:border [&_img]:border-gray-600
                                    [&_a]:text-indigo-400 [&_a:hover]:text-indigo-300 [&_a]:transition-colors"
                                    dangerouslySetInnerHTML={{ __html: data.historyHtml }}
                                />
                            </div>
                            <div className="flex flex-wrap justify-between items-center bg-gray-900/30 p-3 rounded-lg border border-gray-700 gap-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button 
                                        onClick={() => loadHistoryPage(hpage - 1)}
                                        disabled={hpage <= 1 || historyLoading}
                                        className="px-3 py-1.5 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        上一页
                                    </button>
                                    
                                    {Array.from({ length: maxHpage || 1 }, (_, i) => i + 1).map(pageNum => (
                                        <button
                                            key={pageNum}
                                            onClick={() => loadHistoryPage(pageNum)}
                                            disabled={historyLoading}
                                            className={`px-3 py-1.5 text-sm rounded transition-colors ${
                                                hpage === pageNum
                                                    ? 'bg-indigo-600 text-white cursor-default'
                                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}

                                    <button 
                                        onClick={() => loadHistoryPage(hpage + 1)}
                                        disabled={historyLoading || hpage >= (maxHpage || 1)}
                                        className="px-3 py-1.5 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        下一页
                                    </button>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm">共 {maxHpage || 1} 页，跳至</span>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max={maxHpage || 1}
                                        className="w-16 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-indigo-500"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val)) loadHistoryPage(val);
                                            }
                                        }}
                                        id="pageJumpInput"
                                    />
                                    <button 
                                        onClick={() => {
                                            const val = parseInt(document.getElementById('pageJumpInput').value);
                                            if (!isNaN(val)) loadHistoryPage(val);
                                        }}
                                        disabled={historyLoading}
                                        className="px-3 py-1.5 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        跳转
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === '评分' && (
                        <div className="space-y-6">
                            {chartData.length > 1 ? (
                                <div className="w-full bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1 tracking-wider uppercase">{data.title} 的股票</div>
                                            <div className="text-4xl font-bold text-gray-900 leading-none">
                                                {chartData[chartData.length - 1].value.toFixed(4)}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleOpenTradeModal}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full text-sm font-bold transition-colors shadow-md"
                                        >
                                            开仓
                                        </button>
                                    </div>
                                    <div className="w-full h-[320px] relative border border-gray-100 rounded overflow-hidden">
                                        <TradingChart data={chartData} markers={markers} isCandle={false} />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-gray-400 bg-gray-900/50 rounded-lg border border-gray-700">
                                    暂无交易数据，等待大盘开市...
                                </div>
                            )}

                            {data.ratingTable && data.ratingTable.length > 0 && (
                                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
                                    <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                                        原站评分者参考
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {data.ratingTable.map((rate, index) => (
                                            <div key={index} className="flex items-center gap-3 bg-gray-800 p-3 rounded-lg border border-gray-600/50 hover:border-gray-500 transition-colors">
                                                <img 
                                                    src={rate.avatar} 
                                                    alt={rate.user} 
                                                    className="w-8 h-8 rounded object-cover border border-gray-600"
                                                    onError={(e) => { e.target.src = 'https://www.wikidot.com/local--favicon/favicon.gif'; }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-sm font-medium text-indigo-400 truncate block">
                                                        {rate.user}
                                                    </span>
                                                </div>
                                                <span className={`text-sm font-bold px-2 py-0.5 rounded ${rate.vote === '+1' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                                    {rate.vote === '+1' ? '+1' : '-1'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default PageDetail;
