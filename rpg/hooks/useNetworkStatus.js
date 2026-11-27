'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Monitora conectividade em tempo real (online/offline) com aviso discreto
 * de reconexão para manter o usuário informado em sessões longas de RPG.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOfflineRef = useRef(false);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const initialOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsOnline(initialOnline);
    wasOfflineRef.current = !initialOnline;

    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOnline(false);
      setJustReconnected(false);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setJustReconnected(true);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          setJustReconnected(false);
        }, 3500);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  return { isOnline, justReconnected };
}
