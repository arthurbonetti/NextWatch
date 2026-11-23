export const CHUNK_MAX_BYTES = 1800;

export function sanitizeStorageKey(key: string): string {
  const sanitized = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized || 'default';
}

export function utf8ByteLengthOfCodePoint(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

export function splitUtf8Chunks(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  let currentBytes = 0;

  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    const charBytes = utf8ByteLengthOfCodePoint(codePoint);
    if (currentChunk.length > 0 && currentBytes + charBytes > maxBytes) {
      chunks.push(currentChunk);
      currentChunk = char;
      currentBytes = charBytes;
    } else {
      currentChunk += char;
      currentBytes += charBytes;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}

export function parseChunkCount(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return 0;
  const count = Number(raw);
  return Number.isSafeInteger(count) && count > 0 && count <= 256 ? count : 0;
}

export function metaChunkKey(safeKey: string): string {
  return `${safeKey}.__chunks`;
}

export function itemChunkKey(safeKey: string, index: number): string {
  return `${safeKey}.__chunk.${index}`;
}
