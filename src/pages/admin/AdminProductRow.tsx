import axios from 'axios';
import { useState } from 'react';
import { ButtonSpinner } from '../../components/PageStatus';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import { describeStock, LOW_STOCK } from '../../utils/stock';
import type { Product } from '../../types/store';

interface AdminProductRowProps {
  product: Product;
  onEdit: () => void;
  onDeleted: () => Promise<void>;
}

export function AdminProductRow({ product, onEdit, onDeleted }: AdminProductRowProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const showToast = useToast();
  const { t, formatMoney, formatNumber, categoryName } = useI18n();
  const text = t.admin.products;

  const [deleteProduct, isDeleting] = useAction(async () => {
    await axios.delete(`/api/admin/products/${product.id}`);
    await onDeleted();
    showToast(text.deleted(product.name));
  });

  return (
    <tr data-testid="admin-product-row">
      <td className="admin-cell-image">
        <img className="product-thumbnail" src={product.image} alt="" width="480" height="480" loading="lazy" />
      </td>
      <td className="admin-cell-name">{product.name}</td>
      <td className="admin-cell-price">{formatMoney(product.priceCents)}</td>
      <td className="admin-cell-stock">
        {product.stock <= LOW_STOCK
          ? <span className="stock-note">{describeStock(product.stock, t)}</span>
          : t.stock.inStock(formatNumber(product.stock))}
      </td>
      <td className="admin-cell-category">{product.category && categoryName(product.category)}</td>
      <td className="admin-cell-keywords">{product.keywords?.join(', ')}</td>
      <td className="admin-cell-actions">
        {/* The keys swap in new buttons, so a double click on Delete can't also confirm it */}
        {isConfirmingDelete ? (
          <div key="confirm" className="admin-actions" role="group" aria-label={text.deleteGroup(product.name)}>
            <span className="admin-confirm-text">{text.deleteQuestion}</span>
            <button className="button-danger" type="button" disabled={isDeleting} onClick={deleteProduct}
              data-testid="admin-confirm-delete-button">
              {isDeleting && <ButtonSpinner />}
              {t.common.delete}
            </button>
            <button className="button-secondary" type="button" disabled={isDeleting} autoFocus
              onClick={() => setIsConfirmingDelete(false)}>
              {t.common.keep}
            </button>
          </div>
        ) : (
          <div key="actions" className="admin-actions">
            <button className="button-secondary" type="button" onClick={onEdit}
              aria-label={text.editLabel(product.name)} data-testid="admin-edit-button">
              {t.common.edit}
            </button>
            <button className="button-secondary" type="button" onClick={() => setIsConfirmingDelete(true)}
              aria-label={text.deleteLabel(product.name)} data-testid="admin-delete-button">
              {t.common.delete}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
