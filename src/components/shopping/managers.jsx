// Editors for the store category list and the unit vocabulary.
import React, { useState } from 'react';
import { IconX, IconPlus, IconTrash, IconPencil } from './icons.jsx';
import { CAT_COLORS } from './constants.js';

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

export { ManageCategoriesModal, ManageUnitsModal };
