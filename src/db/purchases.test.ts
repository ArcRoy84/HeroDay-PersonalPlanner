import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from './schema';
import { isLive } from './repo';
import { addItemToList, updateItem, toggleItemChecked, createList } from './shoppingOps';
import {
  logPastPurchase, confirmPurchase, updatePurchase, removePurchase,
  normalizePurchaseInput, InvalidPurchaseError,
} from './purchaseOps';
import { createStore } from './storeOps';
import { toLocalDate } from '../utils/products';

const LIST = 'list-1';

async function seedList(storeId: string | null = null) {
  await db.shoppingLists.put({
    id: LIST, name: 'Grocery', budget: null, storeId,
    createdAt: 'x', updatedAt: 'x', deletedAt: null,
  });
}

const livePurchases = async () => (await db.purchases.toArray()).filter(isLive);

async function itemNamed(name: string) {
  return (await db.shoppingItems.toArray()).find(i => i.name === name && isLive(i))!;
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
  await seedList();
});

afterEach(() => vi.useRealTimers());

describe('adding an item', () => {
  it('gives it a product, and reuses that product for the same name', async () => {
    await addItemToList(LIST, { name: 'Milk', category: 'dairy' });
    const first = await itemNamed('Milk');
    await toggleItemChecked(first.id);
    await addItemToList(LIST, { name: 'milk' });

    const items = (await db.shoppingItems.toArray()).filter(isLive);
    expect(new Set(items.map(i => i.productId)).size).toBe(1);
    expect(items[0]?.productId).not.toBeNull();
    expect(await db.products.count()).toBe(1);
  });

  it('adds an instance of an exact product when given its id', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const generic = (await db.products.toArray())[0]!;
    // A second "Milk" that is a different product (another brand).
    await db.products.put({ ...generic, id: 'organic', brand: 'Organic Valley', createdAt: '2099-01-01T00:00:00Z' });

    await addItemToList(LIST, { name: 'Milk', productId: 'organic', qty: 2 });

    const added = (await db.shoppingItems.toArray()).find(i => i.productId === 'organic');
    expect(added?.name).toBe('Milk');
  });

  it('does not fold a different product into an unticked row with the same name', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const generic = (await db.products.toArray())[0]!;
    await db.products.put({ ...generic, id: 'organic', brand: 'Organic Valley', createdAt: '2099-01-01T00:00:00Z' });

    await addItemToList(LIST, { name: 'Milk', productId: 'organic' });

    const rows = (await db.shoppingItems.toArray()).filter(isLive);
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.productId).sort()).toEqual([generic.id, 'organic'].sort());
  });

  it('still merges when the same product is added again', async () => {
    await addItemToList(LIST, { name: 'Milk', qty: 1 });
    const productId = (await db.products.toArray())[0]!.id;

    await addItemToList(LIST, { name: 'Milk', qty: 2, productId });

    const rows = (await db.shoppingItems.toArray()).filter(isLive);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.qty).toBe(3);
  });

  it('re-links an item when it is renamed to something else', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const milk = await itemNamed('Milk');
    const before = milk.productId;

    await updateItem(milk.id, { name: 'Oat milk' });

    const after = (await db.shoppingItems.get(milk.id))!.productId;
    expect(after).not.toBe(before);
    expect((await db.products.get(after!))?.name).toBe('Oat milk');
  });

  it('keeps the product when only other fields change', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const milk = await itemNamed('Milk');

    await updateItem(milk.id, { qty: 3, note: 'the blue one' });

    expect((await db.shoppingItems.get(milk.id))!.productId).toBe(milk.productId);
    expect(await db.products.count()).toBe(1);
  });
});

