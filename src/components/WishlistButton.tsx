import { useContext } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../hooks/useAuth';
import { useAction } from '../hooks/useAction';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { useWishlist } from '../hooks/useWishlist';
import { HeartIcon } from './Icons';
import type { Product } from '../types/store';
import './WishlistButton.css';

interface WishlistButtonProps {
  product: Product;
}

// A heart that saves the product for a logged in user, and asks a guest to log in
export function WishlistButton({ product }: WishlistButtonProps) {
  const auth = useContext(AuthContext);
  const wishlist = useWishlist();
  const showToast = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isSaved = Boolean(wishlist?.has(product.id));

  const [toggle, isToggling] = useAction(async () => {
    if (!wishlist) {
      showToast(t.wishlist.logInHint, { action: { label: t.common.logIn, onClick: () => navigate('/login') } });
    } else if (isSaved) {
      await wishlist.remove(product.id);
      showToast(t.wishlist.removed(product.name));
    } else {
      await wishlist.save(product);
      showToast(t.wishlist.saved(product.name), { action: { label: t.wishlist.view, onClick: () => navigate('/wishlist') } });
    }
  });

  // A deleted product can only be taken off the list
  if (!auth || (product.deletedAt && !isSaved)) {
    return null;
  }

  return (
    <button className="wishlist-button" type="button" aria-label={t.wishlist.save(product.name)}
      aria-pressed={isSaved} aria-busy={isToggling} onClick={toggle} data-testid="wishlist-button">
      <HeartIcon className="wishlist-button-icon" />
    </button>
  );
}
