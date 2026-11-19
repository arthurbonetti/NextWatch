import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
