import React, { useState, useEffect, useRef } from 'react';
import {
  PRIORITY_CONFIG, DURATION_OPTIONS, getToday
} from '../utils/helpers.js';

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" />
  </svg>
);
const IconBell = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M7 1.5a4 4 0 014 4V9l1 1.5H2L3 9V5.5a4 4 0 014-4z" />
    <path d="M5.5 11.5a1.5 1.5 0 003 0" />
  </svg>
);
const IconRepeat = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 4 4 2 6 4" />
    <path d="M4 2v7a3 3 0 0 0 3 3h1" />
    <polyline points="12 10 10 12 8 10" />
    <path d="M10 12V5a3 3 0 0 0-3-3H6" />
  </svg>
);
const IconPin = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="5.5" r="2" />
    <path d="M7 1a4.5 4.5 0 0 1 4.5 4.5C11.5 9 7 13 7 13S2.5 9 2.5 5.5A4.5 4.5 0 0 1 7 1z" />
  </svg>
);
const IconExternal = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 2H2v8h8V7" /><polyline points="7 2 10 2 10 5" /><line x1="10" y1="2" x2="5" y2="7" />
  </svg>
);
const IconCalRange = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="1" y="3" width="12" height="10" rx="1.5" />
    <line x1="1" y1="7" x2="13" y2="7" />
    <line x1="4" y1="1" x2="4" y2="5" /><line x1="10" y1="1" x2="10" y2="5" />
    <line x1="4" y1="10" x2="10" y2="10" />
  </svg>
);

