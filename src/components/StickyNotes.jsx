import React, { useState } from 'react';
import { formatDate } from '../utils/helpers.js';
import { useNotes } from '../hooks/useNotes';

const COLORS = [
  { id: 'yellow', bg: '#fef08a', border: '#fde047', text: '#713f12' },
  { id: 'pink',   bg: '#fbcfe8', border: '#f9a8d4', text: '#831843' },
  { id: 'green',  bg: '#bbf7d0', border: '#86efac', text: '#14532d' },
  { id: 'blue',   bg: '#bae6fd', border: '#7dd3fc', text: '#0c4a6e' },
  { id: 'purple', bg: '#e9d5ff', border: '#d8b4fe', text: '#581c87' },
];

function Note({ note, onUpdate, onDelete }) {
  const [text, setText] = useState(note.text);
  const color = COLORS.find(c => c.id === note.color) || COLORS[0];

  const handleBlur = () => {
    if (text !== note.text) onUpdate(note.id, { text });
  };

  return (
    <div
      className="sticky-note"
      style={{ background: color.bg, borderColor: color.border, color: color.text }}
    >
      <div className="sticky-note-bar">
        <div className="sticky-color-dots">
          {COLORS.map(c => (
            <button
              key={c.id}
              className={`sticky-color-dot ${note.color === c.id ? 'active' : ''}`}
              style={{ background: c.bg, borderColor: c.border }}
              onClick={() => onUpdate(note.id, { color: c.id })}
            />
          ))}
        </div>
        <button className="sticky-del-btn" onClick={() => onDelete(note.id)} title="Delete note">×</button>
      </div>
      <textarea
        className="sticky-textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="Write a note…"
        style={{ color: color.text }}
      />
    </div>
  );
}

export default function StickyNotes({ date }) {
  // Notes live in the `notes` table indexed by date, so every view showing
  // this day stays in sync without prop drilling.
  const { notes, addNote, updateNote, deleteNote } = useNotes(date);

  return (
    <div className="sticky-panel">
      <div className="sticky-header">
        <span className="sticky-title">📝 Notes — {formatDate(date)}</span>
        <button className="sticky-add-btn" onClick={addNote} title="Add note">+</button>
      </div>
      <div className="sticky-notes-list">
        {notes.map(note => (
          <Note
            key={note.id}
            note={note}
            onUpdate={updateNote}
            onDelete={deleteNote}
          />
        ))}
        {notes.length === 0 && (
          <div className="sticky-empty" onClick={addNote}>
            <span>Click + to add a note</span>
          </div>
        )}
      </div>
    </div>
  );
}
