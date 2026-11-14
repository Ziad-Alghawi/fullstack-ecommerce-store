import axios from 'axios';
import { useId, useState, type FormEvent } from 'react';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import type { ApiError, AppliedCoupon } from '../../types/store';

interface CouponFormProps {
  appliedCoupon: AppliedCoupon | null;
  featuredCoupon: AppliedCoupon | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}

export function CouponForm({ appliedCoupon, featuredCoupon, onApply, onRemove }: CouponFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const showToast = useToast();
  const { t, apiError } = useI18n();
  const inputId = useId();
  const hintId = useId();

  const [checkCode, isChecking] = useAction(async () => {
    setError(null);
    try {
      const response = await axios.get<AppliedCoupon>(`/api/coupons/${encodeURIComponent(code.trim())}`);
      onApply(response.data.code);
      setCode('');
      showToast(t.coupon.applied(response.data.code));
    } catch (error) {
      // The API says why a code doesn't work. Anything else is worth another try
      const reason = axios.isAxiosError<ApiError>(error) && error.response?.status === 404
        ? apiError(error.response.data)
        : null;
      setError(reason ?? t.coupon.checkFailed);
    }
  });

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim()) {
      checkCode();
    }
  };

  if (appliedCoupon) {
    return (
      <div className="coupon-applied" data-testid="coupon-applied">
        <span>
          <strong>{appliedCoupon.code}</strong>{t.coupon.appliedRest(appliedCoupon.percentOff)}
        </span>
        <button className="link-primary link-button" type="button"
          onClick={() => {
            onRemove();
            showToast(t.coupon.removed);
          }}
          aria-label={t.coupon.removeLabel(appliedCoupon.code)} data-testid="coupon-remove-button">
          {t.common.remove}
        </button>
      </div>
    );
  }

  return (
    <form className="coupon-form" onSubmit={submitCode}>
      <label className="coupon-label" htmlFor={inputId}>{t.coupon.label}</label>
      <div className="coupon-row">
        <input id={inputId} type="text" value={code} autoComplete="off" autoCapitalize="characters"
          spellCheck={false} aria-describedby={featuredCoupon ? hintId : undefined} aria-invalid={Boolean(error)}
          onChange={(event) => setCode(event.target.value)} data-testid="coupon-input" />
        <button className="button-secondary" type="submit" disabled={isChecking} aria-busy={isChecking}
          data-testid="coupon-apply-button">
          {isChecking && <ButtonSpinner />}
          {t.common.apply}
        </button>
      </div>
      {error && <div className="coupon-error" role="alert" data-testid="coupon-error">{error}</div>}
      {featuredCoupon && (
        <p id={hintId} className="coupon-hint" data-testid="coupon-hint">
          {t.coupon.hintStart}<strong>{featuredCoupon.code}</strong>{t.coupon.hintRest(featuredCoupon.percentOff)}
        </p>
      )}
    </form>
  );
}
