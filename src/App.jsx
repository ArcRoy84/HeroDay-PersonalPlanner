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
import { MobileTabBar, WaffleMenu } from './components/MobileNav.jsx';
import Login from './components/Login.jsx';
import { getToday, navigateDate } from './utils/helpers.js';
import { newId } from './db/ids';
import { useDatabaseReady } from './hooks/useDatabaseReady';
import { useAuth } from './hooks/useAuth';
import { useTasks, useCategories } from './hooks/useTasks';
import { useLearning } from './hooks/useLearning';
import { useShopping } from './hooks/useShopping';
import { useStores } from './hooks/useStores';
import { useProducts } from './hooks/useProducts';
import { useSetting } from './hooks/useSetting';
import { useIsMobile } from './hooks/useIsMobile';

const NO_STREAK = { count: 0, lastDate: null };

/** Shown while IndexedDB opens and the localStorage migration runs. */
function BootScreen({ error }) {
  if (error) {
    return (
      <div className="app app-boot">
        <div className="boot-message">
          <h1>Storage unavailable</h1>
          <p>
            HeroDay could not open its local database. This usually means the
            browser is in private mode or has storage disabled.
          </p>
          <pre className="boot-error">{error.message}</pre>
        </div>
      </div>
    );
  }
  return (
    <div className="app app-boot">
      <div className="boot-message"><p>Loading your day…</p></div>
    </div>
  );
}

export default function App() {
  // Auth gates the app before the database gate does: a signed-out visitor
  // should never reach the Dexie boot sequence, just the login screen.
  const { status: authStatus, session, sendMagicLink, signOut } = useAuth();
  if (authStatus === 'loading') return <BootScreen />;
  if (authStatus === 'signed-out') return <Login sendMagicLink={sendMagicLink} />;
  return <AuthedApp session={session} signOut={signOut} />;
}

function AuthedApp({ session, signOut }) {
  const { status, error } = useDatabaseReady();
  if (status !== 'ready') return <BootScreen error={error} />;
  // The app proper is a separate component so its hooks only ever mount
  // against an open, migrated database and never defend against a half-ready
  // one. Returning early here would break the rules of hooks if they shared
  // a component.
  return <HeroDay session={session} signOut={signOut} />;
}

function HeroDay({ session, signOut }) {
  const [currentDate, setCurrentDate] = useState(getToday());

  // ── Persisted state ────────────────────────────────────────────────────────
  const { tasks, weeklyData, addTask, updateTask, deleteTask, toggleTask } = useTasks(currentDate);
  const { categories, addCategory: addCategoryRow, deleteCategory } = useCategories();
  const learning = useLearning(getToday());
  const shopping = useShopping();
  const stores = useStores();
  const catalog = useProducts();

  const [theme, setTheme] = useSetting('theme', 'dark');
  const [view, setView] = useSetting('view', 'checklist');
  const [streak, setStreak] = useSetting('streak', NO_STREAK);
  const [weatherLocation, setWeatherLocation] = useSetting('weatherLocation', null);
  const [weatherUnit, setWeatherUnit] = useSetting('weatherUnit', 'fahrenheit');
  const [profileName, setProfileName] = useSetting('profileName', '');
  const [profilePhoto, setProfilePhoto] = useSetting('profilePhoto', null);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Which Shopping section is showing. Lives here so the phone menu can jump to one.
  const [shopSection, setShopSection] = useState('lists');
  const isMobile = useIsMobile();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultModalTime, setDefaultModalTime] = useState('');

  // Notification tracking ref (avoid repeating alerts)
  const notifiedRef = useRef(new Set());

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

  // ── Learning: schedule a study session as a task ───────────────────────────
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

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const addCategory = useCallback((data) => {
    addCategoryRow({ id: newId(), ...data });
  }, [addCategoryRow]);

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
        onOpenMenu={isMobile ? () => setIsMenuOpen(true) : undefined}
        profileName={profileName} setProfileName={setProfileName}
        profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto}
        email={session.user.email} onSignOut={signOut}
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
              courses={learning.courses}
              goals={learning.goals}
              streak={learning.streak}
              onAddCourse={learning.addCourse}
              onUpdateCourse={learning.updateCourse}
              onDeleteCourse={learning.deleteCourse}
              onAddGoal={learning.addGoal}
              onUpdateGoal={learning.updateGoal}
              onDeleteGoal={learning.deleteGoal}
              onToggleLesson={learning.toggleLesson}
              onAddLesson={learning.addLesson}
              onDeleteLesson={learning.deleteLesson}
              onSetProgress={learning.setCourseProgress}
              onAddToPlanner={addCourseSessionToPlanner}
            />
          )}

          {view === 'shop' && (
            <ShoppingList
              {...shopping}
              {...stores}
              {...catalog}
              section={shopSection}
              onSectionChange={setShopSection}
              onAddToPlanner={(data) => addTask(data)}
            />
          )}
        </main>
      </div>

      {view !== 'learn' && view !== 'shop' && <FAB onClick={() => openModal()} />}

      {isMobile && <MobileTabBar view={view} setView={setView} />}

      {isMobile && isMenuOpen && (
        <WaffleMenu
          view={view}
          setView={setView}
          shopSection={shopSection}
          setShopSection={setShopSection}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onClose={() => setIsMenuOpen(false)}
          profileName={profileName} setProfileName={setProfileName}
          profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto}
          email={session.user.email} onSignOut={signOut}
        />
      )}

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
