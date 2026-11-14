import { useContext } from 'react';
import { Link, useNavigate } from 'react-router';
import { Header } from '../components/Header';
import { PageTitle } from '../components/PageTitle';
import { AuthContext } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../hooks/useI18n';
import type { CartItem } from '../types/store';
import './AccountPage.css';

interface AccountPageProps {
  cart: CartItem[];
}

export function AccountPage({ cart }: AccountPageProps) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const showToast = useToast();
  const user = auth?.user;
  const { t, formatDate } = useI18n();

  const logOut = async () => {
    await auth?.logOut();
    showToast(t.account.loggedOut);
    navigate('/');
  };

  return (
    <>
      <PageTitle title={t.account.title} />

      <Header cart={cart} />

      <main className="account-page page">
        {user ? (
          <>
            <h1 className="page-title">{t.account.title}</h1>

            <section className="account-card card" aria-labelledby="account-details-title">
              <h2 id="account-details-title" className="account-card-title">{t.account.loginDetails}</h2>
              <dl className="account-details">
                <div>
                  <dt>{t.common.email}</dt>
                  <dd data-testid="account-email">{user.email}</dd>
                </div>
                <div>
                  <dt>{t.account.customerSince}</dt>
                  <dd>{formatDate(user.created_at)}</dd>
                </div>
              </dl>
            </section>

            <nav className="account-links" aria-label={t.account.title}>
              <Link className="account-link card" to="/orders" data-testid="account-orders-link">
                <span className="account-link-title">{t.account.ordersTitle}</span>
                <span className="account-link-text">{t.account.ordersText}</span>
              </Link>
              <Link className="account-link card" to="/reset-password" data-testid="account-password-link">
                <span className="account-link-title">{t.account.passwordTitle}</span>
                <span className="account-link-text">{t.account.passwordText}</span>
              </Link>
              {auth.isAdmin && (
                <Link className="account-link card" to="/admin">
                  <span className="account-link-title">{t.account.manageTitle}</span>
                  <span className="account-link-text">{t.account.manageText}</span>
                </Link>
              )}
            </nav>

            <button className="button-secondary" type="button" onClick={logOut} data-testid="account-log-out-button">
              {t.account.logOut}
            </button>
          </>
        ) : (
          <div className="page-status" data-testid="account-login-message">
            <div>{t.account.logInPrompt}</div>
            <Link className="page-status-link link-primary" to="/login">{t.common.logIn}</Link>
          </div>
        )}
      </main>
    </>
  );
}
