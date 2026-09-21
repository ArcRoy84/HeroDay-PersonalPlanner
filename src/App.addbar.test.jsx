// End-to-end tests for adding to a list from the catalog: the real <App /> on a
// real (fake-indexeddb) database.
//
// The rule under test: an item on a list is always registered on a catalog
// product that was picked or matched, and text that matches nothing is reported
// as "Product not found" instead of quietly creating a duplicate.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from './App.jsx';
import { db } from './db/schema';
import { isLive } from './db/repo';
import { resetBootForTests } from './db/boot';
import {
  mount, unmountAll, click, type, press, submit, waitFor, waitForAsync, byText,
} from './test/dom.js';

const iso = () => new Date().toISOString();

async function seedProduct(id, name, over = {}) {
  await db.products.put({
    id, name, nameKey: name.toLowerCase(), category: 'dairy', brand: '', packageSize: '',
    barcode: '', photo: null, notes: '', priorPurchases: 0,
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

/** Boots the app on the list view with the standard catalog seeded. */
async function openList() {
  const app = await mount(<App />);
  await waitFor(() => app.querySelector('input[role="combobox"]'), 'the add bar');
  return app;
}

const bar = (app) => app.querySelector('input[role="combobox"]');
const options = (app) => [...app.querySelectorAll('.asuggest-opt')];
const optionNames = (app) => options(app).map(o => o.querySelector('.asuggest-name').textContent);
const listItems = async () => (await db.shoppingItems.toArray()).filter(isLive);
const liveProducts = async () => (await db.products.toArray()).filter(isLive);

async function stubSpeech(transcript) {
  // A minimal SpeechRecognition: starting it "hears" the transcript immediately.
  class FakeRecognition {
    start() {
      this.onstart?.();
      const result = Object.assign([{ transcript }], { isFinal: true });
      this.onresult?.({ results: [result] });
      this.onend?.();
    }
    stop() {}
  }
  window.webkitSpeechRecognition = FakeRecognition;
}

beforeEach(async () => {
  await freshDatabase();
  globalThis.Notification = { permission: 'denied' };
});

afterEach(async () => {
  await unmountAll();
  vi.unstubAllGlobals();
  delete window.webkitSpeechRecognition;
  document.body.innerHTML = '';
});

describe('the add bar suggests items from the catalog', () => {
  beforeEach(async () => {
    await seedProduct('milk', 'Milk', { brand: 'Organic Valley', packageSize: '1 gal' });
    await seedProduct('oat', 'Oat milk');
    await seedProduct('eggs', 'Eggs', { category: 'dairy', packageSize: '12 ct' });
  });

  it('shows matches as you type, best first, with brand and size', async () => {
    const app = await openList();
    expect(options(app)).toHaveLength(0);

    await type(bar(app), 'milk');

    await waitFor(() => options(app).length === 2, 'the suggestions');
    expect(optionNames(app)).toEqual(['Milk', 'Oat milk']);
    expect(options(app)[0].textContent).toContain('Organic Valley · 1 gal');
    expect(bar(app).getAttribute('aria-expanded')).toBe('true');
    expect(app.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it('registers a click on that exact product, without creating another', async () => {
    const app = await openList();
    await type(bar(app), 'milk');
    await waitFor(() => options(app).length === 2, 'the suggestions');

    await click(options(app)[0]);

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    const [item] = await listItems();
    expect(item.productId).toBe('milk');
    expect(item.note).toBe('Organic Valley · 1 gal');
    expect(await liveProducts()).toHaveLength(3); // nothing new in the catalog
    expect(bar(app).value).toBe(''); // the box is cleared for the next one
  });

  it('adds the highlighted match on Enter, and moves with the arrow keys', async () => {
    const app = await openList();
    await type(bar(app), 'milk');
    await waitFor(() => options(app).length === 2, 'the suggestions');
    expect(options(app)[0].getAttribute('aria-selected')).toBe('true');

    await press(bar(app), 'ArrowDown');
    expect(options(app)[1].getAttribute('aria-selected')).toBe('true');
    expect(bar(app).getAttribute('aria-activedescendant')).toBe(options(app)[1].id);
    await press(bar(app), 'ArrowDown'); // wraps
    expect(options(app)[0].getAttribute('aria-selected')).toBe('true');
    await press(bar(app), 'ArrowUp'); // wraps back
    expect(options(app)[1].getAttribute('aria-selected')).toBe('true');

    await press(bar(app), 'Enter');

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    expect((await listItems())[0].productId).toBe('oat');
  });

  it('takes the first match on a bare Enter', async () => {
    const app = await openList();
    await type(bar(app), 'egg');
    await waitFor(() => options(app).length === 1, 'the suggestion');

    await press(bar(app), 'Enter');

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    expect((await listItems())[0].productId).toBe('eggs');
  });

  it('keeps the quantity and unit you typed', async () => {
    const app = await openList();
    // "gallons" is a unit the parser knows, so it is not mistaken for part of the name.
    await type(bar(app), '2 gallons mil');
    await waitFor(() => options(app).length === 2, 'the suggestions');

    await press(bar(app), 'Enter');

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    const [item] = await listItems();
    expect(item).toMatchObject({ productId: 'milk', qty: 2, unit: 'gallon' });
  });

  it('offers every brand of the same name, so the right one can be picked', async () => {
    await seedProduct('milk2', 'Milk', { brand: 'Acme', packageSize: '0.5 gal' });
    const app = await openList();

    await type(bar(app), 'milk');

    await waitFor(() => options(app).length === 3, 'all three');
    const texts = options(app).map(o => o.textContent);
    expect(texts.some(t => t.includes('Organic Valley'))).toBe(true);
    expect(texts.some(t => t.includes('Acme · 0.5 gal'))).toBe(true);

    await click(options(app).find(o => o.textContent.includes('Acme')));
    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    expect((await listItems())[0].productId).toBe('milk2');
  });

  it('marks what is already on the list, and adding it again adds to its quantity', async () => {
    const app = await openList();
    await type(bar(app), 'egg');
    await waitFor(() => options(app).length === 1, 'the suggestion');
    await press(bar(app), 'Enter');
    await waitForAsync(async () => (await listItems()).length === 1, 'the first add');

    await type(bar(app), 'egg');
    await waitFor(() => options(app).length === 1, 'the suggestion again');
    expect(options(app)[0].textContent).toContain('On this list');
    await press(bar(app), 'Enter');

    await waitForAsync(async () => (await listItems())[0]?.qty === 2, 'the quantity to merge');
    expect(await listItems()).toHaveLength(1);
  });

  it('closes the list on Escape without adding anything', async () => {
    const app = await openList();
    await type(bar(app), 'milk');
    await waitFor(() => options(app).length === 2, 'the suggestions');

    await press(bar(app), 'Escape');

    expect(options(app)).toHaveLength(0);
    expect(bar(app).getAttribute('aria-expanded')).toBe('false');
    expect(bar(app).value).toBe('milk');
    expect(await listItems()).toHaveLength(0);
  });

  it('keeps a product whose own name contains "and" in one piece', async () => {
    await seedProduct('mac', 'Mac and cheese', { category: 'pantry' });
    const app = await openList();

    await type(bar(app), 'mac and cheese');

    await waitFor(() => options(app).length >= 1, 'the suggestion');
    expect(optionNames(app)[0]).toBe('Mac and cheese');
    await press(bar(app), 'Enter');
    await waitForAsync(async () => (await listItems()).length === 1, 'one item, not two');
    expect((await listItems())[0].productId).toBe('mac');
  });
});

describe('when nothing matches: "Product not found"', () => {
  beforeEach(async () => {
    await seedProduct('milk', 'Milk');
    await seedProduct('eggs', 'Eggs');
  });

  it('says so, and creates nothing', async () => {
    const app = await openList();
    await type(bar(app), 'xyzzy');
    expect(options(app)).toHaveLength(0);

    await press(bar(app), 'Enter');

    const notice = await waitFor(() => app.querySelector('.notfound'), 'the notice');
    expect(notice.textContent).toContain('Product not found');
    expect(notice.textContent).toContain('xyzzy');
    expect(await listItems()).toHaveLength(0);
    expect(await liveProducts()).toHaveLength(2); // still just the two seeded
    expect(bar(app).value).toBe('xyzzy'); // kept, so it can be fixed
  });

  it('opens the new-product form with the name filled in, and adds it to the list', async () => {
    const app = await openList();
    await type(bar(app), '3 lbs xyzzy');
    await press(bar(app), 'Enter');
    await click(await waitFor(() => byText(app, 'button', 'Add as new product'), 'the button'));

    const name = await waitFor(() => app.querySelector('#pf-name'), 'the form');
    expect(name.value).toBe('Xyzzy');
    expect(app.querySelector('.pf-check-row input').checked).toBe(true);

    await submit(app.querySelector('form'));

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    const [item] = await listItems();
    const created = (await liveProducts()).find(p => p.name === 'Xyzzy');
    expect(created).toBeTruthy();
    expect(item.productId).toBe(created.id);
    expect(item).toMatchObject({ qty: 3, unit: 'lb' }); // what was typed is kept
    expect(app.querySelector('.notfound')).toBeNull(); // resolved
    expect(app.querySelector('#pf-name')).toBeNull(); // form closed
  });

  it('adds what it can from a batch and reports only the rest', async () => {
    const app = await openList();
    await type(bar(app), 'eggs, xyzzy');
    expect(options(app)).toHaveLength(0); // a batch has no dropdown

    await press(bar(app), 'Enter');

    await waitForAsync(async () => (await listItems()).length === 1, 'the item that matched');
    expect((await listItems())[0].productId).toBe('eggs');
    const notice = await waitFor(() => app.querySelector('.notfound'), 'the notice');
    expect(notice.textContent).toContain('xyzzy');
    expect(bar(app).value).toBe('xyzzy'); // only the unplaced part remains
  });

  it('asks which one when a name fits several products, and never guesses', async () => {
    await db.products.clear();
    await seedProduct('oat', 'Oat milk');
    await seedProduct('almond', 'Almond milk');
    const app = await openList();
    await type(bar(app), 'milk, xyzzy');

    await press(bar(app), 'Enter');

    // The first unplaced part is "milk", and it fits two products.
    const notice = await waitFor(() => app.querySelector('.notfound'), 'the notice');
    expect(notice.textContent).toContain('Which “milk”?');
    expect(await listItems()).toHaveLength(0);
    const choices = [...notice.querySelectorAll('.notfound-option')].map(b => b.textContent);
    expect(choices.some(t => t.includes('Oat milk'))).toBe(true);
    expect(choices.some(t => t.includes('Almond milk'))).toBe(true);

    await click(byText(notice, '.notfound-option', 'Almond milk'));

    await waitForAsync(async () => (await listItems()).length === 1, 'the chosen item');
    expect((await listItems())[0].productId).toBe('almond');
  });

  it('can be dismissed', async () => {
    const app = await openList();
    await type(bar(app), 'xyzzy');
    await press(bar(app), 'Enter');
    await waitFor(() => app.querySelector('.notfound'), 'the notice');

    await click(byText(app, 'button', 'Dismiss'));

    expect(app.querySelector('.notfound')).toBeNull();
    expect(await liveProducts()).toHaveLength(2);
  });

  it('puts an existing product on the list if the new one turns out to be a duplicate', async () => {
    await seedProduct('milk-ov', 'Milk', { brand: 'Organic Valley', packageSize: '1 gal' });
    const app = await openList();
    // A name that matches nothing, but which the user then completes into an existing product.
    await type(bar(app), 'zzz');
    await press(bar(app), 'Enter');
    await click(await waitFor(() => byText(app, 'button', 'Add as new product'), 'the button'));
    await waitFor(() => app.querySelector('#pf-name'), 'the form');
    await type(app.querySelector('#pf-name'), 'Milk');
    await type(app.querySelector('#pf-brand'), 'Organic Valley');
    await type(app.querySelector('#pf-size'), '1 gal');

    await submit(app.querySelector('form'));

    await click(await waitFor(() => byText(app, 'button', 'Add that one instead'), 'the duplicate offer'));

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    expect((await listItems())[0].productId).toBe('milk-ov');
    // No second Organic Valley milk was made.
    expect((await liveProducts()).filter(p => p.brand === 'Organic Valley')).toHaveLength(1);
  });
});

describe('voice input follows the same rule', () => {
  it('adds what matches and reports what does not', async () => {
    await seedProduct('milk', 'Milk');
    await stubSpeech('milk and xyzzy');
    const app = await openList();

    await click(app.querySelector('.shop-mic-btn'));

    await waitForAsync(async () => (await listItems()).length === 1, 'the matched item');
    expect((await listItems())[0].productId).toBe('milk');
    const notice = await waitFor(() => app.querySelector('.notfound'), 'the notice');
    expect(notice.textContent).toContain('xyzzy');
    expect(await liveProducts()).toHaveLength(1);
  });
});

describe('"Add again" chips resolve to the catalog too', () => {
  const history = (name) => ({
    name, unit: '', category: 'dairy', estimatedPrice: null, barcode: '', count: 3,
    lastBought: iso(), updatedAt: iso(), deletedAt: null,
  });

  it('adds the product behind a chip', async () => {
    await seedProduct('eggs', 'Eggs');
    await db.shoppingHistory.put(history('Eggs'));
    const app = await openList();

    await click(await waitFor(() => byText(app, '.shop-pills .shop-pill', 'Eggs'), 'the chip'));

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    expect((await listItems())[0].productId).toBe('eggs');
  });

  it('says "Product not found" for a chip whose product was deleted, rather than recreating it', async () => {
    await seedProduct('eggs', 'Eggs', { deletedAt: iso() });
    await db.shoppingHistory.put(history('Eggs'));
    const app = await openList();

    await click(await waitFor(() => byText(app, '.shop-pills .shop-pill', 'Eggs'), 'the chip'));

    await waitFor(() => app.querySelector('.notfound'), 'the notice');
    expect(await listItems()).toHaveLength(0);
    expect(await liveProducts()).toHaveLength(0);
  });
});

describe('scanning a barcode', () => {
  const stubOff = (product) => vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/api/v2/product/')) {
      return { ok: true, status: 200, json: async () => (product ? { status: 1, product } : { status: 0 }) };
    }
    return { ok: false, status: 500 };
  }));

  async function openScanner(app) {
    await click(byText(app, 'button', 'Scan Item'));
    return waitFor(() => app.querySelector('.scan-dialog'), 'the scanner');
  }

  async function scanManually(scanner, code) {
    await type(scanner.querySelector('input.form-input'), code);
    await click(byText(scanner, 'button', 'Look Up'));
  }

  it('adds the product that owns a known barcode', async () => {
    await seedProduct('milk', 'Milk', { barcode: '041631234567', brand: 'Acme', packageSize: '1 gal' });
    const app = await openList();
    const scanner = await openScanner(app);

    await scanManually(scanner, '041631234567');

    await waitFor(() => scanner.querySelector('.scan-feed'), 'the added feed');
    expect(scanner.querySelector('.scan-feed').textContent).toContain('Milk');
    expect(scanner.querySelector('.scan-missing')).toBeNull();
    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    expect((await listItems())[0]).toMatchObject({ productId: 'milk', barcode: '041631234567' });
  });

  it('says "Product not found" for an unknown barcode, and creates nothing', async () => {
    await seedProduct('milk', 'Milk', { barcode: '041631234567' });
    const app = await openList();
    const scanner = await openScanner(app);

    await scanManually(scanner, '3017620422003');

    const missing = await waitFor(() => scanner.querySelector('.scan-missing'), 'the message');
    expect(missing.textContent).toContain('Product not found');
    expect(missing.textContent).toContain('3017620422003');
    // The scanner stays open so the next code can still be scanned.
    expect(app.querySelector('.scan-dialog')).not.toBeNull();
    expect(await listItems()).toHaveLength(0);
    expect(await liveProducts()).toHaveLength(1);
  });

  it('clears the message once a known code is scanned', async () => {
    await seedProduct('milk', 'Milk', { barcode: '041631234567' });
    const app = await openList();
    const scanner = await openScanner(app);
    await scanManually(scanner, '3017620422003');
    await waitFor(() => scanner.querySelector('.scan-missing'), 'the message');

    await scanManually(scanner, '041631234567');

    await waitFor(() => !scanner.querySelector('.scan-missing'), 'the message to clear');
    await waitFor(() => scanner.querySelector('.scan-feed'), 'the added feed');
  });

  it('opens the new-product form with the barcode filled in and looked up, then adds it', async () => {
    stubOff({ product_name: 'Nutella', brands: 'Nutella, Ferrero', quantity: '400 g e' });
    const app = await openList();
    const scanner = await openScanner(app);
    await scanManually(scanner, '3017620422003');

    await click(await waitFor(() => byText(scanner, 'button', 'Add as new product'), 'the button'));

    // The scanner closes and the form opens with the code, already looked up.
    await waitFor(() => app.querySelector('#pf-barcode'), 'the form');
    expect(app.querySelector('.scan-dialog')).toBeNull();
    expect(app.querySelector('#pf-barcode').value).toBe('3017620422003');
    await waitFor(() => app.querySelector('#pf-name').value === 'Nutella', 'the lookup to fill the form');
    expect(app.querySelector('#pf-brand').value).toBe('Nutella');
    expect(app.querySelector('.pf-check-row input').checked).toBe(true);

    await submit(app.querySelector('form'));

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    const created = (await liveProducts()).find(p => p.name === 'Nutella');
    expect(created).toMatchObject({ barcode: '3017620422003', brand: 'Nutella', packageSize: '400 g' });
    expect((await listItems())[0].productId).toBe(created.id);
    // And the next scan of that code finds it.
    const again = await openScanner(app);
    await scanManually(again, '3017620422003');
    await waitFor(() => again.querySelector('.scan-feed'), 'a recognised scan');
  });

  it('still lets you fill the form in by hand if the lookup finds nothing', async () => {
    stubOff(null);
    const app = await openList();
    const scanner = await openScanner(app);
    await scanManually(scanner, '3017620422003');
    await click(await waitFor(() => byText(scanner, 'button', 'Add as new product'), 'the button'));
    await waitFor(() => app.querySelector('#pf-barcode'), 'the form');
    await waitFor(() => /No product found/.test(app.textContent), 'the lookup result');

    await type(app.querySelector('#pf-name'), 'Mystery jar');
    await submit(app.querySelector('form'));

    await waitForAsync(async () => (await listItems()).length === 1, 'the item');
    expect((await liveProducts()).find(p => p.name === 'Mystery jar').barcode).toBe('3017620422003');
  });
});
