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
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
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
  dark: { s1: '#3987e5', s2: '#d95926', s3: '#199e70', grid: '#1f2d3b', axis: '#7b8a9a', surface: '#111a24', cursor: '#3fb8c0' },
  light: { s1: '#2a78d6', s2: '#eb6834', s3: '#199e70', grid: '#e3e8ee', axis: '#64748b', surface: '#ffffff', cursor: '#137b83' },
};

export const useChartColors = () => CHART[useTheme().theme];
