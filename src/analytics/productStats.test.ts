import { describe, it, expect } from 'vitest';
import {
  computeProductStats, TREND_FLAT_BAND, SPARK_POINTS, RESTOCK_DUE,
} from './productStats';
import { unitPriceOf, lastConfirmedUnitPrice } from './price';
import { NOW, daysAgo, makeProduct, buy, rhythm } from './fixtures';

const milk = makeProduct('milk');
const stats = (purchases = [] as ReturnType<typeof buy>[], product = milk) =>
  computeProductStats(product, purchases, NOW);

/** Prices oldest -> newest, one purchase every 10 days ending 10 days ago. */
const series = (...prices: number[]) =>
  prices.map((price, i) => buy((prices.length - i) * 10, price));

describe('unitPriceOf', () => {
  it('divides the line total by the quantity', () => {
    expect(unitPriceOf(buy(1, 9, { qty: 2 }))).toBe(4.5);
  });

  it('ignores unconfirmed, unpriced, voided and zero-quantity purchases', () => {
    expect(unitPriceOf(buy(1, 5, { confirmed: false }))).toBeNull();
    expect(unitPriceOf(buy(1, null))).toBeNull();
    expect(unitPriceOf(buy(1, 5, { deletedAt: 'x' }))).toBeNull();
    expect(unitPriceOf(buy(1, 5, { qty: 0 }))).toBeNull();
  });

  it('counts a free item as a price of zero, not as missing', () => {
    expect(unitPriceOf(buy(1, 0))).toBe(0);
  });
});

describe('lastConfirmedUnitPrice', () => {
  it('returns the newest confirmed price, skipping guesses', () => {
    const list = [buy(30, 4), buy(20, 5), buy(2, 9, { confirmed: false })];
    expect(lastConfirmedUnitPrice(list)).toBe(5);
  });

  it('returns null when nothing is confirmed', () => {
    expect(lastConfirmedUnitPrice([buy(1, 9, { confirmed: false })])).toBeNull();
  });
});

describe('an empty product', () => {
  it('reports nothing rather than zeros that look like data', () => {
    const s = stats([], makeProduct('milk', { priorPurchases: 3 }));

    expect(s.timesPurchased).toBe(3);
    expect(s.recordedPurchases).toBe(0);
    expect(s.lastPurchase).toBeNull();
    expect(s.daysSinceLast).toBeNull();
    expect(s.lastPrice).toBeNull();
    expect(s.avgUnitPrice).toBeNull();
    expect(s.trend).toBeNull();
    expect(s.opportunity).toBeNull();
    expect(s.restock.state).toBe('unknown');
    expect(s.bestStoreId).toBeNull();
    expect(s.spark).toEqual([]);
    expect(s.totalSpent).toBe(0);
  });
});

describe('purchase counts and recency', () => {
  it('adds pre-tracking purchases to the recorded ones', () => {
    const s = stats([buy(5, 4), buy(15, 4)], makeProduct('milk', { priorPurchases: 4 }));
    expect(s.recordedPurchases).toBe(2);
    expect(s.timesPurchased).toBe(6);
  });

  it('finds the newest purchase and counts whole days since', () => {
    const s = stats([buy(30, 4), buy(4, 4), buy(12, 4)]);
    expect(s.lastPurchase?.date).toBe(daysAgo(4));
    expect(s.daysSinceLast).toBe(4);
  });

  it('is 0 days for a purchase made today', () => {
    expect(stats([buy(0, 4)]).daysSinceLast).toBe(0);
  });

  it('ignores voided purchases and other products', () => {
    const s = stats([
      buy(3, 4),
      buy(1, 4, { deletedAt: 'x' }),
      buy(0, 4, { productId: 'bread' }),
    ]);
    expect(s.recordedPurchases).toBe(1);
    expect(s.daysSinceLast).toBe(3);
  });

  it('counts purchases made this calendar year', () => {
    const s = stats([buy(10, 4), buy(200, 4), buy(300, 4)]); // 300 days ago is 2025
    expect(s.purchasesThisYear).toBe(2);
  });
});

