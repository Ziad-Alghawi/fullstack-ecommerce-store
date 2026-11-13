import axios from 'axios';
import { useContext, useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { PageTitle } from '../../components/PageTitle';
import { AuthContext } from '../../hooks/useAuth';
import { AdminNav } from './AdminNav';
import { AdminPageStatus } from './AdminPageStatus';
import { getLoadFailure, type AdminLoadStatus } from './adminLoadStatus';
import { AdminProductRow } from './AdminProductRow';
import { ProductForm } from './ProductForm';
import { AdminCoupons } from './AdminCoupons';
import { AdminOverview } from './AdminOverview';
import type { AdminStats, CartItem, Coupon, Product } from '../../types/store';
import './AdminPage.css';

interface AdminPageProps {
  cart: CartItem[];
  onRetry: () => void;
}

export function AdminPage({ cart, onRetry }: AdminPageProps) {
  const userId = useContext(AuthContext)?.user?.id;
  const [products, setProducts] = useState<Product[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [status, setStatus] = useState<AdminLoadStatus>('loading');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const loadProducts = async () => {
    const response = await axios.get<Product[]>('/api/products');
    if (!Array.isArray(response.data)) {
      throw new Error('Unexpected products response');
    }
    setProducts(response.data);
  };

  const loadStats = async () => {
    const response = await axios.get<AdminStats>('/api/admin/stats');
    if (!Array.isArray(response.data?.topProducts)) {
      throw new Error('Unexpected stats response');
    }
    setStats(response.data);
  };

  // Stock changes can add or remove low stock products
  const loadProductsAndStats = () => Promise.all([loadProducts(), loadStats()]);

  const loadCoupons = async () => {
    const response = await axios.get<Coupon[]>('/api/admin/coupons');
    if (!Array.isArray(response.data)) {
      throw new Error('Unexpected coupons response');
    }
    setCoupons(response.data);
  };

  useEffect(() => {
    if (!userId) {
      return;
    }
    Promise.all([axios.get<string[]>('/api/admin/images'), axios.get<string[]>('/api/products/categories'), loadProducts(), loadStats(), loadCoupons()])
      .then(([imagesResponse, categoriesResponse]) => {
        if (!Array.isArray(imagesResponse.data) || !Array.isArray(categoriesResponse.data)) {
          throw new Error('Unexpected images or categories response');
        }
        setImages(imagesResponse.data);
        setCategories(categoriesResponse.data);
        setStatus('ready');
      })
      .catch((error) => setStatus(getLoadFailure(error)));
  }, [userId]);

  const closeFormAfterSaving = async () => {
    await loadProductsAndStats();
    setEditing(null);
  };

  const removeDeletedProduct = async (product: Product) => {
    if (editing !== 'new' && editing?.id === product.id) {
      setEditing(null);
    }
    await loadProductsAndStats();
  };

  let pageContent;

  if (!userId || status !== 'ready' || !stats) {
    pageContent = <AdminPageStatus isLoggedIn={Boolean(userId)} status={status} onRetry={onRetry} />;
  } else {
    pageContent = (
      <>
        <AdminNav />

        <AdminOverview stats={stats} />

        <div className="admin-heading admin-section">
          <h2 className="admin-section-title">Products</h2>
          {!editing && (
            <button className="button-primary" type="button" onClick={() => setEditing('new')}
              data-testid="admin-add-button">
              Add product
            </button>
          )}
        </div>

        {editing && (
          <ProductForm key={editing === 'new' ? 'new' : editing.id}
            product={editing === 'new' ? null : editing} images={images} categories={categories}
            onSaved={closeFormAfterSaving} onCancel={() => setEditing(null)} />
        )}

        <div className="admin-table-container card">
          <table className="admin-table">
            <caption className="admin-caption">{products.length} products in the store</caption>
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">Image</span></th>
                <th scope="col">Name</th>
                <th scope="col">Price</th>
                <th scope="col">Stock</th>
                <th scope="col">Category</th>
                <th scope="col">Keywords</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <AdminProductRow key={product.id} product={product}
                  onEdit={() => setEditing(product)} onDeleted={() => removeDeletedProduct(product)} />
              ))}
            </tbody>
          </table>
        </div>

        <AdminCoupons coupons={coupons} loadCoupons={loadCoupons} />
      </>
    );
  }

  return (
    <>
      <PageTitle title="Admin" />

      <Header cart={cart} />

      <main className="admin-page page">
        {pageContent}
      </main>
    </>
  );
}
