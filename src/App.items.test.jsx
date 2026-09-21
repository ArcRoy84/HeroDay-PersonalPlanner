// End-to-end tests for the Items section: the real <App /> on a real
// (fake-indexeddb) database, driven through the DOM the way a user would.
//
// Dates are relative to the real "today", because that is what the app uses.
import React from 'react';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from './App.jsx';
import { db } from './db/schema';
import { isLive } from './db/repo';
import { resetBootForTests } from './db/boot';
import { newId } from './db/ids';
import { addItemToList } from './db/shoppingOps';
import { toLocalDate } from './utils/products';
import { mount, unmountAll, click, type, submit, waitFor, waitForAsync, byText } from './test/dom.js';

const iso = () => new Date().toISOString();
const dayOffset = (n) => toLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - n));

let stamp = 0;

async function seedStore(id, name) {
  await db.stores.put({
    id, name, icon: '🏪', logo: null, categoryId: 'supermarket', address: '', city: '', region: '',
    postalCode: '', country: '', lat: null, lon: null, hours: '', notes: '',
    createdAt: iso(), updatedAt: iso(), deletedAt: null,
  });
}

async function seedProduct(id, name, over = {}) {
  await db.products.put({
    id, name, nameKey: name.toLowerCase(), category: 'dairy', brand: '', packageSize: '',
    barcode: '', photo: null, notes: '', priorPurchases: 0,
    createdAt: iso(), updatedAt: iso(), deletedAt: null, ...over,
  });
}

/** A purchase `n` days ago. Priced purchases are confirmed unless told otherwise. */
async function seedPurchase(productId, n, price, over = {}) {
  stamp += 1;
  await db.purchases.put({
    id: newId(), productId, itemId: null, listId: null, storeId: null,
    date: dayOffset(n), qty: 1, price, confirmed: price !== null, source: 'manual',
    createdAt: new Date(Date.now() + stamp).toISOString(), updatedAt: iso(), deletedAt: null, ...over,
  });
}

/** Milk bought every 10 days, price steady at 4.00 then up 10% to 4.40 last time. */
async function seedMilk() {
  await seedStore('costco', 'Costco');
  await seedProduct('milk', 'Milk', { brand: 'Organic Valley', packageSize: '1 gal' });
  for (const [n, price] of [[40, 4], [30, 4], [20, 4], [10, 4.4]]) {
    await seedPurchase('milk', n, price, { storeId: 'costco' });
  }
}

async function freshDatabase() {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
  resetBootForTests();
  localStorage.clear();
  localStorage.setItem('mtp_view', JSON.stringify('shop'));
}

const navButton = (app, label) =>
  [...app.querySelectorAll('button')].find(b => b.textContent.trim() === label) ?? null;

async function openItemsTab() {
  const app = await mount(<App />);
  await click(await waitFor(() => navButton(app, 'Items'), 'the Items nav button'));
  await waitFor(() => app.querySelector('.shop-center-title')?.textContent === 'Items', 'the Items tab');
  return app;
}

const field = (app, id) => app.querySelector(`#${id}`);
const cards = (app) => [...app.querySelectorAll('.pcard')];
const cardNamed = (app, name) => cards(app).find(c => c.querySelector('.pcard-name')?.textContent === name);
const modalTables = (app) => [...app.querySelectorAll('.pmodal table')];
const purchasesTable = (app) => modalTables(app).find(t => t.querySelector('th')?.textContent === 'Date');

beforeEach(async () => {
  await freshDatabase();
  globalThis.Notification = { permission: 'denied' };
});

