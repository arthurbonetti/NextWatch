import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHUNK_MAX_BYTES,
  itemChunkKey,
  metaChunkKey,
  parseChunkCount,
  sanitizeStorageKey,
  splitUtf8Chunks,
  utf8ByteLengthOfCodePoint,
} from '../utils/secureStoreChunking.ts';

test('utf8ByteLengthOfCodePoint returns exact UTF-8 byte lengths across ranges', () => {
  assert.equal(utf8ByteLengthOfCodePoint('A'.codePointAt(0)!), 1);
  assert.equal(utf8ByteLengthOfCodePoint('é'.codePointAt(0)!), 2);
  assert.equal(utf8ByteLengthOfCodePoint('中'.codePointAt(0)!), 3);
  assert.equal(utf8ByteLengthOfCodePoint('🚀'.codePointAt(0)!), 4);
});

test('splitUtf8Chunks respects maxBytes boundary without splitting multibyte chars or emojis', () => {
  const payload = 'abc' + 'é'.repeat(5) + '中'.repeat(4) + '🚀'.repeat(6) + 'xyz';
  const maxBytes = 7;
  const chunks = splitUtf8Chunks(payload, maxBytes);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(Buffer.byteLength(chunk, 'utf8') <= maxBytes);
    assert.equal(Buffer.from(chunk, 'utf8').toString('utf8'), chunk);
  }
  assert.equal(chunks.join(''), payload);
});

test('splitUtf8Chunks splits large session tokens under CHUNK_MAX_BYTES', () => {
  const largeSession = 'a'.repeat(CHUNK_MAX_BYTES * 2 + 123);
  const chunks = splitUtf8Chunks(largeSession, CHUNK_MAX_BYTES);

  assert.equal(chunks.length, 3);
  assert.equal(Buffer.byteLength(chunks[0]!, 'utf8'), CHUNK_MAX_BYTES);
  assert.equal(Buffer.byteLength(chunks[1]!, 'utf8'), CHUNK_MAX_BYTES);
  assert.equal(Buffer.byteLength(chunks[2]!, 'utf8'), 123);
  assert.equal(chunks.join(''), largeSession);
});

test('splitUtf8Chunks handles empty string and single oversized codepoint safely', () => {
  assert.deepEqual(splitUtf8Chunks('', 10), []);
  assert.deepEqual(splitUtf8Chunks('🚀', 2), ['🚀']);
});

test('parseChunkCount, sanitizeStorageKey, and chunk key builders handle edge cases', () => {
  assert.equal(parseChunkCount(null), 0);
  assert.equal(parseChunkCount('0'), 0);
  assert.equal(parseChunkCount('-1'), 0);
  assert.equal(parseChunkCount('257'), 0);
  assert.equal(parseChunkCount('12.5'), 0);
  assert.equal(parseChunkCount('3'), 3);
  assert.equal(parseChunkCount('256'), 256);

  assert.equal(sanitizeStorageKey('sb-proj:auth/token'), 'sb-proj_auth_token');
  assert.equal(sanitizeStorageKey(''), 'default');

  assert.equal(metaChunkKey('session'), 'session.__chunks');
  assert.equal(itemChunkKey('session', 2), 'session.__chunk.2');
});
