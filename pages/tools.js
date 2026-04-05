// pages/tools.js
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../wikitdb.config.js');

export default function Tools() {
    return (
        <div className="py-8">
            <Head>
                <title>工具箱 - {config.SITE_NAME}</title>
            </Head>
            <div className="max-w-5xl mx-auto">
                <div className="mb-8 border-b border-gray-800 pb-4">
                    <h1 className="text-3xl font-bold text-white">工具箱</h1>
                    <p className="text-gray-400 mt-2 text-sm">WikitDB 的各项扩展功能与实验性应用。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 1. 档案馆盲盒 */}
                    <Link href="/tools/gacha" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-purple-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-purple-400 group-hover:text-purple-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-box-open"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">档案馆盲盒</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">消耗资产，在浩瀚的数据中随机抽取未知的页面标的进行投资。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 2. 作者概念股 */}
                    <Link href="/tools/author-stock" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-green-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-green-400 group-hover:text-green-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-chart-line"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">作者概念股</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">投资有潜力的创作者，股价走势与近期发文量、存活率深度挂钩。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 3. 标签大乐透 */}
                    <Link href="/tools/bingo" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-teal-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-teal-400 group-hover:text-teal-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-ticket-simple"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">标签大乐透</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">消耗扫描凭证，命中特定标签即可赢取最高百倍赔率的奖金。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 4. 全站公共彩票池 */}
                    <Link href="/tools/jackpot" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-yellow-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-yellow-400 group-hover:text-yellow-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-sack-dollar"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors">全站公共彩票池</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">全站玩家共同注资的公共奖池，每日随机开奖，瓜分巨额奖金。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 5. 页面打新评断 */}
                    <Link href="/tools/quality-judge" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-cyan-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-cyan-400 group-hover:text-cyan-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-scale-balanced"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">页面打新评断</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">获取近期最新发布的页面，在信息流中快速做多或做空未来的评分。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 6. 收容物斗兽场 */}
                    <Link href="/tools/deathmatch" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-red-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-red-400 group-hover:text-red-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-skull-crossbones"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">收容物斗兽场</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">押注两篇随机提取的异常档案，盲猜真实评分高低，赢取双倍返还。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 7. 异常档案悬赏令 */}
                    <Link href="/tools/bounty" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-orange-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-orange-400 group-hover:text-orange-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-scroll"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">异常档案悬赏令</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">全服寻宝任务，寻找符合特定标签与评分组合档案拿走高额赏金。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 8. 战力雷达评估 */}
                    <Link href="/tools/radar" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-indigo-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-indigo-400 group-hover:text-indigo-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-crosshairs"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">战力雷达评估</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">跨站聚合创作者的历史档案，多维度生成雷达图并推算其危险等级。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 9. 代码修复逃脱 */}
                    <Link href="/tools/escape" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-orange-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-orange-400 group-hover:text-orange-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">代码修复逃脱</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">随机抽取受损的真实页面源码，限时修复排版语法以阻止收容失效。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 10. 跨界缝合怪 */}
                    <Link href="/tools/splice" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-pink-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-pink-400 group-hover:text-pink-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-puzzle-piece"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-pink-400 transition-colors">跨界缝合怪</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">抽取多站点的无关联文本碎片，由你来拼接命名属于你的荒诞故事。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 11. 标签大宗商品 */}
                    <Link href="/tools/tag-futures" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-yellow-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-yellow-400 group-hover:text-yellow-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-tags"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors">标签大宗商品</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">将常见分类标签视作商品，根据近期该标签页面的综合评分进行看涨跌。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 12. 站点大盘指数 */}
                    <Link href="/tools/site-index" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-teal-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-teal-400 group-hover:text-teal-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-globe"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">站点大盘指数</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">各站繁荣度量化为点数走势，可作为长线 ETF 基金大额认购持有。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 13. 成员管理 (原有) */}
                    <Link href="/tools/member-admin" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-blue-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-blue-400 group-hover:text-blue-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-users-gear"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">成员管理</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">在特定站点对指定成员采取封禁、移除等操作。</p>
                            </div>
                        </div>
                    </Link>

                    {/* 14. 删帖公示 (原有) */}
                    <Link href="/tools/delete-announcement" className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-red-500 hover:bg-gray-800 transition-all group flex flex-col justify-between shadow-lg">
                        <div className="grid grid-cols-[min-content_1fr]">
                            <div className="rounded-xl bg-[#24344f] p-[10px_8px] text-red-400 group-hover:text-red-500 mb-4 mr-4 max-h-14 text-3xl">
                                <i className="fa-solid fa-trash-can"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">删帖公示</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">查看近期已被删除的页面记录与相关公示信息。</p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
