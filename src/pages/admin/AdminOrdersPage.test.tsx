import { it, expect, describe, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { User } from '@supabase/supabase-js';
import { AdminOrdersPage } from './AdminOrdersPage';
import { AuthContext } from '../../hooks/useAuth';
import type { AdminOrder } from '../../types/store';

const newOrder: AdminOrder = {
  id: '27cba69d-4c3d-4098-b42d-ac7fa62b7664',
  orderTimeMs: new Date(2026, 10, 12, 14, 30).getTime(),
  customerName: 'ma***',
  items: [{ name: 'Gray Hand Knit Wool Socks', quantity: 2 }, { name: 'Intermediate Size Basketball', quantity: 1 }],
  totalCostCents: 4703,
  paymentMethod: 'delivery',
  status: 'processing',
  nextStatuses: ['shipped', 'cancelled']
};

const shippedOrder: AdminOrder = {
  id: 'b6b6c212-d30e-4d4a-805d-90b52ce6b37d',
  orderTimeMs: new Date(2026, 10, 10, 9, 5).getTime(),
  customerName: 'Guest',
  items: [{ name: 'Intermediate Size Basketball', quantity: 1 }],
  totalCostCents: 2305,
  paymentMethod: 'card',
  status: 'shipped',
  nextStatuses: ['delivered']
};

function LocationSearch() {
  return <div data-testid="location-search">{useLocation().search}</div>;
}

describe('AdminOrdersPage component', () => {
  const originalAdapter = axios.defaults.adapter;
  let api: Record<string, { status?: number; data?: unknown }>;
  let requests: { request: string; body?: unknown }[];
  let user: ReturnType<typeof userEvent.setup>;

  const renderPage = (path = '/admin/orders', loggedInUser: User | null = { id: 'admin-id' } as User) => render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext value={{ user: loggedInUser, isAdmin: true, logOut: vi.fn() }}>
        <Routes>
          <Route path="admin/orders" element={<><AdminOrdersPage cart={[]} onRetry={vi.fn()} /><LocationSearch /></>} />
        </Routes>
      </AuthContext>
    </MemoryRouter>
  );

  beforeEach(() => {
    api = {
      'get /api/admin/orders': { data: { orders: [newOrder, shippedOrder], total: 2 } },
      'get /api/admin/orders?status=shipped': { data: { orders: [shippedOrder], total: 1 } },
      'get /api/admin/orders?status=shipped&paymentMethod=delivery': { data: { orders: [], total: 0 } },
      'get /api/admin/orders?paymentMethod=delivery': { data: { orders: [newOrder], total: 1 } }
    };
    requests = [];
    user = userEvent.setup();

    axios.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const request = `${config.method} ${config.url}`;
      requests.push({ request, body: config.data && JSON.parse(config.data) });
      const { status = 200, data } = api[request] ?? { status: 500 };
      const response = { data, status, statusText: '', headers: {}, config };
      if (status >= 400) {
        throw new AxiosError('Request failed', undefined, config, null, response);
      }
      return response;
    };
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
  });

  it('asks a guest to log in, without calling the admin API', () => {
    renderPage('/admin/orders', null);

    expect(screen.getByTestId('admin-login-message')).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('tells a user who is not an admin that the page is only for admins', async () => {
    api['get /api/admin/orders'] = { status: 403, data: { error: 'Only admins can do this.' } };
    renderPage();

    expect(await screen.findByTestId('admin-forbidden-message')).toBeInTheDocument();
  });

  it('lists the orders with their customer, items, total, payment and status', async () => {
    renderPage();

    const rows = await screen.findAllByTestId('admin-order-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Nov 12, 2026 2:30 PM');
    expect(rows[0]).toHaveTextContent('#27cba69d');
    expect(rows[0]).toHaveTextContent('ma***');
    expect(within(rows[0]).getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(['2 × Gray Hand Knit Wool Socks', '1 × Intermediate Size Basketball']);
    expect(rows[0]).toHaveTextContent('$47.03');
    expect(rows[0]).toHaveTextContent('On delivery');
    expect(within(rows[0]).getByTestId('order-status')).toHaveTextContent('Processing');
    expect(within(rows[1]).getByTestId('order-status')).toHaveTextContent('Shipped');
    expect(screen.getByRole('table', { name: '2 orders' })).toBeInTheDocument();
    const adminNav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(adminNav).getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(within(adminNav).getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/admin');
  });

  it('only offers the status changes the API allows', async () => {
    renderPage();

    const [processing, shipped] = await screen.findAllByTestId('admin-order-row');
    expect(within(processing).getAllByRole('button').map((button) => button.textContent)).toEqual(['Mark shipped', 'Cancel']);
    expect(within(shipped).getAllByRole('button').map((button) => button.textContent)).toEqual(['Mark delivered']);
  });

  it('marks an order shipped and shows its new status', async () => {
    api[`patch /api/admin/orders/${newOrder.id}`] = { data: { ...newOrder, status: 'shipped', nextStatuses: ['delivered'] } };
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Mark order 27cba69d shipped' }));

    const row = screen.getAllByTestId('admin-order-row')[0];
    expect(await within(row).findByText('Mark delivered')).toBeInTheDocument();
    expect(within(row).getByTestId('order-status')).toHaveTextContent('Shipped');
    expect(requests.at(-1)).toEqual({ request: `patch /api/admin/orders/${newOrder.id}`, body: { status: 'shipped' } });
  });

  it('asks before cancelling an order', async () => {
    api[`patch /api/admin/orders/${newOrder.id}`] = { data: { ...newOrder, status: 'cancelled', nextStatuses: [] } };
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Cancel order 27cba69d' }));
    const confirmation = screen.getByRole('group', { name: 'Cancel order 27cba69d?' });
    expect(within(confirmation).getByRole('button', { name: 'Keep' })).toHaveFocus();
    expect(requests.filter(({ request }) => request.startsWith('patch'))).toEqual([]);

    await user.click(within(confirmation).getByRole('button', { name: 'Cancel order 27cba69d' }));

    const row = screen.getAllByTestId('admin-order-row')[0];
    expect(await within(row).findByText('Cancelled')).toBeInTheDocument();
    expect(within(row).queryAllByRole('button')).toEqual([]);
  });

  it('filters by status and payment, keeping the filters in the URL', async () => {
    renderPage();
    await screen.findAllByTestId('admin-order-row');

    await user.selectOptions(screen.getByTestId('admin-order-status-filter'), 'Shipped');
    expect(await screen.findByRole('table', { name: '1 order' })).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?status=shipped');

    await user.selectOptions(screen.getByTestId('admin-order-payment-filter'), 'On delivery');
    expect(await screen.findByTestId('admin-no-orders')).toHaveTextContent('No orders match these filters');

    await user.selectOptions(screen.getByTestId('admin-order-status-filter'), 'All statuses');
    expect(await screen.findByRole('table', { name: '1 order' })).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?paymentMethod=delivery');
  });

  it('says when only the newest orders are shown', async () => {
    api['get /api/admin/orders'] = { data: { orders: [newOrder, shippedOrder], total: 240 } };
    renderPage();

    expect(await screen.findByRole('table', { name: 'The newest 2 of 240 orders' })).toBeInTheDocument();
  });
});
