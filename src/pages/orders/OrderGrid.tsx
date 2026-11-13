import { OrderHeader } from './OrderHeader';
import { OrderDetailsGrid } from './OrderDetailsGrid';
import { CancelOrderButton } from './CancelOrderButton';
import { canCancel } from '../../utils/orderStatus';
import type { LoadCart, Order } from '../../types/store';

interface OrderGridProps {
  orders: Order[];
  loadCart: LoadCart;
  onCancelled: (order: Order) => void;
}

export function OrderGrid({ orders, loadCart, onCancelled }: OrderGridProps) {
  return (
    <div className="orders-grid">
      {orders.map((order) => (
        <div key={order.id} className="order-container card"
          data-testid="order-container">
          <OrderHeader order={order} />

          <OrderDetailsGrid order={order} loadCart={loadCart} />

          {canCancel(order) && (
            <div className="order-footer">
              <CancelOrderButton order={order} onCancelled={onCancelled} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
