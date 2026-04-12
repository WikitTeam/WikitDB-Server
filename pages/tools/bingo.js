import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function TagBingo() {
    const [username, setUsername] = useState(null);
    const [balance, setBalance] = useState(0);
    const [selectedTags, setSelectedTags] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [isScratched, setIsScratched] = useState(false);
    
    const [availableTags, setAvailableTags] = useState([]);
    const [scanCost, setScanCost] = useState(50);

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
            fetch('/api/admin/user-assets?username=' + storedUsername)
                .then(res => res.json())
                .then(data => { if(data.portfolio) setBalance(data.portfolio.balance || 0); });
        }
        fetch('/api/tools/bingo').then(res => res.json()).then(data => {
            if (data.tags) setAvailableTags(data.tags);
            if (data.cost) setScanCost(data.cost);
        });
    }, []);

    const toggleTag = (tag) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            if (selectedTags.length >= 3) return alert('最多只能选择 3 个标签');
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const handleScan = async () => {
        if (!username) return alert('请先登录系统');
        if (selectedTags.length !== 3) return alert('请精确选择 3 个标签');
        
        setIsScanning(true);
        setResult(null);
        setIsScratched(false);

        try {
            const res = await fetch('/api/tools/bingo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, selectedTags })
            });
            const data = await res.json();
            
            if (res.ok) {
                setResult(data);
                setBalance(data.newBalance);
            } else {
                alert(data.error || '请求失败');
            }
        } catch (error) {
            alert('网络连接错误，请重试。');
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <>
            <Head><title>标签大乐透 - WikitDB</title></Head>
            
            <div className="max-w-4xl mx-auto">
                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-800 pb-8">
                    <div>
                        <Link href="/tools" className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-4 inline-block hover:text-blue-400 transition-colors">
                            <i className="fa-solid fa-arrow-left mr-2"></i> 返回工具箱
                        </Link>
                        <h1 className="text-4xl font-black text-white tracking-tight">标签大乐透</h1>
                        <p className="text-gray-500 mt-2 text-sm leading-relaxed max-w-lg">通过系统扫描算法命中特定标签，即可赢取最高百倍赔率的奖金。数据同步自 Wikidot 实时内容。</p>
                    </div>
                    <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-4 md:p-6 shadow-xl min-w-[200px]">
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">可用余额</div>
                        <div className="text-2xl font-mono text-green-400 font-black">¥ {balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* 左侧选择区 */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-gray-800/20 border border-gray-800 rounded-2xl p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fa-solid fa-tags text-teal-500"></i> 请选择 3 个目标标签
                                </h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${selectedTags.length === 3 ? 'bg-green-900/20 text-green-500 border-green-800/30' : 'bg-gray-900 text-gray-600 border-gray-800'}`}>
                                    已选 {selectedTags.length} / 3
                                </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {availableTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border font-mono ${
                                            selectedTags.includes(tag) 
                                            ? 'bg-teal-600 text-white border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.4)]' 
                                            : 'bg-gray-900 text-gray-500 border-gray-800 hover:border-gray-600 hover:text-gray-300'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-8 pt-8 border-t border-gray-800/50">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs text-gray-500 font-bold uppercase">单次扫描费用</span>
                                    <span className="font-mono text-white font-bold">¥ {scanCost.toFixed(2)}</span>
                                </div>
                                <button 
                                    onClick={handleScan} 
                                    disabled={isScanning || selectedTags.length !== 3}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black text-sm tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-blue-900/20 uppercase"
                                >
                                    {isScanning ? '正在同步原站数据...' : '执行数据扫描'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 右侧结果区 */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 h-full flex flex-col relative overflow-hidden shadow-inner">
                            <div className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-6">扫描结果缓冲区</div>
                            
                            <div className="flex-1 flex flex-col justify-center">
                                {!result && !isScanning && (
                                    <div className="text-center space-y-4 py-12">
                                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto border border-gray-800">
                                            <i className="fa-solid fa-radar text-gray-700 text-xl"></i>
                                        </div>
                                        <p className="text-xs text-gray-600 font-mono italic">等待扫描仪输入指令...</p>
                                    </div>
                                )}

                                {isScanning && (
                                    <div className="text-center space-y-4 py-12 animate-pulse">
                                        <div className="w-16 h-16 bg-teal-900/10 rounded-full flex items-center justify-center mx-auto border border-teal-900/20">
                                            <i className="fa-solid fa-spinner fa-spin text-teal-500 text-xl"></i>
                                        </div>
                                        <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest">正在访问 Wikidot 数据库...</p>
                                    </div>
                                )}

                                {result && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div>
                                            <h4 className="text-xs text-gray-500 font-bold uppercase mb-2 tracking-widest">匹配到的文档</h4>
                                            <div className="text-lg font-bold text-white leading-tight mb-2">{result.page.title}</div>
                                            <div className="text-[10px] text-gray-600 font-mono italic">编号: {result.page.id} / 作者: {result.page.author}</div>
                                        </div>

                                        <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-xl shadow-inner">
                                            <div className="text-[10px] text-gray-600 font-bold uppercase mb-3 tracking-widest">文档标签数据</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {result.page.tags?.map(t => (
                                                    <span key={t} className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                                                        result.matchedTags.includes(t) 
                                                        ? 'bg-teal-900/40 text-teal-400 border-teal-700/50' 
                                                        : 'bg-black text-gray-700 border-gray-900'
                                                    }`}>
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pt-4 flex items-center justify-between border-t border-gray-800">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">匹配数 <span className="text-white ml-2">{result.matchCount} / 3</span></div>
                                            <div className="text-xl font-black font-mono">
                                                {result.matchCount === 0 && <span className="text-gray-700 uppercase italic">扫描失败</span>}
                                                {result.matchCount === 1 && <span className="text-blue-500">+ ¥{scanCost.toFixed(2)}</span>}
                                                {result.matchCount === 2 && <span className="text-orange-500">+ ¥{(scanCost * 10).toFixed(2)}</span>}
                                                {result.matchCount === 3 && <span className="text-red-500 animate-pulse">+ ¥{(scanCost * 100).toFixed(2)}</span>}
                                            </div>
                                        </div>

                                        {/* 拟真涂层 */}
                                        {!isScratched && (
                                            <div 
                                                onClick={() => setIsScratched(true)}
                                                className="absolute inset-0 bg-[#222] cursor-pointer flex items-center justify-center rounded-2xl border border-gray-700 shadow-2xl z-20"
                                                style={{ backgroundImage: 'repeating-linear-gradient(45deg, #1a1a1a, #1a1a1a 10px, #222 10px, #222 20px)' }}
                                            >
                                                <div className="bg-black/80 px-6 py-3 rounded-full text-white font-black text-xs tracking-[0.3em] border border-gray-800 uppercase flex items-center gap-3 shadow-2xl scale-90 hover:scale-100 transition-transform">
                                                    <i className="fa-solid fa-hand-pointer text-teal-500 animate-bounce"></i>
                                                    点击刮开涂层
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
