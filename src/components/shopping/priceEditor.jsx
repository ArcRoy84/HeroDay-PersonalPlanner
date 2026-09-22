// "What did you pay?" — shown on a ticked item until its price is confirmed.
// Shared by the regular list (items.jsx) and Store Mode, so confirming a price
// works the same way everywhere.
import React, { useState } from 'react';
import { IconCheck } from './icons.jsx';
import { money, parseMoneyInput } from '../../utils/format';

/**
 * The field arrives pre-filled (the item's estimate, or the last price paid), so
 * confirming what is already right is a single tap; correcting it is a type and
 * a tap. Leaving it alone is fine too: the purchase is still recorded, it just
 * does not count towards prices until someone confirms it. The store picker only
 * appears when the list has no store to take it from.
 *
 * `lastPrice`, when given, is the last *confirmed* price for this exact quantity
 * — shown for context, and one tap away via "Same as last" when the pre-filled
 * price is not what actually happened this time (an estimate, or nothing).
 */
export function PriceEditor({ item, purchase, stores, lastPrice, onConfirm }) {
  const [text, setText] = useState(purchase.price === null ? '' : purchase.price.toFixed(2));
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const needsStore = purchase.storeId === null && stores.length > 0;
  const sameAsLast = lastPrice != null && text !== lastPrice.toFixed(2);

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
      {lastPrice != null && (
        <button type="button" className="sic-paid-same" disabled={!sameAsLast}
          onClick={() => setText(lastPrice.toFixed(2))}>
          Same as last ({money(lastPrice)})
        </button>
      )}
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
