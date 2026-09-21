// Everything about one product: the numbers, the price history, how the stores
// compare, and every purchase — which you can correct, confirm or void.
import React, { useState, useEffect } from 'react';
import { IconX, IconPencil, IconTrash, IconPlus, IconCheck } from './icons.jsx';
import { PriceChart } from './charts.jsx';
import {
  ProductThumb, TrendBadge, OpportunityChip, RestockMeter,
} from './productParts.jsx';
import { StoreIcon } from './stores.jsx';
import {
  money, shortDate, lastPurchasedLabel, intervalLabel, plural, parseMoneyInput,
} from '../../utils/format';
import { toLocalDate } from '../../utils/products';
import { newestFirst, unitPriceOf } from '../../analytics/price';
import { describeVariant } from '../../db/productOps';

function StatBox({ label, value, sub }) {
  return (
    <div className="pstat">
      <span className="pstat-label">{label}</span>
      <span className="pstat-value">{value}</span>
      {sub && <span className="pstat-sub">{sub}</span>}
    </div>
  );
}

function StoreCell({ store }) {
  if (!store) return <span className="ptable-none">—</span>;
  return (
    <span className="ptable-store">
      <StoreIcon store={store} size={16} />
      <span>{store.name}</span>
    </span>
  );
}

/** How a purchase's price stands, in words — colour is never the only signal. */
function statusOf(purchase) {
  if (purchase.source === 'legacy') return { text: 'Earlier purchase', tone: 'muted', title: 'From before purchases were tracked; the price was never recorded' };
  if (purchase.price === null) return { text: 'No price', tone: 'muted', title: 'No price was recorded' };
  if (!purchase.confirmed) return { text: 'Assumed', tone: 'warn', title: 'Pre-filled from an estimate — confirm it to count it in the analytics' };
  return { text: 'Confirmed', tone: 'ok', title: 'You confirmed this price' };
}

