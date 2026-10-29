import fs from 'fs';
import path from 'path';
import { withAdmin } from '../../../utils/withAdmin';

/**
 * 服务器 / 爬虫文件日志查看 API
 * GET /api/admin/file-logs?file=crawler|server|serverErr&lines=500
 * 返回指定日志文件末尾若干行。
 */
const LOG_FILES = {
    crawler: 'crawler.log',
    server: 'server.log',
    serverErr: 'server-err.log',
};

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const fileKey = String(req.query.file || 'crawler');
    const linesLimit = Math.min(parseInt(req.query.lines) || 500, 5000);
    const fileName = LOG_FILES[fileKey];
    if (!fileName) return res.status(400).json({ error: '未知日志文件' });

    const filePath = path.join(process.cwd(), fileName);

    try {
        let content = '';
        let stat = null;
        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf8');
            stat = fs.statSync(filePath);
        }

        const allLines = content.split(/\r?\n/);
        const lines = allLines.map(l => l.replace(/\r$/, '')).filter(l => l.trim().length > 0).slice(-linesLimit);

        return res.status(200).json({
            file: fileKey,
            name: fileName,
            lines,
            totalLines: allLines.length,
            size: stat ? stat.size : 0,
            mtime: stat ? stat.mtime : null,
        });
    } catch (error) {
        console.error('[file-logs] 读取失败:', error);
        return res.status(500).json({ error: `读取日志失败: ${error.message}` });
    }
}

export default withAdmin(handler);
