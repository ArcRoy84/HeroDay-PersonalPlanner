// End-to-end tests for registering a price inside Store Mode: the real <App />
// on a real (fake-indexeddb) database, driven through the DOM.
//
// The rule under test: checking an item off in Store Mode is where most price
// data actually gets entered (you are standing in the store), so Store Mode
// needs the same "what did you pay" flow as My List — including a quick way to
// repeat last time's price — and a confirmed price there must show up wherever
// Items reads purchase history from.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from './App.jsx';
import { db } from './db/schema';
import { isLive } from './db/repo';
import { resetBootForTests } from './db/boot';
import { addItemToList } from './db/shoppingOps';
import { mount, unmountAll, click, type, submit, waitFor, byText } from './test/dom.js';

const iso = () => new Date().toISOString();
const DEFAULT_LIST = 'default'; // the sample list boot creates — see db/boot.ts

async function seedProduct(id, name, over = {}) {
  await db.products.put({
    id, name, nameKey: name.toLowerCase(), category: 'dairy', brand: '', packageSize: '',
    barcode: '', photo: null, notes: '', priorPurchases: 0,
    createdAt: iso(), updatedAt: iso(), deletedAt: null, ...over,
  });
}

/** A confirmed purchase already on record, so there is a "last price" to offer. */
async function seedConfirmedPurchase(productId, price, over = {}) {
  await db.purchases.put({
    id: `pur-${productId}-${price}`, productId, itemId: null, listId: null, storeId: null,
    date: '2026-08-01', qty: 1, price, confirmed: true, source: 'tick',
    createdAt: iso(), updatedAt: iso(), deletedAt: null, ...over,
  });
}

async function freshDatabase() {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
  resetBootForTests();
  localStorage.clear();
  localStorage.setItem('mtp_view', JSON.stringify('shop'));
}

beforeEach(async () => {
  await freshDatabase();
  globalThis.Notification = { permission: 'denied' };
});

afterEach(async () => {
  await unmountAll();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** Boots the app, waits for boot to seed the default list, then enters Store Mode. */
async function openStoreMode() {
  const app = await mount(<App />);
  await waitFor(() => byText(app, 'button', 'Store Mode'), 'the Store Mode button');
  await click(byText(app, 'button', 'Store Mode'));
  await waitFor(() => app.querySelector('.smode'), 'Store Mode');
  return app;
}

const findUncheckedRow = (app, name) => byText(app, '.smode-item:not(.smode-item--row)', name)?.closest('.smode-item');
const findCheckedRow   = (app, name) => byText(app, '.smode-item--row .smode-item-name', name)?.closest('.smode-item--row');

/** The item list finishes loading a beat after Store Mode itself renders. */
const uncheckedRow = (app, name) => waitFor(() => findUncheckedRow(app, name), `the "${name}" row`);
const checkedRow   = (app, name) => waitFor(() => findCheckedRow(app, name), `the checked "${name}" row`);

describe('registering a price in Store Mode', () => {
  beforeEach(async () => {
    await seedProduct('milk', 'Milk');
    await addItemToList(DEFAULT_LIST, { name: 'Milk', productId: 'milk', qty: 2 });
  });

  it('shows a price form once the item is checked off, pre-filled and ready to confirm', async () => {
    const app = await openStoreMode();

    await click(await uncheckedRow(app, 'Milk'));

    const row = await checkedRow(app, 'Milk');
    const form = row.querySelector('.sic-paid');
    expect(form).not.toBeNull();
    expect(form.querySelector('.sic-paid-ok')).not.toBeNull();
  });

  it('offers "Same as last" and fills the field with it', async () => {
    await seedConfirmedPurchase('milk', 3.50); // $3.50 for 1, so $7.00 for this item's qty of 2
    const app = await openStoreMode();

    await click(await uncheckedRow(app, 'Milk'));
    const row = await checkedRow(app, 'Milk');
    const form = await waitFor(() => row.querySelector('.sic-paid'), 'the price form');

    const same = byText(form, 'button', 'Same as last');
    expect(same).not.toBeNull();
    expect(same.textContent).toContain('7.00');

    await click(same);
    expect(form.querySelector('.sic-paid-input').value).toBe('7.00');
  });

  it('registers the confirmed price as a purchase, and it disappears from the pending list', async () => {
    const app = await openStoreMode();

    await click(await uncheckedRow(app, 'Milk'));
    const row = await checkedRow(app, 'Milk');
    const form = await waitFor(() => row.querySelector('.sic-paid'), 'the price form');

    await type(form.querySelector('.sic-paid-input'), '5.49');
    await submit(form);

    await waitFor(() => byText(app, '.sic-paid-done', 'Paid'), 'the confirmed badge');
    expect(app.querySelector('.sic-paid')).toBeNull(); // the form is gone; nothing left to confirm

    const purchases = (await db.purchases.toArray()).filter(isLive);
    expect(purchases).toHaveLength(1);
    expect(purchases[0].confirmed).toBe(true);
    expect(purchases[0].price).toBe(5.49);
    expect(purchases[0].productId).toBe('milk');
  });

  it('flags a still-unconfirmed price once every item is checked off', async () => {
    const app = await openStoreMode();

    await click(await uncheckedRow(app, 'Milk'));
    await waitFor(() => app.querySelector('.smode-all-done'), 'the all-done panel');

    await waitFor(() => app.querySelector('.smode-all-done-warn'), 'the unconfirmed-price warning');
    expect(app.textContent).toMatch(/still need/);
  });

  it('has no unconfirmed-price warning once the price is confirmed', async () => {
    const app = await openStoreMode();

    await click(await uncheckedRow(app, 'Milk'));
    const row = await checkedRow(app, 'Milk');
    const form = await waitFor(() => row.querySelector('.sic-paid'), 'the price form');
    await type(form.querySelector('.sic-paid-input'), '5.49');
    await submit(form);

    await waitFor(() => app.querySelector('.smode-all-done'), 'the all-done panel');
    // The warning clears once the purchase's confirmed flag comes back through
    // the live query — a beat after the confirm click, not before it.
    await waitFor(() => app.querySelector('.smode-all-done-warn') === null, 'the warning to clear');
  });
});

describe('a price confirmed in Store Mode reaches Items', () => {
  beforeEach(async () => {
    await seedProduct('milk', 'Milk');
    await addItemToList(DEFAULT_LIST, { name: 'Milk', productId: 'milk', qty: 1 });
  });

  it('counts towards the product\'s last paid price once confirmed', async () => {
    const app = await openStoreMode();

    await click(await uncheckedRow(app, 'Milk'));
    const row = await checkedRow(app, 'Milk');
    const form = await waitFor(() => row.querySelector('.sic-paid'), 'the price form');
    await type(form.querySelector('.sic-paid-input'), '4.29');
    await submit(form);
    await waitFor(() => byText(app, '.sic-paid-done', 'Paid'), 'the confirmed badge');

    // Leave Store Mode and open the product in Items — the same confirmed
    // purchase, read through the same path Items analytics use.
    await click(byText(app, 'button', 'Exit Store Mode'));
    await click(byText(app, '.shop-nav-item, .shop-subnav-item', 'Items'));
    await waitFor(() => byText(app, 'button, .pcard-name', 'Milk'), 'the Milk card');
    await click(byText(app, 'button, .pcard-name', 'Milk'));

    const modal = await waitFor(() => app.querySelector('.pmodal'), 'the product detail');
    await waitFor(() => modal.textContent.includes('4.29'), 'the confirmed price in the product detail');
    expect(modal.textContent).toContain('Last paid');
  });
});
