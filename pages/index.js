// pages/index.js
import React from 'react';
import Head from 'next/head';
const config = require('../wikitdb.config.js');

const Home = () => {
  const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];

  return (
    <div className="space-y-24 pb-20">
      <Head>
          <title>{`主页 - ${config.SITE_NAME}`}</title>
      </Head>

      {/* Hero Section */}
      <section className="relative pt-16 pb-8 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

          <div className="relative text-center space-y-8 max-w-3xl mx-auto px-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest animate-fade-in">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  系统已就绪
              </div>

              <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white leading-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500">
                    探索与归档
                  </span>
                  <br />
                  {config.SITE_NAME} 核心枢纽
              </h1>

              <p className="text-lg text-gray-400 leading-relaxed">
                  连接多个创作社区的元数据中心。我们不仅记录文字，更致力于通过数据分析、动态检索与归档系统，为创作者与读者构建一个更深邃的数字世界镜像。
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  <a href="/pages" className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-1 flex items-center gap-2">
                      <i className="fa-solid fa-magnifying-glass text-sm"></i> 立即开始检索
                  </a>
                  <a href="/about" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-2xl border border-gray-700 transition-all flex items-center gap-2">
                      了解更多信息
                  </a>
              </div>
          </div>
      </section>

      {/* Feature Section */}
      <section className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
              { icon: 'fa-database', title: '全站元数据归档', desc: '实时同步各分站页面数据，提供精细化的多维搜索与统计。' },
              { icon: 'fa-chart-line', title: '作者动态追踪', desc: '记录作者的创作轨迹与影响力，建立完整的创作者生态档案。' },
              { icon: 'fa-toolbox', title: '多功能工具箱', desc: '内置盲盒抽取、删除公告生成、质量评审等多项自动化实用工具。' }
          ].map((feat, i) => (
              <div key={i} className="p-8 rounded-3xl bg-gray-800/40 border border-gray-700/50 hover:border-indigo-500/30 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                      <i className={`fa-solid ${feat.icon} text-xl`}></i>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feat.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feat.desc}</p>
              </div>
          ))}
      </section>

      {/* Wiki Grid Section */}
      <section className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-end justify-between gap-4 mb-12">
              <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white">收录分站导航</h2>
                  <p className="text-gray-500 font-medium">当前已有 {wikis.length} 个活跃分站接入 wikitdb 核心数据库</p>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent mb-4 hidden sm:block"></div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {wikis.map((wiki) => (
                  <a
                      key={wiki.PARAM || wiki.PAEAM}
                      href={wiki.URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-6 rounded-2xl bg-gray-800/30 p-6 border border-white/5 shadow-lg transition-all hover:bg-gray-800/60 hover:border-indigo-500/20 group overflow-hidden relative"
                  >
                      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>

                      <div className="h-20 w-20 shrink-0 flex items-center justify-center overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 group-hover:scale-105 transition-transform">
                          <img
                              src={wiki.ImgURL}
                              alt={`${wiki.NAME} logo`}
                              className="h-full w-full object-contain p-3"
                          />
                      </div>

                      <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors truncate">
                              {wiki.NAME}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1 font-mono uppercase tracking-wider">{wiki.PARAM} / SOURCE</p>
                          <div className="mt-4 flex items-center text-[10px] text-indigo-400 font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                              访问分站 <i className="fa-solid fa-arrow-right ml-2 text-[8px]"></i>
                          </div>
                      </div>
                  </a>
              ))}
          </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-4">
          <div className="p-12 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-indigo-900 shadow-2xl shadow-indigo-500/20 text-center space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full -ml-20 -mb-20 blur-3xl"></div>

              <h2 className="text-3xl font-black text-white relative z-10">准备好探索更深层的数据了吗？</h2>
              <p className="text-indigo-100/80 max-w-xl mx-auto relative z-10 font-medium">
                  立即注册账号，解锁作者评分、动态追踪、高级搜索等更多专属功能。
              </p>
              <div className="pt-4 relative z-10">
                  <a href="/register" className="px-10 py-4 bg-white text-indigo-600 font-black rounded-2xl shadow-xl hover:scale-105 transition-all inline-block">
                      创建我的数字档案
                  </a>
              </div>
          </div>
      </section>
    </div>
  );
};

export default Home;

