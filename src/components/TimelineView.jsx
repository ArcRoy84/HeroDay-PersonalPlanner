import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  TIMELINE_START, TIMELINE_END, HOUR_HEIGHT, SNAP_MINUTES,
  timeToMinutes, minutesToTime, formatTime, formatDuration,
  PRIORITY_CONFIG, getToday,
} from '../utils/helpers.js';
import MiniCalendar from './MiniCalendar.jsx';
import StickyNotes from './StickyNotes.jsx';

const TOTAL_HOURS = TIMELINE_END - TIMELINE_START; // 18

// ── Status ─────────────────────────────────────────────────────────────────
function getTaskStatus(task, isToday) {
  if (task.completed) return 'done';
  if (!task.startTime) return 'pending';
  if (!isToday) return 'pending';
  const now      = new Date();
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  const startMin = timeToMinutes(task.startTime);
  const endMin   = startMin + (task.duration || 60);
  if (nowMin > endMin)    return 'overdue';
  if (nowMin >= startMin) return 'active';
  if (startMin - nowMin <= 120) return 'upcoming';
  return 'pending';
}

const STATUS_COLOR = {
  done:     'var(--priority-low)',
  active:   'var(--accent)',
  upcoming: 'var(--priority-medium)',
  overdue:  'var(--priority-high)',
  pending:  'var(--text-muted)',
};

const STATUS_LABEL = {
  done:     'Completed',
  active:   'In progress',
  upcoming: 'Upcoming',
  overdue:  'Overdue',
  pending:  'Scheduled',
};

// ── Layout: non-overlapping columns ────────────────────────────────────────
function layoutTasks(tasks) {
  const sorted = [...tasks]
    .filter(t => t.startTime)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const cols = [];          // each col: { endMin }
  const layout = {};        // taskId → { col, totalCols }

  sorted.forEach(task => {
    const startMin = timeToMinutes(task.startTime);
    const endMin   = startMin + (task.duration || 60);
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      if (cols[c].endMin <= startMin) {
        cols[c].endMin = endMin;
        layout[task.id] = { col: c };
        placed = true;
        break;
      }
    }
    if (!placed) {
      layout[task.id] = { col: cols.length };
      cols.push({ endMin });
    }
  });

  // Second pass: find max overlapping columns
  sorted.forEach(task => {
    const startMin = timeToMinutes(task.startTime);
    const endMin   = startMin + (task.duration || 60);
    let maxCol = layout[task.id].col;
    sorted.forEach(other => {
      if (other.id === task.id) return;
      const oS = timeToMinutes(other.startTime);
      const oE = oS + (other.duration || 60);
      if (oS < endMin && oE > startMin) maxCol = Math.max(maxCol, layout[other.id]?.col ?? 0);
    });
    layout[task.id].totalCols = maxCol + 1;
  });

  return layout;
}

