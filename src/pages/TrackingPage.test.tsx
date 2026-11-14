import { it, expect, describe, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import axios from 'axios';
import { TrackingPage } from './TrackingPage';
import type { Order, OrderStatus } from '../types/store';

vi.mock('axios');

const productId = 'e43638ce-6aa0-4b85-b27f-e1d07eb678c6';

function createOrder(status: OrderStatus): Order {
  return {
    id: 'order-1',
    orderTimeMs: 1723456800000,
    totalCostCents: 1090,
    paymentMethod: 'delivery',
    status,
    products: [{
      productId,
      quantity: 2,
      estimatedDeliveryTimeMs: 1723716000000,
      product: {
        id: productId,
        image: 'images/products/gray-hand-knit-wool-socks.jpg',
        name: 'Gray Hand Knit Wool Socks',
        rating: { stars: 4.5, count: 87 },
        priceCents: 1090,
        stock: 20
      }
    }]
  };
}

describe('TrackingPage component', () => {
  let order: Order;

  beforeEach(() => {
    vi.mocked(axios.get).mockImplementation(async () => ({ data: order }));
  });

  const renderTrackingPage = () => render(
    <MemoryRouter initialEntries={[`/tracking/order-1/${productId}`]}>
      <Routes>
        <Route path="tracking/:orderId/:productId" element={<TrackingPage cart={[]} onRetry={vi.fn()} />} />
      </Routes>
    </MemoryRouter>
  );

  it('shows the progress from the order status, not from the time that passed', async () => {
    order = createOrder('shipped');
    renderTrackingPage();

    expect(await screen.findByRole('heading', { name: 'Arriving on Thursday, August 15' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Shipped');
    expect(screen.getByText('Shipped')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Quantity: 2')).toBeInTheDocument();
  });

  it('fills the bar once the order is delivered', async () => {
    order = createOrder('delivered');
    renderTrackingPage();

    expect(await screen.findByRole('heading', { name: 'Delivered' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('says a cancelled order will not be delivered, without a progress bar', async () => {
    order = createOrder('cancelled');
    renderTrackingPage();

    expect(await screen.findByRole('heading', { name: 'Cancelled' })).toBeInTheDocument();
    expect(screen.getByTestId('tracking-cancelled')).toHaveTextContent("won't be delivered");
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('says a cancelled card order was refunded', async () => {
    order = { ...createOrder('cancelled'), paymentMethod: 'card' };
    renderTrackingPage();

    expect(await screen.findByRole('heading', { name: 'Refunded' })).toBeInTheDocument();
    expect(screen.getByTestId('tracking-cancelled')).toHaveTextContent('Its payment was refunded.');
  });
});
