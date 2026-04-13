import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

const config = require('../wikitdb.config.js');

const AuthorActivityChart = dynamic(() => import('../components/AuthorActivityChart'), { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-gray-500 text-sm">正在加载图表引擎...</div>
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
    };

    const currentRankingList = rankingCache[activeTab] || [];
    
    let displayedRankingList = currentRankingList;
    if (!name && search) {
        const lowerSearch = search.toLowerCase();
        displayedRankingList = currentRankingList.filter(author => 
            (author.name || '').toLowerCase().includes(lowerSearch)
        );
    }

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

            <div className="py-8">
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {name ? '作者信息' : search ? '搜索结果' : '作者评分排行榜'}
                    </h1>
                    
                    <form onSubmit={handleSearch} className="relative w-full sm:w-80">
                        <input
                            type="text"
                            placeholder="输入 Wikidot 用户名..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 placeholder-gray-400 dark:placeholder-gray-500 transition-all shadow-inner"
                        />
                        <button type="submit" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </button>
                    </form>
                </div>

                {loading && (
                    <div className="text-gray-500 dark:text-gray-400 flex items-center justify-center py-24 animate-pulse">
                        <i className="fa-solid fa-circle-notch animate-spin mr-3 text-indigo-500"></i> 正在从档案库检索数据...
                    </div>
                )}

                {error && (
                    <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-900/50 font-medium">
                        检索失败: {error}
                    </div>
                )}

                {data && !loading && (
                    <div className="space-y-8">
                        <div className="flex items-center gap-8">
                            <div className="relative group">
                                <img 
                                    src={data.avatar} 
                                    alt={data.name} 
                                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-xl bg-gray-100 dark:bg-gray-900 group-hover:scale-105 transition-transform"
                                    onError={(e) => { e.target.src = 'https://www.wikidot.com/local--favicon/favicon.gif'; }}
                                />
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs border-2 border-white dark:border-gray-800 shadow-lg">
                                    <i className="fa-solid fa-check"></i>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight uppercase italic">{data.name}</h2>
                                <div className="text-xs text-gray-400 dark:text-gray-500 font-mono uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    Synchronized with Wikit GraphQL
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-8 border border-gray-100 dark:border-white/5 shadow-sm">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3 uppercase tracking-tighter">
                                <i className="fa-solid fa-chart-simple text-indigo-500"></i> 全站数据资产总览
                            </h3>
                            <div className="text-gray-600 dark:text-gray-300 leading-relaxed mb-10 text-lg">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{data.name}</span> 在所有站点中全局排名 <span className="font-black text-gray-900 dark:text-white italic tracking-tighter">#{data.globalRank}</span>。
                                共计拥有 <span className="font-bold text-gray-900 dark:text-white">{data.totalPages}</span> 个页面，
                                累计总评分为 <span className="font-black text-green-600 dark:text-green-400 tracking-tight">{data.totalRating > 0 ? `+${data.totalRating}` : data.totalRating}</span>。
                            </div>

                            {data.siteStats && data.siteStats.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                    {data.siteStats.map((site, index) => {
                                        const siteConfig = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === site.wiki || w.NAME === site.wiki);
                                        const siteName = siteConfig ? siteConfig.NAME : site.wiki;
                                        return (
                                            <div key={index} className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 transition-all hover:border-indigo-500/30">
                                                <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-4 truncate text-sm uppercase tracking-wide" title={siteName}>{siteName}</div>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rank</span> <span className="text-gray-900 dark:text-white font-black font-mono">#{site.rank}</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pages</span> <span className="text-gray-700 dark:text-gray-300 font-mono">{site.count}</span></div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rating</span> 
                                                        <span className={`font-black font-mono ${site.rating > 0 ? 'text-green-600' : site.rating < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                            {site.rating > 0 ? `+${site.rating}` : site.rating}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {data.pages && data.pages.length > 0 && (
                            <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-8 border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3 uppercase tracking-tighter">
                                    <i className="fa-solid fa-fire-flame-curved text-orange-500"></i> 创作活跃度曲线
                                </h3>
                                <div className="h-[300px] w-full mt-4">
                                    <AuthorActivityChart pages={data.pages} />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-8 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col">
                                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-800 pb-4 uppercase tracking-tighter">最喜欢的作者</h3>
                                {data.favoriteAuthors && data.favoriteAuthors.length > 0 ? (
                                    <div className="space-y-4 flex-1">
                                        {data.favoriteAuthors.map((author, idx) => {
                                            const maxVotes = data.favoriteAuthors[0].count;
                                            const percentage = Math.max(8, (author.count / maxVotes) * 100);
                                            return (
                                                <div key={idx} className="flex items-center gap-4">
                                                    <Link href={`/authors?name=${encodeURIComponent(author.name)}`} className="w-1/3 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                                                        {author.name}
                                                    </Link>
                                                    <div className="flex-1 h-7 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden flex items-center relative shadow-inner border border-gray-100 dark:border-gray-800">
                                                        <div className="h-full bg-gradient-to-r from-indigo-500/20 to-indigo-600/40 border-r border-indigo-500/50 transition-all duration-700" style={{ width: `${percentage}%` }}></div>
                                                        <span className="text-[10px] text-indigo-700 dark:text-gray-200 absolute left-3 font-black uppercase tracking-widest">{author.count} 票</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-400 font-mono py-12 flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed">
                                        <i className="fa-solid fa-box-open text-2xl mb-3 opacity-20"></i>
                                        NO FAVORITE RECORD
                                    </div>
                                )}
                            </div>

                            <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-8 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col">
                                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-800 pb-4 uppercase tracking-tighter">近期投票足迹</h3>
                                {data.voteRecords && data.voteRecords.length > 0 ? (
                                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                                        {data.voteRecords.map((vote, idx) => {
                                            const isUp = vote.vote === '+1' || vote.vote === '1';
                                            return (
                                                <div key={idx} className="flex items-center justify-between gap-4 text-sm bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md">
                                                    <div className="flex items-center gap-4 overflow-hidden">
                                                        <span className={`font-black w-8 h-8 rounded-lg flex items-center justify-center text-[10px] shrink-0 ${isUp ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-500 border border-green-200 dark:border-green-500/20' : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-500 border border-red-200 dark:border-red-500/20'}`}>
                                                            {isUp ? '+1' : '-1'}
                                                        </span>
                                                        <Link href={`/page?site=${vote.wiki}&page=${encodeURIComponent(vote.page)}`} className="text-gray-900 dark:text-indigo-400 font-bold hover:text-indigo-600 truncate">
                                                            {vote.title || vote.page}
                                                        </Link>
                                                    </div>
                                                    <Link href={`/authors?name=${encodeURIComponent(vote.author)}`} className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 dark:hover:text-gray-300 shrink-0 truncate max-w-[100px] uppercase tracking-tighter">
                                                        {vote.author}
                                                    </Link>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-400 font-mono py-12 flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed">
                                        <i className="fa-solid fa-ghost text-2xl mb-3 opacity-20"></i>
                                        NO VOTE RECORD
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-8 border border-gray-100 dark:border-white/5 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b border-gray-100 dark:border-gray-800 pb-6">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                                    <i className="fa-solid fa-folder-open text-indigo-500"></i>
                                    发布页面集锦 <span className="text-[10px] font-bold text-gray-400 tracking-[0.2em] ml-2">CHRONOLOGICAL ARCHIVE</span>
                                </h3>
                                
                                {Object.keys(siteCounts).length > 0 && (
                                    <select
                                        value={filterSite}
                                        onChange={(e) => setFilterSite(e.target.value)}
                                        className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-bold rounded-xl px-4 py-2.5 outline-none cursor-pointer hover:border-indigo-500 transition-colors shadow-sm"
                                    >
                                        <option value="all">全站总览 (ALL)</option>
                                        {Object.entries(siteCounts).map(([wikiId, count]) => {
                                            const siteConfig = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === wikiId || (w.URL && w.URL.includes(wikiId)));
                                            const siteName = siteConfig ? siteConfig.NAME : wikiId;
                                            return (
                                                <option key={wikiId} value={wikiId}>
                                                    {siteName} ({count} 篇)
                                                </option>
                                            );
                                        })}
                                    </select>
                                )}
                            </div>
                            
                            {displayedPages.length > 0 ? (
                                <div className="space-y-4">
                                    {displayedPages.map((page, index) => {
                                        const siteConfig = config.SUPPORT_WIKI.find(w => w.WIKIT_ID === page.wiki || (w.URL && w.URL.includes(page.wiki)));
                                        const siteParam = siteConfig ? siteConfig.PARAM : page.wiki;
                                        const dateStr = page.created_at && page.created_at.includes('T') ? page.created_at.split('T')[0] : (page.created_at || '未知时间');

                                        return (
                                            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 transition-all hover:shadow-md group">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline flex-wrap gap-2.5">
                                                        <Link 
                                                            href={`/page?site=${siteParam}&page=${encodeURIComponent(page.page)}`}
                                                            className="text-lg font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 truncate tracking-tight"
                                                        >
                                                            {page.title || page.page}
                                                        </Link>
                                                        <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg ${page.rating > 0 ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                                                            {page.rating > 0 ? `+${page.rating}` : page.rating}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.2em] mt-2 opacity-60">
                                                        Released {dateStr} • {page.wiki} STATION
                                                    </div>
                                                </div>
                                                
                                                <a 
                                                    href={`http://${page.wiki}.wikidot.com/${page.page}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all"
                                                >
                                                    <i className="fa-solid fa-arrow-up-right-from-square"></i> Open In Original
                                                </a>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-gray-400 font-mono text-center py-16 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                    NOTHING FOUND IN THIS ARCHIVE
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!name && !loading && (
                    <div className="space-y-8">
                        <div className="flex flex-wrap gap-3 border-b border-gray-200 dark:border-gray-800 pb-6">
                            <button
                                onClick={() => handleTabClick('global')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                    activeTab === 'global'
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                全站总排行 (GLOBAL)
                            </button>
                            
                            {config.SUPPORT_WIKI.map((site) => (
                                <button
                                    key={site.PARAM}
                                    onClick={() => handleTabClick(site.PARAM)}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                        activeTab === site.PARAM
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {site.NAME}
                                </button>
                            ))}
                        </div>

                        {search && (
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-search text-indigo-500"></i>
                                Matching archive: <span className="text-indigo-600 dark:text-indigo-400">"{search}"</span>
                            </div>
                        )}

                        <div className="bg-white dark:bg-gray-800/40 rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                                            <th className="p-6 w-24">Rank</th>
                                            <th className="p-6">Author Identity</th>
                                            <th className="p-6 text-right">Aggregated Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                                        {displayedRankingList && displayedRankingList.length > 0 ? (
                                            displayedRankingList.map((author, index) => (
                                                <tr key={index} className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group">
                                                    <td className="p-6">
                                                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl font-black text-xs font-mono shadow-sm border ${
                                                            author.rank === 1 ? 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-500 dark:border-yellow-500/30' :
                                                            author.rank === 2 ? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-300/20 dark:text-gray-300 dark:border-gray-400/30' :
                                                            author.rank === 3 ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-400/20 dark:text-orange-400 dark:border-orange-500/30' :
                                                            'bg-white text-gray-400 border-gray-100 dark:bg-gray-900 dark:text-gray-500 dark:border-gray-800'
                                                        }`}>
                                                            #{author.rank}
                                                        </span>
                                                    </td>
                                                    <td className="p-6">
                                                        <Link 
                                                            href={`/authors?name=${encodeURIComponent(author.name)}`}
                                                            className="text-lg font-black text-gray-900 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors tracking-tight italic uppercase"
                                                        >
                                                            {author.name}
                                                        </Link>
                                                    </td>
                                                    <td className={`p-6 text-right font-black font-mono text-lg ${author.value > 0 ? 'text-green-600' : author.value < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {author.value > 0 ? `+${author.value}` : author.value}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="3" className="p-24 text-center">
                                                    {search ? (
                                                        <div className="flex flex-col items-center justify-center space-y-6">
                                                            <div className="text-gray-500 font-medium">
                                                                未在活跃排行榜中检索到匹配 <span className="text-gray-900 dark:text-white font-black italic">"{search}"</span> 的作者。
                                                            </div>
                                                            <button 
                                                                onClick={() => router.push(`/authors?name=${encodeURIComponent(search)}`)}
                                                                className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition-all font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/30"
                                                            >
                                                                <i className="fa-solid fa-bolt mr-2"></i> 强制启动深层精确扫描
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 font-mono italic">DATA BUFFER EMPTY...</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {search && displayedRankingList.length > 0 && (
                                <div className="p-6 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-center gap-6">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">没有发现目标作者？</span>
                                    <button 
                                        onClick={() => router.push(`/authors?name=${encodeURIComponent(search)}`)}
                                        className="text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2.5 bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white border border-indigo-600 dark:border-transparent rounded-xl hover:shadow-lg transition-all"
                                    >
                                        启动深度扫描 (DEEP SCAN)
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