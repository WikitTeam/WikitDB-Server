import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const configRecord = await prisma.setting.findUnique({ where: { key: 'config:bingo' } });
            let config = { tags: ['原创', '翻译', '搞笑', '微恐', '设定中心', '人事档案'], cost: 50 };
            
            if (configRecord && configRecord.value) {
                try { config = JSON.parse(configRecord.value); } catch(e) {}
            }
            return res.status(200).json(config);
        } catch (e) { 
            return res.status(500).json({ error: '配置读取失败' }); 
        }
    }

    if (req.method === 'POST') {
        const decoded = verifyToken(req);
        if (!decoded || !decoded.username) return res.status(401).json({ error: '未授权的访问' });
        const username = decoded.username; 

        const { selectedTags } = req.body;
        if (!selectedTags || selectedTags.length !== 3) return res.status(400).json({ error: '必须选择3个不同的标签' });

        try {
            const configRecord = await prisma.setting.findUnique({ where: { key: 'config:bingo' } });
            let config = null;
            if (configRecord && configRecord.value) {
                try { config = JSON.parse(configRecord.value); } catch(e) {}
            }
            
            const scanCost = config?.cost || 50;

            const user = await prisma.user.findUnique({ where: { username } });
            if (!user) return res.status(404).json({ error: '用户不存在' });

            if ((user.balance || 0) < scanCost) return res.status(400).json({ error: `余额不足，扫描需要 ¥${scanCost}` });

            const countRes = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `query { articles(page: 1, pageSize: 1) { pageInfo { total } } }` })
            });
            const countData = await countRes.json();
            if (!countData.data?.articles?.pageInfo?.total) return res.status(500).json({ error: '数据库通信失败' });
            
            const randomPage = Math.floor(Math.random() * countData.data.articles.pageInfo.total) + 1;

            const r = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `query { articles(page: ${randomPage}, pageSize: 1) { nodes { title rating tags } } }` })
            });
            const d = await r.json();
            const article = d.data?.articles?.nodes[0];
            if (!article) return res.status(500).json({ error: '数据节点抓取失败' });

            const articleTags = article.tags || [];
            let hitCount = 0;
            selectedTags.forEach(t => { if (articleTags.includes(t)) hitCount++; });

            let reward = 0;
            if (hitCount === 1) reward = scanCost;
            if (hitCount === 2) reward = scanCost * 10;
            if (hitCount === 3) reward = scanCost * 100;

            const newBalance = user.balance - scanCost + reward;

            await prisma.user.update({
                where: { username },
                data: { balance: newBalance }
            });

            return res.status(200).json({ success: true, article, hitCount, reward, newBalance });
        } catch (e) { 
            return res.status(500).json({ error: '服务器内部错误' }); 
        }
    }
}