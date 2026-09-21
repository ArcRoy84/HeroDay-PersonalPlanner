// The item editor as the barcode scanner uses it: it opens at once with only the
// barcode, and the Open Food Facts answer arrives a moment later.
import React, { useState } from 'react';
import { act } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { EditItemModal } from './EditItemModal.jsx';
import { mount, unmountAll, click, type } from '../../test/dom.js';

const categories = [
  { id: 'other', label: 'Other', emoji: '🛒', color: '#999' },
  { id: 'dairy', label: 'Dairy', emoji: '🥛', color: '#5DCAA5' },
];

const draft = {
  id: null, name: '', category: 'other', qty: 1, unit: '', storeLocation: '', note: '',
  estimatedPrice: null, barcode: '3017620422003',
};

const FOUND = {
  name: 'Nutella', brand: 'Ferrero', packageSize: '400 g', category: 'dairy',
  photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==', photoFailed: false,
};

// A harness that lets the test deliver the lookup result after mount, as the
// scanner does.
let deliver;
function Harness({ onSave, initialLookup = { status: 'loading' } }) {
  const [state, setState] = useState({ prefill: null, lookup: initialLookup });
  deliver = next => setState(next);
  return (
    <EditItemModal item={draft} isNew categories={categories} units={[]}
      prefill={state.prefill} lookup={state.lookup} onSave={onSave} onClose={() => {}} />
  );
}

const nameInput = root => root.querySelector('input[placeholder="e.g. Organic Whole Milk"]');
const categorySelect = root => root.querySelector('select.shop-cat-select');
const saveButton = root => [...root.querySelectorAll('button')].find(b => b.textContent.includes('Add to List'));

afterEach(async () => { await unmountAll(); document.body.innerHTML = ''; });

describe('EditItemModal filled in by a barcode lookup', () => {
  it('shows that it is looking, then fills the empty name and category', async () => {
    const root = await mount(<Harness onSave={vi.fn()} />);
    expect(root.textContent).toContain('Looking this barcode up');
    expect(nameInput(root).value).toBe('');

    await act(async () => { deliver({ prefill: FOUND, lookup: { status: 'done', prefill: FOUND } }); });

    expect(nameInput(root).value).toBe('Nutella');
    expect(categorySelect(root).value).toBe('dairy');
    expect(root.textContent).toContain('Filled in from Open Food Facts');
  });

  it('does not overwrite a name typed while the lookup was in flight', async () => {
    const root = await mount(<Harness onSave={vi.fn()} />);
    await type(nameInput(root), 'My spread');

    await act(async () => { deliver({ prefill: FOUND, lookup: { status: 'done', prefill: FOUND } }); });

    expect(nameInput(root).value).toBe('My spread');
    // The category was left alone too: the user has clearly started deciding.
    expect(categorySelect(root).value).toBe('other');
  });

  it('carries the brand, size and photo to the product when the name is unchanged', async () => {
    const onSave = vi.fn();
    const root = await mount(<Harness onSave={onSave} />);
    await act(async () => { deliver({ prefill: FOUND, lookup: { status: 'done', prefill: FOUND } }); });

    await click(saveButton(root));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Nutella', brand: 'Ferrero', packageSize: '400 g', photo: FOUND.photo, barcode: '3017620422003',
    });
  });

  it('carries them when the user retyped the same name in different case', async () => {
    const onSave = vi.fn();
    const root = await mount(<Harness onSave={onSave} />);
    await act(async () => { deliver({ prefill: FOUND, lookup: { status: 'done', prefill: FOUND } }); });
    await type(nameInput(root), '  NUTELLA ');

    await click(saveButton(root));

    expect(onSave.mock.calls[0][0]).toMatchObject({ brand: 'Ferrero' });
  });

  it('does not attach that product\'s details to a differently named item', async () => {
    const onSave = vi.fn();
    const root = await mount(<Harness onSave={onSave} />);
    await act(async () => { deliver({ prefill: FOUND, lookup: { status: 'done', prefill: FOUND } }); });
    // The user decided this is something else entirely.
    await type(nameInput(root), 'Peanut butter');

    await click(saveButton(root));

    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('Peanut butter');
    expect(saved.brand).toBeUndefined();
    expect(saved.photo).toBeUndefined();
  });

  it('saves normally with no brand or photo when the lookup found nothing', async () => {
    const onSave = vi.fn();
    const root = await mount(<Harness onSave={onSave} initialLookup={{ status: 'empty' }} />);
    expect(root.textContent).toContain('does not know this barcode');
    await type(nameInput(root), 'Mystery item');

    await click(saveButton(root));

    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({ name: 'Mystery item', barcode: '3017620422003' });
    expect(saved.brand).toBeUndefined();
  });

  it('reports a failed lookup without blocking the form', async () => {
    const root = await mount(
      <Harness onSave={vi.fn()} initialLookup={{ status: 'error', message: 'Barcode lookup failed (503).' }} />,
    );
    expect(root.querySelector('[role="alert"]').textContent).toContain('503');
    expect(saveButton(root)).not.toBeNull();
  });

  it('mentions a photo that could not be downloaded', async () => {
    const root = await mount(<Harness onSave={vi.fn()} />);
    const noPhoto = { ...FOUND, photo: null, photoFailed: true };

    await act(async () => { deliver({ prefill: noPhoto, lookup: { status: 'done', prefill: noPhoto } }); });

    expect(root.textContent).toContain('photo could not be downloaded');
  });
});
