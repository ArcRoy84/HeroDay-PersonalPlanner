import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseCoordinate, checkCoordinates, roundCoordinate, canGeocode,
  buildGeocodeQuery, parseGeocodeResults, geocodeAddress,
  getCurrentCoordinates, LocateFailure, mapUrl,
} from './geo';

const blank = { address: '', city: '', region: '', postalCode: '', country: '' };

describe('parseCoordinate', () => {
  it('treats an empty field as "not set", not as an error', () => {
    expect(parseCoordinate('', 90)).toBeNull();
    expect(parseCoordinate('   ', 90)).toBeNull();
  });

  it('parses valid values including 0 and negatives', () => {
    expect(parseCoordinate('39.7817', 90)).toBe(39.7817);
    expect(parseCoordinate('-89.6501', 180)).toBe(-89.6501);
    expect(parseCoordinate('0', 90)).toBe(0);
  });

  it('returns NaN for text and out-of-range values', () => {
    expect(parseCoordinate('abc', 90)).toBeNaN();
    expect(parseCoordinate('91', 90)).toBeNaN();
    expect(parseCoordinate('-181', 180)).toBeNaN();
    expect(parseCoordinate('Infinity', 90)).toBeNaN();
  });
});

describe('checkCoordinates', () => {
  it('accepts both empty', () => {
    expect(checkCoordinates('', '')).toEqual({ ok: true, lat: null, lon: null });
  });

  it('accepts a valid pair', () => {
    expect(checkCoordinates('39.78', '-89.65')).toEqual({ ok: true, lat: 39.78, lon: -89.65 });
  });

  it('rejects one without the other', () => {
    const result = checkCoordinates('39.78', '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/both/i);
  });

  it('names which field is wrong', () => {
    const lat = checkCoordinates('95', '10');
    const lon = checkCoordinates('10', '200');
    expect(lat.ok === false && lat.error).toMatch(/Latitude/);
    expect(lon.ok === false && lon.error).toMatch(/Longitude/);
  });
});

describe('roundCoordinate', () => {
  it('trims noise beyond six decimals', () => {
    expect(roundCoordinate(39.781700123456)).toBe(39.7817);
    expect(roundCoordinate(-89.650123456)).toBe(-89.650123);
  });
});

describe('canGeocode', () => {
  it('needs at least a street, city or postal code', () => {
    expect(canGeocode(blank)).toBe(false);
    expect(canGeocode({ ...blank, country: 'US' })).toBe(false);
    expect(canGeocode({ ...blank, city: 'Springfield' })).toBe(true);
    expect(canGeocode({ ...blank, postalCode: '62704' })).toBe(true);
  });

  it('ignores whitespace-only fields', () => {
    expect(canGeocode({ ...blank, address: '   ' })).toBe(false);
  });
});

describe('buildGeocodeQuery', () => {
  it('uses structured fields and omits blanks', () => {
    const query = new URLSearchParams(buildGeocodeQuery({
      ...blank, address: '123 Main St', city: 'Springfield', country: 'USA',
    }));
    expect(query.get('street')).toBe('123 Main St');
    expect(query.get('city')).toBe('Springfield');
    expect(query.get('country')).toBe('USA');
    expect(query.has('state')).toBe(false);
    expect(query.has('postalcode')).toBe(false);
    expect(query.get('format')).toBe('jsonv2');
  });

  it('encodes special characters', () => {
    const raw = buildGeocodeQuery({ ...blank, address: 'Rue de l’Été & Co', city: 'Zürich' });
    expect(raw).not.toContain(' ');
    expect(raw).not.toContain('&Co');
    expect(new URLSearchParams(raw).get('street')).toBe('Rue de l’Été & Co');
  });
});

describe('parseGeocodeResults', () => {
  it('converts Nominatim string coordinates to rounded numbers', () => {
    const [match] = parseGeocodeResults([
      { lat: '39.781700123', lon: '-89.650100987', display_name: '123 Main St, Springfield' },
    ]);
    expect(match).toEqual({ lat: 39.7817, lon: -89.650101, label: '123 Main St, Springfield' });
  });

  it('skips entries without usable coordinates', () => {
    const results = parseGeocodeResults([
      { lat: 'x', lon: '1', display_name: 'bad' },
      { lat: '1', lon: '2' },
      null,
      'nope',
      { lat: '3', lon: '4', display_name: 'good' },
    ]);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.label)).toEqual(['Unnamed place', 'good']);
  });

  it('returns nothing for a non-array response', () => {
    expect(parseGeocodeResults({ error: 'nope' })).toEqual([]);
    expect(parseGeocodeResults(null)).toEqual([]);
  });
});

describe('geocodeAddress', () => {
  it('does not touch the network without enough address', async () => {
    const fetchSpy = vi.fn();
    expect(await geocodeAddress(blank, fetchSpy as unknown as typeof fetch)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requests Nominatim and parses the response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '1.5', lon: '2.5', display_name: 'Somewhere' }],
    });

    const matches = await geocodeAddress({ ...blank, city: 'Springfield' }, fetchSpy as unknown as typeof fetch);

    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url.startsWith('https://nominatim.openstreetmap.org/search?')).toBe(true);
    expect(url).toContain('city=Springfield');
    expect(matches).toEqual([{ lat: 1.5, lon: 2.5, label: 'Somewhere' }]);
  });

  it('throws a readable error on an HTTP failure', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    await expect(
      geocodeAddress({ ...blank, city: 'X' }, fetchSpy as unknown as typeof fetch),
    ).rejects.toThrow(/429/);
  });

  it('propagates a network failure', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      geocodeAddress({ ...blank, city: 'X' }, fetchSpy as unknown as typeof fetch),
    ).rejects.toThrow('Failed to fetch');
  });
});

describe('getCurrentCoordinates', () => {
  const setSecure = (value: boolean) =>
    Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
  const setGeolocation = (value: unknown) =>
    Object.defineProperty(navigator, 'geolocation', { value, configurable: true });

  afterEach(() => {
    setSecure(true);
    setGeolocation(undefined);
  });

  it('fails clearly on an insecure page', async () => {
    setSecure(false);
    await expect(getCurrentCoordinates()).rejects.toMatchObject({ reason: 'insecure' });
  });

  it('fails clearly when the browser has no geolocation', async () => {
    setSecure(true);
    setGeolocation(undefined);
    await expect(getCurrentCoordinates()).rejects.toMatchObject({ reason: 'unsupported' });
  });

  it('reports a permission denial', async () => {
    setSecure(true);
    setGeolocation({
      getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 1 }),
    });
    const failure = await getCurrentCoordinates().catch(e => e);
    expect(failure).toBeInstanceOf(LocateFailure);
    expect(failure.reason).toBe('denied');
  });

  it('reports any other failure as unavailable', async () => {
    setSecure(true);
    setGeolocation({
      getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 2 }),
    });
    await expect(getCurrentCoordinates()).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('resolves with rounded coordinates', async () => {
    setSecure(true);
    setGeolocation({
      getCurrentPosition: (ok: (p: unknown) => void) =>
        ok({ coords: { latitude: 39.781700123, longitude: -89.650100987 } }),
    });
    expect(await getCurrentCoordinates()).toEqual({ lat: 39.7817, lon: -89.650101 });
  });
});

describe('mapUrl', () => {
  it('builds an OpenStreetMap link from numbers', () => {
    const url = mapUrl({ lat: 39.7817, lon: -89.6501 });
    expect(url).toBe('https://www.openstreetmap.org/?mlat=39.7817&mlon=-89.6501#map=17/39.7817/-89.6501');
  });
});
