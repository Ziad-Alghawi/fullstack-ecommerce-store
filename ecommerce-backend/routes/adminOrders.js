import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { Account } from '../models/Account.js';
import { ORDER_STATUSES, Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { rejectInvalidId } from '../utils/isUuid.js';
import { changeStatus, getNextStatuses, getStatusChangeRefusal } from '../utils/orderStatus.js';

const router = express.Router();

const PAYMENT_METHODS = ['card', 'delivery'];
// The page shows the newest orders, and the filters narrow them down
const MAX_ORDERS_SHOWN = 100;

router.param('orderId', rejectInvalidId('Order not found'));

// The filters as a database query, or the reason they're refused
function readFilters({ status = '', paymentMethod = '' }) {
  if (status && !ORDER_STATUSES.includes(status)) {
    return { error: `Status must be one of: ${ORDER_STATUSES.join(', ')}` };
  }
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    return { error: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}` };
  }
  return { where: { ...(status && { status }), ...(paymentMethod && { paymentMethod }) } };
}

// Orders from before customer names were saved show whether a logged in user placed them
async function toAdminOrders(orders) {
  const productIds = [...new Set(orders.flatMap((order) => order.products.map(({ productId }) => productId)))];
  const products = await Product.findAll({ where: { id: productIds }, attributes: ['id', 'name'], paranoid: false });
  const productNames = new Map(products.map(({ id, name }) => [id, name]));
  const unnamedVisitorIds = orders.filter((order) => !order.customerName).map((order) => order.visitorId);
  const accounts = await Account.findAll({ where: { id: unnamedVisitorIds }, attributes: ['id'] });
  const accountIds = new Set(accounts.map(({ id }) => id));

  return orders.map((order) => ({
    id: order.id,
    orderTimeMs: order.orderTimeMs,
    customerName: order.customerName ?? (accountIds.has(order.visitorId) ? 'Customer' : 'Guest'),
    items: order.products.map(({ productId, quantity }) => ({ name: productNames.get(productId), quantity })),
    totalCostCents: order.totalCostCents,
    paymentMethod: order.paymentMethod,
    status: order.status,
    nextStatuses: getNextStatuses(order)
  }));
}

router.get('/', asyncHandler(async (req, res) => {
  const { error, where } = readFilters(req.query);
  if (error) {
    return res.status(400).json({ error });
  }

  const { rows, count } = await Order.unscoped().findAndCountAll({
    where,
    order: [['orderTimeMs', 'DESC']],
    limit: MAX_ORDERS_SHOWN
  });
  res.json({ orders: await toAdminOrders(rows), total: count });
}));

router.patch('/:orderId', asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }

  const refusal = getStatusChangeRefusal(order, status);
  if (refusal || !await changeStatus(order, status)) {
    return res.status(409).json({ error: refusal ?? 'This order changed meanwhile. Reload the orders to see it.' });
  }

  const [adminOrder] = await toAdminOrders([order]);
  res.json(adminOrder);
}));

export default router;
