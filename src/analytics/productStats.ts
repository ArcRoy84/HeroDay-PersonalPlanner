/**
 * Per-product statistics: price trend, buying rhythm, store comparison.
 *
 * Pure functions with the clock passed in, so every rule here is testable
 * against a fixed date. Nothing in this file is stored: it is recomputed from
 * the purchase log each time, so it cannot drift from the data it describes.
 */
import { isLive } from '../db/repo';
import { daysBetween, mean, median, parseDateOnly, toLocalDate } from '../utils/products';
import { newestFirst, unitPriceOf } from './price';
import type { DateOnly, Product, Purchase } from '../db/types';

/* ── The rules, named so the UI and the tests refer to the same numbers ──── */

/** A change within ±3% of the recent average is "stable", not a trend. */
export const TREND_FLAT_BAND = 3;
/** The trend compares the last price with the mean of up to this many before it. */
export const TREND_BASELINE_WINDOW = 5;
/** "All-time low" and "above average" need at least this many priced purchases. */
export const MIN_PRICED_FOR_OPPORTUNITY = 3;
/** Beyond this fraction above/below the average, a price is worth calling out. */
export const OPPORTUNITY_BAND = 0.05;
/** How much of the usual gap has elapsed when an item starts to look due. */
export const RESTOCK_SOON = 0.7;
export const RESTOCK_DUE = 0.85;
export const RESTOCK_OVERDUE = 1.15;
/** Purchases with dates needed before a rhythm means anything: 3 dates, 2 gaps. */
export const MIN_GAPS_FOR_RHYTHM = 2;
/** Points drawn in a sparkline. */
export const SPARK_POINTS = 10;

export type TrendDirection = 'up' | 'down' | 'flat';

export interface Trend {
  direction: TrendDirection;
  /** Signed percent change against the recent average, to one decimal. */
  pct: number;
}

export type Opportunity = 'all-time-low' | 'above-average' | 'below-average';

export type RestockState = 'unknown' | 'ok' | 'soon' | 'due' | 'overdue';

export interface Restock {
  state: RestockState;
  /** Days since last purchase divided by the usual gap; `null` when unknown. */
  ratio: number | null;
  /** Days until it reaches "due" (negative once past it); `null` when unknown. */
  daysUntilDue: number | null;
}

export interface StoreStat {
  storeId: string;
  /** Every purchase there, priced or not. */
  purchases: number;
  pricedPurchases: number;
  lastUnitPrice: number | null;
  avgUnitPrice: number | null;
  minUnitPrice: number | null;
  lastDate: DateOnly;
}

export interface LastPrice {
  unitPrice: number;
  /** What was paid for the whole line. */
  total: number;
  qty: number;
  date: DateOnly;
  storeId: string | null;
}

export interface ProductStats {
  /** Recorded purchases plus those from before tracking began. */
  timesPurchased: number;
  /** Purchases with a date, i.e. excluding `priorPurchases`. */
  recordedPurchases: number;
  lastPurchase: Purchase | null;
  daysSinceLast: number | null;

  lastPrice: LastPrice | null;
  avgUnitPrice: number | null;
  minUnitPrice: number | null;
  maxUnitPrice: number | null;
  /** How many purchases carry a confirmed price. */
  pricedPurchases: number;
  trend: Trend | null;
  opportunity: Opportunity | null;

  /** The usual gap between purchases, in days. */
  intervalDays: number | null;
  restock: Restock;

  totalSpent: number;
  totalQty: number;
  purchasesThisYear: number;

  stores: StoreStat[];
  /** The one or two stores this is usually bought at. */
  topStores: string[];
  /** The store with the lowest average price; needs two stores with prices. */
  bestStoreId: string | null;
  /** Gap between the dearest and cheapest store's average price. */
  storeSpread: number | null;

