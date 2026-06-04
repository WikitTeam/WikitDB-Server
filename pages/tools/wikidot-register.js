import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');

export default function WikidotRegister() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [language, setLanguage] = useState('en');
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState('');
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleGetCaptcha = async (keepError) => {
        setLoading(true);
        if (!keepError) setError('');
        setCaptchaAnswer('');
        try {
            const r = await fetch('/api/tools/wikidot-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get-captcha' })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            if (!d.success) throw new Error(d.error);
            setCaptchaUrl(d.captchaUrl);
            setSession({
                captchaHash: d.captchaHash,
                originSiteId: d.originSiteId,
                time: d.time,
                wikidotToken7: d.wikidotToken7,
                sessionId: d.sessionId
            });
        } catch (e) {
            if (!keepError) setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!name) return setError('请输入用户名');
        if (!email) return setError('请输入邮箱');
        if (!password) return setError('请输入密码');
        if (password !== password2) return setError('两次密码不一致');
        if (!captchaAnswer) return setError('请输入验证码答案');
        if (!session) return setError('请先获取验证码');
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const r = await fetch('/api/tools/wikidot-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'register', name, email, password, language,
                    captchaAnswer, ...session
                })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            if (d.success) {
                setSuccess(d.message);
                if (d.detail) console.log('[wikidot-register] success detail:', d.detail);
            } else {
                setError(d.error || '注册失败');
                if (d.detail) console.log('[wikidot-register] detail:', d.detail);
                handleGetCaptcha(true);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Head><title>代注册 Wikidot 账号 - {config.SITE_NAME}</title></Head>
            <div className="py-8 max-w-2xl mx-auto">
                <div className="mb-6 border-b border-gray-700 pb-4 flex items-center gap-4">
                    <Link href="/tools" className="text-gray-400 hover:text-white transition-colors">
                        <i className="fa-solid fa-arrow-left"></i> 返回
                    </Link>
                    <h1 className="text-2xl font-bold text-white">代注册 Wikidot 账号</h1>
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
                        <label className="block text-sm font-medium text-gray-300 mb-1">用户名</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                            placeholder="你的 Wikidot 昵称" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">邮箱</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                            placeholder="用于接收确认邮件，他人不可见" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">偏好语言</label>
                        <select value={language} onChange={e => setLanguage(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5">
                            <option value="en">English</option>
                            <option value="zh">中文</option>
                            <option value="ja">日本語</option>
                            <option value="ko">한국어</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="es">Español</option>
                            <option value="pl">Polski</option>
                            <option value="ru">Русский</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">密码</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="设置密码" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">确认密码</label>
                            <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                placeholder="再次输入密码" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">验证码</label>
                        <div className="flex gap-3 items-center mb-2">
                            {captchaUrl ? (
                                <img src={captchaUrl} alt="captcha" className="h-10 rounded border border-gray-600 bg-white px-2" />
                            ) : (
                                <span className="text-gray-500 text-sm">点击按钮加载验证码</span>
                            )}
                            <button onClick={handleGetCaptcha} disabled={loading}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white text-xs rounded-lg transition-colors">
                                {loading && !captchaUrl ? '加载中...' : captchaUrl ? '刷新' : '获取验证码'}
                            </button>
                        </div>
                        <input type="text" value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                            placeholder="输入数学算式的答案" />
                    </div>
                    <button onClick={handleRegister} disabled={loading || !name || !email || !password || !captchaAnswer}
                        className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors">
                        {loading ? '提交中...' : '注册'}
                    </button>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        注册成功后 Wikidot 会发送确认邮件到你填写的邮箱，点击邮件中的链接即可激活账号。
                    </p>
                </div>
            </div>
        </>
    );
}
