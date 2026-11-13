import axios from 'axios';
import dayjs from 'dayjs';
import { useState, type ReactNode } from 'react';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import { formatMoney } from '../../utils/money';
import { ORDER_STATUS_LABELS } from '../../utils/orderStatus';
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
  const [changeStatus, isChanging] = useAction(async () => {
    const response = await axios.patch<AdminOrder>(`/api/admin/orders/${order.id}`, { status });
    onChanged(response.data);
    showToast(`Order ${shortId(order)} is now ${ORDER_STATUS_LABELS[status].toLowerCase()}`);
  });

  return (
    <button className={className} type="button" disabled={isChanging} onClick={changeStatus} aria-label={label}
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
  const id = shortId(order);
  const canCancel = order.nextStatuses.includes('cancelled');

  return (
    <tr data-testid="admin-order-row">
      <td className="admin-order-cell-id">
        <div className="admin-cell-name">{dayjs(order.orderTimeMs).format('MMM D, YYYY h:mm A')}</div>
        <div className="admin-order-id">#{id}</div>
      </td>
      <td data-label="Customer">{order.customerName}</td>
      <td>
        <ul className="admin-order-items">
          {order.items.map(({ name, quantity }) => <li key={name}>{quantity} × {name}</li>)}
        </ul>
      </td>
      <td className="admin-cell-price" data-label="Total">{formatMoney(order.totalCostCents)}</td>
      <td className="admin-order-cell-payment" data-label="Payment">{order.paymentMethod === 'card' ? 'Card' : 'On delivery'}</td>
      <td className="admin-order-cell-status"><OrderStatusBadge status={order.status} /></td>
      <td className="admin-cell-actions">
        {/* The keys swap in new buttons, so a double click on Cancel can't also confirm it */}
        {isConfirmingCancel && canCancel ? (
          <div key="confirm" className="admin-actions" role="group" aria-label={`Cancel order ${id}?`}>
            <span className="admin-confirm-text">Cancel and restock?</span>
            <StatusButton order={order} status="cancelled" label={`Cancel order ${id}`} className="button-danger"
              onChanged={onChanged}>
              Cancel order
            </StatusButton>
            <button className="button-secondary" type="button" autoFocus onClick={() => setIsConfirmingCancel(false)}>
              Keep
            </button>
          </div>
        ) : (
          <div key="actions" className="admin-actions">
            {order.nextStatuses.includes('shipped') && (
              <StatusButton order={order} status="shipped" label={`Mark order ${id} shipped`} onChanged={onChanged}>
                Mark shipped
              </StatusButton>
            )}
            {order.nextStatuses.includes('delivered') && (
              <StatusButton order={order} status="delivered" label={`Mark order ${id} delivered`} onChanged={onChanged}>
                Mark delivered
              </StatusButton>
            )}
            {canCancel && (
              <button className="button-secondary" type="button" onClick={() => setIsConfirmingCancel(true)}
                aria-label={`Cancel order ${id}`} data-testid="admin-order-cancel-button">
                Cancel
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
