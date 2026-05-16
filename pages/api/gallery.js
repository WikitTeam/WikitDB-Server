export default async function handler(req, res) {
    return res.status(200).json({
        currentPage: 1,
        totalPages: 0,
        archives: [],
        message: '页面归档已迁移至 Wikit GraphQL API，本地不再存储。'
    });
}
