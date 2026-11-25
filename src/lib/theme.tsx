import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'fa-theme';

const readTheme = (): Theme => {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* almacenamiento no disponible */
  }
  return 'light';
};

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignorar */
    }
  }, [theme]);
  return <ThemeCtx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

/** Colores de series validados (CVD + contraste) para cada superficie. */
const CHART = {
  dark: { s1: '#3987e5', s2: '#f5821f', s3: '#199e70', grid: '#1b3a5e', axis: '#8ea3bd', surface: '#0c2b4c', cursor: '#f5821f' },
  light: { s1: '#2563eb', s2: '#f5821f', s3: '#16a34a', grid: '#e2e8f0', axis: '#64748b', surface: '#ffffff', cursor: '#c2600a' },
};

export const useChartColors = () => CHART[useTheme().theme];
