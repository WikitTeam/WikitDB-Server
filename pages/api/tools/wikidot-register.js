import axios from 'axios';

const WIKIDOT_BASE = 'https://www.wikidot.com';
const REG_URL = `${WIKIDOT_BASE}/default--flow/login__CreateAccountScreen`;
const AJAX_URL = `${WIKIDOT_BASE}/ajax-module-connector.php`;

async function getRegistrationPage() {
    const res = await axios.get(REG_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
    });

    const html = res.data;
    const cookies = res.headers['set-cookie'] || [];

    const captchaHash = html.match(/local--mathcaptcha\/([a-f0-9]+)/)?.[1];
    const originSiteId = html.match(/name="originSiteId"\s*value="(\d+)"/)?.[1] || '';
    const time = html.match(/name="time"\s*value="(\d+)"/)?.[1] || '';

    let wikidotToken7 = '', sessionId = '';
    for (const c of cookies) {
        if (c.includes('wikidot_token7=')) wikidotToken7 = c.split('wikidot_token7=')[1].split(';')[0];
        if (c.includes('WIKIDOT_SESSION_ID=')) sessionId = c.split('WIKIDOT_SESSION_ID=')[1].split(';')[0];
    }

    return { captchaHash, captchaUrl: captchaHash ? `${WIKIDOT_BASE}/local--mathcaptcha/${captchaHash}` : null, originSiteId, time, wikidotToken7, sessionId };
}

async function submitRegistration({ name, email, password, language, captchaAnswer, captchaHash, originSiteId, time, wikidotToken7, sessionId }) {
    const cookie = `wikidot_token7=${wikidotToken7}; WIKIDOT_SESSION_ID=${sessionId}`;

    const payload = new URLSearchParams();
    payload.append('action', 'CreateAccount3Action');
    payload.append('event', 'step0');
    payload.append('name', name);
    payload.append('email', email);
    payload.append('password', password);
    payload.append('password2', password);
    payload.append('language', language || 'en');
    payload.append('mathCaptchaResult', captchaAnswer);
    payload.append('mathCaptchaName', captchaHash);
    payload.append('originSiteId', originSiteId || '');
    payload.append('time', time || '');
    payload.append('wikidot_token7', wikidotToken7);

    const res = await axios.post(AJAX_URL, payload.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': REG_URL,
            'Origin': WIKIDOT_BASE,
            'Cookie': cookie
        },
        timeout: 15000,
        validateStatus: () => true
    });

    return res.data;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST' });
    }

    const { action } = req.body;

    try {
        if (action === 'get-captcha') {
            const page = await getRegistrationPage();
            if (!page.captchaHash) {
                return res.status(200).json({ success: false, error: '未找到验证码' });
            }
            return res.status(200).json({
                success: true,
                captchaUrl: page.captchaUrl,
                captchaHash: page.captchaHash,
                originSiteId: page.originSiteId,
                time: page.time,
                wikidotToken7: page.wikidotToken7,
                sessionId: page.sessionId
            });
        }

        if (action === 'register') {
            const { name, email, password, language, captchaAnswer, captchaHash, originSiteId, time, wikidotToken7, sessionId } = req.body;

            if (!name) return res.status(400).json({ error: '用户名不能为空' });
            if (!email) return res.status(400).json({ error: '邮箱不能为空' });
            if (!password) return res.status(400).json({ error: '密码不能为空' });
            if (!captchaAnswer) return res.status(400).json({ error: '验证码不能为空' });

            const result = await submitRegistration({
                name, email, password, language, captchaAnswer,
                captchaHash, originSiteId, time, wikidotToken7, sessionId
            });

            if (!result || typeof result !== 'object') {
                return res.status(200).json({ success: false, error: '服务器无响应' });
            }

            if (result.status === 'form_errors') {
                const errors = result.formErrors || result.errors || {};
                const errorList = Array.isArray(errors) ? errors : Object.values(errors);
                const raw = errorList.length > 0 ? errorList.join('；') : '表单验证失败';
                const msg = raw
                    .replace(/Another account is using this email address.*/i, '该邮箱已被其他账号使用，请换一个')
                    .replace(/This name is already taken.*/i, '该用户名已被占用')
                    .replace(/The name should be.*/, '用户名格式不符合要求（仅限字母、数字、连字符，2-20字符）')
                    .replace(/Please solve the equation correctly.*/i, '验证码错误，请刷新后重试')
                    .replace(/Password is too short.*/i, '密码太短，至少需要6个字符')
                    .replace(/Passwords do not match.*/i, '两次输入的密码不一致')
                    .replace(/Please provide a valid email.*/i, '邮箱格式无效');
                return res.status(200).json({ success: false, error: msg, detail: JSON.stringify(result) });
            }

            if (result.status === 'ok' || result.uri) {
                return res.status(200).json({
                    success: true,
                    message: '注册成功，请检查邮箱完成确认',
                    detail: JSON.stringify(result)
                });
            }

            return res.status(200).json({
                success: false,
                error: result.message || '注册结果未知',
                detail: JSON.stringify(result).substring(0, 500)
            });
        }

        return res.status(400).json({ error: '未知 action' });
    } catch (error) {
        return res.status(500).json({ error: error.message || '服务器内部错误' });
    }
}
