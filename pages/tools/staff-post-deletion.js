import React, { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');
const {
    buildTimerIframe,
    buildAnnouncementText,
    buildAnnouncementTitle,
    parsePageName
} = require('../../utils/staffPostDeletion');

const StaffPostDeletion = () => {
    const wikis = config.SUPPORT_WIKI || [];
    // 登录保护：该工具要求登录后使用（后端 API 亦已用 withAuth 强制校验）
    const [authChecked, setAuthChecked] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [site, setSite] = useState('');
    const [botUsername, setBotUsername] = useState('');
    const [botPassword, setBotPassword] = useState('');
    const [deleteScore, setDeleteScore] = useState(-5);
    const [countdownHours, setCountdownHours] = useState(72);
    const [tagName, setTagName] = useState('待删除');
    const [pagesText, setPagesText] = useState('');
    const [timerIframe, setTimerIframe] = useState('');
    const [announcementText, setAnnouncementText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState(null);
    // 我的机器人列表
    const [bots, setBots] = useState([]);
    const [selectedBotId, setSelectedBotId] = useState(null);
    const [botName, setBotName] = useState('');
    const [botNewUsername, setBotNewUsername] = useState('');
    const [botNewPassword, setBotNewPassword] = useState('');
    const [botMsg, setBotMsg] = useState('');
    const [creatingBot, setCreatingBot] = useState(false);
    // 扫描配置（创建）
    const [scanInterval, setScanInterval] = useState(720); // 分钟，0 = 不自动扫描
    const [scanSites, setScanSites] = useState([]);        // 指定扫描站点（PARAM 数组）
    const [botDeleteScore, setBotDeleteScore] = useState(-5);       // 删除线
    const [botCountdownHours, setBotCountdownHours] = useState(72); // 倒计时小时数
    // 编辑状态
    const [editingBot, setEditingBot] = useState(null);
    const [editName, setEditName] = useState('');
    const [editInterval, setEditInterval] = useState(0);
    const [editSites, setEditSites] = useState([]);
    const [editDeleteScore, setEditDeleteScore] = useState(-5);
    const [editCountdownHours, setEditCountdownHours] = useState(72);
    const [editSessionCookie, setEditSessionCookie] = useState('');
    // 删除公告 Bot 管理（控制独立 Python bot）
    const [botInfo, setBotInfo] = useState(null);
    const [botConfig, setBotConfig] = useState(null);
    const [botLoading, setBotLoading] = useState(false);
    const [botManageMsg, setBotManageMsg] = useState('');

    // 扫描间隔可选项：值（分钟）
    const SCAN_INTERVAL_OPTIONS = [
        { value: 0, label: '不自动扫描' },
        { value: 15, label: '每 15 分钟' },
        { value: 60, label: '每 1 小时' },
        { value: 180, label: '每 3 小时' },
        { value: 360, label: '每 6 小时' },
        { value: 720, label: '每 12 小时' },
        { value: 1440, label: '每天' }
    ];

    // 把分钟间隔转成展示文本
    const intervalLabel = (min) => {
        const opt = SCAN_INTERVAL_OPTIONS.find((o) => o.value === min);
        return opt ? opt.label : (min > 0 ? `每 ${Math.round(min / 60)} 小时` : '不自动扫描');
    };

    // 站点名展示
    const siteName = (param) => {
        const w = wikis.find((x) => x.PARAM === param);
        return w ? w.NAME : param;
    };

    // 安全格式化日期，避免无效时间戳导致渲染崩溃
    const formatBotDate = (d) => {
        try {
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '未知时间';
            return dt.toLocaleString('zh-CN', { hour12: false });
        } catch (e) {
            return '未知时间';
        }
    };

    useEffect(() => {
        setIsLoggedIn(!!window.localStorage.getItem('username'));
        setAuthChecked(true);
    }, []);

    // 登录后加载我的机器人列表，并恢复上次选中的机器人
    useEffect(() => {
        if (!isLoggedIn) return;
        fetch('/api/tools/bot-accounts')
            .then((r) => r.json())
            .then((d) => {
                if (!d.success) return;
                setBots(d.bots || []);
                // 恢复上次选中的机器人（持久化在 localStorage，退出页面后仍保持）
                const savedId = parseInt(window.localStorage.getItem('spd_selected_bot') || '', 10);
                if (savedId) {
                    const savedBot = (d.bots || []).find((b) => b.id === savedId);
                    if (savedBot) {
                        setSelectedBotId(savedBot.id);
                        setBotUsername(savedBot.username);
                        setBotPassword('');
                    } else {
                        window.localStorage.removeItem('spd_selected_bot');
                    }
                }
            })
            .catch(() => {});
        loadBotInfo();
    }, [isLoggedIn]);

    const timerBaseUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/timer/timer.html`
        : '';

    // 根据「删除线」和「倒计时时间」重新生成计时器代码（基于 D:\scp\timer）
    const regenerateTimer = useCallback(() => {
        const iframe = buildTimerIframe(timerBaseUrl, {
            deleteScore,
            countdownHours
        });
        setTimerIframe(iframe);
        // 同步刷新公告预览（若用户尚未手动改过公告模板）
        setAnnouncementText(buildAnnouncementText({
            deleteScore,
            timerIframe: iframe
        }));
    }, [timerBaseUrl, deleteScore, countdownHours]);

    const fillDefaultTemplate = () => {
        setAnnouncementText(buildAnnouncementText({
            deleteScore,
            timerIframe: timerIframe || buildTimerIframe(timerBaseUrl, { deleteScore, countdownHours })
        }));
    };

    const pageList = pagesText.split('\n').map((l) => l.trim()).filter(Boolean);

    // --- 我的机器人管理 ---
    const loadBots = async () => {
        try {
            const res = await fetch('/api/tools/bot-accounts');
            const d = await res.json();
            if (d.success) setBots(d.bots || []);
        } catch (e) { /* 忽略 */ }
    };

    const createBot = async () => {
        setBotMsg('');
        if (creatingBot) return;
        if (!botName.trim() || !botNewUsername.trim() || !botNewPassword) {
            setBotMsg('请填写机器人名称、账号和密码');
            return;
        }
        setCreatingBot(true);
        try {
            const res = await fetch('/api/tools/bot-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: botName,
                    username: botNewUsername,
                    password: botNewPassword,
                    scanInterval,
                    scanSites,
                    deleteScore: botDeleteScore,
                    countdownHours: botCountdownHours
                })
            });
            const d = await res.json();
            if (!res.ok) { setBotMsg(d.error || '创建失败'); return; }
            setBotMsg(`机器人「${d.bot.name}」已创建`);
            setBotName('');
            setBotNewUsername('');
            setBotNewPassword('');
            await loadBots();
        } catch (e) {
            setBotMsg('创建失败：' + e.message);
        } finally {
            setCreatingBot(false);
        }
    };

    // 切换创建表单的扫描站点
    const toggleScanSite = (param) => {
        setScanSites((prev) => (prev.includes(param) ? prev.filter((s) => s !== param) : [...prev, param]));
    };

    // 开始编辑机器人
    const startEditBot = (bot) => {
        setEditingBot(bot);
        setEditName(bot.name || '');
        setEditInterval(bot.scanInterval || 0);
        setEditSites(Array.isArray(bot.scanSites) ? bot.scanSites : []);
        setEditDeleteScore(bot.deleteScore ?? -5);
        setEditCountdownHours(bot.countdownHours ?? 72);
        setEditSessionCookie('');
    };

    const cancelEditBot = () => {
        setEditingBot(null);
    };

    const toggleEditSite = (param) => {
        setEditSites((prev) => (prev.includes(param) ? prev.filter((s) => s !== param) : [...prev, param]));
    };

    // 保存编辑
    const saveEditBot = async () => {
        if (!editingBot) return;
        setBotMsg('');
        try {
            const res = await fetch('/api/tools/bot-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingBot.id, name: editName, scanInterval: editInterval, scanSites: editSites, deleteScore: editDeleteScore, countdownHours: editCountdownHours, sessionCookie: editSessionCookie })
            });
            const d = await res.json();
            if (!res.ok) { setBotMsg(d.error || '保存失败'); return; }
            setBotMsg(`机器人「${d.bot.name}」设置已更新`);
            setEditingBot(null);
            await loadBots();
        } catch (e) {
            setBotMsg('保存失败：' + e.message);
        }
    };

    // --- 删除公告 Bot 管理（控制 /opt/wikit-delete-bot 的 Python bot） ---
    const loadBotInfo = async () => {
        try {
            const res = await fetch('/api/tools/delete-bot');
            const d = await res.json();
            if (d.success) {
                setBotInfo(d);
                setBotConfig(d.config);
            }
        } catch (e) { /* 忽略 */ }
    };

    const botAction = async (action) => {
        setBotLoading(true);
        setBotManageMsg('');
        try {
            const res = await fetch('/api/tools/delete-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const d = await res.json();
            setBotManageMsg(d.message || d.error || '完成');
            await loadBotInfo();
        } catch (e) {
            setBotManageMsg('操作失败：' + e.message);
        } finally {
            setBotLoading(false);
        }
    };

    const saveBotConfig = async () => {
        setBotLoading(true);
        setBotManageMsg('');
        try {
            const res = await fetch('/api/tools/delete-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateConfig', config: botConfig })
            });
            const d = await res.json();
            setBotManageMsg(d.message || d.error || '保存失败');
            await loadBotInfo();
        } catch (e) {
            setBotManageMsg('保存失败：' + e.message);
        } finally {
            setBotLoading(false);
        }
    };

    const deleteBot = async (id) => {
        if (!window.confirm('确定删除该机器人？删除后不可恢复。')) return;
        setBotMsg('');
        try {
            const res = await fetch('/api/tools/bot-accounts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const d = await res.json();
            if (!d.success) { setBotMsg(d.error || '删除失败'); return; }
            if (selectedBotId === id) {
                setSelectedBotId(null);
                setBotUsername('');
                setBotPassword('');
                window.localStorage.removeItem('spd_selected_bot');
            }
            setBotMsg('机器人已删除');
            await loadBots();
        } catch (e) {
            setBotMsg('删除失败：' + e.message);
        }
    };

    const selectBot = (bot) => {
        setSelectedBotId(bot.id);
        setBotUsername(bot.username);
        setBotPassword('');
        // 持久化选中状态，退出页面后依然保持
        window.localStorage.setItem('spd_selected_bot', String(bot.id));
        setBotMsg(`已选用机器人「${bot.name}」，密码将安全地从服务器读取`);
    };

    const handleSubmit = async () => {
        setError('');
        setResults(null);
        if (!site) return setError('请选择站点');
        if (!selectedBotId && !botUsername) return setError('请选择机器人或填写机器人账号');
        if (pageList.length === 0) return setError('请至少输入一个页面');
        if (!timerIframe.trim()) return setError('请先生成计时器代码');

        setLoading(true);
        try {
            const res = await fetch('/api/tools/staff-post-deletion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site,
                    pages: pageList,
                    botAccountId: selectedBotId,
                    botUsername,
                    botPassword,
                    deleteScore,
                    countdownHours,
                    tagName,
                    timerBaseUrl,
                    customTimerIframe: timerIframe,
                    announcementText
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '操作失败');
            setResults(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // 登录保护：未登录时只显示提示，不渲染操作界面
    if (!authChecked) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-fg-3 text-sm flex items-center gap-2">
                    <i className="fa-solid fa-spinner fa-spin"></i> 正在检查登录状态...
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <>
                <Head>
                    <title>删帖公示操作 - {config.SITE_NAME}</title>
                </Head>
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="text-center max-w-md mx-auto bg-panel rounded-2xl border border-line p-10">
                        <i className="fa-solid fa-lock text-4xl text-fg-3 mb-4"></i>
                        <h1 className="text-2xl font-bold text-fg mb-2">需要登录</h1>
                        <p className="text-fg-3 text-sm mb-6">
                            「删帖公示操作」涉及自动添加标签与发布公告，需要登录 WikitDB 账户后才能使用。
                        </p>
                        <Link href="/login"
                            className="inline-block px-6 py-2.5 bg-accent-solid text-accent-fg rounded-lg hover:bg-accent-solid-hover transition-colors text-sm font-medium">
                            <i className="fa-solid fa-right-to-bracket mr-1.5"></i>前往登录
                        </Link>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head>
                <title>删帖公示操作 - {config.SITE_NAME}</title>
            </Head>
            <div className="py-8 max-w-4xl mx-auto">
                <div className="mb-6 border-b border-line pb-4 flex items-center gap-4">
                    <Link href="/tools" className="text-fg-3 hover:text-fg transition-colors">
                        <i className="fa-solid fa-arrow-left"></i> 返回
                    </Link>
                    <h1 className="text-2xl font-bold text-fg">删帖公示操作</h1>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
                        <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
                    </div>
                )}

                <div className="bg-panel rounded-xl p-6 border border-line space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                            <i className="fa-solid fa-robot text-accent"></i> 我的机器人
                        </h2>
                        <span className="text-xs text-fg-3">在此创建的机器人会进入列表，可直接选用</span>
                    </div>

                    {botMsg && (
                        <div className="p-3 rounded-lg bg-accent-soft border border-accent-line text-accent text-sm">{botMsg}</div>
                    )}

                    {bots.length > 0 && (
                        <div className="space-y-2">
                            {bots.map((bot) => (
                                <div key={bot.id}
                                    className={`p-3 rounded-lg border text-sm ${selectedBotId === bot.id ? 'bg-accent-soft border-accent-line' : 'bg-sunken border-line'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <i className="fa-solid fa-robot text-fg-3"></i>
                                            <div className="min-w-0">
                                                <div className="text-fg-2 font-medium truncate">{bot.name}</div>
                                                <div className="text-xs text-fg-3 truncate">{bot.username}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button type="button" onClick={() => selectBot(bot)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${selectedBotId === bot.id ? 'bg-accent-solid text-accent-fg' : 'text-accent border border-accent-line hover:bg-accent-soft'}`}>
                                                {selectedBotId === bot.id ? '✓ 使用中' : '使用'}
                                            </button>
                                            <button type="button" onClick={() => startEditBot(bot)}
                                                className="px-3 py-1.5 rounded text-xs font-medium bg-raised text-fg border border-line hover:border-line-strong transition-colors">
                                                <i className="fa-solid fa-gear"></i>
                                            </button>
                                            <button type="button" onClick={() => deleteBot(bot.id)}
                                                className="px-3 py-1.5 rounded text-xs font-medium bg-red-600/20 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors">
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-3">
                                        <span><i className="fa-solid fa-clock mr-1"></i>自动扫描：{intervalLabel(bot.scanInterval || 0)}</span>
                                        <span><i className="fa-solid fa-globe mr-1"></i>站点：{(Array.isArray(bot.scanSites) && bot.scanSites.length ? bot.scanSites.map(siteName).join('、') : '未指定')}</span>
                                        <span><i className="fa-solid fa-scale-balanced mr-1"></i>删除线：{bot.deleteScore ?? -5}</span>
                                        <span><i className="fa-solid fa-hourglass-half mr-1"></i>倒计时：{bot.countdownHours ?? 72} 小时</span>
                                        <span>{bot.hasSession ? <span className="text-green-600 dark:text-green-400"><i className="fa-solid fa-key mr-1"></i>会话已配置</span> : <span className="text-amber-600 dark:text-amber-400"><i className="fa-solid fa-key mr-1"></i>未配会话</span>}</span>
                                        <span><i className="fa-solid fa-history mr-1"></i>上次扫描：{bot.lastScanAt ? formatBotDate(bot.lastScanAt) : '从未'}</span>
                                        <span><i className="fa-solid fa-calendar mr-1"></i>创建：{formatBotDate(bot.createdAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {bots.length === 0 && (
                        <div className="p-4 rounded-lg bg-sunken border border-line text-center text-fg-3 text-sm">
                            还没有机器人，创建后即可在下方列表中选择使用
                        </div>
                    )}

                    {editingBot && (
                        <div className="p-4 rounded-lg bg-accent-soft border border-accent-line space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-accent">编辑机器人「{editingBot.name}」</h3>
                                <button type="button" onClick={cancelEditBot} className="text-fg-3 hover:text-fg text-xs">
                                    <i className="fa-solid fa-xmark mr-1"></i>取消
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-fg-3 mb-1">名称</label>
                                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5" />
                                </div>
                                <div>
                                    <label className="block text-xs text-fg-3 mb-1">自动扫描间隔</label>
                                    <select value={editInterval} onChange={(e) => setEditInterval(parseInt(e.target.value, 10))}
                                        className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5">
                                        {SCAN_INTERVAL_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-fg-3 mb-1">指定扫描站点（可多选）</label>
                                <div className="flex flex-wrap gap-2">
                                    {wikis.map((w) => (
                                        <label key={w.PARAM}
                                            className={`px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${editSites.includes(w.PARAM) ? 'bg-accent-soft border-accent-line text-accent' : 'bg-sunken border-line text-fg-3 hover:border-line-strong'}`}>
                                            <input type="checkbox" className="mr-1.5" checked={editSites.includes(w.PARAM)} onChange={() => toggleEditSite(w.PARAM)} />
                                            {w.NAME}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-fg-3 mb-1">删除线（分数阈值）</label>
                                    <input type="number" value={editDeleteScore} onChange={(e) => setEditDeleteScore(parseInt(e.target.value, 10) || 0)}
                                        className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5" />
                                </div>
                                <div>
                                    <label className="block text-xs text-fg-3 mb-1">计时器倒计时时间（小时）</label>
                                    <input type="number" min="1" value={editCountdownHours} onChange={(e) => setEditCountdownHours(parseInt(e.target.value, 10) || 72)}
                                        className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-fg-3 mb-1">
                                    Wikidot 会话 Cookie（可选，强烈建议）{editingBot && editingBot.hasSession ? <span className="text-green-600 dark:text-green-400">· 已配置</span> : <span className="text-amber-600 dark:text-amber-400">· 未配置</span>}
                                </label>
                                <textarea value={editSessionCookie} onChange={(e) => setEditSessionCookie(e.target.value)} rows={3}
                                    className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5 font-mono"
                                    placeholder={'在浏览器登录该机器人账号后，复制 WIKIDOT_SESSION_ID 的值（形如 a1b2c3d4e5...），粘贴到此处。配置后自动扫描/发帖将直接使用该会话，避免频繁登录触发限制。留空保持不变。'} />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={saveEditBot}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                                    <i className="fa-solid fa-check mr-1.5"></i>保存设置
                                </button>
                                <button type="button" onClick={cancelEditBot}
                                    className="px-4 py-2 bg-raised text-fg rounded-lg hover:bg-sunken transition-colors text-sm font-medium">
                                    取消
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <input type="text" value={botName} onChange={(e) => setBotName(e.target.value)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="机器人名称" />
                        </div>
                        <div>
                            <input type="text" value={botNewUsername} onChange={(e) => setBotNewUsername(e.target.value)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="Wikidot 账号" />
                        </div>
                        <div>
                            <input type="password" value={botNewPassword} onChange={(e) => setBotNewPassword(e.target.value)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="Wikidot 密码" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-fg-2 mb-1">自动扫描间隔</label>
                            <select value={scanInterval} onChange={(e) => setScanInterval(parseInt(e.target.value, 10))}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5">
                                {SCAN_INTERVAL_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fg-2 mb-1">指定扫描站点（可多选）</label>
                            <div className="flex flex-wrap gap-2">
                                {wikis.map((w) => (
                                    <label key={w.PARAM}
                                        className={`px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${scanSites.includes(w.PARAM) ? 'bg-accent-soft border-accent-line text-accent' : 'bg-sunken border-line text-fg-3 hover:border-line-strong'}`}>
                                        <input type="checkbox" className="mr-1.5" checked={scanSites.includes(w.PARAM)} onChange={() => toggleScanSite(w.PARAM)} />
                                        {w.NAME}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-fg-2 mb-1">删除线（分数阈值）</label>
                            <input type="number" value={botDeleteScore} onChange={(e) => setBotDeleteScore(parseInt(e.target.value, 10) || 0)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="-5" />
                            <p className="text-xs text-fg-3 mt-1">评分低于/等于该分数线的原创页面将自动处理</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fg-2 mb-1">计时器倒计时时间（小时）</label>
                            <input type="number" min="1" value={botCountdownHours} onChange={(e) => setBotCountdownHours(parseInt(e.target.value, 10) || 72)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="72" />
                            <p className="text-xs text-fg-3 mt-1">公告中的删除倒计时时长</p>
                        </div>
                    </div>
                    <button type="button" onClick={createBot} disabled={creatingBot}
                        className="px-4 py-2 bg-accent-solid text-accent-fg rounded-lg hover:bg-accent-solid-hover transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                        {creatingBot ? (
                            <><i className="fa-solid fa-spinner fa-spin mr-1.5"></i>创建中...</>
                        ) : (
                            <><i className="fa-solid fa-plus mr-1.5"></i>创建机器人</>
                        )}
                    </button>
                </div>

                <div className="bg-panel rounded-xl p-6 border border-line space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-fg-2 mb-1">目标站点</label>
                        <select value={site} onChange={(e) => setSite(e.target.value)}
                            className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5">
                            <option value="">选择站点...</option>
                            {wikis.map((w) => (
                                <option key={w.PARAM} value={w.PARAM}>{w.NAME} ({w.WIKIT_ID})</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-fg-2 mb-1">机器人账号</label>
                            <input type="text" value={botUsername} onChange={(e) => setBotUsername(e.target.value)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="Wikidot 机器人账号（留空用服务器 Bot）" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fg-2 mb-1">机器人密码</label>
                            <input type="password" value={botPassword} onChange={(e) => setBotPassword(e.target.value)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="Wikidot 机器人密码（留空用服务器 Bot）" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-fg-2 mb-1">删除线（分数阈值）</label>
                            <input type="number" value={deleteScore} onChange={(e) => setDeleteScore(parseInt(e.target.value, 10) || 0)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="-5" />
                            <p className="text-xs text-fg-3 mt-1">评分低于/等于该分数线即宣告删除</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fg-2 mb-1">计时器倒计时时间（小时）</label>
                            <input type="number" min="1" value={countdownHours} onChange={(e) => setCountdownHours(parseInt(e.target.value, 10) || 72)}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                                placeholder="72" />
                            <p className="text-xs text-fg-3 mt-1">公告中的删除倒计时时长</p>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-fg-2">计时器代码</label>
                            <button type="button" onClick={regenerateTimer}
                                className="px-3 py-1 text-accent border border-accent-line rounded hover:bg-accent-soft transition-colors text-xs">
                                <i className="fa-solid fa-rotate mr-1"></i>重新生成
                            </button>
                        </div>
                        <p className="text-xs text-fg-3 mb-2">计时器代码在此处使用：<code className="text-accent bg-sunken px-1.5 py-0.5 rounded">D:\scp\timer</code>（SCP Wiki 删除计时器）</p>
                        <textarea value={timerIframe} onChange={(e) => setTimerIframe(e.target.value)} rows={3}
                            className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5 font-mono"
                            placeholder="点击「重新生成」生成 [[iframe ...]] 计时器代码，或手动粘贴自定义代码" />
                    </div>
                </div>

                <div className="bg-panel rounded-xl p-6 border border-line space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-fg-2 mb-1">待处理页面（每行一个页面名或完整 URL）</label>
                        <textarea value={pagesText} onChange={(e) => setPagesText(e.target.value)} rows={6}
                            className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5 font-mono"
                            placeholder={'例如：\nscp-001\nhttps://deep-forest-club.wikidot.com/scp-002'} />
                        {pageList.length > 0 && (
                            <p className="text-xs text-fg-3 mt-1">已解析 {pageList.length} 个页面</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-fg-2 mb-1">待添加标签</label>
                        <input type="text" value={tagName} onChange={(e) => setTagName(e.target.value)}
                            className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5"
                            placeholder="待删除" />
                    </div>
                </div>

                <div className="bg-panel rounded-xl p-6 border border-line space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-fg-2">公告内容（可编辑，发帖时逐页面套用）</label>
                        <button type="button" onClick={fillDefaultTemplate}
                            className="px-3 py-1 bg-green-600/20 text-green-600 dark:text-green-400 border border-green-500/30 rounded hover:bg-green-600/30 transition-colors text-xs">
                            <i className="fa-solid fa-file-lines mr-1"></i>填充默认模板
                        </button>
                    </div>
                    <textarea value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} rows={8}
                        className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5 font-mono"
                        placeholder="公告模板（含 [[iframe]] 计时器代码）..." />
                    <p className="text-xs text-fg-3">新主题标题固定为「职员帖：删除宣告」，内容使用计时器代码自动生成的删文帖格式。</p>
                </div>

                <div className="flex items-center gap-3">
                    <button type="button" onClick={handleSubmit} disabled={loading}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50">
                        {loading ? (
                            <><i className="fa-solid fa-spinner fa-spin mr-2"></i>执行中...</>
                        ) : (
                            <><i className="fa-solid fa-bullhorn mr-2"></i>执行：添加标签 + 发布删帖公告</>
                        )}
                    </button>
                    {results && (
                        <span className="text-sm text-fg-3">
                            成功 <span className="text-green-600 dark:text-green-400 font-bold">{results.ok}</span>，失败 <span className="text-red-600 dark:text-red-400 font-bold">{results.fail}</span>
                        </span>
                    )}
                </div>

                {results && results.results && (
                    <div className="mt-6 bg-panel rounded-xl p-6 border border-line">
                        <h2 className="text-lg font-bold text-fg mb-4">执行结果</h2>
                        <div className="space-y-2">
                            {results.results.map((r, idx) => (
                                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${r.status === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                    <i className={`mt-0.5 ${r.status === 'success' ? 'fa-solid fa-circle-check text-green-600 dark:text-green-400' : 'fa-solid fa-circle-xmark text-red-600 dark:text-red-400'}`}></i>
                                    <div className="flex-1">
                                        <div className="text-fg-2 font-medium">{r.page}</div>
                                        {r.status === 'success' ? (
                                            <div className="text-fg-3 text-xs mt-0.5">
                                                已添加标签「{r.tag}」→ 标签列表: {(r.tags || []).join(', ')}；公告已发布到 {r.target}（HTTP {r.httpStatus}）
                                            </div>
                                        ) : (
                                            <div className="text-red-600 dark:text-red-400 text-xs mt-0.5">{r.message}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 删除公告 Bot 管理（控制独立 Python bot） */}
                <div className="mt-6 bg-panel rounded-xl p-6 border border-line">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                            <i className="fa-solid fa-robot text-green-600 dark:text-green-400"></i> 删除公告 Bot（自动运行）
                        </h2>
                        <span className={`px-3 py-1 rounded text-xs font-medium ${botInfo && botInfo.active ? 'bg-green-600/20 text-green-600 dark:text-green-400' : 'bg-red-600/20 text-red-600 dark:text-red-400'}`}>
                            {botInfo && botInfo.active ? '● 运行中' : '○ 已停止'}
                        </span>
                    </div>
                    <p className="text-xs text-fg-3 mb-4">
                        独立 Python bot（/opt/wikit-delete-bot）每 30 分钟自动扫描站点，为低分页面添加「待删除」标签并发布「职员帖：删除宣告」。可在下方配置账号与手动会话、触发运行或查看日志。
                    </p>

                    {botManageMsg && (
                        <div className="mb-3 p-3 rounded-lg bg-accent-soft border border-accent-line text-accent text-sm">{botManageMsg}</div>
                    )}

                    {botConfig ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-fg-3 mb-1">机器人账号</label>
                                <input type="text" value={botConfig.username || ''} onChange={(e) => setBotConfig({ ...botConfig, username: e.target.value })}
                                    className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5" />
                            </div>
                            <div>
                                <label className="block text-xs text-fg-3 mb-1">机器人密码</label>
                                <input type="password" value={botConfig.password || ''} onChange={(e) => setBotConfig({ ...botConfig, password: e.target.value })}
                                    className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5" />
                            </div>
                            <div>
                                <label className="block text-xs text-fg-3 mb-1">目标站点</label>
                                <input type="text" value={botConfig.siteUnixName || ''} onChange={(e) => setBotConfig({ ...botConfig, siteUnixName: e.target.value })}
                                    className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5" placeholder="如 rule-wiki" />
                            </div>
                            <div>
                                <label className="block text-xs text-fg-3 mb-1">手动会话 WIKIDOT_SESSION_ID
                                    {botConfig.session_cookie ? <span className="text-green-600 dark:text-green-400"> · 已配置</span> : <span className="text-amber-600 dark:text-amber-400"> · 未配置</span>}
                                </label>
                                <input type="text" value={botConfig.session_cookie || ''} onChange={(e) => setBotConfig({ ...botConfig, session_cookie: e.target.value })}
                                    className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5 font-mono"
                                    placeholder="浏览器登录后复制 WIKIDOT_SESSION_ID 的值" />
                            </div>
                            <div>
                                <label className="block text-xs text-fg-3 mb-1">扫描间隔（分钟）</label>
                                <input type="number" min="1" value={botConfig.scan_interval_minutes || 30} onChange={(e) => setBotConfig({ ...botConfig, scan_interval_minutes: parseInt(e.target.value, 10) || 30 })}
                                    className="w-full bg-sunken border border-line text-fg text-sm rounded-lg p-2.5" />
                                <p className="text-xs text-fg-3 mt-1">Bot 每隔该时间自动扫描一轮</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-fg-3 text-sm mb-4">无法读取 bot 配置（bot 未部署？）</div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-4">
                        <button type="button" onClick={saveBotConfig} disabled={botLoading}
                            className="px-4 py-2 bg-accent-solid text-accent-fg rounded-lg hover:bg-accent-solid-hover transition-colors text-sm font-medium disabled:opacity-50">
                            <i className="fa-solid fa-floppy-disk mr-1.5"></i>保存配置
                        </button>
                        <button type="button" onClick={() => botAction('run')} disabled={botLoading}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50">
                            <i className="fa-solid fa-play mr-1.5"></i>立即运行一轮
                        </button>
                        <button type="button" onClick={() => botAction('restart')} disabled={botLoading}
                            className="px-4 py-2 bg-amber-600/30 text-amber-600 dark:text-amber-300 rounded-lg hover:bg-amber-600/50 transition-colors text-sm font-medium disabled:opacity-50">
                            <i className="fa-solid fa-rotate mr-1.5"></i>重启服务
                        </button>
                        <button type="button" onClick={() => botAction('stop')} disabled={botLoading}
                            className="px-4 py-2 bg-red-600/30 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-600/50 transition-colors text-sm font-medium disabled:opacity-50">
                            <i className="fa-solid fa-stop mr-1.5"></i>停止
                        </button>
                    </div>

                    {botInfo && botInfo.log ? (
                        <div>
                            <label className="block text-xs text-fg-3 mb-1">最近日志</label>
                            <pre className="w-full max-h-56 overflow-auto bg-sunken border border-line rounded-lg p-3 text-xs text-fg-3 font-mono whitespace-pre-wrap">{botInfo.log}</pre>
                        </div>
                    ) : (
                        <div className="text-fg-3 text-sm">暂无日志</div>
                    )}
                </div>
            </div>
        </>
    );
};

export default StaffPostDeletion;

