import axios from 'axios';
import { useState, type FormEvent } from 'react';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import type { Product } from '../../types/store';

// "images/products/2-slot-toaster-white.jpg" becomes "2 slot toaster white"
function describeImage(image: string) {
  return image.split('/').pop()!.replace(/\.\w+$/, '').replace(/-/g, ' ');
}

interface ProductFormProps {
  // Null when adding a new product
  product: Product | null;
  images: string[];
  categories: string[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}

export function ProductForm({ product, images, categories, onSaved, onCancel }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2) : '');
  const [keywords, setKeywords] = useState(product?.keywords?.join(', ') ?? '');
  const [image, setImage] = useState(product?.image ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const showToast = useToast();
  const { t, categoryName } = useI18n();
  const text = t.admin.products;

  const [save, isSaving] = useAction(async () => {
    const fields = {
      name,
      priceCents: Math.round(Number(price) * 100),
      image,
      category,
      stock: Number(stock),
      keywords: keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
    };
    if (product) {
      await axios.put(`/api/admin/products/${product.id}`, fields);
    } else {
      await axios.post('/api/admin/products', fields);
    }
    await onSaved();
    showToast(product ? text.saved(name.trim()) : text.added(name.trim()));
  });

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save();
  };

  const title = product ? text.editTitle : text.addTitle;

  return (
    <form className="admin-form card" onSubmit={submitForm} aria-label={title} data-testid="admin-product-form">
      <h2 className="admin-form-title">{title}</h2>

      <div className="admin-form-row">
        <label className="form-field">
          {text.name}
          {/* Opening the form scrolls to it */}
          <input type="text" required maxLength={100} autoFocus value={name}
            onChange={(event) => setName(event.target.value)}
            data-testid="admin-name-input" />
        </label>

        <label className="form-field">
          {text.priceInDollars}
          <input type="number" required min="0.01" max="10000" step="0.01" inputMode="decimal" value={price}
            onChange={(event) => setPrice(event.target.value)}
            data-testid="admin-price-input" />
        </label>

        <label className="form-field">
          {text.stock}
          <input type="number" required min="0" max="100000" step="1" inputMode="numeric" value={stock}
            onChange={(event) => setStock(event.target.value)}
            data-testid="admin-stock-input" />
        </label>
      </div>

      <label className="form-field">
        {text.category}
        <select required value={category} onChange={(event) => setCategory(event.target.value)}
          data-testid="admin-category-select">
          <option value="" disabled>{text.chooseCategory}</option>
          {categories.map((option) => (
            <option key={option} value={option}>{categoryName(option)}</option>
          ))}
        </select>
      </label>

      <label className="form-field">
        {text.keywords}
        <input type="text" value={keywords} aria-describedby="admin-keywords-hint"
          onChange={(event) => setKeywords(event.target.value)}
          data-testid="admin-keywords-input" />
        <span id="admin-keywords-hint" className="admin-hint">
          {text.keywordsHint}
        </span>
      </label>

      <fieldset className="admin-image-field">
        <legend>{text.image}</legend>
        <div className="admin-image-picker">
          {images.map((option) => (
            <label key={option} className="admin-image-option">
              <input type="radio" name="image" required value={option}
                checked={image === option} onChange={() => setImage(option)} />
              <img src={option} alt={describeImage(option)} width="480" height="480" loading="lazy" />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="admin-form-actions">
        <button className="button-primary" type="submit" disabled={isSaving}
          data-testid="admin-save-button">
          {isSaving && <ButtonSpinner />}
          {product ? t.common.saveChanges : text.add}
        </button>
        <button className="button-secondary" type="button" onClick={onCancel}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
