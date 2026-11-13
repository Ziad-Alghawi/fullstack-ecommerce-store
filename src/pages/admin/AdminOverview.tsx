import { Link } from 'react-router';
import { formatMoney } from '../../utils/money';
import { describeStock } from '../../utils/stock';
import type { AdminStats } from '../../types/store';

export function AdminOverview({ stats }: { stats: AdminStats }) {
  const { ordersLastDay, ordersLastWeek, revenueLastWeekCents, lowStockProducts, topProducts } = stats;

  return (
    <section className="admin-overview" aria-labelledby="admin-overview-title">
      <h1 id="admin-overview-title" className="page-title">Store overview</h1>

      <dl className="admin-stats">
        <div className="admin-stat card">
          <dt>Orders, last 24 hours</dt>
          <dd data-testid="admin-stat-orders-day">{ordersLastDay}</dd>
        </div>
        <div className="admin-stat card">
          <dt>Orders, last 7 days</dt>
          <dd data-testid="admin-stat-orders-week">{ordersLastWeek}</dd>
        </div>
        <div className="admin-stat card">
          <dt>Revenue, last 7 days</dt>
          <dd data-testid="admin-stat-revenue">{formatMoney(revenueLastWeekCents)}</dd>
        </div>
      </dl>

      <div className="admin-overview-lists">
        <section className="admin-overview-card card" aria-labelledby="admin-low-stock-title">
          <h2 id="admin-low-stock-title" className="admin-overview-title">
            Low stock <span className="admin-overview-count">{lowStockProducts.length}</span>
          </h2>
          {lowStockProducts.length > 0 ? (
            <ul className="admin-overview-list" data-testid="admin-low-stock">
              {lowStockProducts.map((product) => (
                <li key={product.id}>
                  <span>{product.name}</span>
                  <span className="stock-note">{describeStock(product.stock)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-overview-empty">Every product has more than 5 in stock</p>
          )}
        </section>

        <section className="admin-overview-card card" aria-labelledby="admin-top-products-title">
          <h2 id="admin-top-products-title" className="admin-overview-title">Top products</h2>
          {topProducts.length > 0 ? (
            <ol className="admin-overview-list" data-testid="admin-top-products">
              {topProducts.map((product) => (
                <li key={product.id}>
                  <Link className="admin-overview-product" to={`/products/${product.id}`}>
                    <img className="product-thumbnail" src={product.image} alt="" width="480" height="480" loading="lazy" />
                    {product.name}
                  </Link>
                  <span className="admin-overview-sold">{product.unitsSold} sold</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="admin-overview-empty">No sales yet</p>
          )}
        </section>
      </div>

      <p className="admin-hint">
        <Link className="link-primary" to="/admin/orders">See every order</Link>. Cancelled orders don't count toward revenue or sales.
      </p>
    </section>
  );
}
