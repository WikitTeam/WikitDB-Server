/**
 * WikitDB 归属资料独立定时任务
 * 与主爬虫（auto-crawler.js 逐页爬取）完全解耦：
 * 每 30 分钟单独抓取各站点的「归属资料页」+ listpages 页面评分，
 * 同步 author_attributions 表并聚合作者分数（author_score:{site}）。
 */
const cron = require('node-cron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const prisma = require('./lib/prisma');
const config = require('./wikitdb.config.js');
const { fetchAttributionPage, aggregateAuthorScores, normalizePageKey } = require('./utils/attribution');
const { fetchCromSiteRanking, fetchCromSitePages, toCromHttpBase } = require('./utils/crom');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const request = require('axios').create({
    httpAgent,
    httpsAgent,
    timeout: 30000,
    validateStatus: (s) => s >= 200 && s < 400
});

const LOG_FILE = path.join(process.cwd(), 'crawler.log');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function logLine(...args) {
    const line = args.map(String).join(' ');
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, `[${new Date().toLocaleString()}] ${line}\n`, 'utf8');
    } catch (e) { /* 忽略 */ }
}

/** 获取站点全部页面及评分（listpages 分页） */
async function fetchAllPages(siteConfig) {
    const actualWikiName = siteConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
    const baseUrl = siteConfig.URL.replace(/\/$/, '');
    const pages = [];
    let pageNum = 1;
    let totalPages = 1;

    while (true) {
        const res = await request.get(`https://wikit.unitreaty.org/listpages?wiki=${actualWikiName}&p=${pageNum}`);
        const lines = String(res.data).split('\n').map(l => l.trim()).filter(Boolean);

        const totalMatch = lines.find(l => l.startsWith('Total Pages:'))?.match(/(\d+)/);
        if (totalMatch) totalPages = parseInt(totalMatch[1], 10) || 1;

        let countThisPage = 0;
        for (const line of lines) {
            if (!line.startsWith('http')) continue;
            const parts = line.split('|').map(s => s.trim());
            if (parts.length < 6) continue;
            const pageSlug = parts[0].split('/').pop();
            pages.push({
                page: pageSlug,
                title: parts[1] || '',
                rating: parseInt(parts[3], 10) || 0,
                upvotes: parseInt(parts[4], 10) || 0,
                downvotes: parseInt(parts[5], 10) || 0
            });
            countThisPage++;
        }

        if (pageNum >= totalPages || countThisPage === 0) break;
        pageNum++;
        await sleep(400);
    }
    return pages;
}

