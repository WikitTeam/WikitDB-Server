import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// 物理涂层组件，用于验证成功后的刮刮乐效果
const ScratchMask = ({ children, isReady, label = 'SCRATCH TO VERIFY' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!isReady) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        ctx.fillStyle = 'rgba(127,127,127,1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 4000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.16)';
            ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
        }
        
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    }, [isReady, label]);

    const scratch = (e) => {
        if (e.buttons !== 1 && e.type !== 'touchmove') return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        let cx = e.clientX, cy = e.clientY;
        if (e.touches && e.touches.length > 0) {
            cx = e.touches[0].clientX;
            cy = e.touches[0].clientY;
        }
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx - rect.left, cy - rect.top, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx - rect.left + (Math.random()*10-5), cy - rect.top + (Math.random()*10-5), 15, 0, Math.PI * 2);
        ctx.fill();
    };

    if (!isReady) return null;

    return (
        <div className="relative w-full rounded overflow-hidden border border-line shadow-inner min-h-[160px] mt-6">
            <div className="absolute inset-0 bg-sunken p-4 flex flex-col justify-center z-0">
                {children}
            </div>
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full z-10 cursor-crosshair touch-none"
                onMouseMove={scratch}
                onMouseDown={(e) => { if (e.buttons === 1) scratch(e); }}
                onTouchMove={scratch}
            />
        </div>
    );
};

