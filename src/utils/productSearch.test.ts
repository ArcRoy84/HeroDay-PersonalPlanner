import { describe, it, expect } from 'vitest';
import {
  scoreProduct, searchProducts, resolveByName, popularityOf, SEARCH_LIMIT, AMBIGUOUS_OPTIONS,
} from './productSearch';
import { buildProduct } from '../db/catalog';
import type { Product } from '../db/types';

const ts = '2026-01-01T00:00:00.000Z';
const p = (name: string, over: Partial<Product> = {}): Product => ({
  ...buildProduct({ name }, ts), id: name.toLowerCase().replace(/\s+/g, '-'), ...over,
});

const milk = p('Milk', { brand: 'Organic Valley', packageSize: '1 gal' });
const oat = p('Oat milk');
const chocolate = p('Milk chocolate');
const eggs = p('Eggs', { packageSize: '12 ct' });
const bread = p('Sourdough bread');

describe('scoreProduct', () => {
  it('scores zero for no query and for no match', () => {
    expect(scoreProduct(milk, '')).toBe(0);
    expect(scoreProduct(milk, '   ')).toBe(0);
    expect(scoreProduct(milk, 'bread')).toBe(0);
  });

  it('ranks the whole name above a prefix above a later word', () => {
    const exact = scoreProduct(milk, 'milk');
    const prefix = scoreProduct(chocolate, 'milk');
    const laterWord = scoreProduct(oat, 'milk');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(laterWord);
  });

  it('ranks a name match above a match found only in the brand or size', () => {
    const byName = scoreProduct(p('Valley stew'), 'valley');
    const byBrand = scoreProduct(milk, 'valley');
    expect(byName).toBeGreaterThan(byBrand);
    expect(byBrand).toBeGreaterThan(0);
  });

  it('needs every word to match, in any order', () => {
    expect(scoreProduct(milk, 'organic milk')).toBeGreaterThan(0);
    expect(scoreProduct(milk, 'milk organic')).toBeGreaterThan(0);
    // "chocolate" is nowhere on the plain Milk product.
    expect(scoreProduct(milk, 'milk chocolate')).toBe(0);
  });

  it('matches partial words, size text and barcodes', () => {
    expect(scoreProduct(milk, 'mil')).toBeGreaterThan(0);
    expect(scoreProduct(eggs, '12 ct')).toBeGreaterThan(0);
    expect(scoreProduct(p('Nutella', { barcode: '3017620422003' }), '30176')).toBeGreaterThan(0);
  });

  it('ignores case and stray spacing', () => {
    expect(scoreProduct(milk, '  MILK ')).toBe(scoreProduct(milk, 'milk'));
  });
});

describe('searchProducts', () => {
  const all = [oat, milk, chocolate, eggs, bread];

  it('puts the exact name first, then prefixes, then later words', () => {
    expect(searchProducts(all, 'milk').map(x => x.name)).toEqual(['Milk', 'Milk chocolate', 'Oat milk']);
  });

  it('returns nothing for an empty query or no match', () => {
    expect(searchProducts(all, '')).toEqual([]);
    expect(searchProducts(all, 'zzz')).toEqual([]);
  });

  it('breaks ties by how often each was bought', () => {
    const a = p('Cheddar cheese');
    const b = p('Cheddar cracker');
    const popularity = new Map([[a.id, 2], [b.id, 30]]);
    expect(searchProducts([a, b], 'cheddar', { popularity }).map(x => x.name))
      .toEqual(['Cheddar cracker', 'Cheddar cheese']);
  });

  it('falls back to alphabetical when everything else is equal', () => {
    expect(searchProducts([p('Beta jam'), p('Alpha jam')], 'jam').map(x => x.name))
      .toEqual(['Alpha jam', 'Beta jam']);
  });

  it('skips deleted products', () => {
    expect(searchProducts([{ ...milk, deletedAt: ts }], 'milk')).toEqual([]);
  });

  it('limits the results', () => {
    const many = Array.from({ length: 20 }, (_, i) => p(`Apple ${i}`));
    expect(searchProducts(many, 'apple')).toHaveLength(SEARCH_LIMIT);
    expect(searchProducts(many, 'apple', { limit: 3 })).toHaveLength(3);
  });

  it('keeps two brands of one name apart, so both can be picked', () => {
    const a = p('Milk', { id: 'a', brand: 'Acme' });
    const b = p('Milk', { id: 'b', brand: 'Other' });
    expect(searchProducts([a, b], 'milk').map(x => x.id).sort()).toEqual(['a', 'b']);
  });
});

describe('resolveByName', () => {
  it('matches an exact name', () => {
    expect(resolveByName([milk, oat], 'milk')).toEqual({ kind: 'match', product: milk });
    expect(resolveByName([milk, oat], '  MILK ')).toEqual({ kind: 'match', product: milk });
  });

  it('picks the most-bought when several brands share the exact name', () => {
    const a = p('Milk', { id: 'a', brand: 'Acme' });
    const b = p('Milk', { id: 'b', brand: 'Other' });
    const popularity = new Map([['a', 1], ['b', 9]]);
    expect(resolveByName([a, b], 'milk', popularity)).toEqual({ kind: 'match', product: b });
  });

  it('resolves a partial name only when exactly one product fits', () => {
    expect(resolveByName([milk, eggs, bread], 'egg')).toEqual({ kind: 'match', product: eggs });
    expect(resolveByName([milk, eggs, bread], 'sour')).toEqual({ kind: 'match', product: bread });
  });

  it('calls it ambiguous, not a guess, when several fit', () => {
    const result = resolveByName([oat, chocolate, eggs], 'milk');
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.options.map(x => x.name).sort()).toEqual(['Milk chocolate', 'Oat milk']);
    }
  });

  it('caps how many options an ambiguous name offers', () => {
    const many = Array.from({ length: 12 }, (_, i) => p(`Apple ${i}`));
    const result = resolveByName(many, 'apple');
    expect(result.kind === 'ambiguous' && result.options.length).toBe(AMBIGUOUS_OPTIONS);
  });

  it('is missing for something that is not there, or an empty name', () => {
    expect(resolveByName([milk], 'xyzzy')).toEqual({ kind: 'missing' });
    expect(resolveByName([milk], '   ')).toEqual({ kind: 'missing' });
    expect(resolveByName([], 'milk')).toEqual({ kind: 'missing' });
  });

  it('does not resolve to a deleted product', () => {
    expect(resolveByName([{ ...milk, deletedAt: ts }], 'milk')).toEqual({ kind: 'missing' });
  });
});

describe('popularityOf', () => {
  it('counts purchases plus the ones from before tracking', () => {
    const products = [p('A', { priorPurchases: 4 }), p('B')];
    const counts = popularityOf(products, [
      { productId: 'a' }, { productId: 'a' }, { productId: 'b' },
    ]);
    expect(counts.get('a')).toBe(6);
    expect(counts.get('b')).toBe(1);
  });

  it('gives a never-bought product a count of zero, not undefined', () => {
    expect(popularityOf([p('A')], []).get('a')).toBe(0);
  });
});