afterEach(async () => {
  await unmountAll();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Items: empty and adding by hand', () => {
  it('starts with a friendly empty state', async () => {
    const app = await openItemsTab();

    expect(app.textContent).toContain('No items yet');
    expect(byText(app, 'button', 'Add your first item')).not.toBeNull();
    expect(app.querySelector('.itiles')).toBeNull();
  });

  it('adds an item by hand and shows its card', async () => {
    const app = await openItemsTab();
    await click(byText(app, 'button', 'Add your first item'));
    await waitFor(() => field(app, 'pf-name'), 'the item form');

    await type(field(app, 'pf-name'), 'Whole milk');
    await type(field(app, 'pf-brand'), 'Organic Valley');
    await type(field(app, 'pf-size'), '1 gal');
    await submit(app.querySelector('form'));

    const card = await waitFor(() => cardNamed(app, 'Whole milk'), 'the new card');
    expect(card.textContent).toContain('Organic Valley · 1 gal');
    expect(card.textContent).toContain('No price yet');
    expect(card.textContent).toContain('Not bought yet');
    expect(field(app, 'pf-name')).toBeNull(); // the form closed

    const [row] = (await db.products.toArray()).filter(isLive);
    expect(row.brand).toBe('Organic Valley');
    // A hand-added product has no list item.
    expect(await db.shoppingItems.count()).toBe(0);
  });

  it('can also add the new item to a list', async () => {
    const app = await openItemsTab();
    await click(byText(app, 'button', 'Add your first item'));
    await waitFor(() => field(app, 'pf-name'), 'the item form');

    await type(field(app, 'pf-name'), 'Eggs');
    await click(app.querySelector('.pf-check-row input'));
    await submit(app.querySelector('form'));

    await waitFor(() => cardNamed(app, 'Eggs'), 'the new card');
    const items = (await db.shoppingItems.toArray()).filter(isLive);
    const product = (await db.products.toArray())[0];
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(product.id);
  });

  it('refuses a duplicate and offers to open the existing one', async () => {
    await seedProduct('milk', 'Milk', { brand: 'Acme', packageSize: '1 gal' });
    const app = await openItemsTab();
    await waitFor(() => cardNamed(app, 'Milk'), 'the seeded card');

    await click(byText(app, 'button', 'Add item'));
    await waitFor(() => field(app, 'pf-name'), 'the item form');
    await type(field(app, 'pf-name'), '  MILK ');
    await type(field(app, 'pf-brand'), 'acme');
    await type(field(app, 'pf-size'), '1 GAL');
    await submit(app.querySelector('form'));

    const message = await waitFor(() => app.querySelector('.store-msg--error'), 'the duplicate message');
    expect(message.textContent).toContain('already have this product');
    expect((await db.products.toArray()).filter(isLive)).toHaveLength(1);

    await click(byText(message, 'button', 'Open it'));
    await waitFor(() => app.querySelector('.pmodal'), 'the existing item to open');
  });

  it('keeps the submit button disabled until there is a name', async () => {
    const app = await openItemsTab();
    await click(byText(app, 'button', 'Add your first item'));
    await waitFor(() => field(app, 'pf-name'), 'the item form');

    const save = byText(app, 'button[type="submit"]', 'Add Item');
    expect(save.disabled).toBe(true);
    await type(field(app, 'pf-name'), 'Eggs');
    expect(save.disabled).toBe(false);
  });
});

describe('Items: the product card', () => {
  it('shows the price, trend, recency, store, rhythm and restock state', async () => {
    await seedMilk();
    const app = await openItemsTab();

    const card = await waitFor(() => cardNamed(app, 'Milk'), 'the milk card');

    expect(card.querySelector('.pcard-sub').textContent).toContain('Organic Valley · 1 gal');
    expect(card.querySelector('.pcard-price').textContent).toBe('$4.40');
    expect(card.querySelector('.pcard-when').textContent).toBe('Bought 10 days ago');

    // Up 10% against the average of the three earlier prices.
    const badge = card.querySelector('.tbadge');
    expect(badge.classList.contains('tbadge--bad')).toBe(true);
    expect(badge.getAttribute('aria-label')).toBe('Price up 10% compared with your recent average');
    expect(badge.textContent).toBe('↑+10%');

    expect(card.querySelector('.sbadge-name').textContent).toBe('Costco');
    expect(card.querySelector('.pcard-facts').textContent).toContain('You buy this every 10 days');
    expect(card.querySelector('.pcard-facts').textContent).toContain('4 purchases');

    // Bought every 10 days and last bought 10 days ago: it is time.
    expect(card.querySelector('.restock-text').textContent).toBe('Due now');

    const spark = card.querySelector('svg.spark');
    expect(spark.getAttribute('aria-label')).toBe('Price over your last 4 purchases, from $4.00 to $4.40');
  });

  it('marks an all-time low, and a price above average', async () => {
    await seedProduct('a', 'Butter');
    await seedProduct('b', 'Cheese');
    for (const [n, p] of [[30, 5], [20, 4.5], [10, 4]]) await seedPurchase('a', n, p);
    for (const [n, p] of [[30, 4], [20, 4], [10, 5]]) await seedPurchase('b', n, p);
    const app = await openItemsTab();

    await waitFor(() => cardNamed(app, 'Butter'), 'the cards');
    expect(cardNamed(app, 'Butter').querySelector('.ochip').textContent).toBe('All-time low');
    expect(cardNamed(app, 'Cheese').querySelector('.ochip').textContent).toBe('More expensive than average');
  });

  it('says so when an item has no price or history, instead of showing zeros', async () => {
    await seedProduct('milk', 'Milk');
    const app = await openItemsTab();

    const card = await waitFor(() => cardNamed(app, 'Milk'), 'the card');
    expect(card.textContent).toContain('No price yet');
    expect(card.textContent).toContain('Not bought yet');
    expect(card.querySelector('.tbadge')).toBeNull();
  });

  it('adds the item to the current list from the card', async () => {
    await seedProduct('milk', 'Milk');
    const app = await openItemsTab();
    const card = await waitFor(() => cardNamed(app, 'Milk'), 'the card');

    await click(byText(card, 'button', 'Add to list'));

    await waitFor(() => byText(cardNamed(app, 'Milk'), 'button', 'Added') || byText(cardNamed(app, 'Milk'), 'button', 'On your list'), 'confirmation');
    const items = (await db.shoppingItems.toArray()).filter(isLive);
    expect(items.map(i => i.productId)).toEqual(['milk']);
  });
});

