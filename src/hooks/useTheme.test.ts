import { it, expect, describe, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  const originalMatchMedia = window.matchMedia;
  let systemIsDark: boolean;
  let notifySystemChange: () => void;

  beforeEach(() => {
    localStorage.clear();
    systemIsDark = false;
    window.matchMedia = vi.fn((query: string) => ({
      get matches() {
        return systemIsDark;
      },
      media: query,
      addEventListener: (_event: string, listener: () => void) => {
        notifySystemChange = listener;
      },
      removeEventListener: vi.fn()
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    delete document.documentElement.dataset.theme;
  });

  it("follows the system's theme, also when it changes", () => {
    systemIsDark = true;
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    systemIsDark = false;
    act(() => notifySystemChange());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it("remembers a theme other than the system's, and forgets it when the visitor goes back", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    act(() => result.current.setTheme('light'));
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it("keeps the saved theme when the system's changes", () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useTheme());

    systemIsDark = true;
    act(() => notifySystemChange());
    systemIsDark = false;
    act(() => notifySystemChange());

    expect(result.current.theme).toBe('dark');
  });

  it('ignores a saved value it does not know', () => {
    localStorage.setItem('theme', 'sepia');

    expect(renderHook(() => useTheme()).result.current.theme).toBe('light');
  });
});
