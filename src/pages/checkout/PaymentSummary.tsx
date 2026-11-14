import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import { CouponForm } from './CouponForm';
import type { AppliedCoupon, LoadCart, PaymentSummary as PaymentSummaryType } from '../../types/store';

interface PaymentSummaryProps {
  paymentSummary: PaymentSummaryType | null;
  couponCode: string | null;
  // Suggested next to the coupon field
  featuredCoupon?: AppliedCoupon | null;
  onCouponChange: (couponCode: string | null) => void;
  loadCart: LoadCart;
}

export function PaymentSummary({
  paymentSummary, couponCode, featuredCoupon = null, onCouponChange, loadCart
}: PaymentSummaryProps) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { t, formatMoney } = useI18n();

  const [createOrder, isPlacingOrder] = useAction(async () => {
    await axios.post('/api/orders', { couponCode });
    await loadCart();
    showToast(t.checkout.orderPlaced);
    navigate('/orders');
  });

  const [isCardPaymentOn, setIsCardPaymentOn] = useState(false);

  useEffect(() => {
    const fetchStripeConfig = async () => {
      try {
        const response = await axios.get<{ cardPayment: boolean }>('/api/stripe/config');
        setIsCardPaymentOn(response.data.cardPayment === true);
      } catch {
        // Paying on delivery still works, so there's nothing to show
      }
    };
    fetchStripeConfig();
  }, []);

  // Stripe's page takes the payment, then sends the customer back to /checkout/success
  const [payWithCard, isRedirecting] = useAction(async () => {
    const response = await axios.post<{ url: string }>('/api/stripe/checkout-sessions', { couponCode });
    window.location.assign(response.data.url);
  });

  const isOrderDisabled = paymentSummary?.totalItems === 0 || isPlacingOrder || isRedirecting;

  return (
    <div className="payment-summary card">
      <h2 className="payment-summary-title">
        {t.checkout.paymentSummary}
      </h2>

      {paymentSummary && (
        <>
          <div className="payment-summary-row"
            data-testid="payment-summary-product-cost">
            <div>{t.checkout.items(paymentSummary.totalItems)}</div>
            <div className="payment-summary-money">
              {formatMoney(paymentSummary.productCostCents)}
            </div>
          </div>

          {paymentSummary.discountCents > 0 && (
            <div className="payment-summary-row discount-row"
              data-testid="payment-summary-discount">
              <div>{t.checkout.discount(paymentSummary.coupon?.code)}</div>
              <div className="payment-summary-money">
                {formatMoney(-paymentSummary.discountCents)}
              </div>
            </div>
          )}

          <div className="payment-summary-row"
            data-testid="payment-summary-shipping-cost">
            <div>{t.checkout.shippingHandling}</div>
            <div className="payment-summary-money">
              {formatMoney(paymentSummary.shippingCostCents)}
            </div>
          </div>

          <div className="payment-summary-row subtotal-row"
            data-testid="payment-summary-total-before-tax">
            <div>{t.checkout.totalBeforeTax}</div>
            <div className="payment-summary-money">
              {formatMoney(paymentSummary.totalCostBeforeTaxCents)}
            </div>
          </div>

          <div className="payment-summary-row"
            data-testid="payment-summary-tax">
            <div>{t.checkout.tax}</div>
            <div className="payment-summary-money">
              {formatMoney(paymentSummary.taxCents)}
            </div>
          </div>

          <div className="payment-summary-row total-row"
            data-testid="payment-summary-total">
            <div>{t.checkout.orderTotal}</div>
            <div className="payment-summary-money">
              {formatMoney(paymentSummary.totalCostCents)}
            </div>
          </div>

          <CouponForm appliedCoupon={paymentSummary.coupon} featuredCoupon={featuredCoupon} onApply={onCouponChange}
            onRemove={() => onCouponChange(null)} />

          {isCardPaymentOn && (
            <>
              <button className="place-order-button button-primary"
                data-testid="pay-with-card-button"
                disabled={isOrderDisabled}
                aria-busy={isRedirecting}
                onClick={payWithCard}>
                {isRedirecting && <ButtonSpinner />}
                {t.checkout.payWithCard}
              </button>
              <p className="card-test-note" data-testid="card-test-note">
                <strong>{t.checkout.testMode}</strong> {t.checkout.testCard}
              </p>
            </>
          )}

          <button className={`place-order-button ${isCardPaymentOn ? 'button-secondary' : 'button-primary'}`}
            data-testid="place-order-button"
            disabled={isOrderDisabled}
            aria-busy={isPlacingOrder}
            onClick={createOrder}>
            {isPlacingOrder && <ButtonSpinner />}
            {isCardPaymentOn ? t.checkout.payOnDelivery : t.checkout.placeOrder}
          </button>
        </>
      )}
    </div>
  );
}
