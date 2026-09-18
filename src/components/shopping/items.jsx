// A single shopping item, and the category group it renders inside.
import React, { useState } from 'react';
import { IconLocation, IconBarcodeSm, IconMinus, IconPlus, IconLink, IconPencil, IconTrash, IconCheck, IconChevron } from './icons.jsx';

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

export { ItemCard, CategorySection };
