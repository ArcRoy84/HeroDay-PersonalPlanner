/**
 * Human-readable wording for analytics states.
 *
 * Kept apart from the maths so the rules in `productStats` stay numeric, and the
 * words — which are a product decision — can change without touching them.
 *
 * Each label carries a `tone`, not a color. The UI maps tone to color *and*
 * always shows the words and a glyph beside it, so meaning never rests on color
 * alone (a red/green pair is exactly what colorblind users cannot separate).
 */
import { signedPct } from '../utils/format';
import type { Opportunity, Restock, Trend } from './productStats';

/** `good` = better for your wallet, `bad` = worse, `flat` = no real change. */
export type Tone = 'good' | 'bad' | 'flat';

export interface TrendBadge {
  glyph: '↑' | '↓' | '=';
  text: string;
  tone: Tone;
  /** For screen readers, which get the whole sentence rather than a glyph. */
  aria: string;
}

/** A price going up is bad news, so "up" is the `bad` tone. */
export function trendBadge(trend: Trend): TrendBadge {
  if (trend.direction === 'flat') {
    return {
      glyph: '=', text: 'Stable', tone: 'flat',
      aria: 'Price is stable compared with your recent average',
    };
  }
  const up = trend.direction === 'up';
  const size = signedPct(Math.abs(trend.pct)).replace('+', '');
  return {
    glyph: up ? '↑' : '↓',
    text: signedPct(trend.pct),
    tone: up ? 'bad' : 'good',
    aria: `Price ${up ? 'up' : 'down'} ${size} compared with your recent average`,
  };
}

export interface OpportunityLabel {
  text: string;
  tone: Tone;
}

export function opportunityLabel(opportunity: Opportunity): OpportunityLabel {
  switch (opportunity) {
    case 'all-time-low': return { text: 'All-time low', tone: 'good' };
    case 'below-average': return { text: 'Cheaper than average', tone: 'good' };
    case 'above-average': return { text: 'More expensive than average', tone: 'bad' };
  }
}

export type RestockTone = 'unknown' | 'ok' | 'soon' | 'due' | 'overdue' | 'listed';

export interface RestockLabel {
  text: string;
  tone: RestockTone;
  /** How full the progress bar is, 0 to 1. */
  fill: number;
}

/**
 * The words and bar length for the restock meter. An item already on a list
 * says so instead of nagging you to add it.
 */
export function restockLabel(restock: Restock, onList: boolean): RestockLabel {
  const fill = restock.ratio === null ? 0 : Math.min(1, restock.ratio);

  if (onList) return { text: 'On your list', tone: 'listed', fill };

  switch (restock.state) {
    case 'unknown':
      return { text: 'Learning your rhythm', tone: 'unknown', fill: 0 };
    case 'ok': {
      const days = Math.max(1, restock.daysUntilDue ?? 1);
      return { text: `Due in ${days} ${days === 1 ? 'day' : 'days'}`, tone: 'ok', fill };
    }
    case 'soon':
      return { text: 'Suggested this week', tone: 'soon', fill };
    case 'due':
      return { text: 'Due now', tone: 'due', fill };
    case 'overdue':
      return { text: 'Overdue', tone: 'overdue', fill: 1 };
  }
}
