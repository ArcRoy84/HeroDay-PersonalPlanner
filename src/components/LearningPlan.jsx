import React, { useState, useMemo, useEffect, useRef } from 'react';
import { COURSE_CATEGORIES, COURSE_CATEGORY_KEYS, courseProgress } from '../data/learningCategories.js';
import { getToday, DURATION_OPTIONS } from '../utils/helpers.js';

// ── Icons ──────────────────────────────────────────────────────────────────
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" /><line x1="10.5" y1="3.5" x2="3.5" y2="10.5" />
  </svg>
);
const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" />
  </svg>
);
const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 1.5l3 3L4 13H1v-3z" />
  </svg>
);
const IconCheck = () => (
  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1.5 4.5 3.5 6.5 7.5 2" />
  </svg>
);
const IconTarget = () => (
  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="5.5" /><circle cx="7" cy="7" r="2" />
  </svg>
);
const IconClock = () => (
  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="7" cy="7" r="5.5" /><path d="M7 4v3l2 1.5" />
  </svg>
);
const IconLink = () => (
  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6 8a3 3 0 0 0 4.2.3l1.3-1.3a3 3 0 0 0-4.2-4.2L6.7 3.4" />
    <path d="M8 6a3 3 0 0 0-4.2-.3L2.5 7a3 3 0 0 0 4.2 4.2L7.3 10.6" />
  </svg>
);

// ── helpers ────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(getToday() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}
function formatDeadline(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return null;
  if (d < 0)  return { text: `${Math.abs(d)}d overdue`, tone: 'overdue' };
  if (d === 0) return { text: 'Due today', tone: 'soon' };
  if (d <= 7) return { text: `${d}d left`, tone: 'soon' };
  return { text: `${d}d left`, tone: 'normal' };
}

function useLearningStats(courses, goals) {
  return useMemo(() => {
    const total = courses.length;
    const progresses = courses.map(courseProgress);
    const completed = progresses.filter(p => p === 100).length;
    const overallPct = total ? Math.round(progresses.reduce((s, p) => s + p, 0) / total) : 0;
    const totalHoursPerWeek = courses.reduce((s, c) => s + (c.weeklyHours || 0), 0);
    return { total, completed, overallPct, activeGoals: goals.length, totalHoursPerWeek };
  }, [courses, goals]);
}

// ── Confetti burst ──────────────────────────────────────────────────────────
function triggerConfetti() {
  const colors = ['#3ecf8e', '#4f8ef7', '#f5a623', '#e879a0', '#a78bfa'];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;left:${Math.random() * 100}vw;top:-10px;
      width:${6 + Math.random() * 6}px;height:${6 + Math.random() * 6}px;
      background:${colors[i % colors.length]};
      border-radius:${Math.random() > .5 ? '50%' : '2px'};
      animation:confetti-fall ${1.5 + Math.random() * 2}s linear forwards;
      animation-delay:${Math.random() * 0.5}s;pointer-events:none;z-index:9999;
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── Ring ──────────────────────────────────────────────────────────────────
function Ring({ pct, size = 44, stroke = 3.5, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-med)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  );
}

// ── Goal card ────────────────────────────────────────────────────────────────
function GoalCard({ goal, courses, onEdit }) {
  const linked = courses.filter(c => c.goalId === goal.id);
  const pct = linked.length ? Math.round(linked.reduce((s, c) => s + courseProgress(c), 0) / linked.length) : 0;
  const deadline = formatDeadline(goal.targetDate);
  const complete = linked.length > 0 && pct === 100;

  return (
    <div className={`lp-goal-card ${complete ? 'lp-goal-complete' : ''}`} onClick={() => onEdit(goal)}>
      <div className="lp-goal-top">
        <span className="lp-goal-icon">{complete ? '🏆' : '🎯'}</span>
        <span className="lp-goal-title">{goal.title}</span>
      </div>
      {goal.motivation && <p className="lp-goal-why">{goal.motivation}</p>}
      <div className="lp-goal-bar-row">
        <div className="lp-goal-bar"><div className="lp-goal-bar-fill" style={{ width: `${pct}%` }} /></div>
        <span className="lp-goal-pct tile-mono">{pct}%</span>
      </div>
      <div className="lp-goal-meta">
        <span>{linked.length} course{linked.length !== 1 ? 's' : ''}</span>
        {deadline && <span className={`lp-deadline lp-deadline-${deadline.tone}`}>{deadline.text}</span>}
      </div>
    </div>
  );
}

