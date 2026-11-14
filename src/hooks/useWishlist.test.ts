import { it, expect, describe, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useWishlistState } from './useWishlist';
import type { Product } from '../types/store';

vi.mock('axios');

const socks: Product = {
  id: 'e43638ce-6aa0-4b85-b27f-e1d07eb678c6',
  image: 'images/products/gray-hand-knit-wool-socks.jpg',
  name: 'Gray Hand Knit Wool Socks',
  rating: { stars: 4.5, count: 87 },
  priceCents: 1090,
  stock: 20
};
const hat: Product = { ...socks, id: '15b6fc6f-327a-4ec4-896f-486349e85a3d', name: 'Wool Hat' };

describe('useWishlistState', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockResolvedValue({ data: [{ productId: socks.id, createdAt: '2026-11-01T00:00:00.000Z', product: socks }] });
    vi.mocked(axios.put).mockResolvedValue({ data: '' });
    vi.mocked(axios.delete).mockResolvedValue({ data: '' });
  });

  it('is empty for a guest, without asking the API', () => {
    const { result } = renderHook(() => useWishlistState(undefined));

    expect(result.current).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("loads the user's list, then saves and removes products", async () => {
    const { result } = renderHook(() => useWishlistState('user-1'));
    expect(result.current?.status).toBe('loading');

    await waitFor(() => expect(result.current?.status).toBe('ready'));
    expect(axios.get).toHaveBeenCalledWith('/api/wishlist');
    expect(result.current?.has(socks.id)).toBe(true);

    await act(() => result.current!.save(hat));
    expect(axios.put).toHaveBeenCalledWith(`/api/wishlist/${hat.id}`);
    expect(result.current?.items.map(({ productId }) => productId)).toEqual([hat.id, socks.id]);

    await act(() => result.current!.remove(socks.id));
    expect(axios.delete).toHaveBeenCalledWith(`/api/wishlist/${socks.id}`);
    expect(result.current?.items.map(({ productId }) => productId)).toEqual([hat.id]);
  });

  it('keeps the list as it was when saving fails', async () => {
    vi.mocked(axios.put).mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useWishlistState('user-1'));
    await waitFor(() => expect(result.current?.status).toBe('ready'));

    await act(() => expect(result.current!.save(hat)).rejects.toThrow());

    expect(result.current?.has(hat.id)).toBe(false);
  });

  it('reports a failed load and loads again on reload', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network Error'));
    const { result } = renderHook(() => useWishlistState('user-1'));
    await waitFor(() => expect(result.current?.status).toBe('failed'));

    act(() => result.current!.reload());

    await waitFor(() => expect(result.current?.status).toBe('ready'));
    expect(result.current?.items).toHaveLength(1);
  });
});
