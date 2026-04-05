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
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <Head>
                <title>登录</title>
            </Head>
            
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 w-full max-w-md">
                <h1 className="text-2xl font-bold text-white mb-6 text-center">登录账号</h1>
                
                {message && (
                    <div className="mb-4 p-3 rounded bg-gray-700/50 text-gray-300 text-sm text-center border border-gray-600">
                        {message}
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">用户名或邮箱</label>
                        <input 
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none transition-colors"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">密码</label>
                        <input 
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none transition-colors"
                        />
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50 mt-4"
                    >
                        {loading ? '登录中...' : '登录'}
                    </button>
                </form>
            </div>
        </div>
    );
}
