import assert from 'node:assert/strict';
import test from 'node:test';

import { shuffleArray } from '../utils/shuffle.ts';

test('shuffleArray returns a new array with the same elements without mutating input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const snapshot = input.slice();
  const shuffled = shuffleArray(input);

  assert.deepEqual(input, snapshot);
  assert.notEqual(shuffled, input);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), snapshot);
});

test('shuffleArray handles empty and single-element arrays', () => {
  assert.deepEqual(shuffleArray([]), []);
  assert.deepEqual(shuffleArray(['only']), ['only']);
});
