import * as ExpoSecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_PREFIX = 'nextwatch_secure_';
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_SECRET_LENGTH = 2048;

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
