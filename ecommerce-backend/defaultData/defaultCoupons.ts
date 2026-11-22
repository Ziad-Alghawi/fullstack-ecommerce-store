import type { CreationAttributes } from 'sequelize';
import type { CouponModel } from '../models/Coupon.ts';

export const defaultCoupons: CreationAttributes<CouponModel>[] = [
  {
    code: 'WELCOME10',
    percentOff: 10,
    expiresAt: null,
    active: true,
    featured: true
  }
];
