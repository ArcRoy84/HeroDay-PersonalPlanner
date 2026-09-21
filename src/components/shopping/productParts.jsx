// Small pieces shared by the product card, the product modal and the tiles.
import React from 'react';
import { StoreIcon } from './stores.jsx';
import { Meter } from './charts.jsx';
import { isSafeImage } from '../../utils/stores';
import { trendBadge, opportunityLabel, restockLabel } from '../../analytics/labels';

/**
 * A product's picture: its photo if it has a valid one, else its category emoji
 * on a tinted tile. The photo is re-checked here, not only when saving, because
 * products also arrive through backup import and only an inline image is safe
 * to hand to an `<img>`.
 */
function ProductThumb({ product, category, size = 48 }) {
  const box = { '--thumb-size': `${size}px`, '--thumb-accent': category?.color };
  if (isSafeImage(product?.photo)) {
    return (
      <span className="pthumb pthumb--photo" style={box}>
        <img src={product.photo} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className="pthumb" style={box} aria-hidden="true">
      {category?.emoji || '📦'}
    </span>
  );
}

/**
 * "↑ +5%", "↓ −10%" or "= Stable". The glyph and the words carry the meaning;
 * colour only reinforces it, so it survives colour blindness and greyscale.
 */
function TrendBadge({ trend }) {
  if (!trend) return null;
  const badge = trendBadge(trend);
  return (
    <span className={`tbadge tbadge--${badge.tone}`} role="img" aria-label={badge.aria}>
      <span className="tbadge-glyph" aria-hidden="true">{badge.glyph}</span>
      <span aria-hidden="true">{badge.text}</span>
    </span>
  );
}

function OpportunityChip({ opportunity }) {
  if (!opportunity) return null;
  const { text, tone } = opportunityLabel(opportunity);
  return <span className={`ochip ochip--${tone}`}>{text}</span>;
}

/**
 * The stores a product is usually bought at, as small badges. The one it was
 * last bought at is marked, since "where I last paid" and "where I usually go"
 * are different things.
 */
function StoreBadges({ storeIds, storeMap, lastStoreId }) {
  const shown = storeIds.map(id => storeMap[id]).filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <span className="sbadges">
      {shown.map(store => (
        <span key={store.id} className="sbadge"
          title={store.id === lastStoreId ? `${store.name} — where you last bought it` : store.name}>
          <StoreIcon store={store} size={14} />
          <span className="sbadge-name">{store.name}</span>
          {store.id === lastStoreId && <span className="sbadge-last" aria-label="last bought here">•</span>}
        </span>
      ))}
    </span>
  );
}

/** The restock progress bar with its wording; "on your list" replaces the nag. */
function RestockMeter({ restock, onList }) {
  const label = restockLabel(restock, onList);
  return (
    <span className={`restock restock--${label.tone}`}>
      <Meter fill={label.fill} tone={label.tone} label={`Restock: ${label.text}`} />
      <span className="restock-text">{label.text}</span>
    </span>
  );
}

export { ProductThumb, TrendBadge, OpportunityChip, StoreBadges, RestockMeter };
