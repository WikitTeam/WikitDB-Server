import prisma from '../../../lib/prisma';
import { withLogging } from '../../../utils/logRequest';
const { cached } = require('../../../utils/cache');

async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { site, thread, p = '1' } = req.query;
    if (!site || !thread) return res.status(400).json({ error: '缺少 site 或 thread 参数' });

    const page = parseInt(p, 10) || 1;
    const pageSize = 20;

    const cacheKey = `forum-posts:${site}:${thread}:${page}`;
    const result = await cached(cacheKey, async () => {
        const allPosts = await prisma.forumPost.findMany({
            where: { siteParam: site, threadId: thread }
        });

        const total = allPosts.length;
        const paged = allPosts.slice((page - 1) * pageSize, page * pageSize);

        const postMap = {};
        const rootPosts = [];
        paged.forEach(p => { postMap[p.postId] = { ...p, children: [] }; });
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
