// The phone layout: bottom tab bar, waffle menu, and the Shopping section strip.
//
// jsdom has no layout engine, so these tests cannot judge how anything looks.
// What they can pin down is the wiring: that the phone-only controls exist on a
// phone, do what they say, and are absent on a desktop.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from './App.jsx';
import { db } from './db/schema';
import { resetBootForTests } from './db/boot';
import { mount, unmountAll, click, waitFor, byText } from './test/dom.js';

/** Makes `matchMedia` answer the phone breakpoint with `matches`. */
function stubScreen(matches) {
  const matchMedia = (query) => ({
    matches: matches && query.includes('max-width: 600px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal('matchMedia', matchMedia);
  window.matchMedia = matchMedia;
}

async function freshDatabase(view) {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
  resetBootForTests();
  localStorage.clear();
  localStorage.setItem('mtp_view', JSON.stringify(view));
}

const tabBar = (app) => app.querySelector('.m-tabbar');
const tab = (app, label) => byText(tabBar(app), 'button', label);
const waffleButton = (app) => app.querySelector('.header-waffle');
const waffle = (app) => app.querySelector('.m-waffle');
const subnav = (app) => app.querySelector('.shop-subnav');
const sectionTitle = (app) => app.querySelector('.shop-center-title')?.textContent;

async function openApp(view = 'checklist') {
  await freshDatabase(view);
  const app = await mount(<App />);
  await waitFor(() => app.querySelector('.header'), 'the header');
  return app;
}

beforeEach(() => {
  globalThis.Notification = { permission: 'denied' };
});

afterEach(async () => {
  await unmountAll();
  vi.unstubAllGlobals();
  delete window.matchMedia;
  document.documentElement.removeAttribute('data-store-mode');
  document.body.innerHTML = '';
});

describe('on a desktop screen', () => {
  it('has none of the phone-only controls', async () => {
    stubScreen(false);
    const app = await openApp();

    expect(tabBar(app)).toBeNull();
    expect(waffleButton(app)).toBeNull();
    expect(app.querySelector('.header-nav')).not.toBeNull();
  });

  it('has none of them where matchMedia does not exist at all', async () => {
    const app = await openApp();
    expect(tabBar(app)).toBeNull();
    expect(waffleButton(app)).toBeNull();
  });

  it('keeps the shopping section panel instead of the phone strip', async () => {
    stubScreen(false);
    const app = await openApp('shop');
    await waitFor(() => app.querySelector('.shop-shell'), 'the shopping view');

    expect(subnav(app)).toBeNull();
    expect(app.querySelector('.shop-more-btn')).toBeNull();
    expect(app.querySelector('.shop-list-chip--new')).toBeNull();
  });
});

describe('the bottom tab bar', () => {
  it('lists the five areas and marks the current one', async () => {
    stubScreen(true);
    const app = await openApp();

    const labels = [...tabBar(app).querySelectorAll('button')].map(b => b.textContent);
    expect(labels).toEqual(['Checklist', 'Timeline', 'Review', 'Learning', 'Shopping']);
    expect(tab(app, 'Checklist').getAttribute('aria-current')).toBe('page');
    expect(tab(app, 'Timeline').getAttribute('aria-current')).toBeNull();
  });

  it('switches area when a tab is tapped', async () => {
    stubScreen(true);
    const app = await openApp();

    await click(tab(app, 'Timeline'));
    await waitFor(() => app.querySelector('.tl2-view'), 'the timeline');
    expect(tab(app, 'Timeline').getAttribute('aria-current')).toBe('page');

    await click(tab(app, 'Shopping'));
    await waitFor(() => app.querySelector('.shop-shell'), 'the shopping view');
    expect(tab(app, 'Shopping').getAttribute('aria-current')).toBe('page');
  });
});

describe('the waffle menu', () => {
  it('opens from the header and groups every destination', async () => {
    stubScreen(true);
    const app = await openApp();
    expect(waffle(app)).toBeNull();

    await click(waffleButton(app));
    await waitFor(() => waffle(app), 'the waffle menu');

    const headings = [...waffle(app).querySelectorAll('.m-waffle-heading')].map(h => h.textContent);
    expect(headings).toEqual(['Planner', 'Shopping', 'App']);
    const tiles = [...waffle(app).querySelectorAll('.m-waffle-tile')].map(t => t.textContent);
    expect(tiles).toEqual([
      'Checklist', 'Timeline', 'Review', 'Learning',
      'My List', 'Recipes', 'Budget', 'Items', 'Stores',
      'Settings',
    ]);
  });

  it('jumps straight to a Shopping section and closes', async () => {
    stubScreen(true);
    const app = await openApp();

    await click(waffleButton(app));
    await click(byText(waffle(app), 'button', 'Items'));

    await waitFor(() => sectionTitle(app) === 'Items', 'the Items section');
    expect(waffle(app)).toBeNull();
    expect(tab(app, 'Shopping').getAttribute('aria-current')).toBe('page');
  });

  it('opens Settings', async () => {
    stubScreen(true);
    const app = await openApp();

    await click(waffleButton(app));
    await click(byText(waffle(app), 'button', 'Settings'));

    await waitFor(() => app.querySelector('.settings-modal'), 'the settings dialog');
    expect(waffle(app)).toBeNull();
  });

  it('closes when the backdrop is tapped', async () => {
    stubScreen(true);
    const app = await openApp();

    await click(waffleButton(app));
    await click(app.querySelector('.m-waffle-backdrop'));
    expect(waffle(app)).toBeNull();
  });
});

describe('Shopping on a phone', () => {
  it('shows the sections as a strip and switches between them', async () => {
    stubScreen(true);
    const app = await openApp('shop');
    await waitFor(() => subnav(app), 'the section strip');

    const labels = [...subnav(app).querySelectorAll('button')].map(b => b.textContent);
    expect(labels).toEqual(['My List', 'Recipes', 'Budget', 'Items', 'Stores']);

    await click(byText(subnav(app), 'button', 'Stores'));
    await waitFor(() => sectionTitle(app) === 'Stores', 'the Stores section');
    expect(byText(subnav(app), 'button', 'Stores').getAttribute('aria-current')).toBe('page');
  });

  it('has a New chip that opens the new-list dialog', async () => {
    stubScreen(true);
    const app = await openApp('shop');
    await waitFor(() => app.querySelector('.shop-list-chip--new'), 'the New chip');

    await click(app.querySelector('.shop-list-chip--new'));
    await waitFor(() => app.querySelector('.shop-overlay'), 'the new-list dialog');
  });

  it('tucks the list tools behind More', async () => {
    stubScreen(true);
    const app = await openApp('shop');
    const more = await waitFor(() => app.querySelector('.shop-more-btn'), 'the More button');
    const tools = app.querySelector('.shop-list-secondary-actions');

    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(tools.classList.contains('is-open')).toBe(false);

    await click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(tools.classList.contains('is-open')).toBe(true);
    expect(byText(tools, 'button', 'Categories')).not.toBeNull();
  });

  it('asks the stylesheet to hide the tab bar during Store Mode', async () => {
    stubScreen(true);
    const app = await openApp('shop');
    const storeMode = await waitFor(() => byText(app, 'button', 'Store Mode'), 'the Store Mode button');

    expect(document.documentElement.hasAttribute('data-store-mode')).toBe(false);
    await click(storeMode);
    await waitFor(() => document.documentElement.hasAttribute('data-store-mode'), 'the store mode flag');
  });
});

describe('the timeline on a phone', () => {
  it('opens a task when its card is tapped', async () => {
    stubScreen(true);
    const app = await openApp('timeline');
    const card = await waitFor(() => app.querySelector('.tl-card'), 'a task card');

    await click(card);
    await waitFor(() => app.querySelector('.modal'), 'the task form');
    expect(app.querySelector('.modal-title').textContent).toMatch(/edit task/i);
  });

  it('leaves a card alone on a desktop, where it is dragged', async () => {
    stubScreen(false);
    const app = await openApp('timeline');
    const card = await waitFor(() => app.querySelector('.tl-card'), 'a task card');

    await click(card);
    expect(app.querySelector('.modal')).toBeNull();
  });
});
