// A product as a card: what it is, what you last paid, whether that is good, and
// whether it is time to buy it again. Clicking opens the full detail modal.
import React, { useEffect, useState } from 'react';
import { IconPlus, IconCheck } from './icons.jsx';
import { Sparkline } from './charts.jsx';
import {
  ProductThumb, TrendBadge, OpportunityChip, StoreBadges, RestockMeter,
} from './productParts.jsx';
import { money, lastPurchasedLabel, intervalLabel, plural } from '../../utils/format';
import { describeVariant } from '../../db/productOps';

/** The sentence a screen reader gets instead of the sparkline. */
function sparkLabel(values) {
  if (values.length === 0) return '';
  if (values.length === 1) return `One recorded price: ${money(values[0])}`;
  return `Price over your last ${values.length} purchases, from ${money(values[0])} to ${money(values[values.length - 1])}`;
}

function ProductCard({ product, stats, category, storeMap, onList, onOpen, onAddToList }) {
  const [added, setAdded] = useState(false);

  // The "Added" confirmation clears itself; the timer is cleaned up so a card
  // that unmounts first never sets state on nothing.
  useEffect(() => {
    if (!added) return undefined;
    const timer = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(timer);
  }, [added]);

  const last = stats.lastPurchase;
  const variant = describeVariant(product);
  const neverBought = stats.timesPurchased === 0;

  async function handleAdd() {
    await onAddToList(product.id);
    setAdded(true);
  }

  return (
    <article className="pcard" style={{ '--card-accent': category?.color }}>
      <button type="button" className="pcard-main" onClick={() => onOpen(product.id)}
        aria-label={`Open details for ${product.name}`}>
        <span className="pcard-head">
          <ProductThumb product={product} category={category} size={52} />
          <span className="pcard-titles">
            <span className="pcard-name">{product.name}</span>
            <span className="pcard-sub">
              {category ? `${category.emoji} ${category.label}` : 'Uncategorised'}
              {variant && ` · ${variant}`}
            </span>
          </span>
          <TrendBadge trend={stats.trend} />
        </span>

        <span className="pcard-price-row">
          {stats.lastPrice
            ? <span className="pcard-price">{money(stats.lastPrice.unitPrice)}</span>
            : <span className="pcard-price pcard-price--none">No price yet</span>}
          <span className="pcard-when">
            {last ? `Bought ${lastPurchasedLabel(last.date).toLowerCase()}` : 'Not bought yet'}
          </span>
        </span>

        {(stats.opportunity || stats.topStores.length > 0) && (
          <span className="pcard-chips">
            <OpportunityChip opportunity={stats.opportunity} />
            <StoreBadges storeIds={stats.topStores} storeMap={storeMap}
              lastStoreId={last?.storeId ?? null} />
          </span>
        )}

        {!neverBought && <RestockMeter restock={stats.restock} onList={onList} />}

        <span className="pcard-foot-row">
          <span className="pcard-facts">
            {stats.intervalDays
              ? `You buy this ${intervalLabel(stats.intervalDays)}`
              : plural(stats.timesPurchased, 'purchase')}
            {stats.intervalDays ? ` · ${plural(stats.timesPurchased, 'purchase')}` : ''}
          </span>
          <Sparkline values={stats.spark} label={sparkLabel(stats.spark)} />
        </span>
      </button>

      <footer className="pcard-actions">
        <button type="button" className="btn-ghost sm" onClick={handleAdd} disabled={onList}
          title={onList ? 'Already on a list' : 'Add to the current list'}>
          {added ? <><IconCheck /> Added</> : onList ? 'On your list' : <><IconPlus /> Add to list</>}
        </button>
      </footer>
    </article>
  );
}

export { ProductCard };
