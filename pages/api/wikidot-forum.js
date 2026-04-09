import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: '仅支持 GET 请求' });

    const { wiki, pageId } = req.query; // pageId 即文章在 URL 上的后缀，比如 scp-173

    if (!wiki || !pageId) {
        return res.status(400).json({ error: '必须提供站点标识 (wiki) 和页面标识 (pageId)' });
    }

    try {
        const cacheKey = `forum_cache:${wiki}:${pageId}`;
        const record = await prisma.setting.findUnique({
            where: { key: cacheKey }
        });

        if (!record) {
            return res.status(404).json({ error: '该文档的讨论区尚未被爬虫收录，或原站无讨论' });
        }

        // 直接吐出我们爬虫组装好的完美嵌套 JSON
        return res.status(200).json(JSON.parse(record.value));

    } catch (error) {
        console.error('读取本地讨论区缓存失败:', error.message);
        return res.status(500).json({ error: '读取本地数据异常' });
    }
}