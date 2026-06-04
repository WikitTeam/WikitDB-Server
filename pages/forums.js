import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../wikitdb.config.js');

const forumSites = config.SUPPORT_WIKI.filter(w => w.FORUM_SYNC);

export default function Forums() {
    const [selectedSite, setSelectedSite] = useState(forumSites[0]?.PARAM || '');
    const [view, setView] = useState('categories');
    const [categories, setCategories] = useState([]);
    const [threads, setThreads] = useState([]);
    const [posts, setPosts] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [currentThread, setCurrentThread] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);

    useEffect(() => {
        if (selectedSite) loadCategories();
    }, [selectedSite]);

    const loadCategories = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/forum/categories?site=${selectedSite}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCategories(data.categories || []);
            setView('categories');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadThreads = async (categoryId, p = 1) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/forum/threads?site=${selectedSite}&category=${categoryId}&p=${p}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setThreads(data.threads || []);
            setPage(data.currentPage);
            setTotalPages(data.totalPages || 1);
            setCurrentCategory(categoryId);
            setView('threads');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadPosts = async (threadId, p = 1) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/forum/posts?site=${selectedSite}&thread=${threadId}&p=${p}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPosts(data);
            setPage(data.currentPage);
            setTotalPages(data.totalPages || 1);
            setCurrentThread(threadId);
            setView('posts');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (p = 1) => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/forum/search?site=${selectedSite}&q=${encodeURIComponent(searchQuery)}&p=${p}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSearchResults(data);
            setPage(data.currentPage);
            setTotalPages(data.totalPages || 1);
            setView('search');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const goBack = () => {
        if (view === 'posts') { loadThreads(currentCategory, 1); }
        else if (view === 'threads' || view === 'search') { setView('categories'); }
    };

    return (
        <>
            <Head><title>论坛浏览 - WikitDB</title></Head>
            <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold">论坛浏览</h1>
                        <Link href="/" className="text-blue-400 hover:underline text-sm">返回首页</Link>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-6 items-center">
                        <select
                            value={selectedSite}
                            onChange={e => { setSelectedSite(e.target.value); setView('categories'); }}
                            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                        >
                            {forumSites.map(s => (
                                <option key={s.PARAM} value={s.PARAM}>{s.NAME}</option>
                            ))}
                        </select>

                        <div className="flex gap-2 flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="搜索帖子..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm flex-1"
                            />
                            <button onClick={() => handleSearch()} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm">搜索</button>
                        </div>
                    </div>

                    {view !== 'categories' && (
                        <button onClick={goBack} className="text-blue-400 hover:underline text-sm mb-4 block">&larr; 返回</button>
                    )}

                    {error && <div className="bg-red-900/50 border border-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
                    {loading && <div className="text-gray-400 text-sm mb-4">加载中...</div>}

                    {!loading && view === 'categories' && (
                        <div className="grid gap-3 md:grid-cols-2">
                            {categories.map(cat => (
                                <div
                                    key={cat.categoryId}
                                    onClick={() => loadThreads(cat.categoryId)}
                                    className="bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition"
                                >
                                    <h3 className="font-semibold text-lg">{cat.title}</h3>
                                    {cat.description && <p className="text-gray-400 text-sm mt-1">{cat.description}</p>}
                                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                        <span>帖子: {cat.threadsCount}</span>
                                        <span>回复: {cat.postsCount}</span>
                                    </div>
                                </div>
                            ))}
                            {categories.length === 0 && <p className="text-gray-500">暂无分类数据，请先执行同步</p>}
                        </div>
                    )}

                    {!loading && view === 'threads' && (
                        <div className="space-y-2">
                            {threads.map(t => (
                                <div
                                    key={t.threadId}
                                    onClick={() => loadPosts(t.threadId)}
                                    className="bg-gray-800 border border-gray-700 rounded p-3 cursor-pointer hover:border-blue-500 transition flex justify-between items-center"
                                >
                                    <div>
                                        <span className="font-medium">{t.isSticky ? '📌 ' : ''}{t.title}</span>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {t.createdBy} · {t.createdAt}
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">{t.postCount} 回复</span>
                                </div>
                            ))}
                            {threads.length === 0 && <p className="text-gray-500">该分类暂无帖子</p>}
                            <Pagination page={page} totalPages={totalPages} onPageChange={p => loadThreads(currentCategory, p)} />
                        </div>
                    )}

                    {!loading && view === 'posts' && posts && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold">{posts.threadTitle}</h2>
                            <p className="text-sm text-gray-500">作者: {posts.threadAuthor} · 共 {posts.total} 条回复</p>
                            <div className="space-y-3">
                                {posts.posts.map(p => <PostItem key={p.postId} post={p} />)}
                            </div>
                            <Pagination page={page} totalPages={totalPages} onPageChange={p => loadPosts(currentThread, p)} />
                        </div>
                    )}

                    {!loading && view === 'search' && searchResults && (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-400 mb-3">找到 {searchResults.total} 条结果</p>
                            {searchResults.results.map(r => (
                                <div key={r.postId} className="bg-gray-800 border border-gray-700 rounded p-3">
                                    <div className="text-sm font-medium">{r.threadTitle}</div>
                                    <div className="text-xs text-gray-500 mt-1">{r.author} · {r.createdAt}</div>
                                    <div className="text-sm text-gray-300 mt-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: r.contentHtml?.substring(0, 200) || '' }} />
                                </div>
                            ))}
                            <Pagination page={page} totalPages={totalPages} onPageChange={p => handleSearch(p)} />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function PostItem({ post, depth = 0 }) {
    return (
        <div style={{ marginLeft: Math.min(depth * 24, 96) }}>
            <div className="bg-gray-800 border border-gray-700 rounded p-3">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-blue-300">{post.author}</span>
                    <span className="text-xs text-gray-500">{post.createdAt}</span>
                </div>
                {post.title && <div className="text-sm font-semibold mb-1">{post.title}</div>}
                <div className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: post.contentHtml || '' }} />
            </div>
            {post.children && post.children.map(child => (
                <PostItem key={child.postId} post={child} depth={depth + 1} />
            ))}
        </div>
    );
}

function Pagination({ page, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center gap-2 mt-4">
            <button
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="px-3 py-1 rounded bg-gray-700 text-sm disabled:opacity-50 hover:bg-gray-600"
            >上一页</button>
            <span className="px-3 py-1 text-sm text-gray-400">{page} / {totalPages}</span>
            <button
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="px-3 py-1 rounded bg-gray-700 text-sm disabled:opacity-50 hover:bg-gray-600"
            >下一页</button>
        </div>
    );
}
