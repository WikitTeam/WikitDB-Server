/**
 * crom 排行榜接口客户端
 * crom 是 SCP 系 wikidot 站点通用的归属元数据 + 评分聚合服务（如 backrooms-wiki-cn），
 * 相比 wikit listpages（不收录 component/theme/art 等非文章页），crom 统计包含
 * 全部归属于作者的页面，分数与作者页/官方排行一致。
 *
 * 接口：https://api.crom.avn.sh/graphql
 *   usersByRank(rank: Int!, filter: {anyBaseUrl: [String!]!}): [User]
 *   user.statistics(baseUrl: String): { rank, totalRating, meanRating, pageCount, ... }
 */

const DEFAULT_CROM_API = 'https://api.crom.avn.sh/graphql';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * crom 内部存储部分站点 URL 使用 http://（如 backrooms-wiki-cn）而非 https。
 * pages filter/anyBaseUrl 精确匹配字符串，不会自动做 http/https 归一。
 * 此函数接受站点配置 URL（通常 https）并返回「crom 实际使用的 http base」（去掉末尾 /，替换为 http://）。
 * @param {string} configUrl 配置中的 URL，如 "https://backrooms-wiki-cn.wikidot.com/"
 * @returns {string} http base，如 "http://backrooms-wiki-cn.wikidot.com"
 */
function toCromHttpBase(configUrl) {
    const u = String(configUrl || '').replace(/\/+$/, '');
    return u.replace(/^https:/, 'http:');
}

function slugFromCromUrl(url) {
    const s = String(url || '');
    const idx = s.lastIndexOf('/');
    return (idx >= 0 ? s.slice(idx + 1) : s);
}

/**
 * 拉取某站点 crom 全量作者排行（含 score/pages/average/rank）。
 * 输出与 utils/attribution.js#aggregateAuthorScores 同构：
 *   { [username小写]: { name, score, pages, average, rank } }
 *
 * @param {string} baseUrl 站点 base URL，如 "https://backrooms-wiki-cn.wikidot.com"
 * @param {object} opts
 * @param {import('axios').AxiosInstance} [opts.request] 自定义 axios 实例
 * @param {string} [opts.endpoint] crom GraphQL 端点
 * @param {number} [opts.maxRank] 最大遍历排名（默认 2000，保护性上限）
 * @param {number} [opts.concurrency] 并发批次大小（每批同时请求 N 个 rank）
 * @param {number} [opts.batchSleepMs] 每批之间等待毫秒
 * @param {(progress:{fetched:number, rank:number}) => void} [opts.onPage] 进度回调
 * @returns {Promise<object>} { [username小写]: { name, score, pages, average, rank } }
 */
async function fetchCromSiteRanking(baseUrl, opts = {}) {
    const request = opts.request || require('axios').create({ timeout: 30000 });
    const endpoint = opts.endpoint || DEFAULT_CROM_API;
    const maxRank = opts.maxRank || 2000;
    const concurrency = Math.max(1, Math.min(opts.concurrency || 8, 16));
    const batchSleepMs = opts.batchSleepMs || 100;

    const statFragment = (url) => `statistics(baseUrl: "${url}") { rank totalRating meanRating pageCount }`;
    const userFields = (url) => `name wikidotInfo { unixName displayName wikidotId } ${statFragment(url)}`;

    const result = {};
    let rank = 1;
    let consecutiveEmpty = 0;

    const throttleRe = /too often|rate.?limit|Please wait for/i;
    while (rank <= maxRank) {
        // 取一批 rank 并发
        const batch = [];
        for (let i = 0; i < concurrency && rank + i <= maxRank; i++) {
            const r = rank + i;
            const query = `{ usersByRank(rank: ${r}, filter: {anyBaseUrl: ["${baseUrl}"]}) { ${userFields(baseUrl)} } }`;
            batch.push(
                (async () => {
                    // 单请求最多重试 3 次，遇限流按建议时间等待
                    for (let att = 0; att < 3; att++) {
                        try {
                            const res = await request.post(endpoint, { query }, { validateStatus: () => true });
                            if (!res.data || !res.data.data || res.data.errors) {
                                const errTxt = res && res.data && res.data.errors ? JSON.stringify(res.data.errors) : '';
                                if (throttleRe.test(errTxt)) {
                                    const m = errTxt.match(/wait for (\d+) seconds?/i);
                                    const waitSec = m ? parseInt(m[1], 10) : 30;
                                    await sleep((waitSec + 5) * 1000);
                                    continue;
                                }
                                return { r, users: [] };
                            }
                            return { r, users: res.data.data.usersByRank || [] };
                        } catch (e) {
                            await sleep(1500);
                        }
                    }
                    return { r, users: [] };
                })()
            );
        }
        const responses = await Promise.all(batch);
        let newThisBatch = 0;
        let maxRankReturned = 0;
        for (const { r, users } of responses) {
            for (const u of users) {
                const s = u.statistics || {};
                const key = String(u.wikidotInfo && u.wikidotInfo.unixName || u.name || '').toLowerCase();
                if (!key) continue;
                // 跳过已删除用户
                if (/user.?deleted/i.test(u.name)) continue;
                const pages = s.pageCount || 0;
                // 跳过在本站无页面的用户（crom 可能返回跨站排名但本站 0 页的条目）
                if (pages === 0) continue;
                const score = s.totalRating || 0;
                const average = pages ? Math.round((score / pages) * 100) / 100 : 0;
                if (!result[key]) newThisBatch++;
                result[key] = {
                    name: u.name,
                    score: Math.round(score * 100) / 100,
                    pages,
                    average,
                    rank: s.rank || r,
                    wikidotId: u.wikidotInfo && u.wikidotInfo.wikidotId != null ? String(u.wikidotInfo.wikidotId) : null,
                    unixName: u.wikidotInfo && u.wikidotInfo.unixName ? u.wikidotInfo.unixName : key
                };
                if ((s.rank || r) > maxRankReturned) maxRankReturned = (s.rank || r);
            }
        }
        if (typeof opts.onPage === 'function') {
            opts.onPage({ fetched: Object.keys(result).length, rank });
        }
        if (newThisBatch === 0) {
            consecutiveEmpty++;
            // 连续 3 批无新作者，说明已超过末位，结束
            if (consecutiveEmpty >= 3) break;
        } else {
            consecutiveEmpty = 0;
        }
        rank += concurrency;
        if (batchSleepMs) await sleep(batchSleepMs);
    }

    return result;
}

