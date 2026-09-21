import { describe, it, expect } from 'vitest';
import { computeInsights, SAVINGS_WINDOW_DAYS, STALE_DAYS } from './insights';
import { NOW, makeProduct, buy, rhythm } from './fixtures';
import type { PantryItem } from '../db/types';

const milk = makeProduct('milk', { category: 'dairy' });
const bread = makeProduct('bread', { category: 'bakery' });
const eggs = makeProduct('eggs', { category: 'dairy' });

const insights = (over: Partial<Parameters<typeof computeInsights>[0]> = {}) =>
  computeInsights({ products: [milk, bread, eggs], purchases: [], now: NOW, ...over });

/** Prices oldest -> newest for one product, a purchase every 10 days. */
const series = (productId: string, ...prices: number[]) =>
  prices.map((price, i) => buy((prices.length - i) * 10, price, { productId }));

const pantry = (over: Partial<PantryItem>): PantryItem => ({
  id: 'x', name: 'Milk', qty: 1, unit: '', category: 'dairy', parQty: 4,
  updatedAt: 'x', deletedAt: null, ...over,
});

describe('with no purchases', () => {
  it('reports emptiness honestly instead of zeros dressed as results', () => {
    const r = insights();

    expect(r.hasPurchases).toBe(false);
    expect(r.spend.thisMonth).toBe(0);
    expect(r.spend.deltaPct).toBeNull();
    expect(r.spend.byCategory).toEqual([]);
    expect(r.savings.potential).toBe(0);
    expect(r.savings.inflationPct).toBeNull();
    expect(r.restock.due).toEqual([]);
    expect(r.habits.mostBought).toEqual([]);
    expect(r.habits.data).toEqual({ products: 3, withPriceHistory: 0, unconfirmed: 0 });
  });
});

describe('spend', () => {
  // NOW is 20 Sep. Dates below are chosen by day-of-month, so build them explicitly.
  const on = (month: number, day: number, price: number | null, productId: string, opts = {}) => ({
    ...buy(0, price, { productId, ...opts }),
    date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  });

  const purchases = [
    on(9, 3, 10, 'milk'),
    on(9, 15, 20, 'bread', { storeId: 'target' }),
    on(9, 18, 5, 'milk', { confirmed: false }), // a guess: kept out of the total
    on(8, 5, 20, 'milk'), // inside the same span last month (day 5 <= 20)
    on(8, 25, 40, 'milk'), // outside it (day 25 > 20)
  ];

  it('totals the month so far from confirmed prices only', () => {
    const { spend } = insights({ purchases });
    expect(spend.thisMonth).toBe(30);
    expect(spend.estimatedThisMonth).toBe(5);
  });

  it('compares with the same span of days last month, not the whole month', () => {
    const { spend } = insights({ purchases });

    expect(spend.lastMonthSameSpan).toBe(20);
    expect(spend.lastMonthTotal).toBe(60);
    // 30 against 20 is +50%. Against last month's full 60 it would read -50%,
    // which is the misleading comparison this avoids.
    expect(spend.deltaPct).toBe(50);
  });

  it('has no percentage when last month has nothing to compare with', () => {
    expect(insights({ purchases: [on(9, 3, 10, 'milk')] }).spend.deltaPct).toBeNull();
  });

  it('splits by category and by store, biggest first', () => {
    const { spend } = insights({ purchases });

    expect(spend.byCategory).toEqual([
      { category: 'bakery', amount: 20 },
      { category: 'dairy', amount: 10 },
    ]);
    expect(spend.byStore).toEqual([
      { storeId: 'target', amount: 20 },
      { storeId: null, amount: 10 },
    ]);
  });

  it('ignores voided purchases and purchases of deleted products', () => {
    const { spend } = insights({
      purchases: [on(9, 3, 10, 'milk', { deletedAt: 'x' }), on(9, 4, 10, 'ghost')],
    });
    expect(spend.thisMonth).toBe(0);
  });
});

