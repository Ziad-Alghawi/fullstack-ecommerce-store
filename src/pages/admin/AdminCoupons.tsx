import { useState } from 'react';
import { CouponEditor } from './CouponEditor';
import { useI18n } from '../../hooks/useI18n';
import type { Coupon } from '../../types/store';

function getCouponStatus(coupon: Coupon) {
  if (!coupon.active) {
    return 'off';
  }
  return coupon.expiresAt && new Date(coupon.expiresAt) <= new Date() ? 'expired' : 'active';
}

interface AdminCouponsProps {
  coupons: Coupon[];
  loadCoupons: () => Promise<void>;
}

export function AdminCoupons({ coupons, loadCoupons }: AdminCouponsProps) {
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const { t, formatDate } = useI18n();

  const closeEditorAfterSaving = async () => {
    await loadCoupons();
    setEditing(null);
  };

  return (
    <section className="admin-section" aria-labelledby="admin-coupons-title">
      <div className="admin-heading">
        <h2 id="admin-coupons-title" className="admin-section-title">{t.admin.coupons.title}</h2>
        {!editing && (
          <button className="button-primary" type="button" onClick={() => setEditing('new')}
            data-testid="admin-add-coupon-button">
            {t.admin.coupons.add}
          </button>
        )}
      </div>

      {editing && (
        <CouponEditor key={editing === 'new' ? 'new' : editing.id} coupon={editing === 'new' ? null : editing}
          onSaved={closeEditorAfterSaving} onCancel={() => setEditing(null)} />
      )}

      <div className="admin-table-container card">
        <table className="admin-table admin-coupons-table">
          <caption className="admin-caption">
            {t.admin.coupons.caption(coupons.length)}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t.admin.coupons.code}</th>
              <th scope="col">{t.admin.coupons.discount}</th>
              <th scope="col">{t.admin.coupons.expires}</th>
              <th scope="col">{t.admin.coupons.status}</th>
              <th scope="col"><span className="visually-hidden">{t.admin.products.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => {
              const status = getCouponStatus(coupon);
              return (
                <tr key={coupon.id} data-testid="admin-coupon-row">
                  <td className="admin-cell-name">{coupon.code}</td>
                  <td>{t.admin.coupons.percentOff(coupon.percentOff)}</td>
                  <td>{coupon.expiresAt ? formatDate(coupon.expiresAt) : t.admin.coupons.never}</td>
                  <td>
                    <span className="admin-statuses">
                      <span className={`status-badge status-badge-${status}`}>{t.admin.coupons[status]}</span>
                      {coupon.featured && <span className="status-badge status-badge-featured">{t.admin.coupons.featured}</span>}
                    </span>
                  </td>
                  <td className="admin-cell-actions">
                    <div className="admin-actions">
                      <button className="button-secondary" type="button" onClick={() => setEditing(coupon)}
                        aria-label={t.admin.coupons.editLabel(coupon.code)}>
                        {t.common.edit}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
