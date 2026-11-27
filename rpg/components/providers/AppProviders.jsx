'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Wifi, WifiOff } from 'lucide-react';
import { Toaster, toast, useSonner } from 'sonner';
import { THEMES } from '../../lib/constants';
import { initFirebaseAnalytics } from '../../lib/firebase';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const ThemeContext = createContext({
  theme: 'purple',
  setTheme: () => {},
  themes: THEMES,
});

export function useRealmTheme() {
  return useContext(ThemeContext);
}

function MasterToastSilencer() {
  const { toasts } = useSonner();

  useEffect(() => {
    if (toasts.length > 0) {
      toast.dismiss();
    }
  }, [toasts.length]);

  useEffect(() => {
    toast.dismiss();
    return () => {
      toast.dismiss();
    };
  }, []);

  return null;
}

function NetworkStatusBanner() {
  const { isOnline, justReconnected } = useNetworkStatus();
  if (isOnline && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 md:bottom-4 right-3 sm:right-4 z-[60] pointer-events-none animate-in fade-in slide-in-from-top-3"
    >
      <div
        className={
          isOnline
            ? 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0c101b]/95 border border-emerald-400/40 text-xs font-semibold text-emerald-200 shadow-2xl backdrop-blur-xl'
            : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0c101b]/95 border border-amber-400/40 text-xs font-semibold text-amber-200 shadow-2xl backdrop-blur-xl'
        }
      >
        {isOnline ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            <span>Conexão restaurada e sincronizada</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <span>Sem internet — alterações salvas localmente</span>
          </>
        )}
      </div>
    </div>
  );
}

export function AppProviders({ children }) {
  const pathname = usePathname();
  const isMasterRoute = pathname === '/master' || Boolean(pathname?.startsWith('/master/'));
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
      <NetworkStatusBanner />
      {isMasterRoute ? (
        <MasterToastSilencer />
      ) : (
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
      )}
    </ThemeContext.Provider>
  );
}
