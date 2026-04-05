// pages/tools/splice.js
import React, { useState } from 'react';
import Head from 'next/head';
const config = require('../../wikitdb.config.js');

export default function Splice() {
    const [snippets, setSnippets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [storyTitle, setStoryTitle] = useState('');
    const [isGenerated, setIsGenerated] = useState(false);

    // 去各个站点里随机挖几段话出来
    const generateSnippets = async () => {
        setIsLoading(true);
        setSnippets([]);
        setIsGenerated(false);
        setStoryTitle('');
        
        try {
            const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];
            if (wikis.length === 0) throw new Error('没有配置支持的站点');

            const fetchSingleSnippet = async () => {
                const randomWiki = wikis[Math.floor(Math.random() * wikis.length)];
                let actualWikiName = '';
                try {
                    actualWikiName = new URL(randomWiki.URL).hostname.replace(/^www\./i, '').split('.')[0];
                } catch (e) {
                    actualWikiName = randomWiki.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
                }

                const query = {
                    query: `
                        query {
                            articles(wiki: "${actualWikiName}", page: 1, pageSize: 30) {
                                nodes {
                                    wiki
                                    page
                                    title
                                }
                            }
                        }
                    `
                };
                
                const res = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(query)
                });
                const result = await res.json();
                const nodes = result.data?.articles?.nodes || [];
                if (nodes.length === 0) return null;

                const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
                
                const sourceRes = await fetch(`/api/source?site=${randomWiki.PARAM}&page=${encodeURIComponent(randomNode.page)}`);
                const sourceData = await sourceRes.json();
                
                if (!sourceRes.ok || !sourceData.sourceCode) return null;

                // 粗略清理一下 Wikidot 语法，只提取长句子
                const cleanText = sourceData.sourceCode
                    .replace(/\[\[.*?\]\]/g, '')
                    .replace(/[*#=_><~]/g, '')
                    .trim();
                
                const sentences = cleanText.split(/[\n。！？]/).filter(s => s.length > 15 && s.length < 80);
                if (sentences.length === 0) return null;
                
                const randomSentence = sentences[Math.floor(Math.random() * sentences.length)];
                return { text: randomSentence, source: randomNode.title, wiki: randomWiki.NAME || actualWikiName };
            };

            // 并发请求三段文本，加快速度
            const results = await Promise.all([fetchSingleSnippet(), fetchSingleSnippet(), fetchSingleSnippet()]);
            const validResults = results.filter(r => r !== null);
            
            setSnippets(validResults);
            if (validResults.length > 0) setIsGenerated(true);

        } catch (err) {
            console.error(err);
            alert('抓取文本切片失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>跨界缝合怪 - WikitDB</title>
            </Head>

            <div className="flex flex-col gap-6">
                <div className="border-b border-gray-800 pb-4">
                    <h1 className="text-3xl font-bold text-white tracking-tight">碎片拼接：跨界缝合怪</h1>
                    <p className="mt-2 text-gray-400 text-sm">打破世界观的壁垒。系统将随机抽取互不相干的文档切片，由你为它们拼凑出全新的荒诞故事。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
                    {/* 左侧控制台 */}
                    <div className="lg:col-span-1 bg-gray-800/40 rounded-xl border border-gray-700 p-6 flex flex-col gap-6 shadow-lg">
                        <div>
                            <div className="text-xl font-bold text-white mb-2">启动碎纸机</div>
                            <p className="text-sm text-gray-400 mb-6">点击按钮，从全网节点的文档库中抓取随机文字碎片。</p>
                            <button 
                                onClick={generateSnippets}
                                disabled={isLoading}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors shadow-lg disabled:bg-gray-600"
                            >
                                {isLoading ? (
                                    <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>正在截取碎片...</>
                                ) : (
                                    <><i className="fa-solid fa-shuffle mr-2"></i>抽取全新碎片</>
                                )}
                            </button>
                        </div>
                        
                        {isGenerated && (
                            <div className="pt-6 border-t border-gray-700">
                                <label className="block text-sm font-medium text-gray-400 mb-2">给这篇神作起个标题</label>
                                <input 
                                    type="text" 
                                    value={storyTitle}
                                    onChange={(e) => setStoryTitle(e.target.value)}
                                    placeholder="例如：关于我转生到收容所这件事"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>
                        )}
                    </div>

                    {/* 右侧展示板 */}
                    <div className="lg:col-span-2 bg-gray-800/40 rounded-xl border border-gray-700 p-8 shadow-lg min-h-[400px] flex flex-col relative overflow-hidden">
                        {!isGenerated && !isLoading && (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                                <i className="fa-solid fa-puzzle-piece text-5xl mb-4 text-gray-600"></i>
                                <p>等待接入碎片数据...</p>
                            </div>
                        )}

                        {isLoading && (
                            <div className="flex-1 flex flex-col items-center justify-center text-purple-400 animate-pulse">
                                <i className="fa-solid fa-microchip text-5xl mb-4"></i>
                                <p className="font-mono tracking-widest">正在进行跨维度文本剥离</p>
                            </div>
                        )}

                        {isGenerated && !isLoading && (
                            <div className="relative z-10 flex flex-col h-full">
                                <h2 className="text-3xl font-bold text-white text-center mb-8 pb-4 border-b border-gray-700/50">
                                    {storyTitle || "未命名的荒诞记录"}
                                </h2>
                                
                                <div className="space-y-6 flex-1">
                                    {snippets.map((item, index) => (
                                        <div key={index} className="group relative bg-gray-900/50 p-6 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-colors">
                                            <div className="absolute -left-3 -top-3 w-8 h-8 bg-purple-900/80 border border-purple-500 text-purple-300 rounded-full flex items-center justify-center font-mono font-bold text-sm shadow-lg">
                                                {index + 1}
                                            </div>
                                            <p className="text-gray-200 leading-relaxed text-lg pl-2">
                                                "{item.text}"
                                            </p>
                                            <div className="mt-4 text-xs text-gray-500 text-right font-mono">
                                                摘自：{item.source} <span className="mx-2">|</span> {item.wiki}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
