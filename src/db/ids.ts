/**
 * Identifier generation.
 *
 * The original `generateId()` in utils/helpers.js was `Date.now()` in base 36
 * plus five random characters. That is fine for one device but has a real
 * collision surface once the same account writes from two devices offline, so
 * new rows get a UUID. Existing ids stay valid — they are opaque strings either
 * way, which is why this needs no data migration.
 */

/** RFC 4122 v4 identifier. */
export function newId(): string {
  // `crypto.randomUUID` needs a secure context (https or localhost). Vite's dev
  // server is localhost, so this is the normal path; the fallback covers a LAN
  // IP or plain http, where it is undefined rather than throwing.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Set the version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Current instant as an ISO-8601 string — the format every `updatedAt` uses. */
export function now(): string {
  return new Date().toISOString();
}
