import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { action, username, password, email, code } = req.body;

    if (!username) return res.status(400).json({ error: '用户显示名称不能为空' });

    // 用户名校验：2-20 字符，只允许字母、数字、下划线、中文、连字符
    if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度必须在 2-20 个字符之间' });
    }
    if (!/^[\w\u4e00-\u9fff-]+$/.test(username)) {
        return res.status(400).json({ error: '用户名只能包含字母、数字、下划线、中文和连字符' });
    }

    if (action === 'start') {
        if (!password) return res.status(400).json({ error: '密码不能为空' });
        if (password.length < 6) return res.status(400).json({ error: '密码长度不能少于 6 位' });

        const exists = await prisma.user.findUnique({ where: { username } });
        if (exists) return res.status(400).json({ error: '该用户名已被注册' });

        if (email) {
            const emailExists = await prisma.user.findFirst({ where: { email } });
            if (emailExists) return res.status(400).json({ error: '该电子邮箱已被绑定' });
        }

        const verifyCode = 'WIKIT-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const expiresAt = new Date(Date.now() + 86400 * 1000);
            await prisma.tempReg.upsert({
                where: { username },
                update: { verifyCode, password: hashedPassword, expiresAt, wdid: null },
                create: { username, verifyCode, password: hashedPassword, expiresAt }
            });
            
            return res.status(200).json({ verifyUrl: verifyCode }); 
        } catch (err) {
            console.error('Register start error:', err);
            return res.status(500).json({ error: '注册初始化失败' });
        }
    }

    if (action === 'check') {
        const tempRecord = await prisma.tempReg.findUnique({ where: { username } });
        
        if (!tempRecord || tempRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: '验证会话已过期或不存在，请重新发起' });
        }

        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000); // 5秒超时防止挂死

            const queryRes = await fetch('https://wikit.unitreaty.org/wikidot/pagehistory?wiki=wikkit&page=https://wikkit.wikidot.com/wikitdb:verify', { signal: controller.signal });
            clearTimeout(id);
            
            if (!queryRes.ok) throw new Error('External API failure');
            const historyData = await queryRes.json();
            
            let wdid = '';
            
            const revKeys = Object.keys(historyData)
                .filter(key => key.startsWith('rev:'))
                .sort((a, b) => {
                    const numA = parseInt(a.split(':')[1], 10);
                    const numB = parseInt(b.split(':')[1], 10);
                    return numB - numA;
                });
            
            const top10Keys = revKeys.slice(0, 10);

            for (const key of top10Keys) {
                const rev = historyData[key];
                if (rev.comment && rev.comment.trim() === tempRecord.verifyCode) {
                    wdid = rev.username; 
                    break;
                }
            }

            if (wdid) {
                await prisma.tempReg.update({
                    where: { username },
                    data: { wdid }
                });
                return res.status(200).json({ wdid });
            } else {
                return res.status(400).json({ error: '未检测到匹配的验证记录，请确认已在页面摘要中填写验证码并保存' });
            }
            
        } catch (err) {
            console.error('External verification error:', err);
            return res.status(500).json({ error: '外部验证接口同步失败或超时' });
        }
    }

    if (action === 'submit') {
        if (!email || !code) {
            return res.status(400).json({ error: '电子邮箱与验证码不能为空' });
        }

        const record = await prisma.verificationCode.findUnique({ where: { email } });
        if (!record) {
            return res.status(400).json({ error: '验证码记录不存在' });
        }
        if (record.code !== code) {
            return res.status(400).json({ error: '验证码无效' });
        }
        if (new Date() > record.expiresAt) {
            return res.status(400).json({ error: '验证码已过期，请重新获取' });
        }

        const tempRecord = await prisma.tempReg.findUnique({ where: { username } });
        
        if (!tempRecord || !tempRecord.wdid || tempRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: '注册会话已失效' });
        }

        try {
            await prisma.$transaction([
                prisma.user.create({
                    data: {
                        username: username,
                        wikidotAccount: tempRecord.wdid,
                        password: tempRecord.password,
                        email: email,
                        balance: 10000
                    }
                }),
                prisma.tempReg.delete({
                    where: { username }
                }),
                prisma.verificationCode.delete({
                    where: { email }
                })
            ]);
            return res.status(200).json({ message: '账号注册成功' });
        } catch (e) {
            return res.status(500).json({ error: '用户数据入库失败' });
        }
    }

    return res.status(400).json({ error: '无效的操作请求' });
}