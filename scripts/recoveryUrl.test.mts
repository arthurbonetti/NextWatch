import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearPendingRecoveryParams,
  consumePendingRecoveryParams,
  formatRecoveryLinkError,
  hasRecoveryPayload,
  isPasswordRecoveryUrl,
  parseRecoveryUrlParams,
  setPendingRecoveryParams,
} from '../utils/recoveryUrl.ts';

test('parseRecoveryUrlParams extracts implicit hash tokens and recovery type', () => {
  const url =
    'http://localhost:8081/reset-password#access_token=abc.def.ghi&refresh_token=ref123&expires_in=3600&token_type=bearer&type=recovery';
  const parsed = parseRecoveryUrlParams(url);

  assert.equal(parsed.accessToken, 'abc.def.ghi');
  assert.equal(parsed.refreshToken, 'ref123');
  assert.equal(parsed.type, 'recovery');
  assert.equal(hasRecoveryPayload(parsed), true);
  assert.equal(isPasswordRecoveryUrl(url), true);
});

test('isPasswordRecoveryUrl detects recovery links landing on root Site URL', () => {
  const rootRecoveryUrl =
    'http://localhost:8081/#access_token=tok1&refresh_token=ref1&type=recovery';
  const otpRecoveryUrl =
    'https://nextwatch.app/?token_hash=hash123&type=recovery';
  const normalUrl = 'http://localhost:8081/tab2?q=matrix';

  assert.equal(isPasswordRecoveryUrl(rootRecoveryUrl), true);
  assert.equal(isPasswordRecoveryUrl(otpRecoveryUrl), true);
  assert.equal(isPasswordRecoveryUrl(normalUrl), false);
});

test('formatRecoveryLinkError maps expired link errors to a friendly message', () => {
  const expiredUrl =
    'http://localhost:8081/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  const parsed = parseRecoveryUrlParams(expiredUrl);

  assert.equal(isPasswordRecoveryUrl(expiredUrl), true);
  assert.equal(parsed.errorCode, 'otp_expired');
  const message = formatRecoveryLinkError(parsed);
  assert.ok(message && message.includes('expirou'));
});

test('pending recovery handoff buffer stores and consumes params once', () => {
  clearPendingRecoveryParams();
  setPendingRecoveryParams({
    accessToken: 'tok-handoff',
    refreshToken: 'ref-handoff',
    type: 'recovery',
  });

  const first = consumePendingRecoveryParams();
  assert.equal(first?.accessToken, 'tok-handoff');
  assert.equal(first?.refreshToken, 'ref-handoff');

  const second = consumePendingRecoveryParams();
  assert.equal(second, null);
});
