// pages/index.js
import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import HeroAsciiCanvas from '../components/HeroAsciiCanvas';
const config = require('../wikitdb.config.js');

// 兜底占位 SVG（Data URL）：用于 wiki logo 加载失败时回退
const PLACEHOLDER_SVG =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%238b5cf6'/><stop offset='1' stop-color='%237c3aed'/></linearGradient></defs><rect width='64' height='64' rx='14' fill='url(%23g)'/><text x='50%25' y='56%25' text-anchor='middle' font-family='Arial,sans-serif' font-size='22' font-weight='bold' fill='white' dominant-baseline='middle'>W</text></svg>";

// ---------- 数据 ----------
const stats = (wikiCount) => [
    { num: `${wikiCount}`, label: '收录站点', icon: 'fa-globe', iconColor: 'text-primary-600' },
    { num: '实时', label: '数据同步', icon: 'fa-bolt', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { num: '多维', label: '搜索筛选', icon: 'fa-filter', iconColor: 'text-amber-600 dark:text-amber-400' },
    { num: '免费', label: '开放使用', icon: 'fa-heart', iconColor: 'text-pink-600 dark:text-pink-400' }
];

const tools = [
    { icon: 'fa-dice', text: '盲盒抽取', href: '/tools/gacha', iconColor: 'text-primary-600 dark:text-primary-400' },
    { icon: 'fa-scroll', text: '删除公告', href: '/tools/jackpot', iconColor: 'text-rose-600 dark:text-rose-400' },
    { icon: 'fa-bullseye', text: '悬赏活动', href: '/tools/bounty', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { icon: 'fa-users-line', text: '成员管理', href: '/tools/member-admin', iconColor: 'text-sky-600 dark:text-sky-400' },
    { icon: 'fa-code', text: 'FTML编辑器', href: '/tools/ftml-editor', iconColor: 'text-orange-600 dark:text-orange-400' },
    { icon: 'fa-file', text: '代发页面', href: '/tools/save-page', iconColor: 'text-amber-600 dark:text-amber-400' }
];

const quickLinks = [
    { text: '浏览所有页面', href: '/pages', icon: 'fa-book-open' },
    { text: '论坛话题', href: '/forums', icon: 'fa-comments' },
    { text: '虚拟股市', href: '/trade', icon: 'fa-money-bill-trend-up' }
];

const faqs = [
    {
        q: '这个网站是用来做什么的？',
        a: 'WikitDB 把散落在各个 Wikidot 分站的页面、作者、评分和论坛数据统一整理，让你可以在一个地方跨站搜索页面、追踪作者动态、参与虚拟股市等。'
    },
    {
        q: '使用所有功能都需要账号吗？',
        a: '检索、浏览页面和论坛不需要登录。作者追踪、虚拟股市、高级筛选等个性化功能需要免费注册账号，注册过程不超过一分钟。'
    },
    {
        q: '数据来源是什么？更新及时吗？',
        a: '数据来自 Wikit API，由其调用 kakushi-w/wikit CLI 定期抓取 Wikidot 平台公开页面。每天 12:00（Asia/Shanghai）自动执行备份任务，接口层面会尽可能快地反映最新内容。'
    },
    {
        q: '我是作者，不希望我的作品被收录？',
        a: '请通过社区渠道联系管理员，核验身份后我们会对特定条目进行遮蔽。WikitDB 只是为读者服务的索引工具，原站点永远是权威发布渠道。'
    }
];

// ---------- 功能区：一条三分的图片面板 ----------
const features = [
    {
        id: 'f01',
        num: '01',
        title: '页面归档',
        desc: '各分站的页面数据实时同步过来，想按标签搜、按评分排、按时间筛都行。',
        cta: '去检索',
        href: '/pages',
        img: '/img/index/showcase-1.webp'
    },
    {
        id: 'f02',
        num: '02',
        title: '作者追踪',
        desc: '看某个作者写了什么、评分走势怎么样、在哪些站活跃，一目了然。',
        cta: '查作者',
        href: '/authors',
        img: '/img/index/showcase-2.webp'
    },
    {
        id: 'f03',
        num: '03',
        title: '实用工具',
        desc: '盲盒抽取、删除公告生成、质量评审……一些能省事的自动化小玩意。',
        cta: '看工具',
        href: '/tools',
        img: '/img/index/showcase-3.webp'
    }
];

// ---------- 跑马灯行切分 ----------
const splitMarqueeRows = (wikis) => {
    const half = Math.ceil(wikis.length / 2);
    return { row1: wikis.slice(0, half), row2: wikis.slice(half) };
};

const Home = () => {
    const router = useRouter();
    const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];
    const [q, setQ] = useState('');
    // 移动端/无 hover 设备：点击哪一块展开完整内容（-1 表示全部收起）
    const [openFeature, setOpenFeature] = useState(-1);
    const toggleFeature = (i) => setOpenFeature((prev) => (prev === i ? -1 : i));

    const onSearch = (e) => {
        e.preventDefault();
        const val = String(q || '').trim();
        if (!val) {
            router.push('/pages');
        } else {
            router.push(`/pages?q=${encodeURIComponent(val)}`);
        }
    };

    // 当 logo 加载失败时回退到占位 SVG（React 里用 non-React event listener）
    const imgFallback = (e) => {
        const target = e.currentTarget;
        if (target.src !== PLACEHOLDER_SVG) target.src = PLACEHOLDER_SVG;
    };

    const { row1, row2 } = splitMarqueeRows(wikis);

    return (
        <div className="pb-0">
            <Head>
                <title>{`主页 - ${config.SITE_NAME}`}</title>
                <meta
                    name="description"
                    content={`${config.SITE_NAME} 是 Wikidot 社区的数据归档站，收录 ${wikis.length} 个站点。搜页面、查作者、看走势，所有内容一站搞定。`}
                />
                <meta property="og:title" content={`${config.SITE_NAME} · Wikidot 社区的数据归档站`} />
                <meta
                    property="og:description"
                    content="收录多个 Wikidot 分站，支持跨站页面检索、作者评分走势追踪、虚拟股市与丰富社区工具。"
                />
                <meta property="og:type" content="website" />
            </Head>

            {/* ==================== Hero · 品牌深紫全宽色块 ==================== */}
            <section
                className="relative w-full overflow-hidden bg-zinc-950 text-white"
                role="banner"
                aria-labelledby="hero-title"
            >
                {/* 算法艺术背景：紫色粒子漂移 + ASCII 字符后处理（components/HeroAsciiCanvas.js） */}
                <HeroAsciiCanvas />

                {/* 双层径向光晕 */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-40 -top-44 h-[760px] w-[760px] rounded-full bg-primary-600/30 blur-[80px]" />
                    <div className="absolute right-[100px] top-[260px] h-[560px] w-[560px] rounded-full bg-primary-400/20 blur-[70px]" />
                </div>

                {/* 内容（：避开 Header 高度预留 pt-32） */}
                <div className="relative mx-auto max-w-[1280px] px-6 pb-28 pt-32 sm:px-10 lg:px-16">
                    {/* 徽章 */}
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary-500 px-4 py-1.5 text-xs text-primary-200 backdrop-blur-sm">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" aria-hidden="true" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        </span>
                        已收录 {wikis.length} 个站点
                    </div>

                    {/* 主标题 */}
                    <h1
                        id="hero-title"
                        className="mt-8 max-w-[820px] text-[64px] font-black leading-[1.08] tracking-tight sm:text-[80px]"
                    >
                        让Wikidot，
                        <br />
                        <span className="text-primary-400">连为一体</span>。
                    </h1>

                    <p className="mt-6 max-w-[560px] text-lg leading-[1.8] text-primary-300">
                        为Wikidot不同网站的社区提供统一的数据查询服务。页面、作者、评分，都可一站式获取。
                    </p>

                    <form
                        onSubmit={onSearch}
                        role="search"
                        className="group mt-10 w-full max-w-[780px]"
                    >
                        <label htmlFor="hero-q" className="sr-only">搜索页面或关键词</label>
                        <div
                            className="flex items-center rounded-md bg-black/75 px-6 py-2 transition-all"
                        >
                            <i aria-hidden="true" className="fa-solid fa-magnifying-glass text-zinc-500 transition-colors group-focus-within:text-primary-600" />
                            <input
                                id="hero-q"
                                type="search"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="搜索页面、作者、标签……（留空进入浏览）"
                                className="flex-1 bg-transparent py-4 px-3 text-base text-zinc-200 outline-none placeholder:text-zinc-500"
                                autoComplete="off"
                                spellCheck="false"
                            />
                            <button
                                type="submit"
                                className="rounded bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                                aria-label="搜索"
                            >
                                搜索
                            </button>
                        </div>
                    </form>

                    {/* 快速入口 chips */}
                    <div className="mt-5 flex flex-wrap items-center gap-2" role="list" aria-label="快速入口">
                        {quickLinks.map((it) => (
                            <a
                                key={it.href}
                                role="listitem"
                                href={it.href}
                                className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs text-primary-200 transition-colors hover:bg-white/15 hover:text-white"
                            >
                                <i aria-hidden="true" className={`fa-solid ${it.icon} text-[10px]`} />
                                {it.text}
                            </a>
                        ))}
                    </div>

                    {/* 主按钮行 */}
                    <div className="mt-10 flex flex-wrap items-center gap-3">
                        <Link
                            href="/about"
                            className="rounded px-4 py-2 font-medium text-primary-200 transition-all hover:border-white hover:bg-white/15 hover:text-white"
                        >
                            了解更多
                        </Link>
                    </div>
                </div>
            </section>

            {/* ==================== 数据亮点 · 白色账本带 ==================== */}
            <section className="w-full bg-white" aria-label="数据亮点">
                {/* flex + justify-between：剩余空间被均分到所有子项之间，分割线因此落在相邻两项的正中 */}
                <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-y-10 px-6 py-20 sm:px-10 lg:px-16">
                    {stats(wikis.length).map((item, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && (
                                <div
                                    aria-hidden="true"
                                    className="hidden h-24 w-px shrink-0 bg-zinc-200 md:block"
                                />
                            )}
                            <div className="group flex w-1/2 flex-col items-start gap-1 px-2 py-2 md:w-auto md:py-0">
                                <div className="font-[family-name:Archivo,sans-serif] text-[64px] font-black leading-none tracking-tight text-zinc-900">
                                    {item.num}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <i aria-hidden="true" className={`fa-solid ${item.icon} text-base ${item.iconColor}`} />
                                    <span>{item.label}</span>
                                </div>
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            </section>

            {/* ==================== 功能区 · 一条三分（悬浮/点击展开） ==================== */}
            <section className="featureStrip w-full" aria-label="核心功能">
                {features.map((f, i) => {
                    const isOpen = openFeature === i;
                    return (
                        <article
                            key={f.id}
                            className={`featurePanel${isOpen ? ' is-open' : ''}`}
                            tabIndex={0}
                            aria-expanded={isOpen}
                            aria-labelledby={`${f.id}-open-title`}
                            onClick={() => toggleFeature(i)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleFeature(i);
                                }
                            }}
                        >
                            {/* 多层背景：深灰渐变遮罩在上，图片在下 */}
                            <div
                                className="featureBg"
                                style={{
                                    backgroundImage: `linear-gradient(0deg, rgba(250,250,250,1) 35%, transparent 140%), url(${f.img})`
                                }}
                                aria-hidden="true"
                            />

                            {/* 收起态：桌面为竖排序号 + 标题 */}
                            <div className="featureFold" aria-hidden="true">
                                <span className="featureNum">{f.num}</span>
                                <span className="featureTitle">{f.title}</span>
                            </div>

                            {/* 展开态：完整文案 + 入口 */}
                            <div className="featureOpen">
                                <div className="featureOpenInner">
                                    <span className="featureNum featureNumSm">{f.num}</span>
                                    <h3 id={`${f.id}-open-title`} className="featureTitle featureTitleOpen">
                                        {f.title}
                                    </h3>
                                    <p className="featureDesc">{f.desc}</p>
                                    <Link
                                        href={f.href}
                                        className="featureCta px-2 py-3 bg-zinc-200 text-zinc-800 hover:bg-zinc-100 transition-colors rounded-sm"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {f.cta}
                                        <span className="featureCtaIcon rounded-sm ml-2" aria-hidden="true">
                                            <i className="fa-solid fa-arrow-right text-sm" />
                                        </span>
                                    </Link>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </section>

            {/* ==================== 工具直达 · 暗色发丝线网格 ==================== */}
            <section className="w-full bg-zinc-950 text-zinc-100" aria-label="常用工具直达">
                <div className="mx-auto max-w-[1280px] px-6 py-20 sm:px-10 lg:px-16 lg:py-24">
                    <div className="mb-10 flex items-end justify-between gap-6">
                        <div>
                            <div className="font-[family-name:Anton,sans-serif] text-[15px] tracking-[4px] text-zinc-500">
                                TOOLBOX
                            </div>
                            <h2 className="mt-2 text-3xl font-black text-zinc-50 sm:text-4xl">
                                常用工具直达
                            </h2>
                        </div>
                        <Link
                            href="/tools"
                            className="group inline-flex items-center gap-1.5 pb-1 text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
                        >
                            全部工具
                            <i aria-hidden="true" className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    </div>
                    {/* gap-px + bg-zinc-800 制造发丝线网格 */}
                    <div className="grid grid-cols-1 gap-px bg-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
                        {tools.map((t) => (
                            <Link
                                key={t.href}
                                href={t.href}
                                className="group flex items-center gap-4 bg-zinc-950 px-7 py-7 transition-colors hover:bg-zinc-900"
                            >
                                <i aria-hidden="true" className={`fa-solid ${t.icon} text-xl ${t.iconColor}`} />
                                <span className="flex-1 text-base font-medium text-zinc-100 group-hover:text-white">
                                    {t.text}
                                </span>
                                <i aria-hidden="true" className="fa-solid fa-arrow-right text-sm text-zinc-500 transition-all group-hover:translate-x-1 group-hover:text-primary-400" />
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ==================== 收录站点 · 双行反向跑马灯 ==================== */}
            <section className="w-full bg-zinc-50 py-20 lg:py-24" aria-labelledby="wikis-title">
                <div className="mx-auto max-w-[1280px] px-6 sm:px-10 lg:px-16">
                    <div className="mb-8 flex items-end justify-between gap-6">
                        <div>
                            <div className="font-[family-name:Anton,sans-serif] text-[15px] tracking-[4px] text-zinc-400">
                                ARCHIVE
                            </div>
                            <h2 id="wikis-title" className="mt-2 text-3xl font-black text-zinc-900 sm:text-4xl">
                                收录站点
                            </h2>
                        </div>
                        <span className="hidden pb-1 text-sm tabular-nums text-zinc-500 sm:block">
                            {wikis.length} 个站点
                        </span>
                    </div>
                </div>

                {/* 行 1 · 向左滚动 */}
                <div className="group/marquee relative w-full overflow-hidden">
                    {/* 边缘渐隐遮罩 */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[140px] bg-gradient-to-r from-zinc-50 to-transparent" />
                    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[140px] bg-gradient-to-l from-zinc-50 to-transparent" />
                    {/* 两份完全等宽的分组：组内 gap-4、组尾 pr-4 补齐接缝间距，
                        translateX(-50%) 恰好等于一个分组宽 → 无缝循环 */}
                    <div className="flex w-max marquee-track marquee-left hover:[animation-play-state:paused]">
                        {[0, 1].map((half) => (
                            <div key={half} aria-hidden={half === 1} className="flex gap-4 pr-4">
                                {row1.map((wiki, idx) => {
                                    const param = wiki.PARAM || wiki.PAEAM || '';
                                    return (
                                        <a
                                            key={`r1-${param}-${idx}`}
                                            href={`/site/${param}`}
                                            className="flex shrink-0 items-center gap-4 rounded-md border border-zinc-200 bg-white px-6 py-4 transition-colors hover:border-primary-400 hover:bg-white"
                                            aria-label={`${wiki.NAME} 站点概览`}
                                        >
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100">
                                                <img
                                                    src={wiki.ImgURL}
                                                    alt={`${wiki.NAME} logo`}
                                                    loading="lazy"
                                                    width={44}
                                                    height={44}
                                                    onError={imgFallback}
                                                    className="h-full w-full object-contain p-1.5"
                                                />
                                            </span>
                                            <span className="text-base font-semibold text-zinc-900 whitespace-nowrap">
                                                {wiki.NAME}
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 行 2 · 向右滚动（reverse） */}
                <div className="group/marquee relative mt-7 w-full overflow-hidden">
                    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[140px] bg-gradient-to-r from-zinc-50 to-transparent" />
                    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[140px] bg-gradient-to-l from-zinc-50 to-transparent" />
                    <div className="flex w-max marquee-track marquee-right hover:[animation-play-state:paused]">
                        {[0, 1].map((half) => (
                            <div key={half} aria-hidden={half === 1} className="flex gap-4 pr-4">
                                {row2.map((wiki, idx) => {
                                    const param = wiki.PARAM || wiki.PAEAM || '';
                                    return (
                                        <a
                                            key={`r2-${param}-${idx}`}
                                            href={`/site/${param}`}
                                            className="flex shrink-0 items-center gap-4 rounded-md border border-zinc-200 bg-white px-6 py-4 transition-colors hover:border-primary-400 hover:bg-white"
                                            aria-label={`${wiki.NAME} 站点概览`}
                                        >
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100">
                                                <img
                                                    src={wiki.ImgURL}
                                                    alt={`${wiki.NAME} logo`}
                                                    loading="lazy"
                                                    width={44}
                                                    height={44}
                                                    onError={imgFallback}
                                                    className="h-full w-full object-contain p-1.5"
                                                />
                                            </span>
                                            <span className="text-base font-semibold text-zinc-900 whitespace-nowrap">
                                                {wiki.NAME}
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ==================== FAQ · 白色双栏区 ==================== */}
            <section className="w-full bg-white" aria-labelledby="faq-title">
                <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-16 px-6 py-20 sm:px-10 md:grid-cols-[300px_1fr] lg:px-16 lg:py-28">
                    <div className="space-y-3">
                        <div className="font-[family-name:Anton,sans-serif] text-[15px] tracking-[4px] text-zinc-400">
                            FAQ
                        </div>
                        <h2 id="faq-title" className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
                            常见问题
                        </h2>
                        <p className="text-sm leading-[1.8] text-zinc-500">
                            若没找到答案，可查看关于页或联系管理员
                        </p>
                    </div>
                    <div className="divide-y divide-zinc-200 border-y border-zinc-200">
                        {faqs.map((f, i) => (
                            <details
                                key={i}
                                className="group py-7 [&_summary::-webkit-details-marker]:hidden"
                            >
                                <summary className="flex cursor-pointer items-center justify-between gap-6 list-none">
                                    <span className="flex items-start gap-3 pr-4 text-base font-semibold text-zinc-900">
                                        <i aria-hidden="true" className="fa-solid fa-circle-question mt-1 text-sm text-primary-600" />
                                        <span>{f.q}</span>
                                    </span>
                                    <i aria-hidden="true" className="fa-solid fa-chevron-down text-xs text-zinc-500 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="mt-4 pl-7 text-sm leading-[1.9] text-zinc-600">
                                    {f.a}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ==================== 底部 CTA · 全宽 violet 渐变大色块 ==================== */}
            <section className="relative w-full overflow-hidden" aria-labelledby="cta-title">
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-b from-zinc-950 to-zinc-900"
                />
                <div className="relative mx-auto max-w-[1280px] px-6 py-24 text-center sm:px-10 lg:px-16 lg:py-32">
                    <h2 id="cta-title" className="text-5xl font-black tracking-tight text-white sm:text-6xl">
                        注册一下？
                    </h2>
                    <p className="mx-auto mt-5 max-w-[520px] text-base leading-[1.9] text-zinc-200">
                        有账号才能用作者评分、动态追踪、高级搜索这些功能。免费的，花不了一分钟。
                    </p>
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        <Link
                            href="/register"
                            className="inline-flex items-center rounded bg-primary-500 hover:bg-primary-400 px-10 py-4 font-semibold text-zinc-900 transition-all"
                        >
                            <i aria-hidden="true" className="fa-solid fa-user-plus mr-2 text-sm" />
                            注册账号
                        </Link>
                        <Link
                            href="/login"
                            className="rounded border border-white/40 bg-white/10 px-10 py-4 font-medium text-white backdrop-blur-sm transition-all hover:border-white hover:bg-white/20"
                        >
                            已有账号，登录
                        </Link>
                    </div>
                    <p className="mt-6 text-xs tracking-wide text-primary-300">
                        <i aria-hidden="true" className="fa-solid fa-lock mr-1" />
                        仅需Wikidot验证防机器人，不与第三方共享
                    </p>
                </div>
            </section>

            <style jsx>{`
                /* 双行站点跑马灯 */
                @keyframes marqueeLeft {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
                @keyframes marqueeRight {
                    from { transform: translateX(-50%); }
                    to { transform: translateX(0); }
                }
                .marquee-track {
                    will-change: transform;
                }
                .marquee-left {
                    animation: marqueeLeft 36s linear infinite;
                }
                .marquee-right {
                    animation: marqueeRight 44s linear infinite;
                }
                /* 降级：尊重系统动画偏好 */
                @media (prefers-reduced-motion: reduce) {
                    .marquee-ticker,
                    .marquee-left,
                    .marquee-right {
                        animation: none;
                    }
                    .marquee-track {
                        transform: translateX(0) !important;
                    }
                }

                /* ---------- 功能区：一条三分 + 悬浮挤压 / 点击展开 ---------- */
                .featureStrip {
                    display: flex;
                    flex-direction: column;
                    background-color: #efeff5ff;
                }

                .featurePanel {
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    outline: none;
                    /* 移动端：较矮的纵列 */
                    height: 172px;
                    border-top: 1px solid rgba(208, 208, 208, 0.08);
                    transition: height .5s cubic-bezier(.4, 0, .2, 1);
                }
                .featurePanel:focus-visible {
                    outline: 2px solid rgb(139 92 246);
                    outline-offset: -2px;
                }
                .featurePanel.is-open { height: 440px; }

                /* 多层背景：深灰渐变遮罩在上、图片在下 */
                .featureBg {
                    position: absolute;
                    inset: 0;
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    transform: scale(1.04);
                    filter: saturate(.8);
                    transition: transform .8s cubic-bezier(.4, 0, .2, 1), filter .5s ease;
                }

                /* 收起态 */
                .featureFold {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: .6rem;
                    padding: 1.25rem;
                    transition: opacity .35s ease;
                }

                /* 展开态：默认隐藏，visibility 让内部链接不可聚焦 */
                .featureOpen {
                    position: absolute;
                    inset: 0;
                    z-index: 2;
                    display: flex;
                    align-items: flex-end;
                    padding: 1.75rem;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(1rem);
                    /* clip-path 约束绘制区域：窄列下溢出内容被裁掉而非回流 */
                    clip-path: inset(0);
                    transition: opacity .4s ease, transform .45s cubic-bezier(.2, .7, .2, 1), visibility .4s;
                }
                /* 宽度锁定：内容不因列宽变化而重排换行（防跳变） */
                .featureOpenInner {
                    width: 340px;
                    max-width: calc(100% - 3.5rem);
                }

                /* 展开条件之一：移动端点开 / 无 hover 设备 */
                .featurePanel.is-open .featureFold { opacity: 0; }
                .featurePanel.is-open .featureOpen {
                    opacity: 1;
                    visibility: visible;
                    transform: none;
                }

                .featureNum {
                    display: block;
                    font-family: Anton, sans-serif;
                    font-size: 44px;
                    line-height: 1;
                    letter-spacing: .02em;
                    color: rgba(27, 27, 28, 0.5);
                }
                .featureNumSm { font-size: 34px; }
                .featureTitle {
                    display: block;
                    margin: 0;
                    font-size: 20px;
                    font-weight: 900;
                    line-height: 1.2;
                    color: #000000ff;
                    white-space: nowrap;
                }
                .featureTitleOpen::before {
                    content: '//';
                    font-size: 75%;
                    color: #8100ccff
                }
                .featureDesc {
                    margin: .9rem 0 .9rem 0;
                    font-size: 15px;
                    line-height: 1.85;
                    color: rgba(32, 32, 32, 0.82);
                }
                .featureCta {
                    display: inline-flex;
                    align-items: center;
                    gap: .6rem;
                    font-size: 15px;
                    font-weight: 700;
                    color: #000000ff;
                }
                .featureCtaIcon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background: #000000ff;
                    color: #e7e7e7ff;
                    transition: transform .3s ease;
                }
                .featureCta:hover .featureCtaIcon { transform: translateX(4px); }

                /* 桌面：一行三分，靠 flex-grow 过渡实现「一块变宽、挤压另两块」 */
                @media (min-width: 768px) {
                    .featureStrip {
                        flex-direction: row;
                        height: 560px;
                    }
                    .featurePanel,
                    .featurePanel.is-open {
                        flex: 1 1 0%;
                        height: 100%;
                        border-top: 0;
                        border-left: 1px solid rgba(255, 255, 255, .1);
                        transition: flex-grow .55s cubic-bezier(.4, 0, .2, 1);
                    }
                    .featurePanel:first-child { border-left: 0; }
                    .featurePanel.is-open { flex-grow: 1.75; }
                    .featureFold { flex-direction: column; gap: 1.1rem; }
                    .featureTitle {
                        font-size: 24px;
                    }
                    .featureNum { font-size: 64px; }
                    .featureOpen { padding: 2.75rem; }
                    .featureOpenInner { width: 360px; }
                }

                /* 仅在真实 hover 设备上启用悬停展开，避免触摸端 hover 沾滞 */
                @media (min-width: 768px) and (hover: hover) {
                    .featurePanel:hover { flex-grow: 1.75; }
                    .featurePanel:hover .featureFold { opacity: 0; }
                    .featurePanel:hover .featureOpen {
                        opacity: 1;
                        visibility: visible;
                        transform: none;
                    }
                    .featurePanel:hover .featureBg {
                        transform: scale(1.1);
                        filter: saturate(1);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .featurePanel,
                    .featureBg,
                    .featureOpen,
                    .featureFold { transition-duration: .01ms !important; }
                }
            `}</style>
        </div>
    );
};

// 首页使用全宽布局：色块区（Hero / 跑马灯 / 功能块 / CTA）需要铺满屏幕
Home.fullWidth = true;

export default Home;