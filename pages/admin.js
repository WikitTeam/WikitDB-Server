import React, { useState, useEffect } from 'react';
import Head from 'next/head';

const config = require('../wikitdb.config.js');
const forumSyncSites = config.SUPPORT_WIKI.filter(w => w.FORUM_SYNC);

function KpiTile({ label, value }) {
    return (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 transition-all hover:border-neutral-700 hover:shadow-md">
            <div className="text-xs font-medium text-neutral-400">{label}</div>
            <div className="mt-2 text-3xl font-bold text-neutral-100">{(value ?? 0).toLocaleString()}</div>
        </div>
    );
}

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [currentUser, setCurrentUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
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
    const [sites, setSites] = useState([]);
    const [siteForm, setSiteForm] = useState({ NAME: '', URL: '', PARAM: '', WIKIT_ID: '', ImgURL: '', GQL_API: '', AUTHOR_TAG: '', ATTRIBUTION_PAGE: '', FORUM_SYNC: false });
    const [siteMsg, setSiteMsg] = useState(null);
    const [savingSite, setSavingSite] = useState(false);
    const [editingSiteParam, setEditingSiteParam] = useState(null);
    const [crawlerStatus, setCrawlerStatus] = useState(null);
    const [crawlerSites, setCrawlerSites] = useState([]);
    const [crawlerLoading, setCrawlerLoading] = useState(false);
    const [fileLogs, setFileLogs] = useState({ lines: [], totalLines: 0 });
    const [fileLogKey, setFileLogKey] = useState('crawler');
    const [fileLogLoading, setFileLogLoading] = useState(false);
    const [staffMsg, setStaffMsg] = useState(null);
    const [staffEditing, setStaffEditing] = useState(null);
    const [staffEditSites, setStaffEditSites] = useState([]);
    const authHeaders = () => {
        const h = { 'Content-Type': 'application/json' };
        if (typeof localStorage !== 'undefined') {
            const t = localStorage.getItem('token');
            if (t) h['Authorization'] = `Bearer ${t}`;
        }
        return h;
    };

    useEffect(() => {
        const tryFetch = async () => {
            const resp = await fetch('/api/user', { credentials: 'include', headers: authHeaders() }).catch(() => null);
            if (resp && resp.ok) {
                const me = await resp.json().catch(() => null);
                if (me && me.username) {
                    setCurrentUser(me);
                    return;
                }
            }
            if (typeof localStorage !== 'undefined') {
                const lsUser = localStorage.getItem('username');
                if (lsUser) {
                    const qresp = await fetch(`/api/user?username=${encodeURIComponent(lsUser)}`, {
                        credentials: 'include',
                        headers: authHeaders()
                    }).catch(() => null);
                    if (qresp && qresp.ok) {
                        const qme = await qresp.json().catch(() => null);
                        if (qme && qme.username) {
                            setCurrentUser(qme);
                            return;
                        }
                    }
                }
            }
        };

        tryFetch().finally(() => setAuthChecked(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!currentUser?.isAdmin) return;
        Promise.all([
            fetch('/api/admin/users', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : { users: [] }),
            fetch('/api/admin/logs?limit=50', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : { logs: [] }),
            fetch('/api/admin/quarantine', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : { wikis: [], tags: [], authors: [] }),
            fetch('/api/admin/access-logs?limit=100', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : { logs: [] }),
            fetch('/api/admin/honeypot-logs?limit=200', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : { logs: [] }),
            fetch('/api/admin/overview', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : null),
            fetch('/api/admin/sites', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : { sites: [] }),
            fetch('/api/admin/crawler-status', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : { sites: [] }),
            fetch('/api/admin/file-logs?file=crawler&lines=800', { credentials: 'include', headers: authHeaders() }).then(r => r.ok ? r.json() : { lines: [], totalLines: 0 }),
        ]).then(([uData, lData, qData, aData, hData, oData, siteData, crawlerData, fileLogData]) => {
            setUsers(uData.users || []);
            setLogs(lData.logs || []);
            setQuarantineData({ wikis: qData.wikis || [], tags: qData.tags || [], authors: qData.authors || [] });
            setAccessLogs(aData.logs || []);
            setHoneypotLogs(hData.logs || []);
            if (oData) setOverviewStats(oData);
            setSites(siteData.sites || []);
            setCrawlerStatus(crawlerData.status || null);
            setCrawlerSites(crawlerData.sites || []);
            if (fileLogData && Array.isArray(fileLogData.lines)) setFileLogs(fileLogData);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser?.isAdmin || activeTab !== 'crawler') return;
        refreshCrawler();
        const timer = setInterval(refreshCrawler, 10000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, activeTab]);

    const outerWrap = children => (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <div className="min-h-screen bg-neutral-950 py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
                <div className="max-w-7xl mx-auto w-full flex items-center justify-center">
                    {children}
                </div>
            </div>
        </div>
    );

    if (!authChecked) return outerWrap(
        <div className="text-neutral-400 text-sm">加载中...</div>
    );
    if (!currentUser) return outerWrap(
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
            <div className="text-neutral-400 text-sm mb-3">请先登录后访问管理面板</div>
            <a href="/login?redirect=/admin" className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">前往登录</a>
        </div>
    );
    if (!currentUser.isAdmin) return outerWrap(
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-300 text-sm">无权限访问管理面板</div>
    );

    const api = async (url, opts = {}) => {
        const r = await fetch(url, {
            credentials: 'include',
            ...opts,
            headers: { ...authHeaders(), ...(opts.headers || {}) }
        });
        return r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({})));
    };

    const refreshUsers = () => api('/api/admin/users').then(d => setUsers(d.users || []));
    const refreshLogs = () => api('/api/admin/logs?limit=50').then(d => setLogs(d.logs || []));
    const refreshAccessLogs = () => api('/api/admin/access-logs?limit=100').then(d => setAccessLogs(d.logs || []));
    const refreshHoneypot = () => api('/api/admin/honeypot-logs?limit=200').then(d => setHoneypotLogs(d.logs || []));
    const refreshSites = () => api('/api/admin/sites').then(d => setSites(d.sites || []));
    const refreshCrawler = () => {
        setCrawlerLoading(true);
        return api('/api/admin/crawler-status')
            .then(d => { setCrawlerStatus(d.status || null); setCrawlerSites(d.sites || []); })
            .catch(() => {})
            .finally(() => setCrawlerLoading(false));
    };
    const refreshFileLogs = (key = fileLogKey) => {
        setFileLogLoading(true);
        return api(`/api/admin/file-logs?file=${encodeURIComponent(key)}&lines=800`)
            .then(d => setFileLogs(d))
            .catch(() => setFileLogs({ lines: [], totalLines: 0 }))
            .finally(() => setFileLogLoading(false));
    };

    const handleAddSite = async () => {
        if (!siteForm.NAME || !siteForm.URL || !siteForm.PARAM || !siteForm.WIKIT_ID) {
            setSiteMsg({ type: 'error', text: '请填写必填字段（站点名称 / URL / PARAM / WIKIT_ID）' });
            return;
        }
        setSavingSite(true);
        setSiteMsg(null);
        try {
            const isEdit = !!editingSiteParam;
            const d = await api('/api/admin/sites', {
                method: isEdit ? 'PUT' : 'POST',
                body: JSON.stringify(isEdit ? { param: editingSiteParam, ...siteForm } : siteForm)
            });
            setSites(d.sites || []);
            setSiteMsg({ type: 'ok', text: isEdit ? (d.message || '站点已更新') : '站点已添加，配置已写入 wikitdb.config.js' });
            setEditingSiteParam(null);
            setSiteForm({ NAME: '', URL: '', PARAM: '', WIKIT_ID: '', ImgURL: '', GQL_API: '', AUTHOR_TAG: '', ATTRIBUTION_PAGE: '', FORUM_SYNC: false });
        } catch (e) {
            setSiteMsg({ type: 'error', text: e.error || (editingSiteParam ? '更新站点失败' : '添加站点失败') });
        } finally {
            setSavingSite(false);
        }
    };

    const handleEditSite = (site) => {
        setEditingSiteParam(site.PARAM);
        setSiteForm({
            NAME: site.NAME || '',
            URL: site.URL || '',
            PARAM: site.PARAM || '',
            WIKIT_ID: site.WIKIT_ID || '',
            ImgURL: site.ImgURL || '',
            GQL_API: site.GQL_API || '',
            AUTHOR_TAG: site.AUTHOR_TAG || '',
            ATTRIBUTION_PAGE: site.ATTRIBUTION_PAGE || '',
            FORUM_SYNC: !!site.FORUM_SYNC
        });
        setSiteMsg(null);
        document.querySelector('#site-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCancelEdit = () => {
        setEditingSiteParam(null);
        setSiteForm({ NAME: '', URL: '', PARAM: '', WIKIT_ID: '', ImgURL: '', GQL_API: '', AUTHOR_TAG: '', ATTRIBUTION_PAGE: '', FORUM_SYNC: false });
        setSiteMsg(null);
    };

    const handleDeleteSite = async (param) => {
        if (!confirm(`确定删除站点 "${param}"？此操作会立即修改 wikitdb.config.js。`)) return;
        try {
            const d = await api('/api/admin/sites', { method: 'DELETE', body: JSON.stringify({ param }) });
            setSites(d.sites || []);
            setSiteMsg({ type: 'ok', text: `站点 "${param}" 已删除` });
        } catch (e) {
            setSiteMsg({ type: 'error', text: e.error || '删除站点失败' });
        }
    };

    const handleSetStaff = async () => {
        if (!staffEditing) return;
        if (!staffEditSites.length) { setStaffMsg({ type: 'error', text: '请至少选择一个负责站点' }); return; }
        try {
            const d = await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ targetUser: staffEditing, action: 'set_staff', staffSites: staffEditSites }) });
            setStaffMsg({ type: 'ok', text: d.message || '已设置' });
            setStaffEditing(null);
            setStaffEditSites([]);
            refreshUsers();
        } catch (e) {
            setStaffMsg({ type: 'error', text: e.error || '设置失败' });
        }
    };

    const handleUnsetStaff = async (username) => {
        if (!confirm(`确定取消用户 ${username} 的职员身份？`)) return;
        try {
            const d = await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ targetUser: username, action: 'unset_staff' }) });
            setStaffMsg({ type: 'ok', text: d.message || '已取消' });
            refreshUsers();
        } catch (e) {
            setStaffMsg({ type: 'error', text: e.error || '操作失败' });
        }
    };

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
        { id: 'sites', label: '站点管理' },
        { id: 'crawler', label: '爬虫状态' },
        { id: 'honeypot', label: '蜜罐' },
        { id: 'members', label: '成员' },
        { id: 'quarantine', label: '隔离区' },
        { id: 'logs', label: '日志' },
        { id: 'broadcast', label: '广播' },
        { id: 'economy', label: '经济' },
        { id: 'forum', label: '论坛同步' },
        { id: 'access', label: '访问日志' },
    ];

    const inputCls = 'flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-indigo-500';
    const inputLgCls = 'rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-indigo-500';
    const btnGhost = 'rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800';
    const btnDanger = 'rounded-md border border-red-800 bg-neutral-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950';
    const btnPrimary = 'rounded-md bg-indigo-600 border border-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700';
    const cardCls = 'rounded-lg border border-neutral-800 bg-neutral-900 p-5';
    const tableTheadCls = 'bg-neutral-800';
    const tableRowCls = 'divide-y divide-neutral-800 bg-neutral-900';
    const hoverRowCls = 'hover:bg-neutral-800';

    const fmtTime = ts => ts ? new Date(ts).toLocaleString() : '-';

    const siteStatusBadge = (status) => {
        const map = {
            running: ['bg-amber-950 text-amber-300 border-amber-800', '运行中'],
            done: ['bg-emerald-950 text-emerald-300 border-emerald-800', '完成'],
            pending: ['bg-neutral-800 text-neutral-400 border-neutral-700', '等待'],
            error: ['bg-red-950 text-red-300 border-red-800', '异常'],
            skipped: ['bg-sky-950 text-sky-300 border-sky-800', '归属服务'],
        };
        const [cls, label] = map[status] || map.pending;
        return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
    };

    const siteStageLabel = (stage) => ({
        list: '拉取页面清单',
        crawl: '抓取评分/讨论',
        done: '已完成',
    }[stage] || '-');

    return (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <div className="min-h-screen bg-neutral-950 py-8 px-4 sm:px-6 lg:px-8">
                <Head><title>管理面板 - WikitDB</title></Head>
                <div className="max-w-7xl mx-auto space-y-6">
                    <h1 className="text-2xl font-semibold text-neutral-100">管理中心</h1>

                    {/* Tab nav */}
                    <nav className="flex flex-wrap gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'}`}>
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
                            <div className={cardCls}>
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">最近操作日志</div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {logs.slice(0, 10).map((l, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm border-b border-neutral-800 pb-2 last:border-0">
                                            <span className="text-neutral-300">{l.action || l.type}</span>
                                            <span className="text-neutral-500 text-xs">{l.createdAt?.slice(0, 16).replace('T', ' ')}</span>
                                        </div>
                                    ))}
                                    {logs.length === 0 && <div className="text-neutral-500 text-sm">暂无日志</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sites */}
                    {activeTab === 'sites' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">收录站点管理（写入 wikitdb.config.js）</div>
                                <button onClick={refreshSites} className={btnGhost}>刷新</button>
                            </div>

                            {siteMsg && (
                                <div className={`rounded-md border px-3 py-2 text-sm ${siteMsg.type === 'ok' ? 'border-emerald-800 bg-emerald-950 text-emerald-300' : 'border-red-800 bg-red-950 text-red-300'}`}>
                                    {siteMsg.text}
                                </div>
                            )}

                            <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className={tableTheadCls}>
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">站点</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">链接</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">PARAM</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">WIKIT_ID</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">归属页</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">论坛同步</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className={tableRowCls}>
                                            {sites.map(site => (
                                                <tr key={site.PARAM} className={hoverRowCls}>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-200">
                                                        <div className="flex items-center gap-2">
                                                            {site.ImgURL && <img src={site.ImgURL} alt="" className="h-6 w-6 rounded object-cover bg-neutral-800" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                                            <span>{site.NAME}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs text-indigo-400 max-w-[240px] truncate">
                                                        <a href={site.URL} target="_blank" rel="noreferrer" className="hover:underline">{site.URL}</a>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm font-mono text-neutral-300">{site.PARAM}</td>
                                                    <td className="px-4 py-2.5 text-sm font-mono text-neutral-300">{site.WIKIT_ID}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300">{site.ATTRIBUTION_PAGE ? <span className="font-mono text-xs text-indigo-400">{site.ATTRIBUTION_PAGE}</span> : '-'}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300">{site.FORUM_SYNC ? '是' : '否'}</td>
                                                    <td className="px-4 py-2.5 text-sm">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => handleEditSite(site)} className={btnGhost}>编辑</button>
                                                            <button onClick={() => handleDeleteSite(site.PARAM)} className={btnDanger}>删除</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {sites.length === 0 && <div className="p-6 text-center text-sm text-neutral-500">暂无收录站点</div>}
                            </div>

                            <div id="site-form-card" className={cardCls + ' space-y-3'}>
                                <div className="text-sm font-medium text-neutral-200">{editingSiteParam ? `编辑站点：${editingSiteParam}` : '添加站点'}</div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <input value={siteForm.NAME} onChange={e => setSiteForm(p => ({ ...p, NAME: e.target.value }))} placeholder="站点名称 *（如 深林文学部）" className={inputLgCls} />
                                    <input value={siteForm.URL} onChange={e => setSiteForm(p => ({ ...p, URL: e.target.value }))} placeholder="站点 URL *（如 https://xxx.wikidot.com/）" className={inputLgCls} />
                                    <input value={siteForm.PARAM} onChange={e => setSiteForm(p => ({ ...p, PARAM: e.target.value }))} placeholder="PARAM 简写 *（如 dfc）" className={inputLgCls} />
                                    <input value={siteForm.WIKIT_ID} onChange={e => setSiteForm(p => ({ ...p, WIKIT_ID: e.target.value }))} placeholder="WIKIT_ID *（Wikit 站点名）" className={inputLgCls} />
                                    <input value={siteForm.ImgURL} onChange={e => setSiteForm(p => ({ ...p, ImgURL: e.target.value }))} placeholder="Logo 链接（可选）" className={inputLgCls} />
                                    <input value={siteForm.GQL_API} onChange={e => setSiteForm(p => ({ ...p, GQL_API: e.target.value }))} placeholder="GQL_API 端点（可选，默认 wikit 官方）" className={inputLgCls} />
                                    <input value={siteForm.AUTHOR_TAG} onChange={e => setSiteForm(p => ({ ...p, AUTHOR_TAG: e.target.value }))} placeholder="作者标签（可选，默认 作者）" className={inputLgCls} />
                                    <input value={siteForm.ATTRIBUTION_PAGE} onChange={e => setSiteForm(p => ({ ...p, ATTRIBUTION_PAGE: e.target.value }))} placeholder="归属资料页面（可选，如 attribution-metadata）" className={inputLgCls} />
                                    <label className="flex items-center gap-2 text-sm text-neutral-300">
                                        <input type="checkbox" checked={!!siteForm.FORUM_SYNC} onChange={e => setSiteForm(p => ({ ...p, FORUM_SYNC: e.target.checked }))} className="h-4 w-4 rounded border-neutral-700 bg-neutral-950" />
                                        启用论坛同步 (FORUM_SYNC)
                                    </label>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={handleAddSite} disabled={savingSite} className={btnPrimary + ' disabled:opacity-50'}>{savingSite ? '保存中...' : (editingSiteParam ? '保存修改' : '添加站点')}</button>
                                    {editingSiteParam && <button onClick={handleCancelEdit} className={btnGhost}>取消编辑</button>}
                                </div>
                                <div className="text-xs text-neutral-500">提示：站点变更会立即写入 wikitdb.config.js。已构建的静态页面与正在运行的爬虫进程（npm run worker）需重启后才会使用新的站点列表。</div>
                            </div>
                        </div>
                    )}

                    {/* Crawler */}
                    {activeTab === 'crawler' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">爬虫运行状态（每 3 小时自动执行）</div>
                                <div className="flex items-center gap-2">
                                    {crawlerLoading && <span className="text-xs text-neutral-500">加载中...</span>}
                                    <button onClick={refreshCrawler} className={btnGhost}>刷新</button>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className={cardCls}>
                                    <div className="text-xs font-medium text-neutral-400">爬虫进程</div>
                                    <div className="mt-2 text-2xl font-bold text-neutral-100">{crawlerStatus?.running ? '运行中' : '空闲'}</div>
                                    {crawlerStatus?.running && <div className="mt-1 text-xs text-amber-400">{crawlerStatus.currentSite ? `正在抓取: ${crawlerStatus.currentSite}` : '准备中...'}（{siteStageLabel(crawlerStatus.currentStage)}）</div>}
                                </div>
                                <div className={cardCls}>
                                    <div className="text-xs font-medium text-neutral-400">站点进度</div>
                                    <div className="mt-2 text-2xl font-bold text-neutral-100">{crawlerStatus?.overall?.doneSites ?? 0} <span className="text-sm font-normal text-neutral-500">/ {crawlerStatus?.overall?.totalSites ?? crawlerSites.length}</span></div>
                                </div>
                                <div className={cardCls}>
                                    <div className="text-xs font-medium text-neutral-400">上次开始</div>
                                    <div className="mt-2 text-lg font-semibold text-neutral-100">{fmtTime(crawlerStatus?.startedAt)}</div>
                                </div>
                                <div className={cardCls}>
                                    <div className="text-xs font-medium text-neutral-400">上次完成</div>
                                    <div className="mt-2 text-lg font-semibold text-neutral-100">{fmtTime(crawlerStatus?.finishedAt || crawlerStatus?.lastRun)}</div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className={tableTheadCls}>
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">站点</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">状态</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">页面清单</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">已处理</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">评分</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">讨论</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">失败/重试</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">最近运行</th>
                                            </tr>
                                        </thead>
                                        <tbody className={tableRowCls}>
                                            {crawlerSites.map(s => (
                                                <tr key={s.param} className={hoverRowCls}>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-200">
                                                        <div>{s.name}</div>
                                                        <div className="text-xs font-mono text-neutral-500">{s.param}</div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm" title={s.error || ''}>{siteStatusBadge(s.status)}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300">{s.pagesFound ?? 0}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300">{s.pagesProcessed ?? 0}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300">{s.votes ?? 0}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300">{s.discussions ?? 0}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300">{s.errors ?? 0}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-500 whitespace-nowrap">{fmtTime(s.lastRun)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {crawlerSites.length === 0 && <div className="p-6 text-center text-sm text-neutral-500">暂无站点数据，请先运行爬虫进程（npm run worker）</div>}
                            </div>
                        </div>
                    )}

                    {/* Honeypot */}
                    {activeTab === 'honeypot' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">蜜罐监控</div>
                                <div className="flex gap-2">
                                    <button onClick={refreshHoneypot} className={btnGhost}>刷新</button>
                                    <button onClick={clearHoneypot} className={btnDanger}>清空</button>
                                </div>
                            </div>
                            <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className={tableTheadCls}>
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">时间</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">IP</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">路径</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">方法</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">UA</th>
                                            </tr>
                                        </thead>
                                        <tbody className={tableRowCls}>
                                            {honeypotLogs.slice(0, 50).map((l, i) => (
                                                <tr key={i} className={hoverRowCls}>
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
                                    className={inputLgCls} />
                            </div>

                            {staffMsg && (
                                <div className={`rounded-md border px-3 py-2 text-sm ${staffMsg.type === 'ok' ? 'border-emerald-800 bg-emerald-950 text-emerald-300' : 'border-red-800 bg-red-950 text-red-300'}`}>
                                    {staffMsg.text}
                                </div>
                            )}

                            {staffEditing && (
                                <div className={cardCls + ' space-y-3'}>
                                    <div className="text-sm font-medium text-neutral-200">
                                        设为职员：{staffEditing}
                                        <span className="ml-2 text-xs text-neutral-500">选择其负责的站点（可多选）</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {config.SUPPORT_WIKI.map(w => (
                                            <button key={w.PARAM} onClick={() => setStaffEditSites(p => p.includes(w.PARAM) ? p.filter(x => x !== w.PARAM) : [...p, w.PARAM])}
                                                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                                    staffEditSites.includes(w.PARAM)
                                                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                                                        : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                                                }`}>
                                                {w.NAME} ({w.PARAM})
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleSetStaff} className={btnPrimary}>确认设为职员</button>
                                        <button onClick={() => { setStaffEditing(null); setStaffEditSites([]); }} className={btnGhost}>取消</button>
                                        {staffEditSites.length === 0 && <span className="text-xs text-neutral-500">请至少选择一个站点</span>}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className={tableTheadCls}>
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">用户名</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">余额</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">角色</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">职员</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className={tableRowCls}>
                                            {filteredUsers.map(u => (
                                                <tr key={u.username} className={hoverRowCls}>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-200">{u.username}</td>
                                                    <td className="px-4 py-2.5 text-sm font-mono text-neutral-300">{u.balance?.toLocaleString()}</td>
                                                    <td className="px-4 py-2.5 text-sm">{u.isAdmin ? <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-xs text-amber-400">管理员</span> : <span className="text-neutral-500">用户</span>}</td>
                                                    <td className="px-4 py-2.5 text-sm">
                                                        {u.isStaff ? (
                                                            <div>
                                                                <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-xs text-emerald-400">职员</span>
                                                                <div className="mt-0.5 text-[10px] text-neutral-500">{(u.staffSites || []).join('、')}</div>
                                                            </div>
                                                        ) : <span className="text-neutral-600">-</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => { setInspectTarget(u.username); handleInspect(); }} className={btnGhost}>查看</button>
                                                            {u.isStaff ? (
                                                                <button onClick={() => handleUnsetStaff(u.username)} className={btnGhost + ' !text-red-400 hover:!border-red-500/50'}>取消职员</button>
                                                            ) : (
                                                                <button onClick={() => { setStaffEditing(u.username); setStaffEditSites(u.staffSites || []); setStaffMsg(null); }} className={btnGhost + ' !text-emerald-400 hover:!border-emerald-500/50'}>设为职员</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Inspect & Adjust */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className={cardCls + ' space-y-3'}>
                                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">查询用户</div>
                                    <div className="flex gap-2">
                                        <input value={inspectTarget} onChange={e => setInspectTarget(e.target.value)} placeholder="用户名"
                                            className={inputCls} />
                                        <button onClick={handleInspect} className={btnGhost}>查询</button>
                                    </div>
                                    {inspectData && (
                                        <pre className="rounded-md bg-neutral-800 border border-neutral-700 p-3 text-xs text-neutral-300 overflow-auto max-h-48">{JSON.stringify(inspectData, null, 2)}</pre>
                                    )}
                                </div>
                                <div className={cardCls + ' space-y-3'}>
                                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">调整余额</div>
                                    <input value={inspectTarget} onChange={e => setInspectTarget(e.target.value)} placeholder="用户名"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <div className="flex gap-2">
                                        <input value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="金额 (可为负)" type="number"
                                            className={inputCls} />
                                        <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="备注"
                                            className={inputCls} />
                                    </div>
                                    <button onClick={() => handleAdjust(inspectTarget)} disabled={isAdjusting}
                                        className={btnPrimary + ' disabled:opacity-50'}>执行调整</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quarantine */}
                    {activeTab === 'quarantine' && (
                        <div className="space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">内容隔离区</div>
                            {['wikis', 'tags', 'authors'].map(type => (
                                <div key={type} className={cardCls + ' space-y-3'}>
                                    <div className="text-sm font-medium text-neutral-200 capitalize">{type === 'wikis' ? 'Wiki 站点' : type === 'tags' ? '标签' : '作者'}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {(quarantineData[type] || []).map(v => (
                                            <span key={v} className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
                                                {v}
                                                <button onClick={() => handleQuarantineRemove(type, v)} className="text-neutral-500 hover:text-red-400 ml-1">&times;</button>
                                            </span>
                                        ))}
                                        {(quarantineData[type] || []).length === 0 && <span className="text-xs text-neutral-500">空</span>}
                                    </div>
                                    <div className="flex gap-2">
                                        <input value={qInput[type] || ''} onChange={e => setQInput(p => ({ ...p, [type]: e.target.value }))} placeholder={`添加${type === 'wikis' ? '站点' : type === 'tags' ? '标签' : '作者'}...`}
                                            className={inputCls} />
                                        <button onClick={() => handleQuarantineAdd(type)} className={btnGhost}>添加</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Logs */}
                    {activeTab === 'logs' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">操作日志</div>
                                <button onClick={refreshLogs} className={btnGhost}>刷新</button>
                            </div>
                            <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className={tableTheadCls}>
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">时间</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">操作</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">用户</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">详情</th>
                                            </tr>
                                        </thead>
                                        <tbody className={tableRowCls}>
                                            {logs.map((l, i) => (
                                                <tr key={i} className={hoverRowCls}>
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

                    {/* File Logs */}
                    {activeTab === 'logs' && (
                        <div className={cardCls + ' space-y-3'}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">服务器 / 爬虫文件日志</div>
                                <div className="flex items-center gap-2">
                                    <select value={fileLogKey} onChange={e => { setFileLogKey(e.target.value); refreshFileLogs(e.target.value); }}
                                        className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="crawler">crawler.log（爬虫）</option>
                                        <option value="server">server.log</option>
                                        <option value="serverErr">server-err.log</option>
                                    </select>
                                    <button onClick={() => refreshFileLogs()} className={btnGhost}>{fileLogLoading ? '加载中...' : '刷新'}</button>
                                </div>
                            </div>
                            <pre className="rounded-md bg-neutral-800 border border-neutral-700 p-3 text-xs text-neutral-300 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                                {fileLogs.lines && fileLogs.lines.length > 0 ? fileLogs.lines.join('\n') : '（暂无日志内容）'}
                            </pre>
                            {fileLogs.totalLines > 0 && (
                                <div className="text-xs text-neutral-500">
                                    共 {fileLogs.totalLines} 行，显示最近 {fileLogs.lines ? fileLogs.lines.length : 0} 行
                                    {fileLogs.mtime ? `（最后更新：${fmtTime(fileLogs.mtime)}）` : ''}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Broadcast */}
                    {activeTab === 'broadcast' && (
                        <div className={cardCls + ' space-y-4'}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">全站广播</div>
                            <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={3} placeholder="输入广播内容..."
                                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none resize-none focus:ring-2 focus:ring-indigo-500" />
                            <button onClick={handleBroadcast} className={btnPrimary}>发送广播</button>
                        </div>
                    )}

                    {/* Economy */}
                    {activeTab === 'economy' && (
                        <div className="space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">宏观经济控制</div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div className={cardCls + ' space-y-3'}>
                                    <div className="text-sm font-medium text-neutral-200">空投</div>
                                    <input value={airdropAmount} onChange={e => setAirdropAmount(Number(e.target.value))} type="number"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <button onClick={handleAirdrop} className={btnPrimary}>执行空投</button>
                                </div>
                                <div className={cardCls + ' space-y-3'}>
                                    <div className="text-sm font-medium text-neutral-200">税率 (%)</div>
                                    <input value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} type="number"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <button onClick={handleTax} className={btnPrimary}>设置税率</button>
                                </div>
                                <div className={cardCls + ' space-y-3'}>
                                    <div className="text-sm font-medium text-neutral-200">Bingo 配置</div>
                                    <input value={bingoTagsInput} onChange={e => setBingoTagsInput(e.target.value)} placeholder="标签 (逗号分隔)"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <input value={bingoCostInput} onChange={e => setBingoCostInput(Number(e.target.value))} type="number" placeholder="费用"
                                        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <button onClick={handleBingo} className={btnPrimary}>更新 Bingo</button>
                                </div>
                            </div>
                            <div className={cardCls + ' space-y-3'}>
                                <div className="text-sm font-medium text-neutral-200">赏金任务配置</div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <input value={bountyTagsInput} onChange={e => setBountyTagsInput(e.target.value)} placeholder="标签 (逗号分隔)"
                                        className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <input value={bountyMinRating} onChange={e => setBountyMinRating(Number(e.target.value))} type="number" placeholder="最低评分"
                                        className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <input value={bountyMaxRating} onChange={e => setBountyMaxRating(Number(e.target.value))} type="number" placeholder="最高评分"
                                        className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <input value={bountyBaseReward} onChange={e => setBountyBaseReward(Number(e.target.value))} type="number" placeholder="基础奖励"
                                        className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <button onClick={handleBounty} className={btnPrimary}>更新赏金</button>
                            </div>
                        </div>
                    )}

                    {/* Forum Sync */}
                    {activeTab === 'forum' && (
                        <div className={cardCls + ' space-y-4'}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">论坛同步</div>
                            <div className="flex gap-3 items-center">
                                <select value={forumSyncSite} onChange={e => setForumSyncSite(e.target.value)}
                                    className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="all">全部站点</option>
                                    {forumSyncSites.map(s => <option key={s.SLUG} value={s.SLUG}>{s.NAME}</option>)}
                                </select>
                                <button onClick={handleForumSync} disabled={forumSyncing}
                                    className={btnPrimary + ' disabled:opacity-50'}>
                                    {forumSyncing ? '同步中...' : '开始同步'}
                                </button>
                            </div>
                            {forumSyncResult && (
                                <pre className="rounded-md bg-neutral-800 border border-neutral-700 p-3 text-xs text-neutral-300 overflow-auto max-h-48">{JSON.stringify(forumSyncResult, null, 2)}</pre>
                            )}
                        </div>
                    )}

                    {/* Access Logs */}
                    {activeTab === 'access' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">访问日志</div>
                                <input value={accessLogFilter} onChange={e => setAccessLogFilter(e.target.value)} placeholder="过滤 IP / 路径..."
                                    className={inputCls} />
                                <button onClick={refreshAccessLogs} className={btnGhost}>刷新</button>
                            </div>
                            <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-800">
                                        <thead className={tableTheadCls}>
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">时间</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">IP</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">路径</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">状态</th>
                                            </tr>
                                        </thead>
                                        <tbody className={tableRowCls}>
                                            {filteredAccessLogs.slice(0, 100).map((l, i) => (
                                                <tr key={i} className={hoverRowCls}>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300 whitespace-nowrap">{l.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                                                    <td className="px-4 py-2.5 text-sm font-mono text-neutral-200">{l.ip}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-300 max-w-[250px] truncate">{l.path}</td>
                                                    <td className="px-4 py-2.5 text-sm text-neutral-500">{l.status || '-'}</td>
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
        </div>
    );
}