  /** The last few unit prices, oldest first, for the sparkline. */
  spark: number[];
  /** Ticked purchases whose price nobody has confirmed yet. */
  unconfirmed: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function trendOf(units: number[]): Trend | null {
  if (units.length < 2) return null;
  const last = units[units.length - 1]!;
  const prior = units.slice(-1 - TREND_BASELINE_WINDOW, -1);
  const baseline = mean(prior);
  if (baseline === null || baseline <= 0) return null;

  const pct = round1(((last - baseline) / baseline) * 100);
  const direction: TrendDirection =
    Math.abs(pct) < TREND_FLAT_BAND ? 'flat' : pct > 0 ? 'up' : 'down';
  return { direction, pct };
}

function opportunityOf(units: number[]): Opportunity | null {
  if (units.length < MIN_PRICED_FOR_OPPORTUNITY) return null;
  const last = units[units.length - 1]!;
  const prior = units.slice(0, -1);
  const minPrior = Math.min(...prior);
  const avgPrior = mean(prior)!;

  // "All-time low" only means something if prices have actually varied.
  if (last <= minPrior && Math.max(...units) > Math.min(...units)) return 'all-time-low';
  if (last > avgPrior * (1 + OPPORTUNITY_BAND)) return 'above-average';
  if (last < avgPrior * (1 - OPPORTUNITY_BAND)) return 'below-average';
  return null;
}

function restockOf(intervalDays: number | null, daysSinceLast: number | null): Restock {
  if (intervalDays === null || daysSinceLast === null) {
    return { state: 'unknown', ratio: null, daysUntilDue: null };
  }
  const ratio = daysSinceLast / intervalDays;
  const state: RestockState =
    ratio < RESTOCK_SOON ? 'ok'
      : ratio < RESTOCK_DUE ? 'soon'
        : ratio < RESTOCK_OVERDUE ? 'due'
          : 'overdue';
  return {
    state,
    ratio,
    daysUntilDue: Math.round(intervalDays * RESTOCK_DUE - daysSinceLast),
  };
}

function storeStatsOf(live: Purchase[]): StoreStat[] {
  const byStore = new Map<string, Purchase[]>();
  for (const purchase of live) {
    if (!purchase.storeId) continue;
    const bucket = byStore.get(purchase.storeId);
    if (bucket) bucket.push(purchase);
    else byStore.set(purchase.storeId, [purchase]);
  }

  return [...byStore.entries()]
    .map(([storeId, purchases]): StoreStat => {
      const newest = [...purchases].sort(newestFirst);
      const units = newest.map(unitPriceOf).filter((u): u is number => u !== null);
      return {
        storeId,
        purchases: purchases.length,
        pricedPurchases: units.length,
        lastUnitPrice: units[0] ?? null,
        avgUnitPrice: mean(units),
        minUnitPrice: units.length ? Math.min(...units) : null,
        lastDate: newest[0]!.date,
      };
    })
    .sort((a, b) => b.purchases - a.purchases || b.lastDate.localeCompare(a.lastDate));
}

/**
 * Computes everything the Items section shows about one product.
 *
 * `purchases` may contain other products' rows and voided ones; both are
 * filtered out here so callers cannot forget to.
 */
export function computeProductStats(
  product: Product,
  purchases: Purchase[],
  now: Date = new Date(),
): ProductStats {
  const live = purchases
    .filter(p => p.productId === product.id && isLive(p))
    .sort(newestFirst);

  const lastPurchase = live[0] ?? null;
  const daysSinceLast = lastPurchase ? Math.max(0, daysBetween(lastPurchase.date, now)) : null;

  // Oldest first, only purchases whose price is confirmed.
  const priced = [...live]
    .reverse()
    .map(purchase => ({ purchase, unit: unitPriceOf(purchase) }))
    .filter((x): x is { purchase: Purchase; unit: number } => x.unit !== null);
  const units = priced.map(x => x.unit);
  const newestPriced = priced[priced.length - 1];

  const lastPrice: LastPrice | null = newestPriced
    ? {
      unitPrice: newestPriced.unit,
      total: newestPriced.purchase.price ?? 0,
      qty: newestPriced.purchase.qty,
      date: newestPriced.purchase.date,
      storeId: newestPriced.purchase.storeId,
    }
    : null;

  // Rhythm: the gaps between distinct purchase days. Two purchases on one day
  // are one shop, not a gap of zero.
  const days = [...new Set(live.map(p => p.date))].sort();
  const gaps: number[] = [];
  for (let i = 1; i < days.length; i++) {
    gaps.push(Math.max(1, daysBetween(days[i - 1]!, parseDateOnly(days[i]!))));
  }
  const rawInterval = gaps.length >= MIN_GAPS_FOR_RHYTHM ? median(gaps) : null;
  const intervalDays = rawInterval === null ? null : Math.max(1, rawInterval);

  const stores = storeStatsOf(live);
  const priceable = stores.filter(s => s.avgUnitPrice !== null);
  const ranked = [...priceable].sort((a, b) =>
    a.avgUnitPrice! - b.avgUnitPrice! || b.purchases - a.purchases);
  const hasComparison = priceable.length >= 2;

  const thisYear = toLocalDate(now).slice(0, 4);

  return {
    timesPurchased: live.length + product.priorPurchases,
    recordedPurchases: live.length,
    lastPurchase,
    daysSinceLast,

    lastPrice,
    avgUnitPrice: mean(units),
    minUnitPrice: units.length ? Math.min(...units) : null,
    maxUnitPrice: units.length ? Math.max(...units) : null,
    pricedPurchases: units.length,
    trend: trendOf(units),
    opportunity: opportunityOf(units),

    intervalDays,
    restock: restockOf(intervalDays, daysSinceLast),

    totalSpent: priced.reduce((sum, x) => sum + (x.purchase.price ?? 0), 0),
    totalQty: live.reduce((sum, p) => sum + p.qty, 0),
    purchasesThisYear: live.filter(p => p.date.startsWith(thisYear)).length,

    stores,
    topStores: stores.slice(0, 2).map(s => s.storeId),
    bestStoreId: hasComparison ? ranked[0]!.storeId : null,
    storeSpread: hasComparison
      ? ranked[ranked.length - 1]!.avgUnitPrice! - ranked[0]!.avgUnitPrice!
      : null,

    spark: units.slice(-SPARK_POINTS),
    unconfirmed: live.filter(p => !p.confirmed && p.source !== 'legacy').length,
  };
}
