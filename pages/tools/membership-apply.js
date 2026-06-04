import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');

export default function MembershipApply() {
    const [siteUrl, setSiteUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [sessionId, setSessionId] = useState('');

    const [applications, setApplications] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [declineReason, setDeclineReason] = useState('');

    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!username || !password) return setError('请填写用户名和密码');
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/tools/membership-apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSessionId(data.sessionId);
            setError('');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFetchList = async () => {
        if (!siteUrl) return setError('请填写站点 URL');
        if (!sessionId) return setError('请先登录');
        let url = siteUrl.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        setSiteUrl(url);
        setLoading(true);
        setError('');
        setApplications([]);
        setSelected(new Set());
        setResult(null);
        try {
            const res = await fetch('/api/tools/membership-apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list', siteUrl: url, sessionId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setApplications(data.applications || []);
            if (data.applications.length === 0) {
                if (data.debug) {
                    console.log('[membership-apply] debug:', data.debug);
                    setError('未解析到申请列表。调试信息已输出到控制台(F12)。' + (data.debug.length < 200 ? ' ' + data.debug : ''));
                } else {
                    setError('当前没有待审批的申请');
                }
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (idx) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === applications.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(applications.map((_, i) => i)));
        }
    };

    const handleProcess = async (decision) => {
        if (selected.size === 0) return setError('请至少选择一个申请');
        const selectedApps = applications.filter((_, i) => selected.has(i));
        const label = decision === 'accept' ? '通过' : '拒绝';
        if (!confirm(`确定要${label} ${selectedApps.length} 个申请吗？`)) return;

        setProcessing(true);
        setError('');
        setResult(null);
        try {
            const res = await fetch('/api/tools/membership-apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'process',
                    siteUrl,
                    sessionId,
                    applications: selectedApps,
                    decision,
                    message: decision === 'decline' ? declineReason : ''
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setResult(data);
            setSelected(new Set());
            handleFetchList();
        } catch (e) {
            setError(e.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <>
            <Head>
                <title>批量审批申请 - {config.SITE_NAME}</title>
            </Head>

            <div className="py-8 max-w-4xl mx-auto">
                <div className="mb-6 border-b border-gray-700 pb-4 flex items-center gap-4">
                    <Link href="/tools" className="text-gray-400 hover:text-white transition-colors">
                        <i className="fa-solid fa-arrow-left"></i> 返回
                    </Link>
                    <h1 className="text-2xl font-bold text-white">批量审批站点申请</h1>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-900/50 text-green-400 text-sm">
                        <div className="font-bold mb-1">{result.message}</div>
                        {result.results && result.results.filter(r => !r.success).length > 0 && (
                            <div className="mt-2 text-red-400 text-xs">
                                失败项：{result.results.filter(r => !r.success).map(r => `${r.userName}(${r.error})`).join('、')}
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4">1. 登录 Wikidot</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Wikidot 用户名</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="你的 Wikidot 管理员账号"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">密码</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleLogin}
                            disabled={loading || !!sessionId}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            {sessionId ? '已登录' : loading ? '登录中...' : '登录'}
                        </button>
                        {sessionId && (
                            <span className="text-green-400 text-sm flex items-center gap-1">
                                <i className="fa-solid fa-circle-check"></i> Session: {sessionId.substring(0, 8)}...
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4">2. 拉取待审批列表</h2>
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-300 mb-1">站点 URL</label>
                            <input
                                type="text"
                                value={siteUrl}
                                onChange={e => setSiteUrl(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="https://your-site.wikidot.com"
                            />
                        </div>
                        <button
                            onClick={handleFetchList}
                            disabled={loading || !sessionId}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                        >
                            {loading ? '加载中...' : '拉取列表'}
                        </button>
                    </div>
                </div>

                {applications.length > 0 && (
                    <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">
                                3. 审批操作 <span className="text-sm font-normal text-gray-400">({applications.length} 条申请)</span>
                            </h2>
                            <button
                                onClick={toggleAll}
                                className="text-sm text-indigo-400 hover:text-indigo-300"
                            >
                                {selected.size === applications.length ? '取消全选' : '全选'}
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto mb-6">
                            {applications.map((app, idx) => (
                                <label
                                    key={idx}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                        selected.has(idx)
                                            ? 'bg-indigo-900/20 border-indigo-500/50'
                                            : 'bg-gray-900/40 border-gray-700/50 hover:border-gray-600'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.has(idx)}
                                        onChange={() => toggleSelect(idx)}
                                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white">{app.userName}</div>
                                        <div className="text-xs text-gray-500 flex gap-3">
                                            {app.date && <span>{app.date}</span>}
                                            {app.comment && <span className="truncate">理由: {app.comment}</span>}
                                        </div>
                                    </div>
                                    {app.userId && (
                                        <span className="text-xs text-gray-600 font-mono">#{app.userId}</span>
                                    )}
                                </label>
                            ))}
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-1">拒绝理由（仅拒绝时使用）</label>
                            <input
                                type="text"
                                value={declineReason}
                                onChange={e => setDeclineReason(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="选填"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleProcess('accept')}
                                disabled={processing || selected.size === 0}
                                className="flex-1 px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors"
                            >
                                {processing ? '处理中...' : `批量通过 (${selected.size})`}
                            </button>
                            <button
                                onClick={() => handleProcess('decline')}
                                disabled={processing || selected.size === 0}
                                className="flex-1 px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors"
                            >
                                {processing ? '处理中...' : `批量拒绝 (${selected.size})`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
