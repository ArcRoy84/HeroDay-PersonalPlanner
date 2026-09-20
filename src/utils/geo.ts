/**
 * Coordinates and address lookup for stores.
 *
 * Everything here is either a pure function or an explicit user-triggered
 * network call. Nothing runs on its own: the app is local-first, and a store's
 * address is only sent anywhere when the user clicks "Look up from address".
 */

export interface Coordinates {
  lat: number;
  lon: number;
}

/** The parts of an address the lookup needs. */
export interface AddressParts {
  address: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface GeocodeMatch extends Coordinates {
  /** Human-readable place, shown so the user can check it is the right one. */
  label: string;
}

/**
 * Parses a coordinate typed into a text field.
 *
 * Returns `null` for an empty field (which is valid — coordinates are
 * optional), a number for a valid one, and `NaN` for text that is not a number
 * or is out of range, so the caller can tell "blank" from "wrong".
 */
export function parseCoordinate(raw: string, limit: 90 | 180): number | null {
  const text = raw.trim();
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > limit) return NaN;
  return value;
}

export type CoordinateCheck =
  | { ok: true; lat: number | null; lon: number | null }
  | { ok: false; error: string };

/** Validates the latitude/longitude pair as a unit: both, or neither. */
export function checkCoordinates(latRaw: string, lonRaw: string): CoordinateCheck {
  const lat = parseCoordinate(latRaw, 90);
  const lon = parseCoordinate(lonRaw, 180);

  if (Number.isNaN(lat)) return { ok: false, error: 'Latitude must be a number between -90 and 90.' };
  if (Number.isNaN(lon)) return { ok: false, error: 'Longitude must be a number between -180 and 180.' };
  if ((lat === null) !== (lon === null)) {
    return { ok: false, error: 'Enter both latitude and longitude, or leave both empty.' };
  }
  return { ok: true, lat, lon };
}

/** Rounds to ~10 cm precision — far finer than a shop door, and tidy to display. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** True when there is enough address to make a lookup worth attempting. */
export function canGeocode(parts: AddressParts): boolean {
  return Boolean(parts.address.trim() || parts.city.trim() || parts.postalCode.trim());
}

/**
 * Builds a Nominatim structured-search query string.
 *
 * Structured fields (street, city, …) are used instead of one free-text `q`
 * because they match far more reliably, and blank fields are simply left out.
 */
export function buildGeocodeQuery(parts: AddressParts): string {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '3' });
  const add = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) params.set(key, trimmed);
  };
  add('street', parts.address);
  add('city', parts.city);
  add('state', parts.region);
  add('postalcode', parts.postalCode);
  add('country', parts.country);
  return params.toString();
}

/** Narrows the unknown JSON Nominatim returns into matches with real numbers. */
export function parseGeocodeResults(json: unknown): GeocodeMatch[] {
  if (!Array.isArray(json)) return [];
  const matches: GeocodeMatch[] = [];
  for (const entry of json) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    // Nominatim returns coordinates as strings.
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    matches.push({
      lat: roundCoordinate(lat),
      lon: roundCoordinate(lon),
      label: typeof row.display_name === 'string' ? row.display_name : 'Unnamed place',
    });
  }
  return matches;
}

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';

/**
 * Looks an address up on OpenStreetMap's Nominatim service.
 *
 * Only ever called from a button click. The public instance allows roughly one
 * request per second, which a person clicking a button cannot exceed.
 */
export async function geocodeAddress(
  parts: AddressParts,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeMatch[]> {
  if (!canGeocode(parts)) return [];
  const response = await fetchImpl(`${NOMINATIM_SEARCH}?${buildGeocodeQuery(parts)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`);
  return parseGeocodeResults(await response.json());
}

export type LocateError = 'insecure' | 'unsupported' | 'denied' | 'unavailable';

export class LocateFailure extends Error {
  readonly reason: LocateError;

  constructor(reason: LocateError) {
    super(reason);
    this.name = 'LocateFailure';
    this.reason = reason;
  }
}

export const LOCATE_MESSAGES: Record<LocateError, string> = {
  insecure: 'Location needs a secure connection (HTTPS). Type the coordinates or use address lookup.',
  unsupported: 'This browser does not support geolocation.',
  denied: 'Location permission was denied. Allow it for this site in your browser settings.',
  unavailable: 'Could not determine your location. Try again, or enter it manually.',
};

/**
 * Reads the device's current position via the browser's geolocation API.
 *
 * Uses `window.isSecureContext` for the HTTPS check. Reading `location.protocol`
 * is a trap inside a component that has a prop named `location`.
 */
export function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new LocateFailure('insecure'));
    if (!navigator.geolocation) return reject(new LocateFailure('unsupported'));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        lat: roundCoordinate(coords.latitude),
        lon: roundCoordinate(coords.longitude),
      }),
      error => reject(new LocateFailure(error.code === 1 ? 'denied' : 'unavailable')),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** A link that opens the point in OpenStreetMap. Built from numbers only. */
export function mapUrl({ lat, lon }: Coordinates): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}
