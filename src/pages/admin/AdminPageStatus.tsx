import { Link } from 'react-router';
import { ErrorMessage, LoadingMessage } from '../../components/PageStatus';
import { useI18n } from '../../hooks/useI18n';
import type { AdminLoadStatus } from './adminLoadStatus';

interface AdminPageStatusProps {
  isLoggedIn: boolean;
  status: AdminLoadStatus;
  onRetry: () => void;
}

// What an admin page shows until its data has loaded
export function AdminPageStatus({ isLoggedIn, status, onRetry }: AdminPageStatusProps) {
  const { t } = useI18n();

  if (!isLoggedIn) {
    return (
      <div className="page-status" data-testid="admin-login-message">
        <div>{t.admin.logInPrompt}</div>
        <Link className="page-status-link link-primary" to="/login">{t.common.logIn}</Link>
      </div>
    );
  }
  if (status === 'forbidden') {
    return (
      <div className="page-status" data-testid="admin-forbidden-message">
        <div>{t.admin.forbidden}</div>
        <Link className="page-status-link link-primary" to="/">{t.common.browseProducts}</Link>
      </div>
    );
  }
  if (status === 'failed') {
    return <ErrorMessage onButtonClick={onRetry} />;
  }
  return <LoadingMessage />;
}
