// End-to-end tests for stores: the real <App /> on a real (fake-indexeddb)
// database, driven through the DOM the way a user would.
//
// These exist because unit tests cannot catch a wiring mistake — a prop name
// that does not match, a hook result that is not passed down. Here a typo shows
// up as a store that never appears.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from './App.jsx';
import { db } from './db/schema';
import { resetBootForTests } from './db/boot';
import { act } from 'react';
import { mount, unmountAll, click, type, submit, waitFor, byText } from './test/dom.js';

const LOGO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

async function freshDatabase() {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
  resetBootForTests();
  localStorage.clear();
  // Boot migrates legacy keys; this is how a test lands on the Shopping view.
  localStorage.setItem('mtp_view', JSON.stringify('shop'));
  // Nothing to migrate, but the sample "Grocery" list is what a new user sees.
}

/** Boots the app and opens the Stores tab. */
async function openStoresTab() {
  const app = await mount(<App />);
  const nav = await waitFor(() => byText(app, 'button', 'Stores'), 'the Stores nav button');
  await click(nav);
  await waitFor(() => app.querySelector('.shop-center-title')?.textContent === 'Stores', 'the Stores tab');
  return app;
}

const field = (app, id) => app.querySelector(`#${id}`);
const chips = (app) => [...app.querySelectorAll('.shop-list-chip')];

async function addStore(app, { name, address = '', city = '', lat = '', lon = '', createList = true }) {
  const add = byText(app, 'button', 'Add store') ?? byText(app, 'button', 'Add your first store');
  await click(add);
  await waitFor(() => field(app, 'sf-name'), 'the store form');
  await type(field(app, 'sf-name'), name);
  if (address) await type(field(app, 'sf-address'), address);
  if (city) await type(field(app, 'sf-city'), city);
  if (lat) await type(app.querySelector('input[aria-label="Latitude"]'), lat);
  if (lon) await type(app.querySelector('input[aria-label="Longitude"]'), lon);
  const checkbox = app.querySelector('.store-check input');
  if (checkbox && checkbox.checked !== createList) await click(checkbox);
  await submit(app.querySelector('form'));
}

beforeEach(async () => {
  await freshDatabase();
  // jsdom has no Notification; App reads Notification.permission in an effect.
  globalThis.Notification = { permission: 'denied' };
});

