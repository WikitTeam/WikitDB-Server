import prisma from '../../../lib/prisma';
import { withAuth } from '../../../utils/withAuth';
import { validateNumberRange } from '../../../utils/security';

async function getAuthorPrice(authorName) {
    const cacheKey = `author_price_cache:${authorName}`;
    const cacheRecord = await prisma.setting.findUnique({ where: { key: cacheKey } });
    
    if (cacheRecord && cacheRecord.value) {
        const cacheData = typeof cacheRecord.value === 'string' ? JSON.parse(cacheRecord.value) : cacheRecord.value;
        if (Date.now() < cacheData.expires) {
            return Number(cacheData.price);
        }
    }

    try {
        const query = {
            query: `query($author: String!) { articles(author: $author, page: 1, pageSize: 500) { nodes { rating comments } } }`,
            variables: { author: authorName }
        };
        const res = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query)
        });
        if (!res.ok) throw new Error('网络拒绝');
        const result = await res.json();
        if (result.errors) throw new Error('异常');

        const articles = result.data?.articles?.nodes || [];
        if (articles.length === 0) {
            const price = 10;
            await prisma.setting.upsert({
                where: { key: cacheKey },
                update: { value: { price, expires: Date.now() + 60000 } },
                create: { key: cacheKey, value: { price, expires: Date.now() + 60000 } }
            });
            return price;
        }

        let totalRating = 0, totalComments = 0;
        articles.forEach(a => { totalRating += (a.rating || 0); totalComments += (a.comments || 0); });

        const price = Math.max(1, 10 + (articles.length * 2.5) + (totalRating * 0.8) + (totalComments * 0.2));
        await prisma.setting.upsert({
            where: { key: cacheKey },
            update: { value: { price, expires: Date.now() + 60000 } },
            create: { key: cacheKey, value: { price, expires: Date.now() + 60000 } }
        });
        return price;
    } catch (e) {
        throw new Error('节点异常');
    }
}

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST 请求' });

    const user = req.user;
    const username = user.username;

    const { authorName, action, amount = 1 } = req.body;
    const tradeAmount = validateNumberRange(amount, 1, 10000);

    if (!authorName || !action || tradeAmount === null) {
        return res.status(400).json({ error: '参数错误（交易数量范围 1-10000）' });
    }

    const SELL_LOSS_RATE = 0.05;

    try {
        const portfolioKey = `portfolio:${username}`;

        if (action === 'query') {
            const portfolioRecord = await prisma.setting.findUnique({ where: { key: portfolioKey } });
            const portfolio = portfolioRecord ? (typeof portfolioRecord.value === 'string' ? JSON.parse(portfolioRecord.value) : portfolioRecord.value) : {};
            let pData = portfolio[authorName];
            if (typeof pData === 'string') { try { pData = JSON.parse(pData); } catch(e){} }
            let pos = typeof pData === 'object' && pData !== null ? (pData.shares || 0) : (Number(pData) || 0);
            return res.status(200).json({ newBalance: user.balance, newPosition: pos });
        }

        let currentPrice;
        try { currentPrice = await getAuthorPrice(authorName); } 
        catch (e) { return res.status(500).json({ error: '市值读取失败拦截' }); }

        const price = Number(currentPrice);

        const result = await prisma.$transaction(async (tx) => {
            const dbUser = await tx.user.findUnique({ where: { id: user.id } });
            if (!dbUser) throw new Error('用户不存在');

            const portfolioRecord = await tx.setting.findUnique({ where: { key: portfolioKey } });
            const portfolio = portfolioRecord ? (typeof portfolioRecord.value === 'string' ? JSON.parse(portfolioRecord.value) : portfolioRecord.value) : {};
            
            let pData = portfolio[authorName];
            if (typeof pData === 'string') { try { pData = JSON.parse(pData); } catch(e){} }

            let currentShares = 0, avgCost = price;
            if (typeof pData === 'object' && pData !== null) {
                currentShares = pData.shares || 0;
                avgCost = pData.avgCost || price;
            } else {
                currentShares = Number(pData) || 0;
            }

            const totalValue = tradeAmount * price;
            let balanceChange = 0;

            if (action === 'buy') {
                if (currentShares >= 0) {
                    balanceChange = -totalValue;
                    const curVal = currentShares * avgCost;
                    currentShares += tradeAmount;
                    avgCost = (curVal + totalValue) / currentShares;
                } else if (currentShares < 0 && Math.abs(currentShares) < tradeAmount) {
                    const cover = Math.abs(currentShares);
                    const longAmt = tradeAmount - cover;
                    const coverReturn = (avgCost * cover) + ((avgCost - price) * cover);
                    const longCost = longAmt * price;
                    balanceChange = coverReturn - longCost;
                    currentShares = longAmt;
                    avgCost = price;
                } else {
                    balanceChange = (avgCost * tradeAmount) + ((avgCost - price) * tradeAmount);
                    currentShares += tradeAmount;
                    if (currentShares === 0) avgCost = 0;
                }
            } else if (action === 'sell') {
                const lossFee = totalValue * SELL_LOSS_RATE;
                if (currentShares >= tradeAmount) {
                    balanceChange = totalValue - lossFee;
                    currentShares -= tradeAmount;
                    if (currentShares === 0) avgCost = 0;
                } else if (currentShares > 0 && currentShares < tradeAmount) {
                    const closeAmt = currentShares;
                    const shortAmt = tradeAmount - currentShares;
                    const closeVal = closeAmt * price;
                    const closeReturn = closeVal - (closeVal * SELL_LOSS_RATE);
                    const marginReq = shortAmt * price;
                    const reqTotal = marginReq + (marginReq * SELL_LOSS_RATE);
                    balanceChange = closeReturn - reqTotal;
                    currentShares = -shortAmt;
                    avgCost = price;
                } else {
                    const marginReq = tradeAmount * price;
                    const reqTotal = marginReq + lossFee;
                    const curShortVal = Math.abs(currentShares) * avgCost;
                    balanceChange = -reqTotal;
                    currentShares -= tradeAmount;
                    avgCost = (curShortVal + marginReq) / Math.abs(currentShares);
                }
            } else {
                throw new Error('未知指令');
            }

            // Check if balance would go negative
            if (Number(dbUser.balance) + balanceChange < 0) {
                throw new Error('余额不足');
            }

            // Update user balance
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: { balance: { increment: balanceChange } }
            });

            // Update portfolio
            portfolio[authorName] = { shares: currentShares, avgCost };
            await tx.setting.upsert({
                where: { key: portfolioKey },
                update: { value: portfolio },
                create: { key: portfolioKey, value: portfolio }
            });

            // Create trade record
            const trade = await tx.trade.create({
                data: {
                    userId: user.id,
                    type: action === 'buy' ? 'BUY' : 'SELL',
                    amount: Math.abs(balanceChange),
                    target: authorName,
                    description: JSON.stringify({ price, shares: tradeAmount, action, avgCost, currentShares }),
                    status: 'COMPLETED'
                }
            });

            return { 
                newBalance: updatedUser.balance, 
                newPosition: currentShares, 
                avgCost, 
                executedPrice: price 
            };
        });

        res.status(200).json({ message: 'OK', ...result });

    } catch (error) {
        console.error(error);
        res.status(error.message === '余额不足' || error.message === '未知指令' ? 400 : 500).json({ error: error.message || '服务器异常' });
    }
}

export default withAuth(handler);