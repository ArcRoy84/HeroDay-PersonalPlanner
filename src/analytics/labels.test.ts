import { describe, it, expect } from 'vitest';
import { trendBadge, opportunityLabel, restockLabel } from './labels';
import type { Restock } from './productStats';

const restock = (over: Partial<Restock>): Restock => ({
  state: 'ok', ratio: 0.5, daysUntilDue: 4, ...over,
});

describe('trendBadge', () => {
  it('treats a rising price as bad news, with an up arrow and the percentage', () => {
    expect(trendBadge({ direction: 'up', pct: 5 })).toMatchObject({ glyph: '↑', text: '+5%', tone: 'bad' });
  });

  it('treats a falling price as good news', () => {
    expect(trendBadge({ direction: 'down', pct: -10 })).toMatchObject({ glyph: '↓', text: '−10%', tone: 'good' });
  });

  it('calls a flat trend stable', () => {
    expect(trendBadge({ direction: 'flat', pct: 1.2 })).toMatchObject({ glyph: '=', text: 'Stable', tone: 'flat' });
  });

  it('gives screen readers a sentence, not a glyph', () => {
    expect(trendBadge({ direction: 'up', pct: 5 }).aria).toBe('Price up 5% compared with your recent average');
    expect(trendBadge({ direction: 'down', pct: -10.5 }).aria).toBe('Price down 10.5% compared with your recent average');
    expect(trendBadge({ direction: 'flat', pct: 0 }).aria).toMatch(/stable/i);
  });
});

describe('opportunityLabel', () => {
  it('uses the wording the product asked for', () => {
    expect(opportunityLabel('all-time-low')).toEqual({ text: 'All-time low', tone: 'good' });
    expect(opportunityLabel('above-average')).toEqual({ text: 'More expensive than average', tone: 'bad' });
    expect(opportunityLabel('below-average').tone).toBe('good');
  });
});

describe('restockLabel', () => {
  it('counts down the days when there is time', () => {
    expect(restockLabel(restock({ state: 'ok', daysUntilDue: 4 }), false)).toMatchObject({
      text: 'Due in 4 days', tone: 'ok',
    });
    expect(restockLabel(restock({ state: 'ok', daysUntilDue: 1 }), false).text).toBe('Due in 1 day');
  });

  it('never says "due in 0 days"', () => {
    expect(restockLabel(restock({ state: 'ok', daysUntilDue: 0 }), false).text).toBe('Due in 1 day');
  });

  it('suggests this week as it gets close, then says due, then overdue', () => {
    expect(restockLabel(restock({ state: 'soon', ratio: 0.8 }), false).text).toBe('Suggested this week');
    expect(restockLabel(restock({ state: 'due', ratio: 1 }), false).text).toBe('Due now');
    expect(restockLabel(restock({ state: 'overdue', ratio: 1.4 }), false)).toMatchObject({
      text: 'Overdue', tone: 'overdue', fill: 1,
    });
  });

  it('fills the bar in proportion, capped at full', () => {
    expect(restockLabel(restock({ ratio: 0.5 }), false).fill).toBe(0.5);
    expect(restockLabel(restock({ state: 'due', ratio: 1.1 }), false).fill).toBe(1);
  });

  it('admits when it has not learned a rhythm yet', () => {
    expect(restockLabel({ state: 'unknown', ratio: null, daysUntilDue: null }, false)).toEqual({
      text: 'Learning your rhythm', tone: 'unknown', fill: 0,
    });
  });

  it('says "on your list" instead of nagging about something already there', () => {
    const label = restockLabel(restock({ state: 'overdue', ratio: 1.4 }), true);
    expect(label.text).toBe('On your list');
    expect(label.tone).toBe('listed');
  });
});
