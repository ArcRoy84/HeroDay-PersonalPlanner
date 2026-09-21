// A single shopping item, and the category group it renders inside.
import React, { useState } from 'react';
import { IconLocation, IconBarcodeSm, IconMinus, IconPlus, IconLink, IconPencil, IconTrash, IconCheck, IconChevron } from './icons.jsx';
import { money, parseMoneyInput } from '../../utils/format';

/**
 * "What did you pay?" — shown on a ticked item until its price is confirmed.
 *
 * The field arrives pre-filled (the item's estimate, or the last price paid), so
 * confirming what is already right is a single tap; correcting it is a type and
 * a tap. Leaving it alone is fine too: the purchase is still recorded, it just
 * does not count towards prices until someone confirms it. The store picker only
 * appears when the list has no store to take it from.
 */
function PriceEditor({ item, purchase, stores, onConfirm }) {
  const [text, setText] = useState(purchase.price === null ? '' : purchase.price.toFixed(2));
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const needsStore = purchase.storeId === null && stores.length > 0;

  async function confirm(event) {
    event.preventDefault();
    const price = parseMoneyInput(text);
    if (price === null || Number.isNaN(price)) {
      setError('Enter what you paid, like 4.29');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm(purchase.id, { price, ...(needsStore && storeId ? { storeId } : {}) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the price');
      setBusy(false);
    }
  }

  return (
    <form className="sic-paid" onSubmit={confirm} noValidate>
      <span className="sic-paid-label">Paid</span>
      <input className="form-input sic-paid-input" inputMode="decimal" value={text} placeholder="0.00"
        onChange={e => setText(e.target.value)} aria-label={`Price paid for ${item.name}`} />
      {needsStore && (
        <select className="form-input sic-paid-store" value={storeId}
          onChange={e => setStoreId(e.target.value)} aria-label="Store">
          <option value="">Store…</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
      )}
      <button type="submit" className="sic-paid-ok" disabled={busy}
        aria-label={`Confirm price for ${item.name}`} title="Confirm price"><IconCheck /></button>
      {error && <span className="sic-paid-error" role="alert">{error}</span>}
    </form>
  );
}

function ItemCard({ item, cat, purchase, stores, onConfirmPrice, onToggle, onUpdate, onEdit, onDelete }) {
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
          {item.checked && purchase?.confirmed && purchase.price !== null && (
            <span className="sic-paid-done" title="You confirmed this price">Paid {money(purchase.price)}</span>
          )}
        </div>
        {item.checked && purchase && !purchase.confirmed && onConfirmPrice && (
          <PriceEditor item={item} purchase={purchase} stores={stores ?? []} onConfirm={onConfirmPrice} />
        )}
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
function CategorySection({
  cat, items, purchaseByItem, stores, onConfirmPrice, onToggle, onUpdate, onEdit, onDelete,
}) {
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
              purchase={purchaseByItem?.get(item.id)} stores={stores} onConfirmPrice={onConfirmPrice}
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
              purchase={purchaseByItem?.get(item.id)} stores={stores} onConfirmPrice={onConfirmPrice}
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
