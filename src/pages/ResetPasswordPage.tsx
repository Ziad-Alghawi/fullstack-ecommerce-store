import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Header } from '../components/Header';
import { PageTitle } from '../components/PageTitle';
import { ButtonSpinner } from '../components/PageStatus';
import { AuthContext } from '../hooks/useAuth';
import { useAuthRequest } from '../hooks/useAuthRequest';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../hooks/useI18n';
import type { CartItem } from '../types/store';
import './LoginPage.css';

interface ResetPasswordPageProps {
  cart: CartItem[];
}

// The link in a password reset email logs the user in and comes here. A logged in user
// can also come here from their account page to change their password
export function ResetPasswordPage({ cart }: ResetPasswordPageProps) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const showToast = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { t } = useI18n();

  const { submitForm, isPending, error } = useAuthRequest(async (supabase) => {
    if (password !== confirmation) {
      return { error: { message: t.resetPassword.mismatch } };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      showToast(t.resetPassword.changed);
      navigate('/account');
    }
    return { error };
  });

  return (
    <>
      <PageTitle title={t.resetPassword.title} />

      <Header cart={cart} />

      <main className="login-page page">
        {auth?.user ? (
          <form className="login-card card" onSubmit={submitForm}>
            <h1 className="page-title">{t.resetPassword.title}</h1>
            <p className="login-text">
              {t.resetPassword.forStart}<strong>{auth.user.email}</strong>{t.resetPassword.forRest}
            </p>

            <label className="form-field">
              {t.resetPassword.newPassword}
              <input type="password" required minLength={6} autoComplete="new-password" value={password}
                onChange={(event) => setPassword(event.target.value)}
                data-testid="reset-password-input" />
            </label>

            <label className="form-field">
              {t.resetPassword.repeat}
              <input type="password" required minLength={6} autoComplete="new-password" value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                data-testid="reset-confirmation-input" />
            </label>

            {error && <div className="login-error" role="alert" data-testid="login-error">{error}</div>}

            <button className="login-submit button-primary" type="submit" disabled={isPending}
              data-testid="reset-submit-button">
              {isPending && <ButtonSpinner />}
              {t.resetPassword.save}
            </button>
          </form>
        ) : (
          // Without a session the link was already used, has expired or was copied wrong
          <div className="login-card card" data-testid="reset-link-invalid">
            <h1 className="page-title">{t.resetPassword.expiredTitle}</h1>
            <p className="login-text">
              {t.resetPassword.expiredText}
            </p>
            <Link className="login-submit button-primary" to="/forgot-password">{t.resetPassword.sendNew}</Link>
          </div>
        )}
      </main>
    </>
  );
}
