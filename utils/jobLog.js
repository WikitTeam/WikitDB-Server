/**
 * 任务日志写入 settings 表（logs:<source>），替代 crawler.log 这类本地文件。
 * 无服务器实例的磁盘在调用结束后就没了，管理后台仍从数据库读最近若干行。
 */
const MAX_LINES = 800;

function normalizeLines(value) {
    if (!value) return [];
    const parsed = typeof value === 'string' ? safeJson(value) : value;
    if (Array.isArray(parsed)) return parsed.map(String);
    if (parsed && Array.isArray(parsed.lines)) return parsed.lines.map(String);
    return [];
}

function safeJson(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
}

async function appendJobLogs(source, lines) {
    const incoming = (Array.isArray(lines) ? lines : [lines]).map(String).filter(Boolean);
    if (incoming.length === 0) return;
    let prisma;
    try {
        prisma = require('../lib/prisma');
    } catch (e) {
        return;
    }
    const key = `logs:${source}`;
    try {
        const row = await prisma.setting.findUnique({ where: { key } });
        const prev = normalizeLines(row && row.value);
        const next = prev.concat(incoming).slice(-MAX_LINES);
        await prisma.setting.upsert({
            where: { key },
            update: { value: { lines: next } },
            create: { key, value: { lines: next } },
        });
    } catch (e) {
        console.error(`[job-log] ${source} 写入失败: ${e.message}`);
    }
}

async function readJobLogs(source, limit = 500) {
    const prisma = require('../lib/prisma');
    const key = `logs:${source}`;
    const row = await prisma.setting.findUnique({ where: { key } });
    const lines = normalizeLines(row && row.value);
    const sliced = lines.slice(-Math.max(1, limit));
    return { lines: sliced, totalLines: lines.length };
}

module.exports = { appendJobLogs, readJobLogs, normalizeLines, MAX_LINES };
