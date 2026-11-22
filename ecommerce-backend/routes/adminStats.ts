import express from 'express';
import { Op } from 'sequelize';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { Order } from '../models/Order.ts';
import { Product } from '../models/Product.ts';

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;
// The same limit as the shop's "Only 5 left"
const LOW_STOCK = 5;
const TOP_PRODUCT_COUNT = 5;

// Units sold of each product, most first. Cancelled orders didn't sell anything
async function getTopProducts() {
  const orders = await Order.unscoped().findAll({
    where: { status: { [Op.ne]: 'cancelled' } },
    attributes: ['products']
  });
  const unitsSold = new Map<string, number>();
  for (const { productId, quantity } of orders.flatMap((order) => order.products)) {
    unitsSold.set(productId, (unitsSold.get(productId) ?? 0) + quantity);
  }

  const top = [...unitsSold].sort(([, a], [, b]) => b - a).slice(0, TOP_PRODUCT_COUNT);
  const products = await Product.findAll({ where: { id: top.map(([id]) => id) }, paranoid: false });
  return top.flatMap(([id, units]) => {
    const product = products.find(({ id: productId }) => productId === id);
    return product ? [{ id, name: product.name, image: product.image, unitsSold: units }] : [];
  });
}

// Rolling windows rather than calendar days, so the numbers don't depend on the server's time zone
router.get('/', asyncHandler(async (req, res) => {
  const now = Date.now();
  const placedSince = (ms: number) => ({ orderTimeMs: { [Op.gte]: now - ms } });
  const lastWeekSold = { ...placedSince(7 * DAY_MS), status: { [Op.ne]: 'cancelled' } };

  res.json({
    ordersLastDay: await Order.count({ where: placedSince(DAY_MS) }),
    ordersLastWeek: await Order.count({ where: placedSince(7 * DAY_MS) }),
    // Unscoped, as Postgres refuses the default order by creation next to a sum
    revenueLastWeekCents: await Order.unscoped().sum('totalCostCents', { where: lastWeekSold }) ?? 0,
    // Unscoped, as the default order by creation would come first
    lowStockProducts: await Product.unscoped().findAll({
      where: { stock: { [Op.lte]: LOW_STOCK } },
      attributes: ['id', 'name', 'stock'],
      order: [['stock', 'ASC'], ['name', 'ASC']]
    }),
    topProducts: await getTopProducts()
  });
}));

export default router;
