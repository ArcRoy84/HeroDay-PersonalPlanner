import { describe, it, expect, vi } from 'vitest';
import {
  normalizeBarcode, isTrustedImageUrl, parseOffProduct, lookupBarcode,
} from './openFoodFacts';

const found = (product: Record<string, unknown>) => ({ status: 1, product });
const respond = (init: { ok?: boolean; status?: number; json?: unknown; jsonThrows?: boolean }) =>
  vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: init.jsonThrows
      ? async () => { throw new SyntaxError('bad json'); }
      : async () => init.json,
  }) as unknown as typeof fetch;

describe('normalizeBarcode', () => {
  it('accepts real product barcode lengths', () => {
    expect(normalizeBarcode('12345678')).toBe('12345678'); // EAN-8
    expect(normalizeBarcode('041631234567')).toBe('041631234567'); // UPC-A
    expect(normalizeBarcode('3017620422003')).toBe('3017620422003'); // EAN-13
    expect(normalizeBarcode('10012345678902')).toBe('10012345678902'); // GTIN-14
  });

  it('ignores the spaces and dashes people type', () => {
    expect(normalizeBarcode('3017 6204 22003')).toBe('3017620422003');
    expect(normalizeBarcode('0-41631-23456-7')).toBe('041631234567');
  });

  it('rejects anything that cannot be a product barcode', () => {
    for (const bad of ['', 'abc', '1234567', '123456789012345', 'https://x.example/qr', '3017620422003; DROP']) {
      expect(normalizeBarcode(bad)).toBeNull();
    }
  });
});

describe('isTrustedImageUrl', () => {
  it('accepts https images on Open Food Facts hosts', () => {
    expect(isTrustedImageUrl('https://images.openfoodfacts.org/images/products/1/front.jpg')).toBe(true);
    expect(isTrustedImageUrl('https://static.openfoodfacts.org/a.jpg')).toBe(true);
    expect(isTrustedImageUrl('https://openfoodfacts.org/a.jpg')).toBe(true);
  });

  it('rejects other hosts, lookalikes, http and non-URLs', () => {
    expect(isTrustedImageUrl('https://evil.example/a.jpg')).toBe(false);
    expect(isTrustedImageUrl('https://openfoodfacts.org.evil.example/a.jpg')).toBe(false);
    expect(isTrustedImageUrl('https://notopenfoodfacts.org/a.jpg')).toBe(false);
    expect(isTrustedImageUrl('http://images.openfoodfacts.org/a.jpg')).toBe(false);
    expect(isTrustedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedImageUrl('')).toBe(false);
  });
});

describe('parseOffProduct', () => {
  it('reads name, first brand, size and a trusted image', () => {
    const parsed = parseOffProduct(found({
      product_name: 'Nutella', brands: 'Nutella, Ferrero', quantity: '400 g e',
      image_front_small_url: 'https://images.openfoodfacts.org/x.200.jpg',
    }));
    expect(parsed).toEqual({
      name: 'Nutella', brand: 'Nutella', packageSize: '400 g',
      imageUrl: 'https://images.openfoodfacts.org/x.200.jpg',
    });
  });

  it('falls back through the name fields', () => {
    expect(parseOffProduct(found({ product_name: '', product_name_en: 'Milk' }))?.name).toBe('Milk');
    expect(parseOffProduct(found({ generic_name: 'Whole milk' }))?.name).toBe('Whole milk');
  });

  it('drops an image URL it does not trust rather than following it', () => {
    const parsed = parseOffProduct(found({ product_name: 'X', image_front_small_url: 'https://evil.example/a.jpg' }));
    expect(parsed?.imageUrl).toBeNull();
    expect(parsed?.name).toBe('X');
  });

  it('is not found when the status is 0, or the product has no name', () => {
    expect(parseOffProduct({ status: 0, status_verbose: 'product not found' })).toBeNull();
    expect(parseOffProduct(found({ brands: 'Acme' }))).toBeNull();
  });

  it('survives garbage without throwing', () => {
    for (const junk of [null, undefined, 'x', 42, [], { status: 1 }, { status: 1, product: 'no' }]) {
      expect(parseOffProduct(junk)).toBeNull();
    }
  });

  it('tolerates missing optional fields', () => {
    expect(parseOffProduct(found({ product_name: 'Bread' }))).toEqual({
      name: 'Bread', brand: '', packageSize: '', imageUrl: null,
    });
  });

  it('ignores non-string fields instead of crashing on them', () => {
    expect(parseOffProduct(found({ product_name: 'X', brands: 42, quantity: { a: 1 } }))).toEqual({
      name: 'X', brand: '', packageSize: '', imageUrl: null,
    });
  });
});

describe('lookupBarcode', () => {
  it('sends only the barcode, to Open Food Facts', async () => {
    const fetchSpy = respond({ json: found({ product_name: 'Nutella' }) });

    const result = await lookupBarcode('3017 6204 22003', fetchSpy);

    const url = String((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(url.startsWith('https://world.openfoodfacts.org/api/v2/product/3017620422003.json')).toBe(true);
    expect(result?.name).toBe('Nutella');
  });

  it('never touches the network for something that is not a barcode', async () => {
    const fetchSpy = vi.fn();
    expect(await lookupBarcode('hello', fetchSpy as unknown as typeof fetch)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats an unknown barcode as no result, not as an error', async () => {
    expect(await lookupBarcode('3017620422003', respond({ ok: false, status: 404, json: { status: 0 } }))).toBeNull();
    expect(await lookupBarcode('3017620422003', respond({ json: { status: 0 } }))).toBeNull();
  });

  it('throws a readable error on a server failure', async () => {
    await expect(lookupBarcode('3017620422003', respond({ ok: false, status: 503 }))).rejects.toThrow(/503/);
  });

  it('propagates a network failure so the UI can say so', async () => {
    const failing = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await expect(lookupBarcode('3017620422003', failing)).rejects.toThrow('Failed to fetch');
  });

  it('treats an unreadable response as no result', async () => {
    expect(await lookupBarcode('3017620422003', respond({ jsonThrows: true }))).toBeNull();
  });
});
