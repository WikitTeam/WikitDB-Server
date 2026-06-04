import { withAdmin } from '../../../utils/withAdmin';
import prisma from '../../../lib/prisma';
const config = require('../../../wikitdb.config.js');
const { fetchCategories, fetchThreads, fetchPosts } = require('../../../utils/wikidotForum');

async function upsertByField(model, field, siteParam, value, data) {
    const existing = await model.findFirst({ where: { siteParam, [field]: value } });
    if (existing) {
        return model.update({ where: { id: existing.id }, data });
    }
    return model.create({ data: { siteParam, [field]: value, ...data } });
}

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { site = 'all' } = req.query;

    const sites = site === 'all'
        ? config.SUPPORT_WIKI.filter(w => w.FORUM_SYNC)
        : config.SUPPORT_WIKI.filter(w => w.PARAM === site && w.FORUM_SYNC);

    if (sites.length === 0) {
        return res.status(404).json({ error: '未找到启用论坛同步的站点' });
    }

    const stats = { categories: 0, threads: 0, posts: 0, errors: [] };

    for (const wiki of sites) {
        try {
            const categories = await fetchCategories(wiki.URL);

            for (const cat of categories) {
                await upsertByField(prisma.forumCategory, 'categoryId', wiki.PARAM, cat.categoryId, {
                    title: cat.title,
                    description: cat.description,
                    threadsCount: cat.threadsCount,
                    postsCount: cat.postsCount,
                    lastSyncedAt: new Date().toISOString()
                });
                stats.categories++;

                let page = 1;
                let maxPage = 1;
                do {
                    const result = await fetchThreads(wiki.URL, cat.categoryId, page);
                    maxPage = result.maxPage;

                    for (const thread of result.threads) {
                        const existing = await prisma.forumThread.findFirst({
                            where: { siteParam: wiki.PARAM, threadId: thread.threadId }
                        });

                        const needSync = !existing || existing.postCount !== thread.postCount;

                        await upsertByField(prisma.forumThread, 'threadId', wiki.PARAM, thread.threadId, {
                            categoryId: cat.categoryId,
                            title: thread.title,
                            createdBy: thread.createdBy,
                            createdAt: thread.createdAt,
                            postCount: thread.postCount,
                            isSticky: thread.isSticky,
                            isLocked: thread.isLocked,
                            lastSyncedAt: new Date().toISOString()
                        });
                        stats.threads++;

                        if (needSync) {
                            let postPage = 1;
                            let postMaxPage = 1;
                            do {
                                const postResult = await fetchPosts(wiki.URL, thread.threadId, postPage);
                                postMaxPage = postResult.maxPage;

                                for (const post of postResult.posts) {
                                    await upsertByField(prisma.forumPost, 'postId', wiki.PARAM, post.postId, {
                                        threadId: thread.threadId,
                                        parentId: post.parentId || null,
                                        title: post.title,
                                        contentHtml: post.contentHtml,
                                        author: post.author,
                                        authorId: post.authorId || null,
                                        createdAt: post.createdAt
                                    });
                                    stats.posts++;
                                }
                                postPage++;
                            } while (postPage <= postMaxPage);
                        }
                    }
                    page++;
                } while (page <= maxPage);
            }
        } catch (e) {
            stats.errors.push({ site: wiki.PARAM, error: e.message });
        }
    }

    res.status(200).json({ success: true, stats });
}

export default withAdmin(handler);
