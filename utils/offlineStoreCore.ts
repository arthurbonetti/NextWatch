export type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type SyncOutcome = 'ok' | 'drop' | 'retry';

export type VersionedEnvelope<T> = {
  __v: number;
  data: T;
};

const storageQueues = new Map<string, Promise<unknown>>();

function enqueueStorageTask<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = storageQueues.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (storageQueues.get(key) === tracked) {
      storageQueues.delete(key);
    }
  });
  storageQueues.set(key, tracked);
  return next;
}

export function parseVersionedPayload<T>(
  raw: string | null,
  version: number,
  parse: (data: unknown) => T,
  fallback: T,
): T {
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as { __v?: unknown }).__v === 'number' &&
      'data' in (parsed as Record<string, unknown>)
    ) {
      const envelope = parsed as VersionedEnvelope<unknown>;
      if (envelope.__v !== version) {
        return fallback;
      }
      return parse(envelope.data);
    }
    return parse(parsed);
  } catch {
    return fallback;
  }
}

export function createVersionedStorage<T>(options: {
  version: number;
  parse: (data: unknown) => T;
  fallback: T;
  storage: StorageAdapter;
}) {
  const { version, parse, fallback, storage } = options;

  async function read(key: string): Promise<T> {
    return enqueueStorageTask(key, async () => {
      const raw = await storage.getItem(key).catch(() => null);
      return parseVersionedPayload(raw, version, parse, fallback);
    });
  }

  async function write(key: string, value: T): Promise<void> {
    const envelope: VersionedEnvelope<T> = { __v: version, data: value };
    return enqueueStorageTask(key, async () => {
      await storage.setItem(key, JSON.stringify(envelope)).catch(() => {});
    });
  }

  async function remove(key: string): Promise<void> {
    return enqueueStorageTask(key, async () => {
      await storage.removeItem(key).catch(() => {});
    });
  }

  return {
    read,
    write,
    remove,
  };
}

export function createOperationSequencer() {
  const seqByKey = new Map<string, number>();

  function next(key: string): number {
    const updated = (seqByKey.get(key) ?? 0) + 1;
    seqByKey.set(key, updated);
    return updated;
  }

  function current(key: string): number {
    return seqByKey.get(key) ?? 0;
  }

  function isCurrent(key: string, seq: number): boolean {
    return (seqByKey.get(key) ?? 0) === seq;
  }

  function reset(key?: string): void {
    if (key === undefined) {
      seqByKey.clear();
      return;
    }
    seqByKey.delete(key);
  }

  return {
    next,
    current,
    isCurrent,
    reset,
  };
}

export type OperationSequencer = ReturnType<typeof createOperationSequencer>;