describe('price trend', () => {
  it('reports a rise against the average of the prices before it', () => {
    const t = stats(series(4, 4, 4, 4.4)).trend!;
    expect(t.direction).toBe('up');
    expect(t.pct).toBe(10);
  });

  it('reports a fall', () => {
    const t = stats(series(4, 4, 4, 3.6)).trend!;
    expect(t.direction).toBe('down');
    expect(t.pct).toBe(-10);
  });

  it(`calls a change under ${TREND_FLAT_BAND}% stable and 3% or more a trend`, () => {
    expect(stats(series(4, 4, 4, 4.08)).trend?.direction).toBe('flat'); // +2%
    expect(stats(series(4, 4, 4, 4.12)).trend?.direction).toBe('up'); // +3%
  });

  it('needs two confirmed prices', () => {
    expect(stats(series(4)).trend).toBeNull();
    expect(stats([]).trend).toBeNull();
  });

  it('compares against only the last five prices before it', () => {
    // A 10.00 far in the past must not drag the baseline up.
    const t = stats(series(10, 1, 1, 1, 1, 1, 1.05)).trend!;
    expect(t.pct).toBe(5);
  });

  it('compares unit prices, so buying two is not a price change', () => {
    const s = stats([buy(30, 4, { qty: 1 }), buy(20, 8, { qty: 2 }), buy(10, 12, { qty: 3 })]);
    expect(s.trend).toEqual({ direction: 'flat', pct: 0 });
  });

  it('leaves out prices that were never confirmed', () => {
    const s = stats([...series(4, 4, 4), buy(2, 9, { confirmed: false })]);

    expect(s.trend).toEqual({ direction: 'flat', pct: 0 });
    expect(s.lastPrice?.unitPrice).toBe(4);
    expect(s.pricedPurchases).toBe(3);
    // The unconfirmed purchase still happened: it counts for recency.
    expect(s.daysSinceLast).toBe(2);
    expect(s.recordedPurchases).toBe(4);
  });

  it('has no trend when the baseline is zero', () => {
    expect(stats(series(0, 0, 3)).trend).toBeNull();
  });
});

describe('opportunity labels', () => {
  it('flags an all-time low', () => {
    expect(stats(series(5, 4.5, 4)).opportunity).toBe('all-time-low');
    expect(stats(series(4, 4, 4, 3.7)).opportunity).toBe('all-time-low');
  });

  it('counts tying the low as a low', () => {
    expect(stats(series(4, 4.2, 4)).opportunity).toBe('all-time-low');
  });

  it('does not call it a low when prices never changed', () => {
    expect(stats(series(4, 4, 4)).opportunity).toBeNull();
  });

  it('flags a price above your average', () => {
    expect(stats(series(4, 4, 4, 5)).opportunity).toBe('above-average');
  });

  it('flags a price below average that is not a record low', () => {
    expect(stats(series(5, 4, 5, 4.2)).opportunity).toBe('below-average');
  });

  it('stays quiet for an ordinary price', () => {
    expect(stats(series(5, 4, 4.6)).opportunity).toBeNull();
  });

  it('needs three confirmed prices', () => {
    expect(stats(series(5, 4)).opportunity).toBeNull();
  });
});

describe('buying rhythm and restock', () => {
  it('takes the median gap between purchase days', () => {
    expect(stats([buy(30, null), buy(20, null), buy(10, null)]).intervalDays).toBe(10);
  });

  it('needs three purchase days to have a rhythm', () => {
    const s = stats([buy(20, null), buy(10, null)]);
    expect(s.intervalDays).toBeNull();
    expect(s.restock.state).toBe('unknown');
  });

  it('treats two purchases on one day as one shop, not a gap of zero', () => {
    const s = stats([buy(20, null), buy(10, null), buy(10, null), buy(0, null)]);
    expect(s.intervalDays).toBe(10);
  });

  it('is not thrown by one unusually long gap', () => {
    // Gaps of 10, 10 and 60: the mean would say 27, the median says 10.
    const s = stats([buy(90, null), buy(80, null), buy(70, null), buy(10, null)]);
    expect(s.intervalDays).toBe(10);
  });

  it.each([
    [5, 'ok'],
    [8, 'soon'], // 0.8 of the gap
    [9, 'due'], // 0.9
    [11, 'due'], // 1.1
    [12, 'overdue'], // 1.2
  ] as const)('a 10-day rhythm, %i days since the last purchase, is "%s"', (since, state) => {
    expect(stats(rhythm(10, since)).restock.state).toBe(state);
  });

  it('counts down to the day it becomes due, and past it', () => {
    // Usual gap 10 -> due at 8.5 days.
    expect(stats(rhythm(10, 5)).restock.daysUntilDue).toBeGreaterThan(0);
    expect(stats(rhythm(10, 12)).restock.daysUntilDue).toBeLessThan(0);
    expect(RESTOCK_DUE).toBe(0.85);
  });

  it('reports the ratio the progress bar draws', () => {
    expect(stats(rhythm(10, 5)).restock.ratio).toBeCloseTo(0.5, 5);
  });
});

