export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '只支持 GET 请求' });
    }

    const { qq } = req.query;

    if (!qq) {
        return res.status(400).json({ error: '缺少 QQ 参数' });
    }

    try {
        const response = await fetch(`https://wikit.unitreaty.org/module/bind-query?qq=${qq}`);
        const data = await response.text();
        res.status(200).send(data);
    } catch (error) {
        res.status(500).json({ error: '查询绑定状态时服务器出错了' });
    }
}