afterEach(async () => {
  await unmountAll();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Stores tab', () => {
  it('shows an empty state with a way to add the first store', async () => {
    const app = await openStoresTab();

    expect(app.textContent).toContain('No stores yet');
    expect(byText(app, 'button', 'Add your first store')).not.toBeNull();
    // The sample list is still visible, under "Lists without a store".
    await waitFor(() => app.textContent.includes('Lists without a store'), 'unlinked lists');
    expect(app.textContent).toContain('Grocery');
  });

  it('adds a store, shows its card, and puts its list in the list bar', async () => {
    const app = await openStoresTab();

    await addStore(app, {
      name: 'Costco', address: '123 Main St', city: 'Springfield', lat: '39.7817', lon: '-89.6501',
    });

    const card = await waitFor(() => app.querySelector('.store-card'), 'the store card');
    expect(card.querySelector('.store-card-name').textContent).toBe('Costco');
    expect(card.textContent).toContain('123 Main St');
    expect(card.textContent).toContain('Springfield');
    const map = card.querySelector('a.store-card-map');
    expect(map.getAttribute('href')).toContain('mlat=39.7817&mlon=-89.6501');
    expect(map.getAttribute('rel')).toContain('noopener');
    // The form closed.
    expect(field(app, 'sf-name')).toBeNull();

    // It is persisted, with its list linked.
    const stored = (await db.stores.toArray())[0];
    expect(stored.name).toBe('Costco');
    const list = (await db.shoppingLists.toArray()).find(l => l.storeId === stored.id);
    expect(list.name).toBe('Costco');

    // And it appears in the list bar on the My List tab, as the active list.
    await click(byText(app, 'button', 'My List'));
    const chip = await waitFor(
      () => chips(app).find(c => c.textContent.includes('Costco')),
      'the Costco chip in the list bar',
    );
    expect(chip.classList.contains('shop-list-chip--store')).toBe(true);
    expect(chip.classList.contains('shop-list-chip--active')).toBe(true);
    expect(chip.querySelector('.store-icon')).not.toBeNull();
  });

  it('can add a store without creating a list', async () => {
    const app = await openStoresTab();

    await addStore(app, { name: 'Farmers Market', createList: false });

    await waitFor(() => app.querySelector('.store-card'), 'the store card');
    expect(await db.shoppingLists.count()).toBe(1); // only the seeded Grocery list
    expect(app.querySelector('.store-card-nolists').textContent).toContain('No shopping list yet');
  });

  it('refuses a half-filled coordinate pair and saves nothing', async () => {
    const app = await openStoresTab();

    await addStore(app, { name: 'Costco', lat: '39.78' });

    const message = await waitFor(() => app.querySelector('.store-msg--error'), 'a validation error');
    expect(message.textContent).toMatch(/both latitude and longitude/i);
    expect(await db.stores.count()).toBe(0);
    // The form is still open so the user can fix it.
    expect(field(app, 'sf-name').value).toBe('Costco');
  });

  it('refuses an out-of-range coordinate', async () => {
    const app = await openStoresTab();

    await addStore(app, { name: 'Costco', lat: '123', lon: '10' });

    const message = await waitFor(() => app.querySelector('.store-msg--error'), 'a validation error');
    expect(message.textContent).toMatch(/Latitude/);
    expect(await db.stores.count()).toBe(0);
  });

  it('keeps the submit button disabled until the store has a name', async () => {
    const app = await openStoresTab();
    await click(byText(app, 'button', 'Add your first store'));
    await waitFor(() => field(app, 'sf-name'), 'the store form');

    const save = byText(app, 'button[type="submit"]', 'Add Store');
    expect(save.disabled).toBe(true);

    await type(field(app, 'sf-name'), 'Costco');
    expect(save.disabled).toBe(false);
  });

  it('renames a store and its linked list together', async () => {
    const app = await openStoresTab();
    await addStore(app, { name: 'Costco' });
    await waitFor(() => app.querySelector('.store-card'), 'the store card');

    await click(app.querySelector('button[aria-label="Edit Costco"]'));
    await waitFor(() => field(app, 'sf-name'), 'the edit form');
    expect(field(app, 'sf-name').value).toBe('Costco');
    await type(field(app, 'sf-name'), 'Costco Wholesale');
    await submit(app.querySelector('form'));

    await waitFor(
      () => app.querySelector('.store-card-name')?.textContent === 'Costco Wholesale',
      'the renamed card',
    );
    const store = (await db.stores.toArray())[0];
    const list = (await db.shoppingLists.toArray()).find(l => l.storeId === store.id);
    expect(list.name).toBe('Costco Wholesale');
  });

  it('deletes a store but keeps its shopping list', async () => {
    const app = await openStoresTab();
    await addStore(app, { name: 'Costco' });
    await waitFor(() => app.querySelector('.store-card'), 'the store card');

    await click(app.querySelector('button[aria-label="Delete Costco"]'));
    await click(await waitFor(() => byText(app, 'button', 'Delete store'), 'the confirm button'));

    await waitFor(() => !app.querySelector('.store-card'), 'the card to disappear');
    // The list survives as a plain list, so it now shows under "no store".
    await waitFor(() => app.textContent.includes('Lists without a store'), 'the unlinked section');
    const lists = (await db.shoppingLists.toArray()).filter(l => !l.deletedAt);
    expect(lists.map(l => l.name).sort()).toEqual(['Costco', 'Grocery']);
    expect(lists.every(l => l.storeId === null)).toBe(true);
  });

  it('links an existing list to a store from the Stores tab', async () => {
    const app = await openStoresTab();
    await addStore(app, { name: 'Trader Joes', createList: false });
    await waitFor(() => app.querySelector('.store-card'), 'the store card');

    const select = await waitFor(() => app.querySelector('.shop-store-card select'), 'the link select');
    const store = (await db.stores.toArray())[0];
    await type(select, store.id);

    await waitFor(() => app.querySelector('.store-list-chip'), 'the linked list chip');
    expect(app.querySelector('.store-list-chip-name').textContent).toBe('Grocery');
    expect((await db.shoppingLists.get('default')).storeId).toBe(store.id);
  });
});

