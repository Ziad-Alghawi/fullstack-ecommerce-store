import { NavLink } from 'react-router';

export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Admin">
      <NavLink className="admin-nav-link" to="/admin" end>Overview</NavLink>
      <NavLink className="admin-nav-link" to="/admin/orders" data-testid="admin-orders-link">Orders</NavLink>
    </nav>
  );
}
