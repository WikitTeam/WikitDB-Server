import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('members');
    const [currentUser, setCurrentUser] = useState(null);
    
    // 成员管理与审计状态
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [inspectData, setInspectData] = useState(null);
    const [inspectTarget, setInspectTarget] = useState('');
    
    // 全站广播与宏观状态
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [airdropAmount, setAirdropAmount] = useState(1000);
    const [taxRate, setTaxRate] = useState(5);
    
    // 裸键终端状态
    const [redisKey, setRedisKey] = useState('');
    const [redisValue, setRedisValue] = useState('');

    // 娱乐模块配置状态
    const [bingoTagsInput, setBingoTagsInput] = useState('');
    const [bingoCostInput, setBingoCostInput] = useState(50);
    const [bountyTagsInput, setBountyTagsInput] = useState('');
    const [bountyMinRating, setBountyMinRating] = useState(10);
    const [bountyMaxRating, setBountyMaxRating] = useState(50);
    const [bountyBaseReward, setBountyBaseReward] = useState(800);

    // 数据隔离网状态
    const [quarantineData, setQuarantineData] = useState({ wikis: [], tags: [], authors: [] });
    const [qInput, setQInput] = useState({ wikis: '', tags: '', authors: '' });

    // 调账工具专属状态
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) setCurrentUser(storedUsername);

        if (activeTab === 'members') fetchUsers();
        if (activeTab === 'logs') fetchLogs();
        if (activeTab === 'broadcast') fetchBroadcast();
        if (activeTab === 'settings') fetchSettings();
        if (activeTab === 'quarantine') fetchQuarantine();
    }, [activeTab]);

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
            if (res.ok) {
                const data = await res.json();
                setInspectData(data.portfolio || {});
            }
        } catch (e) {}
    };

    const handleAdjustBalance = async () => {
        if (isAdjusting) return; 
        if (!adjustAmount || isNaN(Number(adjustAmount))) {
            return alert('请输入有效的数字');
        }
        
        if (!confirm(`确定要对 ${inspectTarget} 的账户 ${Number(adjustAmount) > 0 ? '增加' : '扣除'} ${Math.abs(adjustAmount)} 吗？`)) {
            return;
        }

        setIsAdjusting(true);
        try {
            const res = await fetch('/api/admin/adjust-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUser: inspectTarget, 
                    amount: adjustAmount,
                    note: adjustNote,
                    operator: currentUser 
                })
            });
            
            const data = await res.json();
            if (res.ok) {
                alert('资金调账成功！');
                setAdjustAmount('');
                setAdjustNote('');
                handleInspect(inspectTarget);
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('网络连接错误');
        } finally {
            setIsAdjusting(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/admin/logs');
            if (res.ok) setLogs((await res.json()).logs || []);
        } catch (e) {}
    };

    const fetchBroadcast = async () => {
        try {
            const res = await fetch('/api/admin/broadcast');
            if (res.ok) setBroadcastMsg((await res.json()).message || '');
        } catch (e) {}
    };

    const saveBroadcast = async () => {
        try {
            await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: broadcastMsg })
            });
            alert('广播设置成功');
        } catch (e) {}
    };

    const executeMacro = async (action) => {
        if (!confirm(`警告：该操作将影响全站所有用户，确定执行吗？`)) return;
        try {
            const res = await fetch('/api/admin/macro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, amount: airdropAmount, rate: taxRate })
            });
            if (res.ok) {
                const data = await res.json();
                alert(`执行完毕，影响了 ${data.affected} 个账户。`);
            }
        } catch (e) {}
    };

    const queryRedis = async (action) => {
        if (!redisKey) return alert('请输入键名');
        try {
            const res = await fetch('/api/admin/redis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, key: redisKey, value: redisValue })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.error);
            if (action === 'get') setRedisValue(typeof data.data === 'object' ? JSON.stringify(data.data, null, 2) : String(data.data || ''));
            else alert('写入成功');
        } catch (e) {}
    };

    const fetchSettings = async () => {
        try {
            const resBingo = await fetch('/api/tools/bingo');
            if (resBingo.ok) {
                const data = await resBingo.json();
                setBingoTagsInput((data.tags || []).join(', '));
                setBingoCostInput(data.cost || 50);
            }
            const resBounty = await fetch('/api/tools/bounty?action=config');
            if (resBounty.ok) {
                const data = await resBounty.json();
                setBountyTagsInput((data.tags || []).join(', '));
                setBountyMinRating(data.minRating || 10);
                setBountyMaxRating(data.maxRating || 50);
                setBountyBaseReward(data.baseReward || 800);
            }
        } catch (e) {}
    };

    const saveBingoSettings = async () => {
        const tagsArray = bingoTagsInput.split(/[,，]/).map(t => t.trim()).filter(t => t);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ module: 'bingo', data: { tags: tagsArray, cost: Number(bingoCostInput) || 50 } })
            });
            if (res.ok) alert('大乐透配置保存成功！'); else alert('保存失败');
        } catch (e) { alert('网络错误'); }
    };

    const saveBountySettings = async () => {
        const tagsArray = bountyTagsInput.split(/[,，]/).map(t => t.trim()).filter(t => t);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module: 'bounty',
                    data: { tags: tagsArray, minRating: Number(bountyMinRating), maxRating: Number(bountyMaxRating), baseReward: Number(bountyBaseReward) }
                })
            });
            if (res.ok) alert('悬赏令配置保存成功！'); else alert('保存失败');
        } catch (e) { alert('网络错误'); }
    };

    const fetchQuarantine = async () => {
        try {
            const res = await fetch('/api/admin/quarantine');
            if (res.ok) {
                const data = await res.json();
                setQuarantineData(data);
            }
        } catch (e) {}
    };

    const addQuarantine = async (type) => {
        const val = qInput[type];
        if (!val) return;
        try {
            await fetch('/api/admin/quarantine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, value: val })
            });
            setQInput(prev => ({...prev, [type]: ''}));
            fetchQuarantine();
        } catch (e) {}
    };

    const removeQuarantine = async (type, value) => {
        if (!confirm(`确认解除对 ${value} 的隔离状态？`)) return;
        try {
            await fetch('/api/admin/quarantine', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, value })
            });
            fetchQuarantine();
        } catch (e) {}
    };

    const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

    const navItems = [
        { id: 'members', label: '成员管理', icon: 'fa-users' },
        { id: 'quarantine', label: '数据隔离网', icon: 'fa-shield-virus' },
        { id: 'logs', label: '交易审计', icon: 'fa-list-check' },
        { id: 'broadcast', label: '全站广播', icon: 'fa-bullhorn' },
        { id: 'macro', label: '宏观经济', icon: 'fa-money-bill-trend-up' },
        { id: 'settings', label: '系统设置', icon: 'fa-sliders' },
        { id: 'redis', label: '裸键终端', icon: 'fa-terminal' }
    ];

    if (!currentUser) return <div className="min-h-screen flex items-center justify-center text-red-500 bg-[#0a0a0a] font-bold text-lg"><i className="fa-solid fa-lock mr-2"></i> 未登录，拒绝访问控制台</div>;

    return (
        <div className="h-screen bg-[#0a0a0a] text-gray-200 flex flex-col md:flex-row overflow-hidden font-sans">
            <Head><title>中央控制台 - WikitDB</title></Head>

            <aside className="w-full md:w-64 bg-gray-900 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col shrink-0 shadow-lg z-20">
                <div className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b border-gray-800 shrink-0">
                    <h1 className="text-lg md:text-xl font-bold text-blue-500 tracking-tight flex items-center gap-2">
                        <i className="fa-solid fa-shield-halved"></i> WIKIT ADMIN
                    </h1>
                </div>
                <div className="hidden md:block p-6 pb-2 shrink-0">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">系统模块</div>
                </div>
                <nav className="flex-row md:flex-col flex px-2 md:px-4 py-2 md:py-0 space-x-2 md:space-x-0 md:space-y-1 overflow-x-auto custom-scrollbar shrink-0 md:shrink md:flex-1 md:overflow-y-auto">
                    {navItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white border border-transparent'}`}>
                                <i className={`fa-solid ${item.icon} w-4 md:w-5 text-center ${isActive ? 'text-blue-400' : 'text-gray-500'}`}></i>{item.label}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <header className="hidden md:flex h-16 bg-gray-900/50 border-b border-gray-800 items-center px-8 shrink-0 justify-between">
                    <h2 className="text-lg font-bold text-white">{navItems.find(i => i.id === activeTab)?.label}</h2>
                    <div className="text-sm text-gray-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>系统运行正常</div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    
                    {activeTab === 'members' && (
                        <div className="max-w-6xl mx-auto w-full">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <i className="fa-solid fa-user-group text-blue-400"></i> 会员管理 ({users.length})
                                </h3>
                                <div className="relative w-full sm:w-64">
                                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                                    <input 
                                        type="text" 
                                        placeholder="搜索用户名..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-gray-900/80 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            
                            <div className="bg-gray-800/40 border border-gray-700 rounded-xl shadow-sm overflow-x-auto min-w-0">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-700 uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-4 py-4 font-semibold w-12 text-center">状态</th>
                                            <th className="px-4 py-4 font-semibold">用户名</th>
                                            <th className="px-4 py-4 font-semibold">权限级别</th>
                                            <th className="px-4 py-4 font-semibold text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50 text-gray-300">
                                        {isLoading ? (
                                            <tr><td colSpan="4" className="px-4 py-12 text-center text-gray-500"><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>加载中...</td></tr>
                                        ) : filteredUsers.length === 0 ? (
                                            <tr><td colSpan="4" className="px-4 py-12 text-center text-gray-500">没有找到匹配的用户。</td></tr>
                                        ) : (
                                            filteredUsers.map((user) => (
                                                <tr key={user.username} className="hover:bg-gray-800/60 transition-colors">
                                                    <td className="px-4 py-3 text-center">
                                                        <div className={`inline-flex items-center justify-center w-2 h-2 rounded-full ${user.status === 'banned' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`}></div>
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-white flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded bg-gray-700 text-gray-300 flex items-center justify-center font-bold text-xs uppercase shadow-inner">{user.username.substring(0,2)}</div>
                                                        {user.username}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2.5 py-1 rounded text-xs font-bold ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                                                            {user.role === 'admin' ? '管理员' : '普通用户'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => handleInspect(user.username)} className="px-3 py-1.5 bg-blue-900/30 text-blue-400 hover:bg-blue-800/50 rounded transition-colors text-xs font-medium border border-blue-800/50">资产</button>
                                                            {user.status === 'banned' ? (
                                                                <button onClick={() => handleUserAction(user.username, 'unban')} className="w-8 h-8 flex items-center justify-center rounded bg-green-900/30 text-green-500 hover:bg-green-800/50 transition-colors border border-green-800/50" title="解封"><i className="fa-solid fa-unlock text-xs"></i></button>
                                                            ) : (
                                                                <button onClick={() => handleUserAction(user.username, 'ban')} className="w-8 h-8 flex items-center justify-center rounded bg-yellow-900/30 text-yellow-500 hover:bg-yellow-800/50 transition-colors border border-yellow-800/50" title="封禁"><i className="fa-solid fa-ban text-xs"></i></button>
                                                            )}
                                                            {user.role === 'user' ? (
                                                                <button onClick={() => handleUserAction(user.username, 'promote')} className="w-8 h-8 flex items-center justify-center rounded bg-purple-900/30 text-purple-400 hover:bg-purple-800/50 transition-colors border border-purple-800/50" title="设为管理"><i className="fa-solid fa-arrow-up text-xs"></i></button>
                                                            ) : (
                                                                <button onClick={() => handleUserAction(user.username, 'demote')} className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors" title="取消管理"><i className="fa-solid fa-arrow-down text-xs"></i></button>
                                                            )}
                                                            <button onClick={() => handleUserAction(user.username, 'delete')} className="w-8 h-8 flex items-center justify-center rounded bg-red-900/30 text-red-500 hover:bg-red-800/50 transition-colors border border-red-800/50" title="永久删除"><i className="fa-solid fa-trash-can text-xs"></i></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 资产调账模态框 */}
                    {activeTab === 'members' && inspectTarget && inspectData && (
                        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                            <div className="bg-[#121212] border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
                                    <h3 className="font-bold text-lg text-white flex items-center gap-2"><i className="fa-solid fa-magnifying-glass-chart text-blue-400"></i> {inspectTarget} 的资产审查</h3>
                                    <button onClick={() => { setInspectTarget(''); setInspectData(null); }} className="text-gray-500 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-lg"></i></button>
                                </div>
                                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                    <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-800 flex justify-between items-center">
                                        <span className="text-sm text-gray-400 font-semibold">账户可用余额</span>
                                        <span className="text-2xl font-mono text-green-400 font-bold tracking-tight">¥ {(inspectData?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">资产持仓明细</h4>
                                    <div className="space-y-2 mb-6">
                                        {Object.entries(inspectData).filter(([k]) => k !== 'balance').map(([key, value]) => {
                                            const shares = typeof value === 'object' ? value.shares : Number(value);
                                            const cost = typeof value === 'object' ? value.avgCost : 0;
                                            if (shares === 0) return null;
                                            return (
                                                <div key={key} className="flex justify-between items-center bg-[#0a0a0a] border border-gray-800 p-3 rounded text-sm">
                                                    <span className="font-medium text-gray-300">{key}</span>
                                                    <div className="text-right">
                                                        <span className={`font-mono font-bold ${shares > 0 ? 'text-blue-400' : 'text-orange-400'}`}>{shares > 0 ? '多头' : '空头'} {Math.abs(shares)} 股</span>
                                                        <div className="text-[10px] text-gray-500 font-mono">均价: ¥{Number(cost).toFixed(2)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {Object.entries(inspectData).filter(([k]) => k !== 'balance' && (typeof value === 'object' ? value.shares !== 0 : Number(value) !== 0)).length === 0 && (
                                            <div className="text-center py-6 text-sm text-gray-600 border border-dashed border-gray-800 rounded">当前没有持仓记录</div>
                                        )}
                                    </div>

                                    {/* 资金调账区 */}
                                    <div className="border-t border-gray-800 pt-6">
                                        <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3 flex items-center gap-2"><i className="fa-solid fa-bolt"></i> 强制资金调账</h4>
                                        <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">调整金额 (正数增加，负数扣除)</label>
                                                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="例如: 1000 或 -500" className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white font-mono focus:border-orange-500 outline-none"/>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">调账备注 (必填，记入日志)</label>
                                                <input type="text" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="如: 线下活动奖励 / 违规罚款" className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm focus:border-orange-500 outline-none"/>
                                            </div>
                                            <button onClick={handleAdjustBalance} disabled={isAdjusting} className="w-full mt-2 py-2.5 bg-orange-900/50 hover:bg-orange-800 disabled:bg-gray-800 text-orange-400 disabled:text-gray-500 border border-orange-800 disabled:border-gray-700 rounded font-bold transition-colors text-sm">
                                                {isAdjusting ? '正在处理数据...' : '执行调账记录'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'quarantine' && (
                        <div className="max-w-6xl mx-auto w-full space-y-6">
                            <div className="mb-6 border-b border-gray-800 pb-4">
                                <h3 className="text-xl font-bold text-white">数据源隔离协议</h3>
                                <p className="text-gray-400 text-sm mt-1">全局封锁特定的站点、标签或作者，以防止敏感信息污染全站的公共数据提取端点。</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 shadow-sm">
                                    <h4 className="font-bold text-red-400 mb-4 border-b border-gray-700 pb-2">站点黑名单 (Wikis)</h4>
                                    <div className="flex gap-2 mb-4">
                                        <input type="text" placeholder="输入站点标识..." value={qInput.wikis} onChange={e => setQInput({...qInput, wikis: e.target.value})} className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-red-500 outline-none" />
                                        <button onClick={() => addQuarantine('wikis')} className="px-3 py-2 bg-red-900/50 hover:bg-red-800 text-red-400 border border-red-800 rounded text-sm transition-colors">拦截</button>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                        {quarantineData.wikis.map(item => (
                                            <div key={item} className="flex justify-between items-center bg-[#0a0a0a] border border-gray-800 p-2 rounded">
                                                <span className="text-gray-300 font-mono text-sm">{item}</span>
                                                <button onClick={() => removeQuarantine('wikis', item)} className="text-gray-600 hover:text-red-400"><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 shadow-sm">
                                    <h4 className="font-bold text-orange-400 mb-4 border-b border-gray-700 pb-2">敏感标签 (Tags)</h4>
                                    <div className="flex gap-2 mb-4">
                                        <input type="text" placeholder="输入标签名..." value={qInput.tags} onChange={e => setQInput({...qInput, tags: e.target.value})} className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-orange-500 outline-none" />
                                        <button onClick={() => addQuarantine('tags')} className="px-3 py-2 bg-orange-900/50 hover:bg-orange-800 text-orange-400 border border-orange-800 rounded text-sm transition-colors">拦截</button>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                        {quarantineData.tags.map(item => (
                                            <div key={item} className="flex justify-between items-center bg-[#0a0a0a] border border-gray-800 p-2 rounded">
                                                <span className="text-gray-300 font-mono text-sm">{item}</span>
                                                <button onClick={() => removeQuarantine('tags', item)} className="text-gray-600 hover:text-orange-400"><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 shadow-sm">
                                    <h4 className="font-bold text-yellow-400 mb-4 border-b border-gray-700 pb-2">作者黑名单 (Authors)</h4>
                                    <div className="flex gap-2 mb-4">
                                        <input type="text" placeholder="输入作者名..." value={qInput.authors} onChange={e => setQInput({...qInput, authors: e.target.value})} className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-yellow-500 outline-none" />
                                        <button onClick={() => addQuarantine('authors')} className="px-3 py-2 bg-yellow-900/50 hover:bg-yellow-800 text-yellow-400 border border-yellow-800 rounded text-sm transition-colors">拦截</button>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                        {quarantineData.authors.map(item => (
                                            <div key={item} className="flex justify-between items-center bg-[#0a0a0a] border border-gray-800 p-2 rounded">
                                                <span className="text-gray-300 font-mono text-sm">{item}</span>
                                                <button onClick={() => removeQuarantine('authors', item)} className="text-gray-600 hover:text-yellow-400"><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="max-w-6xl mx-auto w-full">
                            <div className="mb-6 border-b border-gray-800 pb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <i className="fa-solid fa-list-check text-blue-400"></i> 全局交易审计日志
                                </h3>
                            </div>
                            <div className="bg-gray-800/40 border border-gray-700 rounded-xl shadow-sm overflow-hidden min-w-0">
                                <ul className="divide-y divide-gray-800/50 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                    {logs.length === 0 ? (
                                        <li className="p-8 text-center text-gray-500">暂无日志记录</li>
                                    ) : (
                                        logs.map((log, index) => {
                                            const l = typeof log === 'string' ? JSON.parse(log) : log;
                                            return (
                                                <li key={index} className="p-4 hover:bg-gray-800/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner ${l.action === 'buy' ? 'bg-green-900/30 text-green-400 border border-green-800' : l.action === 'sell' ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-gray-700 text-gray-300'}`}>
                                                            {l.action === 'buy' ? 'B' : l.action === 'sell' ? 'S' : 'A'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-medium text-gray-200 truncate">
                                                                <span className="font-bold text-blue-300 mr-2">{l.username || l.operator}</span>
                                                                {l.action === 'buy' ? '买入' : l.action === 'sell' ? '卖出' : l.action} 
                                                                {l.target ? <span className="text-gray-400 ml-1">[{l.target}]</span> : ''}
                                                            </div>
                                                            <div className="text-xs text-gray-500 font-mono mt-0.5">{new Date(l.time).toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {l.amount && <div className="text-sm font-bold text-white font-mono">{l.amount} 股</div>}
                                                        {l.price && <div className="text-xs text-gray-500 font-mono">@ ¥{l.price.toFixed(2)}</div>}
                                                        {l.details && <div className="text-xs text-orange-400">{l.details}</div>}
                                                    </div>
                                                </li>
                                            );
                                        })
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'broadcast' && (
                        <div className="max-w-4xl mx-auto w-full">
                            <div className="bg-gray-800/40 border border-gray-700 p-5 md:p-8 rounded-xl shadow-sm min-w-0">
                                <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2">
                                    <i className="fa-solid fa-bullhorn text-blue-400"></i> 全站横幅广播
                                </h3>
                                <div className="space-y-4">
                                    <textarea 
                                        value={broadcastMsg}
                                        onChange={(e) => setBroadcastMsg(e.target.value)}
                                        placeholder="输入希望在全站顶部滚动显示的紧急通知..."
                                        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner custom-scrollbar"
                                    />
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => setBroadcastMsg('')} className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium">清空</button>
                                        <button onClick={saveBroadcast} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-sm text-sm">发布广播</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'macro' && (
                        <div className="max-w-4xl mx-auto w-full space-y-6">
                            <div className="bg-gray-800/40 border border-gray-700 p-5 md:p-8 rounded-xl shadow-sm min-w-0">
                                <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2">
                                    <i className="fa-solid fa-parachute-box text-green-400"></i> 全局空投补贴
                                </h3>
                                <div className="flex flex-col md:flex-row items-end gap-4">
                                    <div className="w-full flex-1">
                                        <label className="block text-sm font-semibold text-gray-400 mb-2">为全站所有注册用户发放额度</label>
                                        <input type="number" value={airdropAmount} onChange={e => setAirdropAmount(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500 transition-all font-mono"/>
                                    </div>
                                    <button onClick={() => executeMacro('airdrop')} className="w-full md:w-auto px-8 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg font-bold transition-colors shadow-sm whitespace-nowrap">执行发钱</button>
                                </div>
                            </div>
                            <div className="bg-gray-800/40 border border-gray-700 p-5 md:p-8 rounded-xl shadow-sm min-w-0">
                                <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2">
                                    <i className="fa-solid fa-hand-holding-dollar text-red-400"></i> 全局资产征税
                                </h3>
                                <div className="flex flex-col md:flex-row items-end gap-4">
                                    <div className="w-full flex-1">
                                        <label className="block text-sm font-semibold text-gray-400 mb-2">对全站所有用户的当前余额按比例扣除 (%)</label>
                                        <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-all font-mono"/>
                                    </div>
                                    <button onClick={() => executeMacro('tax')} className="w-full md:w-auto px-8 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold transition-colors shadow-sm whitespace-nowrap">强行征收</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-4xl mx-auto w-full space-y-6">
                            <div className="bg-gray-800/40 border border-gray-700 p-5 md:p-8 rounded-xl shadow-sm">
                                <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2">
                                    <i className="fa-solid fa-tags text-teal-400"></i> 标签大乐透 (Tag Bingo) 规则配置
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-400 mb-2">候选标签池 (用逗号分隔)</label>
                                        <textarea value={bingoTagsInput} onChange={e => setBingoTagsInput(e.target.value)} className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-teal-500 custom-scrollbar" placeholder="例如: 原创, 精品, scp, tale..." />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-400 mb-2">单次扫描基础价格 (¥)</label>
                                        <input type="number" value={bingoCostInput} onChange={e => setBingoCostInput(e.target.value)} className="w-full md:w-48 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500" />
                                        <p className="text-xs text-gray-500 mt-1">命中1个返本，命中2个返10倍，全中3个返100倍。</p>
                                    </div>
                                    <div className="pt-4 border-t border-gray-800 flex justify-end">
                                        <button onClick={saveBingoSettings} className="w-full md:w-auto px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-lg font-bold transition-colors shadow-sm">保存配置</button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800/40 border border-gray-700 p-5 md:p-8 rounded-xl shadow-sm">
                                <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2">
                                    <i className="fa-solid fa-scroll text-orange-400"></i> 异常档案悬赏令 (Bounty Hunter) 规则配置
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-400 mb-2">候选标签池 (用逗号分隔)</label>
                                        <textarea value={bountyTagsInput} onChange={e => setBountyTagsInput(e.target.value)} className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-orange-500 custom-scrollbar" placeholder="例如: 原创, 精品, scp, tale, 搞笑..." />
                                    </div>
                                    
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
                                            <label className="block text-sm font-semibold text-gray-400 mb-2">基础要求下限 (Min Rating)</label>
                                            <input type="number" value={bountyMinRating} onChange={e => setBountyMinRating(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-semibold text-gray-400 mb-2">基础要求上限 (Max Rating)</label>
                                            <input type="number" value={bountyMaxRating} onChange={e => setBountyMaxRating(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-400 mb-2">基础悬赏金基数 (¥)</label>
                                        <input type="number" value={bountyBaseReward} onChange={e => setBountyBaseReward(e.target.value)} className="w-full md:w-48 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500" />
                                    </div>

                                    <div className="pt-4 border-t border-gray-800 flex justify-end">
                                        <button onClick={saveBountySettings} className="w-full md:w-auto px-6 py-2.5 bg-orange-700 hover:bg-orange-600 text-white rounded-lg font-bold transition-colors shadow-sm">保存配置并应用</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'redis' && (
                        <div className="max-w-4xl mx-auto w-full bg-gray-800/40 border border-gray-700 rounded-xl shadow-sm overflow-hidden min-w-0">
                            <div className="bg-[#1e1e1e] px-4 md:px-6 py-3 flex items-center gap-3 border-b border-gray-800">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                </div>
                                <span className="text-xs text-gray-500 font-mono tracking-widest">REDIS RAW CONSOLE</span>
                            </div>
                            <div className="p-4 md:p-6 space-y-4">
                                <div className="bg-orange-900/30 border border-orange-800 text-orange-400 p-4 rounded-lg text-sm mb-4 md:mb-6 flex gap-3 items-start">
                                    <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                                    <div>
                                        <p className="font-bold text-orange-300">高危操作区域</p>
                                        <p>在此处修改数据将绕过所有业务逻辑检查，可能导致网站崩溃。</p>
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-3">
                                    <div className="flex-1 relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm hidden md:inline">Key:</span>
                                        <input type="text" value={redisKey} onChange={e => setRedisKey(e.target.value)} placeholder="如 user:xxx" className="w-full bg-gray-900 border border-gray-700 rounded-lg md:pl-12 px-4 py-2.5 text-white font-mono focus:outline-none focus:border-blue-500 transition-all"/>
                                    </div>
                                    <button onClick={() => queryRedis('get')} className="w-full md:w-auto px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors border border-gray-600">查询</button>
                                </div>
                                <textarea value={redisValue} onChange={e => setRedisValue(e.target.value)} className="w-full h-64 md:h-80 bg-[#1e1e1e] border border-gray-700 rounded-lg p-3 md:p-4 text-green-400 font-mono text-xs md:text-sm focus:outline-none focus:border-blue-500 shadow-inner custom-scrollbar" placeholder="Value 数据区域..." />
                                <button onClick={() => queryRedis('set')} className="w-full py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg shadow-sm transition-colors border border-red-800">
                                    强制覆盖写入
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
