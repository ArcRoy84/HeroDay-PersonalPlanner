// Create/edit form for one product.
import React, { useState, useEffect, useRef } from 'react';
import { IconX, IconTrash, IconBarcode } from './icons.jsx';
import { ProductThumb } from './productParts.jsx';
import { resizeImage } from './parsing.js';
import { DuplicateProductError } from '../../db/productOps';

// A product photo is shown at most ~100px, so 320px is sharp on a 2x display
// without bloating the database or a backup file.
const PHOTO_MAX_PX = 320;
// Refuse absurd files before decoding one into a canvas.
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

function initialFields(product, categories, initial) {
  const suggested = initial?.category && categories.some(c => c.id === initial.category)
    ? initial.category
    : undefined;
  return {
    name:        product?.name ?? initial?.name ?? '',
    category:    product?.category ?? suggested ?? categories[0]?.id ?? 'other',
    brand:       product?.brand ?? '',
    packageSize: product?.packageSize ?? '',
    barcode:     product?.barcode ?? initial?.barcode ?? '',
    photo:       product?.photo ?? null,
    notes:       product?.notes ?? '',
  };
}

/**
 * `initial` pre-fills a new product ({ name, barcode, category }) — used when the
 * list found something it could not place, or the scanner met an unknown code.
 * `defaultAddToList` ticks "also add it to a list", and `autoLookup` runs the
 * barcode lookup as soon as the form opens (the barcode was just scanned).
 * `existingLabel` names the button offered when the product already exists.
 *
 * `product` is null when creating. `onSave(input, { addToListId })` may reject;
 * the message is shown here instead of being lost. `onLookup(barcode)` is
 * optional: when given, a Look up button fills the form from a barcode.
 */
