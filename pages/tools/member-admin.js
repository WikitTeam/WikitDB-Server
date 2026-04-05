import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');

const MemberAdmin = () => {
    const [formData, setFormData] = useState({
        token: '',
        wiki: '',
        username: '',
        password: '',
        member: '',
        action: 'remove',
        reason: ''
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch('/api/tools/member-admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            
            if (data.status === 'success') {
                setResult({ type: 'success', message: data.message || '操作成功！' });
            } else {
                setResult({ type: 'error', message: data.message || data.error || '操作失败！' });
            }
        } catch (error) {
            setResult({ type: 'error', message: '网络请求失败，请稍后重试。' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>成员管理 - {config.SITE_NAME}</title>
            </Head>

            <div className="py-8 max-w-2xl mx-auto">
                <div className="mb-6 border-b border-gray-700 pb-4 flex items-center gap-4">
                    <Link href="/tools" className="text-gray-400 hover:text-white transition-colors">
                        <i className="fa-solid fa-arrow-left"></i> 返回
                    </Link>
                    <h1 className="text-2xl font-bold text-white">成员管理</h1>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">目标站点</label>
                                <input
                                    type="text"
                                    name="wiki"
                                    required
                                    placeholder="填入简写，如 if-backrooms"
                                    value={formData.wiki}
                                    onChange={handleChange}
                                    className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">接口凭证</label>
                                <input
                                    type="text"
                                    name="token"
                                    required
                                    placeholder="后台生成的 Token"
                                    value={formData.token}
                                    onChange={handleChange}
                                    className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">管理员用户名</label>
                                <input
                                    type="text"
                                    name="username"
                                    required
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">管理员密码</label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">操作目标用户</label>
                            <input
                                type="text"
                                name="member"
                                required
                                placeholder="填入 Wikidot 用户名"
                                value={formData.member}
                                onChange={handleChange}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">执行操作</label>
                            <select
                                name="action"
                                value={formData.action}
                                onChange={handleChange}
                                className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-colors"
                            >
                                <option value="remove">移除</option>
                                <option value="ban">封禁</option>
                            </select>
                        </div>

                        {formData.action === 'ban' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">封禁理由</label>
                                <textarea
                                    name="reason"
                                    rows="3"
                                    placeholder="选填，记录封禁原因"
                                    value={formData.reason}
                                    onChange={handleChange}
                                    className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-colors resize-none"
                                ></textarea>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors ${
                                loading ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {loading ? '正在提交...' : '确认执行'}
                        </button>
                    </form>

                    {result && (
                        <div className={`mt-6 p-4 rounded-lg border ${
                            result.type === 'success' 
                                ? 'bg-green-900/20 border-green-900/50 text-green-400' 
                                : 'bg-red-900/20 border-red-900/50 text-red-400'
                        }`}>
                            <div className="font-bold mb-1">
                                {result.type === 'success' ? '请求成功' : '请求失败'}
                            </div>
                            <div className="text-sm">{result.message}</div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default MemberAdmin;
