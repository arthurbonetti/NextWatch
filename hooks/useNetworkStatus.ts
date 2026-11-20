import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { fetchWithTimeout } from '@/utils/http';

const PROBE_URL = 'https://api.themoviedb.org/3/configuration';
const PROBE_TIMEOUT_MS = 5000;

async function checkInternetReachable(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return Boolean(navigator.onLine);
  }

  try {
    const response = await fetchWithTimeout(PROBE_URL, { method: 'HEAD' }, PROBE_TIMEOUT_MS);
    return response.status > 0;
  } catch {
    return false;
  }
}

/**
 * Hook de monitoramento de conectividade.
 * `null` representa estado ainda desconhecido; `false` indica que o dispositivo está sem conexão.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const updateStatus = async () => {
      const reachable = await checkInternetReachable();
      if (active) setIsConnected(reachable);
    };

    void updateStatus();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        if (active) setIsConnected(true);
      };
      const handleOffline = () => {
        if (active) setIsConnected(false);
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        active = false;
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void updateStatus();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return { isConnected };
}

/** Re-sincroniza ao voltar ao primeiro plano ou recuperar a conexão na Web. */
export function useForegroundSync(
  enabled: boolean,
  onSync: (options?: { minIntervalMs?: number }) => Promise<void>,
  cooldownMs = 4000,
) {
  useEffect(() => {
    if (!enabled) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => void onSync();
      const handleFocus = () => void onSync({ minIntervalMs: cooldownMs });
      const handleVisibility = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void onSync({ minIntervalMs: cooldownMs });
        }
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('focus', handleFocus);
      document?.addEventListener('visibilitychange', handleVisibility);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('focus', handleFocus);
        document?.removeEventListener('visibilitychange', handleVisibility);
      };
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void onSync({ minIntervalMs: cooldownMs });
    });

    return () => {
      subscription.remove();
    };
  }, [cooldownMs, enabled, onSync]);
}