/** One row of the history table, editable in place. */
function PurchaseRow({ purchase, storeMap, stores, actions }) {
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const store = purchase.storeId ? storeMap[purchase.storeId] : null;
  const status = statusOf(purchase);
  const unit = unitPriceOf(purchase);

  function startEdit() {
    setDraft({
      date: purchase.date,
      qty: String(purchase.qty),
      price: purchase.price === null ? '' : String(purchase.price),
      storeId: purchase.storeId ?? '',
    });
    setError('');
    setEditing(true);
  }

  async function run(work) {
    setBusy(true);
    setError('');
    try {
      await work();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const price = parseMoneyInput(draft.price);
    if (Number.isNaN(price)) { setError('Enter a valid price, like 4.29.'); return; }
    const ok = await run(() => actions.updatePurchase(purchase.id, {
      date: draft.date,
      qty: Number(draft.qty),
      price,
      storeId: draft.storeId || null,
    }));
    if (ok) setEditing(false);
  }

  if (editing) {
    return (
      <tr className="ptable-edit">
        <td colSpan={6}>
          <div className="prow-form">
            <label>Date
              <input type="date" className="form-input" value={draft.date} max={toLocalDate()}
                onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} />
            </label>
            <label>Qty
              <input className="form-input" inputMode="decimal" value={draft.qty}
                onChange={e => setDraft(d => ({ ...d, qty: e.target.value }))} />
            </label>
            <label>Total paid
              <input className="form-input" inputMode="decimal" value={draft.price} placeholder="No price"
                onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} />
            </label>
            <label>Store
              <select className="form-input" value={draft.storeId}
                onChange={e => setDraft(d => ({ ...d, storeId: e.target.value }))}>
                <option value="">No store</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </label>
            <span className="prow-form-actions">
              <button type="button" className="btn-ghost sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
              <button type="button" className="btn-primary sm" onClick={save} disabled={busy}>Save</button>
            </span>
          </div>
          {error && <p className="store-msg store-msg--error" role="alert">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr>
        <td>{shortDate(purchase.date)}</td>
        <td><StoreCell store={store} /></td>
        <td className="ptable-num">{purchase.qty}</td>
        <td className="ptable-num">
          {purchase.price === null ? '—' : money(purchase.price)}
          {unit !== null && purchase.qty !== 1 && <span className="ptable-unit">{money(unit)} each</span>}
        </td>
        <td>
          <span className={`pstatus pstatus--${status.tone}`} title={status.title}>{status.text}</span>
        </td>
        <td className="ptable-actions">
          {voiding ? (
            <>
              <span className="ptable-ask">Void this purchase?</span>
              <button type="button" className="btn-ghost sm" onClick={() => setVoiding(false)} disabled={busy}>No</button>
              <button type="button" className="btn-ghost sm ptable-danger" disabled={busy}
                onClick={() => run(() => actions.removePurchase(purchase.id))}>Void</button>
            </>
          ) : (
            <>
              {!purchase.confirmed && purchase.price !== null && (
                <button type="button" className="btn-ghost sm" disabled={busy}
                  onClick={() => run(() => actions.confirmPurchase(purchase.id, { price: purchase.price }))}
                  aria-label={`Confirm the ${money(purchase.price)} price from ${shortDate(purchase.date)}`}>
                  <IconCheck /> Confirm
                </button>
              )}
              <button type="button" className="sic-act" onClick={startEdit}
                aria-label={`Edit the purchase from ${shortDate(purchase.date)}`} title="Edit"><IconPencil /></button>
              <button type="button" className="sic-act sic-act--del" onClick={() => setVoiding(true)}
                aria-label={`Void the purchase from ${shortDate(purchase.date)}`} title="Void"><IconTrash /></button>
            </>
          )}
        </td>
      </tr>
      {error && (
        <tr><td colSpan={6}><p className="store-msg store-msg--error" role="alert">{error}</p></td></tr>
      )}
    </>
  );
}

/** Log a purchase after the fact, e.g. from a receipt. */
function LogPurchaseForm({ stores, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState({ date: toLocalDate(), qty: '1', price: '', storeId: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setFields(f => ({ ...f, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    const price = parseMoneyInput(fields.price);
    if (Number.isNaN(price)) { setError('Enter a valid price, like 4.29.'); return; }
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        date: fields.date, qty: Number(fields.qty), price, storeId: fields.storeId || null,
      });
      setFields(f => ({ ...f, price: '', qty: '1' }));
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not log the purchase.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost sm" onClick={() => setOpen(true)}>
        <IconPlus /> Log a past purchase
      </button>
    );
  }

  return (
    <form className="plog" onSubmit={submit} noValidate aria-label="Log a past purchase">
      <div className="prow-form">
        <label>Date
          <input type="date" className="form-input" value={fields.date} max={toLocalDate()}
            onChange={e => set('date', e.target.value)} />
        </label>
        <label>Qty
          <input className="form-input" inputMode="decimal" value={fields.qty}
            onChange={e => set('qty', e.target.value)} />
        </label>
        <label>Total paid
          <input className="form-input" inputMode="decimal" value={fields.price} placeholder="e.g. 4.29"
            onChange={e => set('price', e.target.value)} autoFocus />
        </label>
        <label>Store
          <select className="form-input" value={fields.storeId} onChange={e => set('storeId', e.target.value)}>
            <option value="">No store</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </label>
        <span className="prow-form-actions">
          <button type="button" className="btn-ghost sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary sm" disabled={busy}>Log purchase</button>
        </span>
      </div>
      {error && <p className="store-msg store-msg--error" role="alert">{error}</p>}
    </form>
  );
}

function ProductModal({
  product, stats, purchases, category, stores, storeMap, lists, activeListId, onList,
  onClose, onEdit, onDelete, onAddToList, actions, escapeDisabled = false,
}) {
  const [listId, setListId] = useState(activeListId ?? lists[0]?.id ?? '');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !escapeDisabled) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, escapeDisabled]);

  useEffect(() => {
    if (!added) return undefined;
    const timer = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(timer);
  }, [added]);

  const history = [...purchases].sort(newestFirst);
  const variant = describeVariant(product);
  const storeName = id => storeMap[id]?.name ?? 'a store';

  // The chart plots confirmed unit prices, oldest first.
  const points = [...history].reverse()
    .map(p => ({ p, unit: unitPriceOf(p) }))
    .filter(x => x.unit !== null)
    .map(({ p, unit }) => ({ date: p.date, unitPrice: unit, qty: p.qty, storeId: p.storeId }));

  const pricedStores = stats.stores.filter(s => s.avgUnitPrice !== null)
    .sort((a, b) => a.avgUnitPrice - b.avgUnitPrice);
  const cheapest = stats.bestStoreId ? storeMap[stats.bestStoreId] : null;
  const dearest = pricedStores.length >= 2 ? pricedStores[pricedStores.length - 1] : null;

  async function handleAdd() {
    if (!listId) return;
    await onAddToList(product.id, listId);
    setAdded(true);
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--xl pmodal" role="dialog" aria-modal="true"
        aria-label={`${product.name} details`}>
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Item details</h4>
          <button type="button" className="sic-act" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <div className="pmodal-body">
          <header className="pmodal-head">
            <ProductThumb product={product} category={category} size={72} />
            <div className="pmodal-titles">
              <h2 className="pmodal-name">{product.name}</h2>
              <p className="pmodal-sub">
                {category ? `${category.emoji} ${category.label}` : 'Uncategorised'}
                {variant && ` · ${variant}`}
                {product.barcode && ` · ${product.barcode}`}
              </p>
              <div className="pmodal-badges">
                <TrendBadge trend={stats.trend} />
                <OpportunityChip opportunity={stats.opportunity} />
              </div>
            </div>
            <div className="pmodal-actions">
              <button type="button" className="btn-ghost sm" onClick={() => onEdit(product)}><IconPencil /> Edit</button>
              <button type="button" className="btn-ghost sm ptable-danger" onClick={() => onDelete(product)}>
                <IconTrash /> Delete
              </button>
            </div>
          </header>

          {lists.length > 0 && (
            <div className="pmodal-addrow">
              <select className="form-input" value={listId} onChange={e => setListId(e.target.value)}
                aria-label="List to add to">
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <button type="button" className="btn-primary sm" onClick={handleAdd}>
                {added ? <><IconCheck /> Added</> : <><IconPlus /> Add to list</>}
              </button>
            </div>
          )}

          <div className="pstats">
            <StatBox label="Last paid"
              value={stats.lastPrice ? money(stats.lastPrice.unitPrice) : '—'}
              sub={stats.lastPrice
                ? `${shortDate(stats.lastPrice.date)}${stats.lastPrice.storeId ? ` · ${storeName(stats.lastPrice.storeId)}` : ''}`
                : 'No confirmed price yet'} />
            <StatBox label="Average"
              value={stats.avgUnitPrice !== null ? money(stats.avgUnitPrice) : '—'}
              sub={stats.minUnitPrice !== null && stats.maxUnitPrice !== null
                ? `${money(stats.minUnitPrice)} – ${money(stats.maxUnitPrice)}`
                : undefined} />
            <StatBox label="Times bought" value={stats.timesPurchased}
              sub={`${stats.purchasesThisYear} this year`} />
            <StatBox label="Total spent" value={money(stats.totalSpent)}
              sub={`${stats.totalQty} bought in all`} />
            <StatBox label="Buying rhythm"
              value={stats.intervalDays ? intervalLabel(stats.intervalDays) : 'Not enough history'}
              sub={stats.lastPurchase ? `Last bought ${lastPurchasedLabel(stats.lastPurchase.date).toLowerCase()}` : undefined} />
            <StatBox label="Best price"
              value={cheapest ? cheapest.name : '—'}
              sub={cheapest && dearest && stats.storeSpread !== null
                ? `${money(stats.storeSpread)} less per unit than ${storeName(dearest.storeId)}`
                : 'Needs prices at two stores'} />
          </div>

          {stats.timesPurchased > 0 && (
            <section className="pmodal-section">
              <h3 className="pmodal-h">Restock</h3>
              <RestockMeter restock={stats.restock} onList={onList} />
            </section>
          )}

          <section className="pmodal-section">
            <h3 className="pmodal-h">Price history</h3>
            <PriceChart points={points} storeName={storeName} />
          </section>

          {pricedStores.length > 0 && (
            <section className="pmodal-section">
              <h3 className="pmodal-h">Store comparison</h3>
              <table className="ptable">
                <thead>
                  <tr>
                    <th scope="col">Store</th>
                    <th scope="col" className="ptable-num">Bought</th>
                    <th scope="col" className="ptable-num">Last</th>
                    <th scope="col" className="ptable-num">Average</th>
                    <th scope="col" className="ptable-num">Lowest</th>
                  </tr>
                </thead>
                <tbody>
                  {pricedStores.map(s => (
                    <tr key={s.storeId}>
                      <td>
                        <StoreCell store={storeMap[s.storeId]} />
                        {s.storeId === stats.bestStoreId && <span className="ptag">Cheapest</span>}
                      </td>
                      <td className="ptable-num">{s.purchases}</td>
                      <td className="ptable-num">{money(s.lastUnitPrice)}</td>
                      <td className="ptable-num">{money(s.avgUnitPrice)}</td>
                      <td className="ptable-num">{money(s.minUnitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="pmodal-section">
            <h3 className="pmodal-h">Purchases</h3>
            {history.length === 0 ? (
              <p className="pchart-empty">
                No purchases recorded. Tick this item off a list, or log one below.
              </p>
            ) : (
              <table className="ptable">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Store</th>
                    <th scope="col" className="ptable-num">Qty</th>
                    <th scope="col" className="ptable-num">Paid</th>
                    <th scope="col">Price</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(p => (
                    <PurchaseRow key={p.id} purchase={p} storeMap={storeMap} stores={stores} actions={actions} />
                  ))}
                </tbody>
              </table>
            )}
            {product.priorPurchases > 0 && (
              <p className="store-hint">
                Plus {plural(product.priorPurchases, 'earlier purchase')} from before purchases were tracked (dates unknown).
              </p>
            )}
            <LogPurchaseForm stores={stores}
              onSubmit={input => actions.logPastPurchase(product.id, input)} />
          </section>

          {product.notes && (
            <section className="pmodal-section">
              <h3 className="pmodal-h">Notes</h3>
              <p className="pmodal-notes">{product.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export { ProductModal };
