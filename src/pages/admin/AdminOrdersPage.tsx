import axios from 'axios';
import { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Header } from '../../components/Header';
import { PageTitle } from '../../components/PageTitle';
import { AuthContext } from '../../hooks/useAuth';
import { ORDER_STATUS_LABELS } from '../../utils/orderStatus';
import { AdminNav } from './AdminNav';
import { AdminOrderRow } from './AdminOrderRow';
import { AdminPageStatus } from './AdminPageStatus';
import { getLoadFailure, type AdminLoadStatus } from './adminLoadStatus';
import type { AdminOrder, AdminOrderList, CartItem } from '../../types/store';
import './AdminPage.css';

const PAYMENT_LABELS = { card: 'Card', delivery: 'On delivery' };

function describeCount(shown: number, total: number) {
  const orders = `${total} ${total === 1 ? 'order' : 'orders'}`;
  return shown < total ? `The newest ${shown} of ${orders}` : orders;
}

interface AdminOrdersPageProps {
  cart: CartItem[];
  onRetry: () => void;
}

// The filters are kept in the URL, so a filtered list survives a reload and the back button
export function AdminOrdersPage({ cart, onRetry }: AdminOrdersPageProps) {
  const userId = useContext(AuthContext)?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const paymentMethod = searchParams.get('paymentMethod') ?? '';
  const [orderList, setOrderList] = useState<AdminOrderList>({ orders: [], total: 0 });
  const [loadStatus, setLoadStatus] = useState<AdminLoadStatus>('loading');

  useEffect(() => {
    if (!userId) {
      return;
    }
    // Only the latest filters' response is shown, even if an earlier one arrives after it
    let isCurrent = true;
    const query = new URLSearchParams({ ...(status && { status }), ...(paymentMethod && { paymentMethod }) });
    axios.get<AdminOrderList>(`/api/admin/orders${query.size ? `?${query}` : ''}`)
      .then((response) => {
        if (!Array.isArray(response.data?.orders)) {
          throw new Error('Unexpected orders response');
        }
        if (isCurrent) {
          setOrderList(response.data);
          setLoadStatus('ready');
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setLoadStatus(getLoadFailure(error));
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [userId, status, paymentMethod]);

  const setFilter = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    setSearchParams(params);
  };

  // The order stays in the list with its new status, even if it no longer matches the filters
  const showChangedOrder = (changedOrder: AdminOrder) => {
    setOrderList((current) => ({
      ...current,
      orders: current.orders.map((order) => (order.id === changedOrder.id ? changedOrder : order))
    }));
  };

  let pageContent;

  if (!userId || loadStatus !== 'ready') {
    pageContent = <AdminPageStatus isLoggedIn={Boolean(userId)} status={loadStatus} onRetry={onRetry} />;
  } else {
    const { orders, total } = orderList;
    pageContent = (
      <>
        <AdminNav />

        <div className="admin-heading">
          <h1 className="page-title">Orders</h1>
        </div>

        <div className="admin-filters" role="group" aria-label="Filter orders">
          <label className="form-field">
            Status
            <select value={status} onChange={(event) => setFilter('status', event.target.value)}
              data-testid="admin-order-status-filter">
              <option value="">All statuses</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Payment
            <select value={paymentMethod} onChange={(event) => setFilter('paymentMethod', event.target.value)}
              data-testid="admin-order-payment-filter">
              <option value="">All payments</option>
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-table-container card">
          <table className="admin-table admin-orders-table">
            <caption className="admin-caption" aria-live="polite">{describeCount(orders.length, total)}</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Payment</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <AdminOrderRow key={order.id} order={order} onChanged={showChangedOrder} />
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <p className="admin-empty" data-testid="admin-no-orders">
              {status || paymentMethod ? 'No orders match these filters' : 'No orders yet'}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Orders" />

      <Header cart={cart} />

      <main className="admin-page page">
        {pageContent}
      </main>
    </>
  );
}
