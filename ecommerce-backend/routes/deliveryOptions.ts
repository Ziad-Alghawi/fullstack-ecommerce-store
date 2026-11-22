import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { DeliveryOption, estimateDeliveryTimeMs } from '../models/DeliveryOption.ts';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const expand = req.query.expand;
  const deliveryOptions = await DeliveryOption.findAll();

  res.json(expand === 'estimatedDeliveryTime'
    ? deliveryOptions.map((option) => ({
      ...option.toJSON(),
      estimatedDeliveryTimeMs: estimateDeliveryTimeMs(option)
    }))
    : deliveryOptions);
}));

export default router;
