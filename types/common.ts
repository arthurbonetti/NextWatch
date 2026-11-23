export type MutationOutcome = 'ok' | 'retry' | 'offline';

export type RefreshOptions = {
  minIntervalMs?: number;
};
