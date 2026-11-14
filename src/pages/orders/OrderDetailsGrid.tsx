import { Link } from 'react-router';
import { CartIcon } from '../../components/Icons';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useAddToCart } from '../../hooks/useAddToCart';
import { useI18n } from '../../hooks/useI18n';
import { describeDelivery } from '../../utils/orderStatus';
import type { LoadCart, Order, OrderProduct } from '../../types/store';

interface BuyAgainButtonProps {
  orderProduct: OrderProduct;
  loadCart: LoadCart;
}

// Its own component, because useAction can't be called inside .map()
function BuyAgainButton({ orderProduct, loadCart }: BuyAgainButtonProps) {
  const addToCart = useAddToCart(loadCart);
  const [buyAgain, isAdding] = useAction(() => addToCart(orderProduct.product, 1));
  const { t } = useI18n();

  return (
    <button className="buy-again-button button-primary"
      data-testid="buy-again-button"
      disabled={isAdding}
      aria-busy={isAdding}
      onClick={buyAgain}>
      {/* The spinner takes the icon's place, so the button doesn't change size */}
      {isAdding
        ? <ButtonSpinner />
        : <CartIcon className="buy-again-icon" />}
      <span className="buy-again-message">{t.common.addToCart}</span>
    </button>
  );
}

interface OrderDetailsGridProps {
  order: Order;
  loadCart: LoadCart;
}

export function OrderDetailsGrid({ order, loadCart }: OrderDetailsGridProps) {
  const i18n = useI18n();
  const { t } = i18n;

  return (
    <div>
      {order.products.map((orderProduct) => (
        <div key={orderProduct.productId} className="order-product">
          <img className="product-thumbnail" src={orderProduct.product.image}
            alt={orderProduct.product.name} width="480" height="480" loading="lazy" />

          <div data-testid="order-product-details">
            <Link className="product-name" to={`/products/${orderProduct.product.id}`}>
              {orderProduct.product.name}
            </Link>
            <div className={`product-delivery-date${order.status === 'cancelled' ? ' product-delivery-cancelled' : ''}`}
              data-testid="order-product-delivery-date">
              {describeDelivery(order, orderProduct.estimatedDeliveryTimeMs, i18n)}
            </div>
            <div className="product-quantity">
              {t.common.quantity} {orderProduct.quantity}
            </div>

            {orderProduct.product.deletedAt || orderProduct.product.stock === 0 ? (
              <div className="product-unavailable" data-testid="product-unavailable">
                {orderProduct.product.deletedAt ? t.common.noLongerAvailable : t.stock.outOfStock}
              </div>
            ) : (
              <BuyAgainButton orderProduct={orderProduct} loadCart={loadCart} />
            )}
          </div>

          <Link className="track-package-button button-secondary"
            to={`/tracking/${order.id}/${orderProduct.product.id}`}>
            {t.orders.trackPackage}
          </Link>
        </div>
      ))}
    </div>
  );
}
