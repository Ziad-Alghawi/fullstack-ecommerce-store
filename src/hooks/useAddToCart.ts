import axios from 'axios';
import { useNavigate } from 'react-router';
import { useToast } from './useToast';
import { useI18n } from './useI18n';
import type { LoadCart, Product } from '../types/store';

// Adds a product, reloads the cart and says so, with a link to the cart
export function useAddToCart(loadCart: LoadCart) {
  const showToast = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();

  return async (product: Product, quantity: number) => {
    await axios.post('/api/cart-items', { productId: product.id, quantity });
    await loadCart();
    showToast(t.addToCart.added(product.name, quantity), {
      action: { label: t.addToCart.viewCart, onClick: () => navigate('/checkout') }
    });
  };
}