/** 处理单个站点：抓归属页 + 页面评分 + 聚合作者分数 */
async function processSite(siteConfig) {
    const wikiParam = siteConfig.PARAM;
    const attrRecords = await fetchAttributionPage(siteConfig, request);
    if (attrRecords.length === 0) {
        logLine(`[归属] ${wikiParam} 归属资料页无有效数据，跳过`);
        return;
    }

    // 1. 全量同步归属记录（用于详情页展示作者归属页面列表）
    await prisma.$transaction([
        prisma.authorAttribution.deleteMany({ where: { siteParam: wikiParam } }),
        prisma.authorAttribution.createMany({
            data: attrRecords.map(a => ({ siteParam: wikiParam, page: a.page, username: a.username, type: a.type, date: a.date })),
            skipDuplicates: true
        })
    ]);

    const baseUrl = siteConfig.URL.replace(/\/$/, '');
    const cromEnabled = !!siteConfig.CROM_API;
    const cromHttpBase = cromEnabled ? toCromHttpBase(baseUrl) : '';

    // 2. 对开启 CROM_API 的站点：统一使用 crom 作为权威源
    //      - fetchCromSiteRanking: 作者排行榜 (author_score)
    //      - fetchCromSitePages : 页面评分 + 搜索索引 (page_scores / pages_index)
    //    未开启或 crom 失败：fallback 到 listpages + 归属页聚合
    let cromScores = null;
    let pageScoreRows = null;
    let pagesIndexRows = null;
    let allPages = [];
    let scoreSource = 'attribution';
    let pagesSource = 'listpages';

    if (cromEnabled) {
        // 串行（先排行再页面）+ 保守并发，避免同时触发 crom 服务器限流
        // （crom complexity + 频率检查叠加后，并发跑两边经常被 ban 几十秒）
        try {
            const data = await fetchCromSiteRanking(baseUrl, {
                request,
                endpoint: siteConfig.CROM_API,
                concurrency: 3,
                batchSleepMs: 500,
                onPage: (p) => { if (p.rank % 100 === 1) logLine(`[归属] ${wikiParam} crom 排行 rank=${p.rank} 已得 ${p.fetched} 作者`); }
            });
            if (data && Object.keys(data).length > 0) {
                cromScores = data;
                scoreSource = 'crom';
            }
        } catch (e) {
            logLine(`[归属] ${wikiParam} crom 作者排行失败: ${e.message}`);
        }
        try {
            const data = await fetchCromSitePages(cromHttpBase, {
                request,
                endpoint: siteConfig.CROM_API,
                pageSize: 50,
                batchSleepMs: 300,
                onProgress: (p) => { if (p.pageNum % 10 === 1) logLine(`[归属] ${wikiParam} crom 页面已拉 ${p.pages} 条 (第${p.pageNum}批)`); }
            });
            if (data && data.scores && data.scores.length > 0) {
                pageScoreRows = data.scores;
                pagesIndexRows = data.index;
                pagesSource = 'crom';
            }
        } catch (e) {
            logLine(`[归属] ${wikiParam} crom 页面抓取失败: ${e.message}`);
        }
    }

    // 3. crom 未启用或失败时，fallback 到 listpages 拿页面评分
    if (!pageScoreRows) {
        allPages = await fetchAllPages(siteConfig).catch(e => {
            logLine(`[归属] ${wikiParam} listpages 抓取失败: ${e.message}`);
            return [];
        });
        pageScoreRows = allPages.map(p => ({
            page: p.page, title: p.title, rating: p.rating,
            upvotes: p.upvotes, downvotes: p.downvotes
        }));
    }

    // 4. 保存页面评分（page_scores 用于详情页页面列表）
    if (pageScoreRows && pageScoreRows.length > 0) {
        await prisma.setting.upsert({
            where: { key: `page_scores:${wikiParam}` },
            update: { value: JSON.stringify(pageScoreRows) },
            create: { key: `page_scores:${wikiParam}`, value: JSON.stringify(pageScoreRows) }
        });
    }

    // 4b. 保存搜索索引（crom 源才保存，因为 listpages 不含 component/theme/art 等页，搜索本来就不全；
    //      非 crom 站点仍走 Wikit GraphQL articles 接口）
    if (pagesIndexRows && pagesIndexRows.length > 0) {
        await prisma.setting.upsert({
            where: { key: `pages_index:${wikiParam}` },
            update: { value: JSON.stringify(pagesIndexRows) },
            create: { key: `pages_index:${wikiParam}`, value: JSON.stringify(pagesIndexRows) }
        });
    }

    // 5. 生成 author_score：
    //    优先 crom（含组件/版式/艺术等所有归属页面，与作者页/官方排行一致）；
    //    crom 不可用时 fallback 到归属页 + listpages 聚合。
    let authorScores;
    if (cromScores) {
        authorScores = cromScores;
    } else {
        const pageRatings = new Map();
        for (const pg of (pageScoreRows || [])) pageRatings.set(normalizePageKey(pg.page), { rating: pg.rating });
        authorScores = aggregateAuthorScores(attrRecords, pageRatings);
    }
    await prisma.setting.upsert({
        where: { key: `author_score:${wikiParam}` },
        update: { value: JSON.stringify(authorScores) },
        create: { key: `author_score:${wikiParam}`, value: JSON.stringify(authorScores) }
    });

    logLine(`[归属] ${wikiParam} 归属 ${attrRecords.length} 条 | 页面评分 ${pageScoreRows.length}（来源: ${pagesSource}） | 作者 ${Object.keys(authorScores).length} 位（来源: ${scoreSource}）`);
}

let isRunning = false;

async function runAttribution() {
    if (isRunning) {
        logLine('[归属] 上一轮尚未结束，跳过本次触发');
        return;
    }
    isRunning = true;
    const start = Date.now();
    try {
        const sites = config.SUPPORT_WIKI.filter(w => w.ATTRIBUTION_PAGE);
        logLine(`[归属] 开始执行（${sites.length} 个站点配置了归属资料页）...`);
        for (const siteConfig of sites) {
            try {
                await processSite(siteConfig);
            } catch (e) {
                logLine(`[归属] ${siteConfig.PARAM} 处理失败: ${e.message}`);
            }
        }
        logLine(`[归属] 执行完成，耗时 ${Math.round((Date.now() - start) / 1000)}s`);
    } catch (e) {
        logLine(`[归属] 发生异常: ${e.message}`);
    } finally {
        isRunning = false;
    }
}

// 每 30 分钟执行一次；启动时立即执行一轮
cron.schedule('*/30 * * * *', () => runAttribution());
runAttribution();
