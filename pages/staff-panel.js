import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../wikitdb.config.js');

const STATUS_META = {
    pending: { label: '待审核', cls: 'bg-yellow-500/10 border-yellow-500/30 text-amber-600 dark:text-amber-400' },
    approved: { label: '已通过', cls: 'bg-accent-soft text-accent border-accent-line' },
    sent: { label: '已发送', cls: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' },
    rejected: { label: '已拒绝', cls: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' },
    failed: { label: '发送失败', cls: 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400' },
};

const FILTERS = [
    { value: 'pending', label: '待审核' },
    { value: 'approved', label: '已通过' },
    { value: 'sent', label: '已发送' },
    { value: 'rejected', label: '已拒绝' },
    { value: 'failed', label: '发送失败' },
    { value: '', label: '全部' },
];

export default function StaffPanel() {
    const [authChecked, setAuthChecked] = useState(false);
    const [allowed, setAllowed] = useState(false);
    const [filter, setFilter] = useState('pending');
    const [posts, setPosts] = useState([]);
    const [bots, setBots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState(null);
    const [actingId, setActingId] = useState(null);
    const [expanded, setExpanded] = useState({});
    const [approveBot, setApproveBot] = useState({});
    const [rejectNote, setRejectNote] = useState({});

    const siteName = (param) => {
        const w = config.SUPPORT_WIKI.find(x => x.PARAM === param);
        return w ? w.NAME : param;
    };

    // 鉴权：仅职员 / 管理员可访问
    useEffect(() => {
        (async () => {
            try {
                const r = await fetch('/api/user', { credentials: 'include' });
                if (r.ok) {
                    const me = await r.json();
                    if (me && (me.isStaff || me.isAdmin)) setAllowed(true);
                }
            } catch (e) { /* 忽略 */ }
            setAuthChecked(true);
        })();
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const r = await fetch(`/api/staff/proxy-posts?status=${filter}`, { credentials: 'include' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || '读取失败');
            setPosts(d.posts || []);
            setBots(d.bots || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        if (authChecked && allowed) refresh();
    }, [authChecked, allowed, refresh]);

    const postBots = (site) => bots.filter(b => !b.scanSites || b.scanSites.length === 0 || b.scanSites.includes(site));

    const callApi = async (payload) => {
        const r = await fetch('/api/staff/proxy-posts', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || '操作失败');
        return d;
    };

    const handleApprove = async (post) => {
        const botId = approveBot[post.id];
        if (!botId) { setMsg({ type: 'error', text: '请先选择用于发送的机器人' }); return; }
        setActingId(post.id);
        setMsg(null);
        try {
            const d = await callApi({ id: post.id, action: 'approve', botAccountId: botId });
            setMsg({ type: d.success ? 'ok' : 'error', text: d.message });
            refresh();
        } catch (e) {
            setMsg({ type: 'error', text: e.message });
        } finally {
            setActingId(null);
        }
    };

    const handleSend = async (post) => {
        const botId = approveBot[post.id];
        if (!botId) { setMsg({ type: 'error', text: '请先选择用于发送的机器人' }); return; }
        setActingId(post.id);
        setMsg(null);
        try {
            const d = await callApi({ id: post.id, action: 'send', botAccountId: botId });
            setMsg({ type: d.success ? 'ok' : 'error', text: d.message });
            refresh();
        } catch (e) {
            setMsg({ type: 'error', text: e.message });
        } finally {
            setActingId(null);
        }
    };

    const handleReject = async (post) => {
        setActingId(post.id);
        setMsg(null);
        try {
            const d = await callApi({ id: post.id, action: 'reject', note: rejectNote[post.id] || '' });
            setMsg({ type: 'ok', text: d.message });
            refresh();
        } catch (e) {
            setMsg({ type: 'error', text: e.message });
        } finally {
            setActingId(null);
        }
    };

    if (!authChecked) {
        return (
            <div className="py-16 text-center text-fg-3 text-sm">正在验证身份...</div>
        );
    }

    if (!allowed) {
        return (
            <>
                <Head><title>职员面板 - {config.SITE_NAME}</title></Head>
                <div className="py-16 max-w-xl mx-auto">
                    <div className="bg-panel rounded-xl p-8 border border-line text-center">
                        <i className="fa-solid fa-user-lock text-4xl text-fg-3 mb-4"></i>
                        <h1 className="text-xl font-bold text-fg mb-2">无权访问</h1>
                        <p className="text-sm text-fg-2 mb-6">职员面板仅对标记为「职员」的用户开放。如需访问请联系站点管理员。</p>
                        <Link href="/" className="inline-block px-5 py-2.5 bg-accent-solid hover:bg-accent-solid-hover text-accent-fg text-sm font-medium rounded-lg transition-colors">返回首页</Link>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head><title>职员面板 - {config.SITE_NAME}</title></Head>
            <div className="py-8">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-6 border-b border-line pb-4 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-4">
                            <Link href="/tools" className="text-fg-3 hover:text-fg transition-colors">
                                <i className="fa-solid fa-arrow-left"></i> 返回
                            </Link>
                            <h1 className="text-2xl font-bold text-fg flex items-center gap-2">
                                <i className="fa-solid fa-user-shield text-accent"></i> 职员面板
                            </h1>
                            <span className="text-xs text-fg-3">审核代发请求，审核通过后由职员登记的机器人发送</span>
                        </div>
                        <button onClick={refresh} disabled={loading}
                            className="px-4 py-2 bg-accent-solid hover:bg-accent-solid-hover disabled:opacity-50 text-accent-fg text-sm rounded-lg transition-colors">
                            {loading ? '刷新中...' : <><i className="fa-solid fa-rotate mr-1"></i>刷新</>}
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">{error}</div>
                    )}
                    {msg && (
                        <div className={`mb-4 p-3 rounded-lg border text-sm ${msg.type === 'ok' ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'}`}>
                            <i className={`fa-solid mr-2 ${msg.type === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>{msg.text}
                        </div>
                    )}

                    <div className="mb-4 flex flex-wrap gap-2">
                        {FILTERS.map(f => (
                            <button key={f.value || 'all'} onClick={() => setFilter(f.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                    filter === f.value
                                        ? 'bg-accent-solid border-accent-solid text-accent-fg'
                                        : 'bg-sunken border-line text-fg-3 hover:text-fg'
                                }`}>
                                {f.label}
                            </button>
                        ))}
                    </div>

                                            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-800/50">
                        {loading ? (
                            <div className="p-12 text-center text-sm text-fg-3">加载中...</div>
                        ) : posts.length === 0 ? (
                            <div className="p-12 text-center text-sm text-fg-3">
                                <i className="fa-solid fa-inbox text-3xl text-fg-3 block mb-3"></i>
                                当前筛选下暂无审核单
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">单号</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-2">站点 / 页面</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-2">标题</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-2">提交人</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-2">提交时间</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-2">状态</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fg-2">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {posts.map(post => {
                                            const st = STATUS_META[post.status] || STATUS_META.pending;
                                            const usable = postBots(post.site);
                                            return (
                                                <React.Fragment key={post.id}>
                                                    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 font-mono">#{post.id}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{siteName(post.site)}</div>
                                                            <div className="text-xs text-fg-3 font-mono">/{post.page}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 max-w-[180px] truncate">{post.title || '-'}</td>
                                                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{post.username}</td>
                                                        <td className="px-4 py-3 text-xs text-fg-3 whitespace-nowrap">{new Date(post.createdAt).toLocaleString()}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                                                            {post.botLabel && <div className="text-[10px] text-fg-3 mt-1">{post.botLabel}</div>}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-end gap-2 flex-wrap">
                                                                <button onClick={() => setExpanded(p => ({ ...p, [post.id]: !p[post.id] }))}
                                                                    className="px-2.5 py-1.5 bg-accent-solid hover:bg-accent-solid-hover text-accent-fg text-xs rounded-lg transition-colors">
                                                                    {expanded[post.id] ? '收起' : '查看'}
                                                                </button>
                                                                {post.status === 'pending' && (
                                                                    <>
                                                                        <button onClick={() => handleApprove(post)} disabled={actingId === post.id}
                                                                            className="px-2.5 py-1.5 bg-accent-solid hover:bg-accent-solid-hover disabled:opacity-50 text-accent-fg text-xs rounded-lg transition-colors">
                                                                            {actingId === post.id ? '发送中...' : '通过'}
                                                                        </button>
                                                                        <button onClick={() => handleReject(post)} disabled={actingId === post.id}
                                                                            className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors">
                                                                            {actingId === post.id ? '处理中...' : '拒绝'}
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {(post.status === 'approved' || post.status === 'failed') && (
                                                                    <button onClick={() => handleSend(post)} disabled={actingId === post.id}
                                                                        className="px-2.5 py-1.5 bg-green-600/80 hover:bg-green-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors">
                                                                        {actingId === post.id ? '发送中...' : '重新发送'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {expanded[post.id] && (
                                                        <tr className="bg-zinc-50 dark:bg-zinc-900/40">
                                                            <td colSpan={7} className="px-4 py-4">
                                                                <div className="grid gap-3 sm:grid-cols-2 mb-3">
                                                                    <div className="text-xs text-fg-3">
                                                                        编辑说明：{post.comments || '-'}
                                                                        {post.reviewNote && <div className="mt-1 text-orange-600 dark:text-orange-400">审核备注：{post.reviewNote}</div>}
                                                                        {post.reviewedBy && <div className="mt-1">审核人：{post.reviewedBy}</div>}
                                                                        {post.sendResult && (
                                                                            <div className="mt-1 text-fg-2 whitespace-pre-wrap">发送结果：{post.sendResult}</div>
                                                                        )}
                                                                    </div>
                                                                    {post.status === 'pending' && usable.length === 0 && (
                                                                        <div className="text-xs text-red-600 dark:text-red-400 self-center">
                                                                            <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                                                                            暂无可用机器人（需先在删帖公示操作中由职员登记机器人，并可在站点列表标注该站点）
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                    <span className="text-xs font-medium text-fg-3">发送机器人：</span>
                                                                    <select value={approveBot[post.id] || ''} onChange={e => setApproveBot(p => ({ ...p, [post.id]: e.target.value }))}
                                                                        className="bg-sunken border border-line text-fg text-sm rounded-lg p-1.5">
                                                                        <option value="">选择机器人...</option>
                                                                        {usable.map(b => (
                                                                            <option key={b.id} value={b.id}>{b.name}（{b.username}）{b.createdBy ? ` · ${b.createdBy}` : ''}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                    <span className="text-xs font-medium text-fg-3">拒绝备注：</span>
                                                                    <input value={rejectNote[post.id] || ''} onChange={e => setRejectNote(p => ({ ...p, [post.id]: e.target.value }))}
                                                                        placeholder="选填，拒绝原因（仅拒绝时需要）"
                                                                        className="bg-sunken border border-line text-fg text-sm rounded-lg p-1.5 flex-1 min-w-[220px]" />
                                                                </div>
                                                                <div className="rounded-lg border border-line bg-sunken p-3 max-h-72 overflow-auto">
                                                                    <div className="text-[10px] uppercase tracking-wide text-fg-3 mb-1">页面源码预览</div>
                                                                    <pre className="text-xs text-fg-2 font-mono whitespace-pre-wrap leading-relaxed">{post.source}</pre>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
