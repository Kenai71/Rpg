'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { THEMES } from '../../lib/constants';
import { initFirebaseAnalytics } from '../../lib/firebase';

const ThemeContext = createContext({
  theme: 'purple',
  setTheme: () => {},
  themes: THEMES,
});

export function useRealmTheme() {
  return useContext(ThemeContext);
}

export function AppProviders({ children }) {
  const [theme, setThemeState] = useState('purple');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('vallen-realm-theme');
      if (saved && THEMES.some((t) => t.id === saved)) {
        setThemeState(saved);
      }
    } catch {
      // Ignore storage access restrictions
    }
    initFirebaseAnalytics();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (nextTheme) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem('vallen-realm-theme', nextTheme);
    } catch {
      // Ignore storage access restrictions
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      <div className="min-h-screen bg-[var(--surface-0)] text-slate-100 antialiased selection:bg-white/20 selection:text-white">
        {children}
      </div>
      <Toaster
        position="top-right"
        richColors
        closeButton
        theme="dark"
        toastOptions={{
          style: {
            background: '#141720',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f1f5f9',
          },
        }}
      />
    </ThemeContext.Provider>
  );
}
