import type { MediaKind } from '@/constants/catalog';

export type DrawAction = 'assistiu' | 'salvou' | 'sorteou outro' | 'ignorou';

export type DrawHistoryEntry = {
  id: string;
  tmdbId: string;
  sorteadoEm: string;
  acao: DrawAction;
  title?: string;
  kind?: MediaKind;
  tmdbPosterPath?: string | null;
  color?: string;
};

const VALID_ACTIONS = new Set<DrawAction>(['assistiu', 'salvou', 'sorteou outro', 'ignorou']);

export function isDrawAction(value: unknown): value is DrawAction {
  return typeof value === 'string' && VALID_ACTIONS.has(value as DrawAction);
}

export function isDrawHistoryEntry(value: unknown): value is DrawHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DrawHistoryEntry>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.tmdbId === 'string' &&
    item.tmdbId.length > 0 &&
    item.tmdbId.length <= 128 &&
    typeof item.sorteadoEm === 'string' &&
    item.sorteadoEm.length > 0 &&
    isDrawAction(item.acao)
  );
}
