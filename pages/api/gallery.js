import { PrismaClient } from '@prisma/client';
const config = require('../../wikitdb.config.js');

const prisma = new PrismaClient();

export default async function handler(req, res) {
    const { site, p = 1 } = req.query;

    if (!site) return res.status(400).json({ error: '缺少有效的 site 参数' });

    const pageNum = parseInt(p, 10) || 1;
    const PAGE_SIZE = 24; 

    try {
        const dbKey = `gallery_images_${site}`;
        const record = await prisma.setting.findUnique({ where: { key: dbKey } });

        if (!record || !record.value) {
            return res.status(200).json({ currentPage: pageNum, totalPages: 1, images: [], message: '暂无缓存' });
        }

        const allImages = JSON.parse(record.value);
        const totalPages = Math.ceil(allImages.length / PAGE_SIZE) || 1;

        allImages.reverse();
        const startIndex = (pageNum - 1) * PAGE_SIZE;
        const paginatedImages = allImages.slice(startIndex, startIndex + PAGE_SIZE);

        res.status(200).json({ currentPage: pageNum, totalPages: totalPages, images: paginatedImages });
    } catch (error) {
        res.status(500).json({ error: '获取画廊数据失败' });
    }
}