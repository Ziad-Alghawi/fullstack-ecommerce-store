import { useContext, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Header } from '../components/Header';
import { PageTitle } from '../components/PageTitle';
import { ButtonSpinner } from '../components/PageStatus';
import { AuthContext } from '../hooks/useAuth';
import { useAuthRequest } from '../hooks/useAuthRequest';
import { useI18n } from '../hooks/useI18n';
import type { CartItem } from '../types/store';
import './LoginPage.css';

interface LoginPageProps {
  cart: CartItem[];
}

export function LoginPage({ cart }: LoginPageProps) {
  const auth = useContext(AuthContext);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const { t } = useI18n();

  const { submitForm, isPending, error, clearError } = useAuthRequest(async (supabase) => {
    const credentials = { email, password };
    const { data, error } = isSignUp
      // The link in the confirmation email comes back to this site
      ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword(credentials);

    if (!error && !data.session) {
      setIsAwaitingConfirmation(true);
    }
    return { error };
  });

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
  };

  if (auth?.user) {
    return <Navigate to="/" replace />;
  }

  const title = isSignUp ? t.login.signUpTitle : t.common.logIn;

  return (
    <>
      <PageTitle title={title} />

      <Header cart={cart} />

      <main className="login-page page">
        {isAwaitingConfirmation ? (
          <div className="login-card card" role="status" data-testid="login-confirmation">
            <h1 className="page-title">{t.login.checkEmail}</h1>
            <p className="login-text">
              {t.login.confirmationStart}<strong>{email}</strong>{t.login.confirmationRest}
            </p>
          </div>
        ) : (
          <form className="login-card card" onSubmit={submitForm}>
            <h1 className="page-title">{title}</h1>
            <p className="login-text">
              {t.login.intro}
            </p>

            <label className="form-field">
              {t.common.email}
              <input type="email" required autoComplete="email" value={email}
                onChange={(event) => setEmail(event.target.value)}
                data-testid="login-email-input" />
            </label>

            <label className="form-field">
              {t.common.password}
              <input type="password" required minLength={6}
                autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password}
                onChange={(event) => setPassword(event.target.value)}
                data-testid="login-password-input" />
            </label>

            {!isSignUp && (
              <Link className="login-forgot link-primary" to="/forgot-password" data-testid="login-forgot-link">
                {t.login.forgot}
              </Link>
            )}

            {error && <div className="login-error" role="alert" data-testid="login-error">{error}</div>}

            <button className="login-submit button-primary" type="submit" disabled={isPending}
              data-testid="login-submit-button">
              {isPending && <ButtonSpinner />}
              {isSignUp ? t.login.signUp : t.common.logIn}
            </button>

            <div className="login-switch">
              {isSignUp ? t.login.haveAccount : t.login.newHere}{' '}
              <button className="link-primary link-button" type="button" onClick={switchMode}
                data-testid="login-switch-button">
                {isSignUp ? t.common.logIn : t.login.createAccount}
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
