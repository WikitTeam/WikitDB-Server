import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');

const Gallery = () => {
    const [selectedSite, setSelectedSite] = useState(config.SUPPORT_WIKI[0]?.PARAM);
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchImages = async (pageNum, append = false) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gallery?site=${selectedSite}&p=${pageNum}`);
            const data = await res.json();
            
            if (append) setImages(prev => [...prev, ...data.images]);
            else setImages(data.images);

            if (pageNum >= data.totalPages) setHasMore(false);
            else setHasMore(true);
        } catch (err) {} finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1); setImages([]); setHasMore(true);
        fetchImages(1, false);
    }, [selectedSite]);

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
    };

    return (
        <>
            <Head><title>{`全站图片画廊 - ${config.SITE_NAME}`}</title></Head>
            <div className="py-8 max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-8">全站图片画廊</h1>
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

                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                    {images.map((img, index) => (
                        <div key={index} className="break-inside-avoid bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors">
                            <a href={img.src} target="_blank" rel="noopener noreferrer">
                                <img src={img.src} alt="wiki image" className="w-full object-cover" loading="lazy" />
                            </a>
                            <div className="p-3">
                                <Link href={`/page?site=${selectedSite}&page=${encodeURIComponent(img.pageSlug)}`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 block truncate">
                                    {img.pageTitle}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {loading && <div className="text-center py-12 text-gray-400">正在读取画廊数据...</div>}
                {!loading && hasMore && (
                    <div className="text-center mt-8">
                        <button onClick={loadMore} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-600">加载更多图片</button>
                    </div>
                )}
                {!loading && !hasMore && images.length === 0 && (
                    <div className="text-center py-16 border border-dashed border-gray-700 rounded-lg bg-gray-900/20 text-gray-500">当前扫描的页面中没有找到图片</div>
                )}
            </div>
        </>
    );
};

export default Gallery;