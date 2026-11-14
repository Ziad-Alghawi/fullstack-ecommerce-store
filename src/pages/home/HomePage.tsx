import axios from 'axios';
import { useSearchParams } from 'react-router';
import { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { PageTitle } from '../../components/PageTitle';
import { ErrorMessage, LoadingMessage } from '../../components/PageStatus';
import { ProductsGrid } from './ProductsGrid';
import { ProductFilters } from './ProductFilters';
import { useI18n } from '../../hooks/useI18n';
import { getProductsUrl, readProductFilters } from '../../utils/productFilters';
import type { CartItem, LoadCart, Product } from '../../types/store';
import './HomePage.css';

interface HomePageProps {
  cart: CartItem[];
  loadCart: LoadCart;
  onRetry: () => void;
}

export function HomePage({ cart, loadCart, onRetry }: HomePageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  // Stays false until the first response, so the empty message never flashes while loading
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [searchParams] = useSearchParams();
  const { t, categoryName } = useI18n();
  const filters = readProductFilters(searchParams);
  const { search, category } = filters;
  const productsUrl = getProductsUrl(filters);

  useEffect(() => {
    axios.get<string[]>('/api/products/categories')
      .then(({ data }) => setCategories(Array.isArray(data) ? data : []))
      // The shop still works without the category links
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Set to false when the filters change, so a slow older response can't replace newer results
    let isLatestRequest = true;
    setHasError(false);

    const fetchProducts = async () => {
      try {
        const response = await axios.get<Product[]>(productsUrl);
        if (!isLatestRequest) {
          return;
        }
        if (!Array.isArray(response.data)) {
          throw new Error('Unexpected products response');
        }
        setProducts(response.data);
        setHasLoaded(true);
      } catch {
        if (isLatestRequest) {
          setHasError(true);
        }
      }
    };
    fetchProducts();

    return () => {
      isLatestRequest = false;
    };
  }, [productsUrl]);

  const title = search ? t.home.resultsFor(search) : category ? categoryName(category) : undefined;
  let pageContent = <ProductsGrid products={products} loadCart={loadCart} />;

  if (hasError) {
    pageContent = <ErrorMessage onButtonClick={onRetry} />;
  } else if (!hasLoaded) {
    pageContent = <LoadingMessage />;
  } else if (products.length === 0) {
    const hasFilters = Boolean(category || filters.minPrice || filters.maxPrice);
    pageContent = (
      <div className="page-status" data-testid="no-products-message">
        {search ? t.home.noResults(search) : hasFilters ? t.home.noMatch : t.home.noProducts}
      </div>
    );
  }

  return (
    <>
      <PageTitle title={title} />

      <Header cart={cart} />

      <main className="home-page page">
        <div className="home-intro">
          <h1 className="page-title">
            {title ?? t.home.title}
          </h1>
          {!title && (
            <p className="home-intro-text">
              {t.home.intro}
            </p>
          )}
        </div>

        {!hasError && (
          <ProductFilters categories={categories} filters={filters}
            productCount={hasLoaded ? products.length : null} />
        )}

        {pageContent}
      </main>
    </>
  );
}
