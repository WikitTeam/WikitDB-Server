export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    const { qq, token } = req.body;

    if (!qq || !/^\d{5,12}$/.test(String(qq))) {
        return res.status(400).json({ error: 'QQ 号格式不合法' });
    }
    if (!token || typeof token !== 'string' || token.length > 100) {
        return res.status(400).json({ error: 'Token 格式不合法' });
    }

    try {
        const response = await fetch('https://wikit.unitreaty.org/module/qq-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ qq: String(qq), token }).toString()
        });

        const data = await response.text();
        res.status(200).send(data);
    } catch (error) {
        res.status(500).json({ error: '代理请求失败' });
    }
}
