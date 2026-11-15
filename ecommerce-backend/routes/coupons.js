import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { couponLimit, findFeaturedCoupon, findValidCoupon } from '../middleware/coupon.js';

const router = express.Router();

// Lets checkout say whether a code works before using it. Only says what a valid code gives
router.get('/:code', couponLimit, asyncHandler(async (req, res) => {
  const { coupon, couponRefusal } = await findValidCoupon(req.params.code);
  if (couponRefusal) {
    return res.status(404).json(couponRefusal);
  }
  res.json({ code: coupon.code, percentOff: coupon.percentOff });
}));

// Its own path, as /api/coupons/featured would hide a coupon with the code FEATURED
export const getFeaturedCoupon = asyncHandler(async (req, res) => {
  const coupon = await findFeaturedCoupon();
  res.json(coupon ? { code: coupon.code, percentOff: coupon.percentOff } : null);
});

export default router;
