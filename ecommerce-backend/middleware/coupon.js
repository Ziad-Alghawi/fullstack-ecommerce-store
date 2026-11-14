import { Coupon } from '../models/Coupon.js';
import { asyncHandler } from './asyncHandler.js';
import { limitTo } from './rateLimits.js';
import { refusal } from '../utils/refusal.js';

export function normalizeCouponCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

export function isExpired(coupon) {
  return coupon.expiresAt !== null && coupon.expiresAt <= new Date();
}

// The coupon a customer can use now, or why they can't
export async function findValidCoupon(code) {
  const normalizedCode = normalizeCouponCode(code);
  const coupon = normalizedCode && await Coupon.findOne({ where: { code: normalizedCode } });
  if (!coupon || !coupon.active) {
    return { couponRefusal: refusal('invalidCoupon', `${normalizedCode || 'This'} isn't a valid coupon code.`, { code: normalizedCode }) };
  }
  if (isExpired(coupon)) {
    return { couponRefusal: refusal('expiredCoupon', `The coupon ${normalizedCode} has expired.`, { code: normalizedCode }) };
  }
  return { coupon };
}

// The code the customer typed: in the path of a coupon lookup, the query of a GET or the body of a POST
function getTypedCode(req) {
  return req.params.code ?? (req.method === 'GET' ? req.query.couponCode : req.body?.couponCode);
}

// Every request with a code tells whether it exists, so they share one limit that makes guessing codes slow
export const couponLimit = limitTo(60, { skip: (req) => !normalizeCouponCode(getTypedCode(req)) });

// It's checked on every request, so a coupon that expires or is turned off between checkout and paying no longer counts
export const readCoupon = [couponLimit, asyncHandler(async (req, res, next) => {
  const code = getTypedCode(req);
  if (!normalizeCouponCode(code)) {
    req.coupon = null;
    return next();
  }

  const { coupon, couponRefusal } = await findValidCoupon(code);
  if (couponRefusal) {
    return res.status(400).json(couponRefusal);
  }
  req.coupon = coupon;
  next();
})];
