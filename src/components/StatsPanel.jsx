import React, { useMemo } from 'react';
import { PRIORITY_CONFIG, getWeekDates, getToday, formatDate } from '../utils/helpers.js';

// Mini bar chart for weekly view
function WeekBar({ date, total, completed, isToday }) {
  const pct  = total > 0 ? (completed / total) * 100 : 0;
  const d    = new Date(date + 'T00:00:00');
  const name = d.toLocaleDateString('en-US', { weekday: 'short' });
  const num  = d.getDate();

  return (
    <div className={`week-bar ${isToday ? 'today' : ''} ${total === 0 ? 'empty' : ''}`}>
      <div className="week-bar-track">
        <div
          className="week-bar-fill"
          style={{ height: `${pct}%`, background: pct === 100 ? 'var(--priority-low)' : 'var(--accent)' }}
        />
        {total > 0 && (
          <div className="week-bar-total" style={{ bottom: `${pct}%` }}>
            <div
              className="week-bar-remaining"
              style={{ height: `${100 - pct}%` }}
            />
          </div>
        )}
      </div>
      <span className="week-bar-pct">{total > 0 ? `${Math.round(pct)}%` : '–'}</span>
      <span className="week-bar-day">{name}</span>
      <span className="week-bar-num">{num}</span>
    </div>
  );
}

// Streak visualization
function StreakDisplay({ streak }) {
  const flames = Math.min(streak, 10);
  return (
    <div className="streak-display">
      <div className="streak-flames">
        {Array.from({ length: flames }, (_, i) => (
          <span
            key={i}
            className="streak-flame-icon"
            style={{ opacity: 0.4 + (i / flames) * 0.6, fontSize: `${14 + (i / flames) * 8}px` }}
          >
            🔥
          </span>
        ))}
        {streak === 0 && <span className="streak-flame-icon" style={{ opacity: 0.3 }}>🔥</span>}
      </div>
      <div className="streak-info">
        <span className="streak-number">{streak}</span>
        <span className="streak-unit">day streak</span>
      </div>
      {streak >= 7  && <div className="streak-badge">🏆 Week warrior</div>}
      {streak >= 30 && <div className="streak-badge">💎 Month master</div>}
    </div>
  );
}

// Momentum indicator (gamification)
function Momentum({ weeklyPct }) {
  const level = weeklyPct >= 80 ? 'high' : weeklyPct >= 50 ? 'medium' : 'low';
  const label = level === 'high' ? '🚀 High momentum' : level === 'medium' ? '📈 Building up' : '💡 Getting started';
  return (
    <div className={`momentum momentum-${level}`}>
      <div className="momentum-bar">
        <div
          className="momentum-fill"
          style={{ width: `${weeklyPct}%` }}
        />
      </div>
      <span className="momentum-label">{label}</span>
      <span className="momentum-pct">{Math.round(weeklyPct)}% this week</span>
    </div>
  );
}

export default function StatsPanel({ tasks, categories, streak, weeklyData, currentDate }) {
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const today     = getToday();

  const weekStats = useMemo(() => {
    let total = 0, completed = 0;
    weekDates.forEach(d => {
      const day = weeklyData[d] || {};
      total     += day.total     || 0;
      completed += day.completed || 0;
    });
    return { total, completed, pct: total > 0 ? (completed / total) * 100 : 0 };
  }, [weekDates, weeklyData]);

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (!t.categoryId) return;
      if (!map[t.categoryId]) map[t.categoryId] = { total: 0, completed: 0 };
      map[t.categoryId].total++;
      if (t.completed) map[t.categoryId].completed++;
    });
    return categories
      .filter(c => map[c.id])
      .map(c => ({ ...c, ...map[c.id] }))
      .sort((a, b) => b.total - a.total);
  }, [tasks, categories]);

  // Priority stats (all time)
  const prioStats = useMemo(() => {
    const map = { high: { total: 0, completed: 0 }, medium: { total: 0, completed: 0 }, low: { total: 0, completed: 0 } };
    tasks.forEach(t => {
      const p = t.priority || 'medium';
      if (map[p]) { map[p].total++; if (t.completed) map[p].completed++; }
    });
    return map;
  }, [tasks]);

  // All-time totals
  const allTime = useMemo(() => ({
    total:     tasks.length,
    completed: tasks.filter(t => t.completed).length,
  }), [tasks]);


  return (
    <div className="stats-panel">
      <div className="stats-header">
        <h2 className="stats-title">Review &amp; Progress</h2>
        <span className="stats-subtitle">Week of {formatDate(weekDates[0])}</span>
      </div>

      <div className="stats-grid">
        {/* Weekly chart */}
        <div className="stat-card card-wide">
          <div className="card-label">Weekly completion</div>
          <div className="week-chart">
            {weekDates.map(d => (
              <WeekBar
                key={d}
                date={d}
                total={weeklyData[d]?.total || 0}
                completed={weeklyData[d]?.completed || 0}
                isToday={d === today}
              />
            ))}
          </div>
          <Momentum weeklyPct={weekStats.pct} />
        </div>

        {/* Streak */}
        <div className="stat-card">
          <div className="card-label">Streak</div>
          <StreakDisplay streak={streak} />
        </div>

        {/* All-time */}
        <div className="stat-card">
          <div className="card-label">All time</div>
          <div className="alltime-stats">
            <div className="alltime-row">
              <span className="alltime-val tile-mono">{allTime.total}</span>
              <span className="alltime-key">tasks created</span>
            </div>
            <div className="alltime-row">
              <span className="alltime-val tile-mono" style={{ color: 'var(--priority-low)' }}>{allTime.completed}</span>
              <span className="alltime-key">completed</span>
            </div>
            <div className="alltime-row">
              <span className="alltime-val tile-mono" style={{ color: 'var(--accent)' }}>
                {allTime.total > 0 ? `${Math.round((allTime.completed / allTime.total) * 100)}%` : '—'}
              </span>
              <span className="alltime-key">completion rate</span>
            </div>
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="stat-card">
          <div className="card-label">By priority</div>
          <div className="prio-breakdown">
            {(['high', 'medium', 'low']).map(p => {
              const cfg = PRIORITY_CONFIG[p];
              const s   = prioStats[p];
              const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              return (
                <div key={p} className="prio-bd-row">
                  <span className="prio-bd-dot" style={{ background: cfg.color }} />
                  <span className="prio-bd-label">{cfg.label}</span>
                  <div className="prio-bd-track">
                    <div className="prio-bd-fill" style={{ width: `${pct}%`, background: cfg.color }} />
                  </div>
                  <span className="prio-bd-val tile-mono">{s.completed}/{s.total}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category breakdown */}
        {catBreakdown.length > 0 && (
          <div className="stat-card card-wide">
            <div className="card-label">By category</div>
            <div className="cat-breakdown">
              {catBreakdown.map(c => {
                const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0;
                return (
                  <div key={c.id} className="cat-bd-row">
                    <span className="cat-bd-dot" style={{ background: c.color }} />
                    <span className="cat-bd-name">{c.name}</span>
                    <div className="cat-bd-track">
                      <div className="cat-bd-fill" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                    <span className="cat-bd-pct tile-mono">{pct}%</span>
                    <span className="cat-bd-count tile-mono">{c.completed}/{c.total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
