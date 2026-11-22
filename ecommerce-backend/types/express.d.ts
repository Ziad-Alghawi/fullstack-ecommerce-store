import type { AuthUser } from '../middleware/auth.ts';
import type { CouponModel } from '../models/Coupon.ts';
import type { ProductModel } from '../models/Product.ts';
import type { ReviewModel } from '../models/Review.ts';

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
      // The reviews router: the product in the path, and the review for routes with a reviewId
      product?: ProductModel | null;
      review?: ReviewModel | null;
    }
  }
}

export {};