describe('store form', () => {
  it('follows the category for the icon until the user picks one', async () => {
    const app = await openStoresTab();
    await click(byText(app, 'button', 'Add your first store'));
    await waitFor(() => field(app, 'sf-category'), 'the category select');

    await type(field(app, 'sf-category'), 'bakery');
    expect(app.querySelector('.store-emoji-input').value).toBe('🥖');

    // Once the user chooses an emoji, changing category must not override it.
    await click([...app.querySelectorAll('.store-emoji-btn')]
      .find(b => b.getAttribute('aria-label') === 'Use 🍎'));
    await type(field(app, 'sf-category'), 'pharmacy');
    expect(app.querySelector('.store-emoji-input').value).toBe('🍎');
  });

  it('looks up coordinates from the address only when asked, and applies a pick', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '39.781700', lon: '-89.650100', display_name: '123 Main St, Springfield, Illinois' }],
    });
    vi.stubGlobal('fetch', fetchSpy);

    const app = await openStoresTab();
    await click(byText(app, 'button', 'Add your first store'));
    await waitFor(() => field(app, 'sf-name'), 'the store form');

    const lookup = byText(app, 'button', 'Look up from address');
    // Nothing to look up yet, so the button is off and nothing has been sent.
    expect(lookup.disabled).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    await type(field(app, 'sf-address'), '123 Main St');
    await type(field(app, 'sf-city'), 'Springfield');
    expect(lookup.disabled).toBe(false);
    // Typing an address alone never triggers a request.
    expect(fetchSpy).not.toHaveBeenCalled();

    await click(lookup);
    const match = await waitFor(() => app.querySelector('.store-match'), 'a lookup match');
    expect(match.textContent).toContain('123 Main St, Springfield, Illinois');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('street=123+Main+St');

    await click(match);
    expect(app.querySelector('input[aria-label="Latitude"]').value).toBe('39.7817');
    expect(app.querySelector('input[aria-label="Longitude"]').value).toBe('-89.6501');
    expect(app.querySelector('.store-match')).toBeNull();
  });

  it('shows a readable message when the lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const app = await openStoresTab();
    await click(byText(app, 'button', 'Add your first store'));
    await waitFor(() => field(app, 'sf-city'), 'the store form');
    await type(field(app, 'sf-city'), 'Springfield');

    await click(byText(app, 'button', 'Look up from address'));

    const message = await waitFor(() => app.querySelector('.store-msg--error'), 'the error message');
    expect(message.textContent).toContain('Failed to fetch');
  });

  it('reports a location failure instead of hanging', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    const app = await openStoresTab();
    await click(byText(app, 'button', 'Add your first store'));
    await waitFor(() => field(app, 'sf-name'), 'the store form');

    await click(byText(app, 'button', 'Use my location'));

    const message = await waitFor(() => app.querySelector('.store-msg--error'), 'the location error');
    expect(message.textContent).toMatch(/secure connection/i);
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });

  it('closes on Escape, but not while the category manager is open on top of it', async () => {
    const app = await openStoresTab();
    await click(byText(app, 'button', 'Add your first store'));
    await waitFor(() => field(app, 'sf-name'), 'the store form');
    await type(field(app, 'sf-name'), 'Half typed');

    await click(byText(app, 'button', 'Edit categories'));
    await waitFor(() => byText(app, '.shop-dialog-title', 'Store Categories'), 'the category manager');

    await act_keydown('Escape');
    // The form and what was typed into it survive.
    expect(field(app, 'sf-name').value).toBe('Half typed');
  });

  it('edits store categories, and cannot delete Other', async () => {
    const app = await openStoresTab();
    await click(byText(app, 'button', 'Categories'));
    await waitFor(() => byText(app, '.shop-dialog-title', 'Store Categories'), 'the category manager');

    // Open Other for editing: it must offer no delete button.
    const other = byText(app, '.scat-item', 'Other');
    await click(other.querySelector('.scat-edit-btn'));
    expect(other.querySelector('.sic-act--del')).toBeNull();

    // A normal category can be edited and is deletable.
    const pharmacy = byText(app, '.scat-item', 'Pharmacy');
    await click(pharmacy.querySelector('.scat-edit-btn'));
    expect(pharmacy.querySelector('.sic-act--del')).not.toBeNull();
  });
});

describe('logos', () => {
  it('shows an uploaded logo instead of the emoji', async () => {
    const app = await openStoresTab();
    await act(async () => {
      await db.stores.put({
        id: 's1', name: 'Costco', icon: '📦', logo: LOGO, categoryId: 'warehouse',
        address: '', city: '', region: '', postalCode: '', country: '', lat: null, lon: null,
        hours: '', notes: '', createdAt: 'x', updatedAt: 'x', deletedAt: null,
      });
    });

    const img = await waitFor(() => app.querySelector('.store-card img'), 'the logo image');
    expect(img.getAttribute('src')).toBe(LOGO);
  });

  it('never renders a remote or script logo URL, even if one is in the database', async () => {
    const app = await openStoresTab();
    // Bypasses the write path on purpose, as an imported backup could.
    await act(async () => {
      await db.stores.put({
        id: 's1', name: 'Sneaky', icon: '🕵️', logo: 'https://evil.example/pixel.png', categoryId: 'other',
        address: '', city: '', region: '', postalCode: '', country: '', lat: null, lon: null,
        hours: '', notes: '', createdAt: 'x', updatedAt: 'x', deletedAt: null,
      });
    });

    await waitFor(() => app.querySelector('.store-card'), 'the store card');
    expect(app.querySelector('.store-card img')).toBeNull();
    expect(app.querySelector('.store-card .store-icon').textContent).toBe('🕵️');
  });
});

/** Presses a key at the window, as the browser would for an open dialog. */
async function act_keydown(key) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}
