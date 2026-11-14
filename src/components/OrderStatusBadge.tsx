import { getStatusLabel } from '../utils/orderStatus';
import type { Order } from '../types/store';

export function OrderStatusBadge({ order }: { order: Pick<Order, 'status' | 'paymentMethod'> }) {
  return (
    <span className={`status-badge status-badge-${order.status}`} data-testid="order-status">
      {getStatusLabel(order)}
    </span>
  );
}
