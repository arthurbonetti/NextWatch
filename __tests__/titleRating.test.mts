import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyOptimisticRatingSummary,
  createEmptyRatingSummary,
  formatUserRatingAverage,
  formatUserRatingCount,
  formatUserRatingOutOfFive,
  getStarQualityLabel,
  normalizeUserStarRating,
} from '../utils/titleRating.ts';

test('normalizeUserStarRating accepts 0-5 stars, converts legacy 0-10 scores, and rejects invalid values', () => {
  assert.equal(normalizeUserStarRating(0), 0);
  assert.equal(normalizeUserStarRating(3), 3);
  assert.equal(normalizeUserStarRating(5), 5);
  assert.equal(normalizeUserStarRating(3.6), 4);
  assert.equal(normalizeUserStarRating(8), 4);
  assert.equal(normalizeUserStarRating(10), 5);
  assert.equal(normalizeUserStarRating(-1), null);
  assert.equal(normalizeUserStarRating(null), null);
  assert.equal(normalizeUserStarRating(undefined), null);
  assert.equal(normalizeUserStarRating(Number.NaN), null);
});

test('applyOptimisticRatingSummary computes exact user averages on add, update, and remove', () => {
  const titleId = 'tmdb-movie-1';

  const afterFirst = applyOptimisticRatingSummary({
    current: createEmptyRatingSummary(titleId),
    titleId,
    previousUserRating: null,
    nextUserRating: 4,
  });
  assert.deepEqual(afterFirst, { titleId, sum: 4, count: 1, average: 4 });

  const afterSecondUser = applyOptimisticRatingSummary({
    current: afterFirst,
    titleId,
    previousUserRating: null,
    nextUserRating: 5,
  });
  assert.deepEqual(afterSecondUser, { titleId, sum: 9, count: 2, average: 4.5 });

  const afterEdit = applyOptimisticRatingSummary({
    current: afterSecondUser,
    titleId,
    previousUserRating: 5,
    nextUserRating: 2,
  });
  assert.deepEqual(afterEdit, { titleId, sum: 6, count: 2, average: 3 });

  const afterRemoveOne = applyOptimisticRatingSummary({
    current: afterEdit,
    titleId,
    previousUserRating: 2,
    nextUserRating: null,
  });
  assert.deepEqual(afterRemoveOne, { titleId, sum: 4, count: 1, average: 4 });

  const afterRemoveLast = applyOptimisticRatingSummary({
    current: afterRemoveOne,
    titleId,
    previousUserRating: 4,
    nextUserRating: null,
  });
  assert.deepEqual(afterRemoveLast, { titleId, sum: 0, count: 0, average: null });
});

test('rating formatting helpers return N/A when no ratings exist and format comma averages otherwise', () => {
  assert.equal(formatUserRatingAverage(null), 'N/A');
  assert.equal(formatUserRatingOutOfFive(createEmptyRatingSummary('m1')), 'N/A');
  assert.equal(formatUserRatingAverage({ average: 0, count: 0 }), 'N/A');

  assert.equal(formatUserRatingAverage({ average: 4.25, count: 4 }), '4,3');
  assert.equal(formatUserRatingOutOfFive({ average: 4, count: 1 }), '4,0/5');
  assert.equal(formatUserRatingOutOfFive({ average: 0, count: 1 }), '0,0/5');

  assert.equal(formatUserRatingCount(0), 'Sem avaliações');
  assert.equal(formatUserRatingCount(1), '1 avaliação');
  assert.equal(formatUserRatingCount(12), '12 avaliações');
  assert.equal(getStarQualityLabel(5), 'Obra-prima');
  assert.equal(getStarQualityLabel(null), 'Toque nas estrelas para avaliar');
});
