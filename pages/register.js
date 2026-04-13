import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Register() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // 新增：邮箱验证相关的状态
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    
    const [step, setStep] = useState(1);
    const [verifyCode, setVerifyCode] = useState('');
    const [boundWdid, setBoundWdid] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 获取邮箱验证码
    const handleSendCode = async () => {
        setError('');
        setSuccess('');
        
        if (!email) return setError('请先输入邮箱地址');
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError('邮箱格式不正确');

        setCountdown(60);
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        try {
            const res = await fetch('/api/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (!res.ok) {
                setError(data.error || '验证码发送失败');
                setCountdown(0);
                clearInterval(timer);
            } else {
                setSuccess('验证码已发送，请前往邮箱查收（有效时间10分钟）');
                setTimeout(() => setSuccess(''), 5000);
            }
        } catch (err) {
            setError('网络错误，请稍后再试');
            setCountdown(0);
            clearInterval(timer);
        }
    };

    // 第一步：向后端发送 start 动作
    const handleNextStep = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        if (!username || !password || !email || !code) {
            setError('请完整填写所有信息（含邮箱和验证码）');
            return;
        }
        if (password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 把 email 也传过去，让后端查一下邮箱有没有被占用
                body: JSON.stringify({ action: 'start', username, password, email })
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || '无法启动验证流程');
            } else {
                setVerifyCode(data.verifyUrl); 
                setStep(2);
            }
        } catch (err) {
            setError('网络错误，请稍后再试');
        }
    };

    // 第二步：向后端发送 check 动作
    const handleCheckVerification = async () => {
        setIsVerifying(true);
        setError('');
        setSuccess('');
        
        try {
            const checkRes = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check', username })
            });
            const checkData = await checkRes.json();

            if (!checkRes.ok) {
                setError(checkData.error || '验证失败，请重试');
            } else {
                setBoundWdid(checkData.wdid);
                setStep(3);
            }
        } catch (err) {
            setError('网络错误，请稍后再试');
        } finally {
            setIsVerifying(false);
        }
    };

    // 第三步：用户确认无误，发送 submit 动作正式入库
    const handleFinalSubmit = async () => {
        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const submitRes = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 最终入库时，把邮箱和验证码带上，做最后校验
                body: JSON.stringify({ action: 'submit', username, email, code })
            });
            const submitData = await submitRes.json();

            if (!submitRes.ok) {
                setError(submitData.error || '数据写入失败');
            } else {
                setSuccess('注册成功！档案已建立，即将跳转至登录页...');
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            }
        } catch (err) {
            setError('网络错误，请稍后再试');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Head>
                <title>注册 - WikitDB</title>
            </Head>

            <div className="w-full max-w-md bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden transition-all">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="text-center mb-8 relative z-10">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">加入 {config.SITE_NAME}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-tight uppercase tracking-widest opacity-80">初始化你的数字档案身份</p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm mb-6 text-center animate-shake">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 text-green-600 dark:text-green-400 p-3 rounded-xl text-sm mb-6 text-center animate-fade-in">
                        {success}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleNextStep} className="space-y-5 relative z-10">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">设定登录用户名</label>
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                                placeholder="推荐使用您的常用代号"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">设定密码</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                                placeholder="输入强密码"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">确认密码</label>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                                placeholder="再次输入密码"
                            />
                        </div>
                        
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800"></div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">电子邮箱</label>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                                placeholder="用于接收通知的邮箱"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">邮箱验证码</label>
                            <div className="flex gap-3">
                                <input 
                                    type="text" 
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="flex-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                                    placeholder="6位验证码"
                                    maxLength="6"
                                />
                                <button 
                                    type="button" 
                                    onClick={handleSendCode}
                                    disabled={countdown > 0}
                                    className={`px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap shadow-sm ${
                                        countdown > 0 
                                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700' 
                                            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                                    }`}
                                >
                                    {countdown > 0 ? `${countdown}s` : '获取代码'}
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all uppercase tracking-[0.2em] text-sm mt-4 flex items-center justify-center gap-2"
                        >
                            下一步：绑定 Wikidot 身份 <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>

                        <div className="mt-6 text-center">
                            <p className="text-gray-500 dark:text-gray-500 text-xs">
                                已有档案记录？ <a href="/login" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline ml-1 tracking-tight">立即接入终端</a>
                            </p>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <div className="space-y-6 relative z-10">
                        <div className="bg-indigo-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-indigo-100 dark:border-gray-800 shadow-inner">
                            <h3 className="text-indigo-900 dark:text-white font-bold mb-3 text-sm flex items-center gap-2">
                                <i className="fa-solid fa-circle-info"></i> Wikidot 身份绑定指引：
                            </h3>
                            <ol className="text-indigo-800/70 dark:text-gray-400 text-xs list-decimal list-inside space-y-2.5 leading-relaxed font-medium">
                                <li>复制下方的专属验证码。</li>
                                <li>前往验证页：<a href="https://wikkit.wikidot.com/wikitdb:verify" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-blue-400 font-bold hover:underline">wikitdb:verify</a></li>
                                <li>点击页面底部的 <strong>Edit (编辑)</strong>。</li>
                                <li>在正文添加空格，并在 <strong>Short description</strong> 框粘贴。</li>
                                <li>点击 <strong>Save (保存)</strong>，然后回到这里。</li>
                            </ol>
                        </div>

                        <div className="text-center bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-gray-800 py-5 rounded-2xl shadow-inner group">
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em] mb-2">专属身份验证代码</div>
                            <div className="text-3xl font-mono font-black text-indigo-600 dark:text-yellow-400 select-all tracking-wider group-hover:scale-105 transition-transform">
                                {verifyCode}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setStep(1)}
                                className="px-5 py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-white font-bold rounded-xl transition-all text-xs uppercase tracking-widest"
                            >
                                <i className="fa-solid fa-arrow-left mr-2"></i> 返回修改
                            </button>
                            <button 
                                onClick={handleCheckVerification}
                                disabled={isVerifying}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20 text-xs uppercase tracking-widest disabled:opacity-50"
                            >
                                {isVerifying ? <><i className="fa-solid fa-spinner animate-spin mr-2"></i> 正在检索...</> : '我已完成编辑，开始验证'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 relative z-10 text-center py-4">
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 p-8 rounded-2xl shadow-inner">
                            <div className="text-green-500 text-6xl mb-6 drop-shadow-sm">
                                <i className="fa-solid fa-circle-check"></i>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">身份识别成功</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">我们已在 Wikit 验证记录中确认了您的身份，邮箱验证也已就绪。</p>
                            
                            <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">绑定的 Wikidot 身份</span>
                                <span className="text-2xl font-black text-indigo-600 dark:text-blue-400 tracking-tight">{boundWdid}</span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => setStep(2)}
                                className="px-5 py-3.5 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                            >
                                账号不对？
                            </button>
                            <button 
                                onClick={handleFinalSubmit}
                                disabled={isVerifying}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-indigo-500/20 text-xs uppercase tracking-[0.2em] disabled:opacity-50"
                            >
                                {isVerifying ? '正在建立档案...' : '确认绑定并注册'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}