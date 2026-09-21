// The Items section: insight tiles on top, then every product as a card.
import React, { useMemo, useState } from 'react';
import { IconPlus } from './icons.jsx';
import { ProductCard } from './ProductCard.jsx';
import { ProductModal } from './ProductModal.jsx';
import { ProductFormModal } from './ProductFormModal.jsx';
import { InsightTiles } from './insightTiles.jsx';
import { ConfirmModal } from './dialogs.jsx';
import { plural } from '../../utils/format';

const SORTS = [
  { id: 'name', label: 'Name' },
  { id: 'recent', label: 'Recently bought' },
  { id: 'restock', label: 'Restock urgency' },
  { id: 'change', label: 'Biggest price change' },
  { id: 'most', label: 'Most bought' },
  { id: 'spend', label: 'Most spent' },
];

/** Sorts that put missing data last, so an item with no history never leads. */
const sorters = {
  name: () => (a, b) => a.product.name.localeCompare(b.product.name),
  recent: () => (a, b) => (b.stats.lastPurchase?.date ?? '').localeCompare(a.stats.lastPurchase?.date ?? ''),
  restock: () => (a, b) => (b.stats.restock.ratio ?? -1) - (a.stats.restock.ratio ?? -1),
  change: () => (a, b) => Math.abs(b.stats.trend?.pct ?? -1) - Math.abs(a.stats.trend?.pct ?? -1),
  most: () => (a, b) => b.stats.timesPurchased - a.stats.timesPurchased,
  spend: () => (a, b) => b.stats.totalSpent - a.stats.totalSpent,
};

const NO_FILTERS = { due: false, priceUp: false, needsPrice: false };

