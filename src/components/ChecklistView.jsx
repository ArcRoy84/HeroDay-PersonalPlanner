import React, { useState, useMemo } from 'react';
import { PRIORITY_CONFIG, formatTime, formatDuration, timeToMinutes } from '../utils/helpers.js';

// ── Icons ──────────────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 6 5 9 10 3" />
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M9.5 2L12 4.5l-7 7H2.5V9L9.5 2z" />
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1.5" y1="3.5" x2="12.5" y2="3.5" />
    <path d="M4.5 3.5V2h5v1.5" />
    <path d="M2.5 3.5l.8 8.5h7.4l.8-8.5" />
  </svg>
);
const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="6" r="4.5" /><polyline points="6 3.5 6 6 8 7.5" />
  </svg>
);
const IconPin = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="6" cy="4.5" r="1.8" />
    <path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 8 6 11 6 11S2.5 8 2.5 4.5A3.5 3.5 0 0 1 6 1z" />
  </svg>
);
const IconRepeat = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1.5 3.5 3.5 1.5 5.5 3.5" />
    <path d="M3.5 1.5v6a2.5 2.5 0 0 0 2.5 2.5h1" />
    <polyline points="10.5 8.5 8.5 10.5 6.5 8.5" />
    <path d="M8.5 10.5v-6A2.5 2.5 0 0 0 6 2H5" />
  </svg>
);
const IconEmpty = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
    <rect x="8" y="12" width="32" height="28" rx="4" />
    <line x1="16" y1="22" x2="32" y2="22" /><line x1="16" y1="28" x2="26" y2="28" /><line x1="16" y1="34" x2="22" y2="34" />
    <circle cx="36" cy="12" r="8" fill="var(--bg-surface)" />
    <polyline points="32 12 35 15 40 9" stroke="var(--priority-low)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function recurrenceLabel(days) {
  if (!days?.length) return '';
  const s = [...days].sort((a, b) => a - b);
  if (s.length === 7)                              return 'Every day';
  if (JSON.stringify(s) === '[1,2,3,4,5]')         return 'Mon–Fri';
  if (JSON.stringify(s) === '[0,6]')               return 'Weekends';
  return s.map(d => DAY_SHORT[d]).join(', ');
}

function shortDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── TaskItem ────────────────────────────────────────────────────────────────
function TaskItem({ task, category, currentDate, onToggle, onEdit, onDelete }) {
  const [hovering, setHovering] = useState(false);
  const p = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  const isCompleted = task.recurrence?.days?.length
    ? !!task.completedDates?.[currentDate]
    : task.completed;

  const mapsUrl = task.location?.trim()
    ? `https://maps.google.com/?q=${encodeURIComponent(task.location.trim())}`
    : null;

  return (
    <li
      className={`task-item ${isCompleted ? 'task-completed' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        className="task-check"
        onClick={onToggle}
        style={{ '--pcolor': p.color }}
        title="Toggle complete"
      >
        {isCompleted && <IconCheck />}
      </button>

      <div className="task-body" onClick={onEdit} style={{ cursor: 'pointer' }}>
        <div className="task-title-row">
          <span className="priority-indicator" style={{ background: p.color }} title={p.label} />
          <span className="task-title">{task.title}</span>
        </div>

        <div className="task-meta-row">
          {task.startTime && (
            <span className="task-meta-chip">
              <IconClock />
              {formatTime(task.startTime)}
              {task.duration ? ` · ${formatDuration(task.duration)}` : ''}
            </span>
          )}
          {/* Multi-day range */}
          {task.endDate && (
            <span className="task-meta-chip multiday-chip">
              {shortDate(task.date)} – {shortDate(task.endDate)}
            </span>
          )}
          {/* Recurrence */}
          {task.recurrence?.days?.length > 0 && (
            <span className="task-meta-chip recur-chip">
              <IconRepeat />
              {recurrenceLabel(task.recurrence.days)}
            </span>
          )}
          {category && (
            <span className="task-meta-chip cat-chip" style={{ '--ccolor': category.color }}>
              {category.name}
            </span>
          )}
          {task.tags?.map(tag => (
            <span key={tag} className="task-meta-chip tag-chip">#{tag}</span>
          ))}
          {/* Location */}
          {task.location && (
            mapsUrl
              ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="task-meta-chip location-chip" onClick={e => e.stopPropagation()}>
                  <IconPin />{task.location}
                </a>
              : <span className="task-meta-chip location-chip"><IconPin />{task.location}</span>
          )}
        </div>
      </div>

      <div className={`task-actions ${hovering ? 'visible' : ''}`}>
        <button className="task-btn" onClick={onEdit} title="Edit"><IconEdit /></button>
        <button className="task-btn danger" onClick={onDelete} title="Delete"><IconTrash /></button>
      </div>
    </li>
  );
}

// ── ChecklistView ───────────────────────────────────────────────────────────
export default function ChecklistView({ tasks, categories, currentDate, onToggle, onEdit, onDelete, onAdd }) {
  const [filter, setFilter]   = useState('all');
  const [sortBy, setSortBy]   = useState('priority');
  const [groupBy, setGroupBy] = useState('none');

  const getCat = (id) => categories.find(c => c.id === id);

  const sorted = useMemo(() => {
    let list = filter === 'all' ? [...tasks] : tasks.filter(t => t.priority === filter);
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (sortBy === 'priority') {
      list.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
    } else if (sortBy === 'time') {
      list.sort((a, b) => {
        if (!a.startTime && !b.startTime) return 0;
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      });
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    // Recurring tasks use per-day completion
    const isDone = t => t.recurrence?.days?.length
      ? !!t.completedDates?.[currentDate]
      : t.completed;
    list.sort((a, b) => (isDone(a) ? 1 : 0) - (isDone(b) ? 1 : 0));
    return list;
  }, [tasks, filter, sortBy, currentDate]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ label: null, tasks: sorted }];
    if (groupBy === 'priority') {
      return ['high', 'medium', 'low'].map(p => ({
        label: PRIORITY_CONFIG[p].label,
        color: PRIORITY_CONFIG[p].color,
        tasks: sorted.filter(t => t.priority === p),
      })).filter(g => g.tasks.length > 0);
    }
    if (groupBy === 'category') {
      const byCat = {};
      sorted.forEach(t => {
        const key = t.categoryId || '__none__';
        if (!byCat[key]) byCat[key] = [];
        byCat[key].push(t);
      });
      return Object.entries(byCat).map(([key, tasks]) => {
        const cat = key === '__none__' ? null : getCat(key);
        return { label: cat?.name || 'Uncategorized', color: cat?.color, tasks };
      });
    }
    return [{ label: null, tasks: sorted }];
  }, [sorted, groupBy, categories]);

  const isDone = t => t.recurrence?.days?.length
    ? !!t.completedDates?.[currentDate]
    : t.completed;
  const completedCount = tasks.filter(isDone).length;

  return (
    <div className="checklist-view">
      <div className="cl-toolbar">
        <div className="cl-filters">
          {['all', 'high', 'medium', 'low'].map(f => (
            <button key={f}
              className={`filter-chip ${filter === f ? 'active' : ''}`}
              style={filter === f && f !== 'all'
                ? { background: PRIORITY_CONFIG[f].bg, color: PRIORITY_CONFIG[f].color, borderColor: PRIORITY_CONFIG[f].color + '66' }
                : {}}
              onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : PRIORITY_CONFIG[f].label}
            </button>
          ))}
        </div>
        <div className="cl-sorts">
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="priority">Priority</option>
            <option value="time">Time</option>
            <option value="created">Created</option>
          </select>
          <select className="sort-select" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            <option value="none">No groups</option>
            <option value="priority">By priority</option>
            <option value="category">By category</option>
          </select>
          <button className="btn-ghost sm cl-add-btn" onClick={onAdd}>+ Add task</button>
        </div>
      </div>

      <div className="cl-progress-bar">
        <div className="cl-progress-fill"
          style={{ width: tasks.length ? `${(completedCount / tasks.length) * 100}%` : '0%' }} />
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <IconEmpty />
          <p className="empty-title">No tasks for this day</p>
          <p className="empty-sub">Press <kbd>N</kbd> or click the + button to add one</p>
          <button className="btn-primary" onClick={onAdd}>Add first task</button>
        </div>
      ) : (
        <div className="task-groups">
          {groups.map((group, gi) => (
            <div key={gi} className="task-group">
              {group.label && (
                <div className="group-header">
                  {group.color && <span className="group-dot" style={{ background: group.color }} />}
                  <span className="group-label">{group.label}</span>
                  <span className="group-count">{group.tasks.length}</span>
                </div>
              )}
              <ul className="task-list">
                {group.tasks.map(task => (
                  <TaskItem key={task.id} task={task}
                    category={getCat(task.categoryId)}
                    currentDate={currentDate}
                    onToggle={() => onToggle(task.id)}
                    onEdit={() => onEdit(task)}
                    onDelete={() => onDelete(task.id)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="cl-footer">
        <span className="cl-summary">{completedCount} of {tasks.length} completed</span>
      </div>
    </div>
  );
}
