/**
 * Pure helpers for displaying and validating stores.
 */

/**
 * Upper bound on a stored logo, in characters of its data URL.
 *
 * A logo resized to 160px is roughly 5-15 KB, so this leaves plenty of room
 * while stopping a hand-edited backup from parking megabytes in a single row.
 */
export const MAX_LOGO_CHARS = 300_000;

const SAFE_LOGO = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * True only for an inline raster image.
 *
 * A logo ends up as an `<img src>`. Data comes from the upload form but also
 * from imported backup files, which are just JSON anyone can edit — so an
 * `https://…` value would make the app fetch a remote URL every time the store
 * is shown, telling that server when and from where. Only inline images pass.
 */
export function isSafeLogo(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_LOGO_CHARS && SAFE_LOGO.test(value);
}

/** Same rule, named for what it guards when the image is a product photo. */
export const isSafeImage = isSafeLogo;

export interface AddressFields {
  address: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

/**
 * Lays an address out as up to three display lines:
 *
 *     123 Main St
 *     Springfield, IL 62704
 *     United States
 *
 * Blank parts are skipped without leaving stray commas or empty lines.
 */
export function formatAddressLines(parts: AddressFields): string[] {
  const regionAndPostal = [parts.region.trim(), parts.postalCode.trim()].filter(Boolean).join(' ');
  const cityLine = [parts.city.trim(), regionAndPostal].filter(Boolean).join(', ');
  return [parts.address.trim(), cityLine, parts.country.trim()].filter(Boolean);
}
