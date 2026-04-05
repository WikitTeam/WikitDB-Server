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
        // 严格遵循你的全站原版式布局结构
        <div className="py-8">
            <Head><title>标签大乐透 - WikitDB</title></Head>
            
            <div className="max-w-5xl mx-auto px-4">
                <div className="mb-8 border-b border-gray-800 pb-4">
                    <Link href="/tools" className="text-blue-500 hover:text-blue-400 text-sm mb-4 inline-block transition-colors">&larr; 返回工具箱</Link>
                    <h1 className="text-3xl font-bold text-white">标签大乐透</h1>
                    <p className="text-gray-400 mt-2 text-sm">消耗扫描凭证，命中特定标签即可赢取最高百倍赔率的奖金。</p>
                </div>

                <div className="max-w-md mx-auto bg-[#121212] border-2 border-teal-900/50 rounded-xl p-5 shadow-[0_0_15px_rgba(20,184,166,0.15)] select-none">
                    <div className="text-center mb-6">
                        <div className="text-gray-500 text-[10px] mb-1 font-mono uppercase tracking-widest">Verified Balance</div>
                        <div className="text-2xl font-mono text-green-400 font-bold">¥ {balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>

                    {/* 标签选号区域 */}
                    <div className="mb-6 bg-[#0a0a0a] p-4 rounded-lg border border-gray-800 shadow-inner">
                        <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
                            <span className="text-xs text-gray-400 font-mono">目标标签 ({selectedTags.length}/3)</span>
                            <span className="text-xs text-teal-500 font-bold font-mono">Cost: ¥{scanCost}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {availableTags.length === 0 && <span className="text-xs text-gray-700 font-mono animate-pulse">Loading...</span>}
                            {availableTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all border font-mono ${
                                        selectedTags.includes(tag) 
                                        ? 'bg-teal-900/30 text-teal-400 border-teal-700 shadow-[0_0_8px_rgba(20,184,166,0.3)]' 
                                        : 'bg-gray-900 text-gray-500 border-gray-800 hover:border-gray-600'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleScan} 
                        disabled={isScanning || selectedTags.length !== 3}
                        className="w-full py-4 bg-gray-800 hover:bg-gray-700 disabled:bg-[#0a0a0a] disabled:text-gray-700 border border-gray-700 disabled:border-gray-900 rounded-lg text-white font-bold text-sm tracking-widest transition-colors mb-6 shadow-md uppercase"
                    >
                        {isScanning ? '[Scanning Data...]' : `生成凭证并扫描 (¥${scanCost})`}
                    </button>

                    {/* 刮刮乐核心区域 */}
                    <div className="border border-gray-700 rounded-lg p-4 bg-[#050505] relative min-h-[160px] flex flex-col justify-center shadow-inner">
                        <div className="text-[10px] text-gray-600 mb-2 font-mono absolute top-3 left-4 uppercase tracking-widest">Revealed Result:</div>
                        
                        {!result && !isScanning && <div className="text-center text-gray-700 font-mono text-sm mt-4">[Waiting for Input]</div>}
                        {isScanning && <div className="text-center text-teal-600 font-mono text-xs mt-4 animate-pulse tracking-widest">EXTRACTING...</div>}

                        {result && (
                            <div className="relative mt-4 z-10 w-full">
                                <div className="space-y-3">
                                    <div className="text-white font-bold text-sm border-b border-gray-800 pb-2 leading-tight">{result.page.title}</div>
                                    <div className="text-[10px] text-gray-500 font-mono">Author: {result.page.author}</div>
                                    
                                    <div className="bg-gray-900 border border-gray-800 p-2 rounded">
                                        <div className="text-[10px] text-gray-600 uppercase mb-1 font-mono">Tags Detected:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {result.page.tags?.length ? result.page.tags.map(t => (
                                                <span key={t} className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold font-mono ${
                                                    result.matchedTags.includes(t) ? 'bg-teal-900/50 text-teal-400 border border-teal-800' : 'bg-black text-gray-600'
                                                }`}>
                                                    {t}
                                                </span>
                                            )) : <span className="text-gray-700 text-[10px] font-mono">NULL</span>}
                                        </div>
                                    </div>
                                    
                                    <div className="pt-2 flex items-center justify-between border-t border-gray-800">
                                        <div className="font-mono text-xs text-gray-500">Match: <span className="text-white font-bold">{result.matchCount}/3</span></div>
                                        <div className="font-bold text-sm font-mono">
                                            {result.matchCount === 0 && <span className="text-gray-600">FAILED</span>}
                                            {result.matchCount === 1 && <span className="text-blue-500">+ ¥{scanCost}</span>}
                                            {result.matchCount === 2 && <span className="text-orange-500">+ ¥{scanCost * 10}</span>}
                                            {result.matchCount === 3 && <span className="text-red-500 animate-pulse">+ ¥{scanCost * 100}</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* 灰色拟真刮刮乐涂层 */}
                                {!isScratched && (
                                    <div 
                                        onClick={() => setIsScratched(true)}
                                        className="absolute -inset-2 bg-[#444] cursor-pointer flex items-center justify-center rounded border border-gray-500 shadow-lg"
                                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #444, #444 10px, #3a3a3a 10px, #3a3a3a 20px)' }}
                                    >
                                        <div className="bg-black/90 px-5 py-2.5 rounded text-gray-300 font-bold text-xs tracking-widest border border-gray-600 uppercase flex items-center gap-2">
                                            <i className="fa-solid fa-hand-pointer text-teal-500 animate-pulse"></i>
                                            Scratch to Verify
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
