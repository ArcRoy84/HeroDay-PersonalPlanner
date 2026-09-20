import { describe, it, expect } from 'vitest';
import { isSafeLogo, formatAddressLines, MAX_LOGO_CHARS } from './stores';

const blank = { address: '', city: '', region: '', postalCode: '', country: '' };

describe('isSafeLogo', () => {
  it('accepts inline raster images', () => {
    expect(isSafeLogo('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isSafeLogo('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeLogo('data:image/webp;base64,UklGRg==')).toBe(true);
  });

  it('rejects remote URLs, which would phone home whenever the store is shown', () => {
    expect(isSafeLogo('https://example.com/logo.png')).toBe(false);
    expect(isSafeLogo('http://example.com/logo.png')).toBe(false);
    expect(isSafeLogo('//example.com/logo.png')).toBe(false);
  });

  it('rejects scripts, SVG and other data types', () => {
    expect(isSafeLogo('javascript:alert(1)')).toBe(false);
    expect(isSafeLogo('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeLogo('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
  });

  it('rejects malformed data URLs', () => {
    expect(isSafeLogo('data:image/png;base64,')).toBe(false);
    expect(isSafeLogo('data:image/png;base64,not valid!!')).toBe(false);
    expect(isSafeLogo('data:image/png,rawbytes')).toBe(false);
  });

  it('rejects non-strings and oversized values', () => {
    expect(isSafeLogo(null)).toBe(false);
    expect(isSafeLogo(undefined)).toBe(false);
    expect(isSafeLogo(42)).toBe(false);
    expect(isSafeLogo('data:image/png;base64,' + 'A'.repeat(MAX_LOGO_CHARS))).toBe(false);
  });
});

describe('formatAddressLines', () => {
  it('lays out a full address on three lines', () => {
    expect(formatAddressLines({
      address: '123 Main St', city: 'Springfield', region: 'IL', postalCode: '62704', country: 'United States',
    })).toEqual(['123 Main St', 'Springfield, IL 62704', 'United States']);
  });

  it('skips blank parts without stray commas or empty lines', () => {
    expect(formatAddressLines({ ...blank, city: 'Springfield' })).toEqual(['Springfield']);
    expect(formatAddressLines({ ...blank, region: 'IL', postalCode: '62704' })).toEqual(['IL 62704']);
    expect(formatAddressLines({ ...blank, address: '1 Main St', country: 'US' })).toEqual(['1 Main St', 'US']);
  });

  it('returns nothing for an empty address', () => {
    expect(formatAddressLines(blank)).toEqual([]);
    expect(formatAddressLines({ ...blank, city: '   ' })).toEqual([]);
  });
});