describe('ticking an item', () => {
  it('records an unconfirmed purchase for today', async () => {
    await addItemToList(LIST, { name: 'Milk', qty: 2, estimatedPrice: 8.5 });
    const milk = await itemNamed('Milk');

    await toggleItemChecked(milk.id);

    const [purchase] = await livePurchases();
    expect(purchase?.productId).toBe(milk.productId);
    expect(purchase?.itemId).toBe(milk.id);
    expect(purchase?.qty).toBe(2);
    expect(purchase?.date).toBe(toLocalDate());
    expect(purchase?.source).toBe('tick');
    // Pre-filled from the item's estimate, but not something the user confirmed.
    expect(purchase?.price).toBe(8.5);
    expect(purchase?.confirmed).toBe(false);
  });

  it('uses the local day, not the UTC day, late in the evening', async () => {
    // Fake the clock only. Faking timers too would stop fake-indexeddb from ever
    // completing a transaction.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 18, 23, 30, 0)); // 11:30 pm local
    await addItemToList(LIST, { name: 'Milk' });

    await toggleItemChecked((await itemNamed('Milk')).id);

    expect((await livePurchases())[0]?.date).toBe('2026-09-18');
  });

  it("takes the store from the list's linked store", async () => {
    const { storeId } = await createStore({
      name: 'Costco', icon: '📦', logo: null, categoryId: 'warehouse', address: '', city: '',
      region: '', postalCode: '', country: '', lat: null, lon: null, hours: '', notes: '',
    });
    await db.shoppingLists.update(LIST, { storeId });
    await addItemToList(LIST, { name: 'Milk' });

    await toggleItemChecked((await itemNamed('Milk')).id);

    expect((await livePurchases())[0]?.storeId).toBe(storeId);
  });

  it('leaves the store empty for a list with no store', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    await toggleItemChecked((await itemNamed('Milk')).id);
    expect((await livePurchases())[0]?.storeId).toBeNull();
  });

  it('records no price when there is nothing to pre-fill from', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    await toggleItemChecked((await itemNamed('Milk')).id);
    expect((await livePurchases())[0]?.price).toBeNull();
  });

  it('pre-fills from the last confirmed unit price, scaled to the quantity', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const productId = (await itemNamed('Milk')).productId!;
    await logPastPurchase(productId, { date: '2026-09-01', qty: 2, price: 9, storeId: null }); // 4.50 each

    await addItemToList(LIST, { name: 'Milk', qty: 3 }); // merges into the existing unchecked row
    const milk = await itemNamed('Milk');
    await db.shoppingItems.update(milk.id, { qty: 3 });
    await toggleItemChecked(milk.id);

    const tick = (await livePurchases()).find(p => p.source === 'tick')!;
    expect(tick.price).toBe(13.5);
    expect(tick.confirmed).toBe(false);
  });

  it('does not pre-fill from a price that was itself never confirmed', async () => {
    await addItemToList(LIST, { name: 'Milk', estimatedPrice: 5 });
    const first = await itemNamed('Milk');
    await toggleItemChecked(first.id); // an unconfirmed 5.00 purchase now exists
    await addItemToList(LIST, { name: 'Milk' });
    const second = (await db.shoppingItems.toArray()).find(i => !i.checked && isLive(i))!;

    await toggleItemChecked(second.id);

    const ticks = (await livePurchases()).filter(p => p.itemId === second.id);
    expect(ticks[0]?.price).toBeNull();
  });

  it('voids the purchase when the item is un-ticked, and records a new one on re-tick', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const milk = await itemNamed('Milk');

    await toggleItemChecked(milk.id);
    expect(await livePurchases()).toHaveLength(1);

    await toggleItemChecked(milk.id); // un-tick: it was a mistake
    expect(await livePurchases()).toHaveLength(0);
    expect(await db.purchases.count()).toBe(1); // still on disk, voided

    await toggleItemChecked(milk.id);
    expect(await livePurchases()).toHaveLength(1);
  });

  it('still updates history and the pantry as before', async () => {
    await addItemToList(LIST, { name: 'Milk', qty: 2 });
    await toggleItemChecked((await itemNamed('Milk')).id);

    expect(await db.shoppingHistory.count()).toBe(1);
    expect(await db.pantry.count()).toBe(1);
  });
});