function matchesQuery(product, query) {
  if (!query) return true;
  const haystack = `${product.name} ${product.brand} ${product.packageSize} ${product.barcode}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).every(word => haystack.includes(word));
}

function ItemsView({
  products, purchases, insights, categories, catMap, stores, storeMap, lists, activeListId,
  onListProductIds, actions, onLookup,
  sample, // optional: { hasSample, busy, load, remove } — the removable demo data
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [storeId, setStoreId] = useState('');
  const [sort, setSort] = useState('name');
  const [chips, setChips] = useState(NO_FILTERS);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(undefined); // undefined = closed, null = adding, product = editing
  const [deleting, setDeleting] = useState(null);

  const productById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);
  const purchasesByProduct = useMemo(() => {
    const map = new Map();
    for (const purchase of purchases) {
      const bucket = map.get(purchase.productId);
      if (bucket) bucket.push(purchase);
      else map.set(purchase.productId, [purchase]);
    }
    return map;
  }, [purchases]);

  const rows = useMemo(() => products
    .map(product => ({ product, stats: insights.stats.get(product.id) }))
    .filter(row => row.stats), [products, insights]);

  const anyFilter = Boolean(query || category || storeId || chips.due || chips.priceUp || chips.needsPrice);

  const visible = useMemo(() => rows
    .filter(({ product, stats }) => {
      if (!matchesQuery(product, query)) return false;
      if (category && product.category !== category) return false;
      if (storeId && !stats.stores.some(s => s.storeId === storeId)) return false;
      if (chips.due) {
        const due = ['soon', 'due', 'overdue'].includes(stats.restock.state);
        if (!due || onListProductIds.has(product.id)) return false;
      }
      if (chips.priceUp && stats.trend?.direction !== 'up') return false;
      if (chips.needsPrice && stats.unconfirmed === 0) return false;
      return true;
    })
    .sort(sorters[sort]()), [rows, query, category, storeId, chips, sort, onListProductIds]);

  const toggleChip = key => setChips(c => ({ ...c, [key]: !c[key] }));
  function clearFilters() {
    setQuery('');
    setCategory('');
    setStoreId('');
    setChips(NO_FILTERS);
  }

  const targetListId = activeListId ?? lists[0]?.id ?? null;
  const addToActiveList = productId => (targetListId
    ? actions.addProductToList(productId, targetListId)
    : Promise.resolve());

  async function handleSave(input, { addToListId }) {
    if (form) {
      await actions.updateProduct(form.id, input);
    } else {
      await actions.createProduct(input, { addToListId });
    }
    setForm(undefined);
  }

  async function confirmDelete() {
    const product = deleting;
    setDeleting(null);
    if (!product) return;
    setOpenId(null);
    await actions.removeProduct(product.id);
  }

  const openProduct = openId ? productById[openId] : null;
  const openStats = openProduct ? insights.stats.get(openProduct.id) : null;

  return (
    <div className="shop-center-content">
      <div className="shop-center-header">
        <div>
          <h2 className="shop-center-title">Items</h2>
          <span className="shop-center-sub">
            {plural(products.length, 'item')} tracked
          </span>
        </div>
        <div className="store-header-actions">
          {sample && (
            sample.hasSample
              ? (
                <button type="button" className="btn-ghost sm" onClick={sample.remove} disabled={sample.busy}>
                  Remove sample data
                </button>
              )
              : (
                <button type="button" className="btn-ghost sm" onClick={sample.load} disabled={sample.busy}
                  title="Adds clearly-labelled example items, prices and stores you can remove in one click">
                  Load sample data
                </button>
              )
          )}
          <button type="button" className="btn-primary sm" onClick={() => setForm(null)}>
            <IconPlus /> Add item
          </button>
        </div>
      </div>

      <div className="shop-center-scroll">
        {sample?.hasSample && (
          <p className="isample" role="status">
            You are looking at <strong>sample data</strong>. It is clearly separate from your own items
            and comes off with “Remove sample data”.
          </p>
        )}

        {products.length === 0 ? (
          <div className="store-empty">
            <span className="store-empty-icon">🧺</span>
            <p className="empty-title">No items yet</p>
            <p className="empty-sub">
              Every item you add to a shopping list is tracked here automatically, along with what
              you pay for it. You can also add one by hand.
            </p>
            <button type="button" className="btn-primary" onClick={() => setForm(null)}>
              <IconPlus /> Add your first item
            </button>
          </div>
        ) : (
          <>
            <InsightTiles insights={insights} productById={productById} storeMap={storeMap} catMap={catMap}
              onOpenProduct={setOpenId} onAddToList={addToActiveList}
              onReviewPrices={() => { clearFilters(); setChips({ ...NO_FILTERS, needsPrice: true }); }} />

            <div className="ifilters" role="search">
              <input type="search" className="form-input ifilters-search" value={query}
                onChange={e => setQuery(e.target.value)} placeholder="Search items, brands, barcodes…"
                aria-label="Search items" />
              <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}
                aria-label="Filter by category">
                <option value="">All categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
              {stores.length > 0 && (
                <select className="form-input" value={storeId} onChange={e => setStoreId(e.target.value)}
                  aria-label="Filter by store">
                  <option value="">Any store</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
              )}
              <select className="form-input" value={sort} onChange={e => setSort(e.target.value)}
                aria-label="Sort items">
                {SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
              </select>
            </div>

            <div className="ichips" role="group" aria-label="Quick filters">
              {[
                ['due', 'Due soon'],
                ['priceUp', 'Price up'],
                ['needsPrice', 'Needs a price check'],
              ].map(([key, label]) => (
                <button key={key} type="button" className="ichip" aria-pressed={chips[key]}
                  onClick={() => toggleChip(key)}>
                  {label}
                </button>
              ))}
              <span className="ichips-count" aria-live="polite">
                {anyFilter ? `${visible.length} of ${products.length}` : plural(products.length, 'item')}
              </span>
              {anyFilter && (
                <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="store-empty">
                <p className="empty-title">Nothing matches</p>
                <p className="empty-sub">Try a different search, or clear the filters.</p>
                <button type="button" className="btn-ghost" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              <div className="pgrid">
                {visible.map(({ product, stats }) => (
                  <ProductCard key={product.id} product={product} stats={stats}
                    category={catMap[product.category]} storeMap={storeMap}
                    onList={onListProductIds.has(product.id)}
                    onOpen={setOpenId} onAddToList={addToActiveList} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {openProduct && openStats && (
        <ProductModal
          product={openProduct} stats={openStats}
          purchases={purchasesByProduct.get(openProduct.id) ?? []}
          category={catMap[openProduct.category]}
          stores={stores} storeMap={storeMap} lists={lists} activeListId={targetListId}
          onList={onListProductIds.has(openProduct.id)}
          onClose={() => setOpenId(null)}
          onEdit={setForm} onDelete={setDeleting}
          onAddToList={actions.addProductToList}
          actions={actions}
          escapeDisabled={form !== undefined || deleting !== null} />
      )}

      {form !== undefined && (
        <ProductFormModal
          product={form} categories={categories} lists={lists} defaultListId={targetListId}
          onSave={handleSave} onLookup={onLookup}
          onOpenExisting={id => { setForm(undefined); setOpenId(id); }}
          onClose={() => setForm(undefined)} />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete item?"
          message={`"${deleting.name}" and its purchase history will be deleted. If it is still on a shopping list, it will reappear there as a new item with no history.`}
          confirmLabel="Delete item"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

export { ItemsView };
