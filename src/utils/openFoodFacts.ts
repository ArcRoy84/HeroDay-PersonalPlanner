/**
 * Barcode lookup against Open Food Facts (https://openfoodfacts.org), a free,
 * open product database.
 *
 * Privacy: the only thing ever sent is the barcode number, and only when the
 * user scans a code or clicks "Look up". Nothing runs in the background.
 * Coverage is strongest for packaged food; fresh and local items are often
 * missing, which is why a miss is a normal result and not an error.
 */

/** What a lookup can tell us about a product. */
export interface OffProduct {
  name: string;
  brand: string;
  packageSize: string;
  /** A trusted https image URL, or `null`. */
  imageUrl: string | null;
}

const OFF_ORIGIN = 'https://world.openfoodfacts.org';
const FIELDS = 'product_name,product_name_en,generic_name,brands,quantity,image_front_small_url,image_front_url';

/**
 * A barcode reduced to its digits, or `null` if it cannot be one.
 * Product barcodes (EAN-8, UPC-A, EAN-13, GTIN-14) are 8 to 14 digits; rejecting
 * anything else stops a typo, or a QR code's contents, being sent anywhere.
 */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '');
  return /^\d{8,14}$/.test(digits) ? digits : null;
}

/**
 * Only images served by Open Food Facts itself are followed. The URL comes out
 * of a third-party response, so it is checked rather than fetched blindly.
 */
export function isTrustedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:'
      && (parsed.hostname === 'openfoodfacts.org' || parsed.hostname.endsWith('.openfoodfacts.org'));
  } catch {
    return false;
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Narrows the JSON Open Food Facts returns into what the app uses.
 * Returns `null` for "not found", for malformed data, and for a product with no
 * name, since a match with nothing to fill in is not a useful match.
 */
export function parseOffProduct(json: unknown): OffProduct | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as Record<string, unknown>;
  if (body.status !== 1 || !body.product || typeof body.product !== 'object') return null;
  const product = body.product as Record<string, unknown>;

  const name = text(product.product_name) || text(product.product_name_en) || text(product.generic_name);
  if (!name) return null;

  // "Nutella, Ferrero": the first entry is the brand on the label.
  const brand = text(product.brands).split(',')[0]?.trim() ?? '';
  // Quantities sometimes carry a trailing "e" (an estimate marker): "400 g e".
  const packageSize = text(product.quantity).replace(/\s+e$/i, '');
  const image = text(product.image_front_small_url) || text(product.image_front_url);

  return { name, brand, packageSize, imageUrl: isTrustedImageUrl(image) ? image : null };
}

/**
 * Looks a barcode up. Resolves to `null` when there is no such product, throws
 * on a network or server failure so the caller can say so.
 */
export async function lookupBarcode(
  barcode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OffProduct | null> {
  const code = normalizeBarcode(barcode);
  if (!code) return null;

  const response = await fetchImpl(`${OFF_ORIGIN}/api/v2/product/${code}.json?fields=${FIELDS}`, {
    headers: { Accept: 'application/json' },
  });
  // An unknown barcode is a 404, which is an answer, not a failure.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Barcode lookup failed (${response.status}).`);

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return null;
  }
  return parseOffProduct(json);
}
