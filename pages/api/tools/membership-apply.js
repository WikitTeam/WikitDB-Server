import * as cheerio from 'cheerio';
import axios from 'axios';
import { withAuth } from '../../../utils/withAuth';
import { getTrustedWikiByUrl } from '../../../utils/trustedWiki';
const { wikidotLimiter } = require('../../../utils/rateLimiter');

const LOGIN_URL = 'https://www.wikidot.com/default--flow/login__LoginPopupScreen';

function normalizeUrl(url) {
    const wiki = getTrustedWikiByUrl(url);
    return wiki ? wiki.URL.replace(/\/$/, '') : null;
}

async function wikidotLogin(username, password) {
    const payload = new URLSearchParams({
        login: username,
        password: password,
        action: 'Login2Action',
        event: 'login',
        wikidot_token7: '123456'
    });

    const res = await axios.post(LOGIN_URL, payload.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'WikitDB-MembershipTool/1.0'
        },
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 15000
    });

    // Wikidot 登录成功返回 302，失败返回 200 带错误页面
    const cookies = res.headers['set-cookie'] || [];
    let sessionId = '';
    for (const c of cookies) {
        if (c.includes('WIKIDOT_SESSION_ID=')) {
            sessionId = c.split('WIKIDOT_SESSION_ID=')[1].split(';')[0];
            break;
        }
    }

    if (!sessionId) throw new Error('登录失败：未获取到 session');

    // 验证 session 是否有效：检查登录响应状态码
    // Wikidot 登录成功返回 302，失败返回 200
    if (res.status === 200) {
        // 200 表示登录失败（返回了错误页面而非重定向）
        const bodyText = typeof res.data === 'string' ? res.data : '';
        if (bodyText.includes('error') || bodyText.includes('The login and password') || !sessionId) {
            throw new Error('登录失败：用户名或密码错误');
        }
    }

    return sessionId;
}

