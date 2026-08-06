import React, { useState, useEffect } from 'react';
import { getToday } from '../utils/helpers.js';

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DAY_HEADS = ['M','T','W','T','F','S','S'];

export default function MiniCalendar({ currentDate, setCurrentDate, tasks = [] }) {
  const todayStr = getToday();

  // Keep view in sync when currentDate changes externally
  const [view, setView] = useState(() => {
    const d = new Date(currentDate + 'T00:00:00');
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    const d = new Date(currentDate + 'T00:00:00');
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }, [currentDate]);

  // Build a map of date → { total, done } for dot indicators
  const dayMap = {};
  tasks.forEach(t => {
    if (!t.date) return;
    if (!dayMap[t.date]) dayMap[t.date] = { total: 0, done: 0 };
    dayMap[t.date].total++;
    if (t.completed) dayMap[t.date].done++;
  });

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstDow    = new Date(view.y, view.m, 1).getDay(); // 0=Sun
  // Shift so week starts Monday (0=Mon … 6=Sun)
  const startOffset = (firstDow + 6) % 7;

  const navigate = (delta) =>
    setView(({ y, m }) => {
      let nm = m + delta, ny = y;
      if (nm < 0)  { nm = 11; ny--; }
      if (nm > 11) { nm = 0;  ny++; }
      return { y: ny, m: nm };
    });

  const goToday = () => {
    const d = new Date(todayStr + 'T00:00:00');
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setCurrentDate(todayStr);
  };

  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - startOffset + 1;
    if (day < 1 || day > daysInMonth) return null;
    const mm  = String(view.m + 1).padStart(2, '0');
    const dd  = String(day).padStart(2, '0');
    return { day, date: `${view.y}-${mm}-${dd}` };
  });

  return (
    <div className="mini-cal">
      <div className="mini-cal-head">
        <button className="mini-cal-arrow" onClick={() => navigate(-1)}>‹</button>
        <button className="mini-cal-month-btn" onClick={goToday} title="Go to today">
          {MONTH_NAMES[view.m]} {view.y}
        </button>
        <button className="mini-cal-arrow" onClick={() => navigate(1)}>›</button>
      </div>

      <div className="mini-cal-grid">
        {DAY_HEADS.map((d, i) => (
          <div key={i} className="mini-cal-dh">{d}</div>
        ))}

        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="mini-cal-empty" />;
          const isToday    = cell.date === todayStr;
          const isSel      = cell.date === currentDate;
          const info       = dayMap[cell.date];
          const allDone    = info && info.done === info.total;
          const isSunday   = new Date(cell.date + 'T00:00:00').getDay() === 0;

          return (
            <button
              key={i}
              className={[
                'mini-cal-day',
                isToday  ? 'is-today'    : '',
                isSel    ? 'is-selected' : '',
                isSunday ? 'is-sunday'   : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setCurrentDate(cell.date)}
            >
              <span className="mini-cal-num">{cell.day}</span>
              {info && (
                <span
                  className="mini-cal-dot"
                  style={{ background: allDone ? 'var(--priority-low)' : 'var(--accent)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
