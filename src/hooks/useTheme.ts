import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { readStorage, removeStorage, writeStorage } from '../utils/storage';

type Theme = 'light' | 'dark';

interface ThemeSetting {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// App fills this in
export const ThemeContext = createContext<ThemeSetting>({ theme: 'light', setTheme: () => {} });

export function useThemeSetting() {
  return useContext(ThemeContext);
}

function readSavedTheme(): Theme | null {
  const saved = readStorage(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : null;
}

// The system's theme, unless the visitor picked the other one. Picking the system's
// theme again forgets the choice, so the page follows the system from then on
export function useTheme(): ThemeSetting {
  const [savedTheme, setSavedTheme] = useState(readSavedTheme);
  const [systemTheme, setSystemTheme] = useState<Theme>(() => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'));
  const theme = savedTheme ?? systemTheme;

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const followSystem = () => setSystemTheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', followSystem);
    return () => query.removeEventListener('change', followSystem);
  }, []);

  // Before the browser paints, so a saved theme never flashes the other one
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    if (newTheme === systemTheme) {
      setSavedTheme(null);
      removeStorage(STORAGE_KEY);
    } else {
      setSavedTheme(newTheme);
      writeStorage(STORAGE_KEY, newTheme);
    }
  };

  return { theme, setTheme };
}
