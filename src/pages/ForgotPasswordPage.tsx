import { useState } from 'react';
import { Link } from 'react-router';
import { Header } from '../components/Header';
import { PageTitle } from '../components/PageTitle';
import { ButtonSpinner } from '../components/PageStatus';
import { useAuthRequest } from '../hooks/useAuthRequest';
import { useI18n } from '../hooks/useI18n';
import { getSiteUrl } from '../utils/siteUrl';
import type { CartItem } from '../types/store';
import './LoginPage.css';

interface ForgotPasswordPageProps {
  cart: CartItem[];
}

export function ForgotPasswordPage({ cart }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const { t } = useI18n();

  const { submitForm, isPending, error } = useAuthRequest(async (supabase) => {
    // The link in the email logs the user in on this site, to the page where they choose a new password
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/reset-password`
    });
    setIsSent(!error);
    return { error };
  });

  return (
    <>
      <PageTitle title={t.forgotPassword.title} />

      <Header cart={cart} />

      <main className="login-page page">
        {isSent ? (
          <div className="login-card card" role="status" data-testid="reset-email-sent">
            <h1 className="page-title">{t.login.checkEmail}</h1>
            <p className="login-text">
              {t.forgotPassword.sentStart}<strong>{email}</strong>{t.forgotPassword.sentRest}
            </p>
            <Link className="link-primary" to="/login">{t.forgotPassword.backToLogIn}</Link>
          </div>
        ) : (
          <form className="login-card card" onSubmit={submitForm}>
            <h1 className="page-title">{t.forgotPassword.title}</h1>
            <p className="login-text">
              {t.forgotPassword.intro}
            </p>

            <label className="form-field">
              {t.common.email}
              <input type="email" required autoComplete="email" value={email}
                onChange={(event) => setEmail(event.target.value)}
                data-testid="forgot-email-input" />
            </label>

            {error && <div className="login-error" role="alert" data-testid="login-error">{error}</div>}

            <button className="login-submit button-primary" type="submit" disabled={isPending}
              data-testid="forgot-submit-button">
              {isPending && <ButtonSpinner />}
              {t.forgotPassword.send}
            </button>

            <div className="login-switch">
              {t.forgotPassword.remembered} <Link className="link-primary" to="/login">{t.common.logIn}</Link>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
