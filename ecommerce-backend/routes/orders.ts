import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { Order, type OrderModel, type PaymentMethod } from '../models/Order.ts';
import { Product } from '../models/Product.ts';
import { DeliveryOption, estimateDeliveryTimeMs } from '../models/DeliveryOption.ts';
import { CartItem } from '../models/CartItem.ts';
import { calculatePaymentSummary } from './paymentSummary.ts';
import { readCoupon } from '../middleware/coupon.ts';
import { rejectInvalidId } from '../utils/isUuid.ts';
import { getStockShortage, giveBackStock, takeStock, type StockItem } from '../utils/stock.ts';
import type { AuthUser } from '../middleware/auth.ts';
import { refusal, sendRefusal } from '../utils/refusal.ts';
import { changeStatus } from '../utils/orderStatus.ts';
import { maskEmail } from '../utils/maskEmail.ts';
import { checkoutLimit } from '../middleware/rateLimits.ts';

const router = express.Router();

router.param('orderId', rejectInvalidId('Order not found'));

// Keeps one visitor from filling the shared database. MAX_ORDERS can lower it, for example in tests
const MAX_ORDERS = Number(process.env.MAX_ORDERS) || 50;

// A cart item, or a line of a paid Stripe session
export interface OrderItem extends StockItem {
  deliveryOptionId: string;
}

async function withProductDetails(order: OrderModel) {
  const products = await Promise.all(order.products.map(async (orderProduct) => ({
    ...orderProduct,
    product: await Product.findByPk(orderProduct.productId, { paranoid: false })
  })));
  return { ...order.toJSON(), products };
}

router.get('/', asyncHandler(async (req, res) => {
  const expand = req.query.expand;
  const orders = await Order.unscoped().findAll({
    where: { visitorId: req.visitorId },
    order: [['orderTimeMs', 'DESC']]
  });

  res.json(expand === 'products' ? await Promise.all(orders.map(withProductDetails)) : orders);
}));

// Why the visitor can't order their cart, or null when they can
export async function getOrderRefusal(visitorId: string, cartItems: StockItem[]) {
  if (cartItems.length === 0) {
    return { status: 400, ...refusal('emptyCart', 'Cart is empty') };
  }
  if (await Order.count({ where: { visitorId } }) >= MAX_ORDERS) {
    return {
      status: 409,
      ...refusal('orderLimit', `This demo store keeps up to ${MAX_ORDERS} orders per visitor, and you've reached the limit.`, { max: MAX_ORDERS })
    };
  }
  const shortage = await getStockShortage(cartItems);
  return shortage && { status: 409, ...shortage };
}

router.post('/', checkoutLimit, readCoupon, asyncHandler(async (req, res) => {
  const cartItems = await CartItem.findAll({ where: { visitorId: req.visitorId } });

  const orderRefusal = await getOrderRefusal(req.visitorId, cartItems);
  if (orderRefusal) {
    return sendRefusal(res, orderRefusal);
  }

  const { totalCostCents } = await calculatePaymentSummary(cartItems, req.coupon ?? null);
  // Another order may have taken the last ones since the check above
  if (!await takeStock(cartItems)) {
    return res.status(409).json(await getStockShortage(cartItems));
  }

  let order;
  try {
    order = await createOrder(req.visitorId, cartItems, { totalCostCents, customerName: getCustomerName(req.user) });
  } catch (error) {
    await giveBackStock(cartItems);
    throw error;
  }

  await CartItem.destroy({ where: { visitorId: req.visitorId } });

  res.status(201).json(order);
}));

// What the admin orders page shows for the customer, saved with the order. Null for a guest
export function getCustomerName(user: AuthUser | null | undefined) {
  return user ? maskEmail(user.email) : null;
}

// Items are { productId, quantity, deliveryOptionId }, from the cart or from a paid Stripe session
interface NewOrder {
  totalCostCents: number;
  paymentMethod?: PaymentMethod;
  stripeSessionId?: string | null;
  customerName?: string | null;
}

export async function createOrder(visitorId: string, items: OrderItem[], {
  totalCostCents, paymentMethod = 'delivery', stripeSessionId = null, customerName = null
}: NewOrder) {
  const products = await Promise.all(items.map(async ({ productId, quantity, deliveryOptionId }) => {
    const deliveryOption = await DeliveryOption.findByPk(deliveryOptionId);
    if (!deliveryOption) {
      throw new Error(`Delivery option ${deliveryOptionId} doesn't exist.`);
    }
    return { productId, quantity, estimatedDeliveryTimeMs: estimateDeliveryTimeMs(deliveryOption) };
  }));

  return Order.create({
    orderTimeMs: Date.now(),
    totalCostCents,
    products,
    paymentMethod,
    status: 'processing',
    stripeSessionId,
    customerName,
    visitorId
  });
}

router.get('/:orderId', asyncHandler<{ orderId: string }>(async (req, res) => {
  const { orderId } = req.params;
  const expand = req.query.expand;

  // Another visitor's order is "not found", the same as an order that doesn't exist
  const order = await Order.findOne({ where: { id: orderId, visitorId: req.visitorId } });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json(expand === 'products' ? await withProductDetails(order) : order);
}));

// Customers can cancel an order until it ships, which refunds a card payment and puts its items back in stock
router.post('/:orderId/cancel', checkoutLimit, asyncHandler<{ orderId: string }>(async (req, res) => {
  const order = await Order.findOne({ where: { id: req.params.orderId, visitorId: req.visitorId } });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const statusRefusal = await changeStatus(order, 'cancelled');
  if (statusRefusal) {
    return sendRefusal(res, statusRefusal);
  }

  res.json(order);
}));

export default router;
