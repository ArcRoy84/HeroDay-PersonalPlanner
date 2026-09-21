// Create/edit form for one shopping item.
import React, { useState } from 'react';
import { IconX, IconLink } from './icons.jsx';

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

export { EditItemModal };
