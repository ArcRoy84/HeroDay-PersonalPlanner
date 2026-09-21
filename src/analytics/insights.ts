/**
 * Cross-product insights: the tiles at the top of the Items section.
 *
 * Like the per-product stats these are computed from the purchase log on every
 * read and never stored, so they cannot disagree with the data.
 */
import { isLive } from '../db/repo';
import { median, monthOf, nameKey, previousMonth, toLocalDate } from '../utils/products';
import { unitPriceOf } from './price';
import { computeProductStats, type ProductStats } from './productStats';
import type { PantryItem, Product, Purchase } from '../db/types';

/** Savings are measured over this many recent days, so old prices do not count. */
export const SAVINGS_WINDOW_DAYS = 90;
/** A price this far from your usual is worth a mention. */
export const MOVER_PCT = 5;
/** Not bought for this long, despite a habit of buying it, counts as lapsed. */
export const STALE_DAYS = 60;
/** Pantry stock below this fraction of its par level is "running low". */
export const LOW_PANTRY_FRACTION = 0.5;
/** Lists in tiles show at most this many rows. */
export const TILE_ROWS = 5;

export interface SpendInsight {
  /** Month-to-date, confirmed prices only. */
  thisMonth: number;
  /** The same span of days last month, so a half month is not compared to a whole one. */
  lastMonthSameSpan: number;
  lastMonthTotal: number;
  /** Signed percent change of `thisMonth` against `lastMonthSameSpan`. */
  deltaPct: number | null;
  /** Prices pre-filled on a tick that nobody has confirmed, this month. */
  estimatedThisMonth: number;
  byCategory: { category: string; amount: number }[];
  byStore: { storeId: string | null; amount: number }[];
}

export interface PriceMover {
  productId: string;
  pct: number;
  lastUnitPrice: number;
}

export interface SavingsInsight {
  /** What buying each item at its cheapest store would have saved recently. */
  potential: number;
  windowDays: number;
  byProduct: { productId: string; amount: number; bestStoreId: string }[];
  drops: PriceMover[];
  rises: PriceMover[];
  /** The median price change across products — a personal inflation figure. */
  inflationPct: number | null;
}

export interface RestockRow {
  productId: string;
  ratio: number;
  /** How many days past the usual gap; 0 when merely close. */
  daysOver: number;
}

export interface LowStockRow {
  pantryId: string;
  name: string;
  pct: number;
  productId: string | null;
}

export interface RestockInsight {
  due: RestockRow[];
  soon: RestockRow[];
  lowPantry: LowStockRow[];
}

export interface HabitsInsight {
  mostBought: { productId: string; times: number }[];
  stale: { productId: string; daysSince: number }[];
  data: {
    products: number;
    /** Products with enough confirmed prices for a trend (two or more). */
    withPriceHistory: number;
    /** Ticked purchases still waiting for a price to be confirmed. */
    unconfirmed: number;
  };
}

export interface Insights {
  /** False until at least one purchase exists; tiles show guidance instead. */
  hasPurchases: boolean;
  spend: SpendInsight;
  savings: SavingsInsight;
  restock: RestockInsight;
  habits: HabitsInsight;
  /** Per-product stats, so the cards do not recompute what the tiles did. */
  stats: Map<string, ProductStats>;
}

export interface InsightsInput {
  products: Product[];
  purchases: Purchase[];
  pantry?: PantryItem[];
  /** Products currently waiting, unticked, on some list. */
  onListProductIds?: Set<string>;
  now?: Date;
}

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

