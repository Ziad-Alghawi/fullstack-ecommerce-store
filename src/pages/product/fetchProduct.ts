import axios from 'axios';
import type { Product } from '../../types/store';

// Deleted products too, with deletedAt set
export async function fetchProduct(productId: string | undefined) {
  const response = await axios.get<Product>(`/api/products/${productId}`);
  if (typeof response.data?.id !== 'string') {
    throw new Error('Unexpected product response');
  }
  return response.data;
}
