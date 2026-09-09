import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

const config = require('../wikitdb.config.js');

const AuthorActivityChart = dynamic(() => import('../components/AuthorActivityChart'), {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center text-sm text-fg-3">正在加载图表引擎...</div>
});

// 评分正负的功能色（沿用全站惯例），零值为弱化文字
const ratingColor = (v) =>
    v > 0 ? 'text-emerald-600 dark:text-emerald-500'
        : v < 0 ? 'text-red-600 dark:text-red-500'
            : 'text-fg-3';

const fmtSigned = (v) => (v > 0 ? `+${v}` : `${v}`);

// 统计小指标：值加载前显示占位符
const Stat = ({ label, value, valueClass = 'text-fg' }) => (
    <div className="min-w-0">
        <div className={`truncate font-mono text-lg font-semibold tabular-nums ${valueClass}`}>
            {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
        </div>
        <div className="mt-0.5 text-xs text-fg-3">{label}</div>
    </div>
);

// 区块小标题：图标 + 文案
const GroupTitle = ({ icon, children }) => (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-sunken text-[10px] text-fg-2">
            <i className={`fa-solid ${icon}`}></i>
        </span>
        {children}
    </h3>
);

// 面板标题行：面板顶部的标题 + 右侧可选操作区
const PanelHeader = ({ icon, children, extra }) => (
    <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-sunken text-[10px] text-fg-2">
                <i className={`fa-solid ${icon}`}></i>
            </span>
            {children}
        </h3>
        {extra}
    </div>
);

// 分页按钮（与 pages.js 吸顶工具栏同款）
const PagerButton = ({ icon, label, disabled, onClick }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
        className="flex h-8 w-8 items-center justify-center rounded border border-line bg-panel text-xs text-fg-2 transition-colors hover:border-line-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
    >
        <i className={`fa-solid ${icon}`}></i>
    </button>
);

// 排名徽章：前三名奖牌色，其余弱化
const RankBadge = ({ rank }) => {
    const cls =
        rank === 1 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : rank === 2 ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300'
                : rank === 3 ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                    : 'text-fg-3';
    return (
        <span className={`flex h-6 w-6 items-center justify-center rounded-sm font-mono text-xs font-semibold ${cls}`}>
            {rank}
        </span>
    );
};

const AuthorProfile = () => {
    const router = useRouter();
    const { name, search } = router.query;

    const [searchInput, setSearchInput] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('global');
    const [filterSite, setFilterSite] = useState('all');

    const [rankingCache, setRankingCache] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    useEffect(() => {
        if (!router.isReady) return;

        if (name) {
            setSearchInput(name);
            fetchAuthorData(name);
        } else {
            setData(null);

            if (search) {
                setSearchInput(search);
            } else if (!search && !name) {
                setSearchInput('');
            }

            if (!rankingCache[activeTab]) {
                fetchRankingData(activeTab);
            }
        }
    }, [router.isReady, name, search, activeTab]);

    const fetchAuthorData = async (authorName) => {
        setLoading(true);
        setError(null);
        setData(null);
        setFilterSite('all');

        try {
            const res = await fetch(`/api/authors?name=${encodeURIComponent(authorName)}`);
            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.details || result.error || '请求失败');
            }

            if (result.pages && result.pages.length > 0) {
                result.pages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }

            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchRankingData = async (tabParam) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/ranking?site=${tabParam}`);
            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.details || result.error || '获取排行榜失败');
            }

            setRankingCache(prev => ({
                ...prev,
                [tabParam]: result.ranking
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const query = searchInput.trim();
        if (query) {
            router.push(`/authors?search=${encodeURIComponent(query)}`, undefined, { shallow: true });
        } else {
            router.push(`/authors`, undefined, { shallow: true });
        }
    };

    const handleTabClick = (tabParam) => {
        setActiveTab(tabParam);
        setCurrentPage(1);
    };

    const currentRankingList = rankingCache[activeTab] || [];

    let displayedRankingList = currentRankingList;
    if (!name && search) {
        const lowerSearch = search.toLowerCase();
        displayedRankingList = currentRankingList.filter(author =>
            (author.name || '').toLowerCase().includes(lowerSearch)
        );
    }

    const totalPages = Math.ceil(displayedRankingList.length / pageSize);
    const paginatedList = displayedRankingList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const siteCounts = {};
    if (data && data.pages) {
        data.pages.forEach(page => {
            siteCounts[page.wiki] = (siteCounts[page.wiki] || 0) + 1;
        });
    }

    const displayedPages = data && data.pages ? (
        filterSite === 'all'
            ? data.pages
            : data.pages.filter(page => page.wiki === filterSite)
    ) : [];

    return (
        <>
            <Head>
                <title>{data ? `${data.name} 的主页 - ${config.SITE_NAME}` : `作者查询与排行 - ${config.SITE_NAME}`}</title>
            </Head>

            <div className="py-10">
                <div className="max-w-5xl mx-auto px-2 sm:px-0">
                    {/* 页头：标题 + 作者搜索 */}
                    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-fg">
                                {name ? '作者信息' : search ? '搜索结果' : '作者排行'}
                            </h1>
                            <p className="mt-2 text-sm text-fg-3">
                                {name ? '跨站点聚合的作者档案与活动数据。' : '按站点浏览活跃作者的评分排行，或搜索作者查看完整档案。'}
                            </p>
                        </div>
                        <form onSubmit={handleSearch} className="relative w-full shrink-0 sm:w-72">
                            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg-3"></i>
                            <input
                                type="text"
                                placeholder="输入 Wikidot 用户名..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="w-full rounded border border-line bg-panel py-2 pl-9 pr-16 text-sm text-fg transition-colors placeholder:text-fg-3 focus:border-accent-line focus:outline-none"
                            />
                            <button
                                type="submit"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-accent-solid px-2.5 py-1 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-solid-hover"
                            >
                                搜索
                            </button>
                        </form>
                    </header>

                    {error && (
                        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
                            <i className="fa-solid fa-circle-exclamation mr-2"></i>检索失败：{error}
                        </div>
                    )}

                    {/* 加载骨架（仅作者档案模式；排行榜模式的骨架放在下方站点按钮之后） */}
                    {name && loading && (
                        <div className="animate-pulse space-y-4" aria-hidden="true">
                            <div className="h-24 rounded-lg border border-line bg-panel"></div>
                            <div className="h-72 rounded-lg border border-line bg-panel"></div>
                        </div>
                    )}

                    {data && !loading && (
                        <div className="space-y-6">
                            {/* 档案头：头像 + 关键指标 */}
                            <section className="rounded-lg border border-line bg-panel p-4 sm:p-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                    <img
                                        src={data.avatar || 'https://www.wikidot.com/local--favicon/favicon.gif'}
                                        alt={data.name}
                                        className="h-16 w-16 shrink-0 rounded border border-line bg-sunken object-cover"
                                        onError={(e) => { e.target.src = 'https://www.wikidot.com/local--favicon/favicon.gif'; }}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate text-2xl font-bold text-fg">{data.name}</h2>
                                        <p className="mt-1 text-xs text-fg-3">数据同步自 Wikit GraphQL 数据库</p>
                                    </div>
                                    <div className="flex flex-wrap gap-6 border-t border-line pt-3 sm:border-0 sm:pt-0">
                                        <Stat label="全局排名" value={`#${data.globalRank}`} />
                                        <Stat label="页面总数" value={data.totalPages} />
                                        <Stat label="累计评分" value={fmtSigned(data.totalRating)} valueClass={ratingColor(data.totalRating)} />
                                        <Stat label="平均评分" value={fmtSigned(data.averageRating)} valueClass={ratingColor(data.averageRating)} />
                                    </div>
                                </div>
                            </section>

                            {/* 归属资料 */}
                            {data.attribution && data.attribution.pages > 0 && (
                                <div className="flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4 text-sm leading-relaxed text-emerald-700 dark:text-emerald-400">
                                    <i className="fa-solid fa-id-card mt-0.5 shrink-0"></i>
                                    <p>
                                        归属资料登记名下 <span className="font-semibold">{data.attribution.pages}</span> 个归属页面，
                                        归属总评分 <span className="font-semibold">{fmtSigned(data.attribution.score)}</span>
                                        （平均 {fmtSigned(data.attribution.average)}）。
                                    </p>
                                </div>
                            )}

                            {/* 站点数据分布 */}
                            {data.siteStats && data.siteStats.length > 0 && (
                                <section>
                                    <GroupTitle icon="fa-server">站点数据分布</GroupTitle>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {data.siteStats.map((site, index) => {
                                            const siteConfig = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === site.wiki || w.NAME === site.wiki);
                                            const siteName = siteConfig ? siteConfig.NAME : site.wiki;
                                            return (
                                                <div key={index} className="rounded-lg border border-line bg-panel p-4">
                                                    <div className="mb-2 truncate text-sm font-medium text-fg" title={siteName}>{siteName}</div>
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex justify-between"><span className="text-fg-3">站点排名</span><span className="font-mono font-medium text-fg">#{site.rank}</span></div>
                                                        <div className="flex justify-between"><span className="text-fg-3">页面总数</span><span className="font-mono text-fg">{site.count}</span></div>
                                                        <div className="flex justify-between"><span className="text-fg-3">站点总分</span><span className={`font-mono font-medium ${ratingColor(site.rating)}`}>{fmtSigned(site.rating)}</span></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* 归属站点分数分布 */}
                            {data.attribution && data.attribution.sites && data.attribution.sites.length > 0 && (
                                <section>
                                    <GroupTitle icon="fa-id-card">归属站点分数分布（来自站点归属资料页）</GroupTitle>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {data.attribution.sites.map((site, index) => (
                                            <div key={index} className="rounded-lg border border-emerald-600/25 bg-panel p-4">
                                                <div className="mb-2 truncate text-sm font-medium text-emerald-700 dark:text-emerald-400" title={site.siteName}>{site.siteName}</div>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between"><span className="text-fg-3">归属页面</span><span className="font-mono text-fg">{site.pages}</span></div>
                                                    <div className="flex justify-between"><span className="text-fg-3">归属总分</span><span className={`font-mono font-medium ${ratingColor(site.score)}`}>{fmtSigned(site.score)}</span></div>
                                                    <div className="flex justify-between"><span className="text-fg-3">平均</span><span className={`font-mono font-medium ${ratingColor(site.average)}`}>{fmtSigned(site.average)}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* 作者活力图 */}
                            {data.pages && data.pages.length > 0 && (
                                <section className="overflow-hidden rounded-lg border border-line bg-panel">
                                    <PanelHeader icon="fa-chart-line">作者活力图</PanelHeader>
                                    <div className="h-[280px] w-full p-4">
                                        <AuthorActivityChart pages={data.pages} />
                                    </div>
                                </section>
                            )}

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                {/* 最喜欢的作者 */}
                                <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel">
                                    <PanelHeader icon="fa-heart">最喜欢的作者</PanelHeader>
                                    {data.favoriteAuthors && data.favoriteAuthors.length > 0 ? (
                                        <ul className="flex-1 divide-y divide-line">
                                            {data.favoriteAuthors.slice(0, 10).map((author, idx) => {
                                                const maxScore = data.favoriteAuthors[0].positiveVotes;
                                                const percentage = Math.max(5, (author.positiveVotes / maxScore) * 100);
                                                return (
                                                    <li key={idx} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sunken">
                                                        <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-fg-3">#{author.rank}</span>
                                                        <Link
                                                            href={`/authors?name=${encodeURIComponent(author.name)}`}
                                                            className="w-28 shrink-0 truncate text-sm font-medium text-fg transition-colors hover:text-accent"
                                                        >
                                                            {author.name}
                                                        </Link>
                                                        <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-sunken">
                                                            <div
                                                                className="h-full border-r-2 border-accent bg-accent-soft transition-all duration-500"
                                                                style={{ width: `${percentage}%` }}
                                                            ></div>
                                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 font-mono text-[10px] tabular-nums text-fg-2">
                                                                +{author.positiveVotes} / -{author.negativeVotes}
                                                            </span>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <div className="flex flex-1 items-center justify-center p-10 text-xs text-fg-3">
                                            数据源暂时不可用（Wikit 接口超时或异常）
                                        </div>
                                    )}
                                </section>

                                {/* 最近的投票 */}
                                <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel">
                                    <PanelHeader icon="fa-square-poll-vertical">最近的投票</PanelHeader>
                                    {data.voteRecords && data.voteRecords.length > 0 ? (
                                        <ul className="max-h-[350px] flex-1 divide-y divide-line overflow-y-auto">
                                            {data.voteRecords.map((vote, idx) => {
                                                const voteLabel = vote.type === 'cancel' ? '撤票' : vote.new === 1 ? '+1' : vote.new === -1 ? '-1' : vote.type;
                                                const isUp = vote.new === 1;
                                                const isCancel = vote.type === 'cancel';
                                                const badgeCls = isCancel
                                                    ? 'bg-sunken text-fg-3'
                                                    : isUp
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                                                        : 'bg-red-500/10 text-red-600 dark:text-red-500';
                                                const timeStr = vote.time ? new Date(vote.time).toLocaleDateString('zh-CN') : '';
                                                const siteConfig = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === vote.wiki);
                                                const siteParam = siteConfig ? siteConfig.PARAM : vote.wiki;
                                                return (
                                                    <li key={idx} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-sunken">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <span className={`shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-xs font-semibold ${badgeCls}`}>
                                                                {voteLabel}
                                                            </span>
                                                            <Link
                                                                href={`/page?site=${siteParam}&page=${encodeURIComponent(vote.page)}`}
                                                                className="truncate text-sm font-medium text-fg transition-colors hover:text-accent"
                                                            >
                                                                {vote.title || vote.page}
                                                            </Link>
                                                        </div>
                                                        <span className="shrink-0 font-mono text-xs tabular-nums text-fg-3">{timeStr}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <div className="flex flex-1 items-center justify-center p-10 text-xs text-fg-3">
                                            数据源暂时不可用（Wikit 接口超时或异常）
                                        </div>
                                    )}
                                </section>
                            </div>

                            {/* 所有发布页面 */}
                            <section className="overflow-hidden rounded-lg border border-line bg-panel">
                                <PanelHeader
                                    icon="fa-file-lines"
                                    extra={Object.keys(siteCounts).length > 0 && (
                                        <select
                                            value={filterSite}
                                            onChange={(e) => setFilterSite(e.target.value)}
                                            className="cursor-pointer rounded border border-line bg-panel px-2 py-1.5 text-sm text-fg transition-colors focus:border-accent-line focus:outline-none"
                                        >
                                            <option value="all">全站总览</option>
                                            {Object.entries(siteCounts).map(([wikiId, count]) => {
                                                const siteConfig = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === wikiId || (w.URL && w.URL.includes(wikiId)));
                                                const siteName = siteConfig ? siteConfig.NAME : wikiId;
                                                return (
                                                    <option key={wikiId} value={wikiId}>
                                                        {siteName}（{count} 篇）
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    )}
                                >
                                    所有发布页面
                                    <span className="text-xs font-normal text-fg-3">（按创建时间倒序）</span>
                                </PanelHeader>

                                {displayedPages.length > 0 ? (
                                    <ul className="divide-y divide-line">
                                        {displayedPages.map((page, index) => {
                                            const siteConfig = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === page.wiki || (w.URL && w.URL.includes(page.wiki)));
                                            const siteParam = siteConfig ? siteConfig.PARAM : page.wiki;

                                            const dateStr = page.created_at && page.created_at.includes('T')
                                                ? page.created_at.split('T')[0]
                                                : (page.created_at || '未知时间');

                                            return (
                                                <li key={index} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sunken">
                                                    <div className="min-w-0 flex-1">
                                                        <Link
                                                            href={`/page?site=${siteParam}&page=${encodeURIComponent(page.page)}`}
                                                            className="block truncate text-sm font-medium text-fg transition-colors hover:text-accent"
                                                        >
                                                            {page.title || page.page}
                                                        </Link>
                                                        <div className="mt-0.5 truncate font-mono text-xs text-fg-3">
                                                            {dateStr} · {page.wiki}
                                                        </div>
                                                    </div>
                                                    <span className={`w-14 shrink-0 text-right font-mono text-sm font-medium tabular-nums ${ratingColor(page.rating)}`}>
                                                        {fmtSigned(page.rating)}
                                                    </span>
                                                    <a
                                                        href={`http://${page.wiki}.wikidot.com/${page.page}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="在原站打开"
                                                        aria-label="在原站打开"
                                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line text-fg-3 transition-colors hover:border-accent-line hover:text-accent"
                                                    >
                                                        <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                                                    </a>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <div className="p-10 text-center text-sm text-fg-3">
                                        该站点下未找到任何页面。
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    {!name && (
                        <div className="space-y-4">
                            {/* 站点选择 chip 组 */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleTabClick('global')}
                                    aria-pressed={activeTab === 'global'}
                                    className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition-colors ${
                                        activeTab === 'global'
                                            ? 'border-accent-line bg-accent-soft font-medium text-accent'
                                            : 'border-line bg-panel text-fg-2 hover:border-line-strong hover:text-fg'
                                    }`}
                                >
                                    <i className="fa-solid fa-globe text-xs"></i>
                                    全站总排行
                                </button>

                                {config.SUPPORT_WIKI.map((site) => {
                                    const active = activeTab === site.PARAM;
                                    return (
                                        <button
                                            key={site.PARAM}
                                            onClick={() => handleTabClick(site.PARAM)}
                                            aria-pressed={active}
                                            className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition-colors ${
                                                active
                                                    ? 'border-accent-line bg-accent-soft font-medium text-accent'
                                                    : 'border-line bg-panel text-fg-2 hover:border-line-strong hover:text-fg'
                                            }`}
                                        >
                                            <img
                                                src={site.ImgURL}
                                                alt=""
                                                aria-hidden="true"
                                                className="h-4 w-4 object-contain"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                            {site.NAME}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 排行加载骨架：位于站点按钮组下方，占据原吸顶工具栏 + 排行表格的位置 */}
                            {loading && (
                                <div className="animate-pulse space-y-4" aria-hidden="true">
                                    <div className="h-11 rounded-lg border border-line bg-panel"></div>
                                    <div className="h-80 rounded-lg border border-line bg-panel"></div>
                                </div>
                            )}

                            {/* 吸顶工具栏：匹配信息 + 计数 + 分页 */}
                            {!loading && displayedRankingList.length > 0 && (
                                <div className="sticky top-16 z-30 flex items-center justify-between gap-4 rounded-lg border border-line bg-panel px-4 py-2.5">
                                    <span className="truncate font-mono text-xs tabular-nums text-fg-3">
                                        {search ? (
                                            <>匹配 <span className="text-accent">{search}</span> · {displayedRankingList.length} 人</>
                                        ) : (
                                            <>共 {displayedRankingList.length} 位活跃作者</>
                                        )}
                                    </span>
                                    {totalPages > 1 && (
                                        <div className="flex shrink-0 items-center gap-2">
                                            <PagerButton
                                                icon="fa-chevron-left"
                                                label="上一页"
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            />
                                            <span className="font-mono text-xs tabular-nums text-fg-2">
                                                {currentPage} / {totalPages}
                                            </span>
                                            <PagerButton
                                                icon="fa-chevron-right"
                                                label="下一页"
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 排行表格 */}
                            {!loading && (
                                <div className="overflow-hidden rounded-lg border border-line bg-panel">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead>
                                                <tr className="border-b border-line text-xs text-fg-3">
                                                    <th className="w-20 px-4 py-2.5 font-medium">排名</th>
                                                    <th className="px-4 py-2.5 font-medium">作者</th>
                                                    <th className="px-4 py-2.5 text-right font-medium">总评分</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-line">
                                                {paginatedList && paginatedList.length > 0 ? (
                                                    paginatedList.map((author, index) => (
                                                        <tr key={index} className="transition-colors hover:bg-sunken">
                                                            <td className="px-4 py-2.5">
                                                                <RankBadge rank={author.rank} />
                                                            </td>
                                                            <td className="px-4 py-2.5 font-medium">
                                                                <Link
                                                                    href={`/authors?name=${encodeURIComponent(author.name)}`}
                                                                    className="text-fg transition-colors hover:text-accent"
                                                                >
                                                                    {author.name}
                                                                </Link>
                                                            </td>
                                                            <td className={`px-4 py-2.5 text-right font-mono font-medium tabular-nums ${ratingColor(author.value)}`}>
                                                                {fmtSigned(author.value)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="3" className="p-16 text-center">
                                                            {search ? (
                                                                <div className="flex flex-col items-center gap-4">
                                                                    <i className="fa-solid fa-user-slash text-2xl text-fg-3"></i>
                                                                    <p className="text-sm text-fg-2">
                                                                        当前排行榜中未找到包含 <span className="font-semibold text-fg">{search}</span> 的活跃作者
                                                                    </p>
                                                                    <button
                                                                        onClick={() => router.push(`/authors?name=${encodeURIComponent(search)}`)}
                                                                        className="rounded border border-accent-line bg-accent-soft px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                                                                    >
                                                                        强制精确查找该作者主页
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-fg-3">暂无排行数据或尚未加载完毕</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {search && displayedRankingList.length > 0 && (
                                        <div className="flex flex-col items-center justify-center gap-2 border-t border-line px-4 py-3 sm:flex-row">
                                            <span className="text-xs text-fg-3">以上没有你想找的作者？</span>
                                            <button
                                                onClick={() => router.push(`/authors?name=${encodeURIComponent(search)}`)}
                                                className="rounded border border-accent-line bg-accent-soft px-3 py-1 text-xs font-medium text-accent transition-colors"
                                            >
                                                精确查找作者
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default AuthorProfile;
