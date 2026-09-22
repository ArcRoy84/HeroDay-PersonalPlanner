import React from 'react';
import { CATEGORIES as DEFAULT_CATEGORIES } from '../data/shoppingCategories.js';
import { PriceEditor } from './shopping/priceEditor.jsx';
import { money } from '../utils/format';

const IconCheck    = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 10 8 14 16 6"/></svg>;
const IconLocation = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="5" r="2"/><path d="M6 1a4 4 0 0 1 4 4c0 3-4 7-4 7S2 8 2 5a4 4 0 0 1 4-4z"/></svg>;
const IconArrow    = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4.5h10M8 1.5l3 3-3 3"/><path d="M14 10.5H4M7 7.5l-3 3 3 3"/></svg>;

export default function ShoppingStoreMode({
  list, onToggle, onClose, categories = DEFAULT_CATEGORIES,
  // Registering a price while shopping — see shopping/priceEditor.jsx. All
  // optional, so a caller that has no purchase data yet still gets a working
  // (read-only) Store Mode.
  purchaseByItem, stores = [], onConfirmPrice, lastPriceForItem,
}) {
  const items        = list.items;
  const total        = items.length;
  const checkedCount = items.filter(i => i.checked).length;
  const remaining    = total - checkedCount;
  const pct          = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  // What a checked item actually contributes to the totals below: the price
  // someone is registering for it if there is one, else the list's estimate.
  const amountFor = (item) => {
    const purchase = purchaseByItem?.get(item.id);
    return purchase && purchase.price !== null ? purchase.price : item.estimatedPrice;
  };

  const totalLeft = items
    .filter(i => !i.checked && i.estimatedPrice != null)
    .reduce((s, i) => s + i.estimatedPrice, 0);
  const runningTotal = items
    .filter(i => i.checked)
    .reduce((s, i) => s + (amountFor(i) ?? 0), 0);
  const totalEstimated = items
    .filter(i => i.estimatedPrice != null)
    .reduce((s, i) => s + i.estimatedPrice, 0);
  const hasPrices    = totalEstimated > 0;
  const allDone      = remaining === 0 && total > 0;

  // Checked, but the price is still whatever was pre-filled — it will not show
  // up in Items until someone confirms it (see analytics/price.ts).
  const unconfirmedCount = purchaseByItem
    ? items.filter(i => i.checked && purchaseByItem.get(i.id) && !purchaseByItem.get(i.id).confirmed).length
    : 0;

  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  return (
    <div className="smode">
      {/* ── Gradient progress strip ── */}
      <div className="smode-progress">
        <div className="smode-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* ── Header ── */}
      <div className="smode-header">
        <div className="smode-header-left">
          <span className="smode-list-name">🛒 {list.name}</span>
          <div className="smode-stats-row">
            {allDone ? (
              <span className="smode-stat smode-stat--done">All items checked ✅</span>
            ) : (
              <>
                <span className="smode-stat">
                  <strong>{remaining}</strong> left of {total}
                </span>
                <span className="smode-stat-sep">·</span>
                <span className="smode-stat">{pct}% done</span>
                {totalLeft > 0 && (
                  <>
                    <span className="smode-stat-sep">·</span>
                    <span className="smode-stat smode-stat--price">~${totalLeft.toFixed(2)} left</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <button className="smode-close-btn" onClick={onClose}>
          <IconArrow />
          Exit Store Mode
        </button>
      </div>

      {/* ── Progress summary bar ── */}
      <div className="smode-summary">
        <div className="smode-summary-track">
          <div className="smode-summary-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="smode-summary-label">{checkedCount} / {total}</span>
      </div>

      {/* ── Running Total ── */}
      <div className="smode-total">
        <div className="smode-total-left">
          <span className="smode-total-label">Running Total</span>
          {hasPrices && (
            <span className="smode-total-sub">
              {totalLeft > 0 ? `~$${totalLeft.toFixed(2)} remaining` : 'All priced items checked'}
            </span>
          )}
        </div>
        <span className={`smode-total-amount ${allDone ? 'smode-total-amount--done' : ''}`}>
          ${runningTotal.toFixed(2)}
        </span>
      </div>
      {hasPrices && totalEstimated > 0 && (
        <div className="smode-total-bar-wrap">
          <div className="smode-total-bar">
            <div
              className="smode-total-bar-fill"
              style={{ width: `${Math.min(100, (runningTotal / totalEstimated) * 100)}%` }}
            />
          </div>
          <span className="smode-total-bar-label">of ~${totalEstimated.toFixed(2)} est.</span>
        </div>
      )}

      {/* ── Items ── */}
      <div className="smode-body">
        {allDone && (
          <div className="smode-all-done">
            <span className="smode-all-done-icon">🎉</span>
            <p className="smode-all-done-title">Shopping complete!</p>
            <p className="smode-all-done-sub">All {total} items checked off.</p>
            {hasPrices && (
              <p className="smode-all-done-total">
                {unconfirmedCount > 0 ? 'Total so far: ' : 'Total spent: '}
                <strong>${runningTotal.toFixed(2)}</strong>
              </p>
            )}
            {unconfirmedCount > 0 && (
              <p className="smode-all-done-warn">
                {unconfirmedCount} price{unconfirmedCount === 1 ? '' : 's'} below still need{unconfirmedCount === 1 ? 's' : ''} confirming
                — only confirmed prices are counted in Items.
              </p>
            )}
            <button className="smode-close-btn smode-close-btn--lg" onClick={onClose}>
              Done shopping
            </button>
          </div>
        )}

        {categories.filter(cat => grouped[cat.id]).map(cat => {
          const catItems  = grouped[cat.id];
          const catRemain = catItems.filter(i => !i.checked).length;
          const catDone   = catItems.filter(i =>  i.checked).length;

          return (
            <div key={cat.id} className="smode-cat">
              {/* Category header */}
              <div className="smode-cat-hdr" style={{ '--cc': cat.color }}>
                <span className="smode-cat-emoji">{cat.emoji}</span>
                <span className="smode-cat-name">{cat.label}</span>
                <div className="smode-cat-meta">
                  {catRemain > 0 && (
                    <span className="smode-cat-count">{catRemain} left</span>
                  )}
                  {catDone > 0 && catRemain === 0 && (
                    <span className="smode-cat-count smode-cat-count--done">✓ done</span>
                  )}
                </div>
              </div>

              {/* Items in category */}
              <div className="smode-items">
                {/* Unchecked first — the whole row is the tap target to check it off. */}
                {catItems.filter(i => !i.checked).map(item => (
                  <button
                    key={item.id}
                    className="smode-item"
                    onClick={() => onToggle(item.id)}
                  >
                    <div className="smode-checkbox">
                      <div className="smode-checkbox-ring" />
                    </div>
                    <div className="smode-item-body">
                      <span className="smode-item-name">{item.name}</span>
                      <div className="smode-item-meta">
                        {(item.qty !== 1 || item.unit) && (
                          <span className="smode-item-qty">
                            {item.qty}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        )}
                        {item.storeLocation && (
                          <span className="smode-item-loc">
                            <IconLocation /> {item.storeLocation}
                          </span>
                        )}
                        {item.note && (
                          <span className="smode-item-note">{item.note}</span>
                        )}
                      </div>
                    </div>
                    {item.estimatedPrice != null && (
                      <span className="smode-item-price">${item.estimatedPrice.toFixed(2)}</span>
                    )}
                  </button>
                ))}

                {/* Checked items — a plain row (not a button) because a price
                    still to confirm puts a real form inside it. */}
                {catItems.filter(i => i.checked).map(item => {
                  const purchase = purchaseByItem?.get(item.id);
                  const pending  = purchase && !purchase.confirmed && onConfirmPrice;
                  return (
                    <div key={item.id} className={`smode-item smode-item--row ${pending ? '' : 'smode-item--done'}`}>
                      <button
                        type="button"
                        className="smode-checkbox smode-checkbox--checked"
                        onClick={() => onToggle(item.id)}
                        aria-label={`Mark ${item.name} not bought`}
                        title="Mark not bought"
                      >
                        <IconCheck />
                      </button>
                      <div className="smode-item-body">
                        <span className="smode-item-name">{item.name}</span>
                        {pending ? (
                          <PriceEditor
                            item={item} purchase={purchase} stores={stores}
                            lastPrice={lastPriceForItem?.(item)}
                            onConfirm={onConfirmPrice}
                          />
                        ) : (
                          <div className="smode-item-meta">
                            {(item.qty !== 1 || item.unit) && (
                              <span className="smode-item-qty">
                                {item.qty}{item.unit ? ` ${item.unit}` : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {purchase?.confirmed && purchase.price !== null ? (
                        <span className="sic-paid-done" title="You confirmed this price">Paid {money(purchase.price)}</span>
                      ) : !pending && item.estimatedPrice != null ? (
                        <span className="smode-item-price">${item.estimatedPrice.toFixed(2)}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="smode-empty">
            <span>🛒</span>
            <p>This list is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
