import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useI18n } from '../../hooks/useI18n';
import { SORTS, withFilters, type Filters } from '../../utils/productFilters';

interface PriceFilterProps {
  filters: Filters;
  onApply: (minPrice: string, maxPrice: string) => void;
}

function PriceFilter({ filters, onApply }: PriceFilterProps) {
  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const { t } = useI18n();

  const applyPrices = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isReversed = minPrice && maxPrice && Number(minPrice) > Number(maxPrice);
    onApply(isReversed ? maxPrice : minPrice, isReversed ? minPrice : maxPrice);
  };

  return (
    <form className="price-filter" onSubmit={applyPrices} aria-label={t.home.price}>
      <label className="price-filter-field">
        <span className="visually-hidden">{t.home.minPrice}</span>
        <span aria-hidden="true">€</span>
        <input type="number" min="0" step="0.01" inputMode="decimal" placeholder={t.home.min} value={minPrice}
          onChange={(event) => setMinPrice(event.target.value)} data-testid="min-price-input" />
      </label>
      <span aria-hidden="true">{t.home.priceTo}</span>
      <label className="price-filter-field">
        <span className="visually-hidden">{t.home.maxPrice}</span>
        <span aria-hidden="true">€</span>
        <input type="number" min="0" step="0.01" inputMode="decimal" placeholder={t.home.max} value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)} data-testid="max-price-input" />
      </label>
      <button className="button-secondary" type="submit" data-testid="price-apply-button">{t.common.apply}</button>
    </form>
  );
}

interface ProductFiltersProps {
  categories: string[];
  filters: Filters;
  // Unknown while the products load
  productCount: number | null;
}

// Every choice is kept in the URL, so links and the back button bring it back
export function ProductFilters({ categories, filters, productCount }: ProductFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, categoryName } = useI18n();
  const hasFilters = Boolean(filters.category || filters.minPrice || filters.maxPrice || filters.sort);
  const linkWith = (changes: Partial<Filters>) => `?${withFilters(searchParams, changes)}`;

  return (
    <div className="product-filters">
      {/* Always there, so the toolbar below doesn't move down once the categories load */}
      <nav aria-label={t.home.categories}>
        <ul className="category-chips">
          {['', ...categories].map((category) => (
            <li key={category}>
              <Link className="category-chip" to={linkWith({ category })}
                aria-current={filters.category === category ? 'true' : undefined}
                data-testid="category-chip">
                {category ? categoryName(category) : t.home.allCategories}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="product-toolbar">
        <div className="product-toolbar-summary">
          <p className="products-count" role="status" data-testid="products-count">
            {productCount !== null && t.home.productCount(productCount)}
          </p>
          {hasFilters && (
            <Link className="link-primary" to={linkWith({ category: '', minPrice: '', maxPrice: '', sort: '' })}
              data-testid="clear-filters-link">
              {t.home.clearFilters}
            </Link>
          )}
        </div>

        <div className="product-toolbar-controls">
          {/* Starts again from the URL when it changes, for example with the back button */}
          <PriceFilter key={`${filters.minPrice}-${filters.maxPrice}`} filters={filters}
            onApply={(minPrice, maxPrice) => setSearchParams(withFilters(searchParams, { minPrice, maxPrice }))} />

          <label className="sort-field">
            {t.home.sortBy}
            <select value={filters.sort} data-testid="sort-select"
              onChange={(event) => setSearchParams(withFilters(searchParams, { sort: event.target.value }))}>
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>{t.home.sorts[sort]}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
