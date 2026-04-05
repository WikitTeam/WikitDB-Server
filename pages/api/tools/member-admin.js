export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'error', message: '仅支持 POST 请求' });
    }

    const { token, wiki, username, password, member, action, reason } = req.body;

    if (!token || !wiki || !username || !password || !member || !action) {
        return res.status(400).json({ status: 'error', message: '前端校验失败：请填写所有必填项' });
    }

    try {
        const payload = new URLSearchParams();
        payload.append('token', token);
        payload.append('wiki', wiki);
        payload.append('username', username);
        payload.append('password', password);
        payload.append('member', member);
        payload.append('action', action);

        if (action === 'ban' && reason) {
            payload.append('reason', reason);
        }

        const fetchRes = await fetch('https://wikit.unitreaty.org/wikidot/member-admin', {
            method: 'POST',
            headers: {
                // 核心修改：将 Content-Type 改为表单格式
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: payload.toString()
        });

        const data = await fetchRes.json();
        
        if (data.status === 'success') {
            return res.status(200).json(data);
        } else {
            return res.status(400).json(data);
        }

    } catch (error) {
        res.status(500).json({ status: 'error', message: '请求 Wikit 接口异常', details: error.message });
    }
}
