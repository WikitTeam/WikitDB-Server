import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');

const PageArchiveTool = () => {
    const [selectedSite, setSelectedSite] = useState(config.SUPPORT_WIKI[0]?.PARAM);
    const [archives, setArchives] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState('');
    const [totalCount, setTotalCount] = useState(0);

    const fetchArchives = async (pageNum, append = false, currentSearch = search) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gallery?site=${selectedSite}&p=${pageNum}&search=${encodeURIComponent(currentSearch)}`);
            const data = await res.json();
            
            if (append) setArchives(prev => [...prev, ...data.archives]);
            else setArchives(data.archives);

            setTotalCount(data.totalCount || 0);
            if (pageNum >= data.totalPages) setHasMore(false);
            else setHasMore(true);
        } catch (err) {} finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1); setArchives([]); setHasMore(true);
        fetchArchives(1, false);
    }, [selectedSite]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1); setArchives([]); setHasMore(true);
        fetchArchives(1, false, search);
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchArchives(nextPage, true);
    };

    return (
        <div className="py-8">
            <Head><title>{`全站页面备份 - ${config.SITE_NAME}`}</title></Head>
            <div className="max-w-7xl mx-auto px-4">
                
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">全站页面备份</h1>
                        <p className="text-gray-500 font-medium">已归档 {totalCount} 个来自分站的页面档案</p>
                    </div>

                    <form onSubmit={handleSearch} className="relative w-full md:w-96">
                        <input 
                            type="text"
                            placeholder="搜索标题、作者或标签..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all pl-12 shadow-inner"
                        />
                        <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    </form>
                </div>

                <div className="mb-8 flex flex-wrap gap-2 border-b border-gray-800 pb-8">
                    {config.SUPPORT_WIKI.map((wiki) => (
                        <button
                            key={wiki.PARAM}
                            onClick={() => setSelectedSite(wiki.PARAM)}
                            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${selectedSite === wiki.PARAM ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-800/40 text-gray-400 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600'}`}
                        >
                            {wiki.NAME}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {archives.map((item) => (
                        <div key={item.id} className="group flex flex-col bg-gray-800/30 rounded-3xl border border-gray-700/50 overflow-hidden hover:border-indigo-500/30 transition-all hover:-translate-y-1 shadow-sm">
                            <div className="aspect-video bg-gray-900 flex items-center justify-center overflow-hidden border-b border-gray-700/50 relative">
                                {item.images && item.images.length > 0 ? (
                                    <img src={item.images[0]} alt="preview" className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                ) : (
                                    <i className="fa-solid fa-file-lines text-4xl text-gray-700"></i>
                                )}
                                <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] text-gray-400 font-bold uppercase tracking-widest border border-white/5">
                                    {item.wiki} / DATA
                                </div>
                            </div>
                            
                            <div className="p-6 flex flex-1 flex-col justify-between space-y-4">
                                <div>
                                    <h3 className="text-lg font-black text-white leading-snug group-hover:text-indigo-400 transition-colors line-clamp-2 mb-2">
                                        {item.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
                                        <i className="fa-solid fa-user-circle text-gray-600"></i> {item.author}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-1.5 h-6 overflow-hidden">
                                        {(item.tags || '').split(' ').filter(t => t).slice(0, 3).map(tag => (
                                            <span key={tag} className="px-2 py-0.5 bg-gray-900 rounded text-[9px] text-gray-400 font-bold border border-gray-700/50 uppercase">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-gray-700/30 flex items-center justify-between">
                                        <Link 
                                            href={`/page?site=${item.wiki}&page=${encodeURIComponent(item.slug)}`}
                                            className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] hover:text-indigo-300 transition-colors flex items-center gap-2"
                                        >
                                            检索档案 <i className="fa-solid fa-arrow-right text-[8px]"></i>
                                        </Link>
                                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 transition-colors">
                                            <i className="fa-solid fa-external-link text-xs"></i>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {loading && <div className="text-center py-20 text-gray-500 font-bold animate-pulse uppercase tracking-widest text-sm">正在载入深度备份数据...</div>}
                {!loading && hasMore && archives.length > 0 && (
                    <div className="text-center mt-12">
                        <button onClick={loadMore} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-black rounded-2xl transition-all border border-gray-700 shadow-xl text-xs uppercase tracking-widest">
                            加载更多档案记录
                        </button>
                    </div>
                )}
                {!loading && archives.length === 0 && (
                    <div className="text-center py-24 border border-dashed border-gray-700 rounded-[2.5rem] bg-gray-900/20">
                        <i className="fa-solid fa-folder-open text-6xl text-gray-800 mb-6 block"></i>
                        <span className="text-gray-500 font-bold uppercase tracking-widest">该分站暂无备份档案，深度爬虫正在作业中...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PageArchiveTool;
