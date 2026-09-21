// Small charts for the Items section: a sparkline, a hoverable price chart, a
// horizontal bar list and a meter.
//
// Conventions (from the data-viz method): thin 2px lines with round joins, an
// end-dot of at least 8px carrying a 2px ring in the surface colour, hairline
// solid gridlines, text in ink tokens and never in the series colour, and a
// single series drawn in a single hue with no legend box. Colours come from the
// theme tokens, so all four themes work; see items.css.
import React, { useRef, useState } from 'react';
import {
  sparkPoints, paddedDomain, timePositions, nearestIndex, barPercent,
} from '../../utils/chartGeometry';
import { money, shortDate } from '../../utils/format';

const SPARK_W = 132;
const SPARK_H = 36;
// Room for the 6px ring around a 4px dot, so the last point is never clipped.
const SPARK_PAD = 7;

/**
 * A tiny trend line. The line is de-emphasised ink and only the latest point is
 * in the accent, so the eye lands on "where it is now". `label` is announced by
 * screen readers in place of the picture.
 */
function Sparkline({ values, label, width = SPARK_W, height = SPARK_H }) {
  const points = sparkPoints(values, width, height, SPARK_PAD);
  if (points.length === 0) return null;
  const last = points[points.length - 1];

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height}
      role="img" aria-label={label}>
      {points.length > 1 && (
        <polyline className="spark-line" fill="none" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
          points={points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />
      )}
      <circle className="spark-ring" cx={last.x} cy={last.y} r="6" />
      <circle className="spark-dot" cx={last.x} cy={last.y} r="4" />
    </svg>
  );
}

const CHART_W = 560;
const CHART_H = 184;
const MARGIN = { top: 20, right: 22, bottom: 30, left: 54 };

/**
 * The price history for one product, with a hover (and arrow-key) readout.
 *
 * `points` are oldest-first: `{ date, unitPrice, qty, storeId }`. Every value is
 * also in the purchase table beside it, so the tooltip only ever enhances.
 */
function PriceChart({ points, storeName }) {
  const [active, setActive] = useState(null);
  const svgRef = useRef(null);

  if (points.length === 0) {
    return (
      <p className="pchart-empty">
        No confirmed prices yet. Confirm what you paid, or log a past purchase, and the history appears here.
      </p>
    );
  }

  const values = points.map(p => p.unitPrice);
  const [lo, hi] = paddedDomain(Math.min(...values), Math.max(...values));
  const xs = timePositions(points.map(p => p.date), MARGIN.left, CHART_W - MARGIN.right);
  const plotH = CHART_H - MARGIN.top - MARGIN.bottom;
  const yOf = value => MARGIN.top + plotH * (1 - (value - lo) / (hi - lo));
  const ticks = [hi, (hi + lo) / 2, lo];
  const last = points.length - 1;

  const readout = active === null ? null : points[active];
  const readoutText = readout
    ? `${shortDate(readout.date)}: ${money(readout.unitPrice)}${readout.storeId ? ` at ${storeName(readout.storeId)}` : ''}`
    : '';

  function hoverAt(clientX) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setActive(nearestIndex(xs, ((clientX - rect.left) / rect.width) * CHART_W));
  }

  function onKeyDown(event) {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setActive(a => (a === null ? last : Math.min(last, Math.max(0, a + step))));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(last);
    } else if (event.key === 'Escape' && active !== null) {
      // Only swallow Escape while there is something to dismiss; otherwise it
      // must reach the dialog and close it.
      event.stopPropagation();
      setActive(null);
    }
  }

  const tooltipLeft = readout ? Math.min(88, Math.max(12, (xs[active] / CHART_W) * 100)) : 0;

  return (
    <div className="pchart" tabIndex={0} role="group" onKeyDown={onKeyDown}
      aria-label="Price history. Use the left and right arrow keys to read each purchase.">
      <svg ref={svgRef} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="pchart-svg"
        onMouseMove={e => hoverAt(e.clientX)} onMouseLeave={() => setActive(null)}>
        {ticks.map(tick => (
          <g key={tick}>
            <line className="pchart-grid" x1={MARGIN.left} x2={CHART_W - MARGIN.right}
              y1={yOf(tick)} y2={yOf(tick)} />
            <text className="pchart-axis" x={MARGIN.left - 8} y={yOf(tick) + 4} textAnchor="end">
              {money(tick)}
            </text>
          </g>
        ))}

        <text className="pchart-axis" x={xs[0]} y={CHART_H - 8}
          textAnchor={points.length > 1 ? 'start' : 'middle'}>
          {shortDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text className="pchart-axis" x={xs[last]} y={CHART_H - 8} textAnchor="end">
            {shortDate(points[last].date)}
          </text>
        )}

        {points.length > 1 && (
          <polyline className="pchart-line" fill="none" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
            points={points.map((p, i) => `${xs[i].toFixed(1)},${yOf(p.unitPrice).toFixed(1)}`).join(' ')} />
        )}

        {readout && (
          <line className="pchart-cross" x1={xs[active]} x2={xs[active]}
            y1={MARGIN.top} y2={CHART_H - MARGIN.bottom} />
        )}

        {points.map((p, i) => (
          <g key={`${p.date}-${i}`}>
            <circle className="spark-ring" cx={xs[i]} cy={yOf(p.unitPrice)} r={i === active ? 8 : 6} />
            <circle className="spark-dot"
              cx={xs[i]} cy={yOf(p.unitPrice)} r={i === active ? 6 : 4} />
          </g>
        ))}

        {/* One direct label: the latest price. The rest live in the tooltip and the table. */}
        <text className="pchart-end" x={xs[last]} y={yOf(points[last].unitPrice) - 13}
          textAnchor={xs[last] > CHART_W - 70 ? 'end' : 'middle'}>
          {money(points[last].unitPrice)}
        </text>
      </svg>

      {readout && (
        <div className="pchart-tip" style={{ left: `${tooltipLeft}%` }}>
          <strong>{money(readout.unitPrice)}</strong>
          <span>{shortDate(readout.date)}{readout.qty !== 1 ? ` · ×${readout.qty}` : ''}</span>
          {readout.storeId && <span>{storeName(readout.storeId)}</span>}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{readoutText}</span>
    </div>
  );
}

/**
 * Horizontal bars for a handful of labelled amounts. One series, so one colour
 * and no legend; a bar is thin, square at the baseline and rounded at the data
 * end; the value sits at the tip, in ink.
 */
function BarList({ rows, format = money }) {
  const max = Math.max(0, ...rows.map(r => r.value));
  return (
    <ul className="bars">
      {rows.map(row => (
        <li key={row.key} className="bars-row">
          <span className="bars-label">{row.icon}<span className="bars-name">{row.label}</span></span>
          <span className="bars-track" aria-hidden="true">
            <span className="bars-fill" style={{ width: `${barPercent(row.value, max)}%` }} />
          </span>
          <span className="bars-value">{format(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A progress meter. The fill carries the state through its colour; the track is
 * a pale step of the same colour so the whole bar reads as one thing.
 */
function Meter({ fill, tone, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  return (
    <span className={`meter meter--${tone}`} role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="meter-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export { Sparkline, PriceChart, BarList, Meter };
