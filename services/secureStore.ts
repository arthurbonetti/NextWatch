import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type NativeSecureStoreModule = {
  getValueWithKeyAsync?: (key: string, options?: Record<string, unknown>) => Promise<string | null>;
  setValueWithKeyAsync?: (value: string, key: string, options?: Record<string, unknown>) => Promise<void>;
  deleteValueWithKeyAsync?: (key: string, options?: Record<string, unknown>) => Promise<void>;
};

const SECURE_PREFIX = '@nextwatch/secure:';
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_SECRET_LENGTH = 8192;

function assertValidKey(key: string): void {
  if (!key || !SAFE_KEY_PATTERN.test(key)) {
    throw new Error('Chave de armazenamento seguro inválida.');
  }
}

function getNativeSecureStore(): NativeSecureStoreModule | null {
  if (Platform.OS === 'web') return null;
  try {
    return requireOptionalNativeModule<NativeSecureStoreModule>('ExpoSecureStore');
  } catch {
    return null;
  }
}

function encodeToken(value: string): string {
  try {
    if (typeof btoa === 'function') {
      return `nw_enc_${btoa(encodeURIComponent(value))}`;
    }
  } catch {
    // Fallback se btoa não estiver disponível
  }
  return value;
}

function decodeToken(stored: string): string | null {
  if (stored.length > MAX_SECRET_LENGTH) return null;
  if (!stored.startsWith('nw_enc_')) return stored;
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(atob(stored.slice('nw_enc_'.length)));
    }
  } catch {
    return null;
  }
  return stored;
}

/**
 * Armazenamento seguro para tokens de autenticação (seguindo o padrão do SecureStore do Expo).
 * Em dispositivos nativos com ExpoSecureStore disponível, utiliza o Keychain (iOS) / Keystore (Android).
 * Na Web ou no Expo Go sem o módulo nativo, aplica armazenamento isolado em sessionStorage/AsyncStorage.
 */
export const SecureStore = {
  async setItemAsync(key: string, value: string): Promise<void> {
    assertValidKey(key);
    if (!value || value.length > MAX_SECRET_LENGTH) {
      throw new Error('Valor inválido para armazenamento seguro.');
    }
    const nativeModule = getNativeSecureStore();
    if (nativeModule?.setValueWithKeyAsync) {
      await nativeModule.setValueWithKeyAsync(value, key, {});
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(`${SECURE_PREFIX}${key}`, encodeToken(value));
      return;
    }
    await AsyncStorage.setItem(`${SECURE_PREFIX}${key}`, encodeToken(value));
  },

  async getItemAsync(key: string): Promise<string | null> {
    assertValidKey(key);
    const nativeModule = getNativeSecureStore();
    if (nativeModule?.getValueWithKeyAsync) {
      return nativeModule.getValueWithKeyAsync(key, {});
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(`${SECURE_PREFIX}${key}`);
      return raw ? decodeToken(raw) : null;
    }
    const raw = await AsyncStorage.getItem(`${SECURE_PREFIX}${key}`);
    return raw ? decodeToken(raw) : null;
  },

  async deleteItemAsync(key: string): Promise<void> {
    assertValidKey(key);
    const nativeModule = getNativeSecureStore();
    if (nativeModule?.deleteValueWithKeyAsync) {
      await nativeModule.deleteValueWithKeyAsync(key, {});
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(`${SECURE_PREFIX}${key}`);
      return;
    }
    await AsyncStorage.removeItem(`${SECURE_PREFIX}${key}`);
  },
};
