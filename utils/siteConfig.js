/**
 * wikitdb.config.js 运行时读写工具
 * 使用 vm 沙箱解析配置文件，避免 Next.js webpack 打包导致的 require 缓存问题，
 * 确保读取到的始终是磁盘上的最新配置。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CONFIG_FILENAME = 'wikitdb.config.js';

function getConfigPath() {
    return path.join(process.cwd(), CONFIG_FILENAME);
}

/** 从磁盘加载配置（vm 沙箱执行，不污染全局） */
function loadSiteConfig() {
    const filePath = getConfigPath();
    const source = fs.readFileSync(filePath, 'utf8');
    const sandbox = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(source, sandbox, { filename: filePath, timeout: 2000 });
    const cfg = sandbox.module.exports || {};
    if (!Array.isArray(cfg.SUPPORT_WIKI)) cfg.SUPPORT_WIKI = [];
    return cfg;
}

/** 使 Node 侧的 require 缓存失效（对 auto-crawler.js 等独立进程生效） */
function invalidateConfigCache() {
    try {
        const resolved = require.resolve(getConfigPath());
        if (resolved) delete require.cache[resolved];
    } catch (e) { /* 打包环境中可能无法解析，忽略 */ }
}

/** 生成配置文件内容（保留站点模板注释，便于后续手工编辑） */
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

/** 写回配置文件并刷新缓存 */
function saveSiteConfig(config) {
    fs.writeFileSync(getConfigPath(), buildConfigFileContent(config), 'utf8');
    invalidateConfigCache();
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

/** 校验并规范化一个站点对象，返回 { site } 或 { error } */
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

    // 可选字段
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
    saveSiteConfig,
    validateSite,
    buildConfigFileContent,
    invalidateConfigCache,
};
