import { readStorage, writeStorage } from './storage';
import { isUuid } from './uuid';

const STORAGE_KEY = 'recentlyViewed';
export const RECENTLY_VIEWED_SHOWN = 4;

// Product IDs, newest first. Anything else saved there counts as nothing
export function getRecentlyViewed(): string[] {
  try {
    const ids: unknown = JSON.parse(readStorage(STORAGE_KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter(isUuid) : [];
  } catch {
    return [];
  }
}

// Keeps one more than is shown, as a product page leaves out the product it shows
export function addRecentlyViewed(productId: string) {
  const ids = [productId, ...getRecentlyViewed().filter((id) => id !== productId)];
  writeStorage(STORAGE_KEY, JSON.stringify(ids.slice(0, RECENTLY_VIEWED_SHOWN + 1)));
}
