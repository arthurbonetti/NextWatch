import {
  EXCLUDED_DRAW_GENRES,
  getTitleAverageRating,
  MIN_DRAW_RATING,
  MIN_DRAW_VOTE_COUNT,
  VALID_KIND_FILTERS,
} from '../constants/catalog.ts';
import type { MediaKind, MediaKindFilter, MediaTitle } from '../types/media.ts';

export type RouletteMediaKind = MediaKind;
export type RouletteKindFilter = MediaKindFilter;

export function isEligibleForDraw(title: MediaTitle): boolean {
  if (title.genres.some((genre) => EXCLUDED_DRAW_GENRES.has(genre))) {
    return false;
  }
  if (getTitleAverageRating(title) < MIN_DRAW_RATING) {
    return false;
  }
  if (title.catalogSource === 'tmdb' && (title.voteCount ?? 0) < MIN_DRAW_VOTE_COUNT) {
    return false;
  }
  return true;
}

export type RouletteTitle = {
  id: string;
  kind: RouletteMediaKind;
  genres: readonly string[];
  service: string;
  services?: readonly string[];
};

export type RouletteFilters = {
  kind: RouletteKindFilter;
  selectedGenres: readonly string[];
  hideWatched: boolean;
};

export type RouletteHistoryEntry = {
  tmdbId: string;
  acao: string;
};

export function getRouletteTitleServices(
  title: Pick<RouletteTitle, 'service' | 'services'>,
): readonly string[] {
  return title.services && title.services.length > 0 ? title.services : [title.service];
}

export function filterTitlesByActiveServices<T extends RouletteTitle>(
  titles: readonly T[],
  activeServiceSet: ReadonlySet<string>,
): T[] {
  if (activeServiceSet.size === 0) return [];
  return titles.filter((title) =>
    getRouletteTitleServices(title).some((service) => activeServiceSet.has(service)),
  );
}

export function buildWatchedTitleIds(
  history: readonly RouletteHistoryEntry[],
  progressTitleIds: Iterable<string>,
): Set<string> {
  const ids = new Set<string>();
  for (const entry of history) {
    if (entry.acao === 'assistiu') {
      ids.add(entry.tmdbId);
    }
  }
  for (const id of progressTitleIds) {
    ids.add(id);
  }
  return ids;
}

export function filterRouletteCandidates<T extends RouletteTitle>(params: {
  eligibleTitles: readonly T[];
  enabledServiceSet: ReadonlySet<string>;
  filters: RouletteFilters;
  watchedTitleIds: ReadonlySet<string>;
}): T[] {
  const { eligibleTitles, enabledServiceSet, filters, watchedTitleIds } = params;
  if (enabledServiceSet.size === 0) return [];

  return eligibleTitles.filter((title) => {
    const serviceMatches = getRouletteTitleServices(title).some((service) =>
      enabledServiceSet.has(service),
    );
    if (!serviceMatches) return false;

    const kindMatches = filters.kind === 'Todos' || title.kind === filters.kind;
    if (!kindMatches) return false;

    const genreMatches =
      filters.selectedGenres.length === 0 ||
      filters.selectedGenres.some((selectedGenre) => title.genres.includes(selectedGenre));
    if (!genreMatches) return false;

    if (filters.hideWatched && watchedTitleIds.has(title.id)) return false;

    return true;
  });
}

export function pickRouletteWinner<T extends Pick<RouletteTitle, 'id'>>(
  candidates: readonly T[],
  lastDrawnId: string | null,
  random: () => number = Math.random,
): T | null {
  if (candidates.length === 0) return null;

  const nonRepeatingPool =
    candidates.length > 1 && lastDrawnId !== null
      ? candidates.filter((title) => title.id !== lastDrawnId)
      : candidates;
  const pool = nonRepeatingPool.length > 0 ? nonRepeatingPool : candidates;

  const rawIndex = Math.floor(random() * pool.length);
  const clampedIndex = Math.min(pool.length - 1, Math.max(0, rawIndex));
  return pool[clampedIndex] ?? null;
}

export function resolveLockedFeaturedTitle<T extends RouletteTitle>(params: {
  lockedFeatured: T | null;
  activeServiceSet: ReadonlySet<string>;
  eligibleTitles: readonly T[];
  availableTitles: readonly T[];
}): T | null {
  const { lockedFeatured, activeServiceSet, eligibleTitles, availableTitles } = params;
  const candidateFeatured = eligibleTitles[0] ?? availableTitles[0] ?? null;
  const lockedStillValid =
    lockedFeatured !== null &&
    activeServiceSet.size > 0 &&
    getRouletteTitleServices(lockedFeatured).some((service) => activeServiceSet.has(service));

  return lockedStillValid ? lockedFeatured : candidateFeatured;
}

export function parseRouletteDeepLinkPreset(params: {
  drawKind?: string;
  drawGenre?: string;
  autoSpin?: string;
}): {
  kind: RouletteKindFilter;
  genres: string[];
  shouldAutoSpin: boolean;
} {
  const kind =
    typeof params.drawKind === 'string' && VALID_KIND_FILTERS.has(params.drawKind)
      ? (params.drawKind as RouletteKindFilter)
      : 'Todos';

  return {
    kind,
    genres: params.drawGenre ? [params.drawGenre] : [],
    shouldAutoSpin: params.autoSpin === '1',
  };
}

export function buildDrawReason(title: MediaTitle): string {
  const avg = getTitleAverageRating(title);
  const genre = title.genres.find((item) => item !== 'Outros');

  if (genre === 'Documentário' && title.kind === 'Filme') {
    const quality = avg >= 8.2 ? 'aclamado' : 'bem avaliado';
    return `Documentário ${quality}`;
  }

  const isFeminine = title.kind === 'Série';
  const quality = avg >= 8.2
    ? isFeminine
      ? 'aclamada'
      : 'aclamado'
    : isFeminine
      ? 'bem avaliada'
      : 'bem avaliado';

  if (genre) {
    return `${title.kind} de ${genre} ${quality}`;
  }
  return `${title.kind} ${quality}`;
}
