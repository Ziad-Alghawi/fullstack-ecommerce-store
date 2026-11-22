import type { NextFunction, Request, Response } from 'express';
import { getUserId } from './auth.ts';

// Supabase user IDs, comma-separated. Being an admin is only ever decided from a verified token
const adminIds = new Set((process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim().toLowerCase())
  .filter(Boolean));

export function isAdmin(userId: string | null) {
  return userId !== null && adminIds.has(userId);
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Please log in as an admin.' });
    }
    if (!isAdmin(userId)) {
      return res.status(403).json({ error: 'Only admins can do this.' });
    }
  } catch (error) {
    return next(error);
  }
  next();
}