describe('Items: insight tiles', () => {
  it('guides a new user instead of showing empty numbers', async () => {
    await seedProduct('milk', 'Milk');
    const app = await openItemsTab();

    await waitFor(() => app.querySelector('.itiles'), 'the tiles');
    const text = app.querySelector('.itiles').textContent;
    expect(text).toContain('Tick items off your list and confirm what you paid');
    expect(text).toContain('Buy the same item at two stores');
    expect(text).toContain('Once an item has three confirmed prices');
    expect(text).toContain('After three purchases of an item');
    expect(app.querySelector('.hero-figure')).toBeNull();
  });

  it("shows this month's spend, what is due, and how complete the data is", async () => {
    await seedMilk(); // 40, 30, 20 and 10 days ago
    await seedPurchase('milk', 0, 5, { storeId: 'costco' }); // today: certainly this month
    const app = await openItemsTab();

    // Which of these fall in the current month depends on today's date, so work
    // the expectation out from the rule ("this calendar month") instead.
    const month = toLocalDate(new Date()).slice(0, 7);
    const expected = [[40, 4], [30, 4], [20, 4], [10, 4.4], [0, 5]]
      .filter(([n]) => dayOffset(n).slice(0, 7) === month)
      .reduce((sum, [, price]) => sum + price, 0);
    const label = `$${expected.toFixed(2)}`;

    const hero = await waitFor(() => app.querySelector('.hero-figure'), 'the hero figure');
    expect(hero.textContent).toBe(label);

    const tiles = [...app.querySelectorAll('.itile')];
    const spent = tiles.find(t => t.querySelector('.itile-title').textContent === 'Where it went');
    expect(spent.textContent).toContain('Dairy & Eggs');
    expect(spent.textContent).toContain(label);

    const data = tiles.find(t => t.querySelector('.itile-title').textContent === 'Price data');
    expect(data.querySelector('.stat-value').textContent).toBe('1 of 1');
  });

  it('offers to restock what is due, and adds it to the list', async () => {
    await seedMilk();
    const app = await openItemsTab();

    const restock = await waitFor(
      () => [...app.querySelectorAll('.itile')].find(t => t.querySelector('.itile-title').textContent === 'Time to restock'),
      'the restock tile',
    );
    expect(restock.textContent).toContain('Milk');

    await click(byText(restock, 'button', 'Add'));

    await waitForAsync(async () => (await db.shoppingItems.toArray()).filter(isLive).length === 1, 'the item on the list');
    const items = (await db.shoppingItems.toArray()).filter(isLive);
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe('milk');
  });

  it('shows where you would save when an item is bought at two stores', async () => {
    await seedStore('walmart', 'Walmart');
    await seedStore('target', 'Target');
    await seedProduct('milk', 'Milk');
    await seedPurchase('milk', 20, 4, { storeId: 'walmart' });
    await seedPurchase('milk', 10, 3, { storeId: 'target' });
    await seedPurchase('milk', 5, 4, { storeId: 'walmart' });
    const app = await openItemsTab();

    const savings = await waitFor(
      () => [...app.querySelectorAll('.itile')].find(t => t.querySelector('.itile-title').textContent === 'Savings at the cheapest store'),
      'the savings tile',
    );
    // Two purchases at 4.00 against a 3.00 best store: 2.00 saved.
    expect(savings.querySelector('.stat-value').textContent).toBe('$2.00');
    expect(savings.textContent).toContain('cheapest at Target');
  });
});

