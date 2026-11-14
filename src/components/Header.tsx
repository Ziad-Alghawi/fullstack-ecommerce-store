import { NavLink, useNavigate, useSearchParams } from 'react-router';
import { useContext, useState, type ChangeEvent, type FormEvent } from 'react';
import { getCartQuantity } from '../utils/cart';
import { AuthContext } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { LANGUAGE_CODES, LANGUAGES } from '../i18n/i18n';
import type { CartItem } from '../types/store';
import { CartIcon, SearchIcon, UserIcon } from './Icons';
import { Logo } from './Logo';
import './Header.css';

function LanguageSwitch() {
  const { t, language, setLanguage } = useI18n();

  return (
    <div className="header-switch" role="group" aria-label={t.header.language}>
      {LANGUAGE_CODES.map((code) => (
        <button key={code} className="header-switch-option" type="button" lang={code}
          aria-label={LANGUAGES[code].name} aria-pressed={language === code}
          onClick={() => setLanguage(code)} data-testid={`language-${code}`}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

interface HeaderProps {
  cart: CartItem[];
}

export function Header({ cart }: HeaderProps) {
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const cartQuantity = getCartQuantity(cart);

  const updateSearchInput = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const searchProducts = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/?search=${encodeURIComponent(search)}`);
  };

  return (
    <header className="header">
      <NavLink to="/" className="header-logo-link" onClick={() => setSearch('')}>
        <Logo white />
      </NavLink>

      <form className="search-form" role="search" onSubmit={searchProducts}>
        <input className="search-bar" type="search" placeholder={t.header.search}
          aria-label={t.header.search}
          value={search} onChange={updateSearchInput}
          data-testid="header-search-bar" />

        <button className="search-button" type="submit" aria-label={t.header.searchButton}
          data-testid="header-search-button">
          <SearchIcon />
        </button>
      </form>

      <nav className="header-nav">
        {auth?.isAdmin && (
          <NavLink className="header-link" to="/admin" data-testid="header-admin-link">
            {t.header.admin}
          </NavLink>
        )}

        <NavLink className="header-link" to="/orders"
          data-testid="header-orders-link">
          {t.header.orders}
        </NavLink>

        {auth?.user ? (
          <NavLink className="header-link" to="/account"
            aria-label={t.header.accountLabel(auth.user.email)}
            data-testid="header-account-link">
            <UserIcon className="header-link-icon" />
            <span className="header-account">
              <span className="header-account-email">{auth.user.email}</span>
              <span className="header-link-label">{t.header.account}</span>
            </span>
          </NavLink>
        ) : auth && (
          <NavLink className="header-link" to="/login" data-testid="header-login-link">
            <UserIcon className="header-link-icon" />
            <span className="header-link-label">{t.common.logIn}</span>
          </NavLink>
        )}

        <NavLink className="header-link" to="/checkout"
          aria-label={t.header.cartLabel(cartQuantity)}
          data-testid="header-cart-link">
          <span className="cart-icon">
            <CartIcon />
            {cartQuantity > 0 && <span className="cart-badge">{cartQuantity}</span>}
          </span>
          <span className="header-link-label">{t.header.cart}</span>
        </NavLink>
      </nav>

      <div className="header-settings">
        <LanguageSwitch />
      </div>
    </header>
  );
}
