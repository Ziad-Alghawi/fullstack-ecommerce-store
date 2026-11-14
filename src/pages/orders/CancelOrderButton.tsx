import axios from 'axios';
import { useState } from 'react';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import type { Order } from '../../types/store';

interface CancelOrderButtonProps {
  order: Order;
  onCancelled: (order: Order) => void;
}

export function CancelOrderButton({ order, onCancelled }: CancelOrderButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const showToast = useToast();
  const isCard = order.paymentMethod === 'card';
  const question = isCard ? 'Cancel this order and refund your payment?' : 'Cancel this order?';

  const [cancelOrder, isCancelling] = useAction(async () => {
    const response = await axios.post<Order>(`/api/orders/${order.id}/cancel`);
    onCancelled(response.data);
    showToast(isCard ? 'Order cancelled and your payment refunded' : 'Order cancelled. Its items are back in stock');
  });

  // The keys swap in new buttons, so a double click on Cancel order can't also confirm it
  return isConfirming ? (
    <div key="confirm" className="order-actions" role="group" aria-label={question}>
      <span className="order-confirm-text">{question}</span>
      <button className="button-danger" type="button" disabled={isCancelling} onClick={cancelOrder}
        data-testid="confirm-cancel-order-button">
        {isCancelling && <ButtonSpinner />}
        Cancel order
      </button>
      <button className="button-secondary" type="button" disabled={isCancelling} autoFocus
        onClick={() => setIsConfirming(false)}>
        Keep order
      </button>
    </div>
  ) : (
    <div key="actions" className="order-actions">
      <span className="order-hint">You can cancel until it ships</span>
      <button className="button-secondary" type="button" onClick={() => setIsConfirming(true)}
        data-testid="cancel-order-button">
        Cancel order
      </button>
    </div>
  );
}
