import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import { buildSampleData, loadSampleData, removeSampleData, hasSampleData } from './sampleData';
import { computeInsights } from '../analytics/insights';
import { addItemToList } from '../db/shoppingOps';
import { toLocalDate } from '../utils/products';

const NOW = new Date(2026, 8, 20, 12);

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
});

describe('buildSampleData', () => {
  const data = buildSampleData(NOW);

  it('is deterministic: the same day gives the same data', () => {
    expect(buildSampleData(NOW)).toEqual(data);
  });

  it('flags every row as sample data, so removal can find exactly them', () => {
    for (const row of [...data.stores, ...data.products, ...data.purchases]) {
      expect(row.demo).toBe(true);
    }
  });

  it('uses fixed ids, so loading twice cannot duplicate it', () => {
    const ids = [...data.stores, ...data.products, ...data.purchases].map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => id.startsWith('demo-'))).toBe(true);
  });

  it('never dates a purchase in the future or before the window', () => {
    const today = toLocalDate(NOW);
    for (const purchase of data.purchases) {
      expect(purchase.date <= today).toBe(true);
      expect(purchase.date >= '2026-04-01').toBe(true);
    }
  });

  it('points every purchase at a real sample product and store', () => {
    const products = new Set(data.products.map(p => p.id));
    const stores = new Set(data.stores.map(s => s.id));
    for (const purchase of data.purchases) {
      expect(products.has(purchase.productId)).toBe(true);
      expect(stores.has(purchase.storeId!)).toBe(true);
    }
  });

  it('has real prices, and never a negative one', () => {
    for (const purchase of data.purchases) {
      expect(purchase.price).toBeGreaterThan(0);
      expect(Number.isFinite(purchase.price)).toBe(true);
    }
  });

  it('is labelled as sample data where a person will read it', () => {
    expect(data.stores.every(s => s.name.startsWith('Sample'))).toBe(true);
  });

  it('changes with the day it is built for, so it is always current', () => {
    const later = buildSampleData(new Date(2026, 9, 20, 12));
    expect(later.purchases[0]!.date).not.toBe(data.purchases[0]!.date);
  });
});

describe('the sample data shows off every feature', () => {
  const data = buildSampleData(NOW);
  const insights = computeInsights({ products: data.products, purchases: data.purchases, now: NOW });

  it('has spend this month', () => {
    expect(insights.hasPurchases).toBe(true);
    expect(insights.spend.thisMonth).toBeGreaterThan(0);
    expect(insights.spend.byCategory.length).toBeGreaterThan(1);
    expect(insights.spend.byStore.length).toBeGreaterThan(1);
  });

  it('finds savings at a cheaper store', () => {
    expect(insights.savings.potential).toBeGreaterThan(0);
  });

  it('has prices going up and prices going down, and an inflation figure', () => {
    expect(insights.savings.rises.length).toBeGreaterThan(0);
    expect(insights.savings.drops.length).toBeGreaterThan(0);
    expect(insights.savings.inflationPct).not.toBeNull();
  });

  it('has something due to restock, and something lapsed', () => {
    expect(insights.restock.due.length).toBeGreaterThan(0);
    expect(insights.habits.stale.length).toBeGreaterThan(0);
  });

  it('has a purchase still needing a price check', () => {
    expect(insights.habits.data.unconfirmed).toBeGreaterThan(0);
  });

  it('carries earlier purchases from before tracking, on one product', () => {
    const pizza = data.products.find(p => p.name === 'Frozen pizza')!;
    expect(insights.stats.get(pizza.id)!.timesPurchased).toBeGreaterThan(pizza.priorPurchases);
    expect(pizza.priorPurchases).toBe(6);
  });

  it('has at least one record-low price and one above-average price', () => {
    const labels = [...insights.stats.values()].map(s => s.opportunity);
    expect(labels).toContain('all-time-low');
    expect(labels).toContain('above-average');
  });

  it('has an item with a best store and a price gap between stores', () => {
    const compared = [...insights.stats.values()].filter(s => s.bestStoreId !== null);
    expect(compared.length).toBeGreaterThan(0);
    expect(compared.every(s => s.storeSpread! > 0)).toBe(true);
  });
});

describe('loadSampleData / removeSampleData', () => {
  it('loads the rows and reports that sample data exists', async () => {
    expect(await hasSampleData()).toBe(false);

    const counts = await loadSampleData(NOW);

    expect(await hasSampleData()).toBe(true);
    expect(await db.products.count()).toBe(counts.products);
    expect(await db.purchases.count()).toBe(counts.purchases);
    expect(await db.stores.count()).toBe(counts.stores);
  });

  it('is idempotent: loading twice does not duplicate anything', async () => {
    await loadSampleData(NOW);
    const first = { p: await db.products.count(), u: await db.purchases.count(), s: await db.stores.count() };

    await loadSampleData(NOW);

    expect(await db.products.count()).toBe(first.p);
    expect(await db.purchases.count()).toBe(first.u);
    expect(await db.stores.count()).toBe(first.s);
  });

  it('removes only the sample rows and leaves the user\'s own untouched', async () => {
    await db.products.put({
      id: 'mine', name: 'My own item', nameKey: 'my own item', category: 'dairy', brand: '', packageSize: '',
      barcode: '', photo: null, notes: '', priorPurchases: 0,
      createdAt: 'x', updatedAt: 'x', deletedAt: null,
    });
    await db.purchases.put({
      id: 'mine-1', productId: 'mine', itemId: null, listId: null, storeId: null, date: '2026-09-01',
      qty: 1, price: 3, confirmed: true, source: 'manual', createdAt: 'x', updatedAt: 'x', deletedAt: null,
    });
    await loadSampleData(NOW);

    await removeSampleData();

    expect(await hasSampleData()).toBe(false);
    expect((await db.products.toArray()).map(p => p.id)).toEqual(['mine']);
    expect((await db.purchases.toArray()).map(p => p.id)).toEqual(['mine-1']);
    expect(await db.stores.count()).toBe(0);
  });

  it('detaches, rather than deletes, real rows that came to point at sample ones', async () => {
    await loadSampleData(NOW);
    // The user linked a list to a sample store, added a sample item to a list, and
    // recorded one of their own purchases at a sample store.
    await db.shoppingLists.put({
      id: 'l1', name: 'Grocery', budget: null, storeId: 'demo-store-mart',
      createdAt: 'x', updatedAt: 'x', deletedAt: null,
    });
    await addItemToList('l1', { name: 'Milk', productId: 'demo-product-milk' });
    await db.purchases.put({
      id: 'real-1', productId: 'demo-product-milk', itemId: null, listId: null, storeId: 'demo-store-club',
      date: '2026-09-10', qty: 1, price: 4, confirmed: true, source: 'manual',
      createdAt: 'x', updatedAt: 'x', deletedAt: null,
    });

    await removeSampleData();

    // The list and its item survive; they simply no longer point at sample rows.
    const list = await db.shoppingLists.get('l1');
    expect(list?.deletedAt).toBeNull();
    expect(list?.storeId).toBeNull();
    const item = (await db.shoppingItems.toArray()).find(isLive)!;
    expect(item.name).toBe('Milk');
    expect(item.productId).toBeNull();
    // The user's own purchase keeps its data but loses the dangling store.
    expect((await db.purchases.get('real-1'))?.price).toBe(4);
    expect((await db.purchases.get('real-1'))?.storeId).toBeNull();
  });

  it('is a safe no-op when there is no sample data', async () => {
    await expect(removeSampleData()).resolves.toEqual({ stores: 0, products: 0, purchases: 0 });
  });
});
