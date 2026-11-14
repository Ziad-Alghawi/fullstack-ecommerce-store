import { readStorage, writeStorage } from './storage';

const STORAGE_KEY = 'visitorId';
// The same check the API does, so a damaged saved ID is replaced instead of failing every request
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Identifies this browser to the API, so each visitor gets their own cart and orders.
// Without storage the cart only lasts until the page is reloaded
export function getVisitorId(): string {
  const savedId = readStorage(STORAGE_KEY);
  if (savedId && UUID_PATTERN.test(savedId)) {
    return savedId;
  }

  const visitorId = crypto.randomUUID();
  writeStorage(STORAGE_KEY, visitorId);
  return visitorId;
}
