import { readStorage, writeStorage } from './storage';
import { isUuid } from './uuid';

const STORAGE_KEY = 'visitorId';

// Identifies this browser to the API, so each visitor gets their own cart and orders. A damaged saved ID
// is replaced instead of failing every request. Without storage the cart only lasts until the page is reloaded
export function getVisitorId(): string {
  const savedId = readStorage(STORAGE_KEY);
  if (isUuid(savedId)) {
    return savedId;
  }

  const visitorId = crypto.randomUUID();
  writeStorage(STORAGE_KEY, visitorId);
  return visitorId;
}