async function wikidotAjax(siteUrl, sessionId, params) {
    await wikidotLimiter.wait(10000);

    const baseUrl = normalizeUrl(siteUrl);
    if (!baseUrl) throw new Error('仅允许访问系统配置中的 HTTPS Wikidot 站点');
    const ajaxUrl = `${baseUrl}/ajax-module-connector.php`;
    const cookie = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;

    const body = new URLSearchParams({ wikidot_token7: '123456', ...params });

    const res = await axios.post(ajaxUrl, body.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': cookie
        },
        timeout: 15000
    });

    const data = res.data;
    if (!data || data.status !== 'ok') {
        throw new Error(data?.message || `Wikidot 返回错误: ${data?.status || '无响应'}`);
    }
    return data.body || '';
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST' });
    }

    const { action, siteUrl, username, password, sessionId, applications, decision, message } = req.body;

    if (!action) return res.status(400).json({ error: '缺少 action 参数' });

    try {
        if (action === 'login') {
            if (!username || !password) {
                return res.status(400).json({ error: '用户名和密码不能为空' });
            }
            const sid = await wikidotLogin(username, password);
            return res.status(200).json({ sessionId: sid, preview: sid.substring(0, 8) + '...' });
        }

        if (action === 'list') {
            if (!siteUrl || !sessionId) {
                return res.status(400).json({ error: '缺少站点 URL 或 session' });
            }

            const baseUrl = normalizeUrl(siteUrl);
            if (!baseUrl) {
                return res.status(400).json({ error: '仅允许访问系统配置中的 HTTPS Wikidot 站点' });
            }
            const ajaxUrl = `${baseUrl}/ajax-module-connector.php`;
            const cookie = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_token7=123456;`;
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Cookie': cookie
            };

            // 尝试多个可能的模块名
            const moduleNames = [
                'managesite/ManageSiteMembersApplicationsModule',
                'managesite/elists/ManageSiteMembersApplicationsModule',
                'managesite/ManageSiteMembersModule'
            ];

            let html = '';
            let usedModule = '';
            for (const mod of moduleNames) {
                try {
                    await wikidotLimiter.wait(10000);
                    const body = new URLSearchParams({ wikidot_token7: '123456', moduleName: mod });
                    const r = await axios.post(ajaxUrl, body.toString(), { headers, timeout: 15000 });
                    if (r.data && r.data.status === 'ok' && r.data.body) {
                        // 检测是否返回了"未登入"错误页
                        if (r.data.body.includes('您尚未登入') || r.data.body.includes('not logged in') || r.data.body.includes('loginClick')) {
                            return res.status(401).json({ error: '当前 session 无权访问该站点管理面板，请确认你是该站点的管理员并重新登录' });
                        }
                        html = r.data.body;
                        usedModule = mod;
                        break;
                    }
                } catch (e) {
                    // 继续尝试下一个
                }
            }

            if (!html) {
                // 最后尝试直接抓取管理页面
                try {
                    await wikidotLimiter.wait(10000);
                    const pageRes = await axios.get(`${baseUrl}/admin:manage/start/ma`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Cookie': cookie
                        },
                        timeout: 15000
                    });
                    if (pageRes.data) {
                        html = pageRes.data;
                        usedModule = 'admin:manage/start/ma (页面抓取)';
                    }
                } catch (e) {}
            }

            if (!html) {
                return res.status(200).json({
                    applications: [],
                    debug: '所有模块均未返回有效内容，可能需要站点管理员权限'
                });
            }

            const $ = cheerio.load(html);
            const apps = [];

            // 解析申请列表
            $('tr').each((_, el) => {
                const $el = $(el);
                if ($el.find('th').length) return;

                const $user = $el.find('.printuser');
                if (!$user.length) return;

                const userName = $user.text().trim();
                if (!userName) return;

                let userId = null;
                const elHtml = $el.html() || '';
                const idMatch = elHtml.match(/userid=(\d+)/) || elHtml.match(/userInfo\(\s*(\d+)\s*\)/);
                if (idMatch) userId = idMatch[1];

                const tds = $el.find('td');
                const dateText = $el.find('.odate').text().trim() || '';
                const commentText = tds.length > 2 ? tds.last().text().trim() : '';

                apps.push({
                    userId,
                    userName,
                    date: dateText,
                    comment: (commentText && commentText !== userName) ? commentText : ''
                });
            });

            // 备用：找所有 .printuser
            if (apps.length === 0) {
                $('.printuser').each((_, el) => {
                    const $el = $(el);
                    const userName = $el.text().trim();
                    if (!userName) return;

                    let userId = null;
                    const img = $el.find('img').attr('src') || $el.parent().find('img').attr('src') || '';
                    const m = img.match(/userid=(\d+)/);
                    if (m) userId = m[1];

                    if (!userId) {
                        const pH = $el.parent().html() || '';
                        const m2 = pH.match(/userInfo\(\s*(\d+)\s*\)/) || pH.match(/userid=(\d+)/);
                        if (m2) userId = m2[1];
                    }

                    apps.push({ userId, userName, date: '', comment: '' });
                });
            }

            return res.status(200).json({
                applications: apps,
                debug: apps.length === 0 ? `模块: ${usedModule || '无'}, HTML前500字: ${html.substring(0, 500)}` : undefined
            });
        }

        if (action === 'process') {
            if (!siteUrl || !sessionId || !applications || !decision) {
                return res.status(400).json({ error: '参数不完整' });
            }

            if (!['accept', 'decline'].includes(decision)) {
                return res.status(400).json({ error: '无效的决定类型' });
            }

            const results = [];
            for (const app of applications) {
                try {
                    const params = {
                        action: 'ManageSiteMembershipAction',
                        event: decision === 'accept' ? 'acceptApplication' : 'declineApplication',
                        user_id: app.userId || app.userName
                    };
                    if (message) params.text = message;

                    await wikidotAjax(siteUrl, sessionId, params);
                    results.push({ userName: app.userName, success: true });
                } catch (e) {
                    results.push({ userName: app.userName, success: false, error: e.message });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            return res.status(200).json({
                message: `处理完成：${successCount} 成功，${failCount} 失败`,
                results
            });
        }

        return res.status(400).json({ error: '未知的 action' });
    } catch (error) {
        return res.status(500).json({ error: error.message || '服务器内部错误' });
    }
}

export default withAuth(handler);
