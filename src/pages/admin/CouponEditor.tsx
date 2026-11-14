import axios from 'axios';
import dayjs from 'dayjs';
import { useState, type FormEvent } from 'react';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import type { Coupon } from '../../types/store';

interface CouponEditorProps {
  // Null when adding a new coupon
  coupon: Coupon | null;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}

export function CouponEditor({ coupon, onSaved, onCancel }: CouponEditorProps) {
  const [code, setCode] = useState(coupon?.code ?? '');
  const [percentOff, setPercentOff] = useState(coupon ? String(coupon.percentOff) : '');
  const [expiryDate, setExpiryDate] = useState(coupon?.expiresAt ? dayjs(coupon.expiresAt).format('YYYY-MM-DD') : '');
  const [active, setActive] = useState(coupon?.active ?? true);
  const [featured, setFeatured] = useState(coupon?.featured ?? false);
  const showToast = useToast();
  const { t } = useI18n();
  const text = t.admin.coupons;

  const [save, isSaving] = useAction(async () => {
    const fields = {
      code,
      percentOff: Number(percentOff),
      // A coupon works until the end of its last day
      expiresAt: expiryDate ? dayjs(expiryDate).endOf('day').toISOString() : null,
      active,
      featured
    };
    if (coupon) {
      await axios.put(`/api/admin/coupons/${coupon.id}`, fields);
    } else {
      await axios.post('/api/admin/coupons', fields);
    }
    await onSaved();
    showToast(text.saved(code.trim().toUpperCase()));
  });

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save();
  };

  const title = coupon ? text.editTitle : text.addTitle;

  return (
    <form className="admin-form card" onSubmit={submitForm} aria-label={title} data-testid="admin-coupon-form">
      <h3 className="admin-form-title">{title}</h3>

      <div className="admin-form-row">
        <label className="form-field">
          {text.code}
          <input type="text" required pattern="[A-Za-z0-9]{3,20}" title={text.codeHint}
            autoFocus value={code} onChange={(event) => setCode(event.target.value)}
            data-testid="admin-coupon-code-input" />
        </label>

        <label className="form-field">
          {text.percentOffLabel}
          <input type="number" required min="1" max="90" step="1" inputMode="numeric" value={percentOff}
            onChange={(event) => setPercentOff(event.target.value)}
            data-testid="admin-coupon-percent-input" />
        </label>

        <label className="form-field">
          {text.expiresAfter}
          <input type="date" value={expiryDate} aria-describedby="admin-coupon-expiry-hint"
            onChange={(event) => setExpiryDate(event.target.value)}
            data-testid="admin-coupon-expiry-input" />
          <span id="admin-coupon-expiry-hint" className="admin-hint">{text.noEndDate}</span>
        </label>
      </div>

      <label className="admin-checkbox">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)}
          data-testid="admin-coupon-active-input" />
        {text.activeLabel}
      </label>

      <label className="admin-checkbox">
        <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)}
          aria-describedby="admin-coupon-featured-hint" data-testid="admin-coupon-featured-input" />
        {text.featuredLabel}
      </label>
      <span id="admin-coupon-featured-hint" className="admin-hint">
        {text.featuredHint}
      </span>

      <div className="admin-form-actions">
        <button className="button-primary" type="submit" disabled={isSaving}
          data-testid="admin-coupon-save-button">
          {isSaving && <ButtonSpinner />}
          {coupon ? t.common.saveChanges : text.add}
        </button>
        <button className="button-secondary" type="button" onClick={onCancel}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
