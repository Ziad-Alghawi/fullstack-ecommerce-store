import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Header } from '../components/Header';
import { PageTitle } from '../components/PageTitle';
import { ErrorMessage, LoadingMessage } from '../components/PageStatus';
import { ProductsGrid } from '../components/ProductsGrid';
import { useI18n } from '../hooks/useI18n';
import { useWishlist } from '../hooks/useWishlist';
import type { CartItem, LoadCart } from '../types/store';
import './WishlistPage.css';

interface WishlistPageProps {
  cart: CartItem[];
  loadCart: LoadCart;
}

export function WishlistPage({ cart, loadCart }: WishlistPageProps) {
  const wishlist = useWishlist();
  const { t } = useI18n();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const itemCount = wishlist?.items.length ?? 0;
  const previousCount = useRef(itemCount);

  // Removing a product takes away the heart that was clicked, so keyboard focus moves to the title
  useEffect(() => {
    if (itemCount < previousCount.current) {
      titleRef.current?.focus();
    }
    previousCount.current = itemCount;
  }, [itemCount]);

  let pageContent;

  if (!wishlist) {
    pageContent = (
      <div className="page-status" data-testid="wishlist-login-message">
        <div>{t.wishlist.logInPrompt}</div>
        <Link className="page-status-link link-primary" to="/login">{t.common.logIn}</Link>
      </div>
    );
  } else if (wishlist.status === 'failed') {
    pageContent = <ErrorMessage onButtonClick={wishlist.reload} />;
  } else if (wishlist.status === 'loading') {
    pageContent = <LoadingMessage />;
  } else if (wishlist.items.length === 0) {
    pageContent = (
      <div className="page-status" data-testid="wishlist-empty-message">
        <div>{t.wishlist.empty}</div>
        <div className="page-status-detail">{t.wishlist.emptyText}</div>
        <Link className="page-status-link link-primary" to="/">{t.common.browseProducts}</Link>
      </div>
    );
  } else {
    pageContent = <ProductsGrid products={wishlist.items.map(({ product }) => product)} loadCart={loadCart} />;
  }

  return (
    <>
      <PageTitle title={t.wishlist.title} />

      <Header cart={cart} />

      <main className="wishlist-page page">
        <h1 className="page-title" ref={titleRef} tabIndex={-1}>{t.wishlist.title}</h1>

        {pageContent}
      </main>
    </>
  );
}
