export type SeriesProgressMap = Record<string, number[]>;

export type RemoteProgressEntry = {
  titleId: string;
  progress: SeriesProgressMap;
};

export type WatchedProgressSummary = {
  label: string;
  percent: number | null;
  completed: boolean;
};

export type SeasonEpisodeSummary = {
  seasonNumber: number;
  episodeCount: number;
};

export function applyEpisodeToggle(
  prev: SeriesProgressMap,
  seasonNumber: number,
  episodeNumber: number,
): SeriesProgressMap {
  const key = String(seasonNumber);
  const current = prev[key] ?? [];
  const exists = current.includes(episodeNumber);
  const nextEpisodes = exists
    ? current.filter((ep) => ep !== episodeNumber)
    : [...current, episodeNumber].sort((a, b) => a - b);

  if (nextEpisodes.length === 0) {
    const rest = { ...prev };
    delete rest[key];
    return rest;
  }
  return { ...prev, [key]: nextEpisodes };
}

export function applySeasonToggle(
  prev: SeriesProgressMap,
  seasonNumber: number,
  episodeCount: number,
  episodeNumbers?: readonly number[],
): SeriesProgressMap {
  const key = String(seasonNumber);
  const targetNumbers =
    episodeNumbers && episodeNumbers.length > 0
      ? Array.from(new Set(episodeNumbers)).sort((a, b) => a - b)
      : Array.from({ length: Math.max(0, episodeCount) }, (_, idx) => idx + 1);

  if (targetNumbers.length === 0) return prev;

  const current = prev[key] ?? [];
  const allWatched = targetNumbers.every((num) => current.includes(num));
  if (allWatched) {
    const rest = { ...prev };
    delete rest[key];
    return rest;
  }
  return { ...prev, [key]: targetNumbers };
}

export function isMovieCompleted(progressMap: SeriesProgressMap | undefined): boolean {
  return Boolean(progressMap?.['0']?.includes(1));
}

export function isSeriesCompleted(
  progressMap: SeriesProgressMap | undefined,
  seasons: readonly SeasonEpisodeSummary[],
): boolean {
  const regularSeasons = seasons.filter((s) => s.seasonNumber > 0 && s.episodeCount > 0);
  if (regularSeasons.length === 0 || !progressMap) return false;
  return regularSeasons.every(
    (season) => (progressMap[String(season.seasonNumber)]?.length ?? 0) >= season.episodeCount,
  );
}

export function buildWatchedTitleIdsOrdered(
  history: readonly { tmdbId: string; acao: string }[],
  progressTitleIds: readonly string[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of progressTitleIds) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const entry of history) {
    if (entry.acao === 'assistiu' && !seen.has(entry.tmdbId)) {
      seen.add(entry.tmdbId);
      ordered.push(entry.tmdbId);
    }
  }
  return ordered;
}

export function computeMyListsCounts(
  savedTitleIds: readonly string[],
  watchedTitleIds: readonly string[],
): { queueCount: number; watchedCount: number; totalCount: number } {
  const queueCount = new Set(savedTitleIds).size;
  const watchedCount = new Set(watchedTitleIds).size;
  return {
    queueCount,
    watchedCount,
    totalCount: queueCount + watchedCount,
  };
}

function hasEntries(map: SeriesProgressMap | undefined): map is SeriesProgressMap {
  return Boolean(map && Object.keys(map).length > 0);
}

/** Mescla progresso local e remoto dando prioridade a mutações locais pendentes. */
export function mergeWatchedProgress(
  localById: Record<string, SeriesProgressMap>,
  remoteRows: readonly RemoteProgressEntry[],
  pendingIds: ReadonlySet<string>,
): { ids: string[]; byTitleId: Record<string, SeriesProgressMap> } {
  const ids: string[] = [];
  const byTitleId: Record<string, SeriesProgressMap> = {};
  const seen = new Set<string>();

  for (const titleId of pendingIds) {
    seen.add(titleId);
    const localMap = localById[titleId];
    if (hasEntries(localMap)) {
      ids.push(titleId);
      byTitleId[titleId] = localMap;
    }
  }

  for (const row of remoteRows) {
    if (seen.has(row.titleId)) continue;
    seen.add(row.titleId);
    if (hasEntries(row.progress)) {
      ids.push(row.titleId);
      byTitleId[row.titleId] = row.progress;
    }
  }

  for (const [titleId, localMap] of Object.entries(localById)) {
    if (seen.has(titleId)) continue;
    seen.add(titleId);
    if (hasEntries(localMap)) {
      ids.push(titleId);
      byTitleId[titleId] = localMap;
    }
  }

  return { ids, byTitleId };
}

export function countWatchedSeriesEpisodes(progressMap: SeriesProgressMap | undefined): number {
  if (!progressMap) return 0;
  let total = 0;
  for (const [seasonKey, episodes] of Object.entries(progressMap)) {
    if (Number(seasonKey) > 0) {
      total += episodes.length;
    }
  }
  return total;
}

export function summarizeWatchedProgress(input: {
  isSerial: boolean;
  progressMap?: SeriesProgressMap;
  totalEpisodes?: number | null;
}): WatchedProgressSummary {
  if (!input.isSerial) {
    return { label: 'Assistido', percent: 100, completed: true };
  }

  const watched = countWatchedSeriesEpisodes(input.progressMap);
  if (watched === 0) {
    return { label: 'Assistido pela Roleta', percent: null, completed: true };
  }

  if (typeof input.totalEpisodes === 'number' && input.totalEpisodes > 0) {
    const clamped = Math.min(watched, input.totalEpisodes);
    const percent = Math.round((clamped / input.totalEpisodes) * 100);
    return {
      label: `${clamped}/${input.totalEpisodes} ep.`,
      percent,
      completed: percent >= 100,
    };
  }

  return {
    label: watched === 1 ? '1 episódio assistido' : `${watched} episódios assistidos`,
    percent: null,
    completed: false,
  };
}
