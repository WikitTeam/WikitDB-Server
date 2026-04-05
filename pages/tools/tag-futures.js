// pages/tools/tag-futures.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const TAGS = ['原创', '翻译', '搞笑', '微恐', '设定中心', '人事档案'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl">
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className="text-yellow-400 font-mono font-bold">
                    报价: ¥{payload[0].value.toFixed(2)}
                </p>
            </div>
        );
    }
    return null;
};

export default function TagFutures() {
    const [selectedTag, setSelectedTag] = useState(TAGS[0]);
    const [chartData, setChartData] = useState([]);
    
    const [username, setUsername] = useState(null);
    const [userBalance, setUserBalance] = useState(0);

    const [direction, setDirection] = useState('long');
    const [margin, setMargin] = useState(100);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
            fetch('/api/trade/author', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: storedUsername, authorName: 'System', action: 'query' })
            })
            .then(res => res.json())
            .then(data => {
                if(data.newBalance !== undefined) setUserBalance(data.newBalance);
            })
            .catch(console.error);
        }
    }, []);

    useEffect(() => {
        let basePrice = 50 + (TAGS.indexOf(selectedTag) * 15);
        const data = [];
        const now = new Date();
        
        for (let i = 30; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const change = (Math.random() - 0.45) * 8; 
            basePrice = Math.max(5, basePrice + change);
            
            data.push({
                time: dateStr,
                price: parseFloat(basePrice.toFixed(2))
            });
        }
        setChartData(data);
        setMessage('');
    }, [selectedTag]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username) {
            setMessage('请先登录后再进行交易！');
            return;
        }

        setIsSubmitting(true);
        setMessage('');

        try {
            const res = await fetch('/api/trade/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    site: 'tag-futures',
                    pageId: 'tag',
                    pageTitle: `[期货] 标签-${selectedTag}`,
                    direction,
                    lockType: 'none',
                    margin: Number(margin),
                    leverage: 1
                })
            });

            const data = await res.json();
            
            if (!res.ok) {
                setMessage(data.error || '下单失败');
            } else {
                setUserBalance(data.newBalance);
                setMessage(`下单成功！流水号: ${data.tradeId}`);
            }
        } catch (error) {
            setMessage('网络错误，请检查接口');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Head>
                <title>标签大宗商品期货 - WikitDB</title>
            </Head>

            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">标签/设定大宗商品期货</h1>
                        <p className="mt-2 text-gray-400 text-sm">将维基常见标签作为大宗商品，押注某种创作风格在未来的热度走向。</p>
                    </div>
                    <div className="text-right hidden md:block">
                        {username ? (
                            <>
                                <div className="text-gray-400 text-sm">操作账户: <span className="text-gray-200">{username}</span></div>
                                <div className="text-2xl font-mono text-yellow-500">¥{userBalance.toFixed(2)}</div>
                            </>
                        ) : (
                            <div className="text-red-400 font-bold border border-red-900/50 bg-red-900/20 px-4 py-2 rounded-lg">
                                未登录，请先在顶栏登录
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 flex flex-col gap-4">
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {TAGS.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag)}
                                    className={`px-6 py-2 rounded-lg font-bold transition-colors whitespace-nowrap ${
                                        selectedTag === tag 
                                        ? 'bg-yellow-600 text-white' 
                                        : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>

                        <div className="bg-gray-800/40 rounded-xl border border-gray-700 p-6 h-[450px] shadow-lg">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                    <XAxis dataKey="time" stroke="#9ca3af" tick={{fontSize: 12}} tickMargin={10} />
                                    <YAxis stroke="#9ca3af" domain={['auto', 'auto']} tick={{fontSize: 12}} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line 
                                        type="monotone" 
                                        dataKey="price" 
                                        stroke="#eab308" 
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6, fill: "#eab308", stroke: "#1f2937", strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="lg:col-span-1 bg-gray-800/40 rounded-xl border border-gray-700 p-6 flex flex-col h-full shadow-lg">
                        <h2 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-2">建仓面板</h2>
                        
                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 mb-6">
                            <div className="text-sm text-gray-400 mb-1">当前合约报价</div>
                            <div className="text-3xl font-mono font-bold text-yellow-500">
                                ¥{chartData.length > 0 ? chartData[chartData.length - 1].price.toFixed(2) : '0.00'}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">行情预测</label>
                                <select 
                                    value={direction}
                                    onChange={(e) => setDirection(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500"
                                >
                                    <option value="long">买入看涨</option>
                                    <option value="short">买入看跌</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">投入本金</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={margin}
                                    onChange={(e) => setMargin(e.target.value)}
                                    disabled={!username}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-yellow-500 disabled:bg-gray-800 disabled:text-gray-500"
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={isSubmitting || !username}
                                className={`w-full py-3 rounded-lg font-bold text-white mt-auto transition-colors shadow-lg ${
                                    !username ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                                    isSubmitting ? 'bg-gray-600 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500'
                                }`}
                            >
                                {!username ? '未登录' : isSubmitting ? '正在处理...' : '确认开出合约'}
                            </button>
                        </form>

                        {message && (
                            <div className={`mt-4 p-3 text-sm rounded-lg border ${
                                message.includes('成功') ? 'bg-green-900/30 text-green-400 border-green-800/50' : 'bg-red-900/30 text-red-400 border-red-800/50'
                            }`}>
                                {message}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
