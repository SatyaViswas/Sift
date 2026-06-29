import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/** 
 * ThemeContext — Global light/dark theme engine.
 * Priority: localStorage → prefers-color-scheme → 'light'
 */
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('sift-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (_) { /* storage not available */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  /* Sync html[data-theme] attribute whenever theme changes */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('sift-theme', theme);
    } catch (_) { /* noop */ }
  }, [theme]);

  /* Listen for OS-level changes (only if user hasn't made an explicit choice) */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const stored = localStorage.getItem('sift-theme');
      if (!stored) setTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = useCallback(() => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
