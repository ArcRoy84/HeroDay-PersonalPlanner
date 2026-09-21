import { describe, it, expect } from 'vitest';
import { sparkPoints, paddedDomain, timePositions, nearestIndex, barPercent } from './chartGeometry';

describe('sparkPoints', () => {
  it('spreads values evenly across the width, inside the padding', () => {
    const pts = sparkPoints([1, 2, 3], 100, 40, 10);
    expect(pts.map(p => p.x)).toEqual([10, 50, 90]);
  });

  it('puts the lowest value at the bottom and the highest at the top', () => {
    const pts = sparkPoints([4, 2, 6], 100, 40, 10);
    expect(pts[1]!.y).toBe(30); // lowest: height - pad
    expect(pts[2]!.y).toBe(10); // highest: pad
    expect(pts[0]!.y).toBe(20); // halfway
  });

  it('keeps every point inside the padding, so an end-dot is never clipped', () => {
    for (const p of sparkPoints([3, 9, 1, 7, 5], 132, 36, 6)) {
      expect(p.x).toBeGreaterThanOrEqual(6);
      expect(p.x).toBeLessThanOrEqual(126);
      expect(p.y).toBeGreaterThanOrEqual(6);
      expect(p.y).toBeLessThanOrEqual(30);
    }
  });

  it('draws a flat series at mid-height instead of dividing by zero', () => {
    const pts = sparkPoints([4, 4, 4], 100, 40, 10);
    expect(pts.every(p => p.y === 20)).toBe(true);
    expect(pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it('centres a single value', () => {
    expect(sparkPoints([4], 100, 40, 10)).toEqual([{ x: 50, y: 20 }]);
  });

  it('returns nothing for no values', () => {
    expect(sparkPoints([], 100, 40, 10)).toEqual([]);
  });
});

describe('paddedDomain', () => {
  it('adds air around the data', () => {
    const [lo, hi] = paddedDomain(4, 5);
    expect(lo).toBeLessThan(4);
    expect(hi).toBeGreaterThan(5);
  });

  it('gives a flat series a band so it does not collapse', () => {
    const [lo, hi] = paddedDomain(4, 4);
    expect(hi).toBeGreaterThan(lo);
    expect(lo).toBeLessThan(4);
    expect(hi).toBeGreaterThan(4);
  });

  it('never invents a price below zero', () => {
    expect(paddedDomain(0.1, 5)[0]).toBeGreaterThanOrEqual(0);
    expect(paddedDomain(0, 0)[0]).toBe(0);
  });
});

describe('timePositions', () => {
  it('spaces dates by the time between them, not evenly', () => {
    // Day 0, day 10, day 100: the last gap is nine times the first.
    const xs = timePositions(['2026-01-01', '2026-01-11', '2026-04-11'], 0, 100);
    expect(xs[0]).toBe(0);
    expect(xs[2]).toBe(100);
    expect(xs[1]).toBeCloseTo(10, 0);
  });

  it('centres purchases that all fall on one day', () => {
    expect(timePositions(['2026-01-01', '2026-01-01'], 20, 120)).toEqual([70, 70]);
    expect(timePositions(['2026-01-01'], 20, 120)).toEqual([70]);
  });

  it('handles no dates', () => {
    expect(timePositions([], 0, 100)).toEqual([]);
  });

  it('does not depend on the order the dates are given in', () => {
    const xs = timePositions(['2026-04-11', '2026-01-01'], 0, 100);
    expect(xs).toEqual([100, 0]);
  });
});

describe('nearestIndex', () => {
  it('finds the closest position', () => {
    expect(nearestIndex([0, 50, 100], 40)).toBe(1);
    expect(nearestIndex([0, 50, 100], 80)).toBe(2);
    expect(nearestIndex([0, 50, 100], -500)).toBe(0);
  });

  it('returns -1 for an empty list', () => {
    expect(nearestIndex([], 10)).toBe(-1);
  });
});

describe('barPercent', () => {
  it('scales against the longest bar', () => {
    expect(barPercent(50, 100)).toBe(50);
    expect(barPercent(100, 100)).toBe(100);
  });

  it('keeps a tiny value visible, but a zero one empty', () => {
    expect(barPercent(0.1, 100)).toBe(2);
    expect(barPercent(0, 100)).toBe(0);
  });

  it('is safe when everything is zero', () => {
    expect(barPercent(5, 0)).toBe(0);
  });
});
