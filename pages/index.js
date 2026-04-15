// pages/index.js
import React from 'react';
import Head from 'next/head';
const config = require('../wikitdb.config.js');

const Home = () => {
  const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];

  return (
    <div className="pb-24">
      <Head>
        <title>{`主页 - ${config.SITE_NAME}`}</title>
      </Head>

      {/* Hero */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative max-w-3xl mx-auto px-4 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400 text-xs tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            已收录 {wikis.length} 个站点
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-[1.1] tracking-tight">
            Wikidot 社区的
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              数据归档站
            </span>
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed max-w-lg mx-auto">
            搜页面、查作者、看数据。把散落在各个分站的内容串起来，都在这一个地方搞定。
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <a href="/pages" className="group px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:shadow-indigo-500/30">
              <i className="fa-solid fa-magnifying-glass mr-2 text-sm"></i>
              开始检索
              <i className="fa-solid fa-arrow-right ml-2 text-xs opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"></i>
            </a>
            <a href="/about" className="px-7 py-3 text-gray-300 font-medium rounded-xl border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-all">
              了解更多
            </a>
          </div>
        </div>
      </section>

      {/* 数据亮点 */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { num: `${wikis.length}`, label: '收录站点' },
            { num: '实时', label: '数据同步' },
            { num: '多维', label: '搜索筛选' },
            { num: '免费', label: '开放使用' },
          ].map((item, i) => (
            <div key={i} className="text-center py-6 px-4 rounded-2xl bg-gray-800/20 border border-gray-800">
              <div className="text-2xl font-bold text-white">{item.num}</div>
              <div className="text-xs text-gray-500 mt-1 tracking-wide">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 功能区 */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">能帮你做什么</h2>
          <p className="text-gray-500 mt-2">不只是个数据库，也是个工具箱</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: 'fa-database',
              color: 'from-indigo-500/20 to-indigo-600/5',
              border: 'hover:border-indigo-500/30',
              iconColor: 'text-indigo-400',
              title: '页面归档',
              desc: '各分站的页面数据实时同步过来，想按标签搜、按评分排、按时间筛都行。'
            },
            {
              icon: 'fa-chart-line',
              color: 'from-emerald-500/20 to-emerald-600/5',
              border: 'hover:border-emerald-500/30',
              iconColor: 'text-emerald-400',
              title: '作者追踪',
              desc: '看某个作者写了什么、评分走势怎么样、在哪些站活跃，一目了然。'
            },
            {
              icon: 'fa-toolbox',
              color: 'from-amber-500/20 to-amber-600/5',
              border: 'hover:border-amber-500/30',
              iconColor: 'text-amber-400',
              title: '实用工具',
              desc: '盲盒抽取、删除公告生成、质量评审……一些能省事的自动化小玩意。'
            }
          ].map((feat, i) => (
            <div key={i} className={`p-6 rounded-2xl bg-gradient-to-b ${feat.color} border border-gray-700/40 ${feat.border} transition-colors`}>
              <div className={`w-11 h-11 rounded-xl bg-gray-900/60 flex items-center justify-center ${feat.iconColor} mb-5`}>
                <i className={`fa-solid ${feat.icon} text-lg`}></i>
              </div>
              <h3 className="text-lg text-white font-semibold mb-2">{feat.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 收录站点 */}
      <section className="max-w-5xl mx-auto px-4 pt-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white">收录站点</h2>
            <p className="text-gray-500 mt-2">点击可以直接跳转到对应的 Wikidot 分站</p>
          </div>
          <span className="hidden sm:block text-sm text-gray-600 tabular-nums">{wikis.length} 个站点</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wikis.map((wiki, i) => (
            <a
              key={wiki.PARAM || wiki.PAEAM}
              href={wiki.URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center gap-5 rounded-2xl bg-gray-800/30 p-5 border border-gray-700/40 hover:border-gray-600 hover:bg-gray-800/60 transition-all"
            >
              <div className="h-16 w-16 shrink-0 flex items-center justify-center overflow-hidden rounded-2xl bg-gray-900 border border-gray-700/60 group-hover:border-gray-600 transition-colors">
                <img
                  src={wiki.ImgURL}
                  alt={`${wiki.NAME} logo`}
                  className="h-full w-full object-contain p-2.5"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                  {wiki.NAME}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-mono">{wiki.PARAM}</p>
              </div>
              <div className="text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                <i className="fa-solid fa-arrow-right text-sm"></i>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="max-w-5xl mx-auto px-4 pt-20">
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 to-indigo-900/90"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjZykiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4=')] opacity-60"></div>
          <div className="relative px-8 py-14 sm:px-14 text-center">
            <h3 className="text-2xl sm:text-3xl font-bold text-white">注册一下？</h3>
            <p className="text-indigo-100/70 mt-3 max-w-md mx-auto">
              有账号才能用作者评分、动态追踪、高级搜索这些功能。免费的，花不了一分钟。
            </p>
            <a
              href="/register"
              className="inline-block mt-8 px-8 py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
            >
              注册账号
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
