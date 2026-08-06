# HeroDay — Own Your Day

HeroDay is a personal planning app that brings task management, a daily timeline, learning goals, grocery shopping, and monthly budgeting together in one place. It's a client-only React app — no backend, no account, no tracking. Everything is stored locally in your browser.

## Features

### ✅ Task planning
- Full task CRUD — title, priority (High/Medium/Low), category, notes, tags, location.
- **Multi-day events** with start/end date and time.
- **Recurring tasks** on any combination of weekdays, with independent per-day completion tracking.
- **Reminders** with multiple configurable offsets (5/10/15/30 min, 1 hour) via the browser Notification API.
- **Location field** with a one-click "Get directions" link to Google Maps.
- Custom, user-managed **categories** with color swatches.
- Keyboard shortcuts: `N` or `⌘/Ctrl+Enter` for a new task, `1`–`5` to switch views, `←`/`→` to navigate days.

### 📋 Checklist view
Filterable (by priority), sortable (priority/time/created), and groupable (by priority/category) task list with an overall progress bar, recurrence/category/tag/location chips, and inline edit/delete.

### 📅 Timeline view
An hour-by-hour day timeline with drag-to-reschedule and drag-to-resize task cards, click-to-add on empty slots, a live current-time indicator, non-overlapping columns for concurrent tasks, and a collapsible "Unscheduled" tray. The sidebar includes a day-stats panel, a mini calendar, and per-day sticky notes.

### 📈 Review (stats)
Weekly completion chart with a momentum indicator, a streak tracker with flame badges ("Week warrior," "Month master"), all-time totals, and completion breakdowns by priority and by category.

### 🎓 Learning
Build your own learning path — for a professional certification, a trade skill, a new language, or any personal goal:
- **Courses** with a category (Professional Skill, Certification, Language, Trade/Vocational, Personal/Hobby, Life Skill), provider, target date, and weekly time budget.
- Two tracking styles per course: a **lesson checklist** (each lesson can carry an optional link or note) or a **simple progress slider**.
- **Goals** that link multiple courses toward something bigger, with combined progress and a target date.
- A learning streak and confetti celebration when a course or goal is completed.
- One-click **"+ Plan"** to schedule a study session directly onto your daily planner.

### 🛒 Shopping
- **Multiple shopping lists** ("stores"), each tracked independently.
- **Smart quick-add**: free-text entry parses quantity, unit, and multiple items at once, and auto-categorizes new items.
- **Voice input** (Web Speech API) and **barcode scanning** (camera-based, with manual entry fallback) that recognizes previously purchased items.
- Categorized, collapsible sections with quantity steppers, an "Add again" suggestions strip built from purchase history, and one-tap **Share** (copies a formatted checklist to the clipboard).
- **Recipes**: ingredient lists parsed from free text, step-by-step instructions, photo upload, and one-click "Add to List."
- **Pantry tracker** with par levels that auto-restocks as you check off shopping items.
- **Store Mode** — a distraction-free, large-tap-target checkout view with a running total against your estimated budget.
- **All Items** and **Stores** rollup views across every list.
- Schedule a "Go shopping" trip directly onto your daily planner.

### 💰 Monthly budget
- Three budgeting styles: **Zero-Based**, **50/30/20**, and **Envelopes**.
- **Safe-to-Spend** hero card: cash on hand minus upcoming bills minus committed savings.
- Custom budget categories with per-category allocations.
- Quick, semi-natural-language **expense logging** ("Spent $14.50 on lunch at Sweetgreen") plus a manual entry form and a favorite-payees quick list.
- **Income** sources (monthly/weekly/biweekly/yearly, normalized to a monthly total).
- **Recurring bills** with due dates, "mark paid this cycle," and cycle reset.
- A rollup card showing estimated grocery costs pulled straight from your Shopping lists.

### 🧩 Dashboard
Sidebar with a completion ring, day streak, pending-tasks-by-priority breakdown, time-remaining estimate, top categories chart, and a live weather widget.

### ⚙️ Personalization
- Light/dark theme, plus two additional HeroDay-branded teal themes.
- Weather by saved location (auto-detect via geolocation or manual city search), in °F/°C.
- Fully custom categories for tasks, shopping, and budgeting.

## Tech stack

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- No backend, router, or state-management library — all state lives in React and persists to `localStorage`
- Weather via [Open-Meteo](https://open-meteo.com/) (forecast + geocoding); location lookup via [Nominatim](https://nominatim.org/)
- Fonts: Inter (UI) and JetBrains Mono (numeric displays)

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Project structure

```
src/
  components/   UI components (one per view/widget)
  data/         Static data: categories, curated lists
  utils/        Formatting and date helpers
  App.jsx       App state, persistence, and view routing
public/         Static assets (favicon)
```

## Data & privacy

HeroDay stores everything in your browser's `localStorage` — tasks, categories, learning courses/goals, shopping lists, budget data, and settings. Nothing is sent to a server except live weather lookups for the location you configure. Clearing your browser storage clears your data.
