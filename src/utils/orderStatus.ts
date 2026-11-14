import type { I18n } from '../i18n/i18n';
import type { Messages } from '../i18n/en';
import type { Order, OrderStatus } from '../types/store';

export const ORDER_STATUSES: OrderStatus[] = ['processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_METHODS: Order['paymentMethod'][] = ['card', 'delivery'];

type OrderState = Pick<Order, 'status' | 'paymentMethod'>;

// A cancelled card order was refunded, which is what the customer and the admin want to know
export function getStatusLabel({ status, paymentMethod }: OrderState, t: Messages) {
  return status === 'cancelled' && paymentMethod === 'card' ? t.orderStatus.refunded : t.orderStatus[status];
}

// Until a package arrives, its estimated delivery date
export function describeDelivery(order: OrderState, estimatedDeliveryTimeMs: number, { t, formatDeliveryDate }: I18n) {
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return getStatusLabel(order, t);
  }
  return t.orders.arriving(formatDeliveryDate(estimatedDeliveryTimeMs));
}

// The API refuses an order that has shipped. A card order is refunded when it's cancelled
export function canCancel(order: Order) {
  return order.status === 'processing';
}
