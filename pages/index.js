// pages/index.js
import React from 'react';
import Head from 'next/head';
const config = require('../wikitdb.config.js');

const Home = () => {
  const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];

  return (
    <div className="space-y-20 pb-20">
      <Head>
        <title>{`主页 - ${config.SITE_NAME}`}</title>
      </Head>

      {/* Hero */}
      <section className="relative pt-20 pb-12 overflow-hidden">
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[480px] h-[480px] bg-indigo-500/8 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative text-center max-w-2xl mx-auto px-4 space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
            {config.SITE_NAME}
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            一个连接多个 Wikidot 创作社区的数据归档站。
            搜页面、查作者、看数据，都在这里。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="/pages"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/15 transition-colors"
            >
              <i className="fa-solid fa-magnifying-glass mr-1.5 text-xs"></i>
              开始检索
            </a>
            <a
              href="/about"
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg border border-gray-700 transition-colors"
            >
              了解更多
            </a>
          </div>
        </div>
      </section>

      {/* 功能简介 */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: 'fa-database', title: '页面归档', desc: '实时同步各分站的页面数据，支持多维度搜索和统计分析。' },
            { icon: 'fa-chart-line', title: '作者追踪', desc: '记录创作者的发布轨迹，查看评分趋势和社区活跃度。' },
            { icon: 'fa-toolbox', title: '实用工具', desc: '盲盒抽取、删除公告生成、质量评审等自动化小工具。' }
          ].map((feat, i) => (
            <div key={i} className="p-6 rounded-2xl bg-gray-800/30 border border-gray-700/40 hover:border-gray-600/60 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
                <i className={`fa-solid ${feat.icon}`}></i>
              </div>
              <h3 className="text-white font-semibold mb-2">{feat.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 收录站点 */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">收录站点</h2>
            <p className="text-sm text-gray-500 mt-1">已接入 {wikis.length} 个分站的数据</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wikis.map((wiki) => (
            <a
              key={wiki.PARAM || wiki.PAEAM}
              href={wiki.URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl bg-gray-800/30 p-5 border border-gray-700/40 hover:border-indigo-500/25 hover:bg-gray-800/50 transition-all group"
            >
              <div className="h-14 w-14 shrink-0 flex items-center justify-center overflow-hidden rounded-xl bg-gray-900/80 border border-gray-700/60">
                <img
                  src={wiki.ImgURL}
                  alt={`${wiki.NAME} logo`}
                  className="h-full w-full object-contain p-2"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                  {wiki.NAME}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{wiki.PARAM}</p>
              </div>
              <i className="fa-solid fa-arrow-right text-xs text-gray-600 group-hover:text-indigo-400 transition-colors"></i>
            </a>
          ))}
        </div>
      </section>

      {/* 底部注册引导 */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-800/40 border border-gray-700/40 p-10 text-center overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none"></div>
          <h3 className="text-xl font-bold text-white relative z-10">想要更多功能？</h3>
          <p className="text-gray-400 text-sm mt-2 relative z-10">
            注册账号即可使用作者评分、动态追踪、高级搜索等功能
          </p>
          <a
            href="/register"
            className="inline-block mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/10 transition-colors relative z-10"
          >
            注册账号
          </a>
        </div>
      </section>
    </div>
  );
};

export default Home;
