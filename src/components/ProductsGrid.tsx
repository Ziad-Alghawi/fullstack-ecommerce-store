import { Product } from './Product';
import './ProductsGrid.css';
import type { LoadCart, Product as ProductType } from '../types/store';

// Roughly the first row on a wide screen. The rest load as the user scrolls
const EAGER_IMAGE_COUNT = 6;

interface ProductsGridProps {
  products: ProductType[];
  loadCart: LoadCart;
  cardHeadingLevel?: 2 | 3;
}

export function ProductsGrid({ products, loadCart, cardHeadingLevel }: ProductsGridProps) {
  return (
    <div className="products-grid">
      {products.map((product, index) => (
        <Product key={product.id} product={product} loadCart={loadCart} headingLevel={cardHeadingLevel}
          lazyLoadImage={index >= EAGER_IMAGE_COUNT} />
      ))}
    </div>
  );
}
