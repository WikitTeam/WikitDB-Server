// pages/tools/escape.js
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
const config = require('../../wikitdb.config.js');

export default function CodeEscape() {
    const [gameState, setGameState] = useState('idle');
    const [originalCode, setOriginalCode] = useState('');
    const [userCode, setUserCode] = useState('');
    const [targetPage, setTargetPage] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [score, setScore] = useState(0);

    const timerRef = useRef(null);

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            timerRef.current = setTimeout(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (gameState === 'playing' && timeLeft <= 0) {
            setGameState('fail');
        }

        return () => clearTimeout(timerRef.current);
    }, [timeLeft, gameState]);

    const startRandomEscape = async () => {
        setGameState('loading');
        try {
            // 1. 从你的配置文件里随机挑一个支持的站点，避免跨域和未配置报错
            const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];
            if (wikis.length === 0) throw new Error('没有配置支持的站点');
            
            const randomWikiConfig = wikis[Math.floor(Math.random() * wikis.length)];
            let actualWikiName = '';
            try {
                actualWikiName = new URL(randomWikiConfig.URL).hostname.replace(/^www\./i, '').split('.')[0];
            } catch (e) {
                actualWikiName = randomWikiConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
            }

            // 2. 只在这个站点里随机抽 50 个最新页面
            const query = {
                query: `
                    query {
                        articles(wiki: "${actualWikiName}", page: 1, pageSize: 50) {
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

            if (nodes.length === 0) throw new Error('该站点没有获取到页面');

            const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
            setTargetPage(randomNode);

            // 3. 关键修复：使用 config 里的 PARAM 去请求你的 api/source
            const sourceRes = await fetch(`/api/source?site=${randomWikiConfig.PARAM}&page=${encodeURIComponent(randomNode.page)}`);
            const sourceData = await sourceRes.json();

            if (!sourceRes.ok || !sourceData.sourceCode) {
                throw new Error('源码拉取失败');
            }

            const fullCode = sourceData.sourceCode;
            
            // 4. 截取片段并制造破坏
            let startIndex = fullCode.indexOf('[[');
            if (startIndex === -1) startIndex = 0;
            // 防止代码太短截取越界
            if (startIndex + 400 > fullCode.length) {
                startIndex = Math.max(0, fullCode.length - 400);
            }
            const snippet = fullCode.substring(startIndex, startIndex + 400);

            let damaged = snippet;
            let errorCount = 0;
            
            if (damaged.includes('[[div')) { damaged = damaged.replace('[[div', '[div'); errorCount++; }
            if (damaged.includes('[[/div]]')) { damaged = damaged.replace('[[/div]]', '[/div]'); errorCount++; }
            if (damaged.includes('**')) { damaged = damaged.replace('**', '*'); errorCount++; }
            if (damaged.includes('[[module')) { damaged = damaged.replace('[[module', '[modul'); errorCount++; }
            
            // 兜底：如果上面的标签都没匹配到，强行弄坏一个右括号
            if (errorCount === 0 && damaged.includes(']]')) {
                damaged = damaged.replace(']]', ']');
            }

            setOriginalCode(snippet);
            setUserCode(damaged);
            setTimeLeft(60);
            setGameState('playing');

        } catch (err) {
            console.error(err);
            alert('随机抽取异常代码失败，请重试');
            setGameState('idle');
        }
    };

    const handleVerify = () => {
        if (gameState !== 'playing') return;

        if (userCode.trim() === originalCode.trim()) {
            setGameState('success');
            setScore(prev => prev + 100 + timeLeft * 2);
        } else {
            // 错误提交直接扣 10 秒
            setTimeLeft(prev => Math.max(0, prev - 10));
        }
    };

    const handleAbort = () => {
        setGameState('idle');
        clearTimeout(timerRef.current);
    };

    return (
        <>
            <Head>
                <title>异常突破：代码修复逃脱 - WikitDB</title>
            </Head>

            <div className="flex flex-col gap-6">
                <div className="border-b border-gray-800 pb-4">
                    <h1 className="text-3xl font-bold text-red-500 tracking-tight">
                        <i className="fa-solid fa-triangle-exclamation mr-3"></i>
                        异常突破：代码修复逃脱
                    </h1>
                    <p className="mt-2 text-gray-400 text-sm">
                        收容失效警告。系统将随机抽取真实的异常文档代码并注入破坏，你必须在倒计时结束前修复 Wikidot 语法才能重启隔离门。
                    </p>
                </div>

                {gameState === 'idle' && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-8 text-center mt-4 max-w-2xl mx-auto w-full">
                        <div className="text-red-500 text-6xl mb-6">
                            <i className="fa-solid fa-server"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-4">准备接入随机代码段</h2>
                        <p className="text-gray-400 mb-8">
                            接入后，系统会自动截取约 400 字符的代码切片，并随机破坏其中的闭合标签。每一次提交错误都将加速系统崩溃。
                        </p>
                        <button 
                            onClick={startRandomEscape}
                            className="w-full py-4 bg-red-900/40 hover:bg-red-900/80 text-red-400 border border-red-900/50 rounded-lg font-bold text-lg transition-colors"
                        >
                            启动随机抽取序列
                        </button>
                    </div>
                )}

                {gameState === 'loading' && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-12 text-center mt-4 max-w-2xl mx-auto w-full">
                        <div className="text-blue-500 text-4xl mb-4 animate-spin">
                            <i className="fa-solid fa-circle-notch"></i>
                        </div>
                        <div className="text-blue-400 font-mono tracking-widest animate-pulse">
                            正在全球数据库中随机定位异常页面并劫持源码...
                        </div>
                    </div>
                )}

                {gameState === 'playing' && (
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center bg-gray-900 border border-red-900/50 p-4 rounded-lg">
                            <div>
                                <div className="text-gray-400 text-sm mb-1">受损档案来源：{targetPage?.wiki}</div>
                                <div className="text-white font-bold">{targetPage?.title || targetPage?.page}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-gray-400 text-sm mb-1">系统崩溃倒计时</div>
                                <div className={`text-3xl font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                                    00:{timeLeft.toString().padStart(2, '0')}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <label className="text-sm font-medium text-gray-400 flex justify-between">
                                <span>源代码控制台 (直接修改受损代码)</span>
                                <span className="text-red-400">错误提交将扣除 10 秒时间</span>
                            </label>
                            <textarea 
                                value={userCode}
                                onChange={(e) => setUserCode(e.target.value)}
                                className="w-full h-80 bg-[#1e1e1e] text-gray-300 font-mono text-sm p-4 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                                spellCheck="false"
                            />
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={handleVerify}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors"
                            >
                                编译并验证覆写
                            </button>
                            <button 
                                onClick={handleAbort}
                                className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
                            >
                                紧急脱离
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'success' && (
                    <div className="bg-green-900/20 border border-green-500/30 p-8 rounded-xl text-center flex flex-col items-center mt-4">
                        <div className="text-green-500 text-5xl mb-4">
                            <i className="fa-solid fa-check-circle"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">隔离门已重启</h2>
                        <p className="text-gray-400 mb-6">
                            你成功修复了 <span className="text-white font-bold">{targetPage?.title}</span> 的受损片段并阻止了收容失效。本次操作得分：<span className="text-green-400 font-bold text-xl">{score}</span>
                        </p>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setGameState('idle')}
                                className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                            >
                                结算并返回大厅
                            </button>
                            <button 
                                onClick={startRandomEscape}
                                className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors shadow-lg"
                            >
                                继续处理下一份档案
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'fail' && (
                    <div className="bg-red-900/20 border border-red-500/30 p-8 rounded-xl text-center flex flex-col items-center mt-4">
                        <div className="text-red-500 text-5xl mb-4">
                            <i className="fa-solid fa-skull-crossbones"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">收容失效</h2>
                        <p className="text-gray-400 mb-6">倒计时结束，这部分异常代码已彻底崩溃。</p>
                        <div className="flex gap-4">
                            <button 
                                onClick={startRandomEscape}
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors shadow-lg"
                            >
                                抽取新档案重试
                            </button>
                            <button 
                                onClick={() => setGameState('idle')}
                                className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                            >
                                返回大厅
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
