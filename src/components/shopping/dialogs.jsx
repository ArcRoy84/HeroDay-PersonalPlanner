// Small confirm/prompt dialogs shared across the shopping views.
import React, { useState } from 'react';
import { getToday, navigateDate } from '../../utils/helpers.js';
import { IconX } from './icons.jsx';
import { formatDayLabel } from './parsing.js';

function DeleteConfirmModal({ item, onConfirm, onClose }) {
  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Remove Item?</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>
        <p className="shop-dialog-body-text">
          Are you sure you want to remove <strong>"{item.name}"</strong> from your list?
        </p>
        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ── ConfirmModal (generic) ─────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onClose }) {
  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{title}</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>
        <p className="shop-dialog-body-text">{message}</p>
        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── AddToPlannerModal ─────────────────────────────────────────────────────────
function AddToPlannerModal({ listName, onAdd, onClose }) {
  const today = getToday();
  const days  = Array.from({ length: 7 }, (_, i) => ({
    date:  navigateDate(today, i),
    label: formatDayLabel(navigateDate(today, i), i),
  }));

  const [selDate, setSelDate] = useState(today);
  const [selTime, setSelTime] = useState('10:00');
  const [done,    setDone]    = useState(false);

  function submit(date, time) {
    onAdd({ date, time });
    setDone(true);
    setTimeout(onClose, 1400);
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        {done ? (
          <div className="shop-planner-success">
            <span className="shop-planner-success-icon">✅</span>
            <p>Task added to your planner!</p>
          </div>
        ) : (
          <>
            <div className="shop-dialog-header">
              <h4 className="shop-dialog-title">Add to Planner</h4>
              <button className="sic-act" onClick={onClose}><IconX /></button>
            </div>
            <p className="shop-dialog-subtitle">
              Creates <strong>"Go shopping · {listName}"</strong> as a task
            </p>

            {/* Day selector */}
            <div className="shop-planner-days">
              {days.map(d => (
                <button
                  key={d.date}
                  className={`shop-planner-day ${selDate === d.date ? 'shop-planner-day--active' : ''}`}
                  onClick={() => setSelDate(d.date)}>
                  {d.label}
                </button>
              ))}
            </div>

            {/* Time */}
            <div className="shop-field">
              <label className="shop-field-label">Time</label>
              <input className="form-input" type="time" value={selTime}
                onChange={e => setSelTime(e.target.value)} />
            </div>

            <div className="shop-dialog-actions">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-ghost" onClick={() => submit(today, '')}>Add Now</button>
              <button className="btn-primary" onClick={() => submit(selDate, selTime)}>Schedule</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── ManageCategoriesModal ─────────────────────────────────────────────────────

function NewListDialog({ onCreate, onClose }) {
  const [name, setName] = useState('');

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">New Shopping List</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>
        <div className="shop-dialog-body">
          <div className="shop-field">
            <label className="shop-field-label">Store or list name</label>
            <input className="form-input" placeholder="e.g. Whole Foods, Costco, Trader Joe's…"
              value={name} onChange={e => setName(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }} />
          </div>
        </div>
        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={handleCreate}>Create</button>
        </div>
      </div>
    </div>
  );
}

// ── RecipeCard ─────────────────────────────────────────────────────────────────

export { DeleteConfirmModal, ConfirmModal, AddToPlannerModal, NewListDialog };
