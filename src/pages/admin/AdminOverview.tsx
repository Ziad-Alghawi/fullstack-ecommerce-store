import { Link } from 'react-router';
import { useI18n } from '../../hooks/useI18n';
import { describeStock, LOW_STOCK } from '../../utils/stock';
import type { AdminStats } from '../../types/store';

export function AdminOverview({ stats }: { stats: AdminStats }) {
  const { ordersLastDay, ordersLastWeek, revenueLastWeekCents, lowStockProducts, topProducts } = stats;
  const { t, formatMoney, formatNumber } = useI18n();
  const text = t.admin.stats;

  return (
    <section className="admin-overview" aria-labelledby="admin-overview-title">
      <h1 id="admin-overview-title" className="page-title">{text.title}</h1>

      <dl className="admin-stats">
        <div className="admin-stat card">
          <dt>{text.ordersDay}</dt>
          <dd data-testid="admin-stat-orders-day">{formatNumber(ordersLastDay)}</dd>
        </div>
        <div className="admin-stat card">
          <dt>{text.ordersWeek}</dt>
          <dd data-testid="admin-stat-orders-week">{formatNumber(ordersLastWeek)}</dd>
        </div>
        <div className="admin-stat card">
          <dt>{text.revenueWeek}</dt>
          <dd data-testid="admin-stat-revenue">{formatMoney(revenueLastWeekCents)}</dd>
        </div>
      </dl>

      <div className="admin-overview-lists">
        <section className="admin-overview-card card" aria-labelledby="admin-low-stock-title">
          <h2 id="admin-low-stock-title" className="admin-overview-title">
            {text.lowStock} <span className="admin-overview-count">{lowStockProducts.length}</span>
          </h2>
          {lowStockProducts.length > 0 ? (
            <ul className="admin-overview-list" data-testid="admin-low-stock">
              {lowStockProducts.map((product) => (
                <li key={product.id}>
                  <span>{product.name}</span>
                  <span className="stock-note">{describeStock(product.stock, t)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-overview-empty">{text.allStocked(LOW_STOCK)}</p>
          )}
        </section>

        <section className="admin-overview-card card" aria-labelledby="admin-top-products-title">
          <h2 id="admin-top-products-title" className="admin-overview-title">{text.topProducts}</h2>
          {topProducts.length > 0 ? (
            <ol className="admin-overview-list" data-testid="admin-top-products">
              {topProducts.map((product) => (
                <li key={product.id}>
                  <Link className="admin-overview-product" to={`/products/${product.id}`}>
                    <img className="product-thumbnail" src={product.image} alt="" width="480" height="480" loading="lazy" />
                    {product.name}
                  </Link>
                  <span className="admin-overview-sold">{text.sold(formatNumber(product.unitsSold))}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="admin-overview-empty">{text.noSales}</p>
          )}
        </section>
      </div>

      <p className="admin-hint">
        <Link className="link-primary" to="/admin/orders">{text.seeAll}</Link>{text.hintRest}
      </p>
    </section>
  );
}
