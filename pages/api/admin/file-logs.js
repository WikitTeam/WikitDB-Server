import fs from 'fs';
import path from 'path';
import { withAdmin } from '../../../utils/withAdmin';
import { readJobLogs } from '../../../utils/jobLog';

/**
 * 日志查看。
 * 爬虫日志在无服务器部署里来自数据库（logs:crawler）。
 * server.log / server-err.log 只在自建虚拟机上存在，读不到就返回说明。
 */
const FILE_LOGS = {
    server: 'server.log',
    serverErr: 'server-err.log',
};

async function readDisk(fileName, linesLimit) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const stat = fs.statSync(filePath);
    const allLines = content.split(/\r?\n/).map(l => l.replace(/\r$/, '')).filter(l => l.trim().length > 0);
    return {
        lines: allLines.slice(-linesLimit),
        totalLines: allLines.length,
        size: stat.size,
        mtime: stat.mtime,
    };
}

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const fileKey = String(req.query.file || 'crawler');
    const linesLimit = Math.min(parseInt(req.query.lines, 10) || 500, 5000);

    try {
        if (fileKey === 'crawler') {
            const stored = await readJobLogs('crawler', linesLimit);
            return res.status(200).json({
                file: fileKey,
                name: 'logs:crawler',
                source: 'database',
                lines: stored.lines,
                totalLines: stored.totalLines,
                size: stored.lines.join('\n').length,
                mtime: stored.lines.length ? new Date().toISOString() : null,
            });
        }

        const fileName = FILE_LOGS[fileKey];
        if (!fileName) return res.status(400).json({ error: '未知日志文件' });
        const disk = await readDisk(fileName, linesLimit);
        if (!disk) {
            return res.status(200).json({
                file: fileKey,
                name: fileName,
                source: 'missing',
                lines: [],
                totalLines: 0,
                size: 0,
                mtime: null,
                note: '无服务器部署没有常驻进程日志文件。爬虫输出在「crawler」里，来自数据库。',
            });
        }
        return res.status(200).json({ file: fileKey, name: fileName, source: 'file', ...disk });
    } catch (error) {
        console.error('[file-logs] 读取失败:', error);
        return res.status(500).json({ error: `读取日志失败: ${error.message}` });
    }
}

export default withAdmin(handler);
