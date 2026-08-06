import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import ChecklistView from './components/ChecklistView.jsx';
import TimelineView from './components/TimelineView.jsx';
import TaskModal from './components/TaskModal.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import LearningPlan from './components/LearningPlan.jsx';
import ShoppingList from './components/ShoppingList.jsx';
import FAB from './components/FAB.jsx';
import {
  generateId, getToday, DEFAULT_CATEGORIES,
  navigateDate, getDayName
} from './utils/helpers.js';

// ─── localStorage helpers ────────────────────────────────────────────────────
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const save = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

// ─── Initial seed data for first-time users ──────────────────────────────────
const seedTasks = () => {
  const today = getToday();
  return [
    {
      id: generateId(), title: 'Morning review', priority: 'high',
      categoryId: 'work', date: today, startTime: '09:00', duration: 30,
      tags: ['focus'], reminder: true, completed: false,
      description: 'Review emails and plan the day', createdAt: new Date().toISOString(),
    },
    {
      id: generateId(), title: 'Team standup', priority: 'medium',
      categoryId: 'work', date: today, startTime: '10:00', duration: 15,
      tags: ['meeting'], reminder: false, completed: false,
      description: '', createdAt: new Date().toISOString(),
    },
    {
      id: generateId(), title: 'Lunch walk', priority: 'low',
      categoryId: 'health', date: today, startTime: '13:00', duration: 30,
      tags: [], reminder: false, completed: false,
      description: '', createdAt: new Date().toISOString(),
    },
    {
      id: generateId(), title: 'Read 30 pages', priority: 'medium',
      categoryId: 'learning', date: today, startTime: '21:00', duration: 45,
      tags: ['books'], reminder: true, completed: false,
      description: '', createdAt: new Date().toISOString(),
    },
  ];
};

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [tasks,        setTasks]        = useState(() => load('mtp_tasks', null) ?? seedTasks());
  const [categories,   setCategories]   = useState(() => load('mtp_categories', DEFAULT_CATEGORIES));
  const [theme,        setTheme]        = useState(() => load('mtp_theme', 'dark'));
  const [view,         setView]         = useState(() => load('mtp_view', 'checklist'));
  const [currentDate,  setCurrentDate]  = useState(getToday());
  const [streak,          setStreak]          = useState(() => load('mtp_streak', { count: 0, lastDate: null }));
  const [weeklyData,      setWeeklyData]      = useState(() => load('mtp_weekly', {}));
  const [learningCourses, setLearningCourses] = useState(() => load('mtp_learning_courses', []));
  const [learningGoals,   setLearningGoals]   = useState(() => load('mtp_learning_goals', []));
  const [learningStreak,  setLearningStreak]  = useState(() => load('mtp_learning_streak', { count: 0, lastDate: null }));
  const [weatherLocation, setWeatherLocation] = useState(() => load('mtp_weather_loc', null));
  const [weatherUnit,     setWeatherUnit]     = useState(() => load('mtp_weather_unit', 'fahrenheit'));

  // Shopping module state
  const [shoppingLists,   setShoppingLists]   = useState(() => load('mtp_shop_lists', [{ id: 'default', name: 'Grocery', items: [], budget: null, createdAt: new Date().toISOString() }]));
  const [shoppingHistory, setShoppingHistory] = useState(() => load('mtp_shop_history', []));
  const [shoppingRecipes, setShoppingRecipes] = useState(() => load('mtp_shop_recipes', []));

  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Task modal state
  const [isModalOpen,      setIsModalOpen]      = useState(false);
  const [editingTask,      setEditingTask]      = useState(null);
  const [defaultModalTime, setDefaultModalTime] = useState('');

  // Notification tracking ref (avoid repeating alerts)
  const notifiedRef = useRef(new Set());

  // ── Persist to localStorage ────────────────────────────────────────────────
  useEffect(() => save('mtp_tasks',         tasks),              [tasks]);
  useEffect(() => save('mtp_categories',    categories),         [categories]);
  useEffect(() => save('mtp_theme',         theme),              [theme]);
  useEffect(() => save('mtp_view',          view),               [view]);
  useEffect(() => save('mtp_streak',        streak),             [streak]);
  useEffect(() => save('mtp_weekly',        weeklyData),         [weeklyData]);
  useEffect(() => save('mtp_learning_courses', learningCourses), [learningCourses]);
  useEffect(() => save('mtp_learning_goals',   learningGoals),   [learningGoals]);
  useEffect(() => save('mtp_learning_streak',  learningStreak),  [learningStreak]);
  useEffect(() => save('mtp_weather_loc',  weatherLocation),     [weatherLocation]);
  useEffect(() => save('mtp_weather_unit', weatherUnit),         [weatherUnit]);
  useEffect(() => save('mtp_shop_lists',   shoppingLists),       [shoppingLists]);
  useEffect(() => save('mtp_shop_history', shoppingHistory),     [shoppingHistory]);
  useEffect(() => save('mtp_shop_recipes', shoppingRecipes),     [shoppingRecipes]);

  // ── Theme ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Streak ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const today = getToday();
    if (streak.lastDate === today) return;
    const todayDone = tasks.filter(t => t.date === today && t.completed).length > 0;
    if (!todayDone) return;

    const prev = new Date(today + 'T00:00:00');
    prev.setDate(prev.getDate() - 1);
    const yesterday = prev.toISOString().split('T')[0];

    const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
    setStreak({ count: newCount, lastDate: today });
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Web Notifications ──────────────────────────────────────────────────────
  useEffect(() => {
    if (Notification.permission !== 'granted') return;
    const interval = setInterval(() => {
      const now    = new Date();
      const today  = now.toISOString().split('T')[0];
      const nowMin = now.getHours() * 60 + now.getMinutes();

      tasks.forEach(task => {
        if (task.date !== today || !task.startTime || task.completed) return;
        // Resolve offsets — support new array format and old boolean
        const offsets = Array.isArray(task.reminderOffsets) && task.reminderOffsets.length
          ? task.reminderOffsets
          : task.reminder ? [5] : [];
        if (!offsets.length) return;

        const startMin = parseInt(task.startTime.split(':')[0]) * 60 + parseInt(task.startTime.split(':')[1]);
        const diff = startMin - nowMin;

        // Fire each configured offset
        offsets.forEach(offset => {
          if (diff === offset) {
            const key = `${task.id}-${startMin}-${offset}`;
            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);
              new Notification('Task Reminder', {
                body: `"${task.title}" starts in ${offset < 60 ? `${offset} min` : '1 hour'}`,
                icon: '/favicon.svg',
              });
            }
          }
        });

        // Always fire "starting now" when any reminders are set
        if (diff === 0) {
          const key = `${task.id}-${startMin}-now`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            new Notification('Task Reminder', {
              body: `"${task.title}" is starting now`,
              icon: '/favicon.svg',
            });
          }
        }
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, [tasks]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (isModalOpen) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openModal(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); openModal(); }
      if (e.key === '1') setView('checklist');
      if (e.key === '2') setView('timeline');
      if (e.key === '3') setView('stats');
      if (e.key === '4') setView('learn');
      if (e.key === '5') setView('shop');
      if (e.key === 'ArrowLeft')  setCurrentDate(d => navigateDate(d, -1));
      if (e.key === 'ArrowRight') setCurrentDate(d => navigateDate(d, +1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Weekly data sync ───────────────────────────────────────────────────────
  const syncWeeklyData = useCallback((updatedTasks) => {
    const newWeekly = {};
    updatedTasks.forEach(t => {
      if (!t.date) return;
      if (!newWeekly[t.date]) newWeekly[t.date] = { total: 0, completed: 0 };
      newWeekly[t.date].total++;
      if (t.completed) newWeekly[t.date].completed++;
    });
    setWeeklyData(newWeekly);
  }, []);

  // ── Task CRUD ──────────────────────────────────────────────────────────────
  const addTask = useCallback((data) => {
    const task = { id: generateId(), ...data, completed: false, createdAt: new Date().toISOString() };
    setTasks(prev => {
      const next = [...prev, task];
      syncWeeklyData(next);
      return next;
    });
  }, [syncWeeklyData]);

  const updateTask = useCallback((id, updates) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      syncWeeklyData(next);
      return next;
    });
  }, [syncWeeklyData]);

  const deleteTask = useCallback((id) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      syncWeeklyData(next);
      return next;
    });
  }, [syncWeeklyData]);

  const toggleTask = useCallback((id) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;

      // Recurring tasks: toggle per-day completion via completedDates map
      if (task.recurrence?.days?.length) {
        const completedDates = { ...(task.completedDates || {}) };
        if (completedDates[currentDate]) delete completedDates[currentDate];
        else completedDates[currentDate] = true;
        return prev.map(t => t.id === id ? { ...t, completedDates } : t);
      }

      // Regular tasks: toggle completed
      const next = prev.map(t =>
        t.id === id
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null }
          : t
      );
      syncWeeklyData(next);
      return next;
    });
  }, [currentDate, syncWeeklyData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Learning plan: streak ────────────────────────────────────────────────────
  const bumpLearningStreak = useCallback(() => {
    setLearningStreak(prev => {
      const today = getToday();
      if (prev.lastDate === today) return prev;
      const yest = new Date(today + 'T00:00:00');
      yest.setDate(yest.getDate() - 1);
      const yesterday = yest.toISOString().split('T')[0];
      const newCount = prev.lastDate === yesterday ? prev.count + 1 : 1;
      return { count: newCount, lastDate: today };
    });
  }, []);

  // ── Learning plan: courses ───────────────────────────────────────────────────
  const addCourse = useCallback((data) => {
    setLearningCourses(prev => [...prev, {
      id: generateId(),
      title: data.title,
      categoryId: data.categoryId,
      provider: data.provider || '',
      mode: data.mode,
      progress: 0,
      lessons: [],
      targetDate: data.targetDate || null,
      weeklyHours: data.weeklyHours || null,
      goalId: data.goalId || null,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    }]);
  }, []);

  const updateCourse = useCallback((id, updates) => {
    setLearningCourses(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCourse = useCallback((id) => {
    setLearningCourses(prev => prev.filter(c => c.id !== id));
  }, []);

  const toggleLesson = useCallback((courseId, lessonId) => {
    let justCompleted = false;
    setLearningCourses(prev => prev.map(c => {
      if (c.id !== courseId) return c;
      return {
        ...c,
        lessons: c.lessons.map(l => {
          if (l.id !== lessonId) return l;
          justCompleted = !l.done;
          return { ...l, done: !l.done, completedAt: !l.done ? new Date().toISOString() : null };
        }),
      };
    }));
    if (justCompleted) bumpLearningStreak();
  }, [bumpLearningStreak]);

  const addLesson = useCallback((courseId, { text, notes }) => {
    setLearningCourses(prev => prev.map(c => c.id === courseId
      ? { ...c, lessons: [...c.lessons, { id: generateId(), text, notes: notes || '', done: false, completedAt: null }] }
      : c));
  }, []);

  const deleteLesson = useCallback((courseId, lessonId) => {
    setLearningCourses(prev => prev.map(c => c.id === courseId
      ? { ...c, lessons: c.lessons.filter(l => l.id !== lessonId) }
      : c));
  }, []);

  const setCourseProgress = useCallback((courseId, pct) => {
    let improved = false;
    setLearningCourses(prev => prev.map(c => {
      if (c.id !== courseId) return c;
      if (pct > (c.progress || 0)) improved = true;
      return { ...c, progress: pct };
    }));
    if (improved) bumpLearningStreak();
  }, [bumpLearningStreak]);

  const addCourseSessionToPlanner = useCallback(({ course, date, startTime, duration }) => {
    addTask({
      title: `Study: ${course.title}`,
      priority: 'medium',
      categoryId: 'learning',
      date,
      startTime,
      duration: duration || 60,
      tags: [course.categoryId],
      reminder: false,
      description: course.provider ? `Course by ${course.provider}` : '',
    });
  }, [addTask]);

  // ── Learning plan: goals ─────────────────────────────────────────────────────
  const addGoal = useCallback((data) => {
    setLearningGoals(prev => [...prev, {
      id: generateId(),
      title: data.title,
      motivation: data.motivation || '',
      targetDate: data.targetDate || null,
      createdAt: new Date().toISOString(),
    }]);
  }, []);

  const updateGoal = useCallback((id, updates) => {
    setLearningGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const deleteGoal = useCallback((id) => {
    setLearningGoals(prev => prev.filter(g => g.id !== id));
    setLearningCourses(prev => prev.map(c => c.goalId === id ? { ...c, goalId: null } : c));
  }, []);

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const addCategory = useCallback((data) => {
    setCategories(prev => [...prev, { id: generateId(), ...data }]);
  }, []);

  const deleteCategory = useCallback((id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openModal = useCallback((task = null, time = '') => {
    setEditingTask(task);
    setDefaultModalTime(time);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTask(null);
    setDefaultModalTime('');
  }, []);

  const handleSaveTask = useCallback((data) => {
    if (editingTask) updateTask(editingTask.id, data);
    else             addTask(data);
    closeModal();
  }, [editingTask, addTask, updateTask, closeModal]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const dayOfWeek  = new Date(currentDate + 'T00:00:00').getDay();
  const todayTasks = tasks.filter(t => {
    if (t.recurrence?.days?.length) return t.recurrence.days.includes(dayOfWeek);
    if (t.endDate)                  return t.date <= currentDate && t.endDate >= currentDate;
    return t.date === currentDate;
  });
  const showDashboard = view !== 'stats' && view !== 'learn' && view !== 'shop';

  return (
    <div className="app">
      <Header
        view={view} setView={setView}
        currentDate={currentDate} setCurrentDate={setCurrentDate}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="app-body">
        {showDashboard && (
          <Dashboard
            tasks={todayTasks}
            allTasks={tasks}
            categories={categories}
            streak={streak.count}
            currentDate={currentDate}
            weatherLocation={weatherLocation}
            weatherUnit={weatherUnit}
          />
        )}

        <main className="main-content">
          {view === 'checklist' && (
            <ChecklistView
              tasks={todayTasks}
              categories={categories}
              currentDate={currentDate}
              onToggle={toggleTask}
              onEdit={(t) => openModal(t)}
              onDelete={deleteTask}
              onAdd={() => openModal()}
            />
          )}

          {view === 'timeline' && (
            <TimelineView
              tasks={todayTasks}
              categories={categories}
              currentDate={currentDate}
              allTasks={tasks}
              onToggle={toggleTask}
              onEdit={(t) => openModal(t)}
              onDelete={deleteTask}
              onUpdate={updateTask}
              onAddAtTime={(time) => openModal(null, time)}
              setCurrentDate={setCurrentDate}
            />
          )}

          {view === 'stats' && (
            <StatsPanel
              tasks={tasks}
              categories={categories}
              streak={streak.count}
              weeklyData={weeklyData}
              currentDate={currentDate}
            />
          )}

          {view === 'learn' && (
            <LearningPlan
              courses={learningCourses}
              goals={learningGoals}
              streak={learningStreak}
              onAddCourse={addCourse}
              onUpdateCourse={updateCourse}
              onDeleteCourse={deleteCourse}
              onAddGoal={addGoal}
              onUpdateGoal={updateGoal}
              onDeleteGoal={deleteGoal}
              onToggleLesson={toggleLesson}
              onAddLesson={addLesson}
              onDeleteLesson={deleteLesson}
              onSetProgress={setCourseProgress}
              onAddToPlanner={addCourseSessionToPlanner}
            />
          )}

          {view === 'shop' && (
            <ShoppingList
              lists={shoppingLists}
              setLists={setShoppingLists}
              history={shoppingHistory}
              setHistory={setShoppingHistory}
              recipes={shoppingRecipes}
              setRecipes={setShoppingRecipes}
              onAddToPlanner={(data) => addTask(data)}
            />
          )}
        </main>
      </div>

      {view !== 'learn' && view !== 'shop' && <FAB onClick={() => openModal()} />}

      {isSettingsOpen && (
        <SettingsModal
          theme={theme}
          setTheme={setTheme}
          location={weatherLocation}
          setLocation={setWeatherLocation}
          unit={weatherUnit}
          setUnit={setWeatherUnit}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          defaultTime={defaultModalTime}
          defaultDate={currentDate}
          categories={categories}
          onSave={handleSaveTask}
          onDelete={editingTask ? () => { deleteTask(editingTask.id); closeModal(); } : null}
          onClose={closeModal}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
        />
      )}
    </div>
  );
}