describe('confirming and editing purchases', () => {
  async function tickedPurchase() {
    await addItemToList(LIST, { name: 'Milk', qty: 2, estimatedPrice: 8 });
    await toggleItemChecked((await itemNamed('Milk')).id);
    return (await livePurchases())[0]!;
  }

  it('confirms a price and can set the store', async () => {
    const purchase = await tickedPurchase();
    const { storeId } = await createStore({
      name: 'Target', icon: '🏬', logo: null, categoryId: 'department', address: '', city: '',
      region: '', postalCode: '', country: '', lat: null, lon: null, hours: '', notes: '',
    });

    await confirmPurchase(purchase.id, { price: 8.99, storeId });

    const after = (await db.purchases.get(purchase.id))!;
    expect(after.price).toBe(8.99);
    expect(after.confirmed).toBe(true);
    expect(after.storeId).toBe(storeId);
    expect(after.qty).toBe(2);
  });

  it('keeps the store when confirming without naming one', async () => {
    const purchase = await tickedPurchase();
    await db.purchases.update(purchase.id, { storeId: 's1' });

    await confirmPurchase(purchase.id, { price: 7 });

    expect((await db.purchases.get(purchase.id))?.storeId).toBe('s1');
  });

  it('rejects a negative or non-numeric price', async () => {
    const purchase = await tickedPurchase();
    await expect(confirmPurchase(purchase.id, { price: -1 })).rejects.toThrow(InvalidPurchaseError);
    await expect(confirmPurchase(purchase.id, { price: NaN })).rejects.toThrow(InvalidPurchaseError);
    expect((await db.purchases.get(purchase.id))?.confirmed).toBe(false);
  });

  it('rounds a price to cents', async () => {
    const purchase = await tickedPurchase();
    await confirmPurchase(purchase.id, { price: 4.2999 });
    expect((await db.purchases.get(purchase.id))?.price).toBe(4.3);
  });

  it('treats a saved edit as confirmation, unless the price was cleared', async () => {
    const purchase = await tickedPurchase();

    await updatePurchase(purchase.id, { date: '2026-09-01', qty: 1, price: 4, storeId: null });
    expect((await db.purchases.get(purchase.id))?.confirmed).toBe(true);

    await updatePurchase(purchase.id, { date: '2026-09-01', qty: 1, price: null, storeId: null });
    expect((await db.purchases.get(purchase.id))?.confirmed).toBe(false);
  });

  it('voids a purchase', async () => {
    const purchase = await tickedPurchase();
    await removePurchase(purchase.id);
    expect(await livePurchases()).toHaveLength(0);
  });
});

describe('logPastPurchase', () => {
  const today = new Date(2026, 8, 18);

  it('records a confirmed manual purchase', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const productId = (await itemNamed('Milk')).productId!;

    const id = await logPastPurchase(productId, { date: '2026-09-01', qty: 1, price: 4.29, storeId: null });

    const row = (await db.purchases.get(id))!;
    expect(row.source).toBe('manual');
    expect(row.confirmed).toBe(true);
    expect(row.itemId).toBeNull();
  });

  it('is unconfirmed when logged without a price', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const productId = (await itemNamed('Milk')).productId!;
    const id = await logPastPurchase(productId, { date: '2026-09-01', qty: 1, price: null, storeId: null });
    expect((await db.purchases.get(id))?.confirmed).toBe(false);
  });

  it('refuses a product that does not exist', async () => {
    await expect(
      logPastPurchase('ghost', { date: '2026-09-01', qty: 1, price: 1, storeId: null }),
    ).rejects.toThrow(/no longer exists/);
  });

  describe('validation', () => {
    const valid = { date: '2026-09-01', qty: 1, price: 1, storeId: null };

    it('accepts a valid purchase', () => {
      expect(() => normalizePurchaseInput(valid, today)).not.toThrow();
    });

    it('accepts today but not tomorrow', () => {
      expect(() => normalizePurchaseInput({ ...valid, date: '2026-09-18' }, today)).not.toThrow();
      expect(() => normalizePurchaseInput({ ...valid, date: '2026-09-19' }, today)).toThrow(/future/);
    });

    it('rejects malformed and impossible dates', () => {
      expect(() => normalizePurchaseInput({ ...valid, date: 'yesterday' }, today)).toThrow(/valid date/);
      expect(() => normalizePurchaseInput({ ...valid, date: '2026-02-30' }, today)).toThrow(/valid date/);
      expect(() => normalizePurchaseInput({ ...valid, date: '' }, today)).toThrow(/valid date/);
    });

    it('rejects a zero, negative or non-finite quantity', () => {
      for (const qty of [0, -1, NaN, Infinity]) {
        expect(() => normalizePurchaseInput({ ...valid, qty }, today)).toThrow(/Quantity/);
      }
    });

    it('rejects a negative price but allows free (0) and unknown (null)', () => {
      expect(() => normalizePurchaseInput({ ...valid, price: -0.01 }, today)).toThrow(/negative/);
      expect(() => normalizePurchaseInput({ ...valid, price: 0 }, today)).not.toThrow();
      expect(normalizePurchaseInput({ ...valid, price: null }, today).price).toBeNull();
    });
  });
});
