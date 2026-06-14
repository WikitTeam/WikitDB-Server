import prisma from '../lib/prisma';
import { verifyToken } from './auth';

export async function getAdminUser(req) {
    const decoded = verifyToken(req);
    if (!decoded?.username) return null;

    const user = await prisma.user.findUnique({
        where: { username: decoded.username }
    });

    if (!user || user.status !== 'active' || !user.isAdmin) return null;
    return user;
}
