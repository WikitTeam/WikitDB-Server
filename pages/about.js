import React from 'react';
import Head from 'next/head';
const config = require('../wikitdb.config.js');

const About = () => {
    return (
        <>
            <Head>
                <title>关于 - {config.SITE_NAME}</title>
            </Head>

            <div className="py-12 max-w-5xl mx-auto px-4">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl sm:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 mb-6 tracking-tight">
                        关于 {config.SITE_NAME}
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        一个致力于为 Wikidot 社区提供全方位、多维度的作者活跃度分析与虚拟金融体验的综合性平台。
                    </p>
                </div>

                {/* Core Features Grid */}
                <div className="grid md:grid-cols-3 gap-8 mb-20">
                    <div className="bg-white dark:bg-gray-800/40 p-8 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                            <i className="fa-solid fa-bolt text-2xl"></i>
                        </div>
                        <h3 className="text-xl font-bold mb-4 dark:text-white">实时同步</h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            基于强大的 Wikit GraphQL 接口，我们能实时追踪全站作者的发文、评分及互动数据，确保信息的时效性。
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800/40 p-8 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6">
                            <i className="fa-solid fa-chart-line text-2xl"></i>
                        </div>
                        <h3 className="text-xl font-bold mb-4 dark:text-white">虚拟股市</h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            首创“作者概念股”模式，将创作产出转化为波动曲线。在充满博弈的虚拟市场中，挖掘那些被低估的潜力新星。
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800/40 p-8 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                            <i className="fa-solid fa-shield-halved text-2xl"></i>
                        </div>
                        <h3 className="text-xl font-bold mb-4 dark:text-white">社区驱动</h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            本站点为非营利性同人项目，所有功能均围绕 Wikidot 社区生态设计，旨在提升社区互动性与趣味性。
                        </p>
                    </div>
                </div>

                {/* Credits & Origin */}
                <div className="relative group overflow-hidden rounded-3xl bg-indigo-600 p-12 text-white shadow-2xl">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="max-w-xl">
                            <h2 className="text-3xl font-bold mb-6 italic tracking-tight">“连接创作与未来的纽带”</h2>
                            <div className="space-y-4 text-indigo-100 text-lg leading-relaxed">
                                <p>
                                    WikitDB 由 <span className="font-bold text-white border-b-2 border-indigo-400/50">Laimu_slime</span> 
                                    精心打磨，在继承由 <span className="font-bold text-white border-b-2 border-indigo-400/50">lestday233</span> 
                                    奠定的 WikitDB 经典设计精髓的基础上，进行了全面的底层重构与视觉升级。
                                </p>
                                <p>
                                    WikitDB LOGO 由用户 <span className="font-bold text-white border-b-2 border-indigo-400/50">bairan317</span> 倾力制作。
                                </p>
                                <p>
                                    核心动力源自 <span className="font-bold text-white uppercase tracking-wider">Wikit API</span> 的强力支撑。
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0">
                            <div className="w-24 h-24 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/30 rotate-3 group-hover:rotate-6 transition-transform">
                                <i className="fa-solid fa-heart text-4xl text-white"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Quote */}
                <div className="mt-20 text-center">
                    <p className="text-gray-500 dark:text-gray-500 font-medium tracking-widest uppercase text-xs">
                        {config.SITE_NAME} · Since 2024
                    </p>
                </div>
            </div>
        </>
    );
};

export default About;
