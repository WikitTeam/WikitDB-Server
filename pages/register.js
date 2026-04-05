// pages/register.js
import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Register() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [step, setStep] = useState(1);
    const [verifyCode, setVerifyCode] = useState('');
    const [boundWdid, setBoundWdid] = useState(''); // 新增：保存查到的维基账号
    const [isVerifying, setIsVerifying] = useState(false);
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 第一步：向后端发送 start 动作
    const handleNextStep = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!username || !password) {
            setError('请填写用户名和密码');
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
                body: JSON.stringify({ action: 'start', username, password })
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

    // 第二步：向后端发送 check 动作，查到了就进入第三步让用户确认
    const handleCheckVerification = async () => {
        setIsVerifying(true);
        setError('');
        
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
                // 查到了！把拿到的维基账号存起来，进入第三步确认
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

        try {
            const submitRes = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit', username })
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

            <div className="w-full max-w-md bg-gray-800/40 border border-gray-700 rounded-xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">加入Wikit数据库</h1>
                    <p className="text-gray-400 text-sm">注册 WikitDB 档案库</p>
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-800/50 text-red-400 p-3 rounded-lg text-sm mb-6 text-center">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-900/30 border border-green-800/50 text-green-400 p-3 rounded-lg text-sm mb-6 text-center">
                        {success}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleNextStep} className="space-y-5 relative z-10">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">设定登录用户名</label>
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="推荐使用您的常用代号"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">设定密码</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="输入密码"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">确认密码</label>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="再次输入密码"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors mt-2"
                        >
                            下一步：绑定验证
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <div className="space-y-6 relative z-10">
                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                            <h3 className="text-white font-bold mb-2 text-sm">请按照以下步骤完成 Wikidot 身份绑定：</h3>
                            <ol className="text-gray-400 text-sm list-decimal list-inside space-y-2 leading-relaxed">
                                <li>复制下方的专属验证码。</li>
                                <li>前往指定验证页面：<a href="https://wikkit.wikidot.com/wikitdb:verify" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">wikitdb:verify</a></li>
                                <li>点击该页面底部的 <strong>Edit (编辑)</strong>。</li>
                                <li>在页面正文随意添加一个空格，然后在 <strong>Short description (简短摘要)</strong> 输入框中粘贴验证码。</li>
                                <li>点击 <strong>Save (保存)</strong>，然后回到这里点击验证。</li>
                            </ol>
                        </div>

                        <div className="text-center bg-[#1e1e1e] border border-gray-600 py-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">您的专属验证码 (Short description)</div>
                            <div className="text-2xl font-mono font-bold text-yellow-400 select-all tracking-wider">
                                {verifyCode}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setStep(1)}
                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                            >
                                返回修改
                            </button>
                            <button 
                                onClick={handleCheckVerification}
                                disabled={isVerifying}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-gray-600"
                            >
                                {isVerifying ? '正在查询历史记录...' : '我已完成编辑，开始验证'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 relative z-10 text-center">
                        <div className="bg-green-900/20 border border-green-500/30 p-6 rounded-xl">
                            <div className="text-green-500 text-5xl mb-4">
                                <i className="fa-solid fa-user-check"></i>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">识别成功</h3>
                            <p className="text-gray-400 text-sm mb-6">我们在验证记录中找到了您的账户。</p>
                            
                            <div className="bg-gray-900/80 p-4 rounded-lg border border-gray-700">
                                <span className="text-sm text-gray-500 block mb-1">即将绑定的 Wikidot 身份</span>
                                <span className="text-2xl font-bold text-blue-400">{boundWdid}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setStep(2)}
                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                            >
                                账号不对？
                            </button>
                            <button 
                                onClick={handleFinalSubmit}
                                disabled={isVerifying}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg disabled:bg-gray-600"
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
