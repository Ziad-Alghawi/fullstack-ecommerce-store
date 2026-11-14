import { useEffect, useState } from 'react';
import { useI18n } from '../hooks/useI18n';
import './PageStatus.css';

// How long to wait before explaining why loading is taking a while
const SLOW_LOADING_MS = 4000;

export function LoadingMessage() {
  const [isSlow, setIsSlow] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="page-status page-status-loading" role="status" data-testid="loading-message">
      <div className="page-status-spinner"></div>
      <div>{t.pageStatus.loading}</div>
      {isSlow && (
        <div className="page-status-detail" data-testid="slow-loading-message">
          {t.pageStatus.slow}
        </div>
      )}
    </div>
  );
}

// Shown inside a button while its request runs
export function ButtonSpinner() {
  return <span className="button-spinner" aria-hidden="true" data-testid="button-spinner"></span>;
}

interface ErrorMessageProps {
  title?: string;
  detail?: string;
  buttonText?: string;
  onButtonClick: () => void;
}

export function ErrorMessage({ title, detail, buttonText, onButtonClick }: ErrorMessageProps) {
  const { t } = useI18n();

  return (
    <div className="page-status" role="alert" data-testid="error-message">
      <div>{title ?? t.pageStatus.errorTitle}</div>
      <div className="page-status-detail">{detail ?? t.pageStatus.errorDetail}</div>
      <button className="page-status-button button-primary" onClick={onButtonClick}
        data-testid="error-message-button">
        {buttonText ?? t.common.tryAgain}
      </button>
    </div>
  );
}
