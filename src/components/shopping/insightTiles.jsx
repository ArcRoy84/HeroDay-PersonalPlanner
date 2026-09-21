// The tiles across the top of the Items section: what you spend, where you could
// save, what is due, and how complete the data behind all of it is.
//
// Each tile has an empty state that says what it will show and what unlocks it,
// because on day one there is no history and a wall of zeros teaches nothing.
import React, { useState } from 'react';
import { IconPlus } from './icons.jsx';
import { BarList, Meter } from './charts.jsx';
import { TrendBadge } from './productParts.jsx';
import { StoreIcon } from './stores.jsx';
import { money, signedPct, plural } from '../../utils/format';

function Tile({ title, children, className = '' }) {
  return (
    <section className={`itile ${className}`}>
      <h3 className="itile-title">{title}</h3>
      {children}
    </section>
  );
}

function Guidance({ children }) {
  return <p className="itile-guide">{children}</p>;
}

/** A row that opens a product. */
function ProductRow({ name, onOpen, aside, sub }) {
  return (
    <li>
      <button type="button" className="irow" onClick={onOpen}>
        <span className="irow-main">
          <span className="irow-name">{name}</span>
          {sub && <span className="irow-sub">{sub}</span>}
        </span>
        {aside}
      </button>
    </li>
  );
}

function SpendTile({ spend }) {
  const { thisMonth, deltaPct, estimatedThisMonth } = spend;
  const empty = thisMonth === 0 && estimatedThisMonth === 0;

  return (
    <Tile title="Spent this month" className="itile--hero">
      {empty ? (
        <Guidance>
          Tick items off your list and confirm what you paid. Your spending for the month
          builds up here.
        </Guidance>
      ) : (
        <>
          <p className="hero-figure">{money(thisMonth)}</p>
          {deltaPct === null ? (
            <p className="itile-note">Nothing from last month to compare with yet.</p>
          ) : (
            <p className="itile-note">
              <span aria-hidden="true">{deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '='} </span>
              <strong>{signedPct(deltaPct)}</strong> vs the same days last month
            </p>
          )}
          {estimatedThisMonth > 0 && (
            <p className="itile-note">
              + {money(estimatedThisMonth)} in prices you haven't confirmed
            </p>
          )}
        </>
      )}
    </Tile>
  );
}

function BreakdownTile({ spend, catMap, storeMap }) {
  const [by, setBy] = useState('category');
  const rows = by === 'category'
    ? spend.byCategory.slice(0, 5).map(r => {
      const cat = catMap[r.category];
      return {
        key: r.category,
        label: cat?.label ?? 'Other',
        icon: <span className="bars-emoji" aria-hidden="true">{cat?.emoji ?? '📦'}</span>,
        value: r.amount,
      };
    })
    : spend.byStore.slice(0, 5).map(r => {
      const store = r.storeId ? storeMap[r.storeId] : null;
      return {
        key: r.storeId ?? 'none',
        label: store?.name ?? 'No store recorded',
        icon: store
          ? <StoreIcon store={store} size={16} />
          : <span className="bars-emoji" aria-hidden="true">🧾</span>,
        value: r.amount,
      };
    });

  return (
    <Tile title="Where it went">
      <div className="seg" role="group" aria-label="Group spending by">
        {['category', 'store'].map(option => (
          <button key={option} type="button" className="seg-btn"
            aria-pressed={by === option} onClick={() => setBy(option)}>
            {option === 'category' ? 'Category' : 'Store'}
          </button>
        ))}
      </div>
      {rows.length === 0
        ? <Guidance>Confirmed prices this month are grouped here by {by}.</Guidance>
        : <BarList rows={rows} />}
    </Tile>
  );
}

