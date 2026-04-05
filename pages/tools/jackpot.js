import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const ScratchMask = ({ children, isReady, label = 'SCRATCH TO VERIFY' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!isReady) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < 2000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#2d2d2d' : '#4a4a4a';
            ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
        }
        
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#777';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    }, [isReady, children, label]);

    const scratch = (e) => {
        if (e.buttons !== 1 && e.type !== 'touchmove') return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        let cx = e.clientX, cy = e.clientY;
        if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx - rect.left, cy - rect.top, 25, 0, Math.PI * 2);
        ctx.fill();
    };

    if (!isReady) return <div className="p-4 bg-[#0a0a0a] text-gray-600 text-center font-mono text-xs border border-gray-800 rounded">[Awaiting System Draw]</div>;

    return (
        <div className="relative w-full rounded overflow-hidden border border-gray-700 shadow-inner min-h-[80px]">
            <div className="absolute inset-0 bg-[#050505] p-3 flex flex-col justify-center z-0">{children}</div>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 cursor-crosshair touch-none" onMouseMove={scratch} onMouseDown={(e) => { if (e.buttons === 1) scratch(e); }} onTouchMove={scratch} />
        </div>
    );
};

export default function Jackpot() {
    const [username, setUsername] = useState(null);
    const [pool, setPool] = useState(0);
    const [myNumber, setMyNumber] = useState('');
    const [drawResult, setDrawResult] = useState(null);

    useEffect(() => {
        const stored = localStorage.getItem('username');
        if (stored) setUsername(stored);
        fetchData();
    }, []);

    const fetchData = async () => {
        const res = await fetch('/api/tools/jackpot');
        const data = await res.json();
        setPool(data.pool);
    };

    const handleBuy = async () => {
        if (!username) return alert('请先登录');
        if (!/^\d{2}$/.test(myNumber)) return alert('请输入 00-99 两位数');
        const res = await fetch('/api/tools/jackpot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'buy', username, number: myNumber })
        });
        if (res.ok) { alert('购买写入成功'); fetchData(); }
        else alert((await res.json()).error);
    };

    const handleDraw = async () => {
        if (!confirm('强制执行全站结算？')) return;
        const res = await fetch('/api/tools/jackpot', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'draw' })
        });
        if (res.ok) {
            setDrawResult(await res.json());
            fetchData();
        }
    };

    return (
        <div className="py-8 font-sans select-none">
            <Head><title>彩票池 - WikitDB</title></Head>
            <div className="max-w-5xl mx-auto px-4">
                <div className="mb-8 border-b border-gray-800 pb-4">
                    <Link href="/tools" className="text-blue-500 hover:text-blue-400 text-sm mb-4 inline-block">&larr; 返回</Link>
                    <h1 className="text-3xl font-bold text-white">全站公共彩票池</h1>
                </div>

                <div className="max-w-md mx-auto bg-[#121212] border-2 border-yellow-900/50 rounded-xl p-5 shadow-[0_0_15px_rgba(234,179,8,0.15)]">
                    <div className="text-center mb-6 border-b border-gray-800 pb-4">
                        <div className="text-gray-500 text-xs mb-1 font-mono">VERIFIED JACKPOT POOL</div>
                        <div className="text-3xl font-mono text-yellow-400 font-bold">¥ {pool.toLocaleString()}</div>
                    </div>

                    <div className="bg-[#0a0a0a] p-4 rounded-lg border border-gray-800 mb-6 flex flex-col gap-3">
                        <input 
                            type="text" maxLength="2" placeholder="输入两码 00-99" value={myNumber} onChange={e => setMyNumber(e.target.value)}
                            className="bg-gray-900 text-white font-mono p-3 border border-gray-700 rounded text-center text-xl focus:border-yellow-500 outline-none"
                        />
                        <button onClick={handleBuy} className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 font-bold py-3 rounded hover:bg-yellow-800/50 transition-colors">
                            写入彩票凭证 (¥50)
                        </button>
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                        <button onClick={handleDraw} className="w-full text-xs text-gray-500 hover:text-gray-300 font-mono py-2 border border-gray-800 rounded mb-4">
                            [ADMIN] Execute Draw Sequence
                        </button>

                        <ScratchMask isReady={!!drawResult} label="SCRATCH TO REVEAL WINNER">
                            {drawResult && (
                                <div className="text-center font-mono w-full">
                                    <div className="text-gray-400 text-xs mb-1">Winning Number:</div>
                                    <div className="text-3xl font-bold text-yellow-400 mb-2 tracking-widest">{drawResult.winningNumber}</div>
                                    <div className="text-[10px] text-gray-500 border-t border-gray-800 pt-1">
                                        Winners: {drawResult.winners.length > 0 ? <span className="text-white">{drawResult.winners.join(', ')}</span> : 'None'}
                                    </div>
                                </div>
                            )}
                        </ScratchMask>
                    </div>
                </div>
            </div>
        </div>
    );
}