describe('Items: the detail modal', () => {
  async function openMilk() {
    await seedMilk();
    const app = await openItemsTab();
    await click(await waitFor(() => cardNamed(app, 'Milk').querySelector('.pcard-main'), 'the card'));
    await waitFor(() => app.querySelector('.pmodal'), 'the modal');
    return app;
  }

  it('shows the full picture', async () => {
    const app = await openMilk();

    expect(app.querySelector('.pmodal-name').textContent).toBe('Milk');
    const stats = [...app.querySelectorAll('.pstat')].map(s => s.textContent);
    expect(stats.find(s => s.startsWith('Last paid'))).toContain('$4.40');
    expect(stats.find(s => s.startsWith('Times bought'))).toContain('4');
    expect(stats.find(s => s.startsWith('Total spent'))).toContain('$16.40');
    expect(stats.find(s => s.startsWith('Buying rhythm'))).toContain('every 10 days');

    expect(app.querySelector('.pchart svg')).not.toBeNull();
    expect(purchasesTable(app).querySelectorAll('tbody tr')).toHaveLength(4);
  });

  it('logs a past purchase and shows it in the history', async () => {
    const app = await openMilk();

    await click(byText(app, 'button', 'Log a past purchase'));
    const form = await waitFor(() => app.querySelector('form[aria-label="Log a past purchase"]'), 'the log form');
    const [date, qty, price] = form.querySelectorAll('input');
    await type(date, dayOffset(50));
    await type(qty, '2');
    await type(price, '$7.98');
    await submit(form);

    await waitFor(() => purchasesTable(app).querySelectorAll('tbody tr').length === 5, 'the fifth row');
    const logged = (await db.purchases.toArray()).find(p => p.date === dayOffset(50));
    expect(logged.price).toBe(7.98);
    expect(logged.qty).toBe(2);
    expect(logged.confirmed).toBe(true);
    expect(logged.source).toBe('manual');
  });

  it('refuses a purchase dated in the future, and bad prices', async () => {
    const app = await openMilk();
    await click(byText(app, 'button', 'Log a past purchase'));
    const form = await waitFor(() => app.querySelector('form[aria-label="Log a past purchase"]'), 'the log form');
    const [date, , price] = form.querySelectorAll('input');

    await type(date, dayOffset(-3));
    await type(price, '4.29');
    await submit(form);
    expect((await waitFor(() => form.querySelector('.store-msg--error'), 'an error')).textContent).toMatch(/future/);

    await type(date, dayOffset(1));
    await type(price, 'abc');
    await submit(form);
    await waitFor(() => /valid price/.test(form.querySelector('.store-msg--error')?.textContent ?? ''), 'a price error');

    expect(await db.purchases.count()).toBe(4);
  });

  it('confirms an assumed price with one click', async () => {
    await seedProduct('milk', 'Milk');
    await seedPurchase('milk', 5, 4.5, { confirmed: false, source: 'tick' });
    const app = await openItemsTab();
    await click(await waitFor(() => cardNamed(app, 'Milk').querySelector('.pcard-main'), 'the card'));
    await waitFor(() => app.querySelector('.pmodal'), 'the modal');

    const row = purchasesTable(app).querySelector('tbody tr');
    expect(row.textContent).toContain('Assumed');

    await click(byText(row, 'button', 'Confirm'));

    await waitFor(() => purchasesTable(app).querySelector('tbody tr').textContent.includes('Confirmed'), 'confirmation');
    const [purchase] = await db.purchases.toArray();
    expect(purchase.confirmed).toBe(true);
    expect(purchase.price).toBe(4.5);
  });

  it('edits a purchase in place', async () => {
    const app = await openMilk();
    const row = purchasesTable(app).querySelector('tbody tr');

    await click(row.querySelector('button[aria-label^="Edit"]'));
    const editing = await waitFor(() => app.querySelector('.ptable-edit'), 'the edit row');
    const price = editing.querySelectorAll('input')[2];
    expect(price.value).toBe('4.4');
    await type(price, '4.55');
    await click(byText(editing, 'button', 'Save'));

    await waitFor(() => !app.querySelector('.ptable-edit'), 'the row to close');
    const latest = (await db.purchases.toArray()).find(p => p.date === dayOffset(10));
    expect(latest.price).toBe(4.55);
  });

  it('voids a purchase after a confirmation step', async () => {
    const app = await openMilk();
    const row = purchasesTable(app).querySelector('tbody tr');

    await click(row.querySelector('button[aria-label^="Void"]'));
    expect(row.textContent).toContain('Void this purchase?');
    await click(byText(row, 'button', 'No')); // backing out changes nothing
    expect((await db.purchases.toArray()).filter(isLive)).toHaveLength(4);

    await click(row.querySelector('button[aria-label^="Void"]'));
    await click(byText(row, 'button', 'Void'));

    await waitFor(() => purchasesTable(app).querySelectorAll('tbody tr').length === 3, 'the row to go');
    expect((await db.purchases.toArray()).filter(isLive)).toHaveLength(3);
  });

  it('deletes the item and its history, after confirming', async () => {
    const app = await openMilk();

    await click(byText(app.querySelector('.pmodal-actions'), 'button', 'Delete'));
    const confirm = await waitFor(() => byText(app, 'button', 'Delete item'), 'the confirmation');
    expect(app.textContent).toContain('purchase history will be deleted');
    await click(confirm);

    await waitFor(() => !cardNamed(app, 'Milk'), 'the card to go');
    expect(app.querySelector('.pmodal')).toBeNull();
    expect((await db.products.get('milk')).deletedAt).toEqual(expect.any(String));
    expect((await db.purchases.toArray()).filter(isLive)).toHaveLength(0);
  });

  it('closes on Escape', async () => {
    const app = await openMilk();
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(app.querySelector('.pmodal')).toBeNull();
  });
});

