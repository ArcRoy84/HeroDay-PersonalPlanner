// Create/edit form for one store.
import React, { useState, useEffect, useRef } from 'react';
import { IconX, IconLocation, IconTrash } from './icons.jsx';
import { StoreIcon } from './stores.jsx';
import { resizeImage } from './parsing.js';
import { STORE_EMOJIS } from '../../data/storeCategories.js';
import {
  checkCoordinates, canGeocode, geocodeAddress, getCurrentCoordinates,
  LocateFailure, LOCATE_MESSAGES,
} from '../../utils/geo';

// Logos are tiny by nature; 160px is sharp on a 2x display at card size.
const LOGO_MAX_PX = 160;
// Refuse absurd files before decoding one into a canvas.
const LOGO_MAX_BYTES = 10 * 1024 * 1024;

function initialFields(store, categories) {
  const fallbackCategory = categories[0];
  return {
    name:       store?.name ?? '',
    icon:       store?.icon ?? fallbackCategory?.emoji ?? '🏪',
    logo:       store?.logo ?? null,
    categoryId: store?.categoryId ?? fallbackCategory?.id ?? 'other',
    address:    store?.address ?? '',
    city:       store?.city ?? '',
    region:     store?.region ?? '',
    postalCode: store?.postalCode ?? '',
    country:    store?.country ?? '',
    // Coordinates are edited as text so a half-typed "-" is not an error.
    lat:        store?.lat != null ? String(store.lat) : '',
    lon:        store?.lon != null ? String(store.lon) : '',
    hours:      store?.hours ?? '',
    notes:      store?.notes ?? '',
  };
}

/**
 * `store` is null when creating. `onSave(input, { createList })` may reject;
 * the message is shown in the form instead of being lost.
 */
