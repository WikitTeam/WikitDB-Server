import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { action, username, password, email, code } = req.body;

    if (!username) return res.status(400).json({ error: '缺少显示名称' });

    if (action === 'start') {
        if (!password) return res.status(400).json({ error: '缺少密码' });

        const exists = await prisma.user.findUnique({ where: { username } });
        if (exists) return res.status(400).json({ error: '该名称已被占用' });

        if (email) {
            const emailExists = await prisma.user.findFirst({ where: { email } });
            if (emailExists) return res.status(400).json({ error: '该邮箱已被注册' });
        }

        const verifyCode = 'WIKIT-' + Math.random().toString(36).substring(2, 8).toUpperCase();

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
            return res.status(500).json({ error: '验证码生成失败' });
        }
    }

    if (action === 'check') {
        const tempRecord = await prisma.tempReg.findUnique({ where: { username } });
        
        if (!tempRecord || tempRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: '验证会话已过期 (超过24小时) 或不存在' });
        }

        try {
            const queryRes = await fetch('https://wikit.unitreaty.org/wikidot/pagehistory?wiki=wikkit&page=https://wikkit.wikidot.com/wikitdb:verify');
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
                return res.status(400).json({ error: '未查到匹配的验证记录，请确保已保存并在摘要中填写了验证码' });
            }
            
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: '查询绑定状态失败，解析接口数据出错' });
        }
    }

    if (action === 'submit') {
        if (!email || !code) {
            return res.status(400).json({ error: '邮箱和验证码不能为空' });
        }

        const record = await prisma.verificationCode.findUnique({ where: { email } });
        if (!record) {
            return res.status(400).json({ error: '未找到该邮箱的验证码记录' });
        }
        if (record.code !== code) {
            return res.status(400).json({ error: '验证码错误' });
        }
        if (new Date() > record.expiresAt) {
            return res.status(400).json({ error: '验证码已过期，请重新获取' });
        }

        const tempRecord = await prisma.tempReg.findUnique({ where: { username } });
        
        if (!tempRecord || !tempRecord.wdid || tempRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: '数据已过期或未完成验证' });
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
            return res.status(200).json({ message: '注册成功' });
        } catch (e) {
            return res.status(500).json({ error: '入库失败' });
        }
    }

    return res.status(400).json({ error: '未知操作' });
}