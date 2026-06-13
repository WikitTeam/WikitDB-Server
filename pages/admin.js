import React, { useState, useEffect } from 'react';
import Head from 'next/head';

const config = require('../wikitdb.config.js');
const forumSyncSites = config.SUPPORT_WIKI.filter(w => w.FORUM_SYNC);

function KpiTile({ label, value }) {
    return (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 transition-all hover:shadow-md">
            <div className="text-xs font-medium text-neutral-400">{label}</div>
            <div className="mt-2 text-3xl font-bold text-neutral-100">{(value ?? 0).toLocaleString()}</div>
        </div>
    );
}

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [inspectData, setInspectData] = useState(null);
    const [inspectTarget, setInspectTarget] = useState('');
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [airdropAmount, setAirdropAmount] = useState(1000);
    const [taxRate, setTaxRate] = useState(5);
    const [bingoTagsInput, setBingoTagsInput] = useState('');
    const [bingoCostInput, setBingoCostInput] = useState(50);
    const [bountyTagsInput, setBountyTagsInput] = useState('');
    const [bountyMinRating, setBountyMinRating] = useState(10);
    const [bountyMaxRating, setBountyMaxRating] = useState(50);
    const [bountyBaseReward, setBountyBaseReward] = useState(800);
    const [quarantineData, setQuarantineData] = useState({ wikis: [], tags: [], authors: [] });
    const [qInput, setQInput] = useState({ wikis: '', tags: '', authors: '' });
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [accessLogs, setAccessLogs] = useState([]);
    const [accessLogFilter, setAccessLogFilter] = useState('');
    const [forumSyncSite, setForumSyncSite] = useState('all');
    const [forumSyncing, setForumSyncing] = useState(false);
    const [forumSyncResult, setForumSyncResult] = useState(null);
    const [honeypotLogs, setHoneypotLogs] = useState([]);
    const [overviewStats, setOverviewStats] = useState(null);
    useEffect(() => {
        fetch('/api/user/me', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(u => { if (u) setCurrentUser(u); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!currentUser?.isAdmin) return;
        Promise.all([
            fetch('/api/admin/users', { credentials: 'include' }).then(r => r.ok ? r.json() : { users: [] }),
            fetch('/api/admin/logs?limit=50', { credentials: 'include' }).then(r => r.ok ? r.json() : { logs: [] }),
            fetch('/api/admin/quarantine', { credentials: 'include' }).then(r => r.ok ? r.json() : { wikis: [], tags: [], authors: [] }),
            fetch('/api/admin/access-logs?limit=100', { credentials: 'include' }).then(r => r.ok ? r.json() : { logs: [] }),
            fetch('/api/admin/honeypot-logs?limit=200', { credentials: 'include' }).then(r => r.ok ? r.json() : { logs: [] }),
            fetch('/api/admin/overview', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        ]).then(([uData, lData, qData, aData, hData, oData]) => {
            setUsers(uData.users || []);
            setLogs(lData.logs || []);
            setQuarantineData({ wikis: qData.wikis || [], tags: qData.tags || [], authors: qData.authors || [] });
            setAccessLogs(aData.logs || []);
            setHoneypotLogs(hData.logs || []);
            if (oData) setOverviewStats(oData);
        });
    }, [currentUser]);

    if (!currentUser) return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
            <div className="text-neutral-400 text-sm">加载中...</div>
        </div>
    );
    if (!currentUser.isAdmin) return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-300 text-sm">无权限访问管理面板</div>
        </div>
    );

    const api = async (url, opts = {}) => {
        const r = await fetch(url, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
        return r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({})));
    };

    const refreshUsers = () => api('/api/admin/users').then(d => setUsers(d.users || []));
    const refreshLogs = () => api('/api/admin/logs?limit=50').then(d => setLogs(d.logs || []));
    const refreshAccessLogs = () => api('/api/admin/access-logs?limit=100').then(d => setAccessLogs(d.logs || []));
    const refreshHoneypot = () => api('/api/admin/honeypot-logs?limit=200').then(d => setHoneypotLogs(d.logs || []));

    const handleInspect = async () => {
        if (!inspectTarget.trim()) return;
        try {
            const d = await api(`/api/admin/inspect?username=${encodeURIComponent(inspectTarget.trim())}`);
            setInspectData(d);
        } catch { setInspectData({ error: '用户不存在' }); }
    };

    const handleBroadcast = async () => {
        if (!broadcastMsg.trim()) return;
        await api('/api/admin/broadcast', { method: 'POST', body: JSON.stringify({ message: broadcastMsg }) });
        setBroadcastMsg('');
        alert('已发送');
    };

    const handleAirdrop = async () => {
        await api('/api/admin/airdrop', { method: 'POST', body: JSON.stringify({ amount: airdropAmount }) });
        alert(`已向所有用户空投 ${airdropAmount} 代币`);
    };

    const handleTax = async () => {
        await api('/api/admin/tax', { method: 'POST', body: JSON.stringify({ rate: taxRate }) });
        alert(`已设置税率为 ${taxRate}%`);
    };

    const handleBingo = async () => {
        const tags = bingoTagsInput.split(',').map(t => t.trim()).filter(Boolean);
        if (!tags.length) return alert('请输入标签');
        await api('/api/admin/bingo', { method: 'POST', body: JSON.stringify({ tags, cost: bingoCostInput }) });
        alert('Bingo 已更新');
    };

    const handleBounty = async () => {
        const tags = bountyTagsInput.split(',').map(t => t.trim()).filter(Boolean);
        if (!tags.length) return alert('请输入标签');
        await api('/api/admin/bounty', { method: 'POST', body: JSON.stringify({ tags, minRating: bountyMinRating, maxRating: bountyMaxRating, baseReward: bountyBaseReward }) });
        alert('赏金已更新');
    };

    const handleQuarantineAdd = async (type) => {
        const val = qInput[type]?.trim();
        if (!val) return;
        await api('/api/admin/quarantine', { method: 'POST', body: JSON.stringify({ type, value: val }) });
        setQInput(p => ({ ...p, [type]: '' }));
        const d = await api('/api/admin/quarantine');
        setQuarantineData({ wikis: d.wikis || [], tags: d.tags || [], authors: d.authors || [] });
    };

    const handleQuarantineRemove = async (type, value) => {
        await api('/api/admin/quarantine', { method: 'DELETE', body: JSON.stringify({ type, value }) });
        const d = await api('/api/admin/quarantine');
        setQuarantineData({ wikis: d.wikis || [], tags: d.tags || [], authors: d.authors || [] });
    };

    const handleAdjust = async (username) => {
        if (!adjustAmount || isNaN(Number(adjustAmount))) return;
        setIsAdjusting(true);
        try {
            await api('/api/admin/adjust-balance', { method: 'POST', body: JSON.stringify({ username, amount: Number(adjustAmount), note: adjustNote }) });
            setAdjustAmount(''); setAdjustNote('');
            refreshUsers();
        } catch {} finally { setIsAdjusting(false); }
    };

    const handleForumSync = async () => {
        setForumSyncing(true); setForumSyncResult(null);
        try {
            const d = await api('/api/admin/forum-sync', { method: 'POST', body: JSON.stringify({ site: forumSyncSite }) });
            setForumSyncResult(d);
        } catch (e) { setForumSyncResult({ error: e.error || '同步失败' }); }
        finally { setForumSyncing(false); }
    };

    const clearHoneypot = async () => {
        if (!confirm('确定清空所有蜜罐日志？')) return;
        await api('/api/admin/honeypot-logs', { method: 'DELETE' });
        setHoneypotLogs([]);
    };

    const filteredUsers = users.filter(u => !searchQuery || u.username?.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredAccessLogs = accessLogs.filter(l => !accessLogFilter || l.ip?.includes(accessLogFilter) || l.path?.includes(accessLogFilter));

    const tabs = [
        { id: 'overview', label: '概览' },
        { id: 'honeypot', label: '蜜罐' },
        { id: 'members', label: '成员' },
        { id: 'quarantine', label: '隔离区' },
        { id: 'logs', label: '日志' },
        { id: 'broadcast', label: '广播' },
        { id: 'economy', label: '经济' },
        { id: 'forum', label: '论坛同步' },
        { id: 'access', label: '访问日志' },
    ];
    return (
        <>
            <Head><title>管理面板 - WikitDB</title></Head>
            <div className="min-h-screen bg-neutral-950 text-neutral-100">
                <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
                    <h1 className="text-2xl font-semibold text-neutral-100">管理中心</h1>

                    {/* Tab nav */}
                    <nav className="flex flex-wrap gap-1 rounded-lg border border-neutral-800/70 bg-neutral-900/50 p-1">
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'}`}>
                                {t.label}
                            </button>
                        ))}
                    </nav>

                    {/* Overview */}
                    {activeTab === 'overview' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <KpiTile label="注册用户" value={overviewStats?.totalUsers ?? users.length} />
                                <KpiTile label="总代币流通" value={overviewStats?.totalTokens} />
                                <KpiTile label="今日活跃" value={overviewStats?.dailyActive} />
                                <KpiTile label="蜜罐捕获" value={honeypotLogs.length} />
                            </div>
                            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-5">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">最近操作日志</div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {logs.slice(0, 10).map((l, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm border-b border-neutral-800/50 pb-2 last:border-0">
                                            <span className="text-neutral-300">{l.action || l.type}</span>
                                            <span className="text-neutral-500 text-xs">{l.createdAt?.slice(0, 16).replace('T', ' ')}</span>
                                        </div>
                                    ))}
                                    {logs.length === 0 && <div className="text-neutral-500 text-sm">暂无日志</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Honeypot */}
                    {activeTab === 'honeypot' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">蜜罐监控</div>
                                <div className="flex gap-2">
                                    <button onClick={refreshHoneypot} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">刷新</button>
                                    <button onClick={clearHoneypot} className="rounded-md border border-rose-800/50 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-900/30">清空</button>
                                </div>
                            </div>
                            <div className="rounded-lg border border-neutral-800/70 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className="bg-neutral-800/60">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">时间</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">IP</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">路径</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">方法</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">UA</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800/50 bg-neutral-900/40">
                                            {honeypotLogs.slice(0, 50).map((l, i) => (
                                                <tr key={i} className="hover:bg-neutral-800/30">
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300 whitespace-nowrap">{l.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                                                    <td className="px-4 py-2.5 text-sm font-mono text-neutral-200">{l.ip}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300 max-w-[200px] truncate">{l.path}</td>
                                                    <td className="px-4 py-2.5 text-sm"><span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs font-medium text-neutral-300">{l.method}</span></td>
                                                    <td className="px-4 py-2.5 text-xs text-neutral-500 max-w-[200px] truncate">{l.userAgent}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {honeypotLogs.length === 0 && <div className="p-6 text-center text-sm text-neutral-500">暂无蜜罐记录</div>}
                            </div>
                        </div>
                    )}
                    {/* Members */}
                    {activeTab === 'members' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索用户名..."
                                    className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-neutral-600" />
                            </div>
                            <div className="rounded-lg border border-neutral-800/70 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className="bg-neutral-800/60">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">用户名</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">余额</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">角色</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800/50 bg-neutral-900/40">
                                            {filteredUsers.map(u => (
                                                <tr key={u.username} className="hover:bg-neutral-800/30">
                                                    <td className="px-4 py-2.5 text-sm text-neutral-200">{u.username}</td>
                                                    <td className="px-4 py-2.5 text-sm font-mono text-neutral-300">{u.balance?.toLocaleString()}</td>
                                                    <td className="px-4 py-2.5 text-sm">{u.isAdmin ? <span className="rounded bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 text-xs text-amber-300">管理员</span> : <span className="text-neutral-500">用户</span>}</td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <button onClick={() => { setInspectTarget(u.username); handleInspect(); }} className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">查看</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {/* Inspect & Adjust */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">查询用户</div>
                                    <div className="flex gap-2">
                                        <input value={inspectTarget} onChange={e => setInspectTarget(e.target.value)} placeholder="用户名"
                                            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                        <button onClick={handleInspect} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">查询</button>
                                    </div>
                                    {inspectData && (
                                        <pre className="rounded-md bg-neutral-800/60 p-3 text-xs text-neutral-300 overflow-auto max-h-48">{JSON.stringify(inspectData, null, 2)}</pre>
                                    )}
                                </div>
                                <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">调整余额</div>
                                    <input value={inspectTarget} onChange={e => setInspectTarget(e.target.value)} placeholder="用户名"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    <div className="flex gap-2">
                                        <input value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="金额 (可为负)" type="number"
                                            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                        <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="备注"
                                            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    </div>
                                    <button onClick={() => handleAdjust(inspectTarget)} disabled={isAdjusting}
                                        className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">执行调整</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quarantine */}
                    {activeTab === 'quarantine' && (
                        <div className="space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">内容隔离区</div>
                            {['wikis', 'tags', 'authors'].map(type => (
                                <div key={type} className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
                                    <div className="text-sm font-medium text-neutral-200 capitalize">{type === 'wikis' ? 'Wiki 站点' : type === 'tags' ? '标签' : '作者'}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {(quarantineData[type] || []).map(v => (
                                            <span key={v} className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
                                                {v}
                                                <button onClick={() => handleQuarantineRemove(type, v)} className="text-neutral-500 hover:text-rose-400 ml-1">&times;</button>
                                            </span>
                                        ))}
                                        {(quarantineData[type] || []).length === 0 && <span className="text-xs text-neutral-500">空</span>}
                                    </div>
                                    <div className="flex gap-2">
                                        <input value={qInput[type] || ''} onChange={e => setQInput(p => ({ ...p, [type]: e.target.value }))} placeholder={`添加${type === 'wikis' ? '站点' : type === 'tags' ? '标签' : '作者'}...`}
                                            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                        <button onClick={() => handleQuarantineAdd(type)} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">添加</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Logs */}
                    {activeTab === 'logs' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">操作日志</div>
                                <button onClick={refreshLogs} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">刷新</button>
                            </div>
                            <div className="rounded-lg border border-neutral-800/70 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className="bg-neutral-800/60">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">时间</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">操作</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">用户</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">详情</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800/50 bg-neutral-900/40">
                                            {logs.map((l, i) => (
                                                <tr key={i} className="hover:bg-neutral-800/30">
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300 whitespace-nowrap">{l.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-200">{l.action || l.type}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300">{l.username || '-'}</td>
                                                    <td className="px-4 py-2.5 text-xs text-neutral-500 max-w-[300px] truncate">{l.details || l.payload || ''}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Broadcast */}
                    {activeTab === 'broadcast' && (
                        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-5 space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">全站广播</div>
                            <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={3} placeholder="输入广播内容..."
                                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none resize-none focus:ring-2 focus:ring-neutral-600" />
                            <button onClick={handleBroadcast} className="rounded-md bg-neutral-800 border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700">发送广播</button>
                        </div>
                    )}

                    {/* Economy */}
                    {activeTab === 'economy' && (
                        <div className="space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">宏观经济控制</div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
                                    <div className="text-sm font-medium text-neutral-200">空投</div>
                                    <input value={airdropAmount} onChange={e => setAirdropAmount(Number(e.target.value))} type="number"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    <button onClick={handleAirdrop} className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700">执行空投</button>
                                </div>
                                <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
                                    <div className="text-sm font-medium text-neutral-200">税率 (%)</div>
                                    <input value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} type="number"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    <button onClick={handleTax} className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700">设置税率</button>
                                </div>
                                <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
                                    <div className="text-sm font-medium text-neutral-200">Bingo 配置</div>
                                    <input value={bingoTagsInput} onChange={e => setBingoTagsInput(e.target.value)} placeholder="标签 (逗号分隔)"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    <input value={bingoCostInput} onChange={e => setBingoCostInput(Number(e.target.value))} type="number" placeholder="费用"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    <button onClick={handleBingo} className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700">更新 Bingo</button>
                                </div>
                            </div>
                            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
                                <div className="text-sm font-medium text-neutral-200">赏金任务配置</div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <input value={bountyTagsInput} onChange={e => setBountyTagsInput(e.target.value)} placeholder="标签 (逗号分隔)"
                                        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    <input value={bountyMinRating} onChange={e => setBountyMinRating(Number(e.target.value))} type="number" placeholder="最低评分"
                                        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    <input value={bountyMaxRating} onChange={e => setBountyMaxRating(Number(e.target.value))} type="number" placeholder="最高评分"
                                        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                    <input value={bountyBaseReward} onChange={e => setBountyBaseReward(Number(e.target.value))} type="number" placeholder="基础奖励"
                                        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none" />
                                </div>
                                <button onClick={handleBounty} className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700">更新赏金</button>
                            </div>
                        </div>
                    )}

                    {/* Forum Sync */}
                    {activeTab === 'forum' && (
                        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-5 space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">论坛同步</div>
                            <div className="flex gap-3 items-center">
                                <select value={forumSyncSite} onChange={e => setForumSyncSite(e.target.value)}
                                    className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none">
                                    <option value="all">全部站点</option>
                                    {forumSyncSites.map(s => <option key={s.SLUG} value={s.SLUG}>{s.NAME}</option>)}
                                </select>
                                <button onClick={handleForumSync} disabled={forumSyncing}
                                    className="rounded-md bg-neutral-800 border border-neutral-700 px-4 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">
                                    {forumSyncing ? '同步中...' : '开始同步'}
                                </button>
                            </div>
                            {forumSyncResult && (
                                <pre className="rounded-md bg-neutral-800/60 border border-neutral-700/50 p-3 text-xs text-neutral-300 overflow-auto max-h-48">{JSON.stringify(forumSyncResult, null, 2)}</pre>
                            )}
                        </div>
                    )}

                    {/* Access Logs */}
                    {activeTab === 'access' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">访问日志</div>
                                <input value={accessLogFilter} onChange={e => setAccessLogFilter(e.target.value)} placeholder="过滤 IP / 路径..."
                                    className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none" />
                                <button onClick={refreshAccessLogs} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">刷新</button>
                            </div>
                            <div className="rounded-lg border border-neutral-800/70 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className="bg-neutral-800/60">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">时间</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">IP</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">路径</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">状态</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800/50 bg-neutral-900/40">
                                            {filteredAccessLogs.slice(0, 100).map((l, i) => (
                                                <tr key={i} className="hover:bg-neutral-800/30">
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300 whitespace-nowrap">{l.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                                                    <td className="px-4 py-2.5 text-sm font-mono text-neutral-200">{l.ip}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300 max-w-[250px] truncate">{l.path}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-400">{l.status || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredAccessLogs.length === 0 && <div className="p-6 text-center text-sm text-neutral-500">暂无访问记录</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
