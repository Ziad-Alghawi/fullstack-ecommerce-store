import type { Messages } from '../i18n/en';

// At or below this, the shop says how many are left
export const LOW_STOCK = 5;

export function describeStock(stock: number, t: Messages) {
  return stock === 0 ? t.stock.outOfStock : t.stock.onlyLeft(stock);
}