// ── Lesson row ───────────────────────────────────────────────────────────────
function LessonRow({ lesson, onToggle, onDelete }) {
  const isLink = /^https?:\/\//.test(lesson.notes || '');
  return (
    <div className={`lp-lesson ${lesson.done ? 'lp-lesson-done' : ''}`}>
      <div className="lp-lesson-main" onClick={onToggle}>
        <div className={`lp-checkbox ${lesson.done ? 'checked' : ''}`}>
          {lesson.done && <IconCheck />}
        </div>
        <span className="lp-lesson-text">{lesson.text}</span>
      </div>
      <div className="lp-lesson-actions">
        {lesson.notes && (
          isLink
            ? <a href={lesson.notes} target="_blank" rel="noopener noreferrer" className="lp-lesson-link" title={lesson.notes} onClick={e => e.stopPropagation()}><IconLink /></a>
            : <span className="lp-lesson-note-dot" title={lesson.notes}><IconLink /></span>
        )}
        <button className="lp-lesson-del" onClick={onDelete} title="Remove lesson"><IconX /></button>
      </div>
    </div>
  );
}

// ── Add lesson inline form ────────────────────────────────────────────────────
function AddLessonRow({ onAdd }) {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), notes: notes.trim() });
    setText(''); setNotes(''); setShowNotes(false);
  };

  return (
    <div className="lp-add-lesson">
      <div className="lp-add-lesson-row">
        <input
          className="form-input sm"
          placeholder="Add a lesson or milestone…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        />
        <button
          className={`lp-lesson-link-btn ${showNotes ? 'active' : ''}`}
          onClick={() => setShowNotes(v => !v)}
          title="Add a link, address, or note"
          type="button"
        >
          <IconLink />
        </button>
        <button className="btn-ghost sm" onClick={submit} disabled={!text.trim()} type="button"><IconPlus /></button>
      </div>
      {showNotes && (
        <input
          className="form-input sm lp-add-lesson-notes"
          placeholder="Optional link, address, or note…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      )}
    </div>
  );
}

// ── Progress editor (simple mode) ─────────────────────────────────────────────
function ProgressEditor({ value, onChange }) {
  const bump = (delta) => onChange(Math.max(0, Math.min(100, value + delta)));
  return (
    <div className="lp-progress-editor">
      <div className="lp-progress-row">
        <input
          type="range" min="0" max="100" step="5" value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="lp-progress-slider"
        />
        <span className="lp-progress-value tile-mono">{value}%</span>
      </div>
      <div className="lp-progress-quick">
        <button className="lp-mark-btn" onClick={() => bump(10)}>+10%</button>
        <button className="lp-mark-btn" onClick={() => bump(-10)}>−10%</button>
        {value < 100 && <button className="lp-mark-btn lp-mark-btn-accent" onClick={() => onChange(100)}>✓ Mark complete</button>}
      </div>
    </div>
  );
}

// ── Course card ──────────────────────────────────────────────────────────────
function CourseCard({ course, goals, onToggleLesson, onAddLesson, onDeleteLesson, onSetProgress, onEdit, onPlan }) {
  const [open, setOpen] = useState(false);
  const meta = COURSE_CATEGORIES[course.categoryId] || COURSE_CATEGORIES.professional;
  const pct = courseProgress(course);
  const complete = pct === 100;
  const deadline = formatDeadline(course.targetDate);
  const goal = course.goalId ? goals.find(g => g.id === course.goalId) : null;

  return (
    <div className={`lp-course-card ${complete ? 'lp-course-complete' : ''}`}>
      <div className="lp-course-header" onClick={() => setOpen(o => !o)}>
        <div className="lp-course-left">
          <span className="lp-course-cat-icon" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</span>
          <div className="lp-course-title-block">
            <div className="lp-course-title-row">
              <span className="lp-course-title">{course.title}</span>
              {complete && <span className="lp-done-badge">✓ Done</span>}
            </div>
            <div className="lp-course-sub-row">
              {course.provider && <span className="lp-course-provider">{course.provider}</span>}
              {course.weeklyHours ? <span className="lp-course-chip"><IconClock /> {course.weeklyHours}h/wk</span> : null}
              {deadline && <span className={`lp-deadline lp-deadline-${deadline.tone}`}><IconTarget /> {deadline.text}</span>}
              {goal && <span className="lp-course-chip lp-course-goal-chip">🎯 {goal.title}</span>}
            </div>
          </div>
        </div>
        <div className="lp-course-right">
          <div className="lp-course-mini-bar">
            <div className="lp-course-mini-fill" style={{ width: `${pct}%`, background: complete ? 'var(--priority-low)' : meta.color }} />
          </div>
          <span className="lp-course-pct tile-mono">{pct}%</span>
          <button className="lp-add-btn" onClick={e => { e.stopPropagation(); onPlan(course); }} title="Schedule a study session">+ Plan</button>
          <button className="icon-btn" onClick={e => { e.stopPropagation(); onEdit(course); }} title="Edit course"><IconEdit /></button>
          <span className={`lp-session-chevron ${open ? 'open' : ''}`}>›</span>
        </div>
      </div>

      {open && (
        <div className="lp-course-body">
          {course.mode === 'checklist' ? (
            <>
              <div className="lp-lessons">
                {course.lessons.map(l => (
                  <LessonRow key={l.id} lesson={l}
                    onToggle={() => onToggleLesson(course.id, l.id)}
                    onDelete={() => onDeleteLesson(course.id, l.id)} />
                ))}
                {course.lessons.length === 0 && (
                  <p className="lp-empty-hint">No lessons yet — add the first one below.</p>
                )}
              </div>
              <AddLessonRow onAdd={data => onAddLesson(course.id, data)} />
            </>
          ) : (
            <ProgressEditor value={course.progress || 0} onChange={v => onSetProgress(course.id, v)} />
          )}
          {course.notes && <p className="lp-course-notes">{course.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ── Plan session modal ───────────────────────────────────────────────────────
function PlanSessionModal({ course, onConfirm, onClose }) {
  const [date, setDate] = useState(getToday());
  const [time, setTime] = useState('19:00');
  const [duration, setDuration] = useState(60);
  if (!course) return null;
  const meta = COURSE_CATEGORIES[course.categoryId] || COURSE_CATEGORIES.professional;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 className="modal-title">Add to Daily Planner</h3>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className="lp-modal-session">
            <span className="lp-cat-badge" style={{ background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>
            <span className="lp-modal-topic">{course.title}</span>
          </div>
          <div className="form-row-2" style={{ marginTop: 14 }}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Start time</label>
              <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Duration</label>
            <select className="form-select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {DURATION_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Creates a study session task in your planner for this course.
          </p>
        </div>
        <div className="modal-footer">
          <div className="modal-footer-left" />
          <div className="modal-footer-right">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => onConfirm(date, time, duration)}>Add to Planner</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Course modal (add / edit) ─────────────────────────────────────────────────
function CourseModal({ course, goals, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    title:       course?.title       || '',
    categoryId:  course?.categoryId  || 'professional',
    provider:    course?.provider    || '',
    mode:        course?.mode        || 'checklist',
    targetDate:  course?.targetDate  || '',
    weeklyHours: course?.weeklyHours || '',
    goalId:      course?.goalId      || '',
    notes:       course?.notes       || '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    onSave({
      title:       form.title.trim(),
      categoryId:  form.categoryId,
      provider:    form.provider.trim(),
      mode:        form.mode,
      targetDate:  form.targetDate || null,
      weeklyHours: form.weeklyHours ? Number(form.weeklyHours) : null,
      goalId:      form.goalId || null,
      notes:       form.notes.trim(),
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">{course ? 'Edit Course' : 'New Course'}</h3>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className={`form-group ${error ? 'has-error' : ''}`}>
            <input className="title-input" placeholder="What are you learning?" autoFocus
              value={form.title} onChange={e => { set('title', e.target.value); setError(''); }} />
            {error && <span className="field-error">{error}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <div className="lp-cat-grid">
              {COURSE_CATEGORY_KEYS.map(key => {
                const meta = COURSE_CATEGORIES[key];
                const selected = form.categoryId === key;
                return (
                  <button key={key} type="button"
                    className={`lp-cat-pick ${selected ? 'selected' : ''}`}
                    style={selected ? { background: meta.bg, color: meta.color, borderColor: meta.color + '80' } : {}}
                    onClick={() => set('categoryId', key)}>
                    <span>{meta.icon}</span> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Provider / where</label>
              <input type="text" className="form-input" placeholder="Coursera, in-person, self-study…"
                value={form.provider} onChange={e => set('provider', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tracking style</label>
              <div className="lp-mode-toggle">
                <button type="button" className={`lp-mode-btn ${form.mode === 'checklist' ? 'active' : ''}`}
                  onClick={() => set('mode', 'checklist')}>☑ Lessons</button>
                <button type="button" className={`lp-mode-btn ${form.mode === 'simple' ? 'active' : ''}`}
                  onClick={() => set('mode', 'simple')}>% Progress</button>
              </div>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Target date</label>
              <input type="date" className="form-input" value={form.targetDate}
                onChange={e => set('targetDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Hours / week</label>
              <input type="number" min="0" step="0.5" className="form-input" placeholder="e.g. 3"
                value={form.weeklyHours} onChange={e => set('weeklyHours', e.target.value)} />
            </div>
          </div>

          {goals.length > 0 && (
            <div className="form-group">
              <label className="form-label">Linked goal (optional)</label>
              <select className="form-select" value={form.goalId} onChange={e => set('goalId', e.target.value)}>
                <option value="">None</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} placeholder="Optional — schedule, teacher contact, syllabus link…"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <div className="modal-footer-left">
            {onDelete && <button className="btn-danger" onClick={onDelete}>Delete course</button>}
          </div>
          <div className="modal-footer-right">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>{course ? 'Save changes' : 'Add course'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Goal modal (add / edit) ───────────────────────────────────────────────────
function GoalModal({ goal, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    title:      goal?.title      || '',
    motivation: goal?.motivation || '',
    targetDate: goal?.targetDate || '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    onSave({ title: form.title.trim(), motivation: form.motivation.trim(), targetDate: form.targetDate || null });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">{goal ? 'Edit Goal' : 'New Goal'}</h3>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className={`form-group ${error ? 'has-error' : ''}`}>
            <input className="title-input" placeholder="What's the big goal?" autoFocus
              value={form.title} onChange={e => { set('title', e.target.value); setError(''); }} />
            {error && <span className="field-error">{error}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Why it matters</label>
            <textarea className="form-textarea" rows={2} placeholder="Optional — your motivation…"
              value={form.motivation} onChange={e => set('motivation', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Target date</label>
            <input type="date" className="form-input" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <div className="modal-footer-left">
            {onDelete && <button className="btn-danger" onClick={onDelete}>Delete goal</button>}
          </div>
          <div className="modal-footer-right">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>{goal ? 'Save changes' : 'Add goal'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LearningPlan (main export) ─────────────────────────────────────────────
export default function LearningPlan({
  courses, goals, streak,
  onAddCourse, onUpdateCourse, onDeleteCourse,
  onAddGoal, onUpdateGoal, onDeleteGoal,
  onToggleLesson, onAddLesson, onDeleteLesson, onSetProgress,
  onAddToPlanner,
}) {
  const [filterCategory, setFilterCategory] = useState('all');
  const [editingCourse,  setEditingCourse]  = useState(undefined); // undefined=closed, null=new, obj=edit
  const [editingGoal,    setEditingGoal]    = useState(undefined);
  const [planningCourse, setPlanningCourse] = useState(null);

  const stats = useLearningStats(courses, goals);

  const filteredCourses = useMemo(() =>
    filterCategory === 'all' ? courses : courses.filter(c => c.categoryId === filterCategory),
    [courses, filterCategory]
  );

  // Confetti on course / goal completion
  const prevCourseRef = useRef({});
  const prevGoalRef    = useRef({});
  useEffect(() => {
    courses.forEach(c => {
      const pct = courseProgress(c);
      const prev = prevCourseRef.current[c.id];
      if (prev !== undefined && prev < 100 && pct === 100) triggerConfetti();
      prevCourseRef.current[c.id] = pct;
    });
    goals.forEach(g => {
      const linked = courses.filter(c => c.goalId === g.id);
      if (!linked.length) return;
      const allDone = linked.every(c => courseProgress(c) === 100);
      const prev = prevGoalRef.current[g.id];
      if (prev === false && allDone) triggerConfetti();
      prevGoalRef.current[g.id] = allDone;
    });
  }, [courses, goals]);

  const handleSaveCourse = (data) => {
    if (editingCourse?.id) onUpdateCourse(editingCourse.id, data);
    else onAddCourse(data);
    setEditingCourse(undefined);
  };
  const handleDeleteCourse = () => {
    if (editingCourse?.id) onDeleteCourse(editingCourse.id);
    setEditingCourse(undefined);
  };
  const handleSaveGoal = (data) => {
    if (editingGoal?.id) onUpdateGoal(editingGoal.id, data);
    else onAddGoal(data);
    setEditingGoal(undefined);
  };
  const handleDeleteGoal = () => {
    if (editingGoal?.id) onDeleteGoal(editingGoal.id);
    setEditingGoal(undefined);
  };
  const handleConfirmPlan = (date, startTime, duration) => {
    if (!planningCourse) return;
    onAddToPlanner({ course: planningCourse, date, startTime, duration });
    setPlanningCourse(null);
  };

  return (
    <div className="lp-view">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="lp-header">
        <div className="lp-header-top">
          <div>
            <div className="lp-header-eyebrow">LEARNING PATH // YOUR COURSES · GOALS · PROGRESS</div>
            <h2 className="lp-header-title">Keep growing, one lesson at a time</h2>
            <p className="lp-header-desc">
              Track a certification, a trade skill, a new language, or anything you're picking up —
              build your own path and watch it add up.
            </p>
          </div>
          <div className="lp-header-side">
            {streak.count > 0 && (
              <div className="lp-streak-chip" title="Learning streak">
                <span className="streak-flame">🔥</span>
                <span className="tile-mono">{streak.count}</span>
              </div>
            )}
            <div className="lp-header-ring">
              <Ring pct={stats.overallPct} size={68} stroke={5} color={stats.overallPct === 100 && stats.total > 0 ? 'var(--priority-low)' : 'var(--accent)'} />
              <div className="lp-ring-center">
                <span className="lp-ring-pct tile-mono">{stats.overallPct}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-summary-row">
          <div className="lp-sum-chip">
            <span className="lp-sum-val tile-mono">{stats.total}</span>
            <span className="lp-sum-lbl">courses</span>
          </div>
          <div className="lp-sum-chip">
            <span className="lp-sum-val tile-mono">{stats.completed}</span>
            <span className="lp-sum-lbl">completed</span>
          </div>
          <div className="lp-sum-chip">
            <span className="lp-sum-val tile-mono">{stats.activeGoals}</span>
            <span className="lp-sum-lbl">goals</span>
          </div>
          {stats.totalHoursPerWeek > 0 && (
            <div className="lp-sum-chip">
              <span className="lp-sum-val tile-mono">{stats.totalHoursPerWeek}h</span>
              <span className="lp-sum-lbl">planned / week</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Goals ──────────────────────────────────────────── */}
      <div className="lp-goals-section">
        <div className="lp-section-head">
          <span className="lp-section-title">🎯 Goals</span>
          <button className="lp-add-btn" onClick={() => setEditingGoal(null)}><IconPlus /> New goal</button>
        </div>
        {goals.length > 0 ? (
          <div className="lp-goals-row">
            {goals.map(g => <GoalCard key={g.id} goal={g} courses={courses} onEdit={setEditingGoal} />)}
          </div>
        ) : (
          <p className="lp-empty-hint">
            Goals link courses together toward something bigger — e.g. "Get promoted" or "Become certified".
          </p>
        )}
      </div>

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="lp-toolbar">
        <div className="lp-filter-group">
          <button className={`lp-filter-btn ${filterCategory === 'all' ? 'active' : ''}`} onClick={() => setFilterCategory('all')}>
            📚 All courses
          </button>
          {COURSE_CATEGORY_KEYS.filter(k => courses.some(c => c.categoryId === k)).map(k => {
            const meta = COURSE_CATEGORIES[k];
            const active = filterCategory === k;
            return (
              <button key={k} className={`lp-filter-btn ${active ? 'active' : ''}`}
                style={active ? { background: meta.bg, color: meta.color, borderColor: meta.color + '60' } : {}}
                onClick={() => setFilterCategory(k)}>
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
        <button className="btn-primary sm" onClick={() => setEditingCourse(null)}><IconPlus /> New course</button>
      </div>

      {/* ── Courses ────────────────────────────────────────── */}
      <div className="lp-courses">
        {courses.length === 0 && (
          <div className="lp-empty-state">
            <div className="lp-empty-icon">📘</div>
            <h3>Start your learning path</h3>
            <p>
              Whether it's a professional certification, a new language, a trade skill, or something
              you've always wanted to learn — add your first course and start tracking real progress.
            </p>
            <button className="btn-primary" onClick={() => setEditingCourse(null)}><IconPlus /> Add your first course</button>
          </div>
        )}
        {courses.length > 0 && filteredCourses.length === 0 && (
          <p className="lp-empty-hint">No courses in this category yet.</p>
        )}
        {filteredCourses.map(c => (
          <CourseCard key={c.id} course={c} goals={goals}
            onToggleLesson={onToggleLesson}
            onAddLesson={onAddLesson}
            onDeleteLesson={onDeleteLesson}
            onSetProgress={onSetProgress}
            onEdit={setEditingCourse}
            onPlan={setPlanningCourse}
          />
        ))}
      </div>

      {editingCourse !== undefined && (
        <CourseModal course={editingCourse} goals={goals}
          onSave={handleSaveCourse} onDelete={editingCourse?.id ? handleDeleteCourse : null}
          onClose={() => setEditingCourse(undefined)} />
      )}
      {editingGoal !== undefined && (
        <GoalModal goal={editingGoal}
          onSave={handleSaveGoal} onDelete={editingGoal?.id ? handleDeleteGoal : null}
          onClose={() => setEditingGoal(undefined)} />
      )}
      {planningCourse && (
        <PlanSessionModal course={planningCourse} onConfirm={handleConfirmPlan} onClose={() => setPlanningCourse(null)} />
      )}
    </div>
  );
}