// ── Hour label ─────────────────────────────────────────────────────────────
function hourLabel(h) {
  if (h === 12) return '12 PM';
  if (h === 0 || h === 24) return '12 AM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ── Task card (spine-connected) ─────────────────────────────────────────────
function TaskCard({
  task, category, status, layout,
  isDragging, previewMinutes, previewDuration,
  onToggle, onEdit, onDelete, onMouseDown, onResizeMouseDown,
}) {
  const startMin = isDragging && previewMinutes != null
    ? previewMinutes : timeToMinutes(task.startTime);
  const dur    = previewDuration ?? (task.duration || 60);
  const top    = ((startMin - TIMELINE_START * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max((dur / 60) * HOUR_HEIGHT, 32);

  const colCount = layout?.totalCols || 1;
  const colIdx   = layout?.col || 0;
  const colW     = 100 / colCount;

  const catColor = category?.color || 'var(--accent)';
  const p        = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const color    = STATUS_COLOR[status];

  return (
    <div
      className={`tl-card status-${status} ${isDragging ? 'dragging' : ''}`}
      style={{
        top:    `${top}px`,
        height: `${height}px`,
        left:   `calc(${colIdx * colW}% + 2px)`,
        width:  `calc(${colW}% - 4px)`,
        '--cat-color':  catColor,
        '--prio-color': p.color,
        '--stat-color': color,
      }}
      onMouseDown={onMouseDown}
    >
      {/* Left accent bar = category color */}
      <div className="tl-card-accent" />

      {/* Priority stripe at top */}
      <div className="tl-card-prio-stripe" />

      <div className="tl-card-inner">
        <div className="tl-card-row1">
          <div className="tl-card-status-dot" style={{ background: color }} />
          <span className="tl-card-title">{task.title}</span>
          <div className="tl-card-actions" onClick={e => e.stopPropagation()}>
            <button className="tl-card-btn" onClick={onToggle} title={task.completed ? 'Undo' : 'Complete'}>
              {task.completed
                ? <IconUndo />
                : <IconCheck />}
            </button>
            <button className="tl-card-btn" onClick={onEdit} title="Edit"><IconEdit /></button>
            <button className="tl-card-btn danger" onClick={onDelete} title="Delete"><IconTrash /></button>
          </div>
        </div>

        {height > 48 && (
          <div className="tl-card-row2">
            <span className="tl-card-time tile-mono">
              {formatTime(task.startTime)}
              {dur ? ` · ${formatDuration(dur)}` : ''}
            </span>
            {category && (
              <span className="tl-card-cat" style={{ color: catColor }}>{category.name}</span>
            )}
            <span className="tl-card-status-label" style={{ color }}>{STATUS_LABEL[status]}</span>
          </div>
        )}
      </div>

      <div className="tl-resize-handle" onMouseDown={onResizeMouseDown} />
    </div>
  );
}

// ── Unscheduled tasks bar ────────────────────────────────────────────────────
function UnscheduledBar({ tasks, categories, onEdit, onToggle }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;
  return (
    <div className="tl-unscheduled">
      <div className="tl-unsched-header" onClick={() => setOpen(o => !o)}>
        <span className="tl-unsched-label">Unscheduled</span>
        <span className="tl-unsched-count">{tasks.length}</span>
        <span className={`tl-unsched-chevron ${open ? 'open' : ''}`}>›</span>
      </div>
      {open && (
        <div className="tl-unsched-list">
          {tasks.map(t => {
            const cat = categories.find(c => c.id === t.categoryId);
            const p   = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
            return (
              <div key={t.id} className={`tl-unsched-item ${t.completed ? 'done' : ''}`} onClick={() => onEdit(t)}>
                <div className="tl-unsched-dot" style={{ background: p.color }} />
                <span className="tl-unsched-title">{t.title}</span>
                {cat && <span className="tl-unsched-cat" style={{ color: cat.color }}>{cat.name}</span>}
                <button className="tl-card-btn" onClick={e => { e.stopPropagation(); onToggle(t.id); }}>
                  <IconCheck />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Day quick stats (sidebar) ────────────────────────────────────────────────
function DayStats({ tasks, isToday, isSunday }) {
  const total    = tasks.length;
  const done     = tasks.filter(t => t.completed).length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
  const pending  = tasks.filter(t => !t.completed);
  const remMin   = pending.reduce((s, t) => s + (t.duration || 0), 0);
  const remH     = Math.floor(remMin / 60);
  const remM     = remMin % 60;

  return (
    <div className="tl-day-stats">
      <div className="tl-ds-header">
        {isSunday
          ? '📋 Planning Day'
          : isToday ? '⚡ Today' : '📅 Day Overview'}
      </div>

      {isSunday && (
        <p className="tl-ds-sunday-note">
          Sunday is your weekly planning day. Review last week and set up tasks for the week ahead.
        </p>
      )}

      <div className="tl-ds-grid">
        <div className="tl-ds-tile">
          <span className="tl-ds-val tile-mono" style={{ color: pct === 100 ? 'var(--priority-low)' : 'var(--accent)' }}>
            {pct}%
          </span>
          <span className="tl-ds-lbl">done</span>
        </div>
        <div className="tl-ds-tile">
          <span className="tl-ds-val tile-mono">{done}/{total}</span>
          <span className="tl-ds-lbl">tasks</span>
        </div>
        <div className="tl-ds-tile">
          <span className="tl-ds-val tile-mono">
            {remMin === 0 ? '—' : remH > 0 ? `${remH}h${remM ? ` ${remM}m` : ''}` : `${remM}m`}
          </span>
          <span className="tl-ds-lbl">remaining</span>
        </div>
      </div>

      <div className="tl-ds-bar">
        <div className="tl-ds-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1.5 5.5 4.5 8.5 9.5 2.5" />
  </svg>
);
const IconUndo = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M2 5.5A4 4 0 1 0 3.5 2" /><polyline points="2 1.5 2 5.5 6 5.5" />
  </svg>
);
const IconEdit = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M7.5 1.5L9.5 3.5l-6 6H1.5V7.5l6-6z" />
  </svg>
);
const IconTrash = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1" y1="2.5" x2="10" y2="2.5" /><path d="M3.5 2.5V1.5h4v1" /><path d="M2 2.5l.6 7h5.8l.6-7" />
  </svg>
);

// ── TimelineView (main export) ─────────────────────────────────────────────
export default function TimelineView({
  tasks, categories, currentDate, allTasks,
  onToggle, onEdit, onDelete, onUpdate, onAddAtTime, setCurrentDate,
}) {
  const scrollRef   = useRef(null);
  const cardsRef    = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [dragState,    setDragState]    = useState(null);
  const [resizeState,  setResizeState]  = useState(null);
  const [dragPreview,  setDragPreview]  = useState({});
  const [resizePrev,   setResizePrev]   = useState({});

  // Tick for current-time indicator
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Scroll to current hour on mount / date change
  useEffect(() => {
    const now  = new Date();
    const minFromStart = (now.getHours() - TIMELINE_START) * 60 + now.getMinutes();
    if (minFromStart > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (minFromStart / 60) * HOUR_HEIGHT - 200);
    }
  }, [currentDate]);

  const todayStr  = getToday();
  const isToday   = currentDate === todayStr;
  const isSunday  = new Date(currentDate + 'T00:00:00').getDay() === 0;

  const scheduled   = tasks.filter(t =>  t.startTime);
  const unscheduled = tasks.filter(t => !t.startTime);
  const layout      = useMemo(() => layoutTasks(scheduled), [scheduled]);
  const getCat      = id => categories.find(c => c.id === id);

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i + TIMELINE_START);

  // Current time position
  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
  const nowTop = ((nowMin - TIMELINE_START * 60) / 60) * HOUR_HEIGHT;

  // ── Drag helpers ──────────────────────────────────────────────────────────
  const snapMin = useCallback((raw) => {
    const clamped = Math.max(TIMELINE_START * 60, Math.min((TIMELINE_END - 1) * 60, raw));
    return Math.round(clamped / SNAP_MINUTES) * SNAP_MINUTES;
  }, []);

  const getMinFromClientY = useCallback((clientY, offsetY = 0) => {
    const rect = scrollRef.current.getBoundingClientRect();
    const relY = clientY - rect.top + scrollRef.current.scrollTop - offsetY;
    return (relY / HOUR_HEIGHT) * 60 + TIMELINE_START * 60;
  }, []);

  const handleTaskMouseDown = useCallback((e, task) => {
    if (e.target.classList.contains('tl-resize-handle')) return;
    if (e.target.closest('.tl-card-actions')) return;
    e.preventDefault();
    const rect    = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    setDragState({ taskId: task.id, offsetY, origStart: timeToMinutes(task.startTime) });
  }, []);

  const handleResizeMouseDown = useCallback((e, task) => {
    e.stopPropagation();
    e.preventDefault();
    setResizeState({ taskId: task.id, startY: e.clientY, origDur: task.duration || 60 });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (dragState) {
      const raw     = getMinFromClientY(e.clientY, dragState.offsetY);
      const snapped = snapMin(raw);
      setDragPreview(p => ({ ...p, [dragState.taskId]: snapped }));
    }
    if (resizeState) {
      const deltaY  = e.clientY - resizeState.startY;
      const deltaMi = (deltaY / HOUR_HEIGHT) * 60;
      const snapped = Math.max(SNAP_MINUTES, Math.round((resizeState.origDur + deltaMi) / SNAP_MINUTES) * SNAP_MINUTES);
      setResizePrev(p => ({ ...p, [resizeState.taskId]: snapped }));
    }
  }, [dragState, resizeState, getMinFromClientY, snapMin]);

  const handleMouseUp = useCallback(() => {
    if (dragState) {
      const newMin = dragPreview[dragState.taskId];
      if (newMin != null && newMin !== dragState.origStart) {
        onUpdate(dragState.taskId, { startTime: minutesToTime(newMin) });
      }
      setDragState(null);
      setDragPreview({});
    }
    if (resizeState) {
      const newDur = resizePrev[resizeState.taskId];
      if (newDur != null) onUpdate(resizeState.taskId, { duration: newDur });
      setResizeState(null);
      setResizePrev({});
    }
  }, [dragState, resizeState, dragPreview, resizePrev, onUpdate]);

  useEffect(() => {
    if (!dragState && !resizeState) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup',  handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup',  handleMouseUp);
    };
  }, [dragState, resizeState, handleMouseMove, handleMouseUp]);

  const handleContainerClick = useCallback((e) => {
    if (dragState || resizeState) return;
    if (e.target.closest('.tl-card')) return;
    const raw     = getMinFromClientY(e.clientY);
    const snapped = snapMin(raw);
    onAddAtTime(minutesToTime(snapped));
  }, [dragState, resizeState, getMinFromClientY, snapMin, onAddAtTime]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="tl2-view">

      {/* ── LEFT: Timeline (75%) ── */}
      <div className="tl2-left">
        <UnscheduledBar
          tasks={unscheduled}
          categories={categories}
          onEdit={onEdit}
          onToggle={onToggle}
        />

        <div
          className={`tl2-scroll ${dragState || resizeState ? 'no-select' : ''}`}
          ref={scrollRef}
        >
          <div className="tl2-canvas" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>

            {/* Hour labels column */}
            <div className="tl2-labels-col">
              {hours.map(h => (
                <div key={h} className="tl2-hour-label" style={{ height: HOUR_HEIGHT }}>
                  <span>{hourLabel(h)}</span>
                </div>
              ))}
            </div>

            {/* Spine column — the vertical line + dots */}
            <div className="tl2-spine-col">
              <div className="tl2-spine-line" />

              {/* Hour tick marks */}
              {hours.map(h => (
                <div
                  key={h}
                  className="tl2-spine-tick"
                  style={{ top: `${(h - TIMELINE_START) * HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Task dots on the spine */}
              {scheduled.map(task => {
                const startMin = dragPreview[task.id] ?? timeToMinutes(task.startTime);
                const topPx    = ((startMin - TIMELINE_START * 60) / 60) * HOUR_HEIGHT;
                const status   = getTaskStatus(task, isToday);
                const color    = STATUS_COLOR[status];
                const isActive = status === 'active';
                return (
                  <div
                    key={task.id}
                    className={`tl2-spine-dot ${isActive ? 'pulsing' : ''}`}
                    style={{ top: `${topPx}px`, '--dot-color': color }}
                    title={`${task.title} — ${STATUS_LABEL[status]}`}
                  />
                );
              })}

              {/* Current-time dot on spine */}
              {isToday && nowMin >= TIMELINE_START * 60 && nowMin < TIMELINE_END * 60 && (
                <div className="tl2-now-spine-dot" style={{ top: `${nowTop}px` }} />
              )}
            </div>

            {/* Cards column */}
            <div className="tl2-cards-col" ref={cardsRef} onClick={handleContainerClick}>
              {/* Hour grid lines */}
              {hours.map(h => (
                <React.Fragment key={h}>
                  <div className="tl2-grid-h"  style={{ top: `${(h - TIMELINE_START) * HOUR_HEIGHT}px` }} />
                  <div className="tl2-grid-hh" style={{ top: `${(h - TIMELINE_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                </React.Fragment>
              ))}

              {/* Task cards */}
              {scheduled.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  category={getCat(task.categoryId)}
                  status={getTaskStatus(task, isToday)}
                  layout={layout[task.id] || { col: 0, totalCols: 1 }}
                  isDragging={dragState?.taskId === task.id}
                  previewMinutes={dragPreview[task.id]}
                  previewDuration={resizePrev[task.id]}
                  onToggle={() => onToggle(task.id)}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(task.id)}
                  onMouseDown={e => handleTaskMouseDown(e, task)}
                  onResizeMouseDown={e => handleResizeMouseDown(e, task)}
                />
              ))}

              {/* Current time horizontal line */}
              {isToday && nowMin >= TIMELINE_START * 60 && nowMin < TIMELINE_END * 60 && (
                <div className="tl2-now-line" style={{ top: `${nowTop}px` }}>
                  <span className="tl2-now-time tile-mono">
                    {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Sidebar (25%) ── */}
      <aside className="tl2-sidebar">
        <DayStats tasks={tasks} isToday={isToday} isSunday={isSunday} />

        <MiniCalendar
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          tasks={allTasks}
        />

        <StickyNotes date={currentDate} />
      </aside>
    </div>
  );
}
