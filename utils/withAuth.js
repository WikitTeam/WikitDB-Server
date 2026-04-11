import { verifyToken } from './auth';
import prisma from '../lib/prisma';

/**
 * 通用用户鉴权包装器
 * 1. 登录校验
 * 2. 账号状态校验 (Ban/Active)
 */
export function withAuth(handler) {
  return async (req, res) => {
    try {
      const decoded = verifyToken(req);
      if (!decoded || !decoded.username) {
        return res.status(401).json({ error: '会话已过期，请重新登录' });
      }

      const user = await prisma.user.findUnique({ 
        where: { username: decoded.username },
        select: {
          id: true,
          username: true,
          status: true,
          isAdmin: true,
          balance: true
        }
      });

      if (!user) {
        return res.status(401).json({ error: '账号不存在' });
      }

      if (user.status === 'banned') {
        return res.status(403).json({ error: '账号已被封禁，无法执行该操作' });
      }

      // 将用户信息挂载到 req.user 上
      req.user = user;
      
      return await handler(req, res);
    } catch (error) {
      console.error('Auth Middleware Error:', error);
      return res.status(500).json({ error: '系统身份验证异常' });
    }
  };
}
