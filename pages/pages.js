import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../wikitdb.config.js');

// 站点统计小指标：值加载前显示占位符
const Stat = ({ label, value }) => (
    <div className="min-w-0">
        <div className="truncate font-mono text-lg font-semibold tabular-nums text-fg">
            {typeof value === 'number' ? value.toLocaleString() : (value || '—')}
        </div>
        <div className="mt-0.5 text-xs text-fg-3">{label}</div>
    </div>
);

// 吸顶工具栏中的分页按钮
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

const Pages = () => {
    const [selectedSite, setSelectedSite] = useState(config.SUPPORT_WIKI[0]?.PARAM);
    const [searchQuery, setSearchQuery] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // 站点级信息：收录总数取自无关键词检索，作者数据取自排行榜接口
    const [siteStats, setSiteStats] = useState({ total: null, authors: null, topAuthor: null });

    // 控制当前页码
    const [page, setPage] = useState(1);

    const currentWiki = config.SUPPORT_WIKI.find(w => w.PARAM === selectedSite);

    useEffect(() => {
        setSearchQuery('');
        setPage(1);
        setSiteStats({ total: null, authors: null, topAuthor: null });
        executeSearch('', 1);

        fetch(`/api/ranking?site=${selectedSite}`)
            .then(res => res.json())
            .then(d => {
                if (d && Array.isArray(d.ranking)) {
                    setSiteStats(s => ({
                        ...s,
                        authors: d.ranking.length,
                        topAuthor: d.ranking[0]?.name || null,
                    }));
                }
            })
            .catch(() => {});
    }, [selectedSite]);

    const executeSearch = async (queryToSearch = searchQuery, pageNum = page) => {
        setLoading(true);
        setError(null);

        try {
            // 将页码 p 传给后端
            const apiUrl = `/api/search?site=${selectedSite}&q=${encodeURIComponent(queryToSearch)}&p=${pageNum}`;
            const res = await fetch(apiUrl);
            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.details || result.error || '检索请求失败');
            }

            setData(result);
            setPage(result.currentPage);
            // 无关键词的结果总数即站点收录总量
            if (!queryToSearch) {
                setSiteStats(s => ({ ...s, total: result.totalCount }));
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        executeSearch(searchQuery, 1);
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || (data && newPage > data.totalPages)) return;
        setPage(newPage);
        executeSearch(searchQuery, newPage);
        // 翻页后回到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <>
            <Head>
                <title>{`页面检索 - ${config.SITE_NAME}`}</title>
            </Head>

            <div className="py-10">
                <div className="max-w-5xl mx-auto px-2 sm:px-0">
                    {/* 页头 */}
                    <header className="mb-8 flex items-end justify-between border-b border-line pb-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-fg">页面检索</h1>
                            <p className="mt-2 text-sm text-fg-3">检索与浏览各分站已收录的页面数据。</p>
                        </div>
                        <span className="hidden sm:block font-mono text-xs text-fg-3">{config.SUPPORT_WIKI.length} WIKIS</span>
                    </header>

                    {/* 站点选择：紧凑 chip 组 */}
                    <div className="flex flex-wrap gap-2">
                        {config.SUPPORT_WIKI.map((wiki) => {
                            const active = selectedSite === wiki.PARAM;
                            return (
                                <button
                                    key={wiki.PARAM}
                                    onClick={() => setSelectedSite(wiki.PARAM)}
                                    aria-pressed={active}
                                    className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition-colors ${
                                        active
                                            ? 'border-accent-line bg-accent-soft font-medium text-accent'
                                            : 'border-line bg-panel text-fg-2 hover:border-line-strong hover:text-fg'
                                    }`}
                                >
                                    <img
                                        src={wiki.ImgURL}
                                        alt=""
                                        aria-hidden="true"
                                        className="h-4 w-4 object-contain"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                    {wiki.NAME}
                                </button>
                            );
                        })}
                    </div>

                    {/* 站点信息条： logo + 链接 + 站点级统计 */}
                    {currentWiki && (
                        <section className="mt-4 rounded-lg border border-line bg-panel p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-sunken p-1.5">
                                        <img
                                            src={currentWiki.ImgURL}
                                            alt={currentWiki.NAME}
                                            className="max-h-full max-w-full object-contain"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="truncate font-bold text-fg">{currentWiki.NAME}</h2>
                                            <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-fg-3">{currentWiki.PARAM}</span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-3 text-xs">
                                            <a
                                                href={currentWiki.URL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-fg-3 transition-colors hover:text-accent"
                                            >
                                                <i className="fa-solid fa-arrow-up-right-from-square mr-1"></i>Wikidot 原站
                                            </a>
                                            <Link href={`/site/${currentWiki.PARAM}`} className="text-fg-3 transition-colors hover:text-accent">
                                                <i className="fa-solid fa-chart-simple mr-1"></i>站点详情
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-6 border-t border-line pt-3 sm:ml-auto sm:gap-8 sm:border-0 sm:pt-0">
                                    <Stat label="收录页面" value={siteStats.total} />
                                    <Stat label="活跃作者" value={siteStats.authors} />
                                    <Stat label="榜首作者" value={siteStats.topAuthor} />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 吸顶工具栏：搜索 + 计数 + 分页，滚动时始终可达 */}
                    <div className="sticky top-16 z-30 mt-4 rounded-lg border border-line bg-panel p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <form onSubmit={handleSearchSubmit} className="relative flex-1">
                                <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg-3"></i>
                                <input
                                    type="text"
                                    placeholder="输入页面标题或系统名进行搜索..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded border border-line bg-canvas py-2 pl-9 pr-20 text-sm text-fg transition-colors placeholder:text-fg-3 focus:border-accent-line focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-accent-solid px-3 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-solid-hover disabled:opacity-50"
                                >
                                    {loading ? '检索中' : '搜索'}
                                </button>
                            </form>

                            {data && (
                                <div className="flex items-center justify-between gap-4 lg:justify-end">
                                    <span className="font-mono text-xs tabular-nums text-fg-3">
                                        {searchQuery ? '命中' : '共'} {data.totalCount.toLocaleString()} 条
                                    </span>
                                    {data.totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <PagerButton
                                                icon="fa-chevron-left"
                                                label="上一页"
                                                disabled={data.currentPage === 1 || loading}
                                                onClick={() => handlePageChange(data.currentPage - 1)}
                                            />
                                            <span className="font-mono text-xs tabular-nums text-fg-2">
                                                {data.currentPage} / {data.totalPages}
                                            </span>
                                            <PagerButton
                                                icon="fa-chevron-right"
                                                label="下一页"
                                                disabled={data.currentPage === data.totalPages || loading}
                                                onClick={() => handlePageChange(data.currentPage + 1)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 结果列表：单层面板 + 分隔线平铺 */}
                    <div className="mt-4 overflow-hidden rounded-lg border border-line bg-panel">
                        {error && (
                            <div className="p-10 text-center text-sm text-red-600 dark:text-red-400">
                                <i className="fa-solid fa-circle-exclamation mr-2"></i>检索遇到错误：{error}
                            </div>
                        )}

                        {loading && (
                            <ul className="divide-y divide-line" aria-hidden="true">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <li key={i} className="flex animate-pulse items-center gap-4 px-4 py-3">
                                        <div className="h-4 flex-1 rounded bg-sunken"></div>
                                        <div className="h-4 w-12 rounded bg-sunken"></div>
                                        <div className="h-4 w-20 rounded bg-sunken"></div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {data && !loading && (
                            data.results.length > 0 ? (
                                <ul className="divide-y divide-line">
                                    {data.results.map((pageData, index) => {
                                        const dateStr = pageData.created_at?.includes('T')
                                            ? pageData.created_at.split('T')[0]
                                            : (pageData.created_at || '—');
                                        const rating = pageData.rating || 0;
                                        const ratingColor = rating > 0
                                            ? 'text-emerald-600 dark:text-emerald-500'
                                            : rating < 0
                                                ? 'text-red-600 dark:text-red-500'
                                                : 'text-fg-3';
                                        const rowNo = (data.currentPage - 1) * 50 + index + 1;

                                        return (
                                            <li key={pageData.page || index} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sunken sm:gap-4">
                                                <span className="hidden w-10 shrink-0 text-right font-mono text-xs tabular-nums text-fg-3 sm:block">
                                                    {rowNo}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={`/page?site=${selectedSite}&page=${encodeURIComponent(pageData.page)}`}
                                                        className="block truncate text-sm font-medium text-fg transition-colors hover:text-accent"
                                                    >
                                                        {pageData.title || pageData.page}
                                                    </Link>
                                                    <div className="mt-0.5 truncate font-mono text-xs text-fg-3">{pageData.page}</div>
                                                </div>
                                                <span className={`w-14 shrink-0 text-right font-mono text-sm font-medium tabular-nums ${ratingColor}`}>
                                                    {rating > 0 ? `+${rating}` : rating}
                                                </span>
                                                <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-fg-3">
                                                    {dateStr}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div className="p-16 text-center">
                                    <i className="fa-solid fa-inbox text-2xl text-fg-3"></i>
                                    <p className="mt-4 text-sm text-fg-2">
                                        没有找到与 &quot;{searchQuery}&quot; 相关的页面
                                    </p>
                                    <p className="mt-1 text-xs text-fg-3">
                                        尝试使用不同的关键词，或缩短搜索词
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Pages;
