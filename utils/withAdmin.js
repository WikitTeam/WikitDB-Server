import { verifyToken } from './auth';
import prisma from '../lib/prisma';

const SUPER_ADMIN = 'Laimu_slime';

/**
 * Admin 权限包装器
 * 自动处理：
 * 1. 登录校验 (401)
 * 2. 管理员身份校验 (403)
 * 3. 错误处理 (500)
 */
export function withAdmin(handler) {
  return async (req, res) => {
    try {
      const decoded = verifyToken(req);
      if (!decoded || !decoded.username) {
        return res.status(401).json({ error: '未登录，请先登录' });
      }

      const adminUser = await prisma.user.findUnique({ where: { username: decoded.username } });
      if (!adminUser || (!adminUser.isAdmin && adminUser.username !== SUPER_ADMIN)) {
        return res.status(403).json({ error: '权限不足：仅限管理员访问' });
      }

      // 将解析出的管理员信息挂载到 req 上，方便 handler 使用
      req.admin = adminUser;
      
      return await handler(req, res);
    } catch (error) {
      console.error('Admin API Error:', error);
      return res.status(500).json({ error: '管理后台接口异常' });
    }
  };
}
