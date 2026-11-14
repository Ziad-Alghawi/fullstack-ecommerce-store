import axios from 'axios';
import { useState } from 'react';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import type { Order } from '../../types/store';

interface CancelOrderButtonProps {
  order: Order;
  onCancelled: (order: Order) => void;
}

export function CancelOrderButton({ order, onCancelled }: CancelOrderButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const showToast = useToast();
  const { t } = useI18n();
  const isCard = order.paymentMethod === 'card';
  const question = isCard ? t.orders.cancelAndRefundQuestion : t.orders.cancelQuestion;

  const [cancelOrder, isCancelling] = useAction(async () => {
    const response = await axios.post<Order>(`/api/orders/${order.id}/cancel`);
    onCancelled(response.data);
    showToast(isCard ? t.orders.cancelledAndRefunded : t.orders.cancelled);
  });

  // The keys swap in new buttons, so a double click on Cancel order can't also confirm it
  return isConfirming ? (
    <div key="confirm" className="order-actions" role="group" aria-label={question}>
      <span className="order-confirm-text">{question}</span>
      <button className="button-danger" type="button" disabled={isCancelling} onClick={cancelOrder}
        data-testid="confirm-cancel-order-button">
        {isCancelling && <ButtonSpinner />}
        {t.orders.cancelOrder}
      </button>
      <button className="button-secondary" type="button" disabled={isCancelling} autoFocus
        onClick={() => setIsConfirming(false)}>
        {t.orders.keepOrder}
      </button>
    </div>
  ) : (
    <div key="actions" className="order-actions">
      <span className="order-hint">{t.orders.cancelHint}</span>
      <button className="button-secondary" type="button" onClick={() => setIsConfirming(true)}
        data-testid="cancel-order-button">
        {t.orders.cancelOrder}
      </button>
    </div>
  );
}
