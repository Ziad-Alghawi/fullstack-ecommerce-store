import type { AuthUser } from '../middleware/auth.ts';
import type { CouponModel } from '../models/Coupon.ts';

// What the middleware adds to a request
declare global {
  namespace Express {
    interface Request {
      // requireVisitor and requireUser: the signed-in user, or null for a guest
      user?: AuthUser | null;
      // requireVisitor: whose cart and orders to use. Only read by routes behind it
      visitorId: string;
      // readCoupon: the valid coupon the customer typed, or null without one
      coupon?: CouponModel | null;
    }
  }
}

export {};
