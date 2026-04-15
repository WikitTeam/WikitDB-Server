import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');

const SiteDashboard = ({ siteConfig, recentPages, totalPages, topAuthors }) => {
    return (
        <>
            <Head>
                <title>{`${siteConfig.NAME} - ${config.SITE_NAME}`}</title>
            </Head>

            <div className="py-8 max-w-5xl mx-auto px-4">
                {/* 站点头部 */}
                <div className="flex items-center gap-5 mb-10">
                    <div className="h-20 w-20 shrink-0 flex items-center justify-center overflow-hidden rounded-2xl bg-gray-900 border border-gray-700">
                        <img
                            src={siteConfig.ImgURL}
                            alt={siteConfig.NAME}
                            className="h-full w-full object-contain p-3"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-3xl font-bold text-white truncate">{siteConfig.NAME}</h1>
                        <div className="flex items-center gap-4 mt-2">
                            <a
                                href={siteConfig.URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-500 hover:text-indigo-400 transition-colors"
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square mr-1"></i>
                                Wikidot 原站
                            </a>
                            <span className="text-sm text-gray-600">{siteConfig.PARAM}</span>
                        </div>
                    </div>
                </div>

                {/* 数据概览 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                    <div className="p-5 rounded-xl bg-gray-800/40 border border-gray-700/40">
                        <div className="text-2xl font-bold text-white">{totalPages}</div>
                        <div className="text-xs text-gray-500 mt-1">收录页面</div>
                    </div>
                    <div className="p-5 rounded-xl bg-gray-800/40 border border-gray-700/40">
                        <div className="text-2xl font-bold text-white">{topAuthors.length}</div>
                        <div className="text-xs text-gray-500 mt-1">活跃作者</div>
                    </div>
                    <div className="p-5 rounded-xl bg-gray-800/40 border border-gray-700/40 col-span-2 sm:col-span-1">
                        <div className="text-2xl font-bold text-white">
                            {topAuthors.length > 0 ? topAuthors[0].name : '-'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">评分最高作者</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 最新页面 */}
                    <div className="lg:col-span-2 rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-semibold text-white">最新页面</h2>
                            <Link href={`/pages?site=${siteConfig.PARAM}`} className="text-xs text-gray-500 hover:text-indigo-400 transition-colors">
                                查看全部 <i className="fa-solid fa-arrow-right ml-1"></i>
                            </Link>
                        </div>
                        {recentPages.length > 0 ? (
                            <div className="space-y-1">
                                {recentPages.map((page, i) => {
                                    const dateStr = page.created_at?.includes('T') ? page.created_at.split('T')[0] : '';
                                    return (
                                        <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-gray-800/60 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <Link
                                                    href={`/page?site=${siteConfig.PARAM}&page=${encodeURIComponent(page.page)}`}
                                                    className="text-sm text-gray-200 hover:text-indigo-400 transition-colors truncate block"
                                                >
                                                    {page.title || page.page}
                                                </Link>
                                                <span className="text-xs text-gray-600">{dateStr}</span>
                                            </div>
                                            <span className={`text-xs font-medium shrink-0 ${page.rating > 0 ? 'text-green-400' : page.rating < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {page.rating > 0 ? `+${page.rating}` : page.rating}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-600 py-8 text-center">暂无数据</div>
                        )}
                    </div>

                    {/* 作者排行 */}
                    <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-semibold text-white">作者排行</h2>
                            <Link href="/authors" className="text-xs text-gray-500 hover:text-indigo-400 transition-colors">
                                全站排行 <i className="fa-solid fa-arrow-right ml-1"></i>
                            </Link>
                        </div>
                        {topAuthors.length > 0 ? (
                            <div className="space-y-1">
                                {topAuthors.slice(0, 10).map((author, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/60 transition-colors">
                                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium shrink-0 ${
                                            i === 0 ? 'bg-yellow-500/15 text-yellow-400' :
                                            i === 1 ? 'bg-gray-500/15 text-gray-300' :
                                            i === 2 ? 'bg-orange-500/15 text-orange-400' :
                                            'text-gray-600'
                                        }`}>
                                            {i + 1}
                                        </span>
                                        <Link
                                            href={`/authors?name=${encodeURIComponent(author.name)}`}
                                            className="text-sm text-gray-300 hover:text-indigo-400 transition-colors truncate flex-1"
                                        >
                                            {author.name}
                                        </Link>
                                        <span className={`text-xs font-medium tabular-nums shrink-0 ${author.value > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                            {author.value > 0 ? `+${author.value}` : author.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-600 py-8 text-center">暂无数据</div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export async function getServerSideProps(context) {
    const { param } = context.params;
    const siteConfig = config.SUPPORT_WIKI.find(w => w.PARAM === param);

    if (!siteConfig) {
        return { notFound: true };
    }

    const baseUrl = context.req ? `http://${context.req.headers.host}` : '';

    let recentPages = [];
    let totalPages = 0;
    let topAuthors = [];

    try {
        const [searchRes, rankingRes] = await Promise.all([
            fetch(`${baseUrl}/api/search?site=${param}&q=&p=1`).then(r => r.json()).catch(() => null),
            fetch(`${baseUrl}/api/ranking?site=${param}`).then(r => r.json()).catch(() => null),
        ]);

        if (searchRes) {
            recentPages = (searchRes.results || []).slice(0, 10);
            totalPages = searchRes.totalCount || 0;
        }
        if (rankingRes) {
            topAuthors = rankingRes.ranking || [];
        }
    } catch (e) {
        // 静默处理，页面会显示空状态
    }

    return {
        props: {
            siteConfig,
            recentPages,
            totalPages,
            topAuthors,
        },
    };
}

export default SiteDashboard;
