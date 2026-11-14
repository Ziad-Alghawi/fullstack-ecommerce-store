import { useI18n } from '../hooks/useI18n';
import { getStatusLabel } from '../utils/orderStatus';
import type { Order } from '../types/store';

export function OrderStatusBadge({ order }: { order: Pick<Order, 'status' | 'paymentMethod'> }) {
  const { t } = useI18n();

  return (
    <span className={`status-badge status-badge-${order.status}`} data-testid="order-status">
      {getStatusLabel(order, t)}
    </span>
  );
}
