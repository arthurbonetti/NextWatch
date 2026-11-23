import { getSupabaseAnonKey, getSupabaseUrl, hasSupabaseConfig } from '@/services/supabase';
import { fetchWithTimeout } from '@/utils/http';

import { REQUEST_TIMEOUT_MS } from './constants';
import { CatalogBackendNotConfiguredError } from './types';

let devCatalogFetchCount = 0;
let devLastCatalogFetchStartedAt: number | null = null;
let upstreamUnavailable = false;

export function getDevCatalogMetrics() {
  return {
    fetchCount: devCatalogFetchCount,
    lastFetchStartedAt: devLastCatalogFetchStartedAt,
  };
}

export function recordCatalogFetchStart(startedAt: number): number {
  devCatalogFetchCount += 1;
  devLastCatalogFetchStartedAt = startedAt;
  return devCatalogFetchCount;
}

export function isUpstreamUnavailable(): boolean {
  return upstreamUnavailable;
}

export function setUpstreamUnavailable(value: boolean): void {
  upstreamUnavailable = value;
}

export function hasCatalogBackend(): boolean {
  return hasSupabaseConfig();
}

export function createAbortError(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(createAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export async function request<T>(
  endpoint: string,
  params: Record<string, string>,
  options: { retries?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const { retries = 3, signal } = options;
  if (signal?.aborted) {
    throw createAbortError();
  }

  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) {
    throw new CatalogBackendNotConfiguredError();
  }

  const retryRequest = async (delayMs: number) => {
    await sleepWithSignal(delayMs, signal);
    return request<T>(endpoint, params, { retries: retries - 1, signal });
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${baseUrl}/functions/v1/tmdb-proxy`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        body: JSON.stringify({ endpoint, params }),
        signal,
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw createAbortError();
    }
    if (retries > 0) {
      return retryRequest(500 * (4 - Math.min(retries, 3)));
    }
    throw error;
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  if (response.status === 503) {
    upstreamUnavailable = true;
    throw new CatalogBackendNotConfiguredError();
  }

  if ((response.status === 429 || response.status >= 500) && retries > 0) {
    const retryAfterHeader = response.status === 429 ? response.headers.get('Retry-After') : null;
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
    const delayMs =
      Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? Math.min(retryAfterSec * 1000, 3000)
        : 500 * (4 - Math.min(retries, 3));
    return retryRequest(delayMs);
  }

  if (!response.ok) {
    throw new Error(`Serviço de catálogo respondeu com erro ${response.status}. Tente novamente.`);
  }
  return response.json() as Promise<T>;
}
