import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useShoppingPrefs } from '../hooks/useShoppingPrefs';
import { generateId, getToday, navigateDate } from '../utils/helpers.js';
import { CATEGORIES as DEFAULT_CATEGORIES, CATEGORY_MAP, categorize } from '../data/shoppingCategories.js';
import ShoppingStoreMode from './ShoppingStoreMode.jsx';
import BudgetView from './BudgetView.jsx';

const CAT_COLORS = [
  '#97C459','#5DCAA5','#E24B4A','#EF9F27',
  '#818cf8','#22d3ee','#f59e0b','#ec4899',
  '#8b5cf6','#06b6d4','#9ca3af','#f97316',
  '#84cc16','#14b8a6','#e879f9','#fb7185',
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconMic      = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="6" y="1" width="6" height="9" rx="3"/><path d="M3 10a6 6 0 0 0 12 0"/><line x1="9" y1="16" x2="9" y2="18"/></svg>;
const IconPlus     = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>;
const IconMinus    = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="5" x2="9" y2="5"/></svg>;
const IconX        = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>;
const IconCheck    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 7 6 11 12 3"/></svg>;
const IconPencil   = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M9 1.5L11.5 4l-7 7H2V8.5l7-7z"/></svg>;
const IconTrash    = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="1.5" y1="3.5" x2="11.5" y2="3.5"/><path d="M4.5 3.5V2.5h4v1"/><path d="M2.5 3.5l.7 7.5h6.6l.7-7.5"/></svg>;
const IconCart     = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h2.5l2.5 9h8.5l1.5-5.5H5"/><circle cx="8" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="15.5" r="1.5" fill="currentColor" stroke="none"/></svg>;
const IconLocation = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="5" r="2"/><path d="M6 1a4 4 0 0 1 4 4c0 3-4 7-4 7S2 8 2 5a4 4 0 0 1 4-4z"/></svg>;
const IconChevron  = ({ up }) => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points={up ? '1.5 7 5 3 8.5 7' : '1.5 3 5 7 8.5 3'}/></svg>;
const IconShare    = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="2" r="1.5"/><circle cx="10" cy="11" r="1.5"/><circle cx="2.5" cy="6.5" r="1.5"/><line x1="4" y1="5.8" x2="8.6" y2="2.9"/><line x1="4" y1="7.2" x2="8.6" y2="10.1"/></svg>;
const IconLink     = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7a3 3 0 0 0 4.5.4l1.5-1.5a3 3 0 0 0-4.2-4.2L5.6 2.9"/><path d="M8 6a3 3 0 0 0-4.5-.4L2 7.1a3 3 0 0 0 4.2 4.2l1.1-1.1"/></svg>;
const IconSparkle  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 1l1.2 4 4 1.2-4 1.2L7 11.5l-1.2-4L1.8 6.2l4-1.2z"/></svg>;
const IconCalendar = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="1" y="2.5" width="12" height="10.5" rx="1.5"/><path d="M1 6h12"/><line x1="4.5" y1="1" x2="4.5" y2="4"/><line x1="9.5" y1="1" x2="9.5" y2="4"/></svg>;
const IconNavigation = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4.5h10M8 1.5l3 3-3 3"/><path d="M14 10.5H4M7 7.5l-3 3 3 3"/></svg>;
const IconBarcode  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 3v12M5 3v12M7.5 3v12M10 3v12M11.5 3v12M14 3v12M16 3v12"/></svg>;
const IconBarcodeSm = () => <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 3v12M5 3v12M7.5 3v12M10 3v12M11.5 3v12M14 3v12M16 3v12"/></svg>;
// Nav panel icons
const IconNavCart  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h2.5l2.5 9h8.5l1.5-5.5H5"/><circle cx="8" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="15.5" r="1.5" fill="currentColor" stroke="none"/></svg>;
const IconNavBook  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3.5h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H3V3.5z"/><path d="M15 3.5h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5V3.5z"/></svg>;
const IconNavWallet= () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="1" y="4" width="16" height="12" rx="2"/><path d="M1 8.5h16"/><circle cx="13.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M5 4V3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/></svg>;
const IconNavBox   = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6.5l6-4 6 4v8l-6 4-6-4v-8z"/><line x1="9" y1="2.5" x2="9" y2="18"/><path d="M3 6.5l6 4 6-4"/></svg>;
const IconNavStore = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h14"/><path d="M3 3h12l2 5H1L3 3z"/><path d="M6 8v9"/><path d="M12 8v9"/><path d="M1 17h16"/></svg>;
// Recipe mode icons
const IconClock    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="6"/><path d="M7 3.5V7l2.5 1.5"/></svg>;
const IconServings = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="4" r="2"/><path d="M1 13c0-2.5 1.8-4 4-4s4 1.5 4 4"/><circle cx="10.4" cy="5" r="1.5"/><path d="M8.6 9.2c1.9.3 3.2 1.7 3.2 3.8"/></svg>;
const IconCamera   = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5A1.5 1.5 0 0 1 3.5 5h2l1-1.5h7L14.5 5h2A1.5 1.5 0 0 1 18 6.5v8A1.5 1.5 0 0 1 16.5 16h-13A1.5 1.5 0 0 1 2 14.5v-8z"/><circle cx="10" cy="10.5" r="3.2"/></svg>;
const IconBook     = () => <svg width="26" height="26" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3.5h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H3V3.5z"/><path d="M15 3.5h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5V3.5z"/></svg>;

// ── Nav sections ──────────────────────────────────────────────────────────────
const NAV = [
  { id: 'lists',   label: 'My List',          Icon: IconNavCart   },
  { id: 'recipes', label: 'Recipes',          Icon: IconNavBook   },
  { id: 'budget',  label: 'Monthly Budget',   Icon: IconNavWallet },
  { id: 'items',   label: 'All Items',        Icon: IconNavBox    },
  { id: 'stores',  label: 'Stores',           Icon: IconNavStore  },
];

// ── Units ─────────────────────────────────────────────────────────────────────
const UNITS = [
  'lbs','lb','oz','kg','g','cans','can','bottles','bottle','packs','pack',
  'dozen','bunch','bunches','bags','bag','boxes','box','jars','jar',
  'gallons','gallon','liters','liter','cups','cup','pints','pint',
  'quarts','quart','pieces','piece','heads','head','cloves','clove',
  'stalks','stalk','slices','slice','bars','bar',
];
const UNIT_OPTIONS = ['', 'lbs', 'oz', 'kg', 'g', 'can', 'bottle', 'pack', 'dozen',
  'bunch', 'bag', 'box', 'jar', 'gallon', 'liter', 'cup', 'pint', 'quart', 'piece', 'slice'];

// ── Parsing helpers ───────────────────────────────────────────────────────────
const VOICE_STRIP = ['add ','put ','buy ','get ','i need ','please add ','i want ','need ','pick up '];
const LIST_SUFFIX = [' to my shopping list',' to the list',' to my list',' on my list'];

function cleanText(text) {
  let t = text.toLowerCase().trim();
  for (const w of VOICE_STRIP) { if (t.startsWith(w)) { t = t.slice(w.length); break; } }
  for (const s of LIST_SUFFIX)  { if (t.endsWith(s))   { t = t.slice(0, -s.length).trim(); break; } }
  return t;
}

function parseOne(raw) {
  const t = cleanText(raw).trim();
  if (!t) return null;
  if (/^a dozen /i.test(t)) return { qty: 12, unit: 'dozen', name: t.replace(/^a dozen /i, '') };
  const pattern = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(?:(${UNITS.join('|')})s?\\s+(?:of\\s+)?)?(.+)$`, 'i');
  const m = t.match(pattern);
  if (m) return { qty: parseFloat(m[1]), unit: (m[2] || '').toLowerCase().replace(/s$/, ''), name: m[3].trim() };
  return { qty: 1, unit: '', name: t };
}

function parseItems(raw) {
  return raw.split(/\s+and\s+|,\s*/i).map(parseOne).filter(Boolean);
}

function getSuggestions(history, items) {
  const names = new Set(items.map(i => i.name.toLowerCase()));
  const now = Date.now();
  return history
    .filter(h => !names.has(h.name.toLowerCase()))
    .map(h => ({ ...h, score: h.count * 10 - (now - new Date(h.lastBought)) / 86_400_000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function daysSince(iso) {
  return Math.round((Date.now() - new Date(iso)) / 86_400_000);
}

// ── Recipe photo helper ───────────────────────────────────────────────────────
// Recipe photos are stored inline as compressed base64 data URLs on the recipe
// row in the `shoppingRecipes` table. IndexedDB has far more headroom than the
// localStorage this used to live in, but downscaling still earns its keep: it
// keeps each photo in the tens of KB, so reads stay fast and a future sync has
// less to push. Storing them as Blobs instead would be the next improvement.
function resizeImage(file, maxW = 640, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ── Pantry helpers ────────────────────────────────────────────────────────────
function pantryPct(item) {
  const par = item.parQty > 0 ? item.parQty : 1;
  return Math.max(0, Math.min(100, Math.round((item.qty / par) * 100)));
}

function pantryColor(item) {
  if (item.qty <= 0) return 'var(--text-muted)';
  const pct = pantryPct(item);
  if (pct >= 50) return 'var(--priority-low)';
  if (pct >= 20) return 'var(--priority-medium)';
  return 'var(--priority-high)';
}

function recipeStock(recipe, pantryByName) {
  const total = recipe.ingredients.length;
  const have = recipe.ingredients.filter(ing => {
    const p = pantryByName[ing.name.toLowerCase()];
    return p && p.qty > 0;
  }).length;
  return { have, total };
}

function formatDayLabel(dateStr, offset) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
}

// ── Voice capture hook ────────────────────────────────────────────────────────
const VOICE_ERROR_MSGS = {
  'not-allowed':         'Microphone access denied. Allow it in browser settings.',
  'audio-capture':       'No microphone found on this device.',
  'network':             'Network error — speech service unavailable.',
  'no-speech':           'No speech detected. Try speaking closer to the mic.',
  'service-not-allowed': 'Speech service blocked. Open the app over HTTPS.',
  'aborted':             null, // user cancelled — no message needed
};

function useVoice(onResult, onError) {
  const [listening, setListening] = useState(false);
  const [interim,   setInterim]   = useState('');
  const recRef = useRef(null);
  const supported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!supported) { onError?.('Voice input is not supported in this browser.'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = 'en-US';
    r.onstart  = () => setListening(true);
    r.onend    = () => { setListening(false); setInterim(''); };
    r.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setInterim(t);
      if (e.results[e.results.length - 1].isFinal) { onResult(t); setInterim(''); }
    };
    r.onerror = (e) => {
      setListening(false);
      setInterim('');
      const msg = VOICE_ERROR_MSGS[e.error];
      if (msg) onError?.(msg);
    };
    recRef.current = r;
    r.start();
  }, [supported, onResult, onError]);

  const stop = useCallback(() => recRef.current?.stop(), []);
  return { listening, interim, start, stop, supported };
}

// ── ItemCard ──────────────────────────────────────────────────────────────────
function ItemCard({ item, cat, onToggle, onUpdate, onEdit, onDelete }) {
  const adjQty = (delta) =>
    onUpdate({ qty: Math.max(0.25, parseFloat(((item.qty || 1) + delta).toFixed(2))) });

  return (
    <div className={`sic ${item.checked ? 'sic--done' : ''}`} style={{ '--cc': cat.color }}>
      {/* Category thumb */}
      <div className="sic-thumb">{cat.emoji}</div>

      {/* Info */}
      <div className="sic-info">
        <div className="sic-row1">
          <span className="sic-name">{item.name}</span>
          <span className="sic-badge">{cat.label}</span>
        </div>
        <div className="sic-row2">
          {item.storeLocation && (
            <span className="sic-loc"><IconLocation /> {item.storeLocation}</span>
          )}
          {item.estimatedPrice != null && (
            <span className="sic-price">${item.estimatedPrice.toFixed(2)}</span>
          )}
          {item.note && <span className="sic-note">{item.note}</span>}
          {item.barcode && (
            <span className="sic-barcode" title={`Barcode ${item.barcode}`}><IconBarcodeSm /> {item.barcode}</span>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="sic-right">
        {/* Stepper */}
        <div className="sic-stepper">
          <button className="sic-step" onClick={() => adjQty(-1)} tabIndex={-1}><IconMinus /></button>
          <span className="sic-qty">{item.qty || 1}{item.unit ? ` ${item.unit}` : ''}</span>
          <button className="sic-step" onClick={() => adjQty(+1)} tabIndex={-1}><IconPlus /></button>
        </div>

        {/* Action buttons */}
        <div className="sic-actions">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
               className="sic-act sic-act--link" title="Open link"
               onClick={e => e.stopPropagation()}>
              <IconLink />
            </a>
          )}
          <button className="sic-act" onClick={onEdit} title="Edit"><IconPencil /></button>
          <button className="sic-act sic-act--del" onClick={onDelete} title="Remove"><IconTrash /></button>
        </div>

        {/* Check circle */}
        <button className="sic-check" onClick={onToggle} title="Toggle done">
          {item.checked && <IconCheck />}
        </button>
      </div>
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────
function CategorySection({ cat, items, onToggle, onUpdate, onEdit, onDelete }) {
  const [collapsed, setCollapsed] = useState(false);
  const unchecked = items.filter(i => !i.checked);
  const checked   = items.filter(i =>  i.checked);
  if (!items.length) return null;

  return (
    <div className="shop-section">
      <button className="shop-section-hdr" style={{ '--cc': cat.color }} onClick={() => setCollapsed(c => !c)}>
        <div className="shop-section-identity">
          <span className="shop-section-emoji">{cat.emoji}</span>
          <span className="shop-section-name">{cat.label}</span>
          {unchecked.length > 0 && <span className="shop-section-count">{unchecked.length}</span>}
        </div>
        <div className="shop-section-meta">
          {checked.length > 0 && <span className="shop-section-done">{checked.length} done</span>}
          <span className="shop-section-chevron"><IconChevron up={!collapsed} /></span>
        </div>
      </button>

      {!collapsed && (
        <div className="sic-list">
          {unchecked.map(item => (
            <ItemCard key={item.id} item={item} cat={cat}
              onToggle={() => onToggle(item.id)}
              onUpdate={u => onUpdate(item.id, u)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)} />
          ))}
          {checked.length > 0 && unchecked.length > 0 && (
            <div className="sic-divider">
              <div className="sic-divider-line" />
              <span className="sic-divider-label">Checked</span>
              <div className="sic-divider-line" />
            </div>
          )}
          {checked.map(item => (
            <ItemCard key={item.id} item={item} cat={cat}
              onToggle={() => onToggle(item.id)}
              onUpdate={u => onUpdate(item.id, u)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── EditItemModal ─────────────────────────────────────────────────────────────
function EditItemModal({ item, isNew, onSave, onClose, categories, units }) {
  const [fields, setFields] = useState({
    name:          item.name,
    category:      item.category,
    storeLocation: item.storeLocation || '',
    qty:           item.qty || 1,
    unit:          item.unit || '',
    price:         item.estimatedPrice ?? '',
    note:          item.note || '',
    url:           item.url || '',
    barcode:       item.barcode || '',
  });

  function handleSave() {
    onSave({
      name:          fields.name.trim() || item.name,
      category:      fields.category,
      storeLocation: fields.storeLocation.trim(),
      qty:           parseFloat(fields.qty) || 1,
      unit:          fields.unit,
      estimatedPrice: fields.price !== '' ? parseFloat(fields.price) : null,
      note:          fields.note.trim(),
      url:           fields.url.trim(),
      barcode:       fields.barcode.trim(),
    });
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{isNew ? 'New Scanned Item' : 'Edit Item'}</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        <div className="shop-dialog-body">
          {/* Item name */}
          <div className="shop-field">
            <label className="shop-field-label">Item name</label>
            <input className="form-input" value={fields.name}
              onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Organic Whole Milk" autoFocus={isNew} />
          </div>

          {/* Barcode */}
          <div className="shop-field">
            <label className="shop-field-label">Barcode</label>
            <input className="form-input" value={fields.barcode}
              onChange={e => setFields(f => ({ ...f, barcode: e.target.value }))}
              placeholder="e.g. 041631234567" />
            {isNew && fields.barcode && (
              <p className="shop-field-hint">New code — fill in the details below. Once you check this item off as purchased, the code is remembered for next time.</p>
            )}
          </div>

          {/* Category */}
          <div className="shop-field">
            <label className="shop-field-label">Category</label>
            <div className="shop-cat-select-wrap">
              <span className="shop-cat-preview">
                {categories.find(c => c.id === fields.category)?.emoji}
              </span>
              <select className="form-input shop-cat-select" value={fields.category}
                onChange={e => setFields(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Qty + Unit */}
          <div className="shop-field-row">
            <div className="shop-field">
              <label className="shop-field-label">Quantity</label>
              <input className="form-input" type="number" min="0.25" step="0.25"
                value={fields.qty} onChange={e => setFields(f => ({ ...f, qty: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Unit</label>
              <select className="form-input" value={fields.unit}
                onChange={e => setFields(f => ({ ...f, unit: e.target.value }))}>
                <option value="">no unit</option>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Price ($)</label>
              <input className="form-input" type="number" min="0" step="0.01"
                value={fields.price} onChange={e => setFields(f => ({ ...f, price: e.target.value }))}
                placeholder="0.00" />
            </div>
          </div>

          {/* Store location */}
          <div className="shop-field">
            <label className="shop-field-label">Store location</label>
            <input className="form-input" value={fields.storeLocation}
              onChange={e => setFields(f => ({ ...f, storeLocation: e.target.value }))}
              placeholder="e.g. Aisle 4, Produce Section, Deli Counter" />
          </div>

          {/* Note */}
          <div className="shop-field">
            <label className="shop-field-label">Note</label>
            <input className="form-input" value={fields.note}
              onChange={e => setFields(f => ({ ...f, note: e.target.value }))}
              placeholder="e.g. the organic kind, fuji variety…" />
          </div>

          {/* URL */}
          <div className="shop-field">
            <label className="shop-field-label">Product URL</label>
            <div className="shop-url-wrap">
              <span className="shop-url-icon"><IconLink /></span>
              <input className="form-input shop-url-input" type="url" value={fields.url}
                onChange={e => setFields(f => ({ ...f, url: e.target.value }))}
                placeholder="https://…" />
            </div>
          </div>
        </div>

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!fields.name.trim()}>
            {isNew ? 'Add to List' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ScanItemModal ──────────────────────────────────────────────────────────────
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

function ScanItemModal({ onCode, onClose }) {
  const [manualCode,  setManualCode]  = useState('');
  const [cameraError, setCameraError] = useState('');
  const [scanning,    setScanning]    = useState(false);
  const [feed,        setFeed]        = useState([]);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const lastRef   = useRef({ code: '', at: 0 });

  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  function handleCode(code) {
    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.at < 2500) return; // debounce repeat frames
    lastRef.current = { code, at: now };
    const result = onCode(code);
    if (!result?.found) { onClose(); return; }
    setFeed(f => [{ code, name: result.name }, ...f].slice(0, 6));
  }

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });

    async function loop() {
      if (cancelled || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length) handleCode(codes[0].rawValue);
      } catch { /* transient decode error — keep scanning */ }
      rafRef.current = requestAnimationFrame(loop);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);
        loop();
      } catch {
        setCameraError('Camera access unavailable — enter the code manually below.');
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [supported]); // eslint-disable-line react-hooks/exhaustive-deps

  function submitManual() {
    const code = manualCode.trim();
    if (!code) return;
    handleCode(code);
    setManualCode('');
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog scan-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Scan Item</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        {supported ? (
          <div className="scan-video-wrap">
            <video ref={videoRef} className="scan-video" muted playsInline />
            <div className="scan-reticle" />
            {!scanning && !cameraError && <div className="scan-video-hint">Starting camera…</div>}
          </div>
        ) : (
          <p className="scan-unsupported">
            Live camera scanning isn't supported in this browser — enter the barcode below instead.
          </p>
        )}
        {cameraError && <p className="field-error">{cameraError}</p>}

        <div className="shop-field">
          <label className="shop-field-label">Or enter the code manually</label>
          <div className="scan-manual-row">
            <input className="form-input" placeholder="e.g. 041631234567" value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitManual()} autoFocus={!supported} />
            <button className="btn-primary sm" onClick={submitManual} disabled={!manualCode.trim()}>Look Up</button>
          </div>
        </div>

        {feed.length > 0 && (
          <div className="scan-feed">
            {feed.map((f, i) => (
              <div key={i} className="scan-feed-row">
                <span className="scan-feed-icon"><IconCheck /></span>
                <span className="scan-feed-text">Added <strong>{f.name}</strong></span>
              </div>
            ))}
          </div>
        )}

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────
function DeleteConfirmModal({ item, onConfirm, onClose }) {
  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Remove Item?</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>
        <p className="shop-dialog-body-text">
          Are you sure you want to remove <strong>"{item.name}"</strong> from your list?
        </p>
        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ── ConfirmModal (generic) ─────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onClose }) {
  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{title}</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>
        <p className="shop-dialog-body-text">{message}</p>
        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── AddToPlannerModal ─────────────────────────────────────────────────────────
function AddToPlannerModal({ listName, onAdd, onClose }) {
  const today = getToday();
  const days  = Array.from({ length: 7 }, (_, i) => ({
    date:  navigateDate(today, i),
    label: formatDayLabel(navigateDate(today, i), i),
  }));

  const [selDate, setSelDate] = useState(today);
  const [selTime, setSelTime] = useState('10:00');
  const [done,    setDone]    = useState(false);

  function submit(date, time) {
    onAdd({ date, time });
    setDone(true);
    setTimeout(onClose, 1400);
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        {done ? (
          <div className="shop-planner-success">
            <span className="shop-planner-success-icon">✅</span>
            <p>Task added to your planner!</p>
          </div>
        ) : (
          <>
            <div className="shop-dialog-header">
              <h4 className="shop-dialog-title">Add to Planner</h4>
              <button className="sic-act" onClick={onClose}><IconX /></button>
            </div>
            <p className="shop-dialog-subtitle">
              Creates <strong>"Go shopping · {listName}"</strong> as a task
            </p>

            {/* Day selector */}
            <div className="shop-planner-days">
              {days.map(d => (
                <button
                  key={d.date}
                  className={`shop-planner-day ${selDate === d.date ? 'shop-planner-day--active' : ''}`}
                  onClick={() => setSelDate(d.date)}>
                  {d.label}
                </button>
              ))}
            </div>

            {/* Time */}
            <div className="shop-field">
              <label className="shop-field-label">Time</label>
              <input className="form-input" type="time" value={selTime}
                onChange={e => setSelTime(e.target.value)} />
            </div>

            <div className="shop-dialog-actions">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-ghost" onClick={() => submit(today, '')}>Add Now</button>
              <button className="btn-primary" onClick={() => submit(selDate, selTime)}>Schedule</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── ManageCategoriesModal ─────────────────────────────────────────────────────
function ManageCategoriesModal({ categories, onSave, onClose }) {
  const [cats,      setCats]      = useState(categories.map(c => ({ ...c })));
  const [editingId, setEditingId] = useState(null);
  const [newEmoji,  setNewEmoji]  = useState('🛒');
  const [newLabel,  setNewLabel]  = useState('');
  const [newColor,  setNewColor]  = useState(CAT_COLORS[0]);

  function addCat() {
    if (!newLabel.trim()) return;
    setCats(prev => [...prev, { id: `cat_${Date.now()}`, label: newLabel.trim(), emoji: newEmoji, color: newColor }]);
    setNewLabel('');
    setNewEmoji('🛒');
    setNewColor(CAT_COLORS[0]);
  }

  function updateCat(id, field, value) {
    setCats(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  function deleteCat(id) {
    setCats(prev => prev.filter(c => c.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function handleSave() {
    onSave(cats.filter(c => c.label.trim()));
    onClose();
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Shopping Categories</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        {/* ── Add new category form ── */}
        <div className="scat-add-form">
          <div className="scat-add-inputs">
            <input
              className="form-input scat-emoji-inp"
              value={newEmoji}
              maxLength={4}
              onChange={e => setNewEmoji(e.target.value)}
              title="Emoji" />
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder="New category name…"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCat()} />
          </div>
          <div className="scat-color-row">
            {CAT_COLORS.map(color => (
              <button
                key={color}
                className={`scat-swatch ${newColor === color ? 'scat-swatch--on' : ''}`}
                style={{ '--sc': color }}
                onClick={() => setNewColor(color)} />
            ))}
          </div>
          <button className="btn-primary sm" disabled={!newLabel.trim()} onClick={addCat}>
            <IconPlus /> Add Category
          </button>
        </div>

        {/* ── Category list ── */}
        <ul className="scat-list">
          {cats.map(cat => (
            <li key={cat.id}
              className={`scat-item ${editingId === cat.id ? 'scat-item--editing' : ''}`}
              style={{ '--cc': cat.color }}>

              {editingId === cat.id ? (
                /* Edit mode */
                <div className="scat-edit-wrap">
                  <div className="scat-edit-top">
                    <input
                      className="form-input scat-emoji-inp"
                      value={cat.emoji}
                      maxLength={4}
                      onChange={e => updateCat(cat.id, 'emoji', e.target.value)} />
                    <input
                      className="form-input"
                      style={{ flex: 1 }}
                      value={cat.label}
                      autoFocus
                      placeholder="Category name…"
                      onChange={e => updateCat(cat.id, 'label', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && setEditingId(null)} />
                  </div>
                  <div className="scat-color-row">
                    {CAT_COLORS.map(color => (
                      <button
                        key={color}
                        className={`scat-swatch ${cat.color === color ? 'scat-swatch--on' : ''}`}
                        style={{ '--sc': color }}
                        onClick={() => updateCat(cat.id, 'color', color)} />
                    ))}
                  </div>
                  <div className="scat-edit-actions">
                    <button className="btn-ghost sm" onClick={() => setEditingId(null)}>Done</button>
                    <button className="sic-act sic-act--del" onClick={() => deleteCat(cat.id)}>
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="scat-dot">{cat.emoji}</div>
                  <span className="scat-name">{cat.label}</span>
                  <button className="scat-edit-btn" onClick={() => setEditingId(cat.id)}>
                    <IconPencil />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── ManageUnitsModal ──────────────────────────────────────────────────────────
function ManageUnitsModal({ units, onSave, onClose }) {
  const [items,      setItems]      = useState([...units]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal,    setEditVal]    = useState('');
  const [newVal,     setNewVal]     = useState('');

  function addUnit() {
    const v = newVal.trim();
    if (!v || items.map(u => u.toLowerCase()).includes(v.toLowerCase())) return;
    setItems(prev => [...prev, v]);
    setNewVal('');
  }

  function startEdit(idx) {
    setEditingIdx(idx);
    setEditVal(items[idx]);
  }

  function confirmEdit(idx) {
    const v = editVal.trim();
    if (v) setItems(prev => prev.map((u, i) => i === idx ? v : u));
    setEditingIdx(null);
  }

  function deleteUnit(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  }

  function handleSave() {
    onSave(items.filter(u => u.trim()));
    onClose();
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Units of Measure</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        {/* ── Add form ── */}
        <div className="sunit-add-form">
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="New unit (e.g. fl oz, ml, heads)…"
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addUnit()} />
          <button className="btn-primary sm" disabled={!newVal.trim()} onClick={addUnit}>
            <IconPlus /> Add Unit
          </button>
        </div>

        {/* ── List ── */}
        <ul className="sunit-list">
          {items.map((unit, idx) => (
            <li key={idx}
              className={`sunit-item ${editingIdx === idx ? 'sunit-item--editing' : ''}`}>
              {editingIdx === idx ? (
                <div className="sunit-edit-row">
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editVal}
                    autoFocus
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmEdit(idx);
                      if (e.key === 'Escape') setEditingIdx(null);
                    }} />
                  <button className="btn-ghost sm" onClick={() => confirmEdit(idx)}>Done</button>
                  <button className="sic-act sic-act--del" onClick={() => deleteUnit(idx)}><IconTrash /></button>
                </div>
              ) : (
                <>
                  <span className="sunit-label">{unit}</span>
                  <button className="scat-edit-btn" onClick={() => startEdit(idx)}><IconPencil /></button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── NewListDialog ─────────────────────────────────────────────────────────────
function NewListDialog({ onCreate, onClose }) {
  const [name, setName] = useState('');

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">New Shopping List</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>
        <div className="shop-dialog-body">
          <div className="shop-field">
            <label className="shop-field-label">Store or list name</label>
            <input className="form-input" placeholder="e.g. Whole Foods, Costco, Trader Joe's…"
              value={name} onChange={e => setName(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }} />
          </div>
        </div>
        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={handleCreate}>Create</button>
        </div>
      </div>
    </div>
  );
}

// ── RecipeCard ─────────────────────────────────────────────────────────────────
function RecipeCard({ recipe, pantryByName, onAddToList, onEdit, onDelete }) {
  const { have, total } = recipeStock(recipe, pantryByName);
  const stockLow = total > 0 && have < total;

  return (
    <div className="recipe-card">
      <div className="recipe-card-media">
        {recipe.image
          ? <img src={recipe.image} alt={recipe.name} />
          : <div className="recipe-card-noimg"><IconBook /></div>}
      </div>

      <div className="recipe-card-body">
        <div>
          <div className="recipe-card-top">
            <h3 className="recipe-card-name">{recipe.name}</h3>
            {recipe.country && <span className="recipe-card-country">{recipe.country}</span>}
          </div>
          {recipe.description && <p className="recipe-card-desc">{recipe.description}</p>}
          <div className="recipe-card-meta">
            {recipe.prepTime > 0 && (
              <span className="recipe-meta-chip"><IconClock /> {recipe.prepTime}m</span>
            )}
            {recipe.servings > 0 && (
              <span className="recipe-meta-chip"><IconServings /> {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
            )}
            {total > 0 && (
              <span className={`recipe-meta-chip ${stockLow ? 'recipe-meta-chip--warn' : 'recipe-meta-chip--ok'}`}>
                {stockLow ? <IconX /> : <IconCheck />} {have}/{total} in stock
              </span>
            )}
          </div>
        </div>

        <div className="recipe-card-actions">
          <div className="recipe-card-actions-left">
            <button className="btn-primary sm" onClick={() => onAddToList(recipe)}>
              <IconCart /> Add to List
            </button>
            <button className="btn-ghost sm" onClick={() => onEdit(recipe)}>
              <IconPencil /> Edit Recipe
            </button>
          </div>
          <button className="sic-act sic-act--del" onClick={() => onDelete(recipe)} title="Delete recipe">
            <IconTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RecipeFormModal (Create / Edit — full recipe CRUD form) ───────────────────
function emptyRecipeDraft() {
  return { name: '', description: '', country: '', prepTime: '', servings: '', image: '', ingredients: [], steps: [''] };
}

function RecipeFormModal({ recipe, onSave, onClose }) {
  const [draft, setDraft] = useState(() => recipe ? {
    name:        recipe.name || '',
    description: recipe.description || '',
    country:     recipe.country || '',
    prepTime:    recipe.prepTime || '',
    servings:    recipe.servings || '',
    image:       recipe.image || '',
    ingredients: recipe.ingredients ? [...recipe.ingredients] : [],
    steps:       recipe.steps?.length ? [...recipe.steps] : [''],
  } : emptyRecipeDraft());
  const [ingInput, setIngInput] = useState('');
  const [imgError, setImgError] = useState('');
  const fileRef = useRef(null);

  function addIngredient() {
    const p = parseOne(ingInput);
    if (!p?.name.trim()) return;
    setDraft(d => ({ ...d, ingredients: [...d.ingredients, p] }));
    setIngInput('');
  }
  function removeIngredient(i) {
    setDraft(d => ({ ...d, ingredients: d.ingredients.filter((_, j) => j !== i) }));
  }
  function updateStep(i, val) {
    setDraft(d => ({ ...d, steps: d.steps.map((s, j) => j === i ? val : s) }));
  }
  function addStep() {
    setDraft(d => ({ ...d, steps: [...d.steps, ''] }));
  }
  function removeStep(i) {
    setDraft(d => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }));
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImgError('Please choose an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { setImgError('Image is too large (max 8MB).'); return; }
    setImgError('');
    try {
      const dataUrl = await resizeImage(file);
      setDraft(d => ({ ...d, image: dataUrl }));
    } catch {
      setImgError('Could not read that image.');
    }
    e.target.value = '';
  }

  function handleSave() {
    if (!draft.name.trim() || !draft.ingredients.length) return;
    onSave({
      name:        draft.name.trim(),
      description: draft.description.trim(),
      country:     draft.country.trim(),
      prepTime:    parseInt(draft.prepTime) || 0,
      servings:    parseInt(draft.servings) || 0,
      image:       draft.image,
      ingredients: draft.ingredients,
      steps:       draft.steps.map(s => s.trim()).filter(Boolean),
    });
  }

  const canSave = draft.name.trim() && draft.ingredients.length > 0;

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{recipe ? 'Edit Recipe' : 'Create Recipe'}</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        <div className="shop-dialog-body">
          {/* Photo */}
          <div className="shop-field">
            <label className="shop-field-label">Picture</label>
            <div className="recipe-photo-row">
              <div className="recipe-photo-preview">
                {draft.image ? <img src={draft.image} alt="Recipe" /> : <IconCamera />}
              </div>
              <div className="recipe-photo-actions">
                <button className="btn-ghost sm" onClick={() => fileRef.current?.click()}>
                  <IconCamera /> {draft.image ? 'Change photo' : 'Upload photo'}
                </button>
                {draft.image && (
                  <button className="btn-ghost sm" onClick={() => setDraft(d => ({ ...d, image: '' }))}>Remove photo</button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
                {imgError && <p className="field-error">{imgError}</p>}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="shop-field">
            <label className="shop-field-label">Recipe name</label>
            <input className="form-input" placeholder="e.g. Chicken Tikka Masala" autoFocus
              value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </div>

          {/* Description */}
          <div className="shop-field">
            <label className="shop-field-label">Description</label>
            <textarea className="form-textarea" rows={2} placeholder="A short description of this dish…"
              value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
          </div>

          {/* Country / Time / Servings */}
          <div className="shop-field-row">
            <div className="shop-field">
              <label className="shop-field-label">Country / Cuisine</label>
              <input className="form-input" placeholder="e.g. Indian" value={draft.country}
                onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Elaboration time (min)</label>
              <input className="form-input" type="number" min="0" placeholder="45" value={draft.prepTime}
                onChange={e => setDraft(d => ({ ...d, prepTime: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Servings</label>
              <input className="form-input" type="number" min="0" placeholder="4" value={draft.servings}
                onChange={e => setDraft(d => ({ ...d, servings: e.target.value }))} />
            </div>
          </div>

          {/* Ingredients */}
          <div className="shop-field">
            <label className="shop-field-label">Ingredients</label>
            {draft.ingredients.map((ing, i) => (
              <div key={i} className="shop-ing-row">
                <span>{ing.qty > 1 ? `${ing.qty} ` : ''}{ing.unit ? `${ing.unit} ` : ''}{ing.name}</span>
                <button className="sic-act sic-act--del" onClick={() => removeIngredient(i)}><IconX /></button>
              </div>
            ))}
            <div className="shop-ing-add-row">
              <input className="form-input" style={{ flex: 1 }} placeholder="Add ingredient (e.g. 2 cups flour)…"
                value={ingInput} onChange={e => setIngInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } }} />
              <button className="btn-ghost sm" onClick={addIngredient} disabled={!ingInput.trim()}>Add</button>
            </div>
          </div>

          {/* Elaboration / Steps */}
          <div className="shop-field">
            <label className="shop-field-label">Elaboration (steps)</label>
            <div className="recipe-steps-list">
              {draft.steps.map((step, i) => (
                <div key={i} className="recipe-step-row">
                  <span className="recipe-step-num">{i + 1}</span>
                  <textarea className="form-textarea" rows={1} placeholder={`Step ${i + 1}…`}
                    value={step} onChange={e => updateStep(i, e.target.value)} />
                  {draft.steps.length > 1 && (
                    <button className="sic-act sic-act--del" onClick={() => removeStep(i)}><IconX /></button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-ghost sm" style={{ marginTop: 6 }} onClick={addStep}><IconPlus /> Add step</button>
          </div>
        </div>

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
            {recipe ? 'Save Changes' : 'Save Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddToListConfirmModal ──────────────────────────────────────────────────────
function AddToListConfirmModal({ recipe, lists, defaultListId, pantryByName, onConfirm, onClose }) {
  const [targetListId, setTargetListId] = useState(defaultListId || lists[0]?.id);
  const [skipStocked,  setSkipStocked]  = useState(true);
  const [done,         setDone]         = useState(false);

  const targetList = lists.find(l => l.id === targetListId) || lists[0];

  const rows = recipe.ingredients.map(ing => ({
    ...ing,
    inStock: !!(pantryByName[ing.name.toLowerCase()]?.qty > 0),
  }));
  const toAdd = skipStocked ? rows.filter(r => !r.inStock) : rows;

  function confirm() {
    onConfirm(toAdd, targetListId);
    setDone(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        {done ? (
          <div className="shop-planner-success">
            <span className="shop-planner-success-icon">✅</span>
            <p>{toAdd.length} item{toAdd.length !== 1 ? 's' : ''} added to "{targetList?.name}"!</p>
          </div>
        ) : (
          <>
            <div className="shop-dialog-header">
              <h4 className="shop-dialog-title">Add "{recipe.name}" to List</h4>
              <button className="sic-act" onClick={onClose}><IconX /></button>
            </div>

            {lists.length > 1 ? (
              <div className="shop-field">
                <label className="shop-field-label">Add to which list?</label>
                <div className="atl-list-picker">
                  {lists.map(l => (
                    <button key={l.id}
                      className={`shop-list-chip ${targetListId === l.id ? 'shop-list-chip--active' : ''}`}
                      onClick={() => setTargetListId(l.id)}>
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="shop-dialog-subtitle">Adds ingredients to <strong>"{targetList?.name}"</strong></p>
            )}

            <div className="atl-list">
              {rows.map((r, i) => (
                <div key={i} className={`atl-row ${r.inStock ? 'atl-row--stock' : ''}`}>
                  <span className="atl-status">{r.inStock ? <IconCheck /> : <IconCart />}</span>
                  <span className="atl-name">{r.qty > 1 ? `${r.qty} ` : ''}{r.unit ? `${r.unit} ` : ''}{r.name}</span>
                  {r.inStock && <span className="atl-tag">In pantry</span>}
                </div>
              ))}
            </div>

            <div className="toggle-row atl-toggle-row" onClick={() => setSkipStocked(s => !s)}>
              <span>Skip items already in pantry</span>
              <span className={`toggle-switch ${skipStocked ? 'on' : ''}`} />
            </div>

            <div className="shop-dialog-actions">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={confirm} disabled={!toAdd.length || !targetListId}>
                Add {toAdd.length} item{toAdd.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── PantryTracker (compact widget shown alongside recipes) ────────────────────
function PantryTracker({ items, onManage }) {
  const top = [...items].sort((a, b) => pantryPct(a) - pantryPct(b)).slice(0, 6);

  return (
    <div className="pantry-card">
      <div className="pantry-card-header">
        <h4 className="shop-right-title-sm">PANTRY TRACKER</h4>
        <span className="pantry-badge">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {top.length === 0 ? (
        <div className="empty-state" style={{ padding: '26px 10px' }}>
          <span style={{ fontSize: 30 }}>🧺</span>
          <p className="empty-title" style={{ fontSize: 13 }}>Pantry is empty</p>
          <p className="empty-sub">Checking off shopping items stocks it automatically</p>
        </div>
      ) : (
        <div className="pantry-list">
          {top.map(item => {
            const pct = pantryPct(item);
            const color = pantryColor(item);
            return (
              <div key={item.id} className="pantry-row">
                <div className="pantry-row-left">
                  <div className="pantry-thumb">{CATEGORY_MAP[item.category]?.emoji || '📦'}</div>
                  <div className="pantry-info">
                    <span className="pantry-name">{item.name}</span>
                    <span className="pantry-meta">{item.qty}{item.unit ? ` ${item.unit}` : ''} · {CATEGORY_MAP[item.category]?.label || 'Other'}</span>
                  </div>
                </div>
                <div className="pantry-stock">
                  <p className="pantry-stock-pct" style={{ color }}>{item.qty <= 0 ? 'Out' : `${pct}%`}</p>
                  <div className="pantry-bar-track">
                    <div className="pantry-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn-ghost pantry-manage-btn" onClick={onManage}>Manage Full Pantry</button>
    </div>
  );
}

// ── PantryManageModal (full pantry CRUD) ──────────────────────────────────────
function PantryManageModal({ items, units, onSave, onClose }) {
  const [list, setList] = useState(() => items.map(i => ({ ...i })));
  const [name, setName] = useState('');
  const [qty,  setQty]  = useState(1);
  const [unit, setUnit] = useState('');
  const [par,  setPar]  = useState(2);

  function addPantryItem() {
    if (!name.trim()) return;
    setList(prev => [...prev, {
      id: generateId(), name: name.trim(), qty: parseFloat(qty) || 0,
      unit, parQty: Math.max(1, parseFloat(par) || 1), category: categorize(name),
    }]);
    setName(''); setQty(1); setUnit(''); setPar(2);
  }

  function updateQty(id, delta) {
    setList(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, +(i.qty + delta).toFixed(2)) } : i));
  }

  function updatePar(id, val) {
    setList(prev => prev.map(i => i.id === id ? { ...i, parQty: Math.max(1, parseFloat(val) || 1) } : i));
  }

  function deletePantryItem(id) {
    setList(prev => prev.filter(i => i.id !== id));
  }

  function handleSave() {
    onSave(list);
    onClose();
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Pantry Essentials</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        <div className="pantry-add-form">
          <input className="form-input" style={{ flex: 2, minWidth: 140 }} placeholder="e.g. Heavy Cream"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPantryItem()} />
          <input className="form-input" type="number" min="0" step="0.25" style={{ width: 70 }}
            value={qty} onChange={e => setQty(e.target.value)} />
          <select className="form-input" style={{ width: 90 }} value={unit} onChange={e => setUnit(e.target.value)}>
            <option value="">unit</option>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <input className="form-input" type="number" min="1" title="Par level (full-stock target)" style={{ width: 70 }}
            value={par} onChange={e => setPar(e.target.value)} />
          <button className="btn-primary sm" disabled={!name.trim()} onClick={addPantryItem}><IconPlus /> Add</button>
        </div>
        <p className="pantry-add-hint">Qty · Unit · Par level (the full-stock target used for the % bar)</p>

        {list.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 10px' }}>
            <span style={{ fontSize: 34 }}>🧺</span>
            <p className="empty-title">No pantry items yet</p>
          </div>
        ) : (
          <ul className="pantry-manage-list">
            {list.map(item => (
              <li key={item.id} className="pantry-manage-item">
                <div className="pantry-thumb">{CATEGORY_MAP[item.category]?.emoji || '📦'}</div>
                <div className="pantry-info" style={{ flex: 1 }}>
                  <span className="pantry-name">{item.name}</span>
                  <span className="pantry-meta">{CATEGORY_MAP[item.category]?.label || 'Other'} · par {item.parQty}{item.unit ? ` ${item.unit}` : ''}</span>
                </div>
                <div className="sic-stepper">
                  <button className="sic-step" onClick={() => updateQty(item.id, -1)} tabIndex={-1}><IconMinus /></button>
                  <span className="sic-qty">{item.qty}{item.unit ? ` ${item.unit}` : ''}</span>
                  <button className="sic-step" onClick={() => updateQty(item.id, +1)} tabIndex={-1}><IconPlus /></button>
                </div>
                <input className="form-input pantry-par-input" type="number" min="1" value={item.parQty}
                  onChange={e => updatePar(item.id, e.target.value)} title="Par level" />
                <button className="sic-act sic-act--del" onClick={() => deletePantryItem(item.id)}><IconTrash /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── RecipesView (center content for Recipes section) ─────────────────────────
function RecipesView({ recipes, onSaveRecipe, onDeleteRecipe, onAddIngredients, lists, activeListId, pantryItems, onSavePantry, units }) {
  const [formRecipe,   setFormRecipe]   = useState(undefined); // undefined=closed, null=create, object=edit
  const [addTarget,    setAddTarget]    = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showPantry,   setShowPantry]   = useState(false);

  const pantryByName = useMemo(
    () => Object.fromEntries(pantryItems.map(p => [p.name.toLowerCase(), p])),
    [pantryItems]
  );

  function saveRecipe(data) {
    if (formRecipe?.id) {
      onSaveRecipe(prev => prev.map(r => r.id === formRecipe.id ? { ...r, ...data } : r));
    } else {
      onSaveRecipe(prev => [...prev, { id: generateId(), ...data, createdAt: new Date().toISOString() }]);
    }
    setFormRecipe(undefined);
  }

  return (
    <div className="shop-center-content">
      <div className="shop-center-header recipe-mode-header">
        <div>
          <h2 className="shop-center-title">Recipes</h2>
          <p className="recipe-mode-sub">Manage your culinary inspirations and sync them instantly to your shopping list.</p>
        </div>
        <button className="btn-primary" onClick={() => setFormRecipe(null)}>
          <IconPlus /> Create Recipe
        </button>
      </div>

      <div className="shop-center-scroll">
        <div className="recipe-bento">
          <div className="recipe-list-col">
            {recipes.length === 0 && (
              <div className="empty-state">
                <span style={{ fontSize: 40 }}>📖</span>
                <p className="empty-title">No recipes yet</p>
                <p className="empty-sub">Create a recipe to add all its ingredients in one tap</p>
              </div>
            )}
            {recipes.map(r => (
              <RecipeCard key={r.id} recipe={r} pantryByName={pantryByName}
                onAddToList={setAddTarget}
                onEdit={setFormRecipe}
                onDelete={setDeleteTarget} />
            ))}
          </div>

          <div className="recipe-side-col">
            <PantryTracker items={pantryItems} onManage={() => setShowPantry(true)} />
          </div>
        </div>
      </div>

      {formRecipe !== undefined && (
        <RecipeFormModal recipe={formRecipe} onSave={saveRecipe} onClose={() => setFormRecipe(undefined)} />
      )}

      {addTarget && (
        <AddToListConfirmModal recipe={addTarget} lists={lists} defaultListId={activeListId} pantryByName={pantryByName}
          onConfirm={(items, targetListId) => onAddIngredients(items, targetListId, addTarget.name)}
          onClose={() => setAddTarget(null)} />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Recipe?"
          message={<>Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This can't be undone.</>}
          confirmLabel="Delete"
          onConfirm={() => { onDeleteRecipe(deleteTarget.id); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)} />
      )}

      {showPantry && (
        <PantryManageModal items={pantryItems} units={units}
          onSave={onSavePantry}
          onClose={() => setShowPantry(false)} />
      )}
    </div>
  );
}

// BudgetView now lives in its own module (./BudgetView.jsx) — the Monthly
// Budget section grew into a self-contained personal-finance subsystem
// (income, bills, categories, expenses) rather than a grocery-total widget.

// ── AllItemsView (center content for All Items section) ───────────────────────
function AllItemsView({ lists, catMap, categories }) {
  const allItems = lists.flatMap(l =>
    l.items.map(item => ({ ...item, listName: l.name }))
  );

  const grouped = {};
  allItems.forEach(item => {
    if (!grouped[item.listName]) grouped[item.listName] = [];
    grouped[item.listName].push(item);
  });

  return (
    <div className="shop-center-content">
      <div className="shop-center-header">
        <h2 className="shop-center-title">All Items</h2>
        <span className="shop-center-sub">{allItems.length} total · {allItems.filter(i => !i.checked).length} remaining</span>
      </div>
      <div className="shop-center-scroll">
        {allItems.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 40 }}>📦</span>
            <p className="empty-title">No items yet</p>
            <p className="empty-sub">Add items to your shopping lists to see them here</p>
          </div>
        ) : (
          Object.entries(grouped).map(([listName, items]) => (
            <div key={listName} className="shop-section">
              <div className="shop-all-items-list-hdr">🛒 {listName} · {items.filter(i => !i.checked).length} remaining</div>
              {items.map(item => {
                const cat = catMap[item.category] || categories[0];
                return (
                  <div key={item.id} className={`sic sic--readonly ${item.checked ? 'sic--done' : ''}`} style={{ '--cc': cat.color }}>
                    <div className="sic-thumb">{cat.emoji}</div>
                    <div className="sic-info">
                      <div className="sic-row1">
                        <span className="sic-name">{item.name}</span>
                        <span className="sic-badge">{cat.label}</span>
                      </div>
                      <div className="sic-row2">
                        {item.storeLocation && <span className="sic-loc"><IconLocation /> {item.storeLocation}</span>}
                        {item.estimatedPrice != null && <span className="sic-price">${item.estimatedPrice.toFixed(2)}</span>}
                      </div>
                    </div>
                    <span className="sic-qty-badge">{item.qty || 1}{item.unit ? ` ${item.unit}` : ''}</span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── StoresView (center content for Stores section) ────────────────────────────
function StoresView({ lists }) {
  return (
    <div className="shop-center-content">
      <div className="shop-center-header">
        <h2 className="shop-center-title">Stores</h2>
        <span className="shop-center-sub">{lists.length} store{lists.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="shop-center-scroll">
        {lists.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 40 }}>🏪</span>
            <p className="empty-title">No stores yet</p>
            <p className="empty-sub">Create a shopping list for each store you shop at</p>
          </div>
        ) : (
          <div className="shop-stores-grid">
            {lists.map(l => {
              const remaining = l.items.filter(i => !i.checked).length;
              const est = l.items.filter(i => !i.checked && i.estimatedPrice != null)
                .reduce((s, i) => s + i.estimatedPrice, 0);
              return (
                <div key={l.id} className="shop-store-card">
                  <div className="shop-store-icon">🏪</div>
                  <div className="shop-store-name">{l.name}</div>
                  <div className="shop-store-meta">
                    <span>{remaining} items</span>
                    {est > 0 && <span>~${est.toFixed(2)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ShoppingList ─────────────────────────────────────────────────────────
export default function ShoppingList({ lists, setLists, history, setHistory, recipes, setRecipes, onAddToPlanner }) {
  const [activeSection,  setActiveSection]  = useState('lists');
  const [activeId,       setActiveId]       = useState(() => lists[0]?.id || null);
  const [inputText,      setInputText]      = useState('');
  const [storeMode,      setStoreMode]      = useState(false);
  const [editingItem,    setEditingItem]    = useState(null);
  const [deletingItem,   setDeletingItem]   = useState(null);
  const [scanDraft,      setScanDraft]      = useState(null);
  const [showScan,       setShowScan]       = useState(false);
  const [showNewList,    setShowNewList]    = useState(false);
  const [showPlanner,    setShowPlanner]    = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showUnits,      setShowUnits]      = useState(false);
  const [copyMsg,        setCopyMsg]        = useState(false);
  const [voiceError,     setVoiceError]     = useState('');
  // Store categories, the pantry tracker and the unit list are persisted in
  // Dexie; the setters keep the shapes this component already calls them with.
  const {
    categories, setCategories: updateCategories,
    pantryItems, setPantryItems,
    units, setUnits: updateUnits,
  } = useShoppingPrefs();
  const inputRef = useRef(null);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c])),
    [categories]
  );

  // Barcodes are recorded on purchase-history entries (see toggleItem below),
  // so previously-purchased products are recognized on future scans.
  const barcodeMap = useMemo(
    () => Object.fromEntries(history.filter(h => h.barcode).map(h => [h.barcode, h])),
    [history]
  );

  const activeList = lists.find(l => l.id === activeId) || lists[0];

  // ── Voice ─────────────────────────────────────────────────────────────────
  const handleVoiceResult = useCallback((transcript) => {
    parseItems(transcript).forEach(p => addItem(p)); // eslint-disable-line react-hooks/exhaustive-deps
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVoiceError = useCallback((msg) => {
    setVoiceError(msg);
    setTimeout(() => setVoiceError(''), 5000);
  }, []);

  const { listening, interim, start: startVoice, stop: stopVoice, supported: voiceOk } = useVoice(handleVoiceResult, handleVoiceError);

  // ── List / item CRUD ──────────────────────────────────────────────────────
  const updateList = useCallback((fn) => {
    setLists(prev => prev.map(l => l.id === activeList?.id ? fn(l) : l));
  }, [activeList?.id, setLists]);

  // Adds a parsed item to an arbitrary list by id (not necessarily the active one),
  // optionally overriding its category/note — used by the recipe "Add to List" flow
  // so ingredients can be routed to a user-chosen list and tagged with their source.
  const addItemToList = useCallback((listId, parsed, overrides = {}) => {
    if (!parsed?.name?.trim() || !listId) return;
    const { qty, unit, name } = parsed;
    const cat         = overrides.category || categorize(name);
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    setLists(prev => prev.map(l => {
      if (l.id !== listId) return l;
      const dup = l.items.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.checked);
      if (dup) return { ...l, items: l.items.map(i =>
        i.id === dup.id ? { ...i, qty: +(((i.qty || 1) + qty).toFixed(2)) } : i
      )};
      return { ...l, items: [...l.items, {
        id: generateId(), name: displayName, qty, unit, category: cat,
        storeLocation: '', note: overrides.note || '', estimatedPrice: null,
        barcode: overrides.barcode || '', checked: false, addedAt: new Date().toISOString(),
      }]};
    }));
  }, [setLists]);

  // Creates a fully-specified item (used by the barcode scan flow, where every
  // field is already known — either from a matched product or a manual entry —
  // rather than parsed from free text).
  const createItemInList = useCallback((listId, fields) => {
    if (!fields?.name?.trim() || !listId) return;
    const name = fields.name.trim();
    setLists(prev => prev.map(l => {
      if (l.id !== listId) return l;
      const dup = l.items.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.checked);
      if (dup) return { ...l, items: l.items.map(i =>
        i.id === dup.id ? { ...i, qty: +(((i.qty || 1) + (fields.qty || 1)).toFixed(2)), barcode: fields.barcode || i.barcode } : i
      )};
      return { ...l, items: [...l.items, {
        id: generateId(), name, qty: fields.qty || 1, unit: fields.unit || '',
        category: fields.category || categorize(name), storeLocation: fields.storeLocation || '',
        note: fields.note || '', estimatedPrice: fields.estimatedPrice ?? null, barcode: fields.barcode || '',
        checked: false, addedAt: new Date().toISOString(),
      }]};
    }));
  }, [setLists]);

  const addItem = useCallback((parsed) => {
    if (!activeList) return;
    addItemToList(activeList.id, parsed);
  }, [activeList, addItemToList]);

  // ── Barcode scanning ─────────────────────────────────────────────────────
  const addKnownProduct = useCallback((product) => {
    if (!activeList) return;
    createItemInList(activeList.id, {
      name: product.name, qty: 1, unit: product.unit || '',
      category: product.category || categorize(product.name),
      estimatedPrice: product.estimatedPrice ?? null,
      barcode: product.barcode,
    });
  }, [activeList, createItemInList]);

  // Returns { found } so the scan modal knows whether to keep scanning or hand
  // off to the "unknown code" flow (which it does by closing itself — see
  // ScanItemModal — once scanDraft is populated below).
  const handleScannedCode = useCallback((code) => {
    const product = barcodeMap[code];
    if (product) {
      addKnownProduct({ ...product, barcode: code });
      return { found: true, name: product.name };
    }
    setScanDraft({
      id: null, name: '', category: categories[0]?.id || 'other', qty: 1, unit: '',
      storeLocation: '', note: '', estimatedPrice: null, barcode: code,
    });
    return { found: false };
  }, [barcodeMap, addKnownProduct, categories]);

  const handleAdd = () => {
    if (!inputText.trim()) return;
    parseItems(inputText).forEach(p => addItem(p));
    setInputText('');
    inputRef.current?.focus();
  };

  const toggleItem = useCallback((itemId) => {
    // Read the pre-toggle item off the current list snapshot, then fire the
    // list/history/pantry updates as independent setState calls — nesting
    // setHistory/setPantryItems inside the setLists updater (as this used to)
    // triggers React's "update while rendering a different component" warning.
    const item = activeList?.items.find(i => i.id === itemId);
    const nowChecked = item && !item.checked;

    updateList(l => ({ ...l, items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i) }));

    if (nowChecked && item) {
      setHistory(prev => {
        const ex = prev.find(h => h.name.toLowerCase() === item.name.toLowerCase());
        if (ex) return prev.map(h => h.name.toLowerCase() === item.name.toLowerCase()
          ? { ...h, count: h.count + 1, lastBought: new Date().toISOString(), barcode: item.barcode || h.barcode } : h);
        return [{ name: item.name, unit: item.unit, category: item.category,
          estimatedPrice: item.estimatedPrice, barcode: item.barcode || '',
          count: 1, lastBought: new Date().toISOString() },
          ...prev].slice(0, 60);
      });
      // Purchased items restock the pantry tracker automatically
      setPantryItems(prev => {
        const idx = prev.findIndex(p => p.name.toLowerCase() === item.name.toLowerCase());
        if (idx === -1) {
          return [...prev, {
            id: generateId(), name: item.name, qty: item.qty || 1, unit: item.unit || '',
            category: item.category || 'other', parQty: Math.max(1, (item.qty || 1) * 2),
          }];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], qty: +((next[idx].qty || 0) + (item.qty || 1)).toFixed(2) };
        return next;
      });
    }
  }, [activeList, updateList, setHistory, setPantryItems]);

  const updateItem = useCallback((itemId, updates) => {
    updateList(l => ({ ...l, items: l.items.map(i => i.id === itemId ? { ...i, ...updates } : i) }));
  }, [updateList]);

  const deleteItem = useCallback((item) => {
    updateList(l => ({ ...l, items: l.items.filter(i => i.id !== item.id) }));
    setDeletingItem(null);
  }, [updateList]);

  const clearChecked = () => updateList(l => ({ ...l, items: l.items.filter(i => !i.checked) }));

  const createList = (name) => {
    const id = generateId();
    setLists(prev => [...prev, { id, name, items: [], budget: null, createdAt: new Date().toISOString() }]);
    setActiveId(id);
    setActiveSection('lists');
  };

  const deleteList = () => {
    if (lists.length <= 1) return;
    setLists(prev => prev.filter(l => l.id !== activeList.id));
    setActiveId(lists.find(l => l.id !== activeList.id)?.id || null);
  };

  const shareList = () => {
    if (!activeList) return;
    const lines = [`🛒 ${activeList.name}\n`];
    const grouped = {};
    activeList.items.filter(i => !i.checked).forEach(i => {
      if (!grouped[i.category]) grouped[i.category] = [];
      grouped[i.category].push(i);
    });
    categories.filter(c => grouped[c.id]).forEach(cat => {
      lines.push(`\n${cat.emoji} ${cat.label}`);
      grouped[cat.id].forEach(item => {
        const q = (item.qty !== 1 || item.unit) ? `${item.qty}${item.unit ? ' ' + item.unit : ''} ` : '';
        lines.push(`□ ${q}${item.name}${item.note ? ` (${item.note})` : ''}`);
      });
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyMsg(true);
      setTimeout(() => setCopyMsg(false), 2000);
    });
  };

  const handleAddToPlanner = ({ date, time }) => {
    if (!activeList || !onAddToPlanner) return;
    onAddToPlanner({
      title:      `Go shopping · ${activeList.name}`,
      priority:   'medium',
      categoryId: 'personal',
      date,
      startTime:  time,
      duration:   60,
      tags:       ['shopping'],
      reminder:   false,
      description: `${activeList.items.filter(i => !i.checked).length} items remaining`,
    });
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!activeList) return [];
    const map = {};
    activeList.items.forEach(i => { if (!map[i.category]) map[i.category] = []; map[i.category].push(i); });
    return categories.filter(c => map[c.id]).map(c => ({ cat: c, items: map[c.id] }));
  }, [activeList?.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const uncheckedCount = activeList?.items.filter(i => !i.checked).length ?? 0;
  const checkedCount   = activeList?.items.filter(i =>  i.checked).length ?? 0;
  const totalCount     = activeList?.items.length ?? 0;
  const pct            = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const estimatedTotal = activeList?.items
    .filter(i => !i.checked && i.estimatedPrice != null)
    .reduce((s, i) => s + i.estimatedPrice, 0) ?? 0;

  const suggestions = useMemo(() =>
    getSuggestions(history, activeList?.items || []),
  [history, activeList?.items]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lists center panel ─────────────────────────────────────────────────────
  const ListsCenterPanel = () => (
    <div className="shop-center-content">
      {/* List selector tabs */}
      <div className="shop-list-tabs-bar">
        <div className="shop-list-tabs">
          {lists.map(l => (
            <button key={l.id}
              className={`shop-list-chip ${activeList?.id === l.id ? 'shop-list-chip--active' : ''}`}
              onClick={() => setActiveId(l.id)}>
              {l.name}
            </button>
          ))}
        </div>
        <button className="shop-store-mode-btn" onClick={() => setStoreMode(true)}>
          <IconNavigation /><span>Store Mode</span>
        </button>
      </div>
      <div className="shop-list-secondary-actions">
        <button className="btn-ghost sm" onClick={() => setShowScan(true)} disabled={!activeList}>
          <IconBarcode /> Scan Item
        </button>
        <button className="btn-ghost sm" onClick={() => setShowCategories(true)}>Categories</button>
        <button className="btn-ghost sm" onClick={() => setShowUnits(true)}>Units</button>
        {activeList && lists.length > 1 && (
          <button className="btn-ghost sm shop-del-list" onClick={deleteList}>Delete list</button>
        )}
      </div>

      {/* Search / add bar */}
      <div className="shop-search-bar">
        <span className="shop-search-icon"><IconCart /></span>
        <input
          ref={inputRef}
          className="shop-search-input"
          placeholder={listening
            ? (interim || 'Listening… try "2 lbs chicken and a dozen eggs"')
            : 'Add 2 lbs beef + eggs, milk… or speak items'}
          value={listening ? interim : inputText}
          onChange={e => !listening && setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !listening && handleAdd()}
          readOnly={listening}
        />
        <button
          className={`shop-mic-btn${listening ? ' shop-mic-btn--on' : ''}`}
          onClick={listening ? stopVoice : startVoice}
          disabled={!voiceOk}
          title={voiceOk ? (listening ? 'Stop' : 'Voice input') : 'Voice not supported'}>
          <IconMic />
          {listening && <span className="mic-ring" />}
        </button>
        <button className="shop-search-add" onClick={handleAdd} disabled={!inputText.trim() || listening}>
          <IconPlus />
        </button>
      </div>
      {voiceError && <p className="shop-voice-error">{voiceError}</p>}

      {/* Progress bar */}
      <div className="shop-progress-track">
        <div className="shop-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* List header */}
      {activeList && (
        <div className="shop-list-hdr">
          <div className="shop-list-hdr-left">
            <h2 className="shop-list-hdr-title">{activeList.name}</h2>
            <span className="shop-list-hdr-meta">
              {uncheckedCount} of {totalCount} items · {pct}% done
              {estimatedTotal > 0 && ` · ~$${estimatedTotal.toFixed(2)} left`}
            </span>
          </div>
          <div className="shop-list-hdr-actions">
            {checkedCount > 0 && (
              <button className="btn-ghost sm" onClick={clearChecked}>Clear checked</button>
            )}
            <button className="btn-ghost sm" onClick={shareList}>
              <IconShare /> {copyMsg ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>
      )}

      {/* Suggestions strip */}
      {suggestions.length > 0 && (
        <div className="shop-pills">
          <span className="shop-pills-label">Add again</span>
          {suggestions.map(s => {
            const sc = catMap[s.category];
            return (
              <button key={s.name} className="shop-pill"
                onClick={() => addItem({ qty: 1, unit: s.unit || '', name: s.name })}>
                {sc?.emoji} {s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Items scroll */}
      <div className="shop-center-scroll">
        {!activeList || grouped.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 44 }}>🛒</span>
            <p className="empty-title">Your list is empty</p>
            <p className="empty-sub">Type above, use voice, or add from suggestions</p>
          </div>
        ) : (
          grouped.map(({ cat, items }) => (
            <CategorySection key={cat.id} cat={cat} items={items}
              onToggle={toggleItem}
              onUpdate={updateItem}
              onEdit={item => setEditingItem(item)}
              onDelete={item => setDeletingItem(item)} />
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
    <div className={`shop-shell${storeMode ? ' shop-shell--store' : ''}`}>
      {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
      <div className="shop-left">
        <div className="shop-left-header">
          <span className="shop-left-title">Smart Shopping</span>
        </div>

        {/* Nav */}
        <nav className="shop-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`shop-nav-item ${activeSection === id ? 'shop-nav-item--active' : ''}`}
              onClick={() => setActiveSection(id)}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* FAB */}
        <button className="shop-fab" onClick={() => setShowNewList(true)}>
          <IconPlus />
          <span>New Shopping List</span>
        </button>
      </div>

      {/* ── CENTER PANEL ──────────────────────────────────────────────────── */}
      <div className="shop-center">
        {activeSection === 'lists' && storeMode && activeList
          ? <ShoppingStoreMode list={activeList} onToggle={toggleItem} onClose={() => setStoreMode(false)} categories={categories} />
          : activeSection === 'lists' && ListsCenterPanel()
        }
        {activeSection === 'recipes' && (
          <RecipesView
            recipes={recipes}
            onSaveRecipe={setRecipes}
            onDeleteRecipe={id => setRecipes(r => r.filter(x => x.id !== id))}
            onAddIngredients={(items, targetListId, recipeName) => {
              items.forEach(i => addItemToList(targetListId, i, {
                category: 'recipes',
                note: `Recipes - ${recipeName}`,
              }));
              setActiveId(targetListId);
              setActiveSection('lists');
            }}
            lists={lists}
            activeListId={activeList?.id}
            pantryItems={pantryItems}
            onSavePantry={setPantryItems}
            units={units} />
        )}
        {activeSection === 'budget' && (
          <BudgetView lists={lists} />
        )}
        {activeSection === 'items'  && <AllItemsView lists={lists} catMap={catMap} categories={categories} />}
        {activeSection === 'stores' && <StoresView lists={lists} />}
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <div className="shop-right">
        {/* Smart Suggestions */}
        <div className="shop-right-section">
          <h3 className="shop-right-title"><IconSparkle /> Smart Suggestions</h3>
          {suggestions.length === 0 ? (
            <p className="shop-right-empty">No suggestions yet. Check off items to build history.</p>
          ) : (
            <div className="shop-sugg-list">
              {suggestions.map(s => {
                const cat = catMap[s.category];
                return (
                  <div key={s.name} className="shop-sugg-tile" style={{ '--cc': cat?.color }}>
                    <div className="shop-sugg-icon">{cat?.emoji || '🛒'}</div>
                    <div className="shop-sugg-info">
                      <span className="shop-sugg-name">{s.name}</span>
                      <span className="shop-sugg-meta">
                        {s.count > 1 ? `Bought ${s.count}×` : 'Bought once'} · {daysSince(s.lastBought)}d ago
                      </span>
                    </div>
                    <button className="shop-sugg-add"
                      onClick={() => addItem({ qty: 1, unit: s.unit || '', name: s.name })}>
                      <IconPlus />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Re-Add */}
        {history.length > 0 && (
          <div className="shop-right-section">
            <h3 className="shop-right-title-sm">QUICK RE-ADD</h3>
            <div className="shop-pills shop-pills--wrap">
              {history.slice(0, 10).map(h => (
                <button key={h.name} className="shop-pill"
                  onClick={() => addItem({ qty: 1, unit: h.unit || '', name: h.name })}>
                  {catMap[h.category]?.emoji} {h.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recipe of the Week */}
        {recipes.length > 0 && (
          <div className="shop-right-section">
            <div className="shop-recipe-week-card">
              <div className="shop-recipe-week-bg">
                <span className="shop-recipe-week-emoji">🍽️</span>
              </div>
              <div className="shop-recipe-week-body">
                <span className="shop-recipe-week-label">RECIPE OF THE WEEK</span>
                <h4 className="shop-recipe-week-name">{recipes[0].name}</h4>
                <button className="shop-recipe-week-btn"
                  onClick={() => {
                    if (!activeList) return;
                    recipes[0].ingredients.forEach(i => addItemToList(activeList.id, i, {
                      category: 'recipes',
                      note: `Recipes - ${recipes[0].name}`,
                    }));
                    setActiveSection('lists');
                  }}>
                  Add {recipes[0].ingredients.length} ingredient{recipes[0].ingredients.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add to Planner */}
        {activeList && (
          <div className="shop-right-section">
            <button className="shop-planner-btn" onClick={() => setShowPlanner(true)}>
              <IconCalendar />
              <div>
                <div className="shop-planner-btn-title">Add to Planner</div>
                <div className="shop-planner-btn-sub">Schedule "Go shopping · {activeList.name}"</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {(editingItem || scanDraft) && (
        <EditItemModal
          item={editingItem || scanDraft}
          isNew={!editingItem}
          categories={categories}
          units={units}
          onSave={updates => {
            if (editingItem) updateItem(editingItem.id, updates);
            else createItemInList(activeList?.id, updates);
            setEditingItem(null);
            setScanDraft(null);
          }}
          onClose={() => { setEditingItem(null); setScanDraft(null); }} />
      )}

      {showScan && (
        <ScanItemModal
          onCode={handleScannedCode}
          onClose={() => setShowScan(false)} />
      )}

      {deletingItem && (
        <DeleteConfirmModal
          item={deletingItem}
          onConfirm={() => deleteItem(deletingItem)}
          onClose={() => setDeletingItem(null)} />
      )}

      {showNewList && (
        <NewListDialog onCreate={createList} onClose={() => setShowNewList(false)} />
      )}

      {showPlanner && (
        <AddToPlannerModal
          listName={activeList?.name || ''}
          onAdd={handleAddToPlanner}
          onClose={() => setShowPlanner(false)} />
      )}

      {showCategories && (
        <ManageCategoriesModal
          categories={categories}
          onSave={updateCategories}
          onClose={() => setShowCategories(false)} />
      )}

      {showUnits && (
        <ManageUnitsModal
          units={units}
          onSave={updateUnits}
          onClose={() => setShowUnits(false)} />
      )}
    </div>

    {/* ── Mobile bottom navigation ─────────────────────────────────────── */}
    {!storeMode && (
      <nav className="shop-bottom-nav">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id}
            className={`shop-bnav-item ${activeSection === id ? 'shop-bnav-item--active' : ''}`}
            onClick={() => setActiveSection(id)}>
            <Icon />
            <span className="shop-bnav-label">{label}</span>
          </button>
        ))}
        <button className="shop-bnav-item shop-bnav-new" onClick={() => setShowNewList(true)}>
          <IconPlus />
          <span className="shop-bnav-label">New</span>
        </button>
      </nav>
    )}
    </>
  );
}
