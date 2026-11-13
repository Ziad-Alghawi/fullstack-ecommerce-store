import { formatDeliveryDate } from './date';
import type { Order, OrderStatus } from '../types/store';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

// How the admin pages name each payment method
export const PAYMENT_METHOD_LABELS: Record<Order['paymentMethod'], string> = {
  card: 'Card',
  delivery: 'On delivery'
};

// Until a package arrives, its estimated delivery date
export function describeDelivery(status: OrderStatus, estimatedDeliveryTimeMs: number) {
  if (status === 'delivered' || status === 'cancelled') {
    return ORDER_STATUS_LABELS[status];
  }
  return `Arriving on ${formatDeliveryDate(estimatedDeliveryTimeMs)}`;
}

// The API refuses the rest: an order that has shipped, or one paid by card, which would need a refund
export function canCancel(order: Order) {
  return order.paymentMethod === 'delivery' && order.status === 'processing';
}
