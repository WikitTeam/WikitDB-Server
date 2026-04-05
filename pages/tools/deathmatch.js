import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const ScratchMask = ({ children, isReady }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!isReady) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < 3000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#3d3d3d' : '#5a5a5a';
            ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
        }
        
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SCRATCH TO VERIFY', canvas.width / 2, canvas.height / 2);
    }, [isReady, children]);

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
    };

    if (!isReady) return <div className="p-6 bg-[#0a0a0a] text-gray-600 text-center font-mono border border-gray-800 rounded">Waiting for data injection...</div>;

    return (
        <div className="relative w-full rounded overflow-hidden border border-gray-700 shadow-inner min-h-[160px]">
            <div className="absolute inset-0 bg-[#050505] p-4 flex flex-col justify-center z-0">
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

export default function Deathmatch() {
    const [username, setUsername] = useState(null);
    const [balance, setBalance] = useState(0);
    const [betAmount, setBetAmount] = useState(100);
    const [betSide, setBetSide] = useState('left');
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
    }, []);

    const executeBet = async () => {
        if (!username) return alert('请先登录系统');
        if (betAmount <= 0) return alert('请输入有效金额');
        
        setIsProcessing(true);
        setResult(null);

        try {
            const res = await fetch('/api/tools/deathmatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, betAmount, betSide })
            });
            const data = await res.json();
            if (res.ok) {
                setResult(data);
                setBalance(data.newBalance);
            } else alert(data.error);
        } catch (e) {
            alert('网络错误');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="py-8 font-sans select-none">
            <Head><title>异常对赌盘 - WikitDB</title></Head>
            <div className="max-w-5xl mx-auto px-4">
                <div className="mb-8 border-b border-gray-800 pb-4">
                    <Link href="/tools" className="text-blue-500 hover:text-blue-400 text-sm mb-4 inline-block transition-colors">&larr; 返回</Link>
                    <h1 className="text-3xl font-bold text-white">极端异常对赌盘</h1>
                </div>

                <div className="max-w-md mx-auto bg-[#121212] border-2 border-blue-900/50 rounded-xl p-5 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <div className="text-center mb-6">
                        <div className="text-gray-500 text-[10px] mb-1 font-mono uppercase tracking-widest">Verified Balance</div>
                        <div className="text-xl font-mono text-green-400 font-bold">¥ {balance.toFixed(2)}</div>
                    </div>

                    <div className="bg-[#0a0a0a] p-4 rounded-lg border border-gray-800 mb-6">
                        <label className="block text-xs text-gray-400 font-mono mb-2">投注金额 (Bet Amount)</label>
                        <input 
                            type="number" 
                            value={betAmount} 
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="w-full bg-gray-900 text-white font-mono p-2 border border-gray-700 rounded focus:outline-none focus:border-blue-500 mb-4" 
                        />
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setBetSide('left')}
                                className={`py-2 rounded text-xs font-bold font-mono transition-colors border ${betSide === 'left' ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'bg-gray-900 border-gray-700 text-gray-500'}`}
                            >
                                猜左页分数高
                            </button>
                            <button 
                                onClick={() => setBetSide('right')}
                                className={`py-2 rounded text-xs font-bold font-mono transition-colors border ${betSide === 'right' ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'bg-gray-900 border-gray-700 text-gray-500'}`}
                            >
                                猜右页分数高
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={executeBet} disabled={isProcessing}
                        className="w-full py-4 bg-[#1a2b4c] hover:bg-[#253e6e] disabled:bg-gray-900 border border-blue-800 disabled:border-gray-800 rounded-lg text-white font-bold text-sm tracking-widest mb-6 uppercase"
                    >
                        {isProcessing ? '[Executing Protocol...]' : '写入合约并开盘'}
                    </button>

                    <ScratchMask isReady={!!result}>
                        {result && (
                            <div className="text-xs font-mono w-full">
                                <div className="text-gray-400 mb-2 border-b border-gray-800 pb-1">Result Verification Data:</div>
                                
                                <div className="mb-2">
                                    <div className="text-blue-300 truncate">[Left] {result.leftPage.title}</div>
                                    <div className="text-gray-500">Rating: <span className="text-white font-bold">{result.leftPage.rating}</span></div>
                                </div>
                                
                                <div className="mb-4">
                                    <div className="text-orange-300 truncate">[Right] {result.rightPage.title}</div>
                                    <div className="text-gray-500">Rating: <span className="text-white font-bold">{result.rightPage.rating}</span></div>
                                </div>
                                
                                <div className="border-t border-gray-800 pt-2 flex justify-between items-center">
                                    <span className="text-gray-400">Your Bet: {betSide === 'left' ? 'LEFT' : 'RIGHT'}</span>
                                    <span className={`font-bold ${result.reward > 0 ? 'text-green-400' : 'text-red-500'}`}>
                                        {result.reward > 0 ? `WIN +¥${result.reward}` : 'FAILED'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </ScratchMask>
                </div>
            </div>
        </div>
    );
}
