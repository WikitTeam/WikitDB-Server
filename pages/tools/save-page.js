import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');

export default function SavePage() {
    const wikis = config.SUPPORT_WIKI || [];
    const [site, setSite] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');
    const [page, setPage] = useState('');
    const [title, setTitle] = useState('');
    const [source, setSource] = useState('');
    const [comments, setComments] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        if (!site) return setError('请选择站点');
        if (!username || !password) return setError('请填写账号和密码');
        if (!token) return setError('请填写授权 Token');
        if (!page) return setError('请填写页面名称');
        if (!source) return setError('请填写页面内容');
        setLoading(true);
        try {
            const r = await fetch('/api/tools/save-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site, username, password, token, page, title, source, comments })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            if (d.success) {
                setSuccess(d.message);
            } else {
                setError(d.error || '发布失败');
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Head><title>代发页面 - {config.SITE_NAME}</title></Head>
            <div className="py-8 max-w-2xl mx-auto">
                <div className="mb-6 border-b border-gray-700 pb-4 flex items-center gap-4">
                    <Link href="/tools" className="text-gray-400 hover:text-white transition-colors">
                        <i className="fa-solid fa-arrow-left"></i> 返回
                    </Link>
                    <h1 className="text-2xl font-bold text-white">代发页面</h1>
                </div>
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm">{error}</div>
                )}
                {success && (
                    <div className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-900/50 text-green-400 text-sm">
                        <i className="fa-solid fa-circle-check mr-2"></i>{success}
                    </div>
                )}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">目标站点</label>
                        <select value={site} onChange={e => setSite(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5">
                            <option value="">选择站点...</option>
                            {wikis.map(w => (
                                <option key={w.PARAM} value={w.PARAM}>{w.NAME} ({w.WIKIT_ID})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">授权 Token</label>
                        <input type="password" value={token} onChange={e => setToken(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                            placeholder="Wikit API 授权 Token" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Wikidot 账号</label>
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="留空则使用默认 Bot 账号" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">密码</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="留空则使用默认 Bot 密码" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">页面名称</label>
                            <input type="text" value={page} onChange={e => setPage(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="如 my-page" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">页面标题</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="可选" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">页面内容（Wikidot 源码）</label>
                        <textarea value={source} onChange={e => setSource(e.target.value)} rows={12}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5 font-mono"
                            placeholder="在此输入 Wikidot 语法的页面源码..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">编辑说明</label>
                        <input type="text" value={comments} onChange={e => setComments(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                            placeholder="可选，如：初次创建" />
                    </div>
                    <button onClick={handleSubmit} disabled={loading}
                        className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors">
                        {loading ? '发布中...' : '发布页面'}
                    </button>
                </div>
            </div>
        </>
    );
}
