// Storage can be blocked, for example in some private windows. Then nothing is remembered
export function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Remembered until the page is reloaded
  }
}
