import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../../wikitdb.config.js');
const { getGraphQLEndpoint } = require('../../utils/graphql');

const DeleteAnnouncement = () => {
    const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];
    
    const [selectedSite, setSelectedSite] = useState(wikis.length > 0 ? wikis[0].PARAM : '');
    const [tagInput, setTagInput] = useState('待删除');
    const [pagesList, setPagesList] = useState([]);
    const [isBatchFetching, setIsBatchFetching] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
    
    const [deletedPages, setDeletedPages] = useState([]);
    const [isCheckingDeleted, setIsCheckingDeleted] = useState(false);

    const [generatedCode, setGeneratedCode] = useState('');

    // 勾选状态：记录被"框选"用于生成公告的页面 URL
    const [selectedUrls, setSelectedUrls] = useState(new Set());
    const selectAllRef = useRef(null);

    const formatValidDate = (dateVal) => {
        if (!dateVal || dateVal === '0' || dateVal === 0) return '未知时间';
        
        let d;
        if (typeof dateVal === 'number' || /^\d+$/.test(dateVal)) {
            const num = parseInt(dateVal, 10);
            if (num === 0) return '未知时间';
            d = new Date(num < 10000000000 ? num * 1000 : num);
        } else {
            d = new Date(dateVal);
        }

        if (isNaN(d.getTime()) || d.getFullYear() <= 1970) {
            return '未知时间';
        }
        
        return d.toLocaleString('zh-CN', { hour12: false });
    };

    useEffect(() => {
        if (!selectedSite) return;
        
        setPagesList([]);
        setGeneratedCode('');
        setDeletedPages([]);
        setSelectedUrls(new Set());

        let isMounted = true;
        
        const checkDeletedCategory = async () => {
            setIsCheckingDeleted(true);
            try {
                const wikiConfig = wikis.find(w => w.PARAM === selectedSite);
                if (!wikiConfig) return;
                
                let actualWikiName = '';
                try {
                    actualWikiName = new URL(wikiConfig.URL).hostname.replace(/^www\./i, '').split('.')[0];
                } catch (e) {
                    actualWikiName = wikiConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
                }

                const res = await fetch(getGraphQLEndpoint(wikiConfig), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `query { articles(wiki: "${actualWikiName}", category: "deleted", pageSize: 50) { nodes { title page rating author created_at } } }`
                    }),
                    cache: 'no-store'
                });
                
                const json = await res.json();
                if (!isMounted) return;
                
                if (!json.errors && json.data && json.data.articles && json.data.articles.nodes) {
                    const nodes = json.data.articles.nodes;
                    if (nodes.length > 0) {
                        const formatted = nodes.map(node => {
                            const pageName = node.page.includes(':') ? node.page : `deleted:${node.page}`;
                            const titleStr = node.title || pageName;
                            const displayTitle = titleStr.startsWith('deleted:') ? titleStr : `deleted:${titleStr}`;
                            
                            return {
                                pageName: pageName,
                                title: displayTitle,
                                originalUrl: `${wikiConfig.URL.replace(/\/$/, '')}/${pageName}`,
                                siteName: wikiConfig.NAME,
                                creatorName: node.author || '未知',
                                rating: node.rating || 0,
                                lastUpdated: formatValidDate(node.created_at),
                                sourceCode: '',
                                timerIframe: ''
                            };
                        });
                        setDeletedPages(formatted);
                    }
                }
            } catch (e) {
                console.error("检查 deleted 分类失败", e);
            } finally {
                if (isMounted) setIsCheckingDeleted(false);
            }
        };
        
        checkDeletedCategory();
        
        return () => { isMounted = false; };
    }, [selectedSite, wikis]);

    // 表头"全选"复选框的半选（indeterminate）状态
    useEffect(() => {
        if (selectAllRef.current) {
            const allSelected = pagesList.length > 0 && selectedUrls.size === pagesList.length;
            selectAllRef.current.indeterminate = selectedUrls.size > 0 && !allSelected;
        }
    }, [selectedUrls, pagesList]);

    const fetchSourceCode = async (siteParam, pageName) => {
        const res = await fetch(`/api/source?site=${siteParam}&page=${encodeURIComponent(pageName)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '源码抓取失败');
        return data.sourceCode;
    };

    // 并发抓取每个页面的讨论区 RSS，提取删除倒计时器 iframe
    const updateTimers = async (pages, siteParam) => {
        const CONCURRENCY = 4;
        let cursor = 0;
        const run = async () => {
            while (cursor < pages.length) {
                const idx = cursor++;
                const p = pages[idx];
                if (!p.pageName) continue;
                try {
                    const res = await fetch(`/api/page/discussion-rss?wiki=${siteParam}&page=${encodeURIComponent(p.pageName)}`);
                    const data = await res.json();
                    p.timerIframe = (data && data.timerIframe) || '';
                } catch (e) {
                    p.timerIframe = '';
                }
            }
        };
        const workers = [];
        for (let i = 0; i < Math.min(CONCURRENCY, pages.length); i++) workers.push(run());
        await Promise.all(workers);
    };

    const handleTagFetch = async (e) => {
        if (e) e.preventDefault();
        if (!tagInput.trim() || !selectedSite) return;
        
        setIsBatchFetching(true);
        setBatchProgress({ current: 0, total: 0 });
        
        try {
            const wikiConfig = wikis.find(w => w.PARAM === selectedSite);
            let actualWikiName = '';
            if (wikiConfig) {
                try {
                    actualWikiName = new URL(wikiConfig.URL).hostname.replace(/^www\./i, '').split('.')[0];
                } catch (err) {
                    actualWikiName = wikiConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
                }
            }

            const res = await fetch(getGraphQLEndpoint(wikiConfig), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query { articles(wiki: "${actualWikiName}", includeTags: ["${tagInput.trim()}"], pageSize: 500) { nodes { title page rating author created_at } } }`
                })
            });
            
            const json = await res.json();
            if (json.errors) throw new Error(json.errors[0].message);
            
            const nodes = json.data?.articles?.nodes || [];
            if (nodes.length === 0) {
                alert(`在 ${wikiConfig.NAME} 未找到带有标签 "${tagInput}" 的页面。`);
                setIsBatchFetching(false);
                return;
            }

            setBatchProgress({ current: 0, total: nodes.length });
            const newPages = [];
            
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const originalUrl = `${wikiConfig.URL.replace(/\/$/, '')}/${node.page}`;
                
                if (!pagesList.find(p => p.originalUrl === originalUrl)) {
                    let fullData = {
                        pageName: node.page,
                        title: node.title || node.page,
                        originalUrl: originalUrl,
                        siteName: wikiConfig.NAME,
                        creatorName: node.author || '未知',
                        rating: node.rating || 0,
                        lastUpdated: formatValidDate(node.created_at),
                        sourceCode: '[[源码获取失败，请手动补充]]',
                        timerIframe: ''
                    };
                    
                    try {
                        const sourceCode = await fetchSourceCode(selectedSite, node.page);
                        if (sourceCode) {
                            fullData.sourceCode = sourceCode;
                        }
                    } catch (err) {
                        console.error(`无法抓取 ${node.page} 的源码:`, err);
                    }
                    
                    newPages.push(fullData);
                }
                
                setBatchProgress({ current: i + 1, total: nodes.length });
            }
            
            if (newPages.length > 0) {
                // 并发抓取删除倒计时器 iframe
                try {
                    await updateTimers(newPages, selectedSite);
                } catch (err) {
                    console.error('抓取计时器失败:', err);
                }
                setPagesList(prev => [...prev, ...newPages]);
                // 新抓取的页面默认勾选，可手动取消
                setSelectedUrls(prev => {
                    const next = new Set(prev);
                    newPages.forEach(p => next.add(p.originalUrl));
                    return next;
                });
            }
        } catch (err) {
            alert(`标签抓取失败: ${err.message}`);
        } finally {
            setIsBatchFetching(false);
            setBatchProgress({ current: 0, total: 0 });
        }
    };

    const removePage = (indexToRemove) => {
        const removed = pagesList[indexToRemove];
        setPagesList(prev => prev.filter((_, index) => index !== indexToRemove));
        // 同步清除该页面的勾选状态
        if (removed) {
            setSelectedUrls(prev => {
                const next = new Set(prev);
                next.delete(removed.originalUrl);
                return next;
            });
        }
    };

    const toggleSelect = (url) => {
        setSelectedUrls(prev => {
            const next = new Set(prev);
            if (next.has(url)) next.delete(url);
            else next.add(url);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (pagesList.length === 0) return;
        setSelectedUrls(prev => {
            if (prev.size === pagesList.length) return new Set();
            return new Set(pagesList.map(p => p.originalUrl));
        });
    };

    // isSelfDeleted=true 只勾选"自删页面"，false 只勾选"低分页面"
    const selectByType = (isSelfDeleted) => {
        setSelectedUrls(new Set(
            pagesList
                .filter(p => isSelfDeleted
                    ? (p.title.startsWith('deleted:') || p.originalUrl.includes('/deleted:'))
                    : !(p.title.startsWith('deleted:') || p.originalUrl.includes('/deleted:')))
                .map(p => p.originalUrl)
        ));
    };

    const clearSelection = () => setSelectedUrls(new Set());

    const generateCode = () => {
        if (pagesList.length === 0) {
            setGeneratedCode('请先添加至少一个页面。');
            return;
        }

        const selectedList = pagesList.filter(p => selectedUrls.has(p.originalUrl));
        if (selectedList.length === 0) {
            setGeneratedCode('请先勾选要生成公告的页面（可点击表格中的复选框，或在列表上方使用快捷按钮）。');
            return;
        }

        const selfDeletedPages = [];
        const lowScorePages = [];

        selectedList.forEach(p => {
            if (p.title.startsWith('deleted:') || p.originalUrl.includes('/deleted:')) {
                selfDeletedPages.push(p);
            } else {
                lowScorePages.push(p);
            }
        });

        let code = '';

        if (selfDeletedPages.length > 0) {
            code += `直接删除原作者自删的页面：\n`;
            selfDeletedPages.forEach(p => {
                code += `${p.originalUrl}\n`;
            });
            code += `\n\n`;
        }

        lowScorePages.forEach(p => {
            const title = p.title || '未知页面';
            const rating = p.rating || 0;
            const sourceCode = p.sourceCode || '[[无可用源码，请手动补充]]';
            
            code += `由于发布删除宣告时本页面已处于 [宣告分数] 的低分，现已跌至 ${rating} 分，且在宣告删除后的 [24/72] 小时内无异议，故删除「${title}」。\n`;
            code += `[[collapsible show="+ 页面源代码" hide="- 收起"]]\n`;
            code += `[[code]]\n`;
            code += `${sourceCode}\n`;
            code += `[[/code]]\n`;
            code += `[[/collapsible]]\n\n`;
        });

        setGeneratedCode(code.trim());
    };

    // 复制文本到剪贴板，兼容非 HTTPS 环境（navigator.clipboard 仅在安全上下文中可用）
    const copyText = (text) => {
        // 方式一：现代异步剪贴板 API（HTTPS 或 localhost 下优先使用）
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(() => true);
        }
        // 方式二：降级方案，使用 execCommand 兼容普通 HTTP 环境
        return new Promise((resolve, reject) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.top = '-9999px';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length); // iOS Safari 需要
            let ok = false;
            try {
                ok = document.execCommand('copy');
            } catch (e) {
                ok = false;
            }
            document.body.removeChild(textarea);
            if (ok) resolve(true);
            else reject(new Error('execCommand copy failed'));
        });
    };

    const copyToClipboard = async () => {
        const container = document.getElementById('generated-code-container');
        const text = (container ? (container.textContent || container.innerText) : '') || generatedCode;
        if (!text) {
            alert('没有可复制的代码，请先生成公告代码。');
            return;
        }
        try {
            await copyText(text);
            alert('代码已复制到剪贴板！');
        } catch (err) {
            console.error('复制到剪贴板失败:', err);
            alert('复制失败，请手动选中代码后使用 Ctrl+C 复制。');
        }
    };

    return (
        <>
            <Head>
                <title>删除公告生成器 - {config.SITE_NAME}</title>
            </Head>

            <div className="py-8 max-w-6xl mx-auto">
                <div className="mb-6 flex items-center text-sm text-fg-3">
                    <Link href="/tools" className="hover:text-accent transition-colors">工具库</Link>
                    <i className="fa-solid fa-chevron-right mx-2 text-xs"></i>
                    <span className="text-fg-2">删除公告生成</span>
                </div>

                <div className="mb-8 border-b border-line pb-6">
                    <h1 className="text-3xl font-bold text-fg flex items-center gap-3">
                        <i className="fa-solid fa-bullhorn text-red-500"></i>
                        页面自动删除公告生成器
                    </h1>
                    <p className="text-fg-3 mt-2 text-sm">
                        自动识别“自删页面”和“低分删除页面”，并一键生成包含完整源代码折叠块的 Wikidot 格式公告。
                    </p>
                </div>

                {deletedPages.length > 0 && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                            <i className="fa-solid fa-triangle-exclamation text-red-500 text-xl mt-0.5"></i>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">注意：当前选择的站点存在位于 deleted: 分类下的页面！</h3>
                                <p className="text-sm text-fg-2 mb-3">这些页面可能已被移动至待删除区，但没有挂上相应标签。你可以快速将它们加入待处理列表：</p>
                                <div className="bg-sunken rounded border border-red-500/20 p-3 mb-4 max-h-40 overflow-y-auto space-y-2">
                                    {deletedPages.map((dp, idx) => (
                                        <div key={idx} className="text-sm">
                                            <span className="text-red-600 dark:text-red-400 font-medium">{dp.title}</span>
                                            <span className="text-fg-3 ml-2">
                                                (原作者: {dp.creatorName} | 当前评分: <span className={dp.rating < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>{dp.rating > 0 ? `+${dp.rating}` : dp.rating}</span> | 最后更新: {dp.lastUpdated})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={async () => {
                                        const newPages = deletedPages.filter(dp => !pagesList.find(p => p.originalUrl === dp.originalUrl));
                                        // 抓取删除倒计时器 iframe
                                        try {
                                            await updateTimers(newPages, selectedSite);
                                        } catch (err) {
                                            console.error('抓取计时器失败:', err);
                                        }
                                        setPagesList(prev => [...prev, ...newPages]);
                                        // 新加入的页面默认勾选
                                        setSelectedUrls(prev => {
                                            const next = new Set(prev);
                                            newPages.forEach(p => next.add(p.originalUrl));
                                            return next;
                                        });
                                        setDeletedPages([]);
                                    }}
                                    className="px-4 py-2 bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50 rounded hover:bg-red-500/30 transition-colors text-sm font-medium flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-plus"></i> 一键将以上所有分类页面加入下方处理列表
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-panel p-4 rounded-xl border border-line">
                    <form onSubmit={handleTagFetch} className="flex-1 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="输入抓取标签 (如: 待删除)..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                disabled={isBatchFetching}
                                className="w-full bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line block p-2.5 px-4 disabled:opacity-50"
                            />
                        </div>
                        <select 
                            className="bg-sunken border border-line text-fg text-sm rounded-lg focus:ring-accent focus:border-accent-line p-2.5 sm:w-36 outline-none"
                            value={selectedSite}
                            onChange={(e) => setSelectedSite(e.target.value)}
                            disabled={isBatchFetching}
                        >
                            {wikis.map(wiki => (
                                <option key={wiki.PARAM} value={wiki.PARAM}>{wiki.NAME}</option>
                            ))}
                        </select>
                        <button 
                            type="submit"
                            disabled={isBatchFetching || !tagInput.trim()}
                            className="px-4 py-2.5 bg-accent-solid text-accent-fg font-medium rounded-lg hover:bg-accent-solid-hover disabled:opacity-50 transition-colors shrink-0"
                        >
                            {isBatchFetching ? `抓取中... ${batchProgress.total > 0 ? `(${batchProgress.current}/${batchProgress.total})` : ''}` : '按标签抓取'}
                        </button>
                    </form>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-4 bg-panel px-4 py-3 rounded-xl border border-line">
                    <span className="text-sm text-fg-2 flex items-center gap-2">
                        <i className="fa-solid fa-square-check text-accent"></i>
                        已勾选 <span className="font-bold text-accent">{selectedUrls.size}</span> / {pagesList.length} 个页面
                        {selectedUrls.size > 0 && <span className="text-xs text-fg-3">（仅勾选的页面会生成公告）</span>}
                    </span>
                    <div className="flex-1"></div>
                    <button
                        onClick={toggleSelectAll}
                        disabled={pagesList.length === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 border-line text-fg-2 hover:bg-sunken"
                    >
                        <i className="fa-solid fa-check-double mr-1"></i>
                        {selectedUrls.size === pagesList.length && pagesList.length > 0 ? '取消全选' : '全选'}
                    </button>
                    <button
                        onClick={() => selectByType(true)}
                        disabled={pagesList.length === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    >
                        <i className="fa-solid fa-user-slash mr-1"></i> 仅选自删
                    </button>
                    <button
                        onClick={() => selectByType(false)}
                        disabled={pagesList.length === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                        <i className="fa-solid fa-arrow-trend-down mr-1"></i> 仅选低分
                    </button>
                    <button
                        onClick={clearSelection}
                        disabled={selectedUrls.size === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 border-line text-fg-2 hover:bg-sunken"
                    >
                        <i className="fa-solid fa-eraser mr-1"></i> 清空
                    </button>
                </div>

                <div className="bg-panel rounded-xl border border-line overflow-hidden mb-8">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-line">
                            <thead className="bg-sunken">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-fg-3 uppercase w-10">
                                        <input
                                            ref={selectAllRef}
                                            type="checkbox"
                                            checked={pagesList.length > 0 && selectedUrls.size === pagesList.length}
                                            onChange={toggleSelectAll}
                                            title="全选 / 取消全选"
                                            className="w-4 h-4 rounded border-line bg-sunken text-accent focus:ring-accent cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-fg-3 uppercase">页面标题</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-fg-3 uppercase w-32">原作者</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-fg-3 uppercase w-24">当前评分</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-fg-3 uppercase w-40">最后更新</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-fg-3 uppercase w-20">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {pagesList.length > 0 ? (
                                    pagesList.map((page, index) => (
                                        <tr key={index} className={`hover:bg-sunken transition-colors ${selectedUrls.has(page.originalUrl) ? 'bg-accent-soft' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUrls.has(page.originalUrl)}
                                                    onChange={() => toggleSelect(page.originalUrl)}
                                                    title="勾选/取消勾选以决定是否生成公告"
                                                    className="w-4 h-4 rounded border-line bg-sunken text-accent focus:ring-accent cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <a href={page.originalUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover font-medium truncate max-w-xs block">
                                                    {page.title}
                                                </a>
                                                <div className="text-xs text-fg-3 mt-1">{page.siteName}</div>
                                                {page.timerIframe && (
                                                    <div
                                                        className="mt-2"
                                                        dangerouslySetInnerHTML={{ __html: page.timerIframe }}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-fg-2">
                                                {page.creatorName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`font-semibold ${page.rating > 0 ? 'text-green-600 dark:text-green-400' : page.rating < 0 ? 'text-red-600 dark:text-red-400' : 'text-fg-3'}`}>
                                                    {page.rating > 0 ? `+${page.rating}` : page.rating}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-fg-3">
                                                {page.lastUpdated}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button 
                                                    onClick={() => removePage(index)}
                                                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-2 rounded-md hover:bg-red-400/10 transition-colors"
                                                    title="移除"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-fg-3">
                                            <div className="flex flex-col items-center">
                                                <i className="fa-solid fa-inbox text-4xl mb-3 opacity-50"></i>
                                                列表为空，请在上方添加页面
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-panel rounded-xl p-6 border border-line">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-fg">生成的 Wikidot 代码</h2>
                        <button 
                            onClick={generateCode}
                            className="px-4 py-1.5 bg-green-600/20 text-green-600 dark:text-green-400 border border-green-500/30 rounded hover:bg-green-600/30 transition-colors text-sm font-medium"
                        >
                            <i className="fa-solid fa-code mr-1.5"></i>
                            生成公告代码{selectedUrls.size > 0 ? ` (${selectedUrls.size})` : ''}
                        </button>
                    </div>
                    <pre
                        id="generated-code-container"
                        className="w-full h-48 bg-sunken border border-line text-fg-2 rounded-lg p-4 font-mono text-sm overflow-auto resize-y whitespace-pre-wrap outline-none"
                    >
                        {generatedCode || '点击右上角按钮生成代码...'}
                    </pre>
                    {generatedCode && !generatedCode.includes('请先') && (
                        <div className="mt-4 flex justify-end">
                            <button 
                                onClick={copyToClipboard}
                                className="px-4 py-2 bg-accent-solid text-accent-fg rounded-lg hover:bg-accent-solid-hover transition-colors text-sm font-medium"
                            >
                                <i className="fa-regular fa-copy mr-1.5"></i> 复制代码
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default DeleteAnnouncement;
