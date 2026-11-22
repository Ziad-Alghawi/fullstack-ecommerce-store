import type { NextFunction, Request, Response } from 'express';
import { Account } from '../models/Account.ts';
import { CartItem } from '../models/CartItem.ts';
import { Order } from '../models/Order.ts';
import { isUuid } from '../utils/isUuid.ts';
import { getUser } from './auth.ts';

// The database is shared and small, so only the most recent guests keep their
// cart and orders. Logged in users always keep theirs. MAX_VISITORS can lower it, for example in tests
const MAX_VISITORS = Number(process.env.MAX_VISITORS) || 500;

// Guest visitor IDs from least to most recently active. A Set keeps insertion order,
// so moving a visitor to the end on each request leaves the oldest one first
const visitors = new Set<string>();
const accountIds = new Set<string>();

async function rememberAccount(userId: string) {
  if (!accountIds.has(userId)) {
    // Parallel first requests may both insert, so a duplicate is fine
    await Account.bulkCreate([{ id: userId }], { ignoreDuplicates: true });
    accountIds.add(userId);
  }
}

function markActive(visitorId: string) {
  visitors.delete(visitorId);
  visitors.add(visitorId);
}

async function dropOldestVisitors() {
  while (visitors.size > MAX_VISITORS) {
    const oldest = visitors.values().next().value as string;
    visitors.delete(oldest);
    await CartItem.destroy({ where: { visitorId: oldest } });
    await Order.destroy({ where: { visitorId: oldest } });
  }
}

// A guest's cart and orders go to their account when they log in, and items already
// in the account's cart add up. The local SQLite file can't hold a transaction open,
// so the guest's item is removed first: a failure part way can't count it twice
async function moveToAccount(guestId: string, userId: string) {
  const userItems = await CartItem.findAll({ where: { visitorId: userId } });
  const guestItems = await CartItem.findAll({ where: { visitorId: guestId } });

  for (const guestItem of guestItems) {
    const userItem = userItems.find((item) => item.productId === guestItem.productId);
    if (userItem) {
      await guestItem.destroy();
      userItem.quantity += guestItem.quantity;
      await userItem.save();
    } else {
      guestItem.visitorId = userId;
      await guestItem.save();
    }
  }

  await Order.update({ visitorId: userId }, { where: { visitorId: guestId } });
  visitors.delete(guestId);
}

// Moves still running, so parallel requests right after logging in don't move the same cart twice
const moves = new Map<string, Promise<void>>();

function moveGuestOnce(guestId: string, userId: string) {
  if (!moves.has(guestId)) {
    moves.set(guestId, moveToAccount(guestId, userId).finally(() => moves.delete(guestId)));
  }
  return moves.get(guestId);
}

// After a restart, pick up the guests that are already in the database
export async function loadVisitors() {
  (await Account.findAll({ attributes: ['id'] })).forEach(({ id }) => accountIds.add(id));

  const attributes = ['visitorId', 'updatedAt'];
  const rows = [
    ...await CartItem.unscoped().findAll({ attributes }),
    ...await Order.unscoped().findAll({ attributes })
  ];

  rows.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  rows
    .filter((row) => !accountIds.has(row.visitorId))
    .forEach((row) => markActive(row.visitorId));
  await dropOldestVisitors();
}

// Cart and order routes need to know whose cart and orders to use: the signed-in
// user's, or else the guest's. Both are kept under visitorId and have the order limit
export async function requireVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    req.user = await getUser(req);
    const userId = req.user?.id;
    const sentGuestId = req.get('X-Visitor-Id');
    // The same ID in another case is the same visitor
    const guestId = isUuid(sentGuestId) ? sentGuestId.toLowerCase() : null;
    const visitorId = userId ?? guestId;
    if (!visitorId) {
      return res.status(400).json({ error: 'Missing or invalid X-Visitor-Id header' });
    }
    req.visitorId = visitorId;
    // A user's cart and orders are only for their token, never for their ID sent as a guest's
    if (!userId && accountIds.has(req.visitorId)) {
      return res.status(401).json({ error: 'Please log in to see this cart.' });
    }

    if (userId) {
      await rememberAccount(userId);
      // Only guests in the list can have a cart or orders, so most requests skip this
      if (guestId && guestId !== userId && visitors.has(guestId)) {
        await moveGuestOnce(guestId, userId);
      }
    } else {
      markActive(req.visitorId);
      await dropOldestVisitors();
    }
  } catch (error) {
    return next(error);
  }
  next();
}
