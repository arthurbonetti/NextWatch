import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createOperationSequencer,
  createPendingListStore as createCorePendingListStore,
  createPendingOpsMapStore as createCorePendingOpsMapStore,
  createVersionedStorage as createCoreVersionedStorage,
  type OperationSequencer,
  parseVersionedPayload,
  readFlag,
  type StorageAdapter,
  type SyncOutcome,
  type VersionedEnvelope,
  writeFlag,
} from '@/utils/offlineStoreCore';

export {
  createOperationSequencer,
  type OperationSequencer,
  parseVersionedPayload,
  type StorageAdapter,
  type SyncOutcome,
  type VersionedEnvelope,
};

export const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export function createVersionedStorage<T>(options: {
  version: number;
  parse: (data: unknown) => T;
  fallback: T;
  storage?: StorageAdapter;
}) {
  return createCoreVersionedStorage({
    ...options,
    storage: options.storage ?? asyncStorageAdapter,
  });
}

export function createPendingOpsMapStore<TOp>(options: {
  parseOp: (entry: unknown) => TOp | null;
  storage?: StorageAdapter;
}) {
  return createCorePendingOpsMapStore({
    ...options,
    storage: options.storage ?? asyncStorageAdapter,
  });
}

export function createPendingListStore<TItem>(options: {
  isItem: (value: unknown) => value is TItem;
  storage?: StorageAdapter;
}) {
  return createCorePendingListStore({
    ...options,
    storage: options.storage ?? asyncStorageAdapter,
  });
}

export function readStorageFlag(key: string): Promise<boolean> {
  return readFlag(asyncStorageAdapter, key);
}

export function writeStorageFlag(key: string, enabled: boolean): Promise<void> {
  return writeFlag(asyncStorageAdapter, key, enabled);
}
