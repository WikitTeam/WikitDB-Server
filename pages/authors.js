import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

const config = require('../wikitdb.config.js');

const AuthorActivityChart = dynamic(() => import('../components/AuthorActivityChart'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-gray-500 text-sm">加载图表中...</div>
});

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

    useEffect(() => {
        if (!router.isReady) return;
        if (name) {
            setSearchInput(name);
            fetchAuthorData(name);
        } else {
            setData(null);
            if (search) setSearchInput(search);
            else if (!search && !name) setSearchInput('');
            if (!rankingCache[activeTab]) fetchRankingData(activeTab);
        }
    }, [router.isReady, name, search, activeTab]);

    const fetchAuthorData = async (authorName) => {
        setLoading(true); setError(null); setData(null); setFilterSite('all');
        try {
            const res = await fetch(`/api/authors?name=${encodeURIComponent(authorName)}`);
            const result = await res.json();
            if (!res.ok) throw new Error(result.details || result.error || '请求失败');
            if (result.pages?.length > 0) result.pages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setData(result);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const fetchRankingData = async (tabParam) => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/api/ranking?site=${tabParam}`);
            const result = await res.json();
            if (!res.ok) throw new Error(result.details || result.error || '获取排行榜失败');
            setRankingCache(prev => ({ ...prev, [tabParam]: result.ranking }));
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const query = searchInput.trim();
        if (query) router.push(`/authors?search=${encodeURIComponent(query)}`, undefined, { shallow: true });
        else router.push(`/authors`, undefined, { shallow: true });
    };

    const handleTabClick = (tabParam) => setActiveTab(tabParam);

    const currentRankingList = rankingCache[activeTab] || [];
    let displayedRankingList = currentRankingList;
    if (!name && search) {
        const lowerSearch = search.toLowerCase();
        displayedRankingList = currentRankingList.filter(a => (a.name || '').toLowerCase().includes(lowerSearch));
    }

    const siteCounts = {};
    if (data?.pages) data.pages.forEach(p => { siteCounts[p.wiki] = (siteCounts[p.wiki] || 0) + 1; });

    const displayedPages = data?.pages
        ? (filterSite === 'all' ? data.pages : data.pages.filter(p => p.wiki === filterSite))
        : [];

    return (
        <>
            <Head>
                <title>{data ? `${data.name} - ${config.SITE_NAME}` : `作者 - ${config.SITE_NAME}`}</title>
            </Head>

            <div className="py-8 max-w-5xl mx-auto px-4">
                {/* 顶部搜索 */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white mb-4">
                        {name ? '作者信息' : search ? '搜索结果' : '作者排行'}
                    </h1>
                    <form onSubmit={handleSearch} className="relative max-w-md">
                        <input
                            type="text"
                            placeholder="输入 Wikidot 用户名..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl p-3 pr-10 placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
                        />
                        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </button>
                    </form>
                </div>

                {loading && (
                    <div className="text-gray-500 flex items-center justify-center py-20">
                        <i className="fa-solid fa-circle-notch animate-spin mr-2 text-indigo-500"></i> 加载中...
                    </div>
                )}

                {error && (
                    <div className="text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-800/50 text-sm">
                        查询失败：{error}
                    </div>
                )}

                {/* 作者详情 */}
                {data && !loading && (
                    <div className="space-y-6">
                        {/* 头像 + 基本信息 */}
                        <div className="flex items-center gap-5">
                            <img
                                src={data.avatar}
                                alt={data.name}
                                className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-700 bg-gray-900"
                                onError={(e) => { e.target.src = 'https://www.wikidot.com/local--favicon/favicon.gif'; }}
                            />
                            <div>
                                <h2 className="text-2xl font-bold text-white">{data.name}</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    全站排名 #{data.globalRank} · {data.totalPages} 个页面 · 总评分
                                    <span className={`ml-1 font-semibold ${data.totalRating > 0 ? 'text-green-400' : data.totalRating < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                        {data.totalRating > 0 ? `+${data.totalRating}` : data.totalRating}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* 各站数据 */}
                        {data.siteStats?.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {data.siteStats.map((site, i) => {
                                    const sc = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === site.wiki || w.NAME === site.wiki);
                                    return (
                                        <div key={i} className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/40">
                                            <div className="text-sm font-medium text-indigo-400 mb-3 truncate">{sc ? sc.NAME : site.wiki}</div>
                                            <div className="flex items-center justify-between text-xs text-gray-400">
                                                <span>#{site.rank}</span>
                                                <span>{site.count} 篇</span>
                                                <span className={`font-medium ${site.rating > 0 ? 'text-green-400' : site.rating < 0 ? 'text-red-400' : ''}`}>
                                                    {site.rating > 0 ? `+${site.rating}` : site.rating}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 活跃度图表 */}
                        {data.pages?.length > 0 && (
                            <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
                                <h3 className="text-sm font-semibold text-white mb-4">创作活跃度</h3>
                                <div className="h-[280px] w-full">
                                    <AuthorActivityChart pages={data.pages} />
                                </div>
                            </div>
                        )}

                        {/* 最喜欢的作者 + 投票记录 */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
                                <h3 className="text-sm font-semibold text-white mb-4">最喜欢的作者</h3>
                                {data.favoriteAuthors?.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.favoriteAuthors.map((author, idx) => {
                                            const maxVotes = data.favoriteAuthors[0].count;
                                            const pct = Math.max(8, (author.count / maxVotes) * 100);
                                            return (
                                                <div key={idx} className="flex items-center gap-3">
                                                    <Link href={`/authors?name=${encodeURIComponent(author.name)}`} className="w-28 text-sm text-indigo-400 hover:underline truncate shrink-0">
                                                        {author.name}
                                                    </Link>
                                                    <div className="flex-1 h-6 bg-gray-900 rounded-lg overflow-hidden relative">
                                                        <div className="h-full bg-indigo-500/20 rounded-lg transition-all" style={{ width: `${pct}%` }}></div>
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{author.count} 票</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-600 py-8 text-center">暂无数据</div>
                                )}
                            </div>

                            <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
                                <h3 className="text-sm font-semibold text-white mb-4">近期投票</h3>
                                {data.voteRecords?.length > 0 ? (
                                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                        {data.voteRecords.map((vote, idx) => {
                                            const isUp = vote.vote === '+1' || vote.vote === '1';
                                            return (
                                                <div key={idx} className="flex items-center gap-3 text-sm p-2.5 rounded-lg hover:bg-gray-800/60 transition-colors">
                                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 ${isUp ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {isUp ? '+1' : '-1'}
                                                    </span>
                                                    <Link href={`/page?site=${vote.wiki}&page=${encodeURIComponent(vote.page)}`} className="text-gray-300 hover:text-indigo-400 truncate flex-1 transition-colors">
                                                        {vote.title || vote.page}
                                                    </Link>
                                                    <Link href={`/authors?name=${encodeURIComponent(vote.author)}`} className="text-xs text-gray-600 hover:text-gray-400 shrink-0 transition-colors">
                                                        {vote.author}
                                                    </Link>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-600 py-8 text-center">暂无数据</div>
                                )}
                            </div>
                        </div>

                        {/* 发布页面 */}
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h3 className="text-sm font-semibold text-white">
                                    发布的页面
                                    <span className="text-gray-500 font-normal ml-2">{displayedPages.length} 篇</span>
                                </h3>
                                {Object.keys(siteCounts).length > 0 && (
                                    <select
                                        value={filterSite}
                                        onChange={(e) => setFilterSite(e.target.value)}
                                        className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none cursor-pointer hover:border-gray-600 transition-colors"
                                    >
                                        <option value="all">全部站点</option>
                                        {Object.entries(siteCounts).map(([wikiId, count]) => {
                                            const sc = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === wikiId || (w.URL && w.URL.includes(wikiId)));
                                            return <option key={wikiId} value={wikiId}>{sc ? sc.NAME : wikiId} ({count})</option>;
                                        })}
                                    </select>
                                )}
                            </div>

                            {displayedPages.length > 0 ? (
                                <div className="space-y-2">
                                    {displayedPages.map((page, i) => {
                                        const sc = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === page.wiki || (w.URL && w.URL.includes(page.wiki)));
                                        const siteParam = sc ? sc.PARAM : page.wiki;
                                        const dateStr = page.created_at?.includes('T') ? page.created_at.split('T')[0] : (page.created_at || '');

                                        return (
                                            <div key={i} className="flex items-center justify-between gap-4 p-4 rounded-lg hover:bg-gray-800/60 transition-colors group">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Link
                                                            href={`/page?site=${siteParam}&page=${encodeURIComponent(page.page)}`}
                                                            className="text-gray-200 hover:text-indigo-400 font-medium truncate transition-colors"
                                                        >
                                                            {page.title || page.page}
                                                        </Link>
                                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${page.rating > 0 ? 'text-green-400 bg-green-500/10' : page.rating < 0 ? 'text-red-400 bg-red-500/10' : 'text-gray-500 bg-gray-800'}`}>
                                                            {page.rating > 0 ? `+${page.rating}` : page.rating}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-1">
                                                        {dateStr}{dateStr && ' · '}{sc ? sc.NAME : page.wiki}
                                                    </div>
                                                </div>
                                                <a
                                                    href={`http://${page.wiki}.wikidot.com/${page.page}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-gray-600 hover:text-gray-400 transition-colors shrink-0"
                                                    title="在 Wikidot 打开"
                                                >
                                                    <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                                                </a>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-600 py-8 text-center">没有找到页面</div>
                            )}
                        </div>
                    </div>
                )}
                {/* 排行榜 */}
                {!name && !loading && (
                    <div className="space-y-6">
                        {/* 站点切换 */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => handleTabClick('global')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    activeTab === 'global'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                全站
                            </button>
                            {config.SUPPORT_WIKI.map((site) => (
                                <button
                                    key={site.PARAM}
                                    onClick={() => handleTabClick(site.PARAM)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        activeTab === site.PARAM
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white hover:border-gray-600'
                                    }`}
                                >
                                    {site.NAME}
                                </button>
                            ))}
                        </div>

                        {search && (
                            <p className="text-sm text-gray-500">
                                搜索 "<span className="text-indigo-400">{search}</span>" 的结果
                            </p>
                        )}

                        {/* 排行表格 */}
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-700/50 text-xs text-gray-500">
                                        <th className="px-5 py-3 w-16">排名</th>
                                        <th className="px-5 py-3">作者</th>
                                        <th className="px-5 py-3 text-right">评分</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {displayedRankingList?.length > 0 ? (
                                        displayedRankingList.map((author, i) => (
                                            <tr key={i} className="hover:bg-gray-800/40 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold ${
                                                        author.rank === 1 ? 'bg-yellow-500/15 text-yellow-400' :
                                                        author.rank === 2 ? 'bg-gray-500/15 text-gray-300' :
                                                        author.rank === 3 ? 'bg-orange-500/15 text-orange-400' :
                                                        'text-gray-500'
                                                    }`}>
                                                        {author.rank}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <Link
                                                        href={`/authors?name=${encodeURIComponent(author.name)}`}
                                                        className="text-white hover:text-indigo-400 font-medium transition-colors"
                                                    >
                                                        {author.name}
                                                    </Link>
                                                </td>
                                                <td className={`px-5 py-3.5 text-right font-medium tabular-nums ${author.value > 0 ? 'text-green-400' : author.value < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                    {author.value > 0 ? `+${author.value}` : author.value}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="3" className="px-5 py-16 text-center">
                                                {search ? (
                                                    <div className="space-y-4">
                                                        <p className="text-sm text-gray-500">排行榜中没有找到 "{search}"</p>
                                                        <button
                                                            onClick={() => router.push(`/authors?name=${encodeURIComponent(search)}`)}
                                                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                                                        >
                                                            精确查询该作者
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-600">暂无排行数据</span>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {search && displayedRankingList.length > 0 && (
                                <div className="px-5 py-4 border-t border-gray-700/50 flex items-center justify-center gap-4">
                                    <span className="text-xs text-gray-500">没找到想要的？</span>
                                    <button
                                        onClick={() => router.push(`/authors?name=${encodeURIComponent(search)}`)}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                                    >
                                        精确查询 "{search}"
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default AuthorProfile;