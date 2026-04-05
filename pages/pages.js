import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../wikitdb.config.js');

const Pages = () => {
    const [selectedSite, setSelectedSite] = useState(config.SUPPORT_WIKI[0]?.PARAM);
    const [searchQuery, setSearchQuery] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // 控制当前页码
    const [page, setPage] = useState(1);

    useEffect(() => {
        setSearchQuery('');
        setPage(1);
        executeSearch('', 1);
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
                <title>{`动态检索 - ${config.SITE_NAME}`}</title>
            </Head>

            <div className="py-8">
                <h1 className="text-3xl font-bold text-white mb-8">站点页面动态检索</h1>

                <div className="mb-8 flex flex-wrap gap-4 border-b border-gray-700 pb-6">
                    {config.SUPPORT_WIKI.map((wiki) => (
                        <button
                            key={wiki.PARAM}
                            onClick={() => setSelectedSite(wiki.PARAM)}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${
                                selectedSite === wiki.PARAM 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            {wiki.NAME}
                        </button>
                    ))}
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10 min-h-[500px]">
                    <form onSubmit={handleSearchSubmit} className="mb-8 relative max-w-2xl mx-auto">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <i className="fa-solid fa-magnifying-glass text-gray-400"></i>
                            </div>
                            <input
                                type="text"
                                placeholder="输入页面标题或英文名进行全站搜索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full p-4 pl-10 text-sm text-white bg-gray-900 border border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="text-white absolute right-2.5 bottom-2.5 bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-800 font-medium rounded-lg text-sm px-4 py-2 disabled:opacity-50 transition-colors"
                            >
                                {loading ? '检索中...' : '搜索'}
                            </button>
                        </div>
                    </form>
                    
                    {error && (
                        <div className="text-red-400 text-center py-8 bg-red-900/10 rounded-lg border border-red-900/30">
                            检索遇到错误: {error}
                        </div>
                    )}
                    
                    {data && !loading && (
                        <div>
                            <div className="mb-4 text-gray-400 text-sm flex justify-between items-center">
                                <span>来源站点: {data.siteName}</span>
                                <span>共找到 {data.totalCount} 条记录</span>
                            </div>
                            
                            {data.results.length > 0 ? (
                                <div className="space-y-3">
                                    {data.results.map((pageData, index) => {
                                        const dateStr = pageData.created_at ? new Date(pageData.created_at).toLocaleDateString('zh-CN') : '未知时间';
                                        
                                        return (
                                            <div key={index} className="bg-gray-900/40 p-4 rounded-lg border border-gray-700/50 hover:border-gray-500 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div>
                                                    <Link 
                                                        href={`/page?site=${selectedSite}&page=${encodeURIComponent(pageData.page)}`}
                                                        className="text-lg font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                                                    >
                                                        {pageData.title || pageData.page}
                                                    </Link>
                                                    <div className="text-xs text-gray-500 mt-1.5 flex gap-4">
                                                        <span>系统名: {pageData.page}</span>
                                                        <span>评分: <span className={pageData.rating > 0 ? 'text-green-400' : 'text-gray-400'}>{pageData.rating > 0 ? `+${pageData.rating}` : (pageData.rating || 0)}</span></span>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-500 shrink-0">
                                                    发布于 {dateStr}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* 翻页组件 */}
                                    {data.totalPages > 1 && (
                                        <div className="flex justify-center items-center gap-4 mt-8 pt-4 border-t border-gray-700/50">
                                            <button
                                                onClick={() => handlePageChange(data.currentPage - 1)}
                                                disabled={data.currentPage === 1}
                                                className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                            >
                                                上一页
                                            </button>
                                            <span className="text-gray-400 text-sm">
                                                第 {data.currentPage} / {data.totalPages} 页
                                            </span>
                                            <button
                                                onClick={() => handlePageChange(data.currentPage + 1)}
                                                disabled={data.currentPage === data.totalPages}
                                                className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                            >
                                                下一页
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-16 border border-dashed border-gray-700 rounded-lg bg-gray-900/20">
                                    <p className="text-gray-500 text-lg">
                                        没有找到与 "{searchQuery}" 相关的页面
                                    </p>
                                    <p className="text-gray-600 text-sm mt-2">
                                        尝试使用不同的关键词，或缩短搜索词
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Pages;
