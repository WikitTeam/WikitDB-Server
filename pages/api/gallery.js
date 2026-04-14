import { PrismaClient } from '@prisma/client';
const config = require('../../wikitdb.config.js');

const prisma = new PrismaClient();

export default async function handler(req, res) {
    const { site, p = 1, search = '' } = req.query;

    if (!site) return res.status(400).json({ error: '缺少有效的 site 参数' });

    const pageNum = parseInt(p, 10) || 1;
    const PAGE_SIZE = 24; 

    try {
        // 构建查询条件
        const where = {
            wiki: site
        };

        // 如果有搜索关键词 (支持搜标题、作者或标签)
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { author: { contains: search, mode: 'insensitive' } },
                { tags: { contains: search, mode: 'insensitive' } }
            ];
        }

        // 获取总数
        const totalCount = await prisma.pageArchive.count({ where });
        const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

        // 获取分页数据
        const archives = await prisma.pageArchive.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            skip: (pageNum - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            select: {
                id: true,
                wiki: true,
                slug: true,
                title: true,
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
            totalCount: totalCount,
            archives: archives 
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: '获取备份档案失败' });
    }
}
