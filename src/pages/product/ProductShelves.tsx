import axios from 'axios';
import { useEffect, useState } from 'react';
import { ProductsGrid } from '../../components/ProductsGrid';
import { useI18n } from '../../hooks/useI18n';
import { addRecentlyViewed, getRecentlyViewed, RECENTLY_VIEWED_SHOWN } from '../../utils/recentlyViewed';
import { fetchProduct } from './fetchProduct';
import type { LoadCart, Product } from '../../types/store';

const RELATED_SHOWN = 4;

interface ProductShelfProps {
  id: string;
  title: string;
  products: Product[];
  loadCart: LoadCart;
}

// Left out until there's something to show. The page works the same without it
function ProductShelf({ id, title, products, loadCart }: ProductShelfProps) {
  if (products.length === 0) {
    return null;
  }
  return (
    <section className="product-shelf" aria-labelledby={id} data-testid={id}>
      <h2 id={id} className="product-shelf-title">{title}</h2>
      <ProductsGrid products={products} loadCart={loadCart} cardHeadingLevel={3} />
    </section>
  );
}

interface ShelfProps {
  product: Product;
  loadCart: LoadCart;
}

// The best rated products in the same category. The API leaves out deleted ones
export function RelatedProducts({ product, loadCart }: ShelfProps) {
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const { t } = useI18n();
  const { category } = product;

  useEffect(() => {
    if (!category) {
      return;
    }
    let isCurrent = true;
    axios.get<Product[]>(`/api/products?${new URLSearchParams({ category, sort: 'rating' })}`)
      .then(({ data }) => {
        if (isCurrent && Array.isArray(data)) {
          setCategoryProducts(data);
        }
      })
      .catch(() => {});
    return () => {
      isCurrent = false;
    };
  }, [category]);

  // Worked out here, so the list from the product before can't show the one now on the page
  const related = category
    ? categoryProducts.filter(({ id, category: otherCategory }) => id !== product.id && otherCategory === category).slice(0, RELATED_SHOWN)
    : [];

  return <ProductShelf id="related-products" title={t.product.related} products={related} loadCart={loadCart} />;
}

// What this browser looked at before, newest first, without products deleted since
export function RecentlyViewed({ product, loadCart }: ShelfProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const { t } = useI18n();
  const { id: productId, deletedAt } = product;

  useEffect(() => {
    let isCurrent = true;
    const ids = getRecentlyViewed().filter((id) => id !== productId).slice(0, RECENTLY_VIEWED_SHOWN);
    if (!deletedAt) {
      addRecentlyViewed(productId);
    }

    Promise.allSettled(ids.map(fetchProduct)).then((results) => {
      if (isCurrent) {
        setProducts(results.flatMap((result) => (result.status === 'fulfilled' && !result.value.deletedAt ? [result.value] : [])));
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [productId, deletedAt]);

  return (
    <ProductShelf id="recently-viewed" title={t.product.recentlyViewed}
      products={products.filter(({ id }) => id !== productId)} loadCart={loadCart} />
  );
}
