import prisma from '../../../lib/prisma';
import { withLogging } from '../../../utils/logRequest';
import { sanitizeRichHtml } from '../../../utils/htmlSanitizer';
const { cached } = require('../../../utils/cache');

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { site, thread, p = '1' } = req.query;
    if (!site || !thread) return res.status(400).json({ error: '缺少 site 或 thread 参数' });

    const page = Math.min(Math.max(parseInt(p, 10) || 1, 1), 1000);
    const pageSize = 20;

    const cacheKey = `forum-posts:${site}:${thread}:${page}`;
    const result = await cached(cacheKey, async () => {
        const where = { siteParam: site, threadId: thread };
        const [total, paged] = await Promise.all([
            prisma.forumPost.count({ where }),
            prisma.forumPost.findMany({
                where,
                orderBy: { id: 'asc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            })
        ]);

        const postMap = {};
        const rootPosts = [];
        paged.forEach(p => {
            postMap[p.postId] = {
                ...p,
                contentHtml: sanitizeRichHtml(p.contentHtml),
                children: []
            };
        });
        paged.forEach(p => {
            if (p.parentId && postMap[p.parentId]) {
                postMap[p.parentId].children.push(postMap[p.postId]);
            } else {
                rootPosts.push(postMap[p.postId]);
            }
        });

        const threadInfo = await prisma.forumThread.findFirst({
            where: { siteParam: site, threadId: thread }
        });

        return {
            threadTitle: threadInfo?.title || '',
            threadAuthor: threadInfo?.createdBy || '',
            posts: rootPosts,
            total,
            totalPages: Math.ceil(total / pageSize)
        };
    }, 5 * 60 * 1000);

    res.status(200).json({ site, thread, currentPage: page, ...result });
}

export default withLogging(handler);
