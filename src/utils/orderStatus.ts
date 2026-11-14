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

type OrderState = Pick<Order, 'status' | 'paymentMethod'>;

// A cancelled card order was refunded, which is what the customer and the admin want to know
export function getStatusLabel({ status, paymentMethod }: OrderState) {
  return status === 'cancelled' && paymentMethod === 'card' ? 'Refunded' : ORDER_STATUS_LABELS[status];
}

// Until a package arrives, its estimated delivery date
export function describeDelivery(order: OrderState, estimatedDeliveryTimeMs: number) {
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return getStatusLabel(order);
  }
  return `Arriving on ${formatDeliveryDate(estimatedDeliveryTimeMs)}`;
}

// The API refuses an order that has shipped. A card order is refunded when it's cancelled
export function canCancel(order: Order) {
  return order.status === 'processing';
}
