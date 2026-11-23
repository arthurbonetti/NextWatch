import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOperationSequencer,
  createPendingListStore,
  createPendingOpsMapStore,
  createVersionedStorage,
  parseVersionedPayload,
  readFlag,
  type StorageAdapter,
  writeFlag,
} from '../utils/offlineStoreCore.ts';

function createMemoryStorage(delayMs = 0): StorageAdapter & { rawMap: Map<string, string> } {
  const rawMap = new Map<string, string>();
  const wait = () =>
    delayMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();

  return {
    rawMap,
    async getItem(key: string) {
      await wait();
      return rawMap.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      await wait();
      rawMap.set(key, value);
    },
    async removeItem(key: string) {
      await wait();
      rawMap.delete(key);
    },
  };
}

test('createVersionedStorage writes versioned envelopes and supports legacy payloads', async () => {
  const storage = createMemoryStorage();
  const store = createVersionedStorage<string[]>({
    version: 2,
    fallback: [],
    storage,
    parse: (data) =>
      Array.isArray(data) ? data.filter((v): v is string => typeof v === 'string') : [],
  });

  await store.write('items', ['a', 'b']);
  const rawStored = storage.rawMap.get('items');
  assert.ok(rawStored);
  assert.deepEqual(JSON.parse(rawStored), { __v: 2, data: ['a', 'b'] });
  assert.deepEqual(await store.read('items'), ['a', 'b']);

  // Versão incompatível deve descartar para o fallback
  storage.rawMap.set('items', JSON.stringify({ __v: 1, data: ['old'] }));
  assert.deepEqual(await store.read('items'), []);

  // Payload legado sem envelope continua legível
  storage.rawMap.set('items', JSON.stringify(['legacy-1', 123, 'legacy-2']));
  assert.deepEqual(await store.read('items'), ['legacy-1', 'legacy-2']);

  // JSON inválido retorna fallback
  storage.rawMap.set('items', '{invalid-json');
  assert.deepEqual(await store.read('items'), []);

  await store.remove('items');
  assert.equal(storage.rawMap.has('items'), false);
});

test('parseVersionedPayload parses envelopes and fallbacks cleanly', () => {
  const parseNum = (v: unknown) => (typeof v === 'number' ? v : -1);
  assert.equal(parseVersionedPayload(null, 1, parseNum, 0), 0);
  assert.equal(parseVersionedPayload('{"__v":1,"data":42}', 1, parseNum, 0), 42);
  assert.equal(parseVersionedPayload('{"__v":2,"data":42}', 1, parseNum, 0), 0);
});

test('createOperationSequencer tracks per-key sequences accurately', () => {
  const seq = createOperationSequencer();
  assert.equal(seq.current('u1:m1'), 0);
  const s1 = seq.next('u1:m1');
  assert.equal(s1, 1);
  assert.equal(seq.isCurrent('u1:m1', s1), true);
  const s2 = seq.next('u1:m1');
  assert.equal(s2, 2);
  assert.equal(seq.isCurrent('u1:m1', s1), false);
  assert.equal(seq.isCurrent('u1:m1', s2), true);
  seq.reset('u1:m1');
  assert.equal(seq.current('u1:m1'), 0);
});

test('createPendingOpsMapStore serializes concurrent set/remove without data loss', async () => {
  const storage = createMemoryStorage(2);
  type Op = { type: 'upsert' | 'delete' };
  const pendingStore = createPendingOpsMapStore<Op>({
    storage,
    parseOp: (entry) => {
      if (
        entry &&
        typeof entry === 'object' &&
        ((entry as Op).type === 'upsert' || (entry as Op).type === 'delete')
      ) {
        return { type: (entry as Op).type };
      }
      return null;
    },
  });

  await Promise.all([
    pendingStore.set('pending:1', 'a', { type: 'upsert' }),
    pendingStore.set('pending:1', 'b', { type: 'upsert' }),
    pendingStore.set('pending:1', 'c', { type: 'delete' }),
    pendingStore.remove('pending:1', 'b'),
  ]);

  assert.deepEqual(await pendingStore.read('pending:1'), {
    a: { type: 'upsert' },
    c: { type: 'delete' },
  });
});

