import { it, expect, describe, beforeEach } from 'vitest';
import { addRecentlyViewed, getRecentlyViewed } from './recentlyViewed';

const ids = Array.from({ length: 6 }, (_, index) => `e43638ce-6aa0-4b85-b27f-e1d07eb678c${index}`);

describe('recently viewed products', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps the newest first, each once, and no more than five', () => {
    ids.forEach(addRecentlyViewed);
    addRecentlyViewed(ids[3]);

    expect(getRecentlyViewed()).toEqual([ids[3], ids[5], ids[4], ids[2], ids[1]]);
  });

  it('ignores whatever else is saved there', () => {
    localStorage.setItem('recentlyViewed', 'not json');
    expect(getRecentlyViewed()).toEqual([]);

    localStorage.setItem('recentlyViewed', JSON.stringify({ id: ids[0] }));
    expect(getRecentlyViewed()).toEqual([]);

    localStorage.setItem('recentlyViewed', JSON.stringify([ids[0], '../admin', 42]));
    expect(getRecentlyViewed()).toEqual([ids[0]]);
  });
});
