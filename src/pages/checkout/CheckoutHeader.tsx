import { Link } from 'react-router';
import { getCartQuantity } from '../../utils/cart';
import type { CartItem } from '../../types/store';
import { LockIcon } from '../../components/Icons';
import { Logo } from '../../components/Logo';
import { useI18n } from '../../hooks/useI18n';
import './CheckoutHeader.css';

interface CheckoutHeaderProps {
  cart: CartItem[];
}

export function CheckoutHeader({ cart }: CheckoutHeaderProps) {
  const cartQuantity = getCartQuantity(cart);
  const { t } = useI18n();

  return (
    <header className="checkout-header">
      <div className="checkout-header-content" data-testid="checkout-header">
        <Link to="/" className="checkout-header-logo-link">
          <Logo />
        </Link>

        <div className="checkout-header-title">
          {t.checkout.title} (<Link className="link-primary" to="/">
            {t.checkout.itemCount(cartQuantity)}
          </Link>)
        </div>

        <div className="checkout-header-secure">
          <LockIcon />
          <span className="checkout-header-secure-text">{t.checkout.secure}</span>
        </div>
      </div>
    </header>
  );
}
