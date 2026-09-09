import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GetStaticProps } from 'next';
const config = require('../../wikitdb.config.js');

type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

type PreviewSite = {
    name: string;
    param: string;
    wikiId: string;
};

type FtmlError = {
    kind?: string;
    rule?: string;
    span?: [number, number];
};

type WorkerSuccess = {
    id: number;
    ok: true;
    html?: string;
    errors?: FtmlError[];
    version?: string;
};

type WorkerFailure = {
    id: number;
    ok: false;
    error?: string;
};

type WorkerResult = WorkerSuccess | WorkerFailure;

type IncludeResponse = {
    error?: string;
    expandedSource?: string;
    warnings?: string[];
    includedPages?: string[];
};

type FtmlEditorProps = {
    sites: PreviewSite[];
};

const STORAGE_KEY = 'wikitdb:ftml-editor:v1';
const DEFAULT_SOURCE = `+ FTML 在线编辑器

这是一个 **Wikidot / FTML** 实时预览工具。

[[div class="notice"]]
你可以编辑左侧源码，并在右侧查看安全隔离的渲染结果。
[[/div]]

* 支持常用 Wikidot 语法
* 支持解析错误提示
* 可选择展开受支持站点的 [[include]]

[[collapsible show="+ 展开示例" hide="- 收起示例"]]
这里是折叠内容。
[[/collapsible]]`;

function formatError(error: FtmlError, index: number) {
    const kind = error?.kind || 'parse-error';
    const rule = error?.rule ? ` · ${error.rule}` : '';
    const span = Array.isArray(error?.span) ? ` · ${error.span[0]}-${error.span[1]}` : '';
    return `${index + 1}. ${kind}${rule}${span}`;
}

