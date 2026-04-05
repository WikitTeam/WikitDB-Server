import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

const prisma = new PrismaClient();

const generateBounties = (config) => {
    const tagPool = config?.tags?.length > 0 ? config.tags : ['原创', '精品', 'scp', 'tale', 'goi-format', '微恐', '搞笑', '科幻', 'keter', '安全'];
    const minR = config?.minRating ?? 10;
    const maxR = config?.maxRating ?? 50;
    const baseReward = config?.baseReward ?? 800;

    const bounties = [];
    for (let i = 0; i < 3; i++) {
        const tags = [tagPool[Math.floor(Math.random() * tagPool.length)]];
        if (Math.random() > 0.5) tags.push(tagPool[Math.floor(Math.random() * tagPool.length)]);
        const uniqueTags = [...new Set(tags)];
        const reqMinRating = Math.floor(Math.random() * (maxR - minR + 1)) + minR; 
        
        bounties.push({
            id: `bounty_${Date.now()}_${i}`,
            tags: uniqueTags, minRating: reqMinRating,
            reward: (uniqueTags.length * baseReward) + (reqMinRating * 20),
            status: 'active', claimer: null, claimedPage: null
        });
    }
    return bounties;
};

export default async function handler(req, res) {
    if (req.method === 'GET') {
        if (req.query.action === 'config') {
            try {
                const configRecord = await prisma.setting.findUnique({ where: { key: 'config:bounty' } });
                let config = {};
                if (configRecord && configRecord.value) {
                    try { config = JSON.parse(configRecord.value); } catch(e) {}
                }
                return res.status(200).json(config);
            } catch (e) { return res.status(500).json({ error: '配置读取失败' }); }
        }
        try {
            const bountiesRecord = await prisma.setting.findUnique({ where: { key: 'bounties_list' } });
            let bounties = null;
            
            if (bountiesRecord && bountiesRecord.value) {
                try { bounties = JSON.parse(bountiesRecord.value); } catch(e) {}
            }

            if (!bounties) {
                const configRecord = await prisma.setting.findUnique({ where: { key: 'config:bounty' } });
                let config = {};
                if (configRecord && configRecord.value) {
                    try { config = JSON.parse(configRecord.value); } catch(e) {}
                }
                
                bounties = generateBounties(config);
                await prisma.setting.upsert({
                    where: { key: 'bounties_list' },
                    update: { value: JSON.stringify(bounties) },
                    create: { key: 'bounties_list', value: JSON.stringify(bounties) }
                });
            }
            return res.status(200).json({ bounties });
        } catch (e) { return res.status(500).json({ error: '读取悬赏列表失败' }); }
    }

    if (req.method === 'POST') {
        const { action, bountyId, wiki, page } = req.body;

        if (action === 'refresh') {
            const configRecord = await prisma.setting.findUnique({ where: { key: 'config:bounty' } });
            let config = {};
            if (configRecord && configRecord.value) {
                try { config = JSON.parse(configRecord.value); } catch(e) {}
            }
            
            const newBounties = generateBounties(config);
            await prisma.setting.upsert({
                where: { key: 'bounties_list' },
                update: { value: JSON.stringify(newBounties) },
                create: { key: 'bounties_list', value: JSON.stringify(newBounties) }
            });
            return res.status(200).json({ success: true, bounties: newBounties });
        }

        const decoded = verifyToken(req);
        if (!decoded || !decoded.username) return res.status(401).json({ error: '未授权的访问' });
        const username = decoded.username; 

        if (!bountyId || !wiki || !page) return res.status(400).json({ error: '请填写完整的 Wiki 和 Page 标识符' });

        try {
            const user = await prisma.user.findUnique({ where: { username } });
            if (!user) return res.status(404).json({ error: '用户不存在' });

            const bountiesRecord = await prisma.setting.findUnique({ where: { key: 'bounties_list' } });
            let bounties = null;
            if (bountiesRecord && bountiesRecord.value) {
                try { bounties = JSON.parse(bountiesRecord.value); } catch(e) {}
            }
            
            if (!bounties) return res.status(404).json({ error: '悬赏数据已过期' });

            const bountyIndex = bounties.findIndex(b => b.id === bountyId);
            if (bountyIndex === -1) return res.status(404).json({ error: '找不到该悬赏任务' });
            const bounty = bounties[bountyIndex];

            if (bounty.status !== 'active') return res.status(400).json({ error: '这笔悬赏已经被领走了' });

            const query = { query: `query { article(wiki: "${wiki}", page: "${page}") { title rating tags author } }` };
            const gqlRes = await fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query)
            });
            const gqlData = await gqlRes.json();

            if (gqlData.errors || !gqlData.data?.article) return res.status(400).json({ error: '未找到此页面，请检查拼写' });

            const article = gqlData.data.article;
            const hasAllTags = bounty.tags.every(t => (article.tags || []).includes(t));
            const meetsRating = (article.rating || 0) >= bounty.minRating;

            if (!hasAllTags || !meetsRating) return res.status(400).json({ error: `验证不通过。` });

            const newBalance = (user.balance || 0) + bounty.reward;
            await prisma.user.update({
                where: { username },
                data: { balance: newBalance }
            });

            bounties[bountyIndex].status = 'claimed';
            bounties[bountyIndex].claimer = username;
            bounties[bountyIndex].claimedPage = article.title;
            
            await prisma.setting.update({
                where: { key: 'bounties_list' },
                data: { value: JSON.stringify(bounties) }
            });

            return res.status(200).json({ success: true, article, reward: bounty.reward, newBalance, bounties });
        } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
    }
}