describe('Items: search, filter and sort', () => {
  async function seedTwo() {
    await seedProduct('milk', 'Milk', { category: 'dairy' });
    await seedProduct('bread', 'Bread', { category: 'bakery' });
    for (const [n, p] of [[40, 4], [30, 4], [20, 4], [10, 4.4]]) await seedPurchase('milk', n, p); // up
    for (const [n, p] of [[40, 3], [30, 3], [20, 3], [10, 2.7]]) await seedPurchase('bread', n, p); // down
    return openItemsTab();
  }

  it('searches by name', async () => {
    const app = await seedTwo();
    await waitFor(() => cards(app).length === 2, 'both cards');

    await type(app.querySelector('input[type="search"]'), 'bre');

    await waitFor(() => cards(app).length === 1, 'the filter to apply');
    expect(cards(app)[0].querySelector('.pcard-name').textContent).toBe('Bread');
    expect(app.querySelector('.ichips-count').textContent).toBe('1 of 2');
  });

  it('filters by category', async () => {
    const app = await seedTwo();
    await waitFor(() => cards(app).length === 2, 'both cards');

    await type(app.querySelector('select[aria-label="Filter by category"]'), 'bakery');

    await waitFor(() => cards(app).length === 1, 'the filter to apply');
    expect(cards(app)[0].querySelector('.pcard-name').textContent).toBe('Bread');
  });

  it('narrows to items whose price is up', async () => {
    const app = await seedTwo();
    await waitFor(() => cards(app).length === 2, 'both cards');

    await click(byText(app, 'button', 'Price up'));

    await waitFor(() => cards(app).length === 1, 'the chip to apply');
    expect(cards(app)[0].querySelector('.pcard-name').textContent).toBe('Milk');
  });

  it('sorts by the biggest price change, and clears everything', async () => {
    const app = await seedTwo();
    await waitFor(() => cards(app).length === 2, 'both cards');

    await type(app.querySelector('select[aria-label="Sort items"]'), 'change');
    // Milk is +10%, bread -10%: equal size, so name breaks nothing here; just check both stay.
    expect(cards(app)).toHaveLength(2);

    await type(app.querySelector('input[type="search"]'), 'zzz');
    await waitFor(() => app.textContent.includes('Nothing matches'), 'the empty result');
    await click(byText(app, 'button', 'Clear filters'));
    await waitFor(() => cards(app).length === 2, 'the cards to return');
  });
});

