import type { Ref } from 'react';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';
import { useI18n } from '../../hooks/useI18n';
import type { Order } from '../../types/store';

interface OrderHeaderProps {
  order: Order;
  // Where keyboard focus goes after the order is cancelled
  statusRef: Ref<HTMLDivElement>;
}

export function OrderHeader({ order, statusRef }: OrderHeaderProps) {
  const { t, formatMoney, formatDayAndMonth } = useI18n();

  return (
    <div className="order-header">
      <div>
        <div className="order-header-label">{t.orders.placed}</div>
        <div data-testid="order-date">
          {formatDayAndMonth(order.orderTimeMs)}
        </div>
      </div>

      <div>
        <div className="order-header-label">{t.orders.total}</div>
        <div data-testid="order-total">
          {formatMoney(order.totalCostCents)}
        </div>
      </div>

      <div>
        <div className="order-header-label">{t.orders.payment}</div>
        <div data-testid="order-payment">
          {order.paymentMethod === 'card' ? t.orders.paidByCard : t.orders.payOnDelivery}
        </div>
      </div>

      <div ref={statusRef} tabIndex={-1}>
        <div className="order-header-label">{t.orders.status}</div>
        <OrderStatusBadge order={order} />
      </div>

      <div className="order-id">
        <div className="order-header-label">{t.orders.orderId}</div>
        <div data-testid="order-id">
          {order.id}
        </div>
      </div>
    </div>
  );
}
