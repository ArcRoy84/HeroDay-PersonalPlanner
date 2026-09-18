/**
 * Learning plan: courses, goals and the practice streak.
 *
 * Lessons stay nested inside their course rather than getting a table of their
 * own. They are only ever read and written as part of the course that owns
 * them, so a separate table would add joins without buying anything.
 */
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import { coursesRepo, goalsRepo } from '../db/repos';
import { newId, now } from '../db/ids';
import { useSetting } from './useSetting';
import type { LearningCourse, LearningGoal, Lesson, Streak } from '../db/types';

const EMPTY_COURSES: LearningCourse[] = [];
const EMPTY_GOALS: LearningGoal[] = [];
const NO_STREAK: Streak = { count: 0, lastDate: null };

/** Yesterday's date, used to decide whether a streak continues or resets. */
function yesterdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]!;
}

export function useLearning(today: string) {
  const courseRows = useLiveQuery(() => db.learningCourses.toArray(), []);
  const goalRows = useLiveQuery(() => db.learningGoals.toArray(), []);
  const [streak, setStreak] = useSetting('learningStreak', NO_STREAK);

  const courses = useMemo(
    () => (courseRows ? courseRows.filter(isLive) : EMPTY_COURSES),
    [courseRows],
  );
  const goals = useMemo(
    () => (goalRows ? goalRows.filter(isLive) : EMPTY_GOALS),
    [goalRows],
  );

  /** Advances the streak at most once per day. */
  const bumpStreak = useCallback(() => {
    setStreak(previous => {
      if (previous.lastDate === today) return previous;
      const count = previous.lastDate === yesterdayOf(today) ? previous.count + 1 : 1;
      return { count, lastDate: today };
    });
  }, [setStreak, today]);

  /* ── Courses ──────────────────────────────────────────────────────────── */

  const addCourse = useCallback((data: Partial<LearningCourse>) => {
    void coursesRepo.put({
      id: newId(),
      title: data.title ?? '',
      categoryId: data.categoryId ?? 'professional',
      provider: data.provider ?? '',
      mode: data.mode ?? 'checklist',
      progress: 0,
      lessons: [],
      targetDate: data.targetDate ?? null,
      weeklyHours: data.weeklyHours ?? null,
      goalId: data.goalId ?? null,
      notes: data.notes ?? '',
      createdAt: now(),
    });
  }, []);

  const updateCourse = useCallback((id: string, updates: Partial<LearningCourse>) => {
    void coursesRepo.patch(id, updates);
  }, []);

  const deleteCourse = useCallback((id: string) => {
    void coursesRepo.remove(id);
  }, []);

  /** Applies a change to one course's lesson array. */
  const editLessons = useCallback(async (
    courseId: string,
    edit: (lessons: Lesson[]) => Lesson[],
  ): Promise<void> => {
    const course = await coursesRepo.get(courseId);
    if (!course) return;
    await coursesRepo.patch(courseId, { lessons: edit(course.lessons) });
  }, []);

  const toggleLesson = useCallback((courseId: string, lessonId: string) => {
    void (async () => {
      const course = await coursesRepo.get(courseId);
      if (!course) return;
      const lesson = course.lessons.find(l => l.id === lessonId);
      if (!lesson) return;

      const justCompleted = !lesson.done;
      await coursesRepo.patch(courseId, {
        lessons: course.lessons.map(l => l.id === lessonId
          ? { ...l, done: !l.done, completedAt: !l.done ? now() : null }
          : l),
      });
      // Finishing a lesson counts as practice; un-ticking one does not.
      if (justCompleted) bumpStreak();
    })();
  }, [bumpStreak]);

  const addLesson = useCallback((courseId: string, input: { text: string; notes?: string }) => {
    void editLessons(courseId, lessons => [...lessons, {
      id: newId(),
      text: input.text,
      notes: input.notes ?? '',
      done: false,
      completedAt: null,
    }]);
  }, [editLessons]);

  const deleteLesson = useCallback((courseId: string, lessonId: string) => {
    void editLessons(courseId, lessons => lessons.filter(l => l.id !== lessonId));
  }, [editLessons]);

  const setCourseProgress = useCallback((courseId: string, pct: number) => {
    void (async () => {
      const course = await coursesRepo.get(courseId);
      if (!course) return;
      const improved = pct > (course.progress || 0);
      await coursesRepo.patch(courseId, { progress: pct });
      if (improved) bumpStreak();
    })();
  }, [bumpStreak]);

  /* ── Goals ────────────────────────────────────────────────────────────── */

  const addGoal = useCallback((data: Partial<LearningGoal>) => {
    void goalsRepo.put({
      id: newId(),
      title: data.title ?? '',
      motivation: data.motivation ?? '',
      targetDate: data.targetDate ?? null,
      createdAt: now(),
    });
  }, []);

  const updateGoal = useCallback((id: string, updates: Partial<LearningGoal>) => {
    void goalsRepo.patch(id, updates);
  }, []);

  /** Deleting a goal detaches its courses rather than deleting them too. */
  const deleteGoal = useCallback((id: string) => {
    void db.transaction('rw', db.learningGoals, db.learningCourses, async () => {
      await goalsRepo.remove(id);
      const attached = await db.learningCourses.where('goalId').equals(id).toArray();
      await Promise.all(attached.map(c => coursesRepo.patch(c.id, { goalId: null })));
    });
  }, []);

  return {
    courses, goals, streak,
    loading: courseRows === undefined || goalRows === undefined,
    addCourse, updateCourse, deleteCourse,
    toggleLesson, addLesson, deleteLesson, setCourseProgress,
    addGoal, updateGoal, deleteGoal,
  };
}