describe('spending totals', () => {
  it('sums only confirmed prices', () => {
    const s = stats([buy(20, 4), buy(10, 6), buy(1, 9, { confirmed: false })]);
    expect(s.totalSpent).toBe(10);
  });

  it('sums quantity across every purchase', () => {
    const s = stats([buy(20, 4, { qty: 2 }), buy(10, null, { qty: 3 })]);
    expect(s.totalQty).toBe(5);
  });
});

describe('store comparison', () => {
  const at = (n: number, price: number | null, storeId: string) => buy(n, price, { storeId });

  it('finds the cheapest store by average unit price', () => {
    const s = stats([at(40, 4, 'walmart'), at(30, 4, 'walmart'), at(20, 3.5, 'target')]);

    expect(s.bestStoreId).toBe('target');
    expect(s.storeSpread).toBeCloseTo(0.5, 5);
    const walmart = s.stores.find(x => x.storeId === 'walmart')!;
    expect(walmart.avgUnitPrice).toBe(4);
    expect(walmart.purchases).toBe(2);
  });

  it('needs prices at two stores before naming a best one', () => {
    const one = stats([at(20, 4, 'walmart'), at(10, 4, 'walmart')]);
    expect(one.bestStoreId).toBeNull();
    expect(one.storeSpread).toBeNull();

    // A second store with no price is a place you shop, not a comparison.
    const unpriced = stats([at(20, 4, 'walmart'), at(10, null, 'target')]);
    expect(unpriced.bestStoreId).toBeNull();
  });

  it('lists the stores you buy it at most, including unpriced visits', () => {
    const s = stats([
      at(50, 4, 'walmart'), at(40, 4, 'walmart'), at(30, 4, 'walmart'),
      at(20, 3, 'target'), at(10, null, 'costco'),
    ]);
    expect(s.topStores[0]).toBe('walmart');
    expect(s.topStores).toHaveLength(2);
  });

  it('ignores purchases with no store', () => {
    const s = stats([buy(20, 4), buy(10, 5, { storeId: 'target' })]);
    expect(s.stores.map(x => x.storeId)).toEqual(['target']);
  });

  it('remembers where and at what price the last purchase was', () => {
    const s = stats([at(20, 4, 'walmart'), at(2, 3.5, 'target')]);
    expect(s.lastPrice).toMatchObject({ unitPrice: 3.5, storeId: 'target', date: daysAgo(2) });
  });
});

describe('sparkline', () => {
  it(`keeps the last ${SPARK_POINTS} unit prices, oldest first`, () => {
    const prices = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
    expect(stats(series(...prices)).spark).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('is empty until something is priced', () => {
    expect(stats([buy(5, null)]).spark).toEqual([]);
  });
});

describe('unconfirmed purchases', () => {
  it('counts ticked purchases waiting for a price, but not carried-over ones', () => {
    const s = stats([
      buy(5, 4, { confirmed: false, source: 'tick' }),
      buy(9, null, { confirmed: false, source: 'tick' }),
      buy(90, null, { confirmed: false, source: 'legacy' }),
      buy(3, 4, { confirmed: true, source: 'tick' }),
    ]);
    expect(s.unconfirmed).toBe(2);
  });
});
