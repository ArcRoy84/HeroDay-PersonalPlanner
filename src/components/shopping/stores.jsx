// Stores: the icon, a store card, and the Stores tab.
import React from 'react';
import { IconPlus, IconPencil, IconTrash, IconLocation } from './icons.jsx';
import { formatAddressLines, isSafeLogo } from '../../utils/stores';
import { mapUrl } from '../../utils/geo';

/**
 * A store's icon: its uploaded logo if it has a valid one, else its emoji.
 *
 * The logo is re-checked here, not just when saving. Stores also arrive through
 * backup import, and only an inline image is safe to hand to an `<img>`.
 */
function StoreIcon({ store, size = 20 }) {
  const box = { '--store-icon-size': `${size}px` };
  if (isSafeLogo(store?.logo)) {
    return (
      <span className="store-icon store-icon--logo" style={box}>
        <img src={store.logo} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className="store-icon" style={box} aria-hidden="true">
      {store?.icon || '🏪'}
    </span>
  );
}

function listStats(list) {
  const open = list.items.filter(i => !i.checked);
  const estimate = open
    .filter(i => i.estimatedPrice != null)
    .reduce((sum, i) => sum + i.estimatedPrice, 0);
  return { remaining: open.length, estimate };
}

function StoreCard({ store, category, lists, onEdit, onDelete, onAddList, onOpenList }) {
  const addressLines = formatAddressLines(store);
  const hasCoords = store.lat != null && store.lon != null;

  return (
    <article className="store-card" style={{ '--store-accent': category?.color }}>
      <header className="store-card-head">
        <div className="store-card-badge"><StoreIcon store={store} size={32} /></div>
        <div className="store-card-titles">
          <h3 className="store-card-name">{store.name}</h3>
          {category && (
            <span className="store-card-category">{category.emoji} {category.label}</span>
          )}
        </div>
        <div className="store-card-actions">
          <button type="button" className="sic-act" onClick={() => onEdit(store)}
            title="Edit store" aria-label={`Edit ${store.name}`}>
            <IconPencil />
          </button>
          <button type="button" className="sic-act sic-act--del" onClick={() => onDelete(store)}
            title="Delete store" aria-label={`Delete ${store.name}`}>
            <IconTrash />
          </button>
        </div>
      </header>

      {(addressLines.length > 0 || hasCoords) && (
        <address className="store-card-address">
          {addressLines.map(line => <span key={line}>{line}</span>)}
          {hasCoords && (
            <a className="store-card-map" href={mapUrl(store)} target="_blank" rel="noopener noreferrer">
              <IconLocation /> {store.lat}, {store.lon} · Open map
            </a>
          )}
        </address>
      )}

      {store.hours && <p className="store-card-line"><strong>Hours</strong> {store.hours}</p>}
      {store.notes && <p className="store-card-notes">{store.notes}</p>}

      <footer className="store-card-lists">
        {lists.length === 0
          ? <span className="store-card-nolists">No shopping list yet</span>
          : lists.map(list => {
            const { remaining, estimate } = listStats(list);
            return (
              <button key={list.id} type="button" className="store-list-chip"
                onClick={() => onOpenList(list.id)} title="Open this list">
                <span className="store-list-chip-name">{list.name}</span>
                <span className="store-list-chip-meta">
                  {remaining} item{remaining === 1 ? '' : 's'}
                  {estimate > 0 && ` · ~$${estimate.toFixed(2)}`}
                </span>
              </button>
            );
          })}
        <button type="button" className="btn-ghost sm" onClick={() => onAddList(store)}>
          <IconPlus /> List
        </button>
      </footer>
    </article>
  );
}

/**
 * Lists that are not tied to a store. These used to be the whole Stores tab —
 * every list was shown as a "store" — so they stay visible here, with a way to
 * link each one to a real store.
 */
function UnlinkedLists({ lists, stores, onLink, onOpenList }) {
  if (lists.length === 0) return null;

  return (
    <section className="store-unlinked">
      <h3 className="store-section-title">Lists without a store</h3>
      <div className="shop-stores-grid">
        {lists.map(list => {
          const { remaining, estimate } = listStats(list);
          return (
            <div key={list.id} className="shop-store-card">
              <button type="button" className="store-unlinked-open" onClick={() => onOpenList(list.id)}>
                <div className="shop-store-icon">🛒</div>
                <div className="shop-store-name">{list.name}</div>
              </button>
              <div className="shop-store-meta">
                <span>{remaining} items</span>
                {estimate > 0 && <span>~${estimate.toFixed(2)}</span>}
              </div>
              {stores.length > 0 && (
                <select className="form-select sm store-link-select" value=""
                  aria-label={`Link ${list.name} to a store`}
                  onChange={e => e.target.value && onLink(list.id, e.target.value)}>
                  <option value="">Link to a store…</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StoresView({
  stores, storeCategories, lists,
  onAdd, onEdit, onDelete, onAddList, onLinkList, onOpenList, onManageCategories,
}) {
  const categoryMap = Object.fromEntries(storeCategories.map(c => [c.id, c]));
  const listsFor = (storeId) => lists.filter(l => (l.storeId ?? null) === storeId);
  const unlinked = lists.filter(l => !l.storeId || !stores.some(s => s.id === l.storeId));

  return (
    <div className="shop-center-content">
      <div className="shop-center-header">
        <div>
          <h2 className="shop-center-title">Stores</h2>
          <span className="shop-center-sub">
            {stores.length} store{stores.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="store-header-actions">
          <button type="button" className="btn-ghost sm" onClick={onManageCategories}>Categories</button>
          <button type="button" className="btn-primary sm" onClick={onAdd}>
            <IconPlus /> Add store
          </button>
        </div>
      </div>

      <div className="shop-center-scroll">
        {stores.length === 0 ? (
          <div className="store-empty">
            <span className="store-empty-icon">🏪</span>
            <p className="empty-title">No stores yet</p>
            <p className="empty-sub">
              Add the places you shop, with their address and hours. Each store can have its own shopping list.
            </p>
            <button type="button" className="btn-primary" onClick={onAdd}>
              <IconPlus /> Add your first store
            </button>
          </div>
        ) : (
          <div className="store-grid">
            {stores.map(store => (
              <StoreCard key={store.id} store={store}
                category={categoryMap[store.categoryId]}
                lists={listsFor(store.id)}
                onEdit={onEdit} onDelete={onDelete}
                onAddList={onAddList} onOpenList={onOpenList} />
            ))}
          </div>
        )}

        <UnlinkedLists lists={unlinked} stores={stores} onLink={onLinkList} onOpenList={onOpenList} />
      </div>
    </div>
  );
}

export { StoreIcon, StoresView };
