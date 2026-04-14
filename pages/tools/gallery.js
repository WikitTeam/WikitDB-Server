import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');

const Gallery = () => {
    const [selectedSite, setSelectedSite] = useState(config.SUPPORT_WIKI[0]?.PARAM);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    
    // 查看源码和文本的状态
    const [viewData, setViewData] = useState(null);

    const fetchData = async (pageNum, append = false) => {
        setLoading(true);
        try {
            // 注意：这里仍然请求 api/gallery，但我会确保后端返回你需要的完整数据
            const res = await fetch(`/api/gallery?site=${selectedSite}&p=${pageNum}`);
            const data = await res.json();
            
            if (append) setItems(prev => [...prev, ...data.archives]);
            else setItems(data.archives);

            if (pageNum >= data.totalPages) setHasMore(false);
            else setHasMore(true);
        } catch (err) {} finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1); setItems([]); setHasMore(true);
        fetchData(1, false);
    }, [selectedSite]);

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchData(nextPage, true);
    };

    return (
        <>
            <Head><title>{`全站页面备份 - ${config.SITE_NAME}`}</title></Head>
            <div className="max-w-7xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-white mb-8">全站页面备份</h1>
                
                {/* 站点切换 - 保持你原来的样式 */}
                <div className="mb-8 flex flex-wrap gap-4 border-b border-gray-700 pb-6">
                    {config.SUPPORT_WIKI.map((wiki) => (
                        <button
                            key={wiki.PARAM}
                            onClick={() => setSelectedSite(wiki.PARAM)}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${selectedSite === wiki.PARAM ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                        >
                            {wiki.NAME}
                        </button>
                    ))}
                </div>

                {/* 恢复你原来的瀑布流版式 */}
                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                    {items.map((item, index) => (
                        <div key={index} className="break-inside-avoid bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors group relative">
                            {/* 图片展示 */}
                            {item.images && item.images.length > 0 ? (
                                <img src={item.images[0]} alt="preview" className="w-full object-cover" loading="lazy" />
                            ) : (
                                <div className="w-full h-32 bg-gray-900 flex items-center justify-center text-gray-600">
                                    <i className="fa-solid fa-file-lines text-2xl"></i>
                                </div>
                            )}

                            {/* 悬浮操作层 - 增加查看代码按钮 */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <button 
                                    onClick={() => setViewData({ title: item.title, content: item.content, type: 'code' })}
                                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold py-2 px-3 rounded-lg border border-white/20"
                                >
                                    查看源码
                                </button>
                                <button 
                                    onClick={() => setViewData({ title: item.title, content: item.content, type: 'text' })}
                                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold py-2 px-3 rounded-lg border border-white/20"
                                >
                                    提取文本
                                </button>
                            </div>

                            <div className="p-3 bg-gray-800/80">
                                <Link href={`/page?site=${selectedSite}&page=${encodeURIComponent(item.slug)}`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 block truncate">
                                    {item.title}
                                </Link>
                                <p className="text-[10px] text-gray-500 mt-1">作者: {item.author || '未知'}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {loading && <div className="text-center py-12 text-gray-400">正在读取备份数据...</div>}
                {!loading && hasMore && items.length > 0 && (
                    <div className="text-center mt-8">
                        <button onClick={loadMore} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-600">加载更多内容</button>
                    </div>
                )}
            </div>

            {/* 源码/文本查看模态框 */}
            {viewData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl max-h-[80vh] rounded-2xl flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-white font-bold">{viewData.title} - {viewData.type === 'code' ? '页面源码' : '链接与文本'}</h2>
                            <button onClick={() => setViewData(null)} className="text-gray-400 hover:text-white text-xl">&times;</button>
                        </div>
                        <div className="p-6 overflow-auto font-mono text-sm text-gray-300 whitespace-pre-wrap">
                            {viewData.type === 'code' ? (
                                viewData.content || '暂无内容'
                            ) : (
                                // 简单的文本提取逻辑（如果是 HTML 则去除标签）
                                viewData.content?.replace(/<[^>]+>/g, '') || '暂无内容'
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-800 bg-gray-950/50 text-right">
                            <button onClick={() => setViewData(null)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">关闭窗口</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Gallery;
