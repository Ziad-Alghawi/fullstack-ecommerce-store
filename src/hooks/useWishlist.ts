import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import type { Product, WishlistItem } from '../types/store';

export interface Wishlist {
  // Newest first
  items: WishlistItem[];
  status: 'loading' | 'ready' | 'failed';
  reload: () => void;
  has: (productId: string) => boolean;
  save: (product: Product) => Promise<void>;
  remove: (productId: string) => Promise<void>;
}

// Null for a guest, or when accounts are turned off
export const WishlistContext = createContext<Wishlist | null>(null);

export function useWishlist() {
  return useContext(WishlistContext);
}

// The logged in user's saved products, kept by the API
export function useWishlistState(userId: string | undefined): Wishlist | null {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [status, setStatus] = useState<Wishlist['status']>('loading');
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      return;
    }
    // A slow response for a user who logged out meanwhile is dropped
    let isCurrentUser = true;
    setItems([]);
    setStatus('loading');
    axios.get<WishlistItem[]>('/api/wishlist')
      .then(({ data }) => {
        if (!Array.isArray(data)) {
          throw new Error('Unexpected wishlist response');
        }
        if (isCurrentUser) {
          setItems(data);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (isCurrentUser) {
          setStatus('failed');
        }
      });
    return () => {
      isCurrentUser = false;
    };
  }, [userId, loadCount]);

  if (!userId) {
    return null;
  }

  return {
    items,
    status,
    reload: () => setLoadCount((count) => count + 1),
    has: (productId) => items.some((item) => item.productId === productId),
    save: async (product) => {
      await axios.put(`/api/wishlist/${product.id}`);
      setItems((current) => [
        { productId: product.id, createdAt: new Date().toISOString(), product },
        ...current.filter((item) => item.productId !== product.id)
      ]);
    },
    remove: async (productId) => {
      await axios.delete(`/api/wishlist/${productId}`);
      setItems((current) => current.filter((item) => item.productId !== productId));
    }
  };
}
