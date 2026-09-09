import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
const config = require('../wikitdb.config.js');
const { markdownLite } = require('../utils/markdownLite');

const About = ({ contentHtml }) => {
    const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];

    return (
        <>
            <Head>
                <title>关于 - {config.SITE_NAME}</title>
                <meta
                    name="description"
                    content={`WikitDB 是一个面向 Wikidot 社区的非营利同人项目，收录 ${wikis.length} 个站点，提供页面归档、作者追踪、虚拟股市、论坛同步等全方位服务。`}
                />
                <meta property="og:title" content={`关于 ${config.SITE_NAME}`} />
                <meta
                    property="og:description"
                    content="连接创作与未来的纽带 — Wikidot 社区的数据归档站与工具箱"
                />
            </Head>

            <div className="pb-20">
                {/* Hero Banner */}
                <section className="relative pt-28 pb-16 overflow-hidden" aria-labelledby="about-hero-title">
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[110px]"></div>
                        <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[100px]"></div>
                    </div>
                    <div className="relative max-w-3xl mx-auto px-4 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sunken border border-line text-fg-3 text-xs tracking-wide backdrop-blur-sm mb-6">
                            <i aria-hidden="true" className="fa-solid fa-circle-info mr-1 text-accent"></i>
                            Since {config.SITE_SINCE || '2026'}
                        </div>
                        <h1
                            id="about-hero-title"
                            className="text-4xl sm:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 dark:from-violet-400 dark:via-purple-400 dark:to-violet-400 mb-5 tracking-tight"
                        >
                            关于 {config.SITE_NAME}
                        </h1>
                        <p className="text-lg text-fg-3 leading-relaxed max-w-xl mx-auto">
                            面向 Wikidot 社区生态的非营利同人项目。把散落在各个分站的页面、作者、评分、论坛数据串起来，让创作者与读者各取所需。
                        </p>
                    </div>
                </section>

                {/* MD 内容区 */}
                <section
                    aria-label="介绍正文"
                    className="max-w-4xl mx-auto px-4 sm:px-6 article-prose"
                >
                    <div
                        className="rounded-2xl bg-panel border border-line p-6 sm:p-10 shadow-xl shadow-black/20"
                        // markdownLite 输出已通过 sanitizeRichHtml 消毒
                        dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                </section>

                {/* 底部 CTA */}
                <section aria-label="行动召唤" className="max-w-4xl mx-auto px-4 pt-16">
                    <div className="relative rounded-3xl overflow-hidden">
                        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-violet-600/90 to-violet-900/90"></div>
                        <div aria-hidden="true" className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjZykiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4=')] opacity-60"></div>
                        <div className="relative px-8 py-12 sm:px-14 text-center">
                            <h3 className="text-2xl sm:text-3xl font-bold text-white">准备好开始探索了吗？</h3>
                            <p className="text-violet-100/70 mt-3 max-w-md mx-auto">
                                打开检索页搜索页面，或注册账号解锁作者追踪与虚拟股市等个性化功能。
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                                <Link
                                    href="/pages"
                                    className="inline-flex items-center px-7 py-3 bg-white text-violet-600 font-semibold rounded-xl hover:bg-zinc-200 transition-all hover:-translate-y-0.5 shadow-lg"
                                >
                                    <i aria-hidden="true" className="fa-solid fa-magnifying-glass mr-2 text-sm"></i>
                                    开始检索
                                </Link>
                                <Link
                                    href="/register"
                                    className="px-7 py-3 bg-white/10 text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all hover:-translate-y-0.5 backdrop-blur-sm"
                                >
                                    注册账号
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
};

export async function getStaticProps() {
    const mdPath = path.join(process.cwd(), 'content', 'about.md');
    let raw = '';
    try {
        raw = fs.readFileSync(mdPath, 'utf8');
    } catch (err) {
        raw = '# 关于\n\n介绍文件暂不可用，请稍后再试。';
    }

    // 运行时占位符替换：{WIKIS_COUNT} -> 实际数量
    const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];
    raw = raw.replace(/\{WIKIS_COUNT\}/g, String(wikis.length));

    const contentHtml = markdownLite(raw);
    return { props: { contentHtml } };
}

export default About;
