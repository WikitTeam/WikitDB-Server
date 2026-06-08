export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '只支持 GET 请求' });
    }

    const { qq } = req.query;

    if (!qq || !/^\d{5,12}$/.test(qq)) {
        return res.status(400).json({ error: 'QQ 号格式不合法' });
    }

    try {
        const response = await fetch(`https://wikit.unitreaty.org/module/bind-query?qq=${encodeURIComponent(qq)}`);
        const data = await response.text();
        res.status(200).send(data);
    } catch (error) {
        res.status(500).json({ error: '查询绑定状态时服务器出错了' });
    }
}
