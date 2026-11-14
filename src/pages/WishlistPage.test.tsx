import { it, expect, describe, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { User } from '@supabase/supabase-js';
import { WishlistPage } from './WishlistPage';
import { AuthContext } from '../hooks/useAuth';
import { WishlistContext, type Wishlist } from '../hooks/useWishlist';
import type { Product } from '../types/store';

const socks: Product = {
  id: 'e43638ce-6aa0-4b85-b27f-e1d07eb678c6',
  image: 'images/products/gray-hand-knit-wool-socks.jpg',
  name: 'Gray Hand Knit Wool Socks',
  rating: { stars: 4.5, count: 87 },
  priceCents: 1090,
  stock: 20
};

const scarf: Product = { ...socks, id: '15b6fc6f-327a-4ec4-896f-486349e85a3d', name: 'Plaid Wool Scarf', deletedAt: '2026-11-01T00:00:00.000Z' };

function renderPage(wishlist: Partial<Wishlist> | null) {
  const list = wishlist && {
    items: [], status: 'ready', reload: vi.fn(), has: () => true, save: vi.fn(), remove: vi.fn(), ...wishlist
  } as Wishlist;
  render(
    <MemoryRouter>
      <AuthContext value={{ user: list ? { id: 'user-1' } as User : null, isAdmin: false, logOut: vi.fn() }}>
        <WishlistContext value={list}>
          <WishlistPage cart={[]} loadCart={vi.fn()} />
        </WishlistContext>
      </AuthContext>
    </MemoryRouter>
  );
  return list;
}

describe('WishlistPage', () => {
  it('asks a guest to log in', () => {
    renderPage(null);

    expect(screen.getByTestId('wishlist-login-message')).toHaveTextContent('Log in to see your wishlist');
    expect(within(screen.getByTestId('wishlist-login-message')).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('says when nothing is saved', () => {
    renderPage({ items: [] });

    expect(screen.getByTestId('wishlist-empty-message')).toHaveTextContent('Your wishlist is empty');
  });

  it('lists the saved products, and a deleted one as no longer available', () => {
    renderPage({
      items: [
        { productId: socks.id, createdAt: '2026-11-02T00:00:00.000Z', product: socks },
        { productId: scarf.id, createdAt: '2026-11-01T00:00:00.000Z', product: scarf }
      ]
    });

    const [first, second] = screen.getAllByTestId('product-container');
    expect(first).toHaveTextContent('Gray Hand Knit Wool Socks');
    expect(within(first).getByTestId('add-to-cart-button')).toBeEnabled();
    expect(second).toHaveTextContent('Plaid Wool Scarf');
    expect(within(second).getByTestId('product-unavailable')).toHaveTextContent('No longer available');
    expect(within(second).queryByTestId('add-to-cart-button')).not.toBeInTheDocument();
  });

  it('loads the list again after an error', async () => {
    const wishlist = renderPage({ status: 'failed' });

    await userEvent.click(screen.getByTestId('error-message-button'));

    expect(wishlist?.reload).toHaveBeenCalled();
  });
});
