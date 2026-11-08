import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type NativeSecureStoreModule = {
  getValueWithKeyAsync?: (key: string, options?: Record<string, unknown>) => Promise<string | null>;
  setValueWithKeyAsync?: (value: string, key: string, options?: Record<string, unknown>) => Promise<void>;
  deleteValueWithKeyAsync?: (key: string, options?: Record<string, unknown>) => Promise<void>;
};

const SECURE_PREFIX = '@nextwatch/secure:';

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

function decodeToken(stored: string): string {
  if (!stored.startsWith('nw_enc_')) return stored;
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(atob(stored.slice('nw_enc_'.length)));
    }
  } catch {
    // Fallback caso o valor antigo não esteja codificado
  }
  return stored;
}

/**
 * Armazenamento seguro para tokens de autenticação (seguindo o padrão do SecureStore do Expo).
 * Em dispositivos nativos com ExpoSecureStore disponível, utiliza o Keychain (iOS) / Keystore (Android).
 * Na Web ou no Expo Go sem o módulo nativo, aplica armazenamento isolado e codificado para manter compatibilidade.
 */
export const SecureStore = {
  async setItemAsync(key: string, value: string): Promise<void> {
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
