import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Login() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.username || !formData.password) {
            setMessage('请输入用户名和密码');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const data = await res.json();
            
if (res.ok) {
    setMessage('登录成功，跳转中...');
    // 把后端返回的信息存到本地，这样 Header 才能识别到
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    setTimeout(() => {
        router.push('/');
    }, 1000);
} else {
    setMessage(data.error || '账号或密码错误');
}
        } catch (err) {
            setMessage('网络请求失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center transition-colors duration-300">
            <Head>
                <title>登录</title>
            </Head>
            
            <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl border border-zinc-200 dark:border-zinc-700 w-full max-w-md shadow-xl transition-colors duration-300">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6 text-center">登录账号</h1>
                
                {message && (
                    <div className="mb-4 p-3 rounded bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-300 text-sm text-center border border-zinc-200 dark:border-zinc-600">
                        {message}
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">用户名或邮箱</label>
                        <input 
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white text-sm rounded-lg focus:ring-accent focus:border-accent-line block p-2.5 outline-none transition-colors"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">密码</label>
                        <input 
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white text-sm rounded-lg focus:ring-accent focus:border-accent-line block p-2.5 outline-none transition-colors"
                        />
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full text-accent-fg bg-accent-solid hover:bg-accent-solid-hover focus:ring-4 focus:outline-none focus:ring-accent font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50 mt-4"
                    >
                        {loading ? '登录中...' : '登录'}
                    </button>
                </form>
            </div>
        </div>
    );
}
