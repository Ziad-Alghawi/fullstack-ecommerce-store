import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { getUserId } from '../middleware/auth.ts';
import { isAdmin } from '../middleware/admin.ts';
import { authLimit } from '../middleware/rateLimits.ts';

const router = express.Router();

// Only tells the frontend what to show. Admin routes still check the token themselves
router.get('/', authLimit, asyncHandler(async (req, res) => {
  const userId = await getUserId(req);
  res.json({ userId, isAdmin: isAdmin(userId) });
}));

export default router;