function ProductFormModal({
  product, categories, lists, defaultListId,
  initial, defaultAddToList = false, autoLookup = false, existingLabel = 'Open it',
  onSave, onOpenExisting, onLookup, onClose,
}) {
  const isNew = !product;
  const [fields, setFields] = useState(() => initialFields(product, categories, initial));
  const [addToList, setAddToList] = useState(defaultAddToList);
  const [listId, setListId] = useState(defaultListId ?? lists[0]?.id ?? '');
  const [error, setError] = useState('');
  const [duplicateId, setDuplicateId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lookup, setLookup] = useState({ status: 'idle', message: '' });
  const mounted = useRef(true);
  const fileRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      mounted.current = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const set = (key, value) => setFields(f => ({ ...f, [key]: value }));
  const category = categories.find(c => c.id === fields.category);

  // A barcode that was just scanned is looked up straight away, once.
  useEffect(() => {
    if (autoLookup && onLookup && fields.barcode.trim()) handleLookup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePhotoPicked(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > PHOTO_MAX_BYTES) { setError('That image is too large (10 MB max).'); return; }
    setError('');
    try {
      set('photo', await resizeImage(file, PHOTO_MAX_PX, 0.85));
    } catch {
      setError('Could not read that image. Try a different file.');
    }
  }

  async function handleLookup() {
    if (!onLookup || !fields.barcode.trim()) return;
    setLookup({ status: 'loading', message: '' });
    try {
      const found = await onLookup(fields.barcode.trim());
      if (!mounted.current) return;
      if (!found) {
        setLookup({ status: 'empty', message: 'No product found for that barcode. You can fill it in by hand.' });
        return;
      }
      // Fill only what the lookup knows, and never overwrite what the user typed.
      setFields(f => ({
        ...f,
        name: f.name.trim() ? f.name : found.name ?? f.name,
        brand: f.brand.trim() ? f.brand : found.brand ?? f.brand,
        packageSize: f.packageSize.trim() ? f.packageSize : found.packageSize ?? f.packageSize,
        category: found.category && categories.some(c => c.id === found.category) && !product
          ? found.category : f.category,
        photo: f.photo ?? found.photo ?? null,
      }));
      setLookup({
        status: 'done',
        message: found.photoFailed
          ? 'Filled in from Open Food Facts. The photo could not be downloaded.'
          : 'Filled in from Open Food Facts. Check the details before saving.',
      });
    } catch (failure) {
      if (!mounted.current) return;
      setLookup({
        status: 'error',
        message: failure instanceof Error && failure.message
          ? failure.message
          : 'Barcode lookup failed. Check your connection and try again.',
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    if (!fields.name.trim()) { setError('Give the product a name.'); return; }

    setError('');
    setDuplicateId(null);
    setSaving(true);
    try {
      await onSave({ ...fields }, { addToListId: isNew && addToList && listId ? listId : undefined });
      // The parent closes the modal on success.
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof DuplicateProductError) setDuplicateId(failure.existingId);
      setError(failure instanceof Error ? failure.message : 'Could not save the product.');
      setSaving(false);
    }
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <form className="shop-dialog shop-dialog--lg" onSubmit={handleSubmit} noValidate
        aria-label={isNew ? 'Add item' : 'Edit item'}>
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{isNew ? 'Add Item' : 'Edit Item'}</h4>
          <button type="button" className="sic-act" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        <div className="shop-dialog-body">
          <div className="store-identity">
            <div className="store-preview" aria-hidden="true">
              <ProductThumb product={{ photo: fields.photo }} category={category} size={44} />
            </div>
            <div className="shop-field store-identity-name">
              <label className="shop-field-label" htmlFor="pf-name">Item name</label>
              <input id="pf-name" className="form-input" value={fields.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Whole milk" autoFocus />
            </div>
          </div>

          <div className="shop-field">
            <label className="shop-field-label" htmlFor="pf-category">Category</label>
            <select id="pf-category" className="form-input" value={fields.category}
              onChange={e => set('category', e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </div>

          <div className="store-row store-row--2">
            <div className="shop-field">
              <label className="shop-field-label" htmlFor="pf-brand">Brand</label>
              <input id="pf-brand" className="form-input" value={fields.brand}
                onChange={e => set('brand', e.target.value)} placeholder="e.g. Organic Valley" />
            </div>
            <div className="shop-field">
              <label className="shop-field-label" htmlFor="pf-size">Package size</label>
              <input id="pf-size" className="form-input" value={fields.packageSize}
                onChange={e => set('packageSize', e.target.value)} placeholder="e.g. 1 gal, 500 g, 6-pack" />
            </div>
          </div>
          <p className="store-hint">
            Brand and size tell similar products apart, so "Milk 1 gal" and "Milk 0.5 gal" keep separate prices.
          </p>

          <div className="shop-field">
            <label className="shop-field-label" htmlFor="pf-barcode">Barcode</label>
            <div className="store-category-row">
              <input id="pf-barcode" className="form-input" inputMode="numeric" value={fields.barcode}
                onChange={e => set('barcode', e.target.value)} placeholder="e.g. 041631234567" />
              {onLookup && (
                <button type="button" className="btn-ghost sm" onClick={handleLookup}
                  disabled={!fields.barcode.trim() || lookup.status === 'loading'}
                  title="Sends only the barcode number to Open Food Facts">
                  <IconBarcode /> {lookup.status === 'loading' ? 'Looking up…' : 'Look up'}
                </button>
              )}
            </div>
            {lookup.message && (
              <p className={`store-msg ${lookup.status === 'error' ? 'store-msg--error' : ''}`}
                role={lookup.status === 'error' ? 'alert' : 'status'}>
                {lookup.message}
              </p>
            )}
            {onLookup && (
              <p className="store-hint">
                Look up fills the details from Open Food Facts. Only the barcode number is sent, and only when you click.
              </p>
            )}
          </div>

          <div className="shop-field">
            <span className="shop-field-label">Photo</span>
            <div className="store-icon-extra">
              <button type="button" className="btn-ghost sm" onClick={() => fileRef.current?.click()}>
                {fields.photo ? 'Change photo' : 'Upload photo'}
              </button>
              {fields.photo && (
                <button type="button" className="btn-ghost sm" onClick={() => set('photo', null)}>
                  <IconTrash /> Remove photo
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhotoPicked} />
            </div>
            <p className="store-hint">Optional. Without one, the category emoji is shown.</p>
          </div>

          <div className="shop-field">
            <label className="shop-field-label" htmlFor="pf-notes">Notes</label>
            <textarea id="pf-notes" className="form-input store-notes" rows={3} value={fields.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="The blue cap, best on Wednesdays, ask at the deli…" />
          </div>

          {isNew && lists.length > 0 && (
            <div className="store-check store-check--stack">
              <label className="pf-check-row">
                <input type="checkbox" checked={addToList} onChange={e => setAddToList(e.target.checked)} />
                <span>Also add it to a shopping list</span>
              </label>
              {addToList && (
                <select className="form-input pf-list-select" value={listId}
                  onChange={e => setListId(e.target.value)} aria-label="List to add to">
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
            </div>
          )}

          {error && (
            <p className="store-msg store-msg--error" role="alert">
              {error}
              {duplicateId && onOpenExisting && (
                <> <button type="button" className="link-btn" onClick={() => onOpenExisting(duplicateId)}>
                  {existingLabel}
                </button></>
              )}
            </p>
          )}
        </div>

        <div className="shop-dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving || !fields.name.trim()}>
            {saving ? 'Saving…' : isNew ? 'Add Item' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export { ProductFormModal };
