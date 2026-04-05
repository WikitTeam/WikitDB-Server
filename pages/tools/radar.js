// pages/tools/radar.js
import React, { useState } from 'react';
import Head from 'next/head';
import { 
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
    ResponsiveContainer, Tooltip 
} from 'recharts';

// 自定义图表悬浮提示框的样式，使其融入暗色主题
const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl">
                <p className="text-gray-300 font-bold mb-1">{payload[0].payload.subject}</p>
                <p className="text-blue-400 font-mono">
                    评估指数: {payload[0].value.toFixed(1)} / 100
                </p>
            </div>
        );
    }
    return null;
};

export default function AuthorRadar() {
    const [authorName, setAuthorName] = useState('Laimu_slime');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // 初始化数据结构，适配 recharts 的数据格式
    const [radarData, setRadarData] = useState([
        { subject: '爆肝度', value: 0, fullMark: 100 },
        { subject: '均分评价', value: 0, fullMark: 100 },
        { subject: '巅峰实力', value: 0, fullMark: 100 },
        { subject: '跨域探索', value: 0, fullMark: 100 },
        { subject: '话题热度', value: 0, fullMark: 100 },
        { subject: '综合胜率', value: 0, fullMark: 100 }
    ]);
    const [report, setReport] = useState(null);

    // 发起网络请求去远端数据库捞取这个作者的所有页面
    const fetchAuthorData = async () => {
        if (!authorName.trim()) return;
        
        setIsLoading(true);
        setError('');
        setReport(null);

        try {
            const graphqlQuery = {
                query: `
                    query($author: String!) {
                        articles(author: $author, page: 1, pageSize: 500) {
                            nodes {
                                wiki
                                rating
                                comments
                            }
                        }
                    }
                `,
                variables: { author: authorName }
            };

            const res = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(graphqlQuery)
            });

            const result = await res.json();
            
            if (result.errors) {
                setError('无法从数据库获取该作者的信息');
                setIsLoading(false);
                return;
            }

            const articles = result.data?.articles?.nodes || [];
            
            if (articles.length === 0) {
                setError('数据库中未收录该作者的页面档案');
                setRadarData(radarData.map(item => ({ ...item, value: 0 })));
                setIsLoading(false);
                return;
            }

            const totalArticles = articles.length;
            const uniqueWikis = new Set();
            let totalRating = 0;
            let maxRating = -999;
            let totalComments = 0;
            let positiveCount = 0;

            // 把所有页面的各项原始数据先累加起来
            articles.forEach(article => {
                const rating = article.rating || 0;
                if (article.wiki) uniqueWikis.add(article.wiki);
                totalRating += rating;
                if (rating > maxRating) maxRating = rating;
                if (article.comments) totalComments += article.comments;
                if (rating > 0) positiveCount++;
            });

            // 把原始数据换算成满分一百的雷达图战力值
            const scoreCount = Math.min(100, (totalArticles / 50) * 100); 
            const avgRating = totalArticles > 0 ? (totalRating / totalArticles) : 0;
            const scoreAvg = Math.max(0, Math.min(100, (avgRating / 30) * 100)); 
            const scorePeak = Math.max(0, Math.min(100, (maxRating / 150) * 100)); 
            const scoreCross = Math.min(100, (uniqueWikis.size / 5) * 100); 
            const scoreHot = Math.min(100, (totalComments / 200) * 100); 
            const scoreWinRate = totalArticles > 0 ? (positiveCount / totalArticles) * 100 : 0; 

            // 将计算结果更新到图表绑定的状态中
            setRadarData([
                { subject: '爆肝度', value: parseFloat(scoreCount.toFixed(1)), fullMark: 100 },
                { subject: '均分评价', value: parseFloat(scoreAvg.toFixed(1)), fullMark: 100 },
                { subject: '巅峰实力', value: parseFloat(scorePeak.toFixed(1)), fullMark: 100 },
                { subject: '跨域探索', value: parseFloat(scoreCross.toFixed(1)), fullMark: 100 },
                { subject: '话题热度', value: parseFloat(scoreHot.toFixed(1)), fullMark: 100 },
                { subject: '综合胜率', value: parseFloat(scoreWinRate.toFixed(1)), fullMark: 100 }
            ]);
            
            generateReport(totalArticles, uniqueWikis.size, maxRating, scoreWinRate);

        } catch (err) {
            setError('网络请求异常');
        } finally {
            setIsLoading(false);
        }
    };

    // 根据作者的各项数值情况，拼凑出对应的评估报告文本
    const generateReport = (count, wikiCount, maxRating, winRate) => {
        let title = "Safe (安全级)";
        let desc = "该实体在维基系统中的活动相对平稳，未表现出强烈的异常扩张倾向。";

        if (count > 30 && winRate > 80) {
            title = "Keter (极度危险)";
            desc = "警告：该作者具有极高的创作产能与优异的存活率，其模因污染正在多个站点迅速扩散，建议密切监控。";
        } else if (maxRating > 100) {
            title = "Euclid (收容难测)";
            desc = "该实体偶尔会释放出具有极强影响力的爆款文档，其实力上限深不可测。";
        } else if (wikiCount >= 3) {
            title = "Wanderer (跨站流浪者)";
            desc = "该作者的踪迹遍布多个维基宇宙，难以将其锁定在单一区域，具备极强的环境适应力。";
        } else if (winRate < 30 && count > 5) {
            title = "Neutralized (屡战屡败)";
            desc = "该实体的异常档案大部分已被各站管理抹杀，但其仍未放弃突破收容的尝试。";
        }

        setReport({ title, desc, count, wikiCount, maxRating });
    };

    return (
        <>
            <Head>
                <title>创作者战力雷达 - WikitDB</title>
            </Head>

            <div className="flex flex-col gap-6">
                <div className="border-b border-gray-800 pb-4">
                    <h1 className="text-3xl font-bold text-white tracking-tight">创作者战力雷达评估</h1>
                    <p className="mt-2 text-gray-400 text-sm">跨站聚合创作者历史记录，全方位推算其“危险等级”。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 左侧控制台与评估报告区域 */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-gray-800/40 rounded-xl border border-gray-700 p-6 shadow-lg">
                            <label className="block text-sm font-medium text-gray-400 mb-2">追踪作者档案</label>
                            <div className="flex gap-3">
                                <input 
                                    type="text" 
                                    value={authorName}
                                    onChange={(e) => setAuthorName(e.target.value)}
                                    placeholder="输入作者名称..."
                                    onKeyDown={(e) => e.key === 'Enter' && fetchAuthorData()}
                                    className="flex-1 w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                                />
                                <button 
                                    onClick={fetchAuthorData}
                                    disabled={isLoading}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:bg-gray-600 whitespace-nowrap"
                                >
                                    {isLoading ? '扫描中' : '执行扫描'}
                                </button>
                            </div>
                            {error && <div className="mt-3 text-sm text-red-400 font-medium">{error}</div>}
                        </div>

                        {report && (
                            <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-6 flex-1 border-t-4 border-t-red-900 shadow-2xl relative overflow-hidden">
                                {/* 添加一个隐约的红色发光背景修饰 */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-900/10 rounded-full blur-3xl pointer-events-none"></div>
                                
                                <h3 className="text-red-400 text-xs font-bold tracking-widest mb-2 uppercase relative z-10">Danger Level Evaluation</h3>
                                <div className="text-2xl font-bold text-white mb-4 relative z-10">{report.title}</div>
                                <div className="text-gray-300 text-sm leading-relaxed mb-6 bg-gray-900/80 p-4 rounded-lg border border-gray-700/50 shadow-inner relative z-10">
                                    {report.desc}
                                </div>
                                <div className="space-y-3 text-sm relative z-10">
                                    <div className="flex justify-between border-b border-gray-700/50 pb-2">
                                        <span className="text-gray-500">已确认档案数</span>
                                        <span className="text-blue-400 font-mono font-bold">{report.count} 份</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-700/50 pb-2">
                                        <span className="text-gray-500">最高突破评分</span>
                                        <span className="text-green-400 font-mono font-bold">{report.maxRating > -999 ? `+${report.maxRating}` : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between pb-1">
                                        <span className="text-gray-500">活动范围</span>
                                        <span className="text-purple-400 font-mono font-bold">{report.wikiCount} 个平行站点</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 右侧动态雷达图渲染区域 */}
                    <div className="lg:col-span-2 bg-gray-800/40 rounded-xl border border-gray-700 p-6 flex flex-col items-center justify-center min-h-[450px] shadow-lg relative overflow-hidden">
                        {/* 蓝色氛围光背景 */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                            <div className="w-96 h-96 bg-blue-600 rounded-full blur-[100px]"></div>
                        </div>

                        {!report && !isLoading ? (
                            <div className="text-gray-500 flex flex-col items-center gap-3 relative z-10">
                                <span>请输入作者名称以启动雷达扫描网络</span>
                            </div>
                        ) : isLoading ? (
                            <div className="text-blue-500 animate-pulse font-mono tracking-wider relative z-10">正在从全球数据库拉取交叉对比数据...</div>
                        ) : (
                            <div className="w-full h-full min-h-[400px] relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                        {/* 绘制背景蛛网，调整颜色以适配暗色模式 */}
                                        <PolarGrid stroke="#4b5563" />
                                        
                                        {/* 六个维度的文本标签 */}
                                        <PolarAngleAxis 
                                            dataKey="subject" 
                                            tick={{ fill: '#d1d5db', fontSize: 13, fontWeight: 'bold' }} 
                                        />
                                        
                                        {/* 隐藏具体的刻度轴线条，保持图表清爽 */}
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        
                                        {/* 核心数据多边形，带有半透明蓝色填充和加粗边框 */}
                                        <Radar
                                            name="战力指数"
                                            dataKey="value"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            fill="#3b82f6"
                                            fillOpacity={0.5}
                                        />
                                        
                                        <Tooltip content={<CustomTooltip />} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