function StoreFormModal({ store, categories, onSave, onManageCategories, onClose, escapeDisabled = false }) {
  const isNew = !store;
  const [fields, setFields] = useState(() => initialFields(store, categories));
  // While the user has not picked an icon themselves, it follows the category.
  const [iconTouched, setIconTouched] = useState(!isNew);
  const [createList, setCreateList] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState('');
  const [lookup, setLookup] = useState({ status: 'idle', matches: [], message: '' });
  // A lookup that finishes after the modal closed, or after a newer one started,
  // must not write into state.
  const lookupRun = useRef(0);
  const mounted = useRef(true);
  const fileRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    // Another dialog (the category manager) can be open on top of this one; it
    // owns Escape while it is, or closing it would also discard this form.
    const onKey = (e) => { if (e.key === 'Escape' && !escapeDisabled) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      mounted.current = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, escapeDisabled]);

  const set = (key, value) => setFields(f => ({ ...f, [key]: value }));
  const category = categories.find(c => c.id === fields.categoryId);

  // Categories can be edited from inside this form. If the selected one was
  // just deleted, fall back to the first that exists.
  useEffect(() => {
    if (!categories.some(c => c.id === fields.categoryId) && categories[0]) {
      setFields(f => ({
        ...f,
        categoryId: categories[0].id,
        icon: iconTouched ? f.icon : categories[0].emoji,
      }));
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeCategory(id) {
    const next = categories.find(c => c.id === id);
    setFields(f => ({
      ...f,
      categoryId: id,
      icon: iconTouched || !next ? f.icon : next.emoji,
    }));
  }

  function pickEmoji(emoji) {
    setIconTouched(true);
    setFields(f => ({ ...f, icon: emoji }));
  }

  async function handleLogoPicked(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > LOGO_MAX_BYTES) { setError('That image is too large (10 MB max).'); return; }
    setError('');
    try {
      set('logo', await resizeImage(file, LOGO_MAX_PX, 0.85));
    } catch {
      setError('Could not read that image. Try a different file.');
    }
  }

  async function handleUseMyLocation() {
    setLocateMsg('');
    setLocating(true);
    try {
      const { lat, lon } = await getCurrentCoordinates();
      if (!mounted.current) return;
      setFields(f => ({ ...f, lat: String(lat), lon: String(lon) }));
      setLookup({ status: 'idle', matches: [], message: '' });
    } catch (failure) {
      if (!mounted.current) return;
      setLocateMsg(failure instanceof LocateFailure
        ? LOCATE_MESSAGES[failure.reason]
        : LOCATE_MESSAGES.unavailable);
    } finally {
      if (mounted.current) setLocating(false);
    }
  }

  async function handleLookup() {
    const run = ++lookupRun.current;
    setLookup({ status: 'loading', matches: [], message: '' });
    try {
      const matches = await geocodeAddress(fields);
      if (!mounted.current || run !== lookupRun.current) return;
      setLookup(matches.length
        ? { status: 'done', matches, message: '' }
        : {
          status: 'empty', matches: [],
          message: 'No match found. Adding a postal code or country usually helps.',
        });
    } catch (failure) {
      if (!mounted.current || run !== lookupRun.current) return;
      setLookup({
        status: 'error', matches: [],
        message: failure instanceof Error && failure.message
          ? failure.message
          : 'Address lookup failed. Check your connection and try again.',
      });
    }
  }

  function applyMatch(match) {
    setFields(f => ({ ...f, lat: String(match.lat), lon: String(match.lon) }));
    setLookup({ status: 'idle', matches: [], message: '' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    if (!fields.name.trim()) { setError('Give the store a name.'); return; }
    const coords = checkCoordinates(fields.lat, fields.lon);
    if (!coords.ok) { setError(coords.error); return; }

    setError('');
    setSaving(true);
    try {
      await onSave({
        name: fields.name,
        icon: fields.icon,
        logo: fields.logo,
        categoryId: fields.categoryId,
        address: fields.address,
        city: fields.city,
        region: fields.region,
        postalCode: fields.postalCode,
        country: fields.country,
        lat: coords.lat,
        lon: coords.lon,
        hours: fields.hours,
        notes: fields.notes,
      }, { createList: isNew && createList });
      // The parent closes the modal on success.
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure instanceof Error ? failure.message : 'Could not save the store.');
      setSaving(false);
    }
  }

  const previewStore = { name: fields.name, icon: fields.icon, logo: fields.logo };

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <form className="shop-dialog shop-dialog--lg" onSubmit={handleSubmit} noValidate
        aria-label={isNew ? 'Add store' : 'Edit store'}>
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{isNew ? 'Add Store' : 'Edit Store'}</h4>
          <button type="button" className="sic-act" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        <div className="shop-dialog-body">
          {/* Identity: preview, name, category */}
          <div className="store-identity">
            <div className="store-preview" aria-hidden="true">
              <StoreIcon store={previewStore} size={44} />
            </div>
            <div className="shop-field store-identity-name">
              <label className="shop-field-label" htmlFor="sf-name">Store name</label>
              <input id="sf-name" className="form-input" value={fields.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Costco, Panadería López…" autoFocus />
            </div>
          </div>

          <div className="shop-field">
            <label className="shop-field-label" htmlFor="sf-category">Category</label>
            <div className="store-category-row">
              <select id="sf-category" className="form-input" value={fields.categoryId}
                onChange={e => changeCategory(e.target.value)}>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <button type="button" className="btn-ghost sm" onClick={onManageCategories}>
                Edit categories
              </button>
            </div>
          </div>

          {/* Icon: emoji, or an uploaded logo */}
          <div className="shop-field">
            <span className="shop-field-label">Icon</span>
            <div className="store-emoji-grid" role="group" aria-label="Choose an emoji">
              {STORE_EMOJIS.map(emoji => (
                <button key={emoji} type="button"
                  className={`store-emoji-btn ${!fields.logo && fields.icon === emoji ? 'store-emoji-btn--on' : ''}`}
                  onClick={() => pickEmoji(emoji)} aria-label={`Use ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>
            <div className="store-icon-extra">
              <input className="form-input store-emoji-input" value={fields.icon} maxLength={8}
                onChange={e => pickEmoji(e.target.value)} aria-label="Custom emoji"
                title="Or type any emoji" />
              <button type="button" className="btn-ghost sm" onClick={() => fileRef.current?.click()}>
                {fields.logo ? 'Change logo' : 'Upload logo'}
              </button>
              {fields.logo && (
                <button type="button" className="btn-ghost sm" onClick={() => set('logo', null)}>
                  <IconTrash /> Remove logo
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleLogoPicked} />
            </div>
            <p className="store-hint">
              {fields.logo
                ? 'The logo is shown instead of the emoji.'
                : 'Optional: upload a logo to use instead of an emoji.'}
            </p>
          </div>

          {/* Address */}
          <div className="shop-field">
            <label className="shop-field-label" htmlFor="sf-address">Address</label>
            <input id="sf-address" className="form-input" value={fields.address}
              onChange={e => set('address', e.target.value)} placeholder="Street and number" />
          </div>

          <div className="store-row store-row--2">
            <div className="shop-field">
              <label className="shop-field-label" htmlFor="sf-city">City</label>
              <input id="sf-city" className="form-input" value={fields.city}
                onChange={e => set('city', e.target.value)} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label" htmlFor="sf-region">State / region</label>
              <input id="sf-region" className="form-input" value={fields.region}
                onChange={e => set('region', e.target.value)} />
            </div>
          </div>

          <div className="store-row store-row--2">
            <div className="shop-field">
              <label className="shop-field-label" htmlFor="sf-postal">Postal code</label>
              <input id="sf-postal" className="form-input" value={fields.postalCode}
                onChange={e => set('postalCode', e.target.value)} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label" htmlFor="sf-country">Country</label>
              <input id="sf-country" className="form-input" value={fields.country}
                onChange={e => set('country', e.target.value)} />
            </div>
          </div>

          {/* Coordinates */}
          <div className="shop-field">
            <span className="shop-field-label">Coordinates</span>
            <div className="store-row store-row--2">
              <input className="form-input" inputMode="decimal" value={fields.lat}
                onChange={e => set('lat', e.target.value)} placeholder="Latitude, e.g. 39.7817"
                aria-label="Latitude" />
              <input className="form-input" inputMode="decimal" value={fields.lon}
                onChange={e => set('lon', e.target.value)} placeholder="Longitude, e.g. -89.6501"
                aria-label="Longitude" />
            </div>
            <div className="store-geo-actions">
              <button type="button" className="btn-ghost sm" onClick={handleUseMyLocation}
                disabled={locating}>
                <IconLocation /> {locating ? 'Locating…' : 'Use my location'}
              </button>
              <button type="button" className="btn-ghost sm" onClick={handleLookup}
                disabled={!canGeocode(fields) || lookup.status === 'loading'}
                title="Sends the address above to OpenStreetMap to find its coordinates">
                {lookup.status === 'loading' ? 'Looking up…' : 'Look up from address'}
              </button>
            </div>
            {locateMsg && <p className="store-msg store-msg--error" role="alert">{locateMsg}</p>}
            {lookup.message && (
              <p className={`store-msg ${lookup.status === 'error' ? 'store-msg--error' : ''}`}
                role={lookup.status === 'error' ? 'alert' : 'status'}>
                {lookup.message}
              </p>
            )}
            {lookup.matches.length > 0 && (
              <ul className="store-matches" aria-label="Address matches">
                {lookup.matches.map(m => (
                  <li key={`${m.lat},${m.lon}`}>
                    <button type="button" className="store-match" onClick={() => applyMatch(m)}>
                      <span className="store-match-label">{m.label}</span>
                      <span className="store-match-coords">{m.lat}, {m.lon}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="store-hint">
              Optional. Address lookup uses OpenStreetMap, and only runs when you click it.
            </p>
          </div>

          {/* Hours & notes */}
          <div className="shop-field">
            <label className="shop-field-label" htmlFor="sf-hours">Opening hours</label>
            <input id="sf-hours" className="form-input" value={fields.hours}
              onChange={e => set('hours', e.target.value)}
              placeholder="e.g. Mon–Sat 8–20, Sun 9–14" />
          </div>

          <div className="shop-field">
            <label className="shop-field-label" htmlFor="sf-notes">Notes</label>
            <textarea id="sf-notes" className="form-input store-notes" rows={3} value={fields.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Parking, which entrance, best days for deals…" />
          </div>

          {isNew && (
            <label className="store-check">
              <input type="checkbox" checked={createList}
                onChange={e => setCreateList(e.target.checked)} />
              <span>
                Create a shopping list for this store
                <span className="store-check-sub">
                  It appears in the list bar{category ? ` as ${category.emoji}` : ''} straight away.
                </span>
              </span>
            </label>
          )}

          {error && <p className="store-msg store-msg--error" role="alert">{error}</p>}
        </div>

        <div className="shop-dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving || !fields.name.trim()}>
            {saving ? 'Saving…' : isNew ? 'Add Store' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export { StoreFormModal };
