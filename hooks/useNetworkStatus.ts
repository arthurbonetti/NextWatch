import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

const PROBE_URL = 'https://api.themoviedb.org/3/configuration';
const PROBE_TIMEOUT_MS = 5000;

async function checkInternetReachable(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return Boolean(navigator.onLine);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(PROBE_URL, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return response.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hook de monitoramento de conectividade (conforme Slide 09 do material de aula).
 * `null` representa estado ainda desconhecido. `false` indica que o dispositivo está sem conexão.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const updateStatus = async () => {
      const reachable = await checkInternetReachable();
      if (active) {
        setIsConnected(reachable);
      }
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
      if (nextState === 'active') {
        void updateStatus();
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return { isConnected };
}
