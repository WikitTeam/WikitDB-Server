// pages/index.js
import React from 'react';
import Head from 'next/head';
const config = require('../wikitdb.config.js');

const Home = () => {
  const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];

  return (
    <div className="pb-20">
      <Head>
        <title>{`主页 - ${config.SITE_NAME}`}</title>
      </Head>

      {/* Hero */}
      <section className="pt-20 pb-16 px-4 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
          {config.SITE_NAME}
        </h1>
        <p className="mt-4 text-gray-400 text-lg leading-relaxed max-w-xl mx-auto">
          一个连接多个 Wikidot 创作社区的数据归档站。
          搜页面、查作者、看数据，都在这里。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/pages"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            开始检索
          </a>
          <a
            href="/about"
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg border border-gray-700 transition-colors"
          >
            了解更多
          </a>
        </div>
      </section>

      {/* 功能简介 */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="py-6">
            <div className="text-indigo-400 mb-3">
              <i className="fa-solid fa-database text-lg"></i>
            </div>
            <h3 className="text-white font-medium mb-1">页面归档</h3>
            <p className="text-sm text-gray-500">同步各分站页面数据，支持多维搜索和统计</p>
          </div>
          <div className="py-6">
            <div className="text-indigo-400 mb-3">
              <i className="fa-solid fa-chart-line text-lg"></i>
            </div>
            <h3 className="text-white font-medium mb-1">作者追踪</h3>
            <p className="text-sm text-gray-500">记录创作轨迹，查看评分趋势和活跃度</p>
          </div>
          <div className="py-6">
            <div className="text-indigo-400 mb-3">
              <i className="fa-solid fa-toolbox text-lg"></i>
            </div>
            <h3 className="text-white font-medium mb-1">实用工具</h3>
            <p className="text-sm text-gray-500">盲盒抽取、删除公告生成等自动化小工具</p>
          </div>
        </div>
      </section>

      {/* 分割线 */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="border-t border-gray-800"></div>
      </div>

      {/* 收录站点 */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-12">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white">收录站点</h2>
          <p className="text-sm text-gray-500 mt-1">当前已接入 {wikis.length} 个分站</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wikis.map((wiki) => (
            <a
              key={wiki.PARAM || wiki.PAEAM}
              href={wiki.URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl bg-gray-800/40 p-4 border border-gray-700/50 hover:border-gray-600 transition-colors group"
            >
              <div className="h-12 w-12 shrink-0 flex items-center justify-center overflow-hidden rounded-lg bg-gray-900 border border-gray-700">
                <img
                  src={wiki.ImgURL}
                  alt={`${wiki.NAME} logo`}
                  className="h-full w-full object-contain p-1.5"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors truncate">
                  {wiki.NAME}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{wiki.PARAM}</p>
              </div>
              <i className="fa-solid fa-arrow-up-right-from-square text-xs text-gray-600 group-hover:text-gray-400 transition-colors"></i>
            </a>
          ))}
        </div>
      </section>

      {/* 底部提示 */}
      <section className="max-w-4xl mx-auto px-4 pt-4">
        <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 p-8 text-center">
          <p className="text-gray-400 text-sm">
            注册账号可以解锁作者评分、动态追踪等更多功能
          </p>
          <a
            href="/register"
            className="inline-block mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            注册账号
          </a>
        </div>
      </section>
    </div>
  );
};

export default Home;
