/**
 * 站点配置。
 * 仓库里的 wikitdb.config.js 是默认值（会打进部署包）。
 * 管理后台的改动写入 settings.site:config，无服务器实例没有可写磁盘时也能生效。
 * 磁盘可写时仍会尝试刷新文件，方便自建虚拟机沿用原来的工作流。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CONFIG_FILENAME = 'wikitdb.config.js';
const CONFIG_KEY = 'site:config';

function getConfigPath() {
    return path.join(process.cwd(), CONFIG_FILENAME);
}

function loadSiteConfigFromFile() {
    const filePath = getConfigPath();
    const source = fs.readFileSync(filePath, 'utf8');
    const sandbox = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(source, sandbox, { filename: filePath, timeout: 2000 });
    const cfg = sandbox.module.exports || {};
    if (!Array.isArray(cfg.SUPPORT_WIKI)) cfg.SUPPORT_WIKI = [];
    return cfg;
}

/** 同步读取磁盘配置。已打包的页面仍直接 require 该文件。 */
function loadSiteConfig() {
    return loadSiteConfigFromFile();
}

function normalizeStored(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        try { return JSON.parse(value); } catch (e) { return null; }
    }
    return value;
}

/** 数据库覆盖优先，没有记录或数据库不可用时退回文件。 */
async function loadEffectiveConfig() {
    const fileCfg = loadSiteConfigFromFile();
    try {
        const prisma = require('../lib/prisma');
        const row = await prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
        const stored = normalizeStored(row && row.value);
        if (stored && Array.isArray(stored.SUPPORT_WIKI)) {
            return {
                ...fileCfg,
                ...stored,
                SUPPORT_WIKI: stored.SUPPORT_WIKI,
            };
        }
    } catch (e) { /* 构建期或未连上数据库时用文件 */ }
    return fileCfg;
}

function invalidateConfigCache() {
    try {
        const resolved = require.resolve(getConfigPath());
        if (resolved) delete require.cache[resolved];
    } catch (e) { /* 打包环境中可能无法解析，忽略 */ }
}

function buildConfigFileContent(config) {
    const lines = [];
    lines.push('module.exports = {');
    lines.push(`    SITE_NAME: ${JSON.stringify(config.SITE_NAME || 'WikitDB')},`);
    lines.push(`    SITE_URL: ${JSON.stringify(config.SITE_URL || '')},`);
    lines.push(`    SITE_SINCE: ${JSON.stringify(config.SITE_SINCE || '2026')},`);
    lines.push(`    SITE_AUTHOR: ${JSON.stringify(config.SITE_AUTHOR || 'WikitDB Team')},`);
    lines.push('    SUPPORT_WIKI: [');
    lines.push('        /*站点格式');
    lines.push('        {');
    lines.push('            NAME: "站点名称",');
    lines.push('            URL: "站点链接",');
    lines.push('            ImgURL: "Logo链接",');
    lines.push('            PARAM: "简写",');
    lines.push('            WIKIT_ID: "Wikit站点里写的站点名称，这里用于筛选作者的站点页面",');
    lines.push('            GQL_API: "可选，自定义GraphQL端点，不填则默认 https://wikit.unitreaty.org/apiv1/graphql",');
    lines.push('            ATTRIBUTION_PAGE: "可选，站点归属资料页面路径（如 attribution-metadata），爬虫抓取其作者归属与分数分配",');
    lines.push('        },');
    lines.push('        */');
    for (const site of config.SUPPORT_WIKI || []) {
        lines.push(`        ${JSON.stringify(site)},`);
    }
    lines.push('    ]');
    lines.push('};');
    return lines.join('\n') + '\n';
}

async function saveSiteConfig(config) {
    const payload = {
        SITE_NAME: config.SITE_NAME || 'WikitDB',
        SITE_URL: config.SITE_URL || '',
        SITE_SINCE: config.SITE_SINCE || '2026',
        SITE_AUTHOR: config.SITE_AUTHOR || 'WikitDB Team',
        SUPPORT_WIKI: config.SUPPORT_WIKI || [],
    };
    const prisma = require('../lib/prisma');
    await prisma.setting.upsert({
        where: { key: CONFIG_KEY },
        update: { value: payload },
        create: { key: CONFIG_KEY, value: payload },
    });
    try {
        fs.writeFileSync(getConfigPath(), buildConfigFileContent(payload), 'utf8');
        invalidateConfigCache();
    } catch (e) {
        if (e.code !== 'EROFS' && e.code !== 'EACCES' && e.code !== 'EPERM' && e.code !== 'ENOENT') throw e;
    }
    return payload;
}

function isHttpUrl(value) {
    if (!value) return false;
    try {
        const u = new URL(String(value).trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

function validateSite(input) {
    input = input || {};
    const site = {};

    site.NAME = String(input.NAME || '').trim();
    if (!site.NAME) return { error: '站点名称 (NAME) 不能为空' };
    if (site.NAME.length > 100) return { error: '站点名称不能超过 100 个字符' };

    site.URL = String(input.URL || '').trim();
    if (!isHttpUrl(site.URL)) return { error: '站点 URL 必须是有效的 http(s) 链接' };

    site.PARAM = String(input.PARAM || '').trim();
    if (!/^[A-Za-z0-9_-]{1,30}$/.test(site.PARAM)) {
        return { error: 'PARAM 只能包含字母、数字、下划线和连字符（1-30 位），如 dfc' };
    }

    site.WIKIT_ID = String(input.WIKIT_ID || '').trim();
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(site.WIKIT_ID)) {
        return { error: 'WIKIT_ID 只能包含字母、数字、点、下划线和连字符（1-80 位）' };
    }

    if (input.ImgURL) {
        const imgUrl = String(input.ImgURL).trim();
        if (!isHttpUrl(imgUrl)) return { error: 'Logo 链接 (ImgURL) 必须是有效的 http(s) 链接' };
        site.ImgURL = imgUrl;
    }
    if (input.GQL_API) {
        const gql = String(input.GQL_API).trim();
        if (!isHttpUrl(gql)) return { error: 'GraphQL 端点 (GQL_API) 必须是有效的 http(s) 链接' };
        site.GQL_API = gql;
    }
    if (input.AUTHOR_TAG) site.AUTHOR_TAG = String(input.AUTHOR_TAG).trim();
    if (input.ATTRIBUTION_PAGE) {
        const attrPage = String(input.ATTRIBUTION_PAGE).trim().slice(0, 100);
        if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(attrPage)) {
            return { error: '归属资料页面 (ATTRIBUTION_PAGE) 只能包含字母、数字、点、下划线、冒号和连字符' };
        }
        site.ATTRIBUTION_PAGE = attrPage;
    }
    if (input.FORUM_SYNC === true || input.FORUM_SYNC === 'true') site.FORUM_SYNC = true;

    return { site };
}

module.exports = {
    getConfigPath,
    loadSiteConfig,
    loadSiteConfigFromFile,
    loadEffectiveConfig,
    saveSiteConfig,
    validateSite,
    buildConfigFileContent,
    invalidateConfigCache,
    CONFIG_KEY,
};
