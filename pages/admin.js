import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

const config = require('../wikitdb.config.js');
const forumSyncSites = config.SUPPORT_WIKI.filter(w => w.FORUM_SYNC);

function StatCard({ icon, label, value, color = 'indigo', sub }) {
    const colors = {
        indigo: 'from-indigo-600/20 to-indigo-600/5 border-indigo-500/20 text-indigo-400',
        green: 'from-green-600/20 to-green-600/5 border-green-500/20 text-green-400',
        red: 'from-red-600/20 to-red-600/5 border-red-500/20 text-red-400',
        orange: 'from-orange-600/20 to-orange-600/5 border-orange-500/20 text-orange-400',
        cyan: 'from-cyan-600/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    };
    return (
        <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 flex items-center gap-4`}>
            <div className="w-11 h-11 rounded-xl bg-black/20 flex items-center justify-center text-lg">
                <i className={`fa-solid ${icon}`}></i>
            </div>
            <div>
                <div className="text-2xl font-bold text-white font-mono">{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}

function SectionHeader({ title, icon, children }) {
    return (
        <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <i className={`fa-solid ${icon} text-gray-500`}></i> {title}
            </h3>
            {children}
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
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) setCurrentUser(storedUsername);
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        if (activeTab === 'overview') fetchOverview();
        if (activeTab === 'members') fetchUsers();
        if (activeTab === 'logs') fetchLogs();
        if (activeTab === 'broadcast') fetchBroadcast();
        if (activeTab === 'settings') fetchSettings();
        if (activeTab === 'quarantine') fetchQuarantine();
        if (activeTab === 'access-logs') fetchAccessLogs();
        if (activeTab === 'honeypot') fetchHoneypotLogs();
    }, [activeTab, currentUser]);

    const fetchOverview = async () => {
        try {
            const [usersRes, logsRes, honeypotRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/admin/access-logs?limit=500'),
                fetch('/api/admin/honeypot-logs?limit=100'),
            ]);
            const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
            const logsData = logsRes.ok ? await logsRes.json() : { logs: [] };
            const honeypotData = honeypotRes.ok ? await honeypotRes.json() : { logs: [] };
            const hpLogs = honeypotData.logs || [];
            const uniqueIPs = new Set(hpLogs.map(l => l.ip)).size;
            const today = new Date().toISOString().slice(0, 10);
            const todayHits = hpLogs.filter(l => l.createdAt?.startsWith(today)).length;
            setOverviewStats({
                totalUsers: usersData.users?.length || 0,
                bannedUsers: usersData.users?.filter(u => u.status === 'banned').length || 0,
                totalRequests: logsData.logs?.length || 0,
                honeypotHits: hpLogs.length,
                honeypotUniqueIPs: uniqueIPs,
                honeypotToday: todayHits,
            });
        } catch (e) {
            setOverviewStats({ totalUsers: 0, bannedUsers: 0, totalRequests: 0, honeypotHits: 0, honeypotUniqueIPs: 0, honeypotToday: 0 });
        }
    };

    const fetchHoneypotLogs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/honeypot-logs?limit=200');
            if (res.ok) setHoneypotLogs((await res.json()).logs || []);
        } catch (e) {}
        setIsLoading(false);
    };

    const clearHoneypotLogs = async () => {
        if (!confirm('确定清空全部蜜罐日志？此操作不可逆。')) return;
        await fetch('/api/admin/honeypot-logs', { method: 'DELETE' });
        setHoneypotLogs([]);
    };
    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) setUsers((await res.json()).users || []);
        } catch (e) {}
        setIsLoading(false);
    };

    const handleUserAction = async (targetUser, action) => {
        if (action === 'delete') {
            if (!confirm(`警告：确定要永久抹除 ${targetUser} 的档案吗？`)) return;
            if (!confirm(`再次确认：彻底删除操作不可逆转！`)) return;
        } else {
            if (!confirm(`确定要对 ${targetUser} 执行此操作吗？`)) return;
        }
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUser, action, operator: currentUser })
            });
            if (res.ok) fetchUsers();
            else alert((await res.json()).error || '操作失败');
        } catch (e) {}
    };

    const handleInspect = async (username) => {
        setInspectTarget(username);
        setInspectData(null);
        try {
            const res = await fetch(`/api/admin/user-assets?username=${username}`);
            if (res.ok) setInspectData((await res.json()).portfolio || {});
        } catch (e) {}
    };

    const handleAdjustBalance = async () => {
        if (isAdjusting) return;
        if (!adjustAmount || isNaN(Number(adjustAmount))) return alert('请输入有效的数字');
        if (!confirm(`确定要对 ${inspectTarget} 的账户 ${Number(adjustAmount) > 0 ? '增加' : '扣除'} ${Math.abs(adjustAmount)} 吗？`)) return;
        setIsAdjusting(true);
        try {
            const res = await fetch('/api/admin/adjust-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUser: inspectTarget, amount: adjustAmount, note: adjustNote, operator: currentUser })
            });
            const data = await res.json();
            if (res.ok) { alert('资金调账成功！'); setAdjustAmount(''); setAdjustNote(''); handleInspect(inspectTarget); }
            else alert(data.error);
        } catch (e) { alert('网络连接错误'); }
        finally { setIsAdjusting(false); }
    };

    const fetchLogs = async () => { try { const res = await fetch('/api/admin/logs'); if (res.ok) setLogs((await res.json()).logs || []); } catch (e) {} };
    const fetchBroadcast = async () => { try { const res = await fetch('/api/admin/broadcast'); if (res.ok) setBroadcastMsg((await res.json()).message || ''); } catch (e) {} };
    const saveBroadcast = async () => { try { await fetch('/api/admin/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: broadcastMsg }) }); alert('广播设置成功'); } catch (e) {} };

    const executeMacro = async (action) => {
        if (!confirm('警告：该操作将影响全站所有用户，确定执行吗？')) return;
        try {
            const res = await fetch('/api/admin/macro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, amount: airdropAmount, rate: taxRate }) });
            if (res.ok) { const data = await res.json(); alert(`执行完毕，影响了 ${data.affected} 个账户。`); }
        } catch (e) {}
    };

    const fetchSettings = async () => {
        try {
            const resBingo = await fetch('/api/tools/bingo');
            if (resBingo.ok) { const data = await resBingo.json(); setBingoTagsInput((data.tags || []).join(', ')); setBingoCostInput(data.cost || 50); }
            const resBounty = await fetch('/api/tools/bounty?action=config');
            if (resBounty.ok) { const data = await resBounty.json(); setBountyTagsInput((data.tags || []).join(', ')); setBountyMinRating(data.minRating || 10); setBountyMaxRating(data.maxRating || 50); setBountyBaseReward(data.baseReward || 800); }
        } catch (e) {}
    };

    const saveBingoSettings = async () => {
        const tagsArray = bingoTagsInput.split(/[,，]/).map(t => t.trim()).filter(t => t);
        try { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'bingo', data: { tags: tagsArray, cost: Number(bingoCostInput) || 50 } }) }); if (res.ok) alert('大乐透配置保存成功！'); else alert('保存失败'); } catch (e) { alert('网络错误'); }
    };

    const saveBountySettings = async () => {
        const tagsArray = bountyTagsInput.split(/[,，]/).map(t => t.trim()).filter(t => t);
        try { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'bounty', data: { tags: tagsArray, minRating: Number(bountyMinRating), maxRating: Number(bountyMaxRating), baseReward: Number(bountyBaseReward) } }) }); if (res.ok) alert('悬赏令配置保存成功！'); else alert('保存失败'); } catch (e) { alert('网络错误'); }
    };

    const fetchQuarantine = async () => { try { const res = await fetch('/api/admin/quarantine'); if (res.ok) setQuarantineData(await res.json()); } catch (e) {} };
    const addQuarantine = async (type) => { const val = qInput[type]; if (!val) return; try { await fetch('/api/admin/quarantine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, value: val }) }); setQInput(prev => ({...prev, [type]: ''})); fetchQuarantine(); } catch (e) {} };
    const removeQuarantine = async (type, value) => { if (!confirm(`确认解除对 ${value} 的隔离状态？`)) return; try { await fetch('/api/admin/quarantine', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, value }) }); fetchQuarantine(); } catch (e) {} };

    const fetchAccessLogs = async (pathFilter) => {
        setIsLoading(true);
        try { const params = new URLSearchParams(); if (pathFilter) params.set('path', pathFilter); const res = await fetch(`/api/admin/access-logs?${params}`); if (res.ok) setAccessLogs((await res.json()).logs || []); } catch (e) {}
        setIsLoading(false);
    };

    const handleForumSync = async () => {
        setForumSyncing(true); setForumSyncResult(null);
        try { const res = await fetch(`/api/forum/sync?site=${forumSyncSite}`, { method: 'POST' }); const data = await res.json(); setForumSyncResult(res.ok ? data.stats : { error: data.error }); }
        catch (e) { setForumSyncResult({ error: e.message }); }
        finally { setForumSyncing(false); }
    };

    const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));
    const navItems = [
        { id: 'overview', label: '系统总览', icon: 'fa-chart-pie' },
        { id: 'honeypot', label: '蜜罐监控', icon: 'fa-skull-crossbones' },
        { id: 'members', label: '成员管理', icon: 'fa-users' },
        { id: 'quarantine', label: '数据隔离', icon: 'fa-shield-virus' },
        { id: 'logs', label: '交易审计', icon: 'fa-list-check' },
        { id: 'broadcast', label: '全站广播', icon: 'fa-bullhorn' },
        { id: 'macro', label: '宏观经济', icon: 'fa-money-bill-trend-up' },
        { id: 'forum-sync', label: '论坛同步', icon: 'fa-comments' },
        { id: 'access-logs', label: '网络日志', icon: 'fa-globe' },
        { id: 'settings', label: '系统设置', icon: 'fa-sliders' }
    ];

    if (!currentUser) return (
        <div className="flex flex-col items-center justify-center py-24 text-red-500 font-bold text-lg">
            <i className="fa-solid fa-lock text-4xl mb-4 opacity-50"></i>
            权限不足，请先登录管理员账号
        </div>
    );

    return (
        <>
            <Head><title>中央控制台 - WikitDB</title></Head>
            <div className="flex flex-col lg:flex-row gap-6">
                <aside className="w-full lg:w-56 flex-shrink-0">
                    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-1.5 sticky top-20">
                        <div className="px-3 py-2.5 mb-1">
                            <h1 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">控制台</h1>
                        </div>
                        <nav className="flex flex-row lg:flex-col gap-0.5 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
                            {navItems.map(item => (
                                <button key={item.id} onClick={() => setActiveTab(item.id)}
                                    className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                                        activeTab === item.id
                                            ? 'bg-indigo-600/15 text-indigo-300 shadow-sm shadow-indigo-500/10'
                                            : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                                    }`}>
                                    <i className={`fa-solid ${item.icon} w-4 text-center text-[11px]`}></i>
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                <main className="flex-1 min-w-0">
                    <div className="mb-5 flex items-center gap-3">
                        <i className={`fa-solid ${navItems.find(i => i.id === activeTab)?.icon} text-indigo-400`}></i>
                        <h2 className="text-xl font-bold text-white">{navItems.find(i => i.id === activeTab)?.label}</h2>
                    </div>
                    {activeTab === 'overview' && overviewStats && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                <StatCard icon="fa-users" label="注册用户" value={overviewStats.totalUsers} color="indigo" />
                                <StatCard icon="fa-ban" label="封禁账户" value={overviewStats.bannedUsers} color="red" />
                                <StatCard icon="fa-server" label="API 日志" value={overviewStats.totalRequests} color="cyan" sub="最近500条" />
                                <StatCard icon="fa-skull-crossbones" label="蜜罐触发" value={overviewStats.honeypotHits} color="orange" />
                                <StatCard icon="fa-fingerprint" label="独立攻击IP" value={overviewStats.honeypotUniqueIPs} color="red" />
                                <StatCard icon="fa-clock" label="今日攻击" value={overviewStats.honeypotToday} color="green" />
                            </div>
                            <div className="p-5 bg-gray-900/60 border border-gray-800 rounded-2xl">
                                <h4 className="text-xs font-medium text-gray-500 mb-3">快速操作</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: '蜜罐监控', tab: 'honeypot', icon: 'fa-skull-crossbones', color: 'text-orange-400' },
                                        { label: '成员管理', tab: 'members', icon: 'fa-users', color: 'text-indigo-400' },
                                        { label: '全站广播', tab: 'broadcast', icon: 'fa-bullhorn', color: 'text-cyan-400' },
                                        { label: '系统设置', tab: 'settings', icon: 'fa-sliders', color: 'text-gray-400' },
                                    ].map(q => (
                                        <button key={q.tab} onClick={() => setActiveTab(q.tab)} className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-xl text-xs font-medium text-gray-300 transition-all">
                                            <i className={`fa-solid ${q.icon} ${q.color}`}></i> {q.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'honeypot' && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">{honeypotLogs.length} 条蜜罐记录</span>
                                <button onClick={clearHoneypotLogs} className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs font-medium rounded-lg border border-red-800/30 transition-colors">
                                    <i className="fa-solid fa-trash-can mr-1.5"></i>清空日志
                                </button>
                            </div>
                            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-800/60 text-gray-500 border-b border-gray-800 text-[10px] uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">时间</th>
                                                <th className="px-4 py-3">IP</th>
                                                <th className="px-4 py-3">方法</th>
                                                <th className="px-4 py-3">诱饵路径</th>
                                                <th className="px-4 py-3">User-Agent</th>
                                                <th className="px-4 py-3">Payload</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800/50">
                                            {isLoading ? (
                                                <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-600 animate-pulse">加载中...</td></tr>
                                            ) : honeypotLogs.length === 0 ? (
                                                <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-600">暂无蜜罐触发记录 — 攻击者还没上钩</td></tr>
                                            ) : honeypotLogs.map((log, i) => (
                                                <tr key={log.id || i} className="hover:bg-red-900/5 transition-colors">
                                                    <td className="px-4 py-2.5 text-gray-500 font-mono whitespace-nowrap">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                                                    <td className="px-4 py-2.5 font-mono text-orange-400 font-medium">{log.ip}</td>
                                                    <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-semibold">{log.method}</span></td>
                                                    <td className="px-4 py-2.5 font-mono text-red-300 max-w-[180px] truncate" title={log.path}>{log.path}</td>
                                                    <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate" title={log.userAgent}>{log.userAgent || '-'}</td>
                                                    <td className="px-4 py-2.5 text-gray-600 font-mono max-w-[150px] truncate" title={log.payload}>{log.payload || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'members' && (
                        <div className="space-y-5">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <span className="text-xs text-gray-500">共 {users.length} 位用户</span>
                                <div className="relative w-full sm:w-56">
                                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs"></i>
                                    <input type="text" placeholder="搜索用户名..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all" />
                                </div>
                            </div>
                            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-800/60 text-gray-500 border-b border-gray-800 text-[10px] uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3 w-10"></th>
                                            <th className="px-5 py-3">用户名</th>
                                            <th className="px-5 py-3">权限</th>
                                            <th className="px-5 py-3 text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50 text-gray-300">
                                        {isLoading ? (
                                            <tr><td colSpan="4" className="px-5 py-12 text-center text-gray-600 animate-pulse">加载中...</td></tr>
                                        ) : filteredUsers.length === 0 ? (
                                            <tr><td colSpan="4" className="px-5 py-12 text-center text-gray-600">无结果</td></tr>
                                        ) : filteredUsers.map(user => (
                                            <tr key={user.username} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-5 py-3"><div className={`w-2 h-2 rounded-full ${user.status === 'banned' ? 'bg-red-500' : 'bg-green-500'}`}></div></td>
                                                <td className="px-5 py-3 font-medium text-white">{user.username}</td>
                                                <td className="px-5 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'admin' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-gray-800 text-gray-500'}`}>
                                                        {user.role === 'admin' ? 'ADMIN' : 'USER'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleInspect(user.username)} className="px-2 py-1 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 rounded text-[10px] font-bold">资产</button>
                                                        {user.status === 'banned'
                                                            ? <button onClick={() => handleUserAction(user.username, 'unban')} className="w-6 h-6 flex items-center justify-center rounded bg-green-900/20 text-green-500 hover:bg-green-900/40" title="解封"><i className="fa-solid fa-unlock text-[10px]"></i></button>
                                                            : <button onClick={() => handleUserAction(user.username, 'ban')} className="w-6 h-6 flex items-center justify-center rounded bg-yellow-900/20 text-yellow-500 hover:bg-yellow-900/40" title="封禁"><i className="fa-solid fa-ban text-[10px]"></i></button>
                                                        }
                                                        <button onClick={() => handleUserAction(user.username, 'delete')} className="w-6 h-6 flex items-center justify-center rounded bg-red-900/20 text-red-500 hover:bg-red-900/40" title="删除"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'quarantine' && (
                        <div className="space-y-6">
                            <div className="p-4 bg-orange-900/10 border border-orange-800/20 rounded-xl text-xs text-orange-400/80 flex gap-3 items-start">
                                <i className="fa-solid fa-shield-virus mt-0.5"></i>
                                <span>此处定义的标识符将被全局提取端点忽略，用于封锁违规或低质量数据源。</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {['wikis', 'tags', 'authors'].map(type => (
                                    <div key={type} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                                        <h4 className="text-xs font-semibold text-white mb-3 flex items-center justify-between">
                                            {type === 'wikis' ? '站点' : type === 'tags' ? '标签' : '作者'}
                                            <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">{quarantineData[type].length}</span>
                                        </h4>
                                        <div className="flex gap-2 mb-3">
                                            <input type="text" placeholder="输入..." value={qInput[type]} onChange={e => setQInput({...qInput, [type]: e.target.value})} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-white focus:border-indigo-500 outline-none" />
                                            <button onClick={() => addQuarantine(type)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs border border-gray-700">+</button>
                                        </div>
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {quarantineData[type].map(item => (
                                                <div key={item} className="flex justify-between items-center bg-gray-800/50 px-3 py-1.5 rounded group">
                                                    <span className="text-gray-400 font-mono text-[11px]">{item}</span>
                                                    <button onClick={() => removeQuarantine(type, item)} className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-xs"><i className="fa-solid fa-xmark"></i></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
                            <ul className="divide-y divide-gray-800/50">
                                {logs.length === 0 ? (
                                    <li className="p-12 text-center text-gray-600 text-xs">暂无审计记录</li>
                                ) : logs.map((log, i) => {
                                    const l = typeof log === 'string' ? JSON.parse(log) : log;
                                    return (
                                        <li key={i} className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] ${l.action === 'buy' ? 'bg-green-900/20 text-green-500' : l.action === 'sell' ? 'bg-red-900/20 text-red-500' : 'bg-gray-800 text-gray-400'}`}>
                                                    {l.action === 'buy' ? '买' : l.action === 'sell' ? '卖' : '令'}
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-300"><span className="font-bold text-indigo-400 mr-1.5">{l.username || l.operator}</span>{l.target && <span className="text-gray-600 font-mono">→ {l.target}</span>}</div>
                                                    <div className="text-[10px] text-gray-600 font-mono mt-0.5">{new Date(l.time).toLocaleString('zh-CN')}</div>
                                                </div>
                                            </div>
                                            {l.amount && <div className="text-xs font-bold text-white font-mono">{l.amount}<span className="text-gray-600 ml-1">份</span></div>}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                    {activeTab === 'broadcast' && (
                        <div className="max-w-2xl space-y-5">
                            <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-2xl space-y-4">
                                <textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} placeholder="输入全站顶部广播内容..."
                                    className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all resize-none" />
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-600">留空则关闭广播</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setBroadcastMsg('')} className="px-4 py-2 text-gray-500 hover:text-white text-xs transition-colors">清空</button>
                                        <button onClick={saveBroadcast} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-all">下发广播</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'macro' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-2xl space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-green-900/20 rounded-lg flex items-center justify-center text-green-500"><i className="fa-solid fa-parachute-box"></i></div>
                                    <div><h3 className="font-bold text-white text-sm">全员空投</h3><p className="text-[10px] text-gray-500">为所有用户发放信用点</p></div>
                                </div>
                                <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 flex justify-between items-center">
                                    <span className="text-xs text-gray-500">发放数额</span>
                                    <input type="number" value={airdropAmount} onChange={e => setAirdropAmount(e.target.value)} className="bg-transparent border-none text-right text-white font-bold font-mono focus:ring-0 w-20 p-0 text-sm" />
                                </div>
                                <button onClick={() => executeMacro('airdrop')} className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-xl font-medium text-xs transition-all">执行空投</button>
                            </div>
                            <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-2xl space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-red-900/20 rounded-lg flex items-center justify-center text-red-500"><i className="fa-solid fa-hand-holding-dollar"></i></div>
                                    <div><h3 className="font-bold text-white text-sm">全站征税</h3><p className="text-[10px] text-gray-500">按比例回收余额</p></div>
                                </div>
                                <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 flex justify-between items-center">
                                    <span className="text-xs text-gray-500">税率 (%)</span>
                                    <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="bg-transparent border-none text-right text-white font-bold font-mono focus:ring-0 w-16 p-0 text-sm" />
                                </div>
                                <button onClick={() => executeMacro('tax')} className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl font-medium text-xs transition-all">执行征税</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'forum-sync' && (
                        <div className="max-w-2xl space-y-5">
                            <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-2xl space-y-5">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-2">目标站点</label>
                                    <select value={forumSyncSite} onChange={e => setForumSyncSite(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-xs focus:border-indigo-500 outline-none">
                                        <option value="all">全部已启用站点</option>
                                        {forumSyncSites.map(w => <option key={w.PARAM} value={w.PARAM}>{w.NAME} ({w.PARAM})</option>)}
                                    </select>
                                </div>
                                <div className="p-3 bg-yellow-900/10 border border-yellow-800/20 rounded-lg text-[10px] text-yellow-400/80">
                                    <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>受 Wikidot 限速约束，大型论坛可能耗时较长。
                                </div>
                                <button onClick={handleForumSync} disabled={forumSyncing} className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl font-medium text-xs transition-all">
                                    {forumSyncing ? <span><i className="fa-solid fa-spinner fa-spin mr-1.5"></i>同步中...</span> : '开始同步'}
                                </button>
                                {forumSyncResult && (
                                    <div className={`p-4 rounded-xl border text-xs ${forumSyncResult.error ? 'bg-red-900/10 border-red-800/20 text-red-400' : 'bg-green-900/10 border-green-800/20 text-green-400'}`}>
                                        {forumSyncResult.error ? <span><i className="fa-solid fa-xmark mr-1.5"></i>{forumSyncResult.error}</span> : (
                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                <div><div className="text-lg font-bold text-white font-mono">{forumSyncResult.categories}</div><div className="text-gray-500">分类</div></div>
                                                <div><div className="text-lg font-bold text-white font-mono">{forumSyncResult.threads}</div><div className="text-gray-500">帖子</div></div>
                                                <div><div className="text-lg font-bold text-white font-mono">{forumSyncResult.posts}</div><div className="text-gray-500">回复</div></div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'access-logs' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                <div className="relative flex-1 max-w-xs">
                                    <i className="fa-solid fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-[10px]"></i>
                                    <input type="text" placeholder="按路径筛选..." value={accessLogFilter} onChange={(e) => setAccessLogFilter(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchAccessLogs(accessLogFilter)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all" />
                                </div>
                                <button onClick={() => fetchAccessLogs(accessLogFilter)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg border border-gray-700">筛选</button>
                                <button onClick={() => { setAccessLogFilter(''); fetchAccessLogs(); }} className="px-3 py-2 text-gray-500 hover:text-white text-xs">重置</button>
                                <span className="text-[10px] text-gray-600 ml-auto">{accessLogs.length} 条</span>
                            </div>
                            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-800/60 text-gray-500 border-b border-gray-800 text-[10px] uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3">时间</th>
                                            <th className="px-4 py-3">方法</th>
                                            <th className="px-4 py-3">路径</th>
                                            <th className="px-4 py-3">状态</th>
                                            <th className="px-4 py-3">IP</th>
                                            <th className="px-4 py-3">用户</th>
                                            <th className="px-4 py-3 text-right">耗时</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50 text-gray-300">
                                        {isLoading ? (
                                            <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-600 animate-pulse">加载中...</td></tr>
                                        ) : accessLogs.length === 0 ? (
                                            <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-600">暂无记录</td></tr>
                                        ) : accessLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-4 py-2 text-gray-500 font-mono whitespace-nowrap">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                                                <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${log.method === 'GET' ? 'bg-green-500/10 text-green-400' : log.method === 'POST' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-red-500/10 text-red-400'}`}>{log.method}</span></td>
                                                <td className="px-4 py-2 font-mono text-gray-300 max-w-[160px] truncate" title={log.path}>{log.path}</td>
                                                <td className="px-4 py-2"><span className={`text-[10px] font-medium ${log.status >= 400 ? 'text-red-400' : 'text-green-400'}`}>{log.status}</span></td>
                                                <td className="px-4 py-2 text-gray-500 font-mono">{log.ip || '-'}</td>
                                                <td className="px-4 py-2">{log.username ? <span className="text-indigo-400">{log.username}</span> : <span className="text-gray-600">-</span>}</td>
                                                <td className="px-4 py-2 text-gray-500 font-mono text-right">{log.duration != null ? `${log.duration}ms` : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><span className="text-teal-400">乐</span> 标签大乐透</h3>
                                <div>
                                    <label className="block text-[10px] text-gray-500 mb-1.5">候选标签池</label>
                                    <textarea value={bingoTagsInput} onChange={e => setBingoTagsInput(e.target.value)} className="w-full h-20 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-white focus:border-teal-500 outline-none resize-none" placeholder="原创, scp, 故事..." />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 mb-1.5">单次价格</label>
                                    <input type="number" value={bingoCostInput} onChange={e => setBingoCostInput(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs" />
                                </div>
                                <button onClick={saveBingoSettings} className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-medium transition-all">保存</button>
                            </div>
                            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><span className="text-orange-400">赏</span> 悬赏令配置</h3>
                                <div>
                                    <label className="block text-[10px] text-gray-500 mb-1.5">目标标签</label>
                                    <textarea value={bountyTagsInput} onChange={e => setBountyTagsInput(e.target.value)} className="w-full h-16 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-white focus:border-orange-500 outline-none resize-none" placeholder="原创, 精品..." />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className="block text-[10px] text-gray-500 mb-1.5">最低评分</label><input type="number" value={bountyMinRating} onChange={e => setBountyMinRating(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs" /></div>
                                    <div><label className="block text-[10px] text-gray-500 mb-1.5">最高评分</label><input type="number" value={bountyMaxRating} onChange={e => setBountyMaxRating(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs" /></div>
                                    <div><label className="block text-[10px] text-gray-500 mb-1.5">基础奖励</label><input type="number" value={bountyBaseReward} onChange={e => setBountyBaseReward(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs" /></div>
                                </div>
                                <button onClick={saveBountySettings} className="w-full py-2.5 bg-orange-700 hover:bg-orange-600 text-white rounded-xl text-xs font-medium transition-all">保存</button>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {inspectTarget && inspectData && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-white text-sm flex items-center gap-2"><i className="fa-solid fa-id-card text-indigo-400"></i>{inspectTarget}</h3>
                            <button onClick={() => { setInspectTarget(''); setInspectData(null); }} className="text-gray-600 hover:text-white transition-colors"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-5">
                            <div className="p-4 bg-indigo-600/5 rounded-xl border border-indigo-500/10 flex justify-between items-center">
                                <span className="text-xs text-gray-500">余额</span>
                                <span className="text-2xl font-mono text-green-400 font-bold">¥{(inspectData?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="space-y-2">
                                {Object.entries(inspectData).filter(([k]) => k !== 'balance').map(([key, value]) => {
                                    const shares = typeof value === 'object' ? value.shares : Number(value);
                                    const cost = typeof value === 'object' ? value.avgCost : 0;
                                    if (shares === 0) return null;
                                    return (
                                        <div key={key} className="flex justify-between items-center bg-gray-800/50 border border-gray-800 px-4 py-3 rounded-xl">
                                            <span className="font-medium text-gray-300 text-xs">{key}</span>
                                            <div className="text-right">
                                                <span className={`font-mono text-xs font-bold ${shares > 0 ? 'text-indigo-400' : 'text-orange-400'}`}>{shares > 0 ? '+' : ''}{shares}</span>
                                                <div className="text-[10px] text-gray-600 font-mono">avg ¥{Number(cost).toFixed(2)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="pt-4 border-t border-gray-800 space-y-3">
                                <h4 className="text-[10px] font-medium text-orange-400 uppercase tracking-wider">调账</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="金额 (±)" className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:border-orange-500 outline-none" />
                                    <input type="text" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="备注" className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-xs focus:border-orange-500 outline-none" />
                                </div>
                                <button onClick={handleAdjustBalance} disabled={isAdjusting} className="w-full py-2.5 bg-orange-900/30 hover:bg-orange-800/50 text-orange-400 font-medium rounded-xl text-xs border border-orange-800/30 transition-all">
                                    {isAdjusting ? '处理中...' : '执行调账'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

