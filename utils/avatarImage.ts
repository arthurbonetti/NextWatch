export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const AVATAR_PATH_REGEX =
  /^[0-9a-fA-F-]{36}\/avatar-[0-9a-zA-Z_-]+\.(jpg|jpeg|png|webp)$/;

export type AllowedAvatarMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type AllowedAvatarExtension = 'jpg' | 'png' | 'webp';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function fallbackDecodeBase64(cleaned: string): Uint8Array {
  const normalized = cleaned.replace(/=+$/, '');
  const outputLength = Math.floor((normalized.length * 3) / 4);
  const bytes = new Uint8Array(outputLength);
  let buffer = 0;
  let bitsCollected = 0;
  let index = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]!;
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error('Conteúdo base64 inválido.');
    }
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes[index++] = (buffer >> bitsCollected) & 0xff;
    }
  }

  return bytes;
}

/**
 * Sanitiza um caminho de objeto armazenado no bucket `avatars`.
 */
export function sanitizeAvatarPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 256) return null;
  return AVATAR_PATH_REGEX.test(trimmed) ? trimmed : null;
}

/**
 * Decodifica uma string base64 (com ou sem prefixo data URI) para bytes.
 */
export function decodeBase64ToBytes(rawBase64: string): Uint8Array {
  const withoutPrefix = rawBase64.replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!withoutPrefix) {
    return new Uint8Array(0);
  }

  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(withoutPrefix);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return fallbackDecodeBase64(withoutPrefix);
}

/**
 * Detecta o formato real da imagem a partir dos magic bytes (JPEG, PNG ou WebP).
 */
export function detectAvatarImageFormat(
  bytes: Uint8Array,
): { contentType: AllowedAvatarMimeType; extension: AllowedAvatarExtension } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: 'image/png', extension: 'png' };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }

  return null;
}

/**
 * Valida tamanho e assinatura binária do arquivo selecionado para avatar.
 */
export function validateAvatarBytes(
  bytes: Uint8Array,
):
  | { ok: true; contentType: AllowedAvatarMimeType; extension: AllowedAvatarExtension }
  | { ok: false; error: string } {
  if (bytes.byteLength === 0) {
    return { ok: false, error: 'A imagem selecionada está vazia.' };
  }

  if (bytes.byteLength > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      error: 'A imagem excede o limite de 5 MB. Escolha uma imagem menor.',
    };
  }

  const format = detectAvatarImageFormat(bytes);
  if (!format) {
    return {
      ok: false,
      error: 'Formato não suportado. Envie uma imagem JPG, PNG ou WebP.',
    };
  }

  return { ok: true, ...format };
}

function generateRandomHex(): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const random = new Uint8Array(6);
    globalThis.crypto.getRandomValues(random);
    return Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).slice(2, 14).padEnd(12, '0');
}

/**
 * Monta um caminho único e seguro na pasta do usuário no bucket `avatars`.
 */
export function buildAvatarStoragePath(
  userId: string,
  extension: AllowedAvatarExtension,
  nowMs = Date.now(),
): string {
  const cleanUserId = userId.trim();
  const timestamp = Math.max(0, Math.trunc(nowMs)).toString(36);
  const suffix = generateRandomHex();
  return `${cleanUserId}/avatar-${timestamp}-${suffix}.${extension}`;
}

/**
 * Retorna um ArrayBuffer exato correspondente à fatia de bytes informada.
 */
export function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