const REMINDER_OPTIONS = [
  { value: 5, label: '5 min' }, { value: 10, label: '10 min' },
  { value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 hour' },
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── CategoryEditor ────────────────────────────────────────────────────────────
function CategoryEditor({ categories, onAdd, onDelete, onClose }) {
  const [name, setName]   = useState('');
  const [color, setColor] = useState('#7c66ff');
  const PRESETS = ['#7c66ff','#22d3ee','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#06b6d4'];
  return (
    <div className="cat-editor">
      <div className="cat-editor-header">
        <span>Manage Categories</span>
        <button className="icon-btn" onClick={onClose}><IconX /></button>
      </div>
      <div className="cat-editor-form">
        <input
          className="form-input"
          placeholder="Category name…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && (onAdd({ name: name.trim(), color }), setName(''))}
        />
        <div className="color-presets">
          {PRESETS.map(c => (
            <button key={c} className={`color-swatch ${color === c ? 'selected' : ''}`}
              style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <button className="btn-primary sm" disabled={!name.trim()}
          onClick={() => { onAdd({ name: name.trim(), color }); setName(''); }}>
          <IconPlus /> Add
        </button>
      </div>
      <ul className="cat-list">
        {categories.map(c => (
          <li key={c.id} className="cat-list-item">
            <span className="cat-dot" style={{ background: c.color }} />
            <span className="cat-name">{c.name}</span>
            <button className="cat-delete-btn" onClick={() => onDelete(c.id)}><IconX /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Toggle switch component ───────────────────────────────────────────────────
function Toggle({ on, onChange, label }) {
  return (
    <div className="toggle-row" onClick={onChange} role="switch" aria-checked={on} tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onChange()}>
      {label && <span className="toggle-label-text">{label}</span>}
      <div className={`toggle-switch ${on ? 'on' : ''}`} />
    </div>
  );
}

// ── TaskModal ─────────────────────────────────────────────────────────────────
export default function TaskModal({
  task, defaultTime, defaultDate, categories,
  onSave, onDelete, onClose, onAddCategory, onDeleteCategory
}) {
  const [form, setForm] = useState({
    title:           task?.title           || '',
    description:     task?.description     || '',
    priority:        task?.priority        || 'medium',
    categoryId:      task?.categoryId      || '',
    date:            task?.date            || defaultDate || getToday(),
    startTime:       task?.startTime       || defaultTime || '',
    duration:        task?.duration        || 60,
    tags:            task?.tags            || [],
    reminderOffsets: task?.reminderOffsets || (task?.reminder ? [5] : []),
    // Multi-day
    endDate:    task?.endDate    || '',
    endTime:    task?.endTime    || '',
    isMultiDay: !!(task?.endDate),
    // Recurring
    recurrence:  task?.recurrence  || { days: [] },
    isRecurring: !!(task?.recurrence?.days?.length),
    // Location
    location: task?.location || '',
  });

  const [tagInput,   setTagInput]   = useState('');
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [errors,     setErrors]     = useState({});
  const titleRef = useRef(null);

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50); }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (form.isMultiDay && form.endDate && form.endDate < form.date)
      e.endDate = 'End date must be on or after start date';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      title:          form.title.trim(),
      description:    form.description,
      priority:       form.priority,
      categoryId:     form.categoryId,
      date:           form.date,
      startTime:      form.startTime,
      duration:       form.duration,
      tags:           form.tags,
      reminderOffsets: form.reminderOffsets,
      reminder:        form.reminderOffsets.length > 0,
      endDate:    form.isMultiDay && form.endDate ? form.endDate : null,
      endTime:    form.isMultiDay ? form.endTime : '',
      recurrence: form.isRecurring && form.recurrence.days.length ? form.recurrence : null,
      location:   form.location.trim(),
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && !showCatMgr) onClose();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (!t || form.tags.includes(t)) { setTagInput(''); return; }
    set('tags', [...form.tags, t]);
    setTagInput('');
  };
  const removeTag = (t) => set('tags', form.tags.filter(x => x !== t));

  const toggleDay = (idx) => {
    setForm(prev => {
      const days = prev.recurrence.days.includes(idx)
        ? prev.recurrence.days.filter(d => d !== idx)
        : [...prev.recurrence.days, idx].sort((a, b) => a - b);
      return { ...prev, recurrence: { days } };
    });
  };

  const toggleOffset = async (minutes) => {
    if (form.reminderOffsets.length === 0 && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    setForm(prev => {
      const next = prev.reminderOffsets.includes(minutes)
        ? prev.reminderOffsets.filter(m => m !== minutes)
        : [...prev.reminderOffsets, minutes].sort((a, b) => a - b);
      return { ...prev, reminderOffsets: next };
    });
  };

  const blocked = Notification.permission === 'denied';
  const mapsUrl = form.location.trim()
    ? `https://maps.google.com/?q=${encodeURIComponent(form.location.trim())}`
    : null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !showCatMgr && onClose()}>
      <div className="modal" onKeyDown={handleKeyDown} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">{task ? 'Edit Task' : 'New Task'}</h3>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)"><IconX /></button>
        </div>

        <div className="modal-body">
          {/* Title */}
          <div className={`form-group ${errors.title ? 'has-error' : ''}`}>
            <input ref={titleRef} type="text" className="title-input"
              placeholder="What needs to be done?"
              value={form.title} onChange={e => set('title', e.target.value)} />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>

          {/* Priority */}
          <div className="form-group">
            <label className="form-label">Priority</label>
            <div className="priority-group">
              {['high', 'medium', 'low'].map(p => {
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <button key={p}
                    className={`prio-btn ${form.priority === p ? 'selected' : ''}`}
                    style={form.priority === p ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color + '80' } : {}}
                    onClick={() => set('priority', p)}>
                    <span className="prio-dot" style={{ background: cfg.color }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category + Start date */}
          <div className="form-row-2">
            <div className="form-group">
              <div className="label-row">
                <label className="form-label">Category</label>
                <button className="label-link" onClick={() => setShowCatMgr(true)}>Manage</button>
              </div>
              <select className="form-select" value={form.categoryId}
                onChange={e => set('categoryId', e.target.value)}>
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start date</label>
              <input type="date" className="form-input" value={form.date}
                onChange={e => set('date', e.target.value)} />
            </div>
          </div>

          {/* Multi-day toggle */}
          <div className="form-group form-group-compact">
            <div className="toggle-row-field">
              <div className="toggle-field-label">
                <IconCalRange />
                <span>Multi-day event</span>
              </div>
              <Toggle on={form.isMultiDay} onChange={() => set('isMultiDay', !form.isMultiDay)} />
            </div>
          </div>

          {form.isMultiDay && (
            <div className={`form-row-2 ${errors.endDate ? 'has-error' : ''}`}>
              <div className="form-group">
                <label className="form-label">End date</label>
                <input type="date" className="form-input" value={form.endDate}
                  min={form.date} onChange={e => set('endDate', e.target.value)} />
                {errors.endDate && <span className="field-error">{errors.endDate}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">End time</label>
                <input type="time" className="form-input" value={form.endTime}
                  onChange={e => set('endTime', e.target.value)} />
              </div>
            </div>
          )}

          {/* Recurring toggle + day picker */}
          <div className="form-group form-group-compact">
            <div className="toggle-row-field">
              <div className="toggle-field-label">
                <IconRepeat />
                <span>Recurring</span>
              </div>
              <Toggle on={form.isRecurring} onChange={() => set('isRecurring', !form.isRecurring)} />
            </div>
            {form.isRecurring && (
              <div className="day-picker">
                {DAY_LABELS.map((label, idx) => (
                  <button key={idx} type="button"
                    className={`day-chip ${form.recurrence.days.includes(idx) ? 'active' : ''}`}
                    onClick={() => toggleDay(idx)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start time + Duration */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Start time</label>
              <input type="time" className="form-input" value={form.startTime}
                onChange={e => set('startTime', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <select className="form-select" value={form.duration}
                onChange={e => set('duration', parseInt(e.target.value))}>
                {DURATION_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="form-group">
            <label className="form-label">Location</label>
            <div className="location-field">
              <span className="location-field-icon"><IconPin /></span>
              <input type="text" className="form-input location-field-input"
                placeholder="Address or place name…"
                value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">
                <IconExternal /> Get directions
              </a>
            )}
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label">Tags</label>
            <div className="tag-input-row">
              <input type="text" className="form-input" placeholder="Add tag and press Enter…"
                value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              <button className="btn-ghost sm" onClick={addTag}><IconPlus /></button>
            </div>
            {form.tags.length > 0 && (
              <div className="tags-row">
                {form.tags.map(t => (
                  <span key={t} className="tag-chip">
                    #{t}<button onClick={() => removeTag(t)}><IconX /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" placeholder="Optional description…"
              rows={3} value={form.description}
              onChange={e => set('description', e.target.value)} />
          </div>

          {/* Reminders */}
          <div className="reminder-section">
            <div className="reminder-label-row">
              <IconBell />
              <span>Remind me before</span>
              {blocked && <span className="reminder-blocked">⚠ Notifications blocked</span>}
            </div>
            {!blocked && (
              <div className="reminder-chips">
                {REMINDER_OPTIONS.map(({ value, label }) => {
                  const active = form.reminderOffsets.includes(value);
                  return (
                    <button key={value} className={`reminder-chip ${active ? 'active' : ''}`}
                      onClick={() => toggleOffset(value)}>
                      {label}
                    </button>
                  );
                })}
                {form.reminderOffsets.length > 0 && (
                  <button className="reminder-chip reminder-chip-clear"
                    onClick={() => set('reminderOffsets', [])}>
                    ✕ Clear
                  </button>
                )}
              </div>
            )}
            {form.reminderOffsets.length > 0 && (
              <p className="reminder-hint">+ notification when task starts</p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-left">
            {onDelete && <button className="btn-danger" onClick={onDelete}>Delete task</button>}
          </div>
          <div className="modal-footer-right">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>
              {task ? 'Save changes' : 'Add task'}<kbd>⌘↩</kbd>
            </button>
          </div>
        </div>

        {showCatMgr && (
          <div className="cat-editor-overlay">
            <CategoryEditor categories={categories}
              onAdd={onAddCategory} onDelete={onDeleteCategory}
              onClose={() => setShowCatMgr(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
