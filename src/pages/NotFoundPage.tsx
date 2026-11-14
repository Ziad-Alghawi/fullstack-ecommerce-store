import { Link } from 'react-router';
import { Header } from '../components/Header';
import { PageTitle } from '../components/PageTitle';
import { useI18n } from '../hooks/useI18n';
import type { CartItem } from '../types/store';

interface NotFoundPageProps {
  cart: CartItem[];
}

export function NotFoundPage({ cart }: NotFoundPageProps) {
  const { t } = useI18n();

  return (
    <>
      <PageTitle title={t.notFound.title} />

      <Header cart={cart} />

      <main className="page-status">
        <h1 className="page-title">{t.notFound.title}</h1>
        <div className="page-status-detail">
          {t.notFound.text}
        </div>
        <Link className="page-status-link link-primary" to="/">{t.common.browseProducts}</Link>
      </main>
    </>
  );
}
