// pages/api/trade/author-kline.js

export default async function handler(req, res) {
    const { author } = req.query;

    if (!author) {
        return res.status(400).json({ error: '缺少作者参数' });
    }

    try {
        const graphqlQuery = {
            query: `
                query($author: String!) {
                    articles(author: $author, page: 1, pageSize: 500) {
                        nodes {
                            rating
                            created_at
                        }
                    }
                }
            `,
            variables: { author }
        };

        const response = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(graphqlQuery)
        });

        const { data, errors } = await response.json();

        if (errors) {
            console.error("GraphQL请求报错:", errors);
            return res.status(500).json({ error: '无法获取数据' });
        }

        const articles = data?.articles?.nodes || [];
        const kLineData = generateStockData(articles);

        res.status(200).json({ data: kLineData });
    } catch (error) {
        console.error("服务端遇到错误:", error);
        res.status(500).json({ error: '服务器内部错误' });
    }
}

function generateStockData(articles) {
    const activityByDate = {};
    let totalBaseRating = 0;
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    articles.forEach(article => {
        if (!article.created_at) return;
        const createdDate = new Date(article.created_at);
        const dateString = createdDate.toISOString().split('T')[0];

        if (createdDate < sixtyDaysAgo) {
            totalBaseRating += (article.rating || 0);
        } else {
            if (!activityByDate[dateString]) {
                activityByDate[dateString] = { count: 0, rating: 0 };
            }
            activityByDate[dateString].count += 1;
            activityByDate[dateString].rating += (article.rating || 0);
        }
    });

    const data = [];
    let currentPrice = Math.max(10, 50 + totalBaseRating * 0.5);

    for (let i = 60; i >= 0; i--) {
        const dateObj = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateString = dateObj.toISOString().split('T')[0];

        const open = currentPrice;
        let dailyChange = 0;

        if (activityByDate[dateString]) {
            const activity = activityByDate[dateString];
            dailyChange += (activity.count * 2) + (activity.rating * 0.8);
        }

        const volatility = (Math.random() - 0.5) * 4; 
        dailyChange += volatility;

        const close = Math.max(0.1, open + dailyChange); 
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.max(0.1, Math.min(open, close) - Math.random() * 2);

        data.push({
            time: dateString,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2))
        });
        currentPrice = close;
    }
    return data;
}
