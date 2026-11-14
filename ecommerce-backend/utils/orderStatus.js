import { Order } from '../models/Order.js';
import { giveBackStock } from './stock.js';
import { refundCardOrder, stripe } from './stripe.js';

// Where an order can go from each status. Delivered and cancelled orders stay as they are
const NEXT_STATUSES = {
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

// Why the order can't move to the status, or null when it can
function getStatusChangeRefusal(order, status) {
  if (!NEXT_STATUSES[order.status].includes(status)) {
    return NEXT_STATUSES[order.status].length === 0
      ? `This order is already ${order.status}.`
      : `A ${order.status} order can't be marked ${status}.`;
  }
  if (status === 'cancelled' && order.paymentMethod === 'card' && !stripe) {
    return "Card payments can't be refunded right now, so this order can't be cancelled.";
  }
  return null;
}

// The statuses an admin can move the order to now
export function getNextStatuses(order) {
  return NEXT_STATUSES[order.status].filter((status) => !getStatusChangeRefusal(order, status));
}

// Moves the order to the status, or returns { status, error } with why it can't. One statement checks
// and changes it, so two requests at once can't both cancel the order and give its stock back twice.
// A card order is only cancelled once its payment is refunded
export async function changeStatus(order, status) {
  const refusal = getStatusChangeRefusal(order, status);
  if (refusal) {
    return { status: 409, error: refusal };
  }
  const isRefund = status === 'cancelled' && order.paymentMethod === 'card';
  if (isRefund) {
    const refundFailure = await refundCardOrder(order);
    if (refundFailure) {
      return refundFailure;
    }
  }
  const [updatedRows] = await Order.update({ status }, { where: { id: order.id, status: order.status } });
  if (updatedRows === 0) {
    await order.reload();
    if (isRefund && order.status !== 'cancelled') {
      console.error(`Order ${order.id} was refunded, but it was marked ${order.status} meanwhile.`);
    }
    return { status: 409, error: 'This order was changed meanwhile. Reload the page to see it.' };
  }
  if (status === 'cancelled') {
    await giveBackStock(order.products);
  }
  await order.reload();
  return null;
}

// Orders from before statuses were added are marked delivered once all their packages have arrived
export async function markArrivedOrdersDelivered() {
  const orders = await Order.unscoped().findAll({ attributes: ['id', 'products'] });
  const arrivedIds = orders
    .filter((order) => order.products.every((product) => product.estimatedDeliveryTimeMs <= Date.now()))
    .map((order) => order.id);
  if (arrivedIds.length > 0) {
    await Order.update({ status: 'delivered' }, { where: { id: arrivedIds } });
  }
}
