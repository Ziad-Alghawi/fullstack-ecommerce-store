import { useRef } from 'react';
import { OrderHeader } from './OrderHeader';
import { OrderDetailsGrid } from './OrderDetailsGrid';
import { CancelOrderButton } from './CancelOrderButton';
import { canCancel } from '../../utils/orderStatus';
import type { LoadCart, Order } from '../../types/store';

interface OrderCardProps {
  order: Order;
  loadCart: LoadCart;
  onCancelled: (order: Order) => void;
}

function OrderCard({ order, loadCart, onCancelled }: OrderCardProps) {
  const statusRef = useRef<HTMLDivElement>(null);

  // The cancel buttons go away, so keyboard focus moves to the new status
  const showCancelled = (cancelledOrder: Order) => {
    onCancelled(cancelledOrder);
    statusRef.current?.focus();
  };

  return (
    <div className="order-container card" data-testid="order-container">
      <OrderHeader order={order} statusRef={statusRef} />

      <OrderDetailsGrid order={order} loadCart={loadCart} />

      {canCancel(order) && (
        <div className="order-footer">
          <CancelOrderButton order={order} onCancelled={showCancelled} />
        </div>
      )}
    </div>
  );
}

interface OrderGridProps {
  orders: Order[];
  loadCart: LoadCart;
  onCancelled: (order: Order) => void;
}

export function OrderGrid({ orders, loadCart, onCancelled }: OrderGridProps) {
  return (
    <div className="orders-grid">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} loadCart={loadCart} onCancelled={onCancelled} />
      ))}
    </div>
  );
}