function groupSum<K>(entries: [K, number][]): { key: K; amount: number }[] {
  const totals = new Map<K, number>();
  for (const [key, amount] of entries) totals.set(key, (totals.get(key) ?? 0) + amount);
  return [...totals.entries()]
    .map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeInsights(input: InsightsInput): Insights {
  const now = input.now ?? new Date();
  const onList = input.onListProductIds ?? new Set<string>();
  const products = input.products.filter(isLive);
  const productById = new Map(products.map(p => [p.id, p]));
  const live = input.purchases.filter(p => isLive(p) && productById.has(p.productId));

  const byProduct = new Map<string, Purchase[]>();
  for (const purchase of live) {
    const bucket = byProduct.get(purchase.productId);
    if (bucket) bucket.push(purchase);
    else byProduct.set(purchase.productId, [purchase]);
  }

  const stats = new Map<string, ProductStats>();
  for (const product of products) {
    stats.set(product.id, computeProductStats(product, byProduct.get(product.id) ?? [], now));
  }

  /* ── Spend ─────────────────────────────────────────────────────────────── */

  const today = toLocalDate(now);
  const month = monthOf(today);
  const lastMonth = previousMonth(month);
  const dayOfMonth = Number(today.slice(8, 10));

  // Confirmed prices are money known to have been spent; unconfirmed ones are a
  // guess, kept separate so the total is never quietly inflated by estimates.
  const priced = live.filter(p => p.price !== null);
  const confirmed = priced.filter(p => p.confirmed);
  const inMonth = (p: Purchase, m: string) => monthOf(p.date) === m;

  const thisMonthRows = confirmed.filter(p => inMonth(p, month));
  const lastMonthRows = confirmed.filter(p => inMonth(p, lastMonth));
  const lastSpanRows = lastMonthRows.filter(p => Number(p.date.slice(8, 10)) <= dayOfMonth);

  const thisMonth = sum(thisMonthRows.map(p => p.price!));
  const lastMonthSameSpan = sum(lastSpanRows.map(p => p.price!));

  const spend: SpendInsight = {
    thisMonth,
    lastMonthSameSpan,
    lastMonthTotal: sum(lastMonthRows.map(p => p.price!)),
    deltaPct: lastMonthSameSpan > 0
      ? Math.round(((thisMonth - lastMonthSameSpan) / lastMonthSameSpan) * 1000) / 10
      : null,
    estimatedThisMonth: sum(
      priced.filter(p => !p.confirmed && inMonth(p, month)).map(p => p.price!),
    ),
    byCategory: groupSum(
      thisMonthRows.map((p): [string, number] => [productById.get(p.productId)!.category, p.price!]),
    ).map(({ key, amount }) => ({ category: key, amount })),
    byStore: groupSum(
      thisMonthRows.map((p): [string | null, number] => [p.storeId, p.price!]),
    ).map(({ key, amount }) => ({ storeId: key, amount })),
  };

  /* ── Savings ───────────────────────────────────────────────────────────── */

  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - SAVINGS_WINDOW_DAYS);
  const since = toLocalDate(windowStart);

  const savingRows: SavingsInsight['byProduct'] = [];
  for (const product of products) {
    const s = stats.get(product.id)!;
    if (!s.bestStoreId) continue;
    const best = s.stores.find(x => x.storeId === s.bestStoreId)!;
    const amount = sum(
      (byProduct.get(product.id) ?? [])
        .filter(p => p.date >= since)
        .map(p => {
          const unit = unitPriceOf(p);
          return unit === null ? 0 : Math.max(0, (unit - best.avgUnitPrice!) * p.qty);
        }),
    );
    if (amount > 0) savingRows.push({ productId: product.id, amount, bestStoreId: s.bestStoreId });
  }
  savingRows.sort((a, b) => b.amount - a.amount);

  const movers: PriceMover[] = [];
  for (const product of products) {
    const s = stats.get(product.id)!;
    // A "change" needs history to be a change from: three confirmed prices.
    if (s.trend && s.pricedPurchases >= 3 && s.lastPrice) {
      movers.push({ productId: product.id, pct: s.trend.pct, lastUnitPrice: s.lastPrice.unitPrice });
    }
  }
  const trendPcts = movers.map(m => m.pct);

  const savings: SavingsInsight = {
    potential: sum(savingRows.map(r => r.amount)),
    windowDays: SAVINGS_WINDOW_DAYS,
    byProduct: savingRows.slice(0, TILE_ROWS),
    drops: movers.filter(m => m.pct <= -MOVER_PCT).sort((a, b) => a.pct - b.pct).slice(0, TILE_ROWS),
    rises: movers.filter(m => m.pct >= MOVER_PCT).sort((a, b) => b.pct - a.pct).slice(0, TILE_ROWS),
    // One product moving tells you about that product; a median over several
    // tells you about prices in general.
    inflationPct: trendPcts.length >= 3 ? Math.round((median(trendPcts) ?? 0) * 10) / 10 : null,
  };

  /* ── Restock ───────────────────────────────────────────────────────────── */

  const restockRows = (state: 'due' | 'soon'): RestockRow[] =>
    products
      .filter(p => !onList.has(p.id))
      .map(p => ({ p, s: stats.get(p.id)! }))
      .filter(({ s }) => (state === 'due'
        ? s.restock.state === 'due' || s.restock.state === 'overdue'
        : s.restock.state === 'soon'))
      .map(({ p, s }) => ({
        productId: p.id,
        ratio: s.restock.ratio!,
        daysOver: Math.max(0, Math.round((s.daysSinceLast ?? 0) - (s.intervalDays ?? 0))),
      }))
      .sort((a, b) => b.ratio - a.ratio);

  const keyToProduct = new Map(products.map(p => [p.nameKey, p.id]));
  const lowPantry: LowStockRow[] = (input.pantry ?? [])
    .filter(isLive)
    .map(item => ({
      item,
      pct: item.parQty > 0 ? item.qty / item.parQty : 1,
    }))
    .filter(({ pct }) => pct < LOW_PANTRY_FRACTION)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, TILE_ROWS)
    .map(({ item, pct }) => ({
      pantryId: item.id,
      name: item.name,
      pct: Math.max(0, Math.round(pct * 100)),
      productId: keyToProduct.get(nameKey(item.name)) ?? null,
    }));

  const restock: RestockInsight = {
    due: restockRows('due').slice(0, TILE_ROWS),
    soon: restockRows('soon').slice(0, TILE_ROWS),
    lowPantry,
  };

  /* ── Habits & data ─────────────────────────────────────────────────────── */

  const habits: HabitsInsight = {
    mostBought: products
      .map(p => ({ productId: p.id, times: stats.get(p.id)!.timesPurchased }))
      .filter(x => x.times >= 2)
      .sort((a, b) => b.times - a.times)
      .slice(0, TILE_ROWS),
    stale: products
      .map(p => ({ p, s: stats.get(p.id)! }))
      .filter(({ s }) => s.timesPurchased >= 2 && (s.daysSinceLast ?? 0) >= STALE_DAYS)
      .map(({ p, s }) => ({ productId: p.id, daysSince: s.daysSinceLast! }))
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, TILE_ROWS),
    data: {
      products: products.length,
      withPriceHistory: products.filter(p => stats.get(p.id)!.pricedPurchases >= 2).length,
      unconfirmed: sum([...stats.values()].map(s => s.unconfirmed)),
    },
  };

  return {
    hasPurchases: live.length > 0,
    spend,
    savings,
    restock,
    habits,
    stats,
  };
}
