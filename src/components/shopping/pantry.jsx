// Pantry stock tracker and its editor.
import React, { useState } from 'react';
import { newId } from '../../db/ids';
import { CATEGORY_MAP, categorize } from '../../data/shoppingCategories.js';
import { IconX, IconPlus, IconMinus, IconTrash } from './icons.jsx';
import { pantryPct, pantryColor } from './parsing.js';

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
      id: newId(), name: name.trim(), qty: parseFloat(qty) || 0,
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

export { PantryTracker, PantryManageModal };