/**
 * 查询单个作者在某站点的统计（用于详情页实时校验或补丁）。
 * @param {string} username
 * @param {string} baseUrl
 * @param {object} [opts]
 * @returns {Promise<{name:string, score:number, pages:number, average:number, rank:number, wikidotId:string|null, unixName:string}|null>}
 */
async function fetchCromUserStats(username, baseUrl, opts = {}) {
    const request = opts.request || require('axios').create({ timeout: 20000 });
    const endpoint = opts.endpoint || DEFAULT_CROM_API;
    const query = `{ user(name: ${JSON.stringify(username)}) { name wikidotInfo { unixName wikidotId } statistics(baseUrl: ${JSON.stringify(baseUrl)}) { rank totalRating meanRating pageCount } } }`;
    try {
        const res = await request.post(endpoint, { query }, { validateStatus: () => true });
        if (!res.data || res.data.errors || !res.data.data || !res.data.data.user) return null;
        const u = res.data.data.user;
        const s = u.statistics || {};
        const pages = s.pageCount || 0;
        const score = s.totalRating || 0;
        const average = pages ? Math.round((score / pages) * 100) / 100 : 0;
        const info = u.wikidotInfo || {};
        return {
            name: u.name,
            score: Math.round(score * 100) / 100,
            pages,
            average,
            rank: s.rank || 0,
            wikidotId: info.wikidotId != null ? String(info.wikidotId) : null,
            unixName: info.unixName || null
        };
    } catch (e) {
        return null;
    }
}

/**
 * 拉取某站点 crom 全量页面（含标题、评分、分类、标签、创建时间）。
 * 适用于页面评分缓存、站内搜索索引构建。
 *
 * 输出分为两种格式：
 *   scores:  [{ page, title, rating, upvotes, downvotes }]   ← 兼容 page_scores:{site}
 *   index:   [{ page, title, rating, category, tags, createdAt }]   ← 用于搜索
 *
 * @param {string} httpBase crom 内部用的 http base，可通过 toCromHttpBase(configUrl) 得到
 * @param {object} opts
 * @returns {Promise<{scores: Array, index: Array}>}
 */
