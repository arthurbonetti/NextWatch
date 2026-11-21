import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AVATAR_PATH_REGEX,
  buildAvatarStoragePath,
  decodeBase64ToBytes,
  detectAvatarImageFormat,
  MAX_AVATAR_BYTES,
  sanitizeAvatarPath,
  toExactArrayBuffer,
  validateAvatarBytes,
} from '../utils/avatarImage.ts';

test('decodeBase64ToBytes handles raw base64 and data URI prefixes', () => {
  const pngPrefix = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
  const rawBytes = decodeBase64ToBytes(pngPrefix);
  const dataUriBytes = decodeBase64ToBytes(`data:image/png;base64,${pngPrefix}`);

  assert.deepEqual(Array.from(rawBytes), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual(Array.from(dataUriBytes), Array.from(rawBytes));
  assert.equal(decodeBase64ToBytes('').length, 0);
});

test('detectAvatarImageFormat and validateAvatarBytes accept JPEG, PNG, and WebP headers', () => {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  assert.deepEqual(detectAvatarImageFormat(jpegBytes), {
    contentType: 'image/jpeg',
    extension: 'jpg',
  });
  assert.deepEqual(validateAvatarBytes(jpegBytes), {
    ok: true,
    contentType: 'image/jpeg',
    extension: 'jpg',
  });
  assert.deepEqual(validateAvatarBytes(pngBytes), {
    ok: true,
    contentType: 'image/png',
    extension: 'png',
  });
  assert.deepEqual(validateAvatarBytes(webpBytes), {
    ok: true,
    contentType: 'image/webp',
    extension: 'webp',
  });
});

test('validateAvatarBytes rejects empty buffers, unsupported magic bytes, and oversized images', () => {
  const emptyResult = validateAvatarBytes(new Uint8Array(0));
  assert.equal(emptyResult.ok, false);

  const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const gifResult = validateAvatarBytes(gifBytes);
  assert.equal(gifResult.ok, false);

  const oversized = new Uint8Array(MAX_AVATAR_BYTES + 1);
  oversized.set([0xff, 0xd8, 0xff], 0);
  const sizeResult = validateAvatarBytes(oversized);
  assert.equal(sizeResult.ok, false);
});

test('buildAvatarStoragePath and sanitizeAvatarPath enforce UUID folder and safe extensions', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const generated = buildAvatarStoragePath(userId, 'png', 1732147200000);

  assert.equal(AVATAR_PATH_REGEX.test(generated), true);
  assert.equal(sanitizeAvatarPath(generated), generated);
  assert.equal(sanitizeAvatarPath(`  ${generated}  `), generated);

  assert.equal(sanitizeAvatarPath(`../${userId}/avatar-123.png`), null);
  assert.equal(sanitizeAvatarPath(`${userId}/avatar-123.svg`), null);
  assert.equal(sanitizeAvatarPath('not-a-uuid/avatar-123.png'), null);
  assert.equal(sanitizeAvatarPath(null), null);
});

test('toExactArrayBuffer slices a subarray to its exact byte bounds', () => {
  const backing = new Uint8Array([1, 2, 3, 4, 5, 6]);
  const view = backing.subarray(2, 5);
  const exact = toExactArrayBuffer(view);

  assert.equal(exact.byteLength, 3);
  assert.deepEqual(Array.from(new Uint8Array(exact)), [3, 4, 5]);
});
