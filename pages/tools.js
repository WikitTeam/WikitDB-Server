import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../wikitdb.config.js');

export default function Tools() {
    return (
        <div className="py-8">
            <Head><title>工具箱 - {config.SITE_NAME}</title></Head>
            <div className="max-w-5xl mx-auto">
                <div className="mb-8 border-b border-gray-200 dark:border-gray-800 pb-4">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">工具箱</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">WikitDB 的各项扩展功能与实验性应用。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        { href: '/tools/gacha', icon: 'fa-box-open', color: 'purple', title: '档案馆盲盒', desc: '消耗资产，在浩瀚的数据中随机抽取未知的页面标的进行投资。' },
                        { href: '/tools/author-stock', icon: 'fa-chart-line', color: 'green', title: '作者概念股', desc: '投资有潜力的创作者，股价走势与近期发文量、存活率深度挂钩。' },
                        { href: '/tools/bingo', icon: 'fa-ticket-simple', color: 'teal', title: '标签大乐透', desc: '消耗扫描凭证，命中特定标签即可赢取最高百倍赔率的奖金。' },
                        { href: '/tools/jackpot', icon: 'fa-sack-dollar', color: 'yellow', title: '全站公共彩票池', desc: '全站玩家共同注资的公共奖池，每日随机开奖，瓜分巨额奖金。' },
                        { href: '/tools/quality-judge', icon: 'fa-scale-balanced', color: 'cyan', title: '页面打新评断', desc: '获取近期最新发布的页面，在信息流中快速做多或做空未来的评分。' },
                        { href: '/tools/deathmatch', icon: 'fa-skull-crossbones', color: 'red', title: '收容物斗兽场', desc: '押注两篇随机提取的异常档案，盲猜真实评分高低，赢取双倍返还。' },
                        { href: '/tools/bounty', icon: 'fa-scroll', color: 'orange', title: '异常档案悬赏令', desc: '全服寻宝任务，寻找符合特定标签与评分组合档案拿走高额赏金。' },
                        { href: '/tools/radar', icon: 'fa-crosshairs', color: 'indigo', title: '战力雷达评估', desc: '跨站聚合创作者的历史档案，多维度生成雷达图并推算其危险等级。' },
                        { href: '/tools/escape', icon: 'fa-triangle-exclamation', color: 'orange', title: '代码修复逃脱', desc: '随机抽取受损的真实页面源码，限时修复排版语法以阻止收容失效。' },
                        { href: '/tools/splice', icon: 'fa-puzzle-piece', color: 'pink', title: '跨界缝合怪', desc: '抽取多站点的无关联文本碎片，由你来拼接命名属于你的荒诞故事。' },
                        { href: '/tools/tag-futures', icon: 'fa-tags', color: 'yellow', title: '标签大宗商品', desc: '将常见分类标签视作商品，根据近期该标签页面的综合评分进行看涨跌。' },
                        { href: '/tools/site-index', icon: 'fa-globe', color: 'teal', title: '站点大盘指数', desc: '各站繁荣度量化为点数走势，可作为长线 ETF 基金大额认购持有。' },
                        { href: '/tools/member-admin', icon: 'fa-users-gear', color: 'blue', title: '成员管理', desc: '在特定站点对指定成员采取封禁、移除等操作。' },
                        { href: '/tools/delete-announcement', icon: 'fa-trash-can', color: 'red', title: '删帖公示', desc: '查看近期已被删除的页面记录与相关公示信息。' },
                        { href: '/tools/gallery', icon: 'fa-box-archive', color: 'indigo', title: '全站页面备份', desc: '实时同步各分站页面数据，提供精细化的多维搜索与离线备份，确保数字资产的安全存档。' }
                    ].map((tool) => (
                        <Link 
                            key={tool.href}
                            href={tool.href} 
                            className="bg-white dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group flex flex-col justify-between"
                        >
                            <div className="flex gap-5">
                                <div className={`shrink-0 w-14 h-14 rounded-2xl bg-${tool.color}-50 dark:bg-${tool.color}-500/10 flex items-center justify-center text-${tool.color}-600 dark:text-${tool.color}-400 text-2xl group-hover:scale-110 transition-transform`}>
                                    <i className={`fa-solid ${tool.icon}`}></i>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{tool.title}</h2>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{tool.desc}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}