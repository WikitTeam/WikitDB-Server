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
        { id: 'redis', label: '内存终端', icon: 'fa-terminal' }
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

            <div className="flex flex-col lg:flex-row gap-8">
                {/* 侧边导航 */}
                <aside className="w-full lg:w-64 flex-shrink-0">
                    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-2 sticky top-24">
                        <div className="px-4 py-3 mb-2 border-b border-gray-700/50">
                            <h1 className="text-sm font-bold text-gray-400 tracking-widest uppercase flex items-center gap-2">
                                <i className="fa-solid fa-shield-halved text-blue-500"></i> 系统功能模块
                            </h1>
                        </div>
                        <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                            {navItems.map(item => {
                                const isActive = activeTab === item.id;
                                return (
                                    <button 
                                        key={item.id} 
                                        onClick={() => setActiveTab(item.id)} 
                                        className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                            isActive 
                                            ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                                            : 'text-gray-400 hover:bg-gray-700/50 hover:text-white border border-transparent'
                                        }`}
                                    >
                                        <i className={`fa-solid ${item.icon} w-5 text-center ${isActive ? 'text-blue-400' : 'text-gray-500'}`}></i>
                                        {item.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                {/* 主内容区 */}
                <main className="flex-1 min-w-0">
                    <div className="mb-6 flex justify-between items-end border-b border-gray-800 pb-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <i className={`fa-solid ${navItems.find(i => i.id === activeTab)?.icon} text-blue-500`}></i>
                            {navItems.find(i => i.id === activeTab)?.label}
                        </h2>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            控制台运行正常
                        </div>
                    </div>

                    <div className="transition-all duration-300">
                        {activeTab === 'members' && (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                                        注册会员列表 ({users.length})
                                    </h3>
                                    <div className="relative w-full sm:w-64">
                                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm"></i>
                                        <input 
                                            type="text" 
                                            placeholder="搜索用户名..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                                        />
                                    </div>
                                </div>
                                
                                <div className="bg-gray-800/20 border border-gray-800 rounded-xl overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-800/40 text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold w-12 text-center">状态</th>
                                                <th className="px-6 py-4 font-semibold">用户名</th>
                                                <th className="px-6 py-4 font-semibold">权限级别</th>
                                                <th className="px-6 py-4 font-semibold text-right">操作管理</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800/30 text-gray-300">
                                            {isLoading ? (
                                                <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500 animate-pulse">正在从数据库检索核心档案...</td></tr>
                                            ) : filteredUsers.length === 0 ? (
                                                <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-600">未检索到匹配的记录</td></tr>
                                            ) : (
                                                filteredUsers.map((user) => (
                                                    <tr key={user.username} className="hover:bg-white/5 transition-colors group">
                                                        <td className="px-6 py-4 text-center">
                                                            <div className={`inline-flex items-center justify-center w-2 h-2 rounded-full ${user.status === 'banned' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded bg-gray-700 text-gray-300 flex items-center justify-center font-bold text-xs shadow-inner uppercase">{user.username.substring(0,2)}</div>
                                                            {user.username}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${user.role === 'admin' ? 'bg-indigo-900/20 text-indigo-400 border-indigo-700/30' : 'bg-gray-900 text-gray-500 border-gray-700'}`}>
                                                                {user.role === 'admin' ? '管理员' : '普通用户'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleInspect(user.username)} className="px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded text-[10px] font-bold border border-blue-500/20">查看资产</button>
                                                                {user.status === 'banned' ? (
                                                                    <button onClick={() => handleUserAction(user.username, 'unban')} className="w-7 h-7 flex items-center justify-center rounded bg-green-900/20 text-green-500 hover:bg-green-900/40 border border-green-700/20" title="撤销封禁"><i className="fa-solid fa-unlock text-xs"></i></button>
                                                                ) : (
                                                                    <button onClick={() => handleUserAction(user.username, 'ban')} className="w-7 h-7 flex items-center justify-center rounded bg-yellow-900/20 text-yellow-500 hover:bg-yellow-900/40 border border-yellow-700/20" title="执行封禁"><i className="fa-solid fa-ban text-xs"></i></button>
                                                                )}
                                                                <button onClick={() => handleUserAction(user.username, 'delete')} className="w-7 h-7 flex items-center justify-center rounded bg-red-900/20 text-red-500 hover:bg-red-900/40 border border-red-700/20" title="抹除档案"><i className="fa-solid fa-trash-can text-xs"></i></button>
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

                        {activeTab === 'quarantine' && (
                            <div className="space-y-8">
                                <div className="p-5 bg-orange-900/10 border border-orange-800/30 rounded-xl flex gap-4 items-start shadow-inner">
                                    <i className="fa-solid fa-shield-virus text-orange-500 text-2xl mt-1"></i>
                                    <div>
                                        <h4 className="font-bold text-orange-300">数据源隔离协议</h4>
                                        <p className="text-sm text-gray-500 leading-relaxed">此处定义的标识符将被全局提取端点忽略。用于封锁违规、极低质量或敏感数据源，防止其干扰全站统计与交易系统。</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {['wikis', 'tags', 'authors'].map(type => (
                                        <div key={type} className="bg-gray-800/20 border border-gray-800 rounded-xl p-6 flex flex-col">
                                            <h4 className="font-bold text-white text-sm uppercase tracking-widest mb-4 flex items-center justify-between">
                                                {type === 'wikis' ? '站点隔离' : type === 'tags' ? '标签隔离' : '作者隔离'}
                                                <span className="text-[10px] bg-gray-900 px-2 py-0.5 rounded text-gray-500">{quarantineData[type].length}</span>
                                            </h4>
                                            <div className="flex gap-2 mb-4">
                                                <input type="text" placeholder="输入标识符..." value={qInput[type]} onChange={e => setQInput({...qInput, [type]: e.target.value})} className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-xs text-white focus:border-blue-500 outline-none shadow-inner" />
                                                <button onClick={() => addQuarantine(type)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs transition-colors border border-gray-700">添加</button>
                                            </div>
                                            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                                {quarantineData[type].map(item => (
                                                    <div key={item} className="flex justify-between items-center bg-gray-900/50 border border-gray-800 px-3 py-2 rounded group">
                                                        <span className="text-gray-400 font-mono text-xs">{item}</span>
                                                        <button onClick={() => removeQuarantine(type, item)} className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><i className="fa-solid fa-xmark"></i></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'logs' && (
                            <div className="bg-gray-800/20 border border-gray-800 rounded-xl overflow-hidden shadow-inner">
                                <ul className="divide-y divide-gray-800/30">
                                    {logs.length === 0 ? (
                                        <li className="p-12 text-center text-gray-600 italic">尚未产生可审计的审计记录</li>
                                    ) : (
                                        logs.map((log, index) => {
                                            const l = typeof log === 'string' ? JSON.parse(log) : log;
                                            return (
                                                <li key={index} className="p-4 hover:bg-white/5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm shadow-inner ${
                                                            l.action === 'buy' ? 'bg-green-900/20 text-green-500' : l.action === 'sell' ? 'bg-red-900/20 text-red-500' : 'bg-gray-800 text-gray-400'
                                                        }`}>
                                                            {l.action === 'buy' ? '买' : l.action === 'sell' ? '卖' : '令'}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-200">
                                                                <span className="font-bold text-blue-400 mr-2">{l.username || l.operator}</span>
                                                                <span className="opacity-60">{l.action === 'buy' ? '执行买入' : l.action === 'sell' ? '执行卖出' : '执行系统指令'}</span>
                                                                {l.target && <span className="ml-2 px-2 py-0.5 bg-gray-900 rounded text-[10px] text-gray-500 font-mono uppercase border border-gray-800">{l.target}</span>}
                                                            </div>
                                                            <div className="text-[10px] text-gray-600 font-mono mt-1 uppercase tracking-tighter">{new Date(l.time).toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {l.amount && <div className="text-sm font-black text-white font-mono">{l.amount} <span className="text-[10px] text-gray-600 font-normal">份额</span></div>}
                                                        {l.price && <div className="text-[10px] text-gray-500 font-mono">预估总额 ¥{l.price.toFixed(2)}</div>}
                                                        {l.details && <div className="text-[10px] text-orange-500/80 mt-1 italic">{l.details}</div>}
                                                    </div>
                                                </li>
                                            );
                                        })
                                    )}
                                </ul>
                            </div>
                        )}

                        {activeTab === 'broadcast' && (
                            <div className="max-w-3xl mx-auto py-12">
                                <div className="bg-gray-800/20 border border-gray-800 p-8 rounded-2xl shadow-xl">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500 text-xl border border-blue-500/20">
                                            <i className="fa-solid fa-bullhorn"></i>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg leading-tight">全站滚动通知广播</h3>
                                            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">系统广播下发系统</p>
                                        </div>
                                    </div>
                                    <textarea 
                                        value={broadcastMsg}
                                        onChange={(e) => setBroadcastMsg(e.target.value)}
                                        placeholder="输入希望在全站顶部滚动显示的通知内容..."
                                        className="w-full h-40 bg-gray-950 border border-gray-800 rounded-xl p-5 text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner text-sm leading-relaxed custom-scrollbar"
                                    />
                                    <div className="mt-6 flex justify-between items-center">
                                        <span className="text-[10px] text-gray-600 font-mono italic">建议长度在 500 字以内</span>
                                        <div className="flex gap-3">
                                            <button onClick={() => setBroadcastMsg('')} className="px-5 py-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">清空</button>
                                            <button onClick={saveBroadcast} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black transition-all shadow-lg text-xs uppercase tracking-widest">下发通知</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'macro' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8">
                                <div className="bg-gray-800/20 border border-gray-800 p-8 rounded-2xl flex flex-col justify-between">
                                    <div>
                                        <div className="w-12 h-12 bg-green-900/20 rounded-xl flex items-center justify-center text-green-500 text-xl border border-green-800/30 mb-6">
                                            <i className="fa-solid fa-parachute-box"></i>
                                        </div>
                                        <h3 className="font-bold text-white text-lg">全员空投补贴</h3>
                                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">为全站所有活跃注册用户发放固定数额的信用点。该操作直接注入基础货币供应，请谨慎执行。</p>
                                    </div>
                                    <div className="mt-10 space-y-4">
                                        <div className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 flex justify-between items-center shadow-inner">
                                            <span className="text-xs text-gray-500 font-bold uppercase">发放数额</span>
                                            <input type="number" value={airdropAmount} onChange={e => setAirdropAmount(e.target.value)} className="bg-transparent border-none text-right text-white font-black font-mono focus:ring-0 w-24 p-0"/>
                                        </div>
                                        <button onClick={() => executeMacro('airdrop')} className="w-full py-3 bg-green-700 hover:bg-green-600 text-white rounded-xl font-black transition-all shadow-lg text-xs uppercase tracking-widest">立即执行空投</button>
                                    </div>
                                </div>

                                <div className="bg-gray-800/20 border border-gray-800 p-8 rounded-2xl flex flex-col justify-between">
                                    <div>
                                        <div className="w-12 h-12 bg-red-900/20 rounded-xl flex items-center justify-center text-red-500 text-xl border border-red-800/30 mb-6">
                                            <i className="fa-solid fa-hand-holding-dollar"></i>
                                        </div>
                                        <h3 className="font-bold text-white text-lg">全站余额征税</h3>
                                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">按百分比对全站用户当前余额进行回收。通常用于抑制通货膨胀或大型系统维护前的数据清理。</p>
                                    </div>
                                    <div className="mt-10 space-y-4">
                                        <div className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 flex justify-between items-center shadow-inner">
                                            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">税率设定 (%)</span>
                                            <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="bg-transparent border-none text-right text-white font-black font-mono focus:ring-0 w-16 p-0"/>
                                        </div>
                                        <button onClick={() => executeMacro('tax')} className="w-full py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-black transition-all shadow-lg text-xs uppercase tracking-widest">立即执行征税</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-gray-800/20 border border-gray-800 rounded-2xl p-8 flex flex-col">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-10 h-10 bg-teal-900/20 rounded-lg flex items-center justify-center text-teal-400 border border-teal-800/30 font-black">乐</div>
                                        <h3 className="font-bold text-white text-sm uppercase tracking-widest">标签大乐透 规则配置</h3>
                                    </div>
                                    <div className="space-y-6 flex-1">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">候选标签池</label>
                                            <textarea value={bingoTagsInput} onChange={e => setBingoTagsInput(e.target.value)} className="w-full h-24 bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-white focus:border-teal-500 transition-all shadow-inner custom-scrollbar" placeholder="原创, scp, 故事..." />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">单次扫描价格 (¥)</label>
                                            <input type="number" value={bingoCostInput} onChange={e => setBingoCostInput(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white font-mono text-sm shadow-inner" />
                                        </div>
                                    </div>
                                    <button onClick={saveBingoSettings} className="mt-8 w-full py-3 bg-teal-700/80 hover:bg-teal-600 text-white rounded-xl font-black transition-all shadow-lg text-xs uppercase tracking-widest">保存大乐透配置</button>
                                </div>

                                <div className="bg-gray-800/20 border border-gray-800 rounded-2xl p-8 flex flex-col">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-10 h-10 bg-orange-900/20 rounded-lg flex items-center justify-center text-orange-400 border border-orange-800/30 font-black">赏</div>
                                        <h3 className="font-bold text-white text-sm uppercase tracking-widest">悬赏令 核心参数配置</h3>
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">目标标签过滤</label>
                                            <textarea value={bountyTagsInput} onChange={e => setBountyTagsInput(e.target.value)} className="w-full h-20 bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-white focus:border-orange-500 transition-all shadow-inner custom-scrollbar" placeholder="原创, 精品, 极佳..." />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">最低评分</label>
                                                <input type="number" value={bountyMinRating} onChange={e => setBountyMinRating(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white font-mono text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">最高评分</label>
                                                <input type="number" value={bountyMaxRating} onChange={e => setBountyMaxRating(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white font-mono text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">基础奖励额度 (¥)</label>
                                            <input type="number" value={bountyBaseReward} onChange={e => setBountyBaseReward(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white font-mono text-sm shadow-inner" />
                                        </div>
                                    </div>
                                    <button onClick={saveBountySettings} className="mt-8 w-full py-3 bg-orange-700/80 hover:bg-orange-600 text-white rounded-xl font-black transition-all shadow-lg text-xs uppercase tracking-widest">更新悬赏规则</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'redis' && (
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-gray-950 border border-red-900/30 rounded-2xl shadow-2xl overflow-hidden">
                                    <div className="bg-red-900/20 px-6 py-3 flex items-center justify-between border-b border-red-900/20">
                                        <div className="flex gap-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                        </div>
                                        <span className="text-[10px] text-red-400 font-black tracking-[0.2em] uppercase">核心底层访问 / 内存数据库终端</span>
                                    </div>
                                    <div className="p-8 space-y-6">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1 relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-900 font-mono text-xs uppercase font-black transition-colors group-focus-within:text-red-500">键名 &gt;</span>
                                                <input type="text" value={redisKey} onChange={e => setRedisKey(e.target.value)} placeholder="user:xxx" className="w-full bg-black border border-gray-900 rounded-xl pl-16 pr-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-red-900 transition-all shadow-inner uppercase"/>
                                            </div>
                                            <button onClick={() => queryRedis('get')} className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-black rounded-xl transition-all border border-gray-800 text-xs uppercase tracking-widest">读取数据</button>
                                        </div>
                                        <textarea value={redisValue} onChange={e => setRedisValue(e.target.value)} className="w-full h-80 bg-black border border-gray-900 rounded-xl p-5 text-green-500 font-mono text-xs focus:outline-none focus:border-red-900 shadow-inner custom-scrollbar" placeholder="等待数据缓冲区载入..." />
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => queryRedis('set')} className="flex-1 py-4 bg-red-800 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all text-xs uppercase tracking-widest border border-red-600">
                                                强制覆盖原始内存数据
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* 资产调配弹窗 */}
            {activeTab === 'members' && inspectTarget && inspectData && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[100] backdrop-blur-md">
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/30">
                            <h3 className="font-bold text-white flex items-center gap-3"><i className="fa-solid fa-id-card text-blue-500"></i> {inspectTarget} 的核心资产快照</h3>
                            <button onClick={() => { setInspectTarget(''); setInspectData(null); }} className="text-gray-600 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                            <div className="p-6 bg-blue-600/5 rounded-2xl border border-blue-500/10 flex justify-between items-center">
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">账户实时余额</span>
                                <span className="text-3xl font-mono text-green-400 font-black">¥ {(inspectData?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-4">持有投资组合细节</h4>
                                {Object.entries(inspectData).filter(([k]) => k !== 'balance').map(([key, value]) => {
                                    const shares = typeof value === 'object' ? value.shares : Number(value);
                                    const cost = typeof value === 'object' ? value.avgCost : 0;
                                    if (shares === 0) return null;
                                    return (
                                        <div key={key} className="flex justify-between items-center bg-gray-900/30 border border-gray-800 p-4 rounded-xl">
                                            <span className="font-bold text-gray-300 text-sm">{key}</span>
                                            <div className="text-right">
                                                <span className={`font-mono font-black text-sm ${shares > 0 ? 'text-blue-500' : 'text-orange-500'}`}>{shares > 0 ? '看多' : '看空'} {Math.abs(shares)} 份</span>
                                                <div className="text-[10px] text-gray-600 font-mono mt-0.5">平均成本 ¥{Number(cost).toFixed(2)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-8 border-t border-gray-800">
                                <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-[0.2em] mb-4">管理员直接干预调账</h4>
                                <div className="bg-orange-950/10 p-6 rounded-2xl border border-orange-900/20 space-y-4 shadow-inner">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block tracking-widest">调整数额</label>
                                            <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="正数为加，负数为减" className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white font-mono text-sm focus:border-orange-900 outline-none"/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block tracking-widest">审计备注</label>
                                            <input type="text" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="说明调账原因" className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-xs focus:border-orange-900 outline-none"/>
                                        </div>
                                    </div>
                                    <button onClick={handleAdjustBalance} disabled={isAdjusting} className="w-full py-3.5 bg-orange-900/50 hover:bg-orange-800 disabled:bg-gray-900 text-orange-500 font-black rounded-xl transition-all text-xs uppercase tracking-widest border border-orange-800/30">
                                        {isAdjusting ? '正在处理交易指令...' : '确认执行资金调账'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