export function createPendingOpsMapStore<TOp>(options: {
  parseOp: (entry: unknown) => TOp | null;
  storage: StorageAdapter;
}) {
  const { parseOp, storage } = options;

  function parseMap(raw: string | null): Record<string, TOp> {
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const result: Record<string, TOp> = {};
      for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
        if (!id) continue;
        const op = parseOp(entry);
        if (op !== null) {
          result[id] = op;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  async function readUnsafe(pendingKey: string): Promise<Record<string, TOp>> {
    const raw = await storage.getItem(pendingKey).catch(() => null);
    return parseMap(raw);
  }

  async function read(pendingKey: string): Promise<Record<string, TOp>> {
    return enqueueStorageTask(pendingKey, () => readUnsafe(pendingKey));
  }

  async function set(pendingKey: string, itemId: string, op: TOp): Promise<void> {
    return enqueueStorageTask(pendingKey, async () => {
      const current = await readUnsafe(pendingKey);
      current[itemId] = op;
      await storage.setItem(pendingKey, JSON.stringify(current)).catch(() => {});
    });
  }

  async function remove(pendingKey: string, itemId: string): Promise<void> {
    return enqueueStorageTask(pendingKey, async () => {
      const current = await readUnsafe(pendingKey);
      if (!(itemId in current)) return;
      delete current[itemId];
      await storage.setItem(pendingKey, JSON.stringify(current)).catch(() => {});
    });
  }

  async function replace(pendingKey: string, ops: Record<string, TOp>): Promise<void> {
    return enqueueStorageTask(pendingKey, async () => {
      await storage.setItem(pendingKey, JSON.stringify(ops)).catch(() => {});
    });
  }

  async function flush(params: {
    pendingKey: string;
    scopePrefix: string;
    sequencer: OperationSequencer;
    signal?: AbortSignal;
    execute: (itemId: string, op: TOp) => Promise<SyncOutcome>;
  }): Promise<{ remaining: Record<string, TOp>; stoppedOnRetry: boolean; aborted: boolean }> {
    const { pendingKey, scopePrefix, sequencer, signal, execute } = params;
    const snapshot = await read(pendingKey);
    const entries = Object.entries(snapshot);
    let stoppedOnRetry = false;

    for (const [itemId, op] of entries) {
      if (signal?.aborted) {
        return {
          remaining: await read(pendingKey),
          stoppedOnRetry: false,
          aborted: true,
        };
      }

      const seqKey = `${scopePrefix}:${itemId}`;
      const seqBefore = sequencer.current(seqKey);
      const outcome = await execute(itemId, op);

      if (signal?.aborted) {
        return {
          remaining: await read(pendingKey),
          stoppedOnRetry: false,
          aborted: true,
        };
      }

      if (outcome === 'retry') {
        stoppedOnRetry = true;
        break;
      }

      if (sequencer.isCurrent(seqKey, seqBefore)) {
        await remove(pendingKey, itemId);
      }
    }

    return {
      remaining: await read(pendingKey),
      stoppedOnRetry,
      aborted: false,
    };
  }

  return {
    read,
    set,
    remove,
    replace,
    flush,
  };
}

export function createPendingListStore<TItem>(options: {
  isItem: (value: unknown) => value is TItem;
  storage: StorageAdapter;
}) {
  const { isItem, storage } = options;

  function parseList(raw: string | null): TItem[] {
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isItem) : [];
    } catch {
      return [];
    }
  }

  async function readUnsafe(pendingKey: string): Promise<TItem[]> {
    const raw = await storage.getItem(pendingKey).catch(() => null);
    return parseList(raw);
  }

  async function read(pendingKey: string): Promise<TItem[]> {
    return enqueueStorageTask(pendingKey, () => readUnsafe(pendingKey));
  }

  async function prepend(
    pendingKey: string,
    item: TItem,
    getId: (item: TItem) => string,
  ): Promise<void> {
    return enqueueStorageTask(pendingKey, async () => {
      const current = await readUnsafe(pendingKey);
      const itemId = getId(item);
      const next = [item, ...current.filter((existing) => getId(existing) !== itemId)];
      await storage.setItem(pendingKey, JSON.stringify(next)).catch(() => {});
    });
  }

  async function update(
    pendingKey: string,
    updater: (items: TItem[]) => TItem[],
  ): Promise<void> {
    return enqueueStorageTask(pendingKey, async () => {
      const current = await readUnsafe(pendingKey);
      const next = updater(current);
      await storage.setItem(pendingKey, JSON.stringify(next)).catch(() => {});
    });
  }

  async function replace(pendingKey: string, items: TItem[]): Promise<void> {
    return enqueueStorageTask(pendingKey, async () => {
      await storage.setItem(pendingKey, JSON.stringify(items)).catch(() => {});
    });
  }

  async function flush(params: {
    pendingKey: string;
    signal?: AbortSignal;
    getId: (item: TItem) => string;
    execute: (item: TItem) => Promise<SyncOutcome>;
  }): Promise<{ remaining: TItem[]; stoppedOnRetry: boolean; aborted: boolean }> {
    const { pendingKey, signal, getId, execute } = params;
    const snapshot = await read(pendingKey);
    let stoppedOnRetry = false;

    for (const item of snapshot) {
      if (signal?.aborted) {
        return {
          remaining: await read(pendingKey),
          stoppedOnRetry: false,
          aborted: true,
        };
      }

      const outcome = await execute(item);

      if (signal?.aborted) {
        return {
          remaining: await read(pendingKey),
          stoppedOnRetry: false,
          aborted: true,
        };
      }

      if (outcome === 'retry') {
        stoppedOnRetry = true;
        break;
      }

      const targetId = getId(item);
      await update(pendingKey, (items) => items.filter((existing) => getId(existing) !== targetId));
    }

    return {
      remaining: await read(pendingKey),
      stoppedOnRetry,
      aborted: false,
    };
  }

  return {
    read,
    prepend,
    update,
    replace,
    flush,
  };
}

export async function readFlag(storage: StorageAdapter, key: string): Promise<boolean> {
  return enqueueStorageTask(key, async () => {
    const raw = await storage.getItem(key).catch(() => null);
    return raw === '1';
  });
}

export async function writeFlag(
  storage: StorageAdapter,
  key: string,
  enabled: boolean,
): Promise<void> {
  return enqueueStorageTask(key, async () => {
    if (enabled) {
      await storage.setItem(key, '1').catch(() => {});
    } else {
      await storage.removeItem(key).catch(() => {});
    }
  });
}