describe('savings', () => {
  const at = (n: number, price: number, storeId: string, productId = 'milk', qty = 1) =>
    buy(n, price, { storeId, productId, qty });

  it("totals what the cheapest store would have saved on recent purchases", () => {
    const { savings } = insights({
      purchases: [at(30, 4, 'walmart'), at(20, 4, 'walmart'), at(10, 3, 'target')],
    });

    // Two purchases at 4.00 against a 3.00 best: 1.00 each.
    expect(savings.potential).toBeCloseTo(2, 5);
    expect(savings.byProduct[0]).toMatchObject({ productId: 'milk', bestStoreId: 'target' });
  });

  it('scales the saving by quantity', () => {
    const { savings } = insights({
      purchases: [at(20, 8, 'walmart', 'milk', 2), at(10, 3, 'target')],
    });
    // 4.00 a unit against 3.00, two units.
    expect(savings.potential).toBeCloseTo(2, 5);
  });

  it(`only counts the last ${SAVINGS_WINDOW_DAYS} days`, () => {
    const { savings } = insights({
      purchases: [at(200, 4, 'walmart'), at(10, 4, 'walmart'), at(5, 3, 'target')],
    });
    // The purchase 200 days ago is outside the window.
    expect(savings.potential).toBeCloseTo(1, 5);
  });

  it('finds nothing to save with a single store, or when you already buy at the best', () => {
    expect(insights({ purchases: [at(20, 4, 'walmart'), at(10, 4, 'walmart')] }).savings.potential).toBe(0);
    expect(insights({ purchases: [at(20, 3, 'target'), at(10, 4, 'walmart')] }).savings.potential)
      .toBeCloseTo(1, 5);
  });

  describe('price movers', () => {
    const purchases = [
      ...series('milk', 4, 4, 4, 4.4), // +10%
      ...series('bread', 5, 5, 5, 4.5), // -10%
      ...series('eggs', 2, 2, 2, 2.02), // +1%: stable
    ];

    it('lists the biggest rises and drops, and skips stable prices', () => {
      const { savings } = insights({ purchases });

      expect(savings.rises.map(m => m.productId)).toEqual(['milk']);
      expect(savings.drops.map(m => m.productId)).toEqual(['bread']);
      expect(savings.rises[0]?.pct).toBe(10);
      expect(savings.drops[0]?.pct).toBe(-10);
    });

    it('takes the median across products as a personal inflation figure', () => {
      // Changes of +10, -10 and +1: the median is +1.
      expect(insights({ purchases }).savings.inflationPct).toBe(1);
    });

    it('needs three products before calling anything inflation', () => {
      const two = insights({ purchases: [...series('milk', 4, 4, 4, 4.4), ...series('bread', 5, 5, 5, 4.5)] });
      expect(two.savings.inflationPct).toBeNull();
    });

    it('needs three confirmed prices before calling a change a mover', () => {
      // Two prices give a trend, but not enough history to say it "moved".
      const { savings } = insights({ purchases: series('milk', 4, 6) });
      expect(savings.rises).toEqual([]);
    });
  });
});