export default function FtmlEditor({ sites }: FtmlEditorProps) {
    const workerRef = useRef<Worker | null>(null);
    const previewRef = useRef<HTMLIFrameElement | null>(null);
    const requestIdRef = useRef(0);
    const [source, setSource] = useState(DEFAULT_SOURCE);
    const [site, setSite] = useState(sites[0]?.param || '');
    const [expandIncludes, setExpandIncludes] = useState(false);
    const [renderedHtml, setRenderedHtml] = useState('');
    const [errors, setErrors] = useState<FtmlError[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [includedPages, setIncludedPages] = useState<string[]>([]);
    const [status, setStatus] = useState('正在加载 FTML...');
    const [workerVersion, setWorkerVersion] = useState('');
    const [device, setDevice] = useState<PreviewDevice>('desktop');

    useEffect(() => {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setSource(saved);

        const worker = new Worker('/ftml-worker.js', { type: 'module' });
        workerRef.current = worker;
        worker.addEventListener('message', (event: MessageEvent<WorkerResult>) => {
            const result = event.data;
            if (result.id !== requestIdRef.current) return;
            if (!result.ok) {
                setStatus(`渲染失败：${result.error || '未知错误'}`);
                return;
            }
            setRenderedHtml(result.html || '');
            setErrors(Array.isArray(result.errors) ? result.errors : []);
            setWorkerVersion(result.version || '');
            setStatus('渲染完成');
        });
        worker.addEventListener('error', () => setStatus('FTML Worker 加载失败'));
        return () => worker.terminate();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => window.localStorage.setItem(STORAGE_KEY, source), 500);
        return () => clearTimeout(timer);
    }, [source]);

    const renderSource = useCallback(async () => {
        if (!workerRef.current) return;
        setStatus('正在渲染...');
        setWarnings([]);
        setIncludedPages([]);

        let input = source;
        if (expandIncludes) {
            setStatus('正在安全展开 Include...');
            try {
                const response = await fetch('/api/tools/ftml-include', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ source, site }),
                });
                const data = await response.json() as IncludeResponse;
                if (!response.ok) throw new Error(data.error || 'Include 展开失败');
                input = data.expandedSource || input;
                setWarnings(data.warnings || []);
                setIncludedPages(data.includedPages || []);
            } catch (error: unknown) {
                setStatus(error instanceof Error ? error.message : 'Include 展开失败');
                return;
            }
        }

        requestIdRef.current += 1;
        workerRef.current.postMessage({
            id: requestIdRef.current,
            source: input,
            meta: {
                site: sites.find(item => item.param === site)?.wikiId || 'sandbox',
                page: 'sandbox:ftml-preview',
                title: 'FTML Preview',
            },
        });
    }, [expandIncludes, site, sites, source]);

    useEffect(() => {
        const timer = setTimeout(renderSource, 450);
        return () => clearTimeout(timer);
    }, [renderSource]);

    const previewWidth = useMemo(() => ({
        desktop: '100%',
        tablet: '768px',
        mobile: '390px',
    })[device], [device]);

    const updatePreview = useCallback(() => {
        const frame = previewRef.current;
        if (!frame?.contentWindow) return;
        const selected = sites.find(item => item.param === site);
        frame.contentWindow.postMessage({
            type: 'ftml-update',
            title: 'FTML Preview',
            html: renderedHtml,
            tags: [],
            device,
            siteName: selected?.name || 'Wikidot 预览',
            siteOrigin: `https://${selected?.wikiId || 'www'}.wikidot.com`,
        }, '*');
    }, [device, renderedHtml, site, sites]);

    useEffect(() => {
        updatePreview();
    }, [updatePreview]);

    return (
        <>
            <Head>
                <title>FTML 编辑器 - {config.SITE_NAME}</title>
                <meta name="description" content="安全隔离的 Wikidot/FTML 在线编辑与预览工具" />
            </Head>
            <div className="py-6">
                <div className="max-w-[1600px] mx-auto px-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                        <div>
                            <Link href="/tools" className="text-sm text-accent hover:text-accent-hover">&larr; 返回工具箱</Link>
                            <h1 className="mt-2 text-2xl font-bold text-fg">FTML 编辑器</h1>
                            <p className="text-sm text-fg-2">
                                FTML {workerVersion || '加载中'} · 浏览器本地渲染 · 隔离预览
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {(['desktop', 'tablet', 'mobile'] as const).map(value => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setDevice(value)}
                                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${device === value ? 'bg-accent-solid hover:bg-accent-solid-hover text-accent-fg' : 'bg-raised text-fg-2'}`}
                                >
                                    {{ desktop: '桌面', tablet: '平板', mobile: '手机' }[value]}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={renderSource}
                                className="px-4 py-2 rounded-lg bg-accent-solid hover:bg-accent-solid-hover text-accent-fg text-sm font-semibold"
                            >
                                立即渲染
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-[680px]">
                        <section className="rounded-2xl border border-line bg-panel overflow-hidden flex flex-col">
                            <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-3">
                                <strong className="text-sm text-fg">Wikidot 源码</strong>
                                <div className="flex flex-wrap items-center gap-3">
                                    <label className="flex items-center gap-2 text-xs text-fg-2">
                                        <input
                                            type="checkbox"
                                            checked={expandIncludes}
                                            onChange={event => setExpandIncludes(event.target.checked)}
                                        />
                                        展开 Include
                                    </label>
                                    <select
                                        value={site}
                                        onChange={event => setSite(event.target.value)}
                                        disabled={!expandIncludes}
                                        className="px-2 py-1.5 rounded-lg border border-line-strong bg-raised text-xs"
                                    >
                                        {sites.map(item => <option key={item.param} value={item.param}>{item.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <textarea
                                value={source}
                                onChange={event => setSource(event.target.value)}
                                spellCheck={false}
                                maxLength={300000}
                                className="flex-1 min-h-[580px] resize-none p-5 bg-sunken text-fg font-mono text-sm leading-6 outline-none"
                                aria-label="FTML 源码"
                            />
                            <div className="px-4 py-2 text-xs text-fg-3 border-t border-line flex justify-between">
                                <span>{status}</span>
                                <span>{source.length.toLocaleString()} / 300,000</span>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-line bg-sunken overflow-hidden flex flex-col">
                            <div className="px-4 py-3 border-b border-line bg-panel">
                                <strong className="text-sm text-fg">安全预览</strong>
                                <span className="ml-2 text-xs text-fg-3">脚本、表单、弹窗和外部框架已禁用</span>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex justify-center">
                                <iframe
                                    title="FTML 安全预览"
                                    sandbox="allow-scripts"
                                    src="/ftml-preview-frame.html"
                                    style={{ width: previewWidth }}
                                    className="min-h-[580px] bg-white rounded-lg border-0 shadow-sm transition-[width] duration-200"
                                    referrerPolicy="same-origin"
                                    ref={previewRef}
                                    onLoad={updatePreview}
                                />
                            </div>
                        </section>
                    </div>

                    {(errors.length > 0 || warnings.length > 0 || includedPages.length > 0) && (
                        <div className="mt-4 grid md:grid-cols-2 gap-4">
                            <section className="p-4 rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20">
                                <h2 className="font-semibold text-amber-800 dark:text-amber-300">诊断信息</h2>
                                <pre className="mt-2 whitespace-pre-wrap text-xs text-amber-900 dark:text-amber-200 overflow-auto">
                                    {[...warnings, ...errors.map(formatError)].join('\n') || '无'}
                                </pre>
                            </section>
                            <section className="p-4 rounded-xl border border-accent-line bg-accent-soft">
                                <h2 className="font-semibold text-accent">已展开页面</h2>
                                <p className="mt-2 text-xs text-accent">
                                    {includedPages.join('、') || '未展开 Include'}
                                </p>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export const getStaticProps: GetStaticProps<FtmlEditorProps> = () => {
    const previewSites = [
        ...config.SUPPORT_WIKI,
        {
            NAME: '规则怪谈档案馆沙盒',
            PARAM: 'rule-sandbox',
            WIKIT_ID: 'rule-wiki-sandbox',
        },
    ];
    return {
        props: {
            sites: previewSites.map(site => ({
                name: site.NAME,
                param: site.PARAM,
                wikiId: site.WIKIT_ID,
            })),
        },
    };
};
