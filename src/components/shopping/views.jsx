// Cross-list views: every item across lists, and store locations.
import React from 'react';
import { IconLocation } from './icons.jsx';

function AllItemsView({ lists, catMap, categories }) {
  const allItems = lists.flatMap(l =>
    l.items.map(item => ({ ...item, listName: l.name }))
  );

  const grouped = {};
  allItems.forEach(item => {
    if (!grouped[item.listName]) grouped[item.listName] = [];
    grouped[item.listName].push(item);
  });

  return (
    <div className="shop-center-content">
      <div className="shop-center-header">
        <h2 className="shop-center-title">All Items</h2>
        <span className="shop-center-sub">{allItems.length} total · {allItems.filter(i => !i.checked).length} remaining</span>
      </div>
      <div className="shop-center-scroll">
        {allItems.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 40 }}>📦</span>
            <p className="empty-title">No items yet</p>
            <p className="empty-sub">Add items to your shopping lists to see them here</p>
          </div>
        ) : (
          Object.entries(grouped).map(([listName, items]) => (
            <div key={listName} className="shop-section">
              <div className="shop-all-items-list-hdr">🛒 {listName} · {items.filter(i => !i.checked).length} remaining</div>
              {items.map(item => {
                const cat = catMap[item.category] || categories[0];
                return (
                  <div key={item.id} className={`sic sic--readonly ${item.checked ? 'sic--done' : ''}`} style={{ '--cc': cat.color }}>
                    <div className="sic-thumb">{cat.emoji}</div>
                    <div className="sic-info">
                      <div className="sic-row1">
                        <span className="sic-name">{item.name}</span>
                        <span className="sic-badge">{cat.label}</span>
                      </div>
                      <div className="sic-row2">
                        {item.storeLocation && <span className="sic-loc"><IconLocation /> {item.storeLocation}</span>}
                        {item.estimatedPrice != null && <span className="sic-price">${item.estimatedPrice.toFixed(2)}</span>}
                      </div>
                    </div>
                    <span className="sic-qty-badge">{item.qty || 1}{item.unit ? ` ${item.unit}` : ''}</span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── StoresView (center content for Stores section) ────────────────────────────
function StoresView({ lists }) {
  return (
    <div className="shop-center-content">
      <div className="shop-center-header">
        <h2 className="shop-center-title">Stores</h2>
        <span className="shop-center-sub">{lists.length} store{lists.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="shop-center-scroll">
        {lists.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 40 }}>🏪</span>
            <p className="empty-title">No stores yet</p>
            <p className="empty-sub">Create a shopping list for each store you shop at</p>
          </div>
        ) : (
          <div className="shop-stores-grid">
            {lists.map(l => {
              const remaining = l.items.filter(i => !i.checked).length;
              const est = l.items.filter(i => !i.checked && i.estimatedPrice != null)
                .reduce((s, i) => s + i.estimatedPrice, 0);
              return (
                <div key={l.id} className="shop-store-card">
                  <div className="shop-store-icon">🏪</div>
                  <div className="shop-store-name">{l.name}</div>
                  <div className="shop-store-meta">
                    <span>{remaining} items</span>
                    {est > 0 && <span>~${est.toFixed(2)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ShoppingList ─────────────────────────────────────────────────────────

export { AllItemsView, StoresView };
