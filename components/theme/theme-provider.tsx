'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'rvz_theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Persists the user's preferred theme in localStorage and writes the
 * `data-theme` attribute on <html> so every CSS token swap follows. The
 * inline script in app/layout.tsx applies the saved preference before
 * React hydrates so there's no FOUC. We default to "light" because the
 * editorial canvas is the primary brand surface; users who prefer dark
 * flip the toggle in /configuracion.
 */
export function ThemeProvider({
  children,
  initialTheme = 'light',
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // On mount, read the persisted choice (the inline pre-hydration script
  // already wrote the attribute, so this just syncs React state with the
  // DOM and keeps subsequent calls in sync).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
        document.documentElement.setAttribute('data-theme', saved);
      } else {
        document.documentElement.setAttribute('data-theme', initialTheme);
      }
    } catch {
      /* storage unavailable — stick with initialTheme */
    }
  }, [initialTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Outside the provider (e.g. on auth pages) — return a no-op shim
    // that reads the DOM directly so consumer code still works.
    return {
      theme:
        typeof document !== 'undefined' &&
        document.documentElement.getAttribute('data-theme') === 'dark'
          ? 'dark'
          : 'light',
      setTheme: (next: Theme) => {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', next);
        }
      },
      toggleTheme: () => {},
    };
  }
  return ctx;
}