export default function BountyHunter() {
    const [username, setUsername] = useState(null);
    const [balance, setBalance] = useState(0);
    const [bounties, setBounties] = useState([]);
    const [inputs, setInputs] = useState({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
            fetch('/api/admin/user-assets?username=' + storedUsername)
                .then(res => res.json())
                .then(data => { if(data.portfolio) setBalance(data.portfolio.balance || 0); });
        }
        fetchBounties();
    }, []);

    const fetchBounties = async () => {
        const res = await fetch('/api/tools/bounty');
        const data = await res.json();
        if (data.bounties) setBounties(data.bounties);
    };

    const handleInputChange = (bountyId, field, value) => {
        setInputs(prev => ({
            ...prev,
            [bountyId]: { ...prev[bountyId], [field]: value }
        }));
    };

    const handleClaim = async (bountyId) => {
        if (!username) return alert('请先登录系统');
        const currentInput = inputs[bountyId];
        if (!currentInput || !currentInput.wiki || !currentInput.page) {
            return alert('请完整填写站点的 wiki 和 page 名称');
        }
        
        setIsProcessing(true);
        setResult(null);

        try {
            const res = await fetch('/api/tools/bounty', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    bountyId, 
                    wiki: currentInput.wiki.trim(), 
                    page: currentInput.page.trim() 
                })
            });
            const data = await res.json();
            
            if (res.ok) {
                setResult(data);
                setBalance(data.newBalance);
                setBounties(data.bounties);
                // 提交成功后清空该项的输入框
                setInputs(prev => ({ ...prev, [bountyId]: { wiki: '', page: '' } }));
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert('网络连接错误');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRefreshPool = async () => {
        if (!confirm('强制覆盖底层数据库刷新悬赏池？')) return;
        const res = await fetch('/api/tools/bounty', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'refresh' })
        });
        if (res.ok) {
            const data = await res.json();
            setBounties(data.bounties);
            setResult(null);
        }
    };

    return (
        <div className="py-8 font-sans select-none bg-canvas min-h-screen">
            <Head><title>异常档案悬赏令 - WikitDB</title></Head>
            <div className="max-w-5xl mx-auto px-4">
                <div className="mb-8 border-b border-line pb-4">
                    <Link href="/tools" className="text-accent hover:text-accent-hover text-sm mb-4 inline-block transition-colors">&larr; 返回工具箱</Link>
                    <h1 className="text-3xl font-bold text-fg">异常档案悬赏令</h1>
                    <p className="text-fg-3 mt-2 text-sm font-mono">全局寻宝追踪协议。提交符合参数特征的文档标识符以提取高额赏金。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-end border-b border-line pb-2 mb-4">
                            <h2 className="text-fg-3 text-xs font-mono uppercase tracking-widest">Active Bounties</h2>
                            <button onClick={handleRefreshPool} className="text-[10px] font-mono text-fg-3 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                                [ADMIN_FORCE_REFRESH]
                            </button>
                        </div>

                        {bounties.length === 0 && <div className="text-fg-3 font-mono text-sm py-8 text-center border border-line border-dashed rounded">[NO ACTIVE BOUNTIES]</div>}

                        {bounties.map((bounty, index) => (
                            <div key={bounty.id} className={`p-5 rounded-xl border-2 transition-all ${bounty.status === 'active' ? 'bg-panel border-orange-900/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-sunken border-line opacity-60'}`}>
                                <div className="flex justify-between items-start mb-4 border-b border-line pb-3">
                                    <div>
                                        <div className="text-[10px] text-fg-3 font-mono mb-1">Target Protocol #{index + 1}</div>
                                        <div className="flex items-center gap-2">
                                            {bounty.tags.map(t => <span key={t} className="bg-sunken border border-line text-fg-2 px-2 py-0.5 rounded text-xs font-bold font-mono">[{t}]</span>)}
                                            <span className="bg-sunken border border-line text-fg-2 px-2 py-0.5 rounded text-xs font-bold font-mono">评分 &ge; {bounty.minRating}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-fg-3 font-mono mb-1 uppercase">Bounty Reward</div>
                                        <div className="text-orange-600 dark:text-orange-400 font-bold font-mono text-lg">¥ {bounty.reward}</div>
                                    </div>
                                </div>

                                {bounty.status === 'active' ? (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input 
                                            type="text" placeholder="输入 wiki (如: ubmh)" 
                                            value={inputs[bounty.id]?.wiki || ''} onChange={e => handleInputChange(bounty.id, 'wiki', e.target.value)}
                                            className="flex-1 bg-sunken text-fg-2 font-mono p-2.5 border border-line rounded focus:outline-none focus:border-orange-500 text-sm" 
                                        />
                                        <input 
                                            type="text" placeholder="输入 page (如: scp-001)" 
                                            value={inputs[bounty.id]?.page || ''} onChange={e => handleInputChange(bounty.id, 'page', e.target.value)}
                                            className="flex-1 bg-sunken text-fg-2 font-mono p-2.5 border border-line rounded focus:outline-none focus:border-orange-500 text-sm" 
                                        />
                                        <button 
                                            onClick={() => handleClaim(bounty.id)} disabled={isProcessing}
                                            className="sm:w-32 bg-orange-900/40 hover:bg-orange-800/60 border border-orange-700 disabled:border-line disabled:bg-sunken text-orange-600 dark:text-orange-400 disabled:text-fg-3 font-bold font-mono text-xs rounded transition-colors"
                                        >
                                            提交验证
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-fg-3 font-mono text-xs flex justify-between bg-sunken p-2 rounded">
                                        <span>已由特工 <span className="text-fg-2 font-bold">{bounty.claimer}</span> 侦测完毕</span>
                                        <span className="truncate max-w-[200px] text-right" title={bounty.claimedPage}>标的: {bounty.claimedPage}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-panel border border-line rounded-xl p-5 shadow-lg sticky top-8">
                            <div className="text-center mb-6 border-b border-line pb-4">
                                <div className="text-fg-3 text-[10px] mb-1 font-mono uppercase tracking-widest">Verified Balance</div>
                                <div className="text-2xl font-mono text-green-600 dark:text-green-400 font-bold">¥ {balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                            </div>
                            
                            <div className="text-xs text-fg-3 font-mono space-y-2">
                                <p>&gt; 在输入框中粘贴目标页面的 wiki 标识和 page 路由，提交后底层接口会自动验证该页面的标签和评分参数。</p>
                                <p>&gt; 第一个提交正确资料的特工将直接拿走全额赏金。</p>
                            </div>

                            <ScratchMask isReady={!!result} label="SCRATCH TO REVEAL BOUNTY">
                                {result && (
                                    <div className="text-xs font-mono w-full text-fg-3">
                                        <div className="mb-2 border-b border-line pb-1 text-fg-3 uppercase tracking-widest">Data Verification:</div>
                                        <div className="text-orange-600 dark:text-orange-400 truncate mb-1 font-bold">{result.article.title}</div>
                                        <div className="flex justify-between mb-1">
                                            <span>Rating: <span className="text-fg font-bold">{result.article.rating}</span></span>
                                            <span>Author: {result.article.author}</span>
                                        </div>
                                        <div className="mb-3">
                                            Tags: <span className="text-fg-2">{result.article.tags?.join(', ') || 'None'}</span>
                                        </div>
                                        <div className="border-t border-line pt-2 flex justify-between items-center">
                                            <span>Status: <span className="text-fg">MATCHED</span></span>
                                            <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                                                REWARD +¥{result.reward}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </ScratchMask>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
