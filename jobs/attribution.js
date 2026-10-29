/**
 * 归属资料同步。按站点、按清单页切片，避免一次函数调用爬完整站。
 * 调度间隔 30 分钟：一轮跑完后游标进入 idle，到期再开下一轮。
 */
const http = require('http');
const https = require('https');
const prisma = require('../lib/prisma');
const { loadEffectiveConfig } = require('../utils/siteConfig');
const { fetchAttributionPage, aggregateAuthorScores, normalizePageKey } = require('../utils/attribution');
const { appendJobLogs } = require('../utils/jobLog');
const { withJobLock } = require('../utils/jobLock');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const request = require('axios').create({
    httpAgent,
    httpsAgent,
    timeout: 30000,
    validateStatus: (s) => s >= 200 && s < 400,
});

const INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_BUDGET_MS = 45 * 1000;
const CURSOR_KEY = 'attribution:cursor';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logBuffer = [];

function logLine(...args) {
    const line = args.map(String).join(' ');
    console.log(line);
    logBuffer.push(`[${new Date().toLocaleString()}] ${line}`);
}

async function flushLogs() {
    if (logBuffer.length === 0) return;
    const lines = logBuffer.splice(0, logBuffer.length);
    await appendJobLogs('crawler', lines);
}

function normalize(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        try { return JSON.parse(value); } catch (e) { return null; }
    }
    return value;
}

function wikiHost(siteConfig) {
    return siteConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
}

async function fetchListPage(cursor, siteConfig) {
    const res = await request.get(`https://wikit.unitreaty.org/listpages?wiki=${wikiHost(siteConfig)}&p=${cursor.listPage}`);
    const lines = String(res.data).split('\n').map((l) => l.trim()).filter(Boolean);
    const totalMatch = lines.find((l) => l.startsWith('Total Pages:'))?.match(/(\d+)/);
    if (totalMatch) cursor.totalPages = parseInt(totalMatch[1], 10) || 1;
    let countThisPage = 0;
    for (const line of lines) {
        if (!line.startsWith('http')) continue;
        const parts = line.split('|').map((s) => s.trim());
        if (parts.length < 6) continue;
        cursor.pages.push({
            page: parts[0].split('/').pop(),
            title: parts[1] || '',
            rating: parseInt(parts[3], 10) || 0,
            upvotes: parseInt(parts[4], 10) || 0,
            downvotes: parseInt(parts[5], 10) || 0,
        });
        countThisPage++;
    }
    if (cursor.listPage >= cursor.totalPages || countThisPage === 0) cursor.phase = 'commit';
    else cursor.listPage += 1;
}

async function commitSite(cursor, siteConfig) {
    const wikiParam = siteConfig.PARAM;
    const attrRecords = cursor.records || [];
    await prisma.$transaction([
        prisma.authorAttribution.deleteMany({ where: { siteParam: wikiParam } }),
        prisma.authorAttribution.createMany({
            data: attrRecords.map((a) => ({
                siteParam: wikiParam,
                page: a.page,
                username: a.username,
                type: a.type,
                date: a.date,
            })),
            skipDuplicates: true,
        }),
    ]);
    const pageScoreRows = (cursor.pages || []).map((p) => ({
        page: p.page, title: p.title, rating: p.rating, upvotes: p.upvotes, downvotes: p.downvotes,
    }));
    await prisma.setting.upsert({
        where: { key: `page_scores:${wikiParam}` },
        update: { value: pageScoreRows },
        create: { key: `page_scores:${wikiParam}`, value: pageScoreRows },
    });
    const pageRatings = new Map();
    for (const pg of cursor.pages || []) pageRatings.set(normalizePageKey(pg.page), { rating: pg.rating });
    const authorScores = aggregateAuthorScores(attrRecords, pageRatings);
    await prisma.setting.upsert({
        where: { key: `author_score:${wikiParam}` },
        update: { value: authorScores },
        create: { key: `author_score:${wikiParam}`, value: authorScores },
    });
    logLine(`[归属] ${wikiParam} 归属 ${attrRecords.length} 条 | 页面评分 ${pageScoreRows.length} | 作者 ${Object.keys(authorScores).length} 位`);
}

async function runAttributionSlice(opts = {}) {
    const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : DEFAULT_BUDGET_MS;
    const started = Date.now();
    const over = () => Date.now() - started >= budgetMs;

    return withJobLock('attribution', budgetMs + 30 * 1000, async () => {
        const sites = (((await loadEffectiveConfig()).SUPPORT_WIKI) || []).filter((w) => w.ATTRIBUTION_PAGE);
        if (sites.length === 0) return { skipped: true, reason: 'no-sites' };

        let cursor = normalize((await prisma.setting.findUnique({ where: { key: CURSOR_KEY } }))?.value);
        if (!cursor || cursor.phase === 'idle') {
            if (cursor && cursor.nextCycleAt && Date.now() < cursor.nextCycleAt && !opts.force) {
                return { skipped: true, reason: 'cooldown', nextCycleAt: cursor.nextCycleAt };
            }
            logLine(`[归属] 开始执行（${sites.length} 个站点配置了归属资料页）...`);
            cursor = { phase: 'fetch', siteIndex: 0, listPage: 1, totalPages: 1, pages: [], records: [], nextCycleAt: 0 };
        }

        try {
            while (!over()) {
                if (cursor.siteIndex >= sites.length) {
                    cursor = { phase: 'idle', siteIndex: 0, pages: [], records: [], nextCycleAt: Date.now() + INTERVAL_MS };
                    await prisma.setting.upsert({
                        where: { key: CURSOR_KEY },
                        update: { value: cursor },
                        create: { key: CURSOR_KEY, value: cursor },
                    });
                    logLine('[归属] 本轮执行完成。');
                    await flushLogs();
                    return { done: true, phase: 'idle' };
                }

                const siteConfig = sites[cursor.siteIndex];
                if (cursor.phase === 'fetch') {
                    cursor.records = await fetchAttributionPage(siteConfig, request);
                    cursor.pages = [];
                    cursor.listPage = 1;
                    cursor.totalPages = 1;
                    if (!cursor.records || cursor.records.length === 0) {
                        logLine(`[归属] ${siteConfig.PARAM} 归属资料页无有效数据，跳过`);
                        cursor.siteIndex += 1;
                        cursor.phase = 'fetch';
                    } else {
                        cursor.phase = 'list';
                    }
                } else if (cursor.phase === 'list') {
                    await fetchListPage(cursor, siteConfig);
                    await sleep(200);
                } else if (cursor.phase === 'commit') {
                    await commitSite(cursor, siteConfig);
                    cursor.siteIndex += 1;
                    cursor.phase = 'fetch';
                    cursor.pages = [];
                    cursor.records = [];
                }

                await prisma.setting.upsert({
                    where: { key: CURSOR_KEY },
                    update: { value: cursor },
                    create: { key: CURSOR_KEY, value: cursor },
                });
            }
        } catch (e) {
            logLine(`[归属] ${sites[cursor.siteIndex] ? sites[cursor.siteIndex].PARAM : '?'} 处理失败: ${e.message}`);
            await flushLogs();
            return { done: false, error: e.message, phase: cursor.phase, siteIndex: cursor.siteIndex };
        }

        await flushLogs();
        return { done: false, phase: cursor.phase, siteIndex: cursor.siteIndex, listPage: cursor.listPage };
    });
}

module.exports = { runAttributionSlice, INTERVAL_MS };
