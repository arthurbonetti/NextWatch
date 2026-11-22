import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyEpisodeToggle,
  applySeasonToggle,
  buildWatchedTitleIdsOrdered,
  computeMyListsCounts,
  isMovieCompleted,
  isSeriesCompleted,
  mergeWatchedProgress,
  summarizeWatchedProgress,
} from '../utils/watchedProgress.ts';

test('mergeWatchedProgress prioritizes pending local edits and deletes over stale remote rows', () => {
  const result = mergeWatchedProgress(
    {
      'tmdb-movie-1': { '0': [1] },
      'tmdb-movie-2': {},
      'tmdb-tv-3': { '1': [1] },
      'tmdb-tv-4': { '1': [1, 2] },
    },
    [
      { titleId: 'tmdb-movie-2', progress: { '0': [1] } },
      { titleId: 'tmdb-tv-3', progress: { '1': [1, 2, 3] } },
    ],
    new Set(['tmdb-movie-1', 'tmdb-movie-2']),
  );

  assert.deepEqual(result.ids, ['tmdb-movie-1', 'tmdb-tv-3', 'tmdb-tv-4']);
  assert.deepEqual(result.byTitleId['tmdb-movie-1'], { '0': [1] });
  assert.equal(result.byTitleId['tmdb-movie-2'], undefined);
  assert.deepEqual(result.byTitleId['tmdb-tv-3'], { '1': [1, 2, 3] });
  assert.deepEqual(result.byTitleId['tmdb-tv-4'], { '1': [1, 2] });
});

test('summarizeWatchedProgress formats movies, anime movies, partial/complete series, and roulette entries', () => {
  assert.deepEqual(
    summarizeWatchedProgress({ isSerial: false, progressMap: { '0': [1] } }),
    { label: 'Assistido', percent: 100, completed: true },
  );

  assert.deepEqual(
    summarizeWatchedProgress({ isSerial: true, progressMap: { '1': [1, 2], '2': [1] }, totalEpisodes: 10 }),
    { label: '3/10 ep.', percent: 30, completed: false },
  );

  assert.deepEqual(
    summarizeWatchedProgress({ isSerial: true, progressMap: { '1': [1, 2, 3, 4] }, totalEpisodes: 3 }),
    { label: '3/3 ep.', percent: 100, completed: true },
  );

  assert.deepEqual(
    summarizeWatchedProgress({ isSerial: true, progressMap: { '1': [1] }, totalEpisodes: null }),
    { label: '1 episódio assistido', percent: null, completed: false },
  );

  assert.deepEqual(
    summarizeWatchedProgress({ isSerial: true, progressMap: undefined, totalEpisodes: 12 }),
    { label: 'Assistido pela Roleta', percent: null, completed: true },
  );
});

test('applyEpisodeToggle, applySeasonToggle, isMovieCompleted, and isSeriesCompleted track completion accurately', () => {
  let map = applyEpisodeToggle({}, 0, 1);
  assert.equal(isMovieCompleted(map), true);
  map = applyEpisodeToggle(map, 0, 1);
  assert.equal(isMovieCompleted(map), false);

  const seasons = [
    { seasonNumber: 1, episodeCount: 2 },
    { seasonNumber: 2, episodeCount: 2 },
  ];
  let tvMap = applySeasonToggle({}, 1, 2);
  assert.equal(isSeriesCompleted(tvMap, seasons), false);
  tvMap = applyEpisodeToggle(tvMap, 2, 1);
  assert.equal(isSeriesCompleted(tvMap, seasons), false);
  tvMap = applyEpisodeToggle(tvMap, 2, 2);
  assert.equal(isSeriesCompleted(tvMap, seasons), true);
  tvMap = applySeasonToggle(tvMap, 2, 2);
  assert.equal(isSeriesCompleted(tvMap, seasons), false);
});

test('buildWatchedTitleIdsOrdered and computeMyListsCounts keep Profile count aligned with Queue + Watched', () => {
  const watchedIds = buildWatchedTitleIdsOrdered(
    [
      { tmdbId: 'm1', acao: 'assistiu' },
      { tmdbId: 'm2', acao: 'ignorou' },
      { tmdbId: 's1', acao: 'assistiu' },
    ],
    ['s1', 's2'],
  );
  assert.deepEqual(watchedIds, ['s1', 's2', 'm1']);

  const counts = computeMyListsCounts(['q1', 'q2'], watchedIds);
  assert.deepEqual(counts, { queueCount: 2, watchedCount: 3, totalCount: 5 });
});
