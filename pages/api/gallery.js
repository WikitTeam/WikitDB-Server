import prisma from '../../lib/prisma';
const config = require('../../wikitdb.config.js');

export default async function handler(req, res) {
    const { site, p = 1 } = req.query;

    if (!site) return res.status(400).json({ error: '缺少有效的 site 参数' });

    const pageNum = parseInt(p, 10) || 1;
    const PAGE_SIZE = 24; 

    try {
        const where = { wiki: site };

        const totalCount = await prisma.pageArchive.count({ where });
        const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

        const archives = await prisma.pageArchive.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            skip: (pageNum - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            // 确保查询了 content 字段
            select: {
                id: true,
                wiki: true,
                slug: true,
                title: true,
                content: true,
                author: true,
                tags: true,
                images: true,
                updatedAt: true,
                sourceUrl: true
            }
        });

        res.status(200).json({ 
            currentPage: pageNum, 
            totalPages: totalPages, 
            archives: archives 
        });
    } catch (error) {
        res.status(500).json({ error: '获取备份档案失败' });
    }
}
