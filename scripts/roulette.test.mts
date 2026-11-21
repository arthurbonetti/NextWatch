import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWatchedTitleIds,
  filterRouletteCandidates,
  filterTitlesByActiveServices,
  parseRouletteDeepLinkPreset,
  pickRouletteWinner,
  resolveLockedFeaturedTitle,
  type RouletteTitle,
} from '../utils/roulette.ts';

const SAMPLE_TITLES: RouletteTitle[] = [
  {
    id: 'movie-1',
    kind: 'Filme',
    genres: ['Ficção científica', 'Aventura'],
    service: 'Max',
    services: ['Max'],
  },
  {
    id: 'series-1',
    kind: 'Série',
    genres: ['Drama', 'Suspense'],
    service: 'Netflix',
    services: ['Netflix', 'Prime Video'],
  },
  {
    id: 'anime-1',
    kind: 'Anime',
    genres: ['Ação', 'Fantasia'],
    service: 'Crunchyroll',
    services: ['Crunchyroll', 'Netflix'],
  },
  {
    id: 'movie-2',
    kind: 'Filme',
    genres: ['Drama', 'História'],
    service: 'Prime Video',
  },
];

test('filterTitlesByActiveServices keeps titles available in at least one active service', () => {
  const filtered = filterTitlesByActiveServices(SAMPLE_TITLES, new Set(['Prime Video']));
  assert.deepEqual(
    filtered.map((item) => item.id),
    ['series-1', 'movie-2'],
  );

  assert.deepEqual(filterTitlesByActiveServices(SAMPLE_TITLES, new Set()), []);
});

test('buildWatchedTitleIds merges roulette watched history with series/movie progress IDs', () => {
  const watched = buildWatchedTitleIds(
    [
      { tmdbId: 'movie-1', acao: 'assistiu' },
      { tmdbId: 'series-1', acao: 'ignorou' },
      { tmdbId: 'anime-1', acao: 'salvou' },
    ],
    ['movie-2', 'movie-1'],
  );

  assert.deepEqual(Array.from(watched).sort(), ['movie-1', 'movie-2']);
});

test('filterRouletteCandidates filters by provider, kind, genres, and watched progress', () => {
  const allServices = new Set(['Max', 'Netflix', 'Prime Video', 'Crunchyroll']);
  const watchedIds = new Set(['series-1', 'movie-2']);

  const dramaUnwatched = filterRouletteCandidates({
    eligibleTitles: SAMPLE_TITLES,
    enabledServiceSet: allServices,
    filters: { kind: 'Todos', selectedGenres: ['Drama'], hideWatched: true },
    watchedTitleIds: watchedIds,
  });
  assert.deepEqual(dramaUnwatched, []);

  const dramaIncludingWatched = filterRouletteCandidates({
    eligibleTitles: SAMPLE_TITLES,
    enabledServiceSet: allServices,
    filters: { kind: 'Todos', selectedGenres: ['Drama'], hideWatched: false },
    watchedTitleIds: watchedIds,
  });
  assert.deepEqual(
    dramaIncludingWatched.map((item) => item.id),
    ['series-1', 'movie-2'],
  );

  const moviesOnMaxOrPrime = filterRouletteCandidates({
    eligibleTitles: SAMPLE_TITLES,
    enabledServiceSet: new Set(['Max', 'Prime Video']),
    filters: { kind: 'Filme', selectedGenres: [], hideWatched: false },
    watchedTitleIds: new Set(),
  });
  assert.deepEqual(
    moviesOnMaxOrPrime.map((item) => item.id),
    ['movie-1', 'movie-2'],
  );

  const multiGenreMatch = filterRouletteCandidates({
    eligibleTitles: SAMPLE_TITLES,
    enabledServiceSet: new Set(['Netflix']),
    filters: { kind: 'Todos', selectedGenres: ['Suspense', 'Fantasia'], hideWatched: false },
    watchedTitleIds: new Set(),
  });
  assert.deepEqual(
    multiGenreMatch.map((item) => item.id),
    ['series-1', 'anime-1'],
  );

  const noServicesEnabled = filterRouletteCandidates({
    eligibleTitles: SAMPLE_TITLES,
    enabledServiceSet: new Set(),
    filters: { kind: 'Todos', selectedGenres: [], hideWatched: false },
    watchedTitleIds: new Set(),
  });
  assert.deepEqual(noServicesEnabled, []);
});

test('pickRouletteWinner avoids repeating lastDrawnId when other candidates exist', () => {
  const candidates = SAMPLE_TITLES.slice(0, 2); // movie-1, series-1

  const winnerA = pickRouletteWinner(candidates, 'movie-1', () => 0);
  assert.equal(winnerA?.id, 'series-1');

  const winnerB = pickRouletteWinner(candidates, 'series-1', () => 0.99);
  assert.equal(winnerB?.id, 'movie-1');

  const winnerWithMultiple = pickRouletteWinner(SAMPLE_TITLES, 'series-1', () => 0.5);
  assert.notEqual(winnerWithMultiple?.id, 'series-1');
  assert.equal(winnerWithMultiple?.id, 'anime-1');
});

test('pickRouletteWinner handles single candidate and empty candidate list', () => {
  assert.equal(pickRouletteWinner([], null), null);
  assert.equal(pickRouletteWinner([], 'movie-1'), null);

  const onlyOne = [SAMPLE_TITLES[0]!];
  assert.equal(pickRouletteWinner(onlyOne, 'movie-1', () => 0)?.id, 'movie-1');
  assert.equal(pickRouletteWinner(onlyOne, null, () => 0)?.id, 'movie-1');
});

test('resolveLockedFeaturedTitle preserves valid locked title and falls back when service disabled', () => {
  const locked = SAMPLE_TITLES[0]!; // Max
  const kept = resolveLockedFeaturedTitle({
    lockedFeatured: locked,
    activeServiceSet: new Set(['Max', 'Netflix']),
    eligibleTitles: [SAMPLE_TITLES[1]!],
    availableTitles: SAMPLE_TITLES,
  });
  assert.equal(kept?.id, 'movie-1');

  const replaced = resolveLockedFeaturedTitle({
    lockedFeatured: locked,
    activeServiceSet: new Set(['Netflix']),
    eligibleTitles: [SAMPLE_TITLES[1]!],
    availableTitles: [SAMPLE_TITLES[1]!],
  });
  assert.equal(replaced?.id, 'series-1');

  const empty = resolveLockedFeaturedTitle({
    lockedFeatured: locked,
    activeServiceSet: new Set(),
    eligibleTitles: [],
    availableTitles: [],
  });
  assert.equal(empty, null);
});

test('parseRouletteDeepLinkPreset validates kind, genre, and autoSpin flag', () => {
  assert.deepEqual(
    parseRouletteDeepLinkPreset({ drawKind: 'Anime', drawGenre: 'Ação', autoSpin: '1' }),
    { kind: 'Anime', genres: ['Ação'], shouldAutoSpin: true },
  );

  assert.deepEqual(
    parseRouletteDeepLinkPreset({ drawKind: 'Documentário', drawGenre: undefined, autoSpin: '0' }),
    { kind: 'Todos', genres: [], shouldAutoSpin: false },
  );
});
