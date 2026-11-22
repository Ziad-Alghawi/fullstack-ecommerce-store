import axios from 'axios';
import { useRef, useState, type ReactNode } from 'react';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import { getStatusLabel } from '../../utils/orderStatus';
import type { AdminOrder, OrderStatus } from '../../types/store';

// Enough of the ID to tell orders apart on the page and in a toast
function shortId(order: AdminOrder) {
  return order.id.slice(0, 8);
}

interface StatusButtonProps {
  order: AdminOrder;
  status: OrderStatus;
  label: string;
  className?: string;
  onChanged: (order: AdminOrder) => void;
  children: ReactNode;
}

function StatusButton({ order, status, label, className = 'button-secondary', onChanged, children }: StatusButtonProps) {
  const showToast = useToast();
  const { t } = useI18n();
  const [changeStatus, isChanging] = useAction(async () => {
    const response = await axios.patch<AdminOrder>(`/api/admin/orders/${order.id}`, { status });
    onChanged(response.data);
    showToast(t.admin.orderList.changed(shortId(order), getStatusLabel(response.data, t)));
  });

  // aria-disabled rather than disabled, which would take keyboard focus off the button. useAction ignores clicks meanwhile
  return (
    <button className={className} type="button" aria-disabled={isChanging} onClick={changeStatus} aria-label={label}
      data-testid={`admin-order-${status}-button`}>
      {isChanging && <ButtonSpinner />}
      {children}
    </button>
  );
}

interface AdminOrderRowProps {
  order: AdminOrder;
  onChanged: (order: AdminOrder) => void;
}

export function AdminOrderRow({ order, onChanged }: AdminOrderRowProps) {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const { t, formatMoney, formatDateTime } = useI18n();
  // The button for moving an order forward. Cancelling has a button of its own, as it asks first
  const advanceLabels: Partial<Record<OrderStatus, string>> = {
    shipped: t.admin.orderList.markShipped,
    delivered: t.admin.orderList.markDelivered
  };
  const statusCell = useRef<HTMLTableCellElement>(null);
  const id = shortId(order);
  const canCancel = order.nextStatuses.includes('cancelled');
  const nextStatus = order.nextStatuses.find((status) => advanceLabels[status]);

  // The button that was clicked goes away when nothing more can be done, so keyboard focus goes to the new status
  const showChange = (changedOrder: AdminOrder) => {
    onChanged(changedOrder);
    if (changedOrder.nextStatuses.length === 0) {
      statusCell.current?.focus();
    }
  };

  return (
    <tr data-testid="admin-order-row">
      <td className="admin-order-cell-id">
        <div className="admin-cell-name">{formatDateTime(order.orderTimeMs)}</div>
        <div className="admin-order-id">#{id}</div>
      </td>
      <td data-label={t.admin.orderList.customer}>{order.customerName}</td>
      <td>
        <ul className="admin-order-items">
          {order.items.map(({ name, quantity }) => <li key={name}>{quantity} × {name}</li>)}
        </ul>
      </td>
      <td className="admin-cell-price" data-label={t.admin.orderList.total}>{formatMoney(order.totalCostCents)}</td>
      <td className="admin-order-cell-payment" data-label={t.admin.orderList.payment}>{t.paymentMethods[order.paymentMethod]}</td>
      <td className="admin-order-cell-status" ref={statusCell} tabIndex={-1}>
        <OrderStatusBadge order={order} />
      </td>
      <td className="admin-cell-actions">
        {/* The keys swap in new buttons, so a double click on Cancel can't also confirm it */}
        {isConfirmingCancel && canCancel ? (
          <div key="confirm" className="admin-actions" role="group" aria-label={t.admin.orderList.cancelGroup(id)}>
            <span className="admin-confirm-text">
              {order.paymentMethod === 'card' ? t.admin.orderList.refundQuestion : t.admin.orderList.cancelQuestion}
            </span>
            <StatusButton order={order} status="cancelled" label={t.admin.orderList.cancelLabel(id)} className="button-danger"
              onChanged={showChange}>
              {t.orders.cancelOrder}
            </StatusButton>
            <button className="button-secondary" type="button" autoFocus onClick={() => setIsConfirmingCancel(false)}>
              {t.common.keep}
            </button>
          </div>
        ) : (
          <div key="actions" className="admin-actions">
            {/* One button for shipping and then delivering, so it keeps keyboard focus */}
            {nextStatus && (
              <StatusButton order={order} status={nextStatus} label={t.admin.orderList.markLabel(id, nextStatus)}
                onChanged={showChange}>
                {advanceLabels[nextStatus]}
              </StatusButton>
            )}
            {canCancel && (
              <button className="button-secondary" type="button" onClick={() => setIsConfirmingCancel(true)}
                aria-label={t.admin.orderList.cancelLabel(id)} data-testid="admin-order-cancel-button">
                {t.admin.orderList.cancel}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
