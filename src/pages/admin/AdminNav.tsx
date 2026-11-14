import { NavLink } from 'react-router';
import { useI18n } from '../../hooks/useI18n';

export function AdminNav() {
  const { t } = useI18n();

  return (
    <nav className="admin-nav" aria-label={t.admin.nav}>
      <NavLink className="admin-nav-link" to="/admin" end>{t.admin.overview}</NavLink>
      <NavLink className="admin-nav-link" to="/admin/orders" data-testid="admin-orders-link">{t.admin.orders}</NavLink>
    </nav>
  );
}
