import * as ExpoSecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_PREFIX = 'nextwatch_secure_';
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_SECRET_LENGTH = 2048;
const CHUNK_MAX_BYTES = 1800;
const ORPHAN_PROBE_LIMIT = 16;

function assertValidKey(key: string): void {
  if (!key || !SAFE_KEY_PATTERN.test(key)) {
    throw new Error('Chave de armazenamento seguro inválida.');
  }
}

/**
 * Armazenamento seguro para credenciais de autenticação.
 * - iOS/Android: utiliza Keychain/Keystore nativo via `expo-secure-store` (sem fallback em texto claro).
 * - Web: utiliza `sessionStorage` isolado à aba (sem persistência em `localStorage`).
 */
export const SecureStore = {
  async setItemAsync(key: string, value: string): Promise<void> {
    assertValidKey(key);
    if (!value || value.length > MAX_SECRET_LENGTH) {
      throw new Error('Valor inválido ou excede o limite de armazenamento seguro.');
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(`${SECURE_PREFIX}${key}`, value);
      }
      return;
    }

    await ExpoSecureStore.setItemAsync(`${SECURE_PREFIX}${key}`, value, {
      keychainAccessible: ExpoSecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getItemAsync(key: string): Promise<string | null> {
    assertValidKey(key);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(`${SECURE_PREFIX}${key}`);
      }
      return null;
    }

    return ExpoSecureStore.getItemAsync(`${SECURE_PREFIX}${key}`);
  },

  async deleteItemAsync(key: string): Promise<void> {
    assertValidKey(key);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(`${SECURE_PREFIX}${key}`);
      }
      return;
    }

    await ExpoSecureStore.deleteItemAsync(`${SECURE_PREFIX}${key}`);
  },
};

function sanitizeStorageKey(key: string): string {
  const sanitized = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized || 'default';
}

function utf8ByteLengthOfCodePoint(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

function splitUtf8Chunks(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  let currentBytes = 0;

  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    const charBytes = utf8ByteLengthOfCodePoint(codePoint);
    if (currentChunk.length > 0 && currentBytes + charBytes > maxBytes) {
      chunks.push(currentChunk);
      currentChunk = char;
      currentBytes = charBytes;
    } else {
      currentChunk += char;
      currentBytes += charBytes;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}

function parseChunkCount(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return 0;
  const count = Number(raw);
  return Number.isSafeInteger(count) && count > 0 && count <= 256 ? count : 0;
}

function metaChunkKey(safeKey: string): string {
  return `${safeKey}.__chunks`;
}

function itemChunkKey(safeKey: string, index: number): string {
  return `${safeKey}.__chunk.${index}`;
}

async function deleteTrailingOrphanChunks(safeKey: string, startIndex: number, prevCount: number): Promise<void> {
  if (prevCount > 0) {
    for (let i = startIndex; i < prevCount; i++) {
      await SecureStore.deleteItemAsync(itemChunkKey(safeKey, i)).catch(() => {});
    }
    return;
  }

  for (let i = startIndex; i < startIndex + ORPHAN_PROBE_LIMIT; i++) {
    const chunkKey = itemChunkKey(safeKey, i);
    const existing = await SecureStore.getItemAsync(chunkKey).catch(() => null);
    if (existing === null) break;
    await SecureStore.deleteItemAsync(chunkKey).catch(() => {});
  }
}

const keyOperationQueue = new Map<string, Promise<unknown>>();

function enqueueKeyOperation<T>(safeKey: string, task: () => Promise<T>): Promise<T> {
  const prev = keyOperationQueue.get(safeKey) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (keyOperationQueue.get(safeKey) === tracked) {
      keyOperationQueue.delete(safeKey);
    }
  });
  keyOperationQueue.set(safeKey, tracked);
  return next;
}

/**
 * Adaptador de armazenamento compatível com `@supabase/supabase-js` que divide sessões
 * maiores que 2048 bytes em múltiplos chunks no Keychain/Keystore nativo e limpa
 * automaticamente chunks órfãos em atualizações e remoções.
 */
export const SupabaseSecureStorage = {
  getItem(key: string): Promise<string | null> {
    const safeKey = sanitizeStorageKey(key);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return Promise.resolve(window.sessionStorage.getItem(`${SECURE_PREFIX}${safeKey}`));
      }
      return Promise.resolve(null);
    }

    return enqueueKeyOperation(safeKey, async () => {
      const countRaw = await SecureStore.getItemAsync(metaChunkKey(safeKey)).catch(() => null);
      const count = parseChunkCount(countRaw);
      if (count > 0) {
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const part = await SecureStore.getItemAsync(itemChunkKey(safeKey, i)).catch(() => null);
          if (part === null) return null;
          parts.push(part);
        }
        return parts.join('');
      }
      return SecureStore.getItemAsync(safeKey).catch(() => null);
    });
  },

  setItem(key: string, value: string): Promise<void> {
    const safeKey = sanitizeStorageKey(key);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(`${SECURE_PREFIX}${safeKey}`, value);
      }
      return Promise.resolve();
    }

    return enqueueKeyOperation(safeKey, async () => {
      const metaKey = metaChunkKey(safeKey);
      const prevCountRaw = await SecureStore.getItemAsync(metaKey).catch(() => null);
      const prevCount = parseChunkCount(prevCountRaw);

      if (!value) {
        await SecureStore.deleteItemAsync(safeKey).catch(() => {});
        await SecureStore.deleteItemAsync(metaKey).catch(() => {});
        await deleteTrailingOrphanChunks(safeKey, 0, prevCount);
        return;
      }

      const chunks = splitUtf8Chunks(value, CHUNK_MAX_BYTES);
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(itemChunkKey(safeKey, i), chunks[i]!);
      }
      await SecureStore.setItemAsync(metaKey, String(chunks.length));
      await SecureStore.deleteItemAsync(safeKey).catch(() => {});
      await deleteTrailingOrphanChunks(safeKey, chunks.length, prevCount);
    });
  },

  removeItem(key: string): Promise<void> {
    const safeKey = sanitizeStorageKey(key);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(`${SECURE_PREFIX}${safeKey}`);
      }
      return Promise.resolve();
    }

    return enqueueKeyOperation(safeKey, async () => {
      const metaKey = metaChunkKey(safeKey);
      const prevCountRaw = await SecureStore.getItemAsync(metaKey).catch(() => null);
      const prevCount = parseChunkCount(prevCountRaw);

      await SecureStore.deleteItemAsync(safeKey).catch(() => {});
      await SecureStore.deleteItemAsync(metaKey).catch(() => {});
      await deleteTrailingOrphanChunks(safeKey, 0, prevCount);
    });
  },
};
