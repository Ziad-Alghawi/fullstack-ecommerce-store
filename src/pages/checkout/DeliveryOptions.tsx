import axios from 'axios';
import { useI18n } from '../../hooks/useI18n';
import type { CartItem, DeliveryOption, LoadCart } from '../../types/store';

interface DeliveryOptionsProps {
  cartItem: CartItem;
  deliveryOptions: DeliveryOption[];
  loadCart: LoadCart;
}

export function DeliveryOptions({ cartItem, deliveryOptions, loadCart }: DeliveryOptionsProps) {
  const { t, formatMoney, formatDeliveryDate } = useI18n();

  return (
    <fieldset className="delivery-options">
      <legend className="delivery-options-title">
        {t.checkout.chooseDelivery}
      </legend>

      {deliveryOptions.map((deliveryOption) => {
        const priceString = deliveryOption.priceCents > 0
          ? t.checkout.shipping(formatMoney(deliveryOption.priceCents))
          : t.checkout.freeShipping;

        const updateDeliveryOption = async () => {
          await axios.put(`/api/cart-items/${cartItem.productId}`, {
            deliveryOptionId: deliveryOption.id
          });
          await loadCart();
        };

        return (
          <label key={deliveryOption.id} className="delivery-option"
            data-testid="delivery-option">
            <input type="radio"
              checked={deliveryOption.id === cartItem.deliveryOptionId}
              onChange={updateDeliveryOption}
              className="delivery-option-input"
              name={`delivery-option-${cartItem.productId}`}
              data-testid="delivery-option-input" />
            <div>
              <div className="delivery-option-date">
                {formatDeliveryDate(deliveryOption.estimatedDeliveryTimeMs)}
              </div>
              <div className="delivery-option-price">
                {priceString}
              </div>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
