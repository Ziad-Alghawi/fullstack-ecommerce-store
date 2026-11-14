import { useI18n } from '../../hooks/useI18n';
import type { CartItem, DeliveryOption } from '../../types/store';

interface DeliveryDateProps {
  cartItem: CartItem;
  deliveryOptions: DeliveryOption[];
}

export function DeliveryDate({ cartItem, deliveryOptions }: DeliveryDateProps) {
  const { t, formatDeliveryDate } = useI18n();
  const selectedDeliveryOption = deliveryOptions.find((deliveryOption) => {
    return deliveryOption.id === cartItem.deliveryOptionId;
  });

  if (!selectedDeliveryOption) {
    return null;
  }

  return (
    <h2 className="delivery-date">
      {t.checkout.deliveryDate(formatDeliveryDate(selectedDeliveryOption.estimatedDeliveryTimeMs))}
    </h2>
  );
}
