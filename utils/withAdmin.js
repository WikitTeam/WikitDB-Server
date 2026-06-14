import { getAdminUser } from './adminAuth';
import { validateOrigin } from './csrf';

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
      if (!validateOrigin(req)) {
        return res.status(403).json({ error: '请求来源不合法' });
      }

      const adminUser = await getAdminUser(req);
      if (!adminUser) {
        return res.status(401).json({ error: '未登录，请先登录' });
      }

      req.admin = adminUser;

      return await handler(req, res);
    } catch (error) {
      console.error('Admin API Error:', error);
      return res.status(500).json({ error: '管理后台接口异常' });
    }
  };
}
