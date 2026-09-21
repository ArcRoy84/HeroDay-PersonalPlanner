/**
 * Geometry for the small charts: where each value lands on the canvas.
 *
 * Pure so the placement can be tested. A chart that is drawn a few pixels off,
 * or one that draws a flat price series as a line falling off the edge, is
 * exactly the kind of bug that is invisible until someone looks closely.
 */
import { parseDateOnly } from './products';

export interface XY {
  x: number;
  y: number;
}

/**
 * Points for a sparkline: values spread evenly across the width, scaled to the
 * height with `pad` kept clear on every side so an end-dot is never clipped.
 * A flat series sits at mid-height rather than dividing by zero.
 */
export function sparkPoints(values: number[], width: number, height: number, pad: number): XY[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;

  return values.map((value, i) => ({
    x: values.length === 1 ? width / 2 : pad + (innerW * i) / (values.length - 1),
    y: span === 0 ? height / 2 : pad + innerH * (1 - (value - min) / span),
  }));
}

/**
 * The value range a price chart should show: the data's min and max with a
 * little air above and below so the line does not touch the frame. A flat
 * series gets a band around it so it does not collapse to a single line.
 */
export function paddedDomain(min: number, max: number): [number, number] {
  if (max === min) {
    const air = Math.max(0.5, Math.abs(max) * 0.1);
    return [Math.max(0, min - air), max + air];
  }
  const air = (max - min) * 0.12;
  // Prices are never negative, so do not let the padding invent a floor below 0.
  return [Math.max(0, min - air), max + air];
}

/**
 * Horizontal positions for dates, proportional to the time between them — so a
 * three-month gap looks like one, instead of every purchase being evenly spaced.
 * Dates that are all the same day sit in the middle.
 */
export function timePositions(dates: string[], x0: number, x1: number): number[] {
  if (dates.length === 0) return [];
  const times = dates.map(d => parseDateOnly(d).getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  if (first === last) return dates.map(() => (x0 + x1) / 2);
  return times.map(t => x0 + ((t - first) / (last - first)) * (x1 - x0));
}

/** Index of the position nearest `x`, for hover; `-1` for an empty list. */
export function nearestIndex(positions: number[], x: number): number {
  let best = -1;
  let bestDistance = Infinity;
  positions.forEach((position, i) => {
    const distance = Math.abs(position - x);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/** Bar length as a percentage of the longest, with a floor so a small value stays visible. */
export function barPercent(value: number, max: number, floor = 2): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(floor, Math.min(100, (value / max) * 100));
}
