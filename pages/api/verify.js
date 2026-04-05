export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    const { qq, token } = req.body;

    try {
        // 在后端发起请求，不会触发浏览器的 CORS 限制
        const response = await fetch('https://wikit.unitreaty.org/module/qq-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ qq, token }).toString()
        });

        const data = await response.text();
        
        // 直接把外部 API 返回的内容原样传回给前端
        res.status(200).send(data);
    } catch (error) {
        res.status(500).json({ error: '代理请求失败' });
    }
}
