export type RecoveryUrlParams = {
  accessToken?: string;
  refreshToken?: string;
  tokenHash?: string;
  code?: string;
  type?: string;
  error?: string;
  errorCode?: string;
  errorDescription?: string;
};

let pendingRecoveryParams: RecoveryUrlParams | null = null;

function readSegment(url: string): [string, string] {
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const queryString =
    queryIndex !== -1
      ? url.slice(queryIndex + 1, hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : undefined)
      : '';
  const hashString = hashIndex !== -1 ? url.slice(hashIndex + 1) : '';
  return [queryString, hashString];
}

function getNormalizedPathname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase();
  } catch {
    const withoutFragment = url.split('#')[0] ?? url;
    const withoutQuery = withoutFragment.split('?')[0] ?? withoutFragment;
    return withoutQuery.toLowerCase();
  }
}

export function parseRecoveryUrlParams(url: string | null | undefined): RecoveryUrlParams {
  if (!url) return {};

  const result: RecoveryUrlParams = {};
  const [queryString, hashString] = readSegment(url);

  for (const part of [queryString, hashString]) {
    if (!part) continue;
    const search = new URLSearchParams(part);
    const accessToken = search.get('access_token')?.trim();
    const refreshToken = search.get('refresh_token')?.trim();
    const tokenHash = search.get('token_hash')?.trim();
    const code = search.get('code')?.trim();
    const type = search.get('type')?.trim().toLowerCase();
    const error = search.get('error')?.trim();
    const errorCode = search.get('error_code')?.trim();
    const errorDescription = search.get('error_description')?.trim();

    if (accessToken && !result.accessToken) result.accessToken = accessToken;
    if (refreshToken && !result.refreshToken) result.refreshToken = refreshToken;
    if (tokenHash && !result.tokenHash) result.tokenHash = tokenHash;
    if (code && !result.code) result.code = code;
    if (type && !result.type) result.type = type;
    if (error && !result.error) result.error = error;
    if (errorCode && !result.errorCode) result.errorCode = errorCode;
    if (errorDescription && !result.errorDescription) result.errorDescription = errorDescription;
  }

  return result;
}

export function hasRecoveryPayload(params: RecoveryUrlParams): boolean {
  return Boolean(
    (params.accessToken && params.refreshToken) ||
      params.tokenHash ||
      params.code ||
      params.error ||
      params.errorCode,
  );
}

export function isPasswordRecoveryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const params = parseRecoveryUrlParams(url);
  if (params.type === 'recovery') {
    return true;
  }
  const pathname = getNormalizedPathname(url);
  return pathname.includes('reset-password') && hasRecoveryPayload(params);
}

export function formatRecoveryLinkError(params: RecoveryUrlParams): string | null {
  const code = params.errorCode?.toLowerCase() ?? '';
  const error = params.error?.toLowerCase() ?? '';
  const description = params.errorDescription?.toLowerCase() ?? '';

  if (!code && !error) return null;

  if (
    code.includes('otp_expired') ||
    code.includes('expired') ||
    description.includes('expired') ||
    description.includes('invalid') ||
    error === 'access_denied'
  ) {
    return 'Este link de recuperação expirou ou já foi utilizado. Solicite um novo envio na tela de login.';
  }

  return 'Não foi possível validar este link de recuperação. Solicite um novo envio na tela de login.';
}

export function buildRecoveryPayloadKey(params: RecoveryUrlParams): string {
  return [
    params.accessToken ?? '',
    params.refreshToken ?? '',
    params.tokenHash ?? '',
    params.code ?? '',
    params.error ?? '',
    params.errorCode ?? '',
  ].join('|');
}

export function setPendingRecoveryParams(params: RecoveryUrlParams): void {
  pendingRecoveryParams = hasRecoveryPayload(params) ? { ...params } : null;
}

export function peekPendingRecoveryParams(): RecoveryUrlParams | null {
  return pendingRecoveryParams ? { ...pendingRecoveryParams } : null;
}

export function consumePendingRecoveryParams(): RecoveryUrlParams | null {
  const next = pendingRecoveryParams ? { ...pendingRecoveryParams } : null;
  pendingRecoveryParams = null;
  return next;
}

export function clearPendingRecoveryParams(): void {
  pendingRecoveryParams = null;
}
