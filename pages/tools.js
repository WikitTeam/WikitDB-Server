import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../wikitdb.config.js');

// 趣味性：资产博弈与随机事件
const FUN_TOOLS = [
    { href: '/tools/gacha', icon: 'fa-box-open', tag: '随机', title: '档案馆盲盒', desc: '消耗资产，在浩瀚的数据中随机抽取未知的页面标的进行投资。' },
    { href: '/tools/author-stock', icon: 'fa-chart-line', tag: '投资', title: '作者概念股', desc: '投资有潜力的创作者，股价走势与近期发文量、存活率深度挂钩。' },
    { href: '/tools/bingo', icon: 'fa-ticket-simple', tag: '赔率', title: '标签大乐透', desc: '消耗扫描凭证，命中特定标签即可赢取最高百倍赔率的奖金。' },
    { href: '/tools/jackpot', icon: 'fa-sack-dollar', tag: '奖池', title: '全站公共彩票池', desc: '全站玩家共同注资的公共奖池，每日随机开奖，瓜分巨额奖金。' },
    { href: '/tools/quality-judge', icon: 'fa-scale-balanced', tag: '多空', title: '页面打新评断', desc: '获取近期最新发布的页面，在信息流中快速做多或做空未来的评分。' },
    { href: '/tools/deathmatch', icon: 'fa-skull-crossbones', tag: '竞猜', title: '收容物斗兽场', desc: '押注两篇随机提取的异常档案，盲猜真实评分高低，赢取双倍返还。' },
    { href: '/tools/bounty', icon: 'fa-scroll', tag: '悬赏', title: '异常档案悬赏令', desc: '全服寻宝任务，寻找符合特定标签与评分组合档案拿走高额赏金。' },
    { href: '/tools/radar', icon: 'fa-crosshairs', tag: '评估', title: '战力雷达评估', desc: '跨站聚合创作者的历史档案，多维度生成雷达图并推算其危险等级。' },
];

// 实用性：站点管理与内容流转
const PRACTICAL_TOOLS = [
    { href: '/tools/ftml-editor', icon: 'fa-code', title: 'FTML 编辑器', desc: '在线编辑 Wikidot 源码，使用 FTML WASM 实时解析并在安全沙箱中预览。' },
    { href: '/tools/wikidot-register', icon: 'fa-user-plus', title: '代注册 Wikidot 账号', desc: '无需翻墙，代为提交 Wikidot 注册请求，只需填写邮箱并完成验证码。' },
    { href: '/tools/save-page', icon: 'fa-file-export', title: '代发页面', desc: '通过 Wikit API 代为向目标站点发布或编辑 Wikidot 页面。' },
    { href: '/tools/delete-announcement', icon: 'fa-trash-can', title: '删帖公示', desc: '查看近期已被删除的页面记录与相关公示信息。' },
    { href: '/tools/membership-apply', icon: 'fa-user-check', title: '批量审批申请', desc: '拉取 Wikidot 站点的待审批成员申请列表，支持批量通过或拒绝。' },
    { href: '/tools/member-admin', icon: 'fa-users-gear', title: '成员管理', desc: '在特定站点对指定成员采取封禁、移除等操作。' },
    { href: '/tools/staff-post-deletion', icon: 'fa-bullhorn', tag: '职员', title: '删帖公示操作', desc: '自动给页面添加「待删除」标签，并在讨论区发布带删除倒计时器的删帖公告。' },
    { href: '/staff-panel', icon: 'fa-user-shield', tag: '职员', title: '职员面板', desc: '审核代发请求，审核通过后由职员登记的机器人发送（仅职员可用）。' },
];

// 分区标题：序号 + 图标 + 名称 + 描述 + 延伸线 + 计数
const SectionHeader = ({ index, icon, title, desc, count, accent }) => (
    <div className="mb-5 flex items-center gap-3">
        <span className={`font-mono text-xs ${accent ? 'text-accent' : 'text-fg-3'}`}>{index}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded text-xs ${accent ? 'bg-accent-soft text-accent' : 'bg-sunken text-fg-2'}`}>
            <i className={`fa-solid ${icon}`}></i>
        </span>
        <h2 className="text-lg font-bold text-fg">{title}</h2>
        <span className="hidden sm:inline text-xs text-fg-3">{desc}</span>
        <div className="h-px flex-1 bg-line"></div>
        <span className="font-mono text-xs text-fg-3">{String(count).padStart(2, '0')}</span>
    </div>
);

export default function Tools() {
    const total = FUN_TOOLS.length + PRACTICAL_TOOLS.length;
    return (
        <div className="py-10">
            <Head><title>工具箱 - {config.SITE_NAME}</title></Head>
            <div className="max-w-5xl mx-auto">
                {/* 页头 */}
                <header className="mb-12 flex items-end justify-between border-b border-line pb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-fg">工具箱</h1>
                        <p className="mt-2 text-sm text-fg-3">WikitDB 的各项扩展功能与实验性应用。</p>
                    </div>
                    <span className="hidden sm:block font-mono text-xs text-fg-3">{total} TOOLS</span>
                </header>

                {/* 趣味性：宽松的双列大卡 */}
                <section>
                    <SectionHeader index="01" icon="fa-dice" title="趣味性" desc="押注、抽奖与随机事件——维基经济的游乐场" count={FUN_TOOLS.length} accent />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {FUN_TOOLS.map((tool) => (
                            <Link
                                key={tool.href}
                                href={tool.href}
                                className="group relative flex items-start gap-4 rounded-lg border border-line bg-panel p-5 transition-colors hover:border-accent-line"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-accent-soft text-xl text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                                    <i className={`fa-solid ${tool.icon}`}></i>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-fg transition-colors group-hover:text-accent">{tool.title}</h2>
                                        <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-[10px] tracking-wider text-accent">{tool.tag}</span>
                                    </div>
                                    <p className="mt-1.5 text-xs leading-relaxed text-fg-3">{tool.desc}</p>
                                </div>
                                <i className="fa-solid fa-arrow-right mt-1 text-xs text-line-strong transition-all group-hover:translate-x-0.5 group-hover:text-accent"></i>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* 实用性：紧凑的三列卡片 */}
                <section className="mt-14">
                    <SectionHeader index="02" icon="fa-screwdriver-wrench" title="实用性" desc="站点管理与内容流转的效率工具" count={PRACTICAL_TOOLS.length} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {PRACTICAL_TOOLS.map((tool) => (
                            <Link
                                key={tool.href}
                                href={tool.href}
                                className="group flex flex-col gap-3 rounded-lg border border-line bg-panel p-4 transition-colors hover:border-line-strong"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-sunken text-fg-2 transition-colors group-hover:text-accent">
                                        <i className={`fa-solid ${tool.icon}`}></i>
                                    </div>
                                    <h2 className="min-w-0 truncate text-sm font-bold text-fg">{tool.title}</h2>
                                    {tool.tag && (
                                        <span className="ml-auto shrink-0 rounded-sm bg-sunken px-1.5 py-0.5 text-[10px] tracking-wider text-fg-3">{tool.tag}</span>
                                    )}
                                </div>
                                <p className="text-xs leading-relaxed text-fg-3">{tool.desc}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
