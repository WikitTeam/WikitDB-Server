import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
const config = require('../wikitdb.config.js');

export default function WraithquestContest() {
    const [activeTab, setActiveTab] = useState('beijing');

    return (
        <>
            <Head>
                <title>2026「寻魍异闻」联动竞赛 - {config.SITE_NAME}</title>
                <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap" rel="stylesheet" />
            </Head>
            <style dangerouslySetInnerHTML={{__html: `
                .contest-page { background: #141414; color: #fefefe; font-family: -apple-system, "Noto Sans SC", sans-serif; line-height: 1.7; }
                .contest-wrap { max-width: 780px; margin: 0 auto; padding: 2rem 1.5rem 4rem; background: #202020; border-left: 1px solid #3a3a3a; border-right: 1px solid #3a3a3a; min-height: 100vh; }
                .contest-page h1 { font-size: 1.6em; border-bottom: 1px solid #84201e; padding-bottom: .4em; margin: 1.8em 0 .8em; color: #fff; }
                .contest-page h2 { font-size: 1.2em; color: #84201e; margin: 1.4em 0 .5em; font-weight: bold; }
                .contest-page a { color: #84201e; }
                .contest-page a:hover { color: #b44; text-decoration: underline; }
                .contest-page table { width: 100%; border-collapse: collapse; margin: .8em 0; font-size: .92em; }
                .contest-page th, .contest-page td { border: 1px solid #3a3a3a; padding: .55em .8em; }
                .contest-page th { background: #282828; font-weight: 600; text-align: left; }
                .contest-page ul { padding-left: 1.4em; margin: .5em 0; }
                .contest-page li { margin-bottom: .35em; font-size: .92em; color: #ddd; }
                .contest-page .sub { color: #a29a9b; font-size: .85em; }
                .contest-page pre { background: #181818; border: 1px solid #3a3a3a; padding: 1em; border-radius: 4px; overflow-x: auto; font-size: .85em; color: #cfc; }
                .contest-page code { background: #181818; padding: .15em .4em; border-radius: 3px; font-size: .9em; }
                .contest-page .tabs { display: flex; border-bottom: 1px solid #3a3a3a; margin-bottom: .8em; }
                .contest-page .tab { padding: .5em 1.2em; cursor: pointer; color: #a29a9b; border-bottom: 2px solid transparent; margin-bottom: -1px; }
                .contest-page .tab.active { color: #fefefe; border-bottom-color: #84201e; }
                .contest-page .banner { text-align: center; margin-bottom: 2em; }
                .contest-page .banner img { max-width: 100%; height: auto; }
                .contest-page .orgs { display: flex; align-items: center; justify-content: center; gap: 1.5em; margin: 1.2em 0; font-size: 1.1em; }
                .contest-page .literary { font-family: "Noto Serif SC", serif; line-height: 2; color: #ddd; margin: 1em 0; }
                .contest-page .footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #3a3a3a; font-size: .8em; color: #a29a9b; }
                .contest-page .back { color: #a29a9b; font-size: .9em; display: inline-block; margin-bottom: 1.5em; text-decoration: none; }
                .contest-page .back:hover { color: #fff; }
            `}} />
            <div className="contest-page">
                <div className="contest-wrap">
                    <Link href="/" className="back">← 返回主页</Link>

                    <div className="banner">
                        <img src="https://oxygennine.wikidot.com/local--files/component:2026wraithquest-theme/2026sytitle.png" alt="2026寻魍异闻" />
                        <p className="sub">二〇二六联动竞赛</p>
                    </div>

                    <h1>竞赛日程</h1>
                    <div className="tabs">
                        <div className={`tab ${activeTab === 'beijing' ? 'active' : ''}`} onClick={() => setActiveTab('beijing')}>北京时间</div>
                        <div className={`tab ${activeTab === 'local' ? 'active' : ''}`} onClick={() => setActiveTab('local')}>当地时间</div>
                    </div>
                    {activeTab === 'beijing' ? (
                        <table><tbody>
                            <tr><td>投稿开始</td><td>2026年06月10日 00时00分 (GMT+08)</td></tr>
                            <tr><td>投稿截止</td><td>2026年07月15日 00时00分 (GMT+08)</td></tr>
                            <tr><td>评分截止</td><td>2026年07月24日 23时59分 (GMT+08)</td></tr>
                        </tbody></table>
                    ) : (
                        <table><tbody>
                            <tr><td>投稿开始</td><td>09 Jun 2026 16:00</td></tr>
                            <tr><td>投稿截止</td><td>14 Jul 2026 16:00</td></tr>
                            <tr><td>评分截止</td><td>24 Jul 2026 15:59</td></tr>
                        </tbody></table>
                    )}

                    <h1>联合举办</h1>
                    <div className="orgs">
                        <a href="https://rule-wiki.wikidot.com/" target="_blank" rel="noopener noreferrer">规则怪谈档案馆</a>
                        <span style={{color:'#666'}}>×</span>
                        <a href="https://cas-wiki-cn.wikidot.com/" target="_blank" rel="noopener noreferrer">中华异学会</a>
                    </div>
                    <p className="literary">礼法之外，别有异谭。一方沉于古卷残册，深耕怪诞法则的辨识与归档；另一方周旋于近世异象，志在搜罗天下奇诡。二者虽殊途，却同归于怪力乱神之域，所涉鬼魅妖氛，多有交叠。今值良辰，两馆携手设局，以「寻魍异闻」为题，广邀同好落笔竞逐。凡涉魍魉之异闻传说，咸待君子访而录之。</p>

                    <h1>参赛作品</h1>
                    <table>
                        <thead><tr><th>作品名称</th><th>评分</th><th>作者</th></tr></thead>
                        <tbody><tr><td colSpan="3" style={{textAlign:'center',color:'#a29a9b'}}>投稿尚未开始</td></tr></tbody>
                    </table>

                    <h1>奖品清单</h1>
                    <table>
                        <thead><tr><th>名次</th><th>现金奖励</th><th>其他奖品</th></tr></thead>
                        <tbody>
                            <tr><td>🥇 第一名</td><td>300元人民币</td><td>纸嫁衣3鸳鸯债游戏实体×1 + 亲笔信</td></tr>
                            <tr><td>🥈 第二名</td><td>200元人民币</td><td>亲笔信 + BiliBili月度大会员×1</td></tr>
                            <tr><td>🥉 第三名</td><td>100元人民币</td><td>亲笔信</td></tr>
                            <tr><td>⭐ 各参赛站点第一名</td><td>20元人民币</td><td>—</td></tr>
                        </tbody>
                    </table>
                    <p className="sub">亲笔信由主办委员会手写，以文件形式寄送，不可折现。BiliBili大会员通过官方激活码发放，不可折现。⭐获奖者须来自不同站点，同一人不重复领奖。领奖期限为奖品开放后6天内，逾期未领取的现金奖励由各站自行处理。</p>

                    <h1>投稿教程</h1>
                    <p>本次竞赛使用新版跨站评分组件。请在参赛页面源码的<strong>最顶部</strong>添加以下代码：</p>
                    <pre>{`[[include :syndication:component:2026wraithquest\n| preview=（可选）添加文章内容概要，将在中心页显示。\n]]`}</pre>
                    <p className="sub">该组件已内置跨站评分功能，无需额外添加 <code>[[module Rate]]</code>，也无需使用 <code>[[&gt;]]</code> 进行右对齐。版式定制需求请联系 lestday233。</p>
                    <p style={{marginTop:'1em'}}>在页面底部工具栏选择 Tags，添加标签 <code>2026联动竞赛</code> 并保存。各参赛站点可能有额外的标签要求，请留意各站公告。</p>

                    <h1>竞赛规则</h1>

                    <h2>【基础规则】</h2>
                    <ul>
                        <li>参赛者不得有作弊记录，不得处于联动中转站（syndication.wikidot.com）的封禁状态。</li>
                        <li>参赛者须遵守通用安全规约及各站站规，严禁作弊行为及扰乱竞赛秩序。</li>
                    </ul>

                    <h2>【发布规则】</h2>
                    <ul>
                        <li>参赛作品仅可投稿至一个参赛站点，且须正确使用竞赛组件和标签。禁止多站投稿、预发布。</li>
                        <li>每位作者最多可提交3篇参赛作品，超出部分将被取消参赛资格。</li>
                        <li>代发或匿名投稿需提前联系对应站点工作人员。</li>
                        <li>因触及红线被取消资格者，不可重新参赛。</li>
                    </ul>

                    <h2>【作品规则】</h2>
                    <ul>
                        <li>竞赛接受文章及美术作品投稿；作品须契合「寻魍异闻」主题<sup>注</sup>；不限体裁。</li>
                        <li>禁止成人内容。允许同站合著、跨站合著以及同一作者向不同站点投递不同作品；禁止将相同作品投至多个站点。</li>
                        <li>参赛作品不可同时参加其他竞赛活动。</li>
                        <li>作品必须原创，禁止抄袭、洗稿或重复使用旧作。禁止使用AI生成文本；允许适度且合理地使用AI生成的媒体素材。</li>
                        <li>作品发布后禁止进行大幅修改（站点低分/重写流程除外）。</li>
                        <li>评分截止前，作者不可在其他页面中链接自己的参赛作品（ListPages模块及Wikiwalk链接除外）。</li>
                    </ul>
                    <p className="sub">注：「寻魍异闻」——寻找和鬼有关的故事，即和鬼有关的点子都行。</p>

                    <h2>【评分规则】</h2>
                    <ul>
                        <li>排名基于跨站评分组件所显示的净分数。</li>
                        <li>黄线：分数低于+2时触发警告。</li>
                        <li>红线：分数低于-2时触发48小时倒计时，若到期仍未恢复则作品移除。</li>
                        <li>最终统计时处于黄线/红线阈值及以下的作品不可领取奖品，但仍计入排名。</li>
                        <li>严禁恶意投票、使用小号、拉票及任何形式的刷分行为。</li>
                    </ul>

                    <h2>【其他规则】</h2>
                    <ul>
                        <li>竞赛工作人员及各站点代表享有正常参赛资格。</li>
                        <li>本规则最终解释权归主办委员会所有。</li>
                    </ul>

                    <h1>赛事主办</h1>
                    <p><strong>竞赛管理：</strong>umou、lestday233、Christopher E Leign</p>
                    <p><strong>财务管理：</strong>umou、Ueis</p>
                    <p><strong>赛事裁判：</strong>lestday233、umou、luxueling</p>
                    <p className="sub" style={{marginTop:'1em'}}>完整工作人员名单：<a href="https://syndication.wikidot.com/2026wraithquest-staff" target="_blank" rel="noopener noreferrer">syndication.wikidot.com/2026wraithquest-staff</a><br/>各站信息：<a href="https://syndication.wikidot.com/2026wraithquest-wikiinfo" target="_blank" rel="noopener noreferrer">syndication.wikidot.com/2026wraithquest-wikiinfo</a></p>

                    <div className="footer">
                        <p><strong>授权信息</strong></p>
                        <p>本页内容转载自 <a href="https://rule-wiki.wikidot.com/2026wraithquest-contest" target="_blank" rel="noopener noreferrer">rule-wiki.wikidot.com/2026wraithquest-contest</a>，依据 CC BY-SA 3.0 协议。</p>
                        <p>版式「2026联动竞赛 版式」by OxygenNine，lestday233 编辑，CC BY-SA 3.0，衍生自「平行 版式」。</p>
                        <p>规则怪谈档案馆 图标 by Dr Talcite，CC BY-SA 3.0。中华异学会 图标 by Enflowerz，CC BY-SA 3.0。</p>
                    </div>
                </div>
            </div>
        </>
    );
}