function SavingsTile({ savings, productById, storeMap, onOpenProduct }) {
  return (
    <Tile title="Savings at the cheapest store">
      {savings.potential > 0 ? (
        <>
          <p className="stat-value">{money(savings.potential)}</p>
          <p className="itile-note">
            you could have saved over the last {savings.windowDays} days by buying each of these where it costs least
          </p>
          <ul className="irows">
            {savings.byProduct.slice(0, 3).map(row => {
              const product = productById[row.productId];
              const store = storeMap[row.bestStoreId];
              return (
                <ProductRow key={row.productId} name={product?.name ?? 'Item'}
                  sub={store ? `cheapest at ${store.name}` : undefined}
                  aside={<span className="irow-aside">{money(row.amount)}</span>}
                  onOpen={() => onOpenProduct(row.productId)} />
              );
            })}
          </ul>
        </>
      ) : (
        <Guidance>
          Buy the same item at two stores and confirm both prices. HeroDay works out where each one
          is cheapest, and what you'd have saved.
        </Guidance>
      )}
    </Tile>
  );
}

function MoversTile({ savings, productById, onOpenProduct }) {
  const { rises, drops, inflationPct } = savings;
  const empty = rises.length === 0 && drops.length === 0 && inflationPct === null;

  const group = (title, rows) => rows.length > 0 && (
    <>
      <h4 className="itile-sub">{title}</h4>
      <ul className="irows">
        {rows.slice(0, 3).map(row => (
          <ProductRow key={row.productId} name={productById[row.productId]?.name ?? 'Item'}
            aside={<TrendBadge trend={{ direction: row.pct > 0 ? 'up' : 'down', pct: row.pct }} />}
            sub={`last ${money(row.lastUnitPrice)}`}
            onOpen={() => onOpenProduct(row.productId)} />
        ))}
      </ul>
    </>
  );

  return (
    <Tile title="Price movers">
      {empty ? (
        <Guidance>
          Once an item has three confirmed prices, HeroDay shows what is getting dearer and what is
          getting cheaper.
        </Guidance>
      ) : (
        <>
          {inflationPct !== null && (
            <p className="itile-note">
              Across your items, prices are typically{' '}
              <strong>{inflationPct === 0 ? 'unchanged' : `${signedPct(inflationPct)} from your usual`}</strong>.
            </p>
          )}
          {group('Getting dearer', rises)}
          {group('Getting cheaper', drops)}
        </>
      )}
    </Tile>
  );
}

