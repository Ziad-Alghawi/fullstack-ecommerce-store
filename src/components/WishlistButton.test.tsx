import { it, expect, describe, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { User } from '@supabase/supabase-js';
import { WishlistButton } from './WishlistButton';
import { AuthContext, type Auth } from '../hooks/useAuth';
import { ToastContext } from '../hooks/useToast';
import { WishlistContext, type Wishlist } from '../hooks/useWishlist';
import type { Product } from '../types/store';

const product: Product = {
  id: 'e43638ce-6aa0-4b85-b27f-e1d07eb678c6',
  image: 'images/products/gray-hand-knit-wool-socks.jpg',
  name: 'Gray Hand Knit Wool Socks',
  rating: { stars: 4.5, count: 87 },
  priceCents: 1090,
  stock: 20
};

describe('WishlistButton', () => {
  let showToast: ReturnType<typeof vi.fn>;
  let wishlist: Wishlist;
  let savedIds: string[];

  const renderButton = ({ auth, list = null, item = product }: { auth: Auth | null; list?: Wishlist | null; item?: Product }) => render(
    <MemoryRouter>
      <AuthContext value={auth}>
        <WishlistContext value={list}>
          <ToastContext value={showToast}>
            <WishlistButton product={item} />
          </ToastContext>
        </WishlistContext>
      </AuthContext>
    </MemoryRouter>
  );

  const loggedIn: Auth = { user: { id: 'user-1' } as User, isAdmin: false, logOut: vi.fn() };

  beforeEach(() => {
    showToast = vi.fn();
    savedIds = [];
    wishlist = {
      items: [],
      status: 'ready',
      reload: vi.fn(),
      has: (productId) => savedIds.includes(productId),
      save: vi.fn(async () => {}),
      remove: vi.fn(async () => {})
    };
  });

  it('is not shown when accounts are turned off', () => {
    renderButton({ auth: null });

    expect(screen.queryByTestId('wishlist-button')).not.toBeInTheDocument();
  });

  it('asks a guest to log in', async () => {
    renderButton({ auth: { user: null, isAdmin: false, logOut: vi.fn() } });

    await userEvent.click(screen.getByRole('button', { name: 'Save Gray Hand Knit Wool Socks to your wishlist' }));

    expect(showToast).toHaveBeenCalledWith('Log in to save products to your wishlist', expect.objectContaining({
      action: expect.objectContaining({ label: 'Log in' })
    }));
  });

  it('saves a product, and says so with a link to the wishlist', async () => {
    renderButton({ auth: loggedIn, list: wishlist });
    const button = screen.getByTestId('wishlist-button');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);

    expect(wishlist.save).toHaveBeenCalledWith(product);
    expect(showToast).toHaveBeenCalledWith('Gray Hand Knit Wool Socks saved to your wishlist', expect.objectContaining({
      action: expect.objectContaining({ label: 'View wishlist' })
    }));
  });

  it('removes a saved product', async () => {
    savedIds = [product.id];
    renderButton({ auth: loggedIn, list: wishlist });
    const button = screen.getByTestId('wishlist-button');
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(button);

    expect(wishlist.remove).toHaveBeenCalledWith(product.id);
    expect(showToast).toHaveBeenCalledWith('Gray Hand Knit Wool Socks removed from your wishlist');
  });

  it('only offers to remove a deleted product', () => {
    const deleted = { ...product, deletedAt: '2026-11-01T00:00:00.000Z' };
    const { unmount } = renderButton({ auth: loggedIn, list: wishlist, item: deleted });
    expect(screen.queryByTestId('wishlist-button')).not.toBeInTheDocument();
    unmount();

    savedIds = [product.id];
    renderButton({ auth: loggedIn, list: wishlist, item: deleted });
    expect(screen.getByTestId('wishlist-button')).toHaveAttribute('aria-pressed', 'true');
  });
});
