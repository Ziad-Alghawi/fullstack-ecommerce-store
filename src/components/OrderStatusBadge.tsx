import { ORDER_STATUS_LABELS } from '../utils/orderStatus';
import type { OrderStatus } from '../types/store';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`status-badge status-badge-${status}`} data-testid="order-status">
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
