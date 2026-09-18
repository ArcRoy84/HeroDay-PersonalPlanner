/**
 * Live task collection plus the CRUD surface App.jsx already expects.
 *
 * The API deliberately mirrors the previous callbacks (`addTask(data)`,
 * `updateTask(id, updates)`, `deleteTask(id)`, `toggleTask(id)`) so child
 * components keep their existing props.
 */
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import {
  tasksRepo, categoriesRepo,
  addTask as addTaskRow, toggleTask as toggleTaskRow, tallyByDate,
} from '../db/repos';
import type { Task, Category, DateOnly, WeeklyData } from '../db/types';

const EMPTY_TASKS: Task[] = [];
const EMPTY_CATEGORIES: Category[] = [];

export interface UseTasksResult {
  tasks: Task[];
  /** Per-day totals, derived from `tasks` rather than stored separately. */
  weeklyData: WeeklyData;
  /** True until the first query resolves — used to gate the initial render. */
  loading: boolean;
  addTask: (data: Partial<Task>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
}

export function useTasks(currentDate: DateOnly): UseTasksResult {
  const rows = useLiveQuery(() => db.tasks.toArray(), []);
  const tasks = useMemo(() => (rows ? rows.filter(isLive) : EMPTY_TASKS), [rows]);
  const weeklyData = useMemo(() => tallyByDate(tasks), [tasks]);

  const addTask = useCallback((data: Partial<Task>) => {
    void addTaskRow(data);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    void tasksRepo.patch(id, updates);
  }, []);

  const deleteTask = useCallback((id: string) => {
    void tasksRepo.remove(id);
  }, []);

  // `currentDate` decides which day a recurring task's completion toggles.
  const toggleTask = useCallback((id: string) => {
    void toggleTaskRow(id, currentDate);
  }, [currentDate]);

  return {
    tasks,
    weeklyData,
    loading: rows === undefined,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
  };
}

export interface UseCategoriesResult {
  categories: Category[];
  addCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
}

export function useCategories(): UseCategoriesResult {
  const rows = useLiveQuery(() => db.categories.toArray(), []);
  const categories = useMemo(
    () => (rows ? rows.filter(isLive) : EMPTY_CATEGORIES),
    [rows],
  );

  const addCategory = useCallback((category: Category) => {
    void categoriesRepo.put(category);
  }, []);

  const deleteCategory = useCallback((id: string) => {
    void categoriesRepo.remove(id);
  }, []);

  return { categories, addCategory, deleteCategory };
}