describe('restock', () => {
  it('lists items that are due or overdue, most overdue first', () => {
    const { restock } = insights({
      purchases: [...rhythm(10, 9, 'milk'), ...rhythm(10, 14, 'bread')], // due, then overdue
    });

    expect(restock.due.map(r => r.productId)).toEqual(['bread', 'milk']);
    expect(restock.due[0]?.daysOver).toBe(4);
  });

  it('separates items that are merely coming up', () => {
    const { restock } = insights({ purchases: rhythm(10, 8, 'milk') });

    expect(restock.due).toEqual([]);
    expect(restock.soon.map(r => r.productId)).toEqual(['milk']);
  });

  it('leaves out items that are already on a list', () => {
    const { restock } = insights({
      purchases: rhythm(10, 12, 'milk'),
      onListProductIds: new Set(['milk']),
    });
    expect(restock.due).toEqual([]);
  });

  it('shows nothing for an item with no rhythm yet', () => {
    const { restock } = insights({ purchases: [buy(20, null), buy(10, null)] });
    expect(restock.due).toEqual([]);
    expect(restock.soon).toEqual([]);
  });

  it('lists low pantry stock, lowest first, and links it to its product by name', () => {
    const { restock } = insights({
      pantry: [
        pantry({ id: 'a', name: 'Milk', qty: 1, parQty: 4 }), // 25%
        pantry({ id: 'b', name: 'Flour', qty: 0, parQty: 2 }), // 0%
        pantry({ id: 'c', name: 'Rice', qty: 3, parQty: 4 }), // 75%: fine
        pantry({ id: 'd', name: 'Old', qty: 0, parQty: 2, deletedAt: 'x' }),
      ],
    });

    expect(restock.lowPantry.map(r => r.name)).toEqual(['Flour', 'Milk']);
    expect(restock.lowPantry[1]).toMatchObject({ pct: 25, productId: 'milk' });
    expect(restock.lowPantry[0]?.productId).toBeNull();
  });
});

describe('habits and data completeness', () => {
  it('ranks what you buy most, ignoring one-offs', () => {
    const { habits } = insights({
      purchases: [
        ...series('milk', 4, 4, 4, 4, 4),
        ...series('bread', 5, 5),
        ...series('eggs', 2),
      ],
    });
    expect(habits.mostBought).toEqual([
      { productId: 'milk', times: 5 },
      { productId: 'bread', times: 2 },
    ]);
  });

  it('counts pre-tracking purchases toward the ranking', () => {
    const { habits } = insights({
      products: [makeProduct('milk', { priorPurchases: 9 }), bread],
      purchases: [buy(5, 4), buy(9, 4, { productId: 'bread' })],
    });
    expect(habits.mostBought[0]).toEqual({ productId: 'milk', times: 10 });
  });

  it(`flags items you used to buy but have not for ${STALE_DAYS}+ days`, () => {
    const { habits } = insights({
      purchases: [
        buy(200, 4, { productId: 'milk' }), buy(100, 4, { productId: 'milk' }),
        buy(70, 4, { productId: 'bread' }), buy(80, 4, { productId: 'bread' }),
        buy(40, 4, { productId: 'eggs' }), buy(50, 4, { productId: 'eggs' }), // recent enough
      ],
    });
    // Most lapsed first: milk was last bought 100 days ago, bread 70.
    expect(habits.stale.map(s => s.productId)).toEqual(['milk', 'bread']);
    expect(habits.stale.map(s => s.daysSince)).toEqual([100, 70]);
  });

  it('does not call a one-time purchase lapsed', () => {
    const { habits } = insights({ purchases: [buy(300, 4)] });
    expect(habits.stale).toEqual([]);
  });

  it('counts how much of the catalog has enough prices for a trend', () => {
    const { habits } = insights({
      purchases: [
        ...series('milk', 4, 4), // two confirmed prices: enough
        ...series('bread', 5), // one: not yet
        buy(3, 2, { productId: 'eggs', confirmed: false, source: 'tick' }), // a guess
      ],
    });

    expect(habits.data.products).toBe(3);
    expect(habits.data.withPriceHistory).toBe(1);
    expect(habits.data.unconfirmed).toBe(1);
  });
});

describe('per-product stats are shared with the cards', () => {
  it('exposes stats for every live product, including ones never bought', () => {
    const r = insights({ purchases: [buy(5, 4)] });

    expect(r.stats.size).toBe(3);
    expect(r.stats.get('milk')?.recordedPurchases).toBe(1);
    expect(r.stats.get('bread')?.recordedPurchases).toBe(0);
    expect(r.hasPurchases).toBe(true);
  });

  it('leaves deleted products out', () => {
    const r = insights({ products: [milk, { ...bread, deletedAt: 'x' }] });
    expect(r.stats.has('bread')).toBe(false);
  });
});
