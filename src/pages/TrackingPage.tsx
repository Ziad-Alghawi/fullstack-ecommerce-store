import { Link, useParams } from 'react-router';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { PageTitle } from '../components/PageTitle';
import { ErrorMessage, LoadingMessage } from '../components/PageStatus';
import { useI18n } from '../hooks/useI18n';
import { describeDelivery } from '../utils/orderStatus';
import type { CartItem, Order, OrderProduct, OrderStatus } from '../types/store';
import './TrackingPage.css';

interface PackageTrackingProps {
  order: Order;
  orderProduct: OrderProduct;
}

// How far along the bar each step is. The labels sit at its start, middle and end
const PROGRESS_STEPS: { status: OrderStatus; percent: number }[] = [
  { status: 'processing', percent: 10 },
  { status: 'shipped', percent: 50 },
  { status: 'delivered', percent: 100 }
];

function PackageTracking({ order, orderProduct }: PackageTrackingProps) {
  const currentStep = PROGRESS_STEPS.find((step) => step.status === order.status);
  const i18n = useI18n();
  const { t } = i18n;

  return (
    <div className="order-tracking card">
      <Link className="back-to-orders-link link-primary" to="/orders">
        {t.common.viewAllOrders}
      </Link>

      <h1 className="delivery-date">
        {describeDelivery(order, orderProduct.estimatedDeliveryTimeMs, i18n)}
      </h1>

      <div className="tracking-product">
        <img className="product-thumbnail" src={orderProduct.product.image}
          alt={orderProduct.product.name} width="480" height="480" />
        <div>
          <div className="product-name">{orderProduct.product.name}</div>
          <div className="product-quantity">{t.common.quantity} {orderProduct.quantity}</div>
        </div>
      </div>

      {currentStep ? (
        <>
          <ol className="progress-labels-container">
            {PROGRESS_STEPS.map(({ status }) => (
              <li key={status} className={status === order.status ? 'current-status' : undefined}
                aria-current={status === order.status ? 'step' : undefined}>
                {t.orderStatus[status]}
              </li>
            ))}
          </ol>

          <div className="progress-bar-container" role="progressbar"
            aria-label={t.tracking.progress} aria-valuenow={currentStep.percent}
            aria-valuetext={t.orderStatus[order.status]}
            aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar"
              style={{ width: `${currentStep.percent}%` }}></div>
          </div>
        </>
      ) : (
        <p className="tracking-cancelled" data-testid="tracking-cancelled">
          {t.tracking.cancelled}
          {order.paymentMethod === 'card' && t.tracking.refunded}
        </p>
      )}
    </div>
  );
}

interface TrackingPageProps {
  cart: CartItem[];
  onRetry: () => void;
}

export function TrackingPage({ cart, onRetry }: TrackingPageProps) {
  const { orderId, productId } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await axios.get<Order>(`/api/orders/${orderId}?expand=products`);
        if (!Array.isArray(response.data?.products)) {
          throw new Error('Unexpected order response');
        }
        setOrder(response.data);
      } catch (error) {
        // Trying again can't help when the order doesn't exist
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setIsNotFound(true);
        } else {
          setHasError(true);
        }
      }
    };
    fetchOrder();
  }, [orderId]);

  const orderProduct = order?.products.find((orderProduct) => {
    return orderProduct.productId === productId;
  });

  let pageContent = <LoadingMessage />;

  if (orderProduct) {
    pageContent = <PackageTracking order={order} orderProduct={orderProduct} />;
  } else if (hasError) {
    pageContent = <ErrorMessage onButtonClick={onRetry} />;
  } else if (isNotFound || order) {
    pageContent = (
      <div className="page-status" data-testid="package-not-found">
        <div>{t.tracking.notFound}</div>
        <Link className="page-status-link link-primary" to="/orders">{t.common.viewAllOrders}</Link>
      </div>
    );
  }

  return (
    <>
      <PageTitle title={t.tracking.title} />

      <Header cart={cart} />

      <main className="tracking-page page">
        {pageContent}
      </main>
    </>
  );
}
