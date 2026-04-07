import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '请求方法不允许' });
    }

    const { email } = req.body;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: '请提供有效的邮箱地址' });
    }

    try {
        const existingUser = await prisma.user.findFirst({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: '该邮箱已被注册' });
        }

        // 安全优化：拦截接口狂刷
        // 数据库里的过期时间是当前时间 + 10分钟。
        // 如果过期时间距离现在大于 9分钟（即发信时间还在1分钟以内），说明请求太频繁
        const existingCode = await prisma.verificationCode.findUnique({ where: { email } });
        if (existingCode) {
            const timeRemaining = new Date(existingCode.expiresAt).getTime() - Date.now();
            if (timeRemaining > 9 * 60 * 1000) {
                return res.status(429).json({ error: '请求过于频繁，请等待 60 秒后再获取' });
            }
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.verificationCode.upsert({
            where: { email },
            update: { code, expiresAt },
            create: { email, code, expiresAt },
        });

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: `"WikitDB" <${process.env.SMTP_USER}>`,
            to: email,
            subject: '【WikitDB】您的注册验证码',
            html: `
                <div style="padding: 20px; background: #111827; color: #fff; border-radius: 10px;">
                    <h2 style="color: #818cf8;">欢迎注册 WikitDB</h2>
                    <p style="color: #d1d5db;">您的验证码是：<strong style="font-size: 24px; color: #fff;">${code}</strong></p>
                    <p style="color: #9ca3af; font-size: 12px;">该验证码在 10 分钟内有效，请勿泄露给他人。</p>
                </div>
            `,
        });

        return res.status(200).json({ message: '验证码已发送至您的邮箱' });
    } catch (error) {
        console.error('发信异常:', error);
        return res.status(500).json({ error: '发信服务异常，请联系管理员' });
    }
}