import { Link } from 'react-router';
import { ErrorMessage, LoadingMessage } from '../../components/PageStatus';
import type { AdminLoadStatus } from './adminLoadStatus';

interface AdminPageStatusProps {
  isLoggedIn: boolean;
  status: AdminLoadStatus;
  onRetry: () => void;
}

// What an admin page shows until its data has loaded
export function AdminPageStatus({ isLoggedIn, status, onRetry }: AdminPageStatusProps) {
  if (!isLoggedIn) {
    return (
      <div className="page-status" data-testid="admin-login-message">
        <div>Log in with an admin account to manage the store</div>
        <Link className="page-status-link link-primary" to="/login">Log in</Link>
      </div>
    );
  }
  if (status === 'forbidden') {
    return (
      <div className="page-status" data-testid="admin-forbidden-message">
        <div>This page is only for admins</div>
        <Link className="page-status-link link-primary" to="/">Browse products</Link>
      </div>
    );
  }
  if (status === 'failed') {
    return <ErrorMessage onButtonClick={onRetry} />;
  }
  return <LoadingMessage />;
}
