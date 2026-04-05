import React from 'react';
import Head from 'next/head';
const config = require('../wikitdb.config.js');

const About = () => {
    return (
        <>
            <Head>
                <title>关于 - {config.SITE_NAME}</title>
            </Head>

            <div className="py-8 max-w-4xl mx-auto">
                <div className="mb-8 border-b border-gray-700 pb-6">
                    <h1 className="text-3xl font-bold text-white">关于 {config.SITE_NAME}</h1>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10">
                    <div className="text-gray-300 leading-relaxed space-y-4 text-lg">
                        <p>
                            WikitDB 由 <span className="font-medium text-indigo-400">Laimu_slime</span> 根据 <span className="font-medium text-indigo-400">lestday233</span> 创建的 WikitDB 样式更改制作。
                        </p>
                        <p>
                            本站点使用 <span className="font-medium text-white">WikitAPI</span> 进行数据拉取与同步。
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default About;