async function fetchCromSitePages(httpBase, opts = {}) {
    const request = opts.request || require('axios').create({ timeout: 60000 });
    const endpoint = opts.endpoint || DEFAULT_CROM_API;
    // crom complexity 上限 600，字段越多 per-page 成本越高
    // 实测 first=50 OK（complexity<600），first=60 以上开始超
    const pageSize = opts.pageSize || 50;
    const maxPages = opts.maxPages || 2000; // 保护性上限 10 万页
    const batchSleepMs = opts.batchSleepMs || 100;

    const scores = [];
    const index = [];
    let cursor = null;
    let pageNum = 0;
    let throttles = 0;
    const THROTTLE_RETRY_MAX = 8;
    while (pageNum < maxPages) {
        const after = cursor ? `after: ${JSON.stringify(cursor)},` : '';
        const query = `{ pages(first: ${pageSize}, ${after} filter: {url: {startsWith: ${JSON.stringify(httpBase + '/')}}}) { edges { node { url wikidotInfo { title category rating voteCount tags createdAt } } cursor } pageInfo { endCursor hasNextPage } } }`;
        let res;
        let attempt = 0;
        const MAX_ATTEMPTS = 3;
        while (attempt < MAX_ATTEMPTS) {
            attempt++;
            try {
                res = await request.post(endpoint, { query }, { validateStatus: () => true });
            } catch (e) {
                res = null;
            }
            // 识别限流：GraphQL error 中包含 "requests too often" / "Please wait for N seconds"
            const errs = res && res.data && res.data.errors;
            const errTxt = errs ? JSON.stringify(errs) : '';
            if (/too often|rate.?limit|Please wait for/i.test(errTxt)) {
                const waitMatch = errTxt.match(/wait for (\d+) seconds?/i);
                const waitSec = waitMatch ? parseInt(waitMatch[1], 10) : 30;
                throttles++;
                if (throttles >= THROTTLE_RETRY_MAX) {
                    throw new Error('crom pages 连续触发限流，已放弃');
                }
                await sleep((waitSec + 5) * 1000);
                continue; // 重试（不消耗 attempt）
            }
            if (errs && attempt < MAX_ATTEMPTS) {
                await sleep(2000 * attempt);
                continue;
            }
            break;
        }
        if (!res || !res.data || res.data.errors || !res.data.data || !res.data.data.pages) {
            const errs = res && res.data && res.data.errors;
            throw new Error('crom pages 请求失败: ' + (errs ? JSON.stringify(errs).slice(0, 300) : '无数据'));
        }
        const conn = res.data.data.pages;
        const edges = conn.edges || [];
        for (const e of edges) {
            const node = e.node || {};
            const info = node.wikidotInfo || {};
            const page = slugFromCromUrl(node.url);
            if (!page) continue;
            const rating = typeof info.rating === 'number' ? info.rating : 0;
            const voteCount = typeof info.voteCount === 'number' ? info.voteCount : 0;
            // rating = up - down; voteCount = up + down; 反推上下票数
            const up = Math.round((voteCount + rating) / 2);
            const down = Math.round((voteCount - rating) / 2);
            scores.push({
                page,
                title: info.title || page,
                rating,
                upvotes: isNaN(up) ? 0 : Math.max(0, up),
                downvotes: isNaN(down) ? 0 : Math.max(0, down)
            });
            index.push({
                page,
                title: info.title || page,
                rating,
                category: info.category || '_default',
                tags: info.tags || [],
                createdAt: info.createdAt || ''
            });
        }
        if (typeof opts.onProgress === 'function') {
            opts.onProgress({ pages: index.length, pageNum: pageNum + 1, batchSize: edges.length });
        }
        const hasNext = conn.pageInfo && conn.pageInfo.hasNextPage;
        cursor = conn.pageInfo && conn.pageInfo.endCursor;
        pageNum++;
        if (!hasNext || edges.length === 0 || !cursor) break;
        if (batchSleepMs) await sleep(batchSleepMs);
    }
    return { scores, index };
}

/**
 * 用 crom searchPages 按关键字搜索某站点页面（用于在线搜索接口的快速第一页）。
 * searchPages 结果数量有限（无分页），适合直接展示；若不够用可结合 pages_index 做本地二次匹配。
 */
async function searchCromPages(keyword, httpBase, opts = {}) {
    const request = opts.request || require('axios').create({ timeout: 20000 });
    const endpoint = opts.endpoint || DEFAULT_CROM_API;
    const kw = String(keyword || '').trim();
    if (!kw) return [];
    const query = `{ searchPages(query: ${JSON.stringify(kw)}, filter: {anyBaseUrl: [${JSON.stringify(httpBase)}]}) { url wikidotInfo { title category rating createdAt tags } } }`;
    try {
        const res = await request.post(endpoint, { query }, { validateStatus: () => true });
        if (!res.data || res.data.errors || !res.data.data) return [];
        const arr = res.data.data.searchPages || [];
        return arr.map(n => {
            const info = n.wikidotInfo || {};
            return {
                page: slugFromCromUrl(n.url),
                title: info.title || slugFromCromUrl(n.url),
                rating: info.rating || 0,
                category: info.category || '_default',
                tags: info.tags || [],
                createdAt: info.createdAt || ''
            };
        });
    } catch (e) {
        return [];
    }
}

module.exports = {
    fetchCromSiteRanking,
    fetchCromUserStats,
    fetchCromSitePages,
    searchCromPages,
    toCromHttpBase,
    slugFromCromUrl,
    DEFAULT_CROM_API
};
