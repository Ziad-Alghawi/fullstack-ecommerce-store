import axios from 'axios';
import { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Header } from '../../components/Header';
import { PageTitle } from '../../components/PageTitle';
import { AuthContext } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { ORDER_STATUSES, PAYMENT_METHODS } from '../../utils/orderStatus';
import { AdminNav } from './AdminNav';
import { AdminOrderRow } from './AdminOrderRow';
import { AdminPageStatus } from './AdminPageStatus';
import { getLoadFailure, type AdminLoadStatus } from './adminLoadStatus';
import type { AdminOrder, AdminOrderList, CartItem } from '../../types/store';
import './AdminPage.css';

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
  const { t } = useI18n();
  const list = t.admin.orderList;

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
          <h1 className="page-title">{t.admin.orders}</h1>
        </div>

        <div className="admin-filters" role="group" aria-label={list.filters}>
          <label className="form-field">
            {list.status}
            <select value={status} onChange={(event) => setFilter('status', event.target.value)}
              data-testid="admin-order-status-filter">
              <option value="">{list.allStatuses}</option>
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>{t.orderStatus[value]}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            {list.payment}
            <select value={paymentMethod} onChange={(event) => setFilter('paymentMethod', event.target.value)}
              data-testid="admin-order-payment-filter">
              <option value="">{list.allPayments}</option>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>{t.paymentMethods[value]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-table-container card">
          <table className="admin-table admin-orders-table">
            <caption className="admin-caption" aria-live="polite">{list.count(orders.length, total)}</caption>
            <thead>
              <tr>
                <th scope="col">{list.order}</th>
                <th scope="col">{list.customer}</th>
                <th scope="col">{list.items}</th>
                <th scope="col">{list.total}</th>
                <th scope="col">{list.payment}</th>
                <th scope="col">{list.status}</th>
                <th scope="col"><span className="visually-hidden">{t.admin.products.actions}</span></th>
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
              {status || paymentMethod ? list.noMatch : list.none}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t.admin.orders} />

      <Header cart={cart} />

      <main className="admin-page page">
        {pageContent}
      </main>
    </>
  );
}
