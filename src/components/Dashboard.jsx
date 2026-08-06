import React, { useMemo } from 'react';
import { PRIORITY_CONFIG, timeToMinutes, getToday } from '../utils/helpers.js';
import WeatherWidget from './WeatherWidget.jsx';

// Circular progress ring
function Ring({ pct, size = 52, stroke = 4, color = 'var(--accent)' }) {
  const r     = (size - stroke) / 2;
  const circ  = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

export default function Dashboard({ tasks, allTasks, categories, streak, currentDate, weatherLocation, weatherUnit }) {
  const stats = useMemo(() => {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Pending by priority
    const pending = tasks.filter(t => !t.completed);
    const byPriority = {
      high:   pending.filter(t => t.priority === 'high').length,
      medium: pending.filter(t => t.priority === 'medium').length,
      low:    pending.filter(t => t.priority === 'low').length,
    };

    // Remaining time (sum of uncompleted task durations)
    const remainingMin = pending.reduce((acc, t) => acc + (t.duration || 0), 0);

    // Top category by task count
    const catCount = {};
    tasks.forEach(t => {
      if (t.categoryId) catCount[t.categoryId] = (catCount[t.categoryId] || 0) + 1;
    });
    const topCatId  = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topCat    = categories.find(c => c.id === topCatId);
    const topCatMax = Math.max(...Object.values(catCount), 1);

    return { total, completed, rate, byPriority, remainingMin, topCat, catCount, topCatMax };
  }, [tasks, categories]);

  const { total, completed, rate, byPriority, remainingMin, topCat, catCount, topCatMax } = stats;

  const remainHours = Math.floor(remainingMin / 60);
  const remainMins  = remainingMin % 60;

  return (
    <aside className="dashboard">
      {/* Completion */}
      <div className="dash-tile tile-completion">
        <div className="tile-ring">
          <Ring pct={rate} color={rate === 100 ? 'var(--priority-low)' : 'var(--accent)'} />
          <span className="ring-label">{rate}%</span>
        </div>
        <div className="tile-info">
          <span className="tile-value">{completed}/{total}</span>
          <span className="tile-label">Tasks done</span>
        </div>
      </div>

      {/* Streak */}
      <div className="dash-tile tile-streak">
        <div className="streak-flame">🔥</div>
        <div className="tile-info">
          <span className="tile-value tile-mono">{streak}</span>
          <span className="tile-label">Day streak</span>
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="dash-tile tile-priorities">
        <div className="tile-label-top">Pending</div>
        <div className="priority-rows">
          {(['high', 'medium', 'low']).map(p => (
            <div key={p} className="priority-row">
              <span className="priority-dot-sm" style={{ background: PRIORITY_CONFIG[p].color }} />
              <span className="priority-row-label">{PRIORITY_CONFIG[p].label}</span>
              <span className="priority-row-count tile-mono">{byPriority[p]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time remaining */}
      <div className="dash-tile tile-time">
        <div className="time-icon">⏱</div>
        <div className="tile-info">
          <span className="tile-value tile-mono">
            {remainingMin === 0 ? '—' : remainHours > 0 ? `${remainHours}h ${remainMins}m` : `${remainMins}m`}
          </span>
          <span className="tile-label">Remaining</span>
        </div>
      </div>

      {/* Top category */}
      <div className="dash-tile tile-categories">
        <div className="tile-label-top">By category</div>
        <div className="cat-bars">
          {categories
            .filter(c => catCount[c.id])
            .sort((a, b) => (catCount[b.id] || 0) - (catCount[a.id] || 0))
            .slice(0, 3)
            .map(c => (
              <div key={c.id} className="cat-bar-row">
                <span className="cat-bar-name" style={{ color: c.color }}>{c.name}</span>
                <div className="cat-bar-track">
                  <div
                    className="cat-bar-fill"
                    style={{
                      width: `${((catCount[c.id] || 0) / topCatMax) * 100}%`,
                      background: c.color,
                    }}
                  />
                </div>
                <span className="cat-bar-count tile-mono">{catCount[c.id]}</span>
              </div>
            ))
          }
          {!Object.keys(catCount).length && (
            <span className="tile-empty">No tasks yet</span>
          )}
        </div>
      </div>

      {/* Weather */}
      <WeatherWidget location={weatherLocation} unit={weatherUnit} />
    </aside>
  );
}
