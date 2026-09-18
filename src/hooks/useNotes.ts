/**
 * Sticky notes for one day.
 *
 * Replaces the old `mtp_notes_${date}` localStorage keys, which created one key
 * per day with no way to query across them — "show me every note" meant
 * scanning the whole of localStorage. Here `date` is an index.
 */
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import { notesRepo, addNote as addNoteRow } from '../db/repos';
import type { Note, DateOnly } from '../db/types';

const EMPTY: Note[] = [];

export interface UseNotesResult {
  notes: Note[];
  addNote: () => void;
  updateNote: (id: string, changes: Partial<Note>) => void;
  deleteNote: (id: string) => void;
}

export function useNotes(date: DateOnly): UseNotesResult {
  const rows = useLiveQuery(
    () => db.notes.where('date').equals(date).toArray(),
    [date],
  );
  const notes = rows ? rows.filter(isLive) : EMPTY;

  const addNote = useCallback(() => {
    void addNoteRow(date);
  }, [date]);

  const updateNote = useCallback((id: string, changes: Partial<Note>) => {
    void notesRepo.patch(id, changes);
  }, []);

  const deleteNote = useCallback((id: string) => {
    void notesRepo.remove(id);
  }, []);

  return { notes, addNote, updateNote, deleteNote };
}