describe('Items: the inline price editor on a list', () => {
  async function tickMilk(estimate) {
    const app = await mount(<App />);
    await waitFor(() => app.querySelector('.shop-list-tabs-bar'), 'the list view');
    await act(async () => { await addItemToList('default', { name: 'Milk', category: 'dairy', estimatedPrice: estimate }); });
    const card = await waitFor(() => app.querySelector('.sic'), 'the item card');
    await click(card.querySelector('.sic-check'));
    return app;
  }

  it('offers a pre-filled price after ticking, and confirming it takes one tap', async () => {
    const app = await tickMilk(4.5);

    const input = await waitFor(() => app.querySelector('.sic-paid-input'), 'the price editor');
    expect(input.value).toBe('4.50'); // pre-filled from the estimate

    await click(app.querySelector('.sic-paid-ok'));

    await waitFor(() => !app.querySelector('.sic-paid'), 'the editor to close');
    expect(app.querySelector('.sic-paid-done').textContent).toBe('Paid $4.50');
    const [purchase] = (await db.purchases.toArray()).filter(isLive);
    expect(purchase.confirmed).toBe(true);
    expect(purchase.price).toBe(4.5);
  });

  it('lets you correct the price', async () => {
    const app = await tickMilk(4.5);
    const input = await waitFor(() => app.querySelector('.sic-paid-input'), 'the price editor');

    await type(input, '4.29');
    await submit(app.querySelector('.sic-paid'));

    await waitFor(() => app.querySelector('.sic-paid-done'), 'the confirmed price');
    expect((await db.purchases.toArray()).filter(isLive)[0].price).toBe(4.29);
  });

  it('refuses an unreadable price', async () => {
    const app = await tickMilk(null);
    const input = await waitFor(() => app.querySelector('.sic-paid-input'), 'the price editor');
    expect(input.value).toBe(''); // nothing to pre-fill from

    await type(input, 'lots');
    await submit(app.querySelector('.sic-paid'));

    const error = await waitFor(() => app.querySelector('.sic-paid-error'), 'an error');
    expect(error.textContent).toContain('Enter what you paid');
    expect((await db.purchases.toArray())[0].confirmed).toBe(false);
  });

  it('asks for a store when the list has none, and records it', async () => {
    await seedStore('costco', 'Costco');
    const app = await tickMilk(4.5);
    const select = await waitFor(() => app.querySelector('.sic-paid-store'), 'the store picker');

    await type(select, 'costco');
    await click(app.querySelector('.sic-paid-ok'));

    await waitFor(() => app.querySelector('.sic-paid-done'), 'confirmation');
    expect((await db.purchases.toArray()).filter(isLive)[0].storeId).toBe('costco');
  });

  it('does not ask for a store when the list already has one', async () => {
    await seedStore('costco', 'Costco');
    await db.open();
    await db.shoppingLists.put({
      id: 'default', name: 'Grocery', budget: null, storeId: 'costco',
      createdAt: iso(), updatedAt: iso(), deletedAt: null,
    });
    const app = await tickMilk(4.5);

    await waitFor(() => app.querySelector('.sic-paid-input'), 'the price editor');
    expect(app.querySelector('.sic-paid-store')).toBeNull();
    expect((await db.purchases.toArray()).filter(isLive)[0].storeId).toBe('costco');
  });

  it('removes the editor, and the purchase, when the item is un-ticked', async () => {
    const app = await tickMilk(4.5);
    await waitFor(() => app.querySelector('.sic-paid-input'), 'the price editor');

    await click(app.querySelector('.sic-check'));

    await waitFor(() => !app.querySelector('.sic-paid'), 'the editor to go');
    expect((await db.purchases.toArray()).filter(isLive)).toHaveLength(0);
  });
});
