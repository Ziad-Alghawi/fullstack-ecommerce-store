import { Order } from '../models/Order.js';
import { giveBackStock } from './stock.js';

// Where an order can go from each status. Delivered and cancelled orders stay as they are
const NEXT_STATUSES = {
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

// Why the order can't move to the status, or null when it can
function getStatusChangeRefusal(order, status) {
  if (status === 'cancelled' && order.paymentMethod === 'card') {
    return "Orders paid by card can't be cancelled, as the payment would need a refund.";
  }
  if (!NEXT_STATUSES[order.status].includes(status)) {
    return NEXT_STATUSES[order.status].length === 0
      ? `This order is already ${order.status}.`
      : `A ${order.status} order can't be marked ${status}.`;
  }
  return null;
}

// The statuses an admin can move the order to now
export function getNextStatuses(order) {
  return NEXT_STATUSES[order.status].filter((status) => !getStatusChangeRefusal(order, status));
}

// Moves the order to the status, or returns why it can't. One statement checks and changes it, so
// two requests at once can't both cancel the order and give its stock back twice
export async function changeStatus(order, status) {
  const refusal = getStatusChangeRefusal(order, status);
  if (refusal) {
    return refusal;
  }
  const [updatedRows] = await Order.update({ status }, { where: { id: order.id, status: order.status } });
  if (updatedRows === 0) {
    return 'This order was changed meanwhile. Reload the page to see it.';
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