test('createPendingOpsMapStore.flush handles ok/drop/retry, concurrent updates, and abort signal', async () => {
  const storage = createMemoryStorage();
  type Op = { type: 'upsert' | 'delete'; value?: string };
  const pendingStore = createPendingOpsMapStore<Op>({
    storage,
    parseOp: (entry) =>
      entry && typeof entry === 'object' && 'type' in entry ? (entry as Op) : null,
  });
  const sequencer = createOperationSequencer();

  await pendingStore.replace('p', {
    '1': { type: 'upsert', value: 'v1' },
    '2': { type: 'upsert', value: 'v2' },
    '3': { type: 'delete' },
    '4': { type: 'upsert', value: 'v4' },
  });

  const executed: string[] = [];
  const resRetry = await pendingStore.flush({
    pendingKey: 'p',
    scopePrefix: 'u1',
    sequencer,
    execute: async (id) => {
      executed.push(id);
      if (id === '1') return 'ok';
      if (id === '2') return 'drop';
      if (id === '3') return 'retry';
      return 'ok';
    },
  });

  assert.deepEqual(executed, ['1', '2', '3']);
  assert.equal(resRetry.stoppedOnRetry, true);
  assert.equal(resRetry.aborted, false);
  assert.deepEqual(resRetry.remaining, {
    '3': { type: 'delete' },
    '4': { type: 'upsert', value: 'v4' },
  });

  // Simula alteração concorrente durante o flush (sequência incrementada para '3')
  const resConcurrent = await pendingStore.flush({
    pendingKey: 'p',
    scopePrefix: 'u1',
    sequencer,
    execute: async (id) => {
      if (id === '3') {
        sequencer.next('u1:3');
        await pendingStore.set('p', '3', { type: 'upsert', value: 'updated-while-flushing' });
      }
      return 'ok';
    },
  });

  assert.equal(resConcurrent.stoppedOnRetry, false);
  assert.deepEqual(resConcurrent.remaining, {
    '3': { type: 'upsert', value: 'updated-while-flushing' },
  });

  // AbortSignal interrompe o flush preservando o que não foi processado
  const controller = new AbortController();
  const resAborted = await pendingStore.flush({
    pendingKey: 'p',
    scopePrefix: 'u1',
    sequencer,
    signal: controller.signal,
    execute: async () => {
      controller.abort();
      return 'ok';
    },
  });

  assert.equal(resAborted.aborted, true);
  assert.deepEqual(resAborted.remaining, {
    '3': { type: 'upsert', value: 'updated-while-flushing' },
  });
});

test('createPendingListStore deduplicates prepend and preserves concurrent inserts during flush', async () => {
  const storage = createMemoryStorage();
  type Item = { localId: string; label: string };
  const listStore = createPendingListStore<Item>({
    storage,
    isItem: (v): v is Item =>
      Boolean(v) &&
      typeof v === 'object' &&
      typeof (v as Item).localId === 'string' &&
      typeof (v as Item).label === 'string',
  });

  await listStore.prepend('list:1', { localId: 'l1', label: 'first' }, (i) => i.localId);
  await listStore.prepend('list:1', { localId: 'l2', label: 'second' }, (i) => i.localId);
  await listStore.prepend('list:1', { localId: 'l1', label: 'first-updated' }, (i) => i.localId);

  assert.deepEqual(await listStore.read('list:1'), [
    { localId: 'l1', label: 'first-updated' },
    { localId: 'l2', label: 'second' },
  ]);

  let addedConcurrent = false;
  const flushed = await listStore.flush({
    pendingKey: 'list:1',
    getId: (i) => i.localId,
    execute: async (item) => {
      if (item.localId === 'l1' && !addedConcurrent) {
        addedConcurrent = true;
        await listStore.prepend('list:1', { localId: 'l3', label: 'third' }, (i) => i.localId);
      }
      if (item.localId === 'l2') return 'retry';
      return 'ok';
    },
  });

  assert.equal(flushed.stoppedOnRetry, true);
  assert.deepEqual(flushed.remaining, [
    { localId: 'l3', label: 'third' },
    { localId: 'l2', label: 'second' },
  ]);
});

test('readFlag and writeFlag toggle storage flags safely', async () => {
  const storage = createMemoryStorage();
  assert.equal(await readFlag(storage, 'flag:1'), false);
  await writeFlag(storage, 'flag:1', true);
  assert.equal(await readFlag(storage, 'flag:1'), true);
  await writeFlag(storage, 'flag:1', false);
  assert.equal(await readFlag(storage, 'flag:1'), false);
});
