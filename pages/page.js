import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TradingChart from '../components/TradingChart';
import WikidotDiscussion from '../components/WikidotDiscussion';

const config = require('../wikitdb.config.js');

const WIKIDOT_DEFAULT_AVATAR = 'https://www.wikidot.com/local--favicon/favicon.gif';

// 描边幽灵按钮（次要操作）
const GhostButton = ({ icon, children, className = '', ...props }) => (
    <button
        {...props}
        className={`flex items-center gap-1.5 rounded border border-line bg-panel px-3 py-1.5 text-sm text-fg-2 transition-colors hover:border-line-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
        {icon && <i className={`fa-solid ${icon} text-xs`}></i>}
        {children}
    </button>
);

const PageDetail = () => {
    const router = useRouter();
    const { site, page } = router.query;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // 默认打开的标签页依然可以保持为 '评分' 或 '信息'
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
    const [userBalance, setUserBalance] = useState(null);

    // 【修改点 1】：在导航栏数组里加上 '讨论'
    const tabs = ['源码', '信息', '历史', '评分', '讨论'];

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
        return (
            <div className="py-10">
                <div className="mx-auto max-w-5xl animate-pulse space-y-4 px-2 sm:px-0" aria-hidden="true">
                    <div className="h-28 rounded-lg border border-line bg-panel"></div>
                    <div className="h-10 w-72 rounded-lg border border-line bg-panel"></div>
                    <div className="h-96 rounded-lg border border-line bg-panel"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-16 text-center">
                <div className="mx-auto max-w-md rounded-lg border border-red-500/30 bg-red-500/5 p-8">
                    <i className="fa-solid fa-circle-exclamation text-2xl text-red-600 dark:text-red-400"></i>
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">数据接入失败：{error}</p>
                    <button onClick={() => router.back()} className="mt-4 text-sm text-accent hover:underline">
                        返回上一页
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    let chartData = [];
    let markers = [];

    if (data.scoreHistory && data.scoreHistory.length > 0) {
        let lastTs = 0;
        chartData = data.scoreHistory.map(item => {
            let ts = Math.floor(new Date(item.time).getTime() / 1000);
            if (ts <= lastTs) {
                ts = lastTs + 1;
            }
            lastTs = ts;
            return {
                time: ts,
                value: item.score,
            };
        });
    }

    const marginAmount = Number(margin) || 0;
    const estFee = marginAmount * 0.01;
    const totalDeduct = marginAmount + estFee;

    // 本页评分展示沿用红=正/绿=负的既有惯例
    const ratingStr = data.rating?.toString() ?? '';
    const ratingCls = ratingStr.includes('+')
        ? 'text-red-600 dark:text-red-500'
        : ratingStr.includes('-')
            ? 'text-emerald-600 dark:text-emerald-500'
            : 'text-fg-2';

    return (
        <>
            <Head>
                <title>{`${data.title} - ${config.SITE_NAME}`}</title>
            </Head>

            {/* 开仓交易弹窗：浮层允许使用 shadow-pop */}
            {isTradeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-lg border border-line bg-raised p-6 shadow-pop">
                        <h2 className="flex items-center text-lg font-bold text-fg">
                            开仓 <span className="ml-2 max-w-[200px] truncate text-base font-normal text-fg-3">{data.title}</span>
                        </h2>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setTradeDirection('long')}
                                className={`flex-1 rounded border py-2.5 font-bold transition-colors ${
                                    tradeDirection === 'long'
                                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                                        : 'border-line text-fg-3 hover:border-line-strong hover:text-fg'
                                }`}
                            >
                                做多
                            </button>
                            <button
                                onClick={() => setTradeDirection('short')}
                                className={`flex-1 rounded border py-2.5 font-bold transition-colors ${
                                    tradeDirection === 'short'
                                        ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-500'
                                        : 'border-line text-fg-3 hover:border-line-strong hover:text-fg'
                                }`}
                            >
                                做空
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs text-fg-3">锁仓</label>
                                <select
                                    value={lockType}
                                    onChange={(e) => setLockType(e.target.value)}
                                    className="w-full cursor-pointer appearance-none rounded border border-line bg-panel p-2.5 text-sm text-fg focus:border-accent-line focus:outline-none"
                                >
                                    <option value="T1 (24h)">T1 (24h)</option>
                                    <option value="T3 (72h)">T3 (72h)</option>
                                    <option value="T7 (168h)">T7 (168h)</option>
                                </select>
                            </div>
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="block text-xs text-fg-3">保证金</label>
                                    <span className="text-xs font-medium text-accent">
                                        可用: {userBalance !== null ? userBalance.toFixed(2) : '--'}
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    value={margin}
                                    onChange={(e) => setMargin(e.target.value)}
                                    className="w-full rounded border border-line bg-panel p-2.5 text-sm text-fg focus:border-accent-line focus:outline-none"
                                    placeholder="输入金额"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs text-fg-3">杠杆</label>
                                <select
                                    value={leverage}
                                    onChange={(e) => setLeverage(e.target.value)}
                                    className="w-full cursor-pointer appearance-none rounded border border-line bg-panel p-2.5 text-sm text-fg focus:border-accent-line focus:outline-none"
                                >
                                    <option value="2x">2x</option>
                                    <option value="5x">5x</option>
                                    <option value="10x">10x</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-between rounded bg-sunken px-3 py-2 text-xs text-fg-2">
                            <span>预估手续费 (1%): <strong className="font-mono text-fg">{estFee.toFixed(2)}</strong></span>
                            <span>总扣除: <strong className={`font-mono ${totalDeduct > (userBalance || 0) ? 'text-red-600 dark:text-red-500' : 'text-accent'}`}>{totalDeduct.toFixed(2)}</strong></span>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setIsTradeModalOpen(false)}
                                disabled={isSubmitting}
                                className="rounded border border-line px-4 py-2 text-sm font-medium text-fg-2 transition-colors hover:bg-sunken disabled:opacity-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleTradeSubmit}
                                disabled={isSubmitting}
                                className="rounded bg-accent-solid px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-solid-hover disabled:opacity-50"
                            >
                                {isSubmitting ? '处理中...' : '确认开仓'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="py-10">
                <div className="mx-auto max-w-5xl px-2 sm:px-0">
                    {/* 页面信息头 */}
                    <section className="rounded-lg border border-line bg-panel p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex min-w-0 items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-sunken p-1.5">
                                    {data.siteImg && <img src={data.siteImg} alt="" aria-hidden="true" className="max-h-full max-w-full object-contain" />}
                                </div>
                                <div className="min-w-0">
                                    <h1 className="break-all text-xl font-bold text-fg sm:text-2xl">{data.title}</h1>

                                    {data.tags && data.tags.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {data.tags.map(tag => (
                                                <span key={tag} className="rounded-sm bg-sunken px-1.5 py-0.5 text-xs text-fg-2">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-fg-3">
                                        <span className="flex items-center gap-1.5">
                                            创建者
                                            <Link
                                                href={`/authors?name=${encodeURIComponent(data.creatorName || '')}`}
                                                className="flex items-center gap-1.5 font-medium text-fg-2 transition-colors hover:text-accent"
                                            >
                                                {data.creatorAvatar && (
                                                    <img
                                                        src={data.creatorAvatar}
                                                        alt=""
                                                        aria-hidden="true"
                                                        className="h-4 w-4 rounded-full object-cover"
                                                        onError={(e) => { e.target.src = WIKIDOT_DEFAULT_AVATAR; }}
                                                    />
                                                )}
                                                {data.creatorName}
                                            </Link>
                                        </span>
                                        <span>原网页最后更新 <span className="font-mono text-fg-2">{data.lastUpdated}</span></span>
                                        <span>
                                            页面评分 <span className={`font-mono font-semibold ${ratingCls}`}>{data.rating}</span>
                                            {data.upvotes != null && data.downvotes != null && !isNaN(data.upvotes) && !isNaN(data.downvotes) && (Number(data.upvotes) > 0 || Math.abs(Number(data.downvotes)) > 0) && (
                                                <span className="ml-1 font-mono text-fg-3">
                                                    (+{Number(data.upvotes)}, -{Math.abs(Number(data.downvotes))})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <a
                                    href={data.originalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 rounded border border-accent-line bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                                >
                                    <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i> 在原站打开
                                </a>
                                <GhostButton icon="fa-rotate-right" onClick={() => fetchPageData()}>刷新数据</GhostButton>
                                <GhostButton icon="fa-arrow-left" onClick={() => router.back()}>返回</GhostButton>
                            </div>
                        </div>
                    </section>

                    {/* 职员操作（占位） */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button className="rounded border border-blue-500/30 bg-blue-500/5 px-3 py-1.5 text-sm text-blue-600 transition-colors hover:bg-blue-500/10 dark:text-blue-400">
                            编辑
                        </button>
                        <button className="rounded border border-orange-500/30 bg-orange-500/5 px-3 py-1.5 text-sm text-orange-600 transition-colors hover:bg-orange-500/10 dark:text-orange-400">
                            强制覆盖
                        </button>
                        <button className="rounded border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-500">
                            删除
                        </button>
                    </div>

                    {/* 选项卡 */}
                    <div className="mt-6 border-b border-line">
                        <nav className="-mb-px flex space-x-6 overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                                        activeTab === tab
                                            ? 'border-accent text-accent'
                                            : 'border-transparent text-fg-3 hover:border-line-strong hover:text-fg'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="mt-4 min-h-[400px] rounded-lg border border-line bg-panel p-6">
                        {activeTab === '源码' && (
                            <div className="overflow-x-auto rounded border border-line bg-sunken p-4">
                                <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-fg-2">
                                    {data.sourceCode}
                                </pre>
                            </div>
                        )}

                        {activeTab === '信息' && (
                            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                                <div>
                                    <dt className="text-xs text-fg-3">页面标题</dt>
                                    <dd className="mt-1 text-sm font-medium text-fg">{data.title}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-fg-3">来源站点</dt>
                                    <dd className="mt-1 text-sm text-fg">{data.siteName}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-fg-3">创建者 / 搬运者</dt>
                                    <dd className="mt-1 flex items-center gap-2 text-sm text-fg">
                                        {data.creatorAvatar && (
                                            <img
                                                src={data.creatorAvatar}
                                                alt=""
                                                aria-hidden="true"
                                                className="h-5 w-5 rounded-full object-cover"
                                                onError={(e) => { e.target.src = WIKIDOT_DEFAULT_AVATAR; }}
                                            />
                                        )}
                                        {data.creatorName}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-fg-3">原站最后更新时间</dt>
                                    <dd className="mt-1 font-mono text-sm text-fg">{data.lastUpdated}</dd>
                                </div>
                                <div className="md:col-span-2">
                                    <dt className="text-xs text-fg-3">完整原始链接</dt>
                                    <dd className="mt-1">
                                        <a
                                            href={data.originalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="break-all font-mono text-xs text-accent transition-colors hover:underline"
                                        >
                                            {data.originalUrl}
                                        </a>
                                    </dd>
                                </div>
                            </dl>
                        )}

                        {activeTab === '历史' && (
                            <div className="space-y-4">
                                <div className="relative overflow-x-auto rounded border border-line">
                                    {historyLoading && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel/70">
                                            <span className="text-sm text-fg-2">读取中...</span>
                                        </div>
                                    )}
                                    <div
                                        className="w-full text-sm text-fg-2
                                        [&_table]:w-full [&_table]:min-w-max [&_table]:border-collapse [&_table]:text-left
                                        [&_th]:border-b [&_th]:border-line [&_th]:bg-sunken [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-fg-3
                                        [&_td]:border-b [&_td]:border-line [&_td]:px-4 [&_td]:py-2.5
                                        [&_tr:last-child_td]:border-b-0
                                        [&_tr:hover_td]:bg-sunken [&_tr]:transition-colors
                                        [&_img]:mr-2 [&_img]:inline-block [&_img]:h-5 [&_img]:w-5 [&_img]:rounded-full [&_img]:border [&_img]:border-line [&_img]:object-cover [&_img]:align-middle
                                        [&_a]:text-accent [&_a:hover]:underline [&_a]:transition-colors"
                                        dangerouslySetInnerHTML={{ __html: data.historyHtml }}
                                    />
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-line bg-panel px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                            onClick={() => loadHistoryPage(hpage - 1)}
                                            disabled={hpage <= 1 || historyLoading}
                                            className="rounded border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-line-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            上一页
                                        </button>

                                        {Array.from({ length: maxHpage || 1 }, (_, i) => i + 1).map(pageNum => (
                                            <button
                                                key={pageNum}
                                                onClick={() => loadHistoryPage(pageNum)}
                                                disabled={historyLoading}
                                                className={`rounded border px-2.5 py-1.5 font-mono text-xs transition-colors ${
                                                    hpage === pageNum
                                                        ? 'cursor-default border-accent-line bg-accent-soft font-medium text-accent'
                                                        : 'border-line text-fg-2 hover:border-line-strong hover:text-fg disabled:opacity-40'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => loadHistoryPage(hpage + 1)}
                                            disabled={historyLoading || hpage >= (maxHpage || 1)}
                                            className="rounded border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-line-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            下一页
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-fg-3">共 {maxHpage || 1} 页，跳至</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max={maxHpage || 1}
                                            className="w-16 rounded border border-line bg-panel px-2 py-1.5 font-mono text-xs text-fg focus:border-accent-line focus:outline-none"
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
                                            className="rounded border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-line-strong hover:text-fg disabled:opacity-40"
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
                                    <div>
                                        <div className="mb-4 flex items-start justify-between">
                                            <div>
                                                <div className="mb-1 text-xs tracking-wider text-fg-3">投票历史</div>
                                                <div className="font-mono text-4xl font-bold leading-none text-fg">
                                                    {data.scoreHistory[data.scoreHistory.length - 1].score}
                                                </div>
                                                <div className="mt-1.5 text-xs text-fg-3">{data.scoreHistory.length} 次投票</div>
                                            </div>
                                            <button
                                                onClick={handleOpenTradeModal}
                                                className="rounded bg-accent-solid px-5 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-solid-hover"
                                            >
                                                开仓
                                            </button>
                                        </div>
                                        <div className="relative h-[320px] w-full overflow-hidden rounded border border-line bg-canvas">
                                            <TradingChart data={chartData} markers={markers} stepLine={true} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded border border-dashed border-line p-10 text-center text-sm text-fg-3">
                                        暂无交易数据，等待大盘开市...
                                    </div>
                                )}

                                {data.ratingTable && data.ratingTable.length > 0 && (
                                    <div>
                                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                                            <span className="flex h-6 w-6 items-center justify-center rounded bg-sunken text-[10px] text-fg-2">
                                                <i className="fa-solid fa-square-poll-vertical"></i>
                                            </span>
                                            评分表
                                            <span className="font-mono text-xs font-normal text-fg-3">{data.ratingTable.length} 人</span>
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {data.ratingTable.map((rate, index) => (
                                                <div key={index} className="flex items-center gap-3 rounded border border-line px-3 py-2 transition-colors hover:border-line-strong">
                                                    <img
                                                        src={rate.avatar}
                                                        alt=""
                                                        aria-hidden="true"
                                                        className="h-8 w-8 shrink-0 rounded border border-line bg-sunken object-cover"
                                                        onError={(e) => { e.target.src = WIKIDOT_DEFAULT_AVATAR; }}
                                                    />
                                                    <Link
                                                        href={`/authors?name=${encodeURIComponent(rate.user)}`}
                                                        className="min-w-0 flex-1 truncate text-sm font-medium text-fg transition-colors hover:text-accent"
                                                    >
                                                        {rate.user}
                                                    </Link>
                                                    <span className={`shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-xs font-semibold ${
                                                        rate.vote === '+1'
                                                            ? 'bg-red-500/10 text-red-600 dark:text-red-500'
                                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                                                    }`}>
                                                        {rate.vote === '+1' ? '+1' : '-1'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 【修改点 2】：把讨论区组件移动到条件渲染框内部，并向上拉回一点外边距消除断层感 */}
                        {activeTab === '讨论' && (
                            <div className="-mt-6">
                                <WikidotDiscussion wiki={site} pageId={page} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default PageDetail;
