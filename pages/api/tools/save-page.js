import axios from 'axios';
const config = require('../../../wikitdb.config.js');

const SAVE_PAGE_URL = 'https://wikit.unitreaty.org/wikidot/savepage';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST' });
    }

    const { site, username, password, page, title, source, comments, token } = req.body;

    const finalUsername = username || process.env.WIKIDOT_BOT_USER || '';
    const finalPassword = password || process.env.WIKIDOT_BOT_PASS || '';

    if (!site) return res.status(400).json({ error: '请选择站点' });
    if (!finalUsername || !finalPassword) return res.status(400).json({ error: '请填写 Wikidot 账号和密码' });
    if (!page) return res.status(400).json({ error: '请填写页面名称' });
    if (!source) return res.status(400).json({ error: '页面内容不能为空' });
    if (!token) return res.status(400).json({ error: '请填写授权 Token' });

    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) return res.status(400).json({ error: '未找到对应站点配置' });

    const wikiName = wikiConfig.WIKIT_ID;

    try {
        const payload = new URLSearchParams();
        payload.append('token', token);
        payload.append('wiki', wikiName);
        payload.append('username', finalUsername);
        payload.append('password', finalPassword);
        payload.append('page', page);
        payload.append('title', title || '');
        payload.append('source', source);
        payload.append('comments', comments || '');

        const r = await axios.post(SAVE_PAGE_URL, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000,
            validateStatus: () => true
        });

        const data = r.data;
        if (r.status === 200 && (data === 'ok' || (typeof data === 'object' && (data.status === 'ok' || data.status === 'success')))) {
            const pageName = data.page || page;
            return res.status(200).json({ success: true, message: `页面 ${pageName} 发布成功` });
        }

        const errMsg = typeof data === 'string' ? data : JSON.stringify(data);
        return res.status(200).json({ success: false, error: errMsg || '发布失败', statusCode: r.status });
    } catch (error) {
        console.error('Save page error:', error.message);
        return res.status(500).json({ error: '发布服务异常，请稍后重试' });
    }
}