function RestockTile({ restock, productById, onOpenProduct, onAddToList }) {
  const { due, soon, lowPantry } = restock;
  const empty = due.length === 0 && soon.length === 0 && lowPantry.length === 0;

  return (
    <Tile title="Time to restock">
      {empty ? (
        <Guidance>
          Nothing is due. After three purchases of an item, HeroDay learns how often you buy it and
          tells you when it is running low.
        </Guidance>
      ) : (
        <>
          {due.length > 0 && (
            <ul className="irows">
              {due.slice(0, 4).map(row => (
                <li key={row.productId} className="irow-wrap">
                  <button type="button" className="irow" onClick={() => onOpenProduct(row.productId)}>
                    <span className="irow-main">
                      <span className="irow-name">{productById[row.productId]?.name ?? 'Item'}</span>
                      <span className="irow-sub irow-sub--alert">
                        {row.daysOver > 0 ? `${plural(row.daysOver, 'day')} past your usual` : 'Due now'}
                      </span>
                    </span>
                  </button>
                  <button type="button" className="btn-ghost sm irow-btn"
                    onClick={() => onAddToList(row.productId)}
                    aria-label={`Add ${productById[row.productId]?.name ?? 'item'} to your list`}>
                    <IconPlus /> Add
                  </button>
                </li>
              ))}
            </ul>
          )}
          {soon.length > 0 && (
            <>
              <h4 className="itile-sub">Coming up</h4>
              <ul className="irows">
                {soon.slice(0, 3).map(row => (
                  <ProductRow key={row.productId} name={productById[row.productId]?.name ?? 'Item'}
                    sub="Suggested this week" onOpen={() => onOpenProduct(row.productId)} />
                ))}
              </ul>
            </>
          )}
          {lowPantry.length > 0 && (
            <>
              <h4 className="itile-sub">Low in the pantry</h4>
              <ul className="irows">
                {lowPantry.slice(0, 3).map(row => (
                  <li key={row.pantryId} className="irow-wrap">
                    <span className="irow irow--static">
                      <span className="irow-main">
                        <span className="irow-name">{row.name}</span>
                        <span className="irow-sub">{row.pct}% of your usual stock left</span>
                      </span>
                    </span>
                    {row.productId && (
                      <button type="button" className="btn-ghost sm irow-btn"
                        onClick={() => onAddToList(row.productId)}
                        aria-label={`Add ${row.name} to your list`}>
                        <IconPlus /> Add
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Tile>
  );
}

function HabitsTile({ habits, productById, onOpenProduct }) {
  const { mostBought, stale } = habits;

  return (
    <Tile title="Your habits">
      {mostBought.length === 0 && stale.length === 0 ? (
        <Guidance>
          Your most-bought items, and the ones you used to buy but have dropped, show up here once
          you have a few purchases.
        </Guidance>
      ) : (
        <>
          {mostBought.length > 0 && (
            <>
              <h4 className="itile-sub">Most bought</h4>
              <ul className="irows">
                {mostBought.slice(0, 3).map(row => (
                  <ProductRow key={row.productId} name={productById[row.productId]?.name ?? 'Item'}
                    aside={<span className="irow-aside">×{row.times}</span>}
                    onOpen={() => onOpenProduct(row.productId)} />
                ))}
              </ul>
            </>
          )}
          {stale.length > 0 && (
            <>
              <h4 className="itile-sub">Not bought in a while</h4>
              <ul className="irows">
                {stale.slice(0, 3).map(row => (
                  <ProductRow key={row.productId} name={productById[row.productId]?.name ?? 'Item'}
                    aside={<span className="irow-aside">{row.daysSince} days</span>}
                    onOpen={() => onOpenProduct(row.productId)} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Tile>
  );
}

function DataTile({ habits, onReviewPrices }) {
  const { products, withPriceHistory, unconfirmed } = habits.data;
  const fill = products === 0 ? 0 : withPriceHistory / products;

  return (
    <Tile title="Price data">
      <p className="stat-value">
        {withPriceHistory}<span className="stat-of"> of {products}</span>
      </p>
      <p className="itile-note">items have enough confirmed prices for a trend</p>
      <Meter fill={fill} tone="ok" label={`${withPriceHistory} of ${products} items have price history`} />
      {unconfirmed > 0 ? (
        <p className="itile-note itile-note--action">
          {plural(unconfirmed, 'purchase')} still {unconfirmed === 1 ? 'needs' : 'need'} a price check.{' '}
          <button type="button" className="link-btn" onClick={onReviewPrices}>Review</button>
        </p>
      ) : products > 0 && withPriceHistory < products ? (
        <p className="itile-note">
          Confirm the price when you tick an item off, or log past purchases from an item's details.
        </p>
      ) : null}
    </Tile>
  );
}

/** All the tiles. `insights` comes from `computeInsights`. */
function InsightTiles({
  insights, productById, storeMap, catMap,
  onOpenProduct, onAddToList, onReviewPrices,
}) {
  return (
    <div className="itiles">
      <SpendTile spend={insights.spend} />
      <BreakdownTile spend={insights.spend} catMap={catMap} storeMap={storeMap} />
      <RestockTile restock={insights.restock} productById={productById}
        onOpenProduct={onOpenProduct} onAddToList={onAddToList} />
      <SavingsTile savings={insights.savings} productById={productById} storeMap={storeMap}
        onOpenProduct={onOpenProduct} />
      <MoversTile savings={insights.savings} productById={productById} onOpenProduct={onOpenProduct} />
      <HabitsTile habits={insights.habits} productById={productById} onOpenProduct={onOpenProduct} />
      <DataTile habits={insights.habits} onReviewPrices={onReviewPrices} />
    </div>
  );
}

export { InsightTiles };
