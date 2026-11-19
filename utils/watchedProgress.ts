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
