// pages/index.js
import React from 'react';
import Head from 'next/head';
const config = require('../wikitdb.config.js');

const Home = () => {
  // 兼容修正前后的变量名
  const wikis = config.SUPPORT_WIKI || config.SUPPOST_WIKI || [];

  return (
    <>
      <Head>
          <title>{`主页 - ${config.SITE_NAME}`}</title>
      </Head>
      
      <div className="text-center py-12 sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              欢迎访问 {config.SITE_NAME}
          </h1>
          <p className="mt-4 text-xl text-gray-400">
              这里是各站点的核心数据库与档案导航。
          </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {wikis.map((wiki) => (
              <a
                  key={wiki.PARAM || wiki.PAEAM}
                  href={wiki.URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center rounded-xl bg-gray-800/50 p-8 border border-white/10 shadow-lg transition-all hover:-translate-y-1 hover:bg-gray-800 hover:border-white/20"
              >
                  <div className="h-24 w-24 flex items-center justify-center overflow-hidden rounded-full bg-gray-900 mb-6 border border-gray-700">
                      <img
                          src={wiki.ImgURL}
                          alt={`${wiki.NAME} logo`}
                          className="h-full w-full object-contain p-2"
                      />
                  </div>
                  <h3 className="text-xl font-semibold text-white tracking-wide">
                      {wiki.NAME}
                  </h3>
              </a>
          ))}
      </div>
    </>
  );
};

export default Home;
