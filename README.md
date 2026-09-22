# HeroDay — Own Your Day

HeroDay is a personal planning app that brings task management, a daily timeline, learning goals, grocery shopping with price tracking, and monthly budgeting together in one place. It's a client-only React app — no backend, no account, no tracking. Everything is stored locally on your device, in the browser's IndexedDB.

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
The shopping area has five sections: **My List**, **Recipes**, **Monthly Budget**, **Items** and **Stores**.

**My List**
- **Multiple shopping lists**, each tracked independently and optionally linked to a [store](#-stores). A linked list shows the store's icon in the list bar.
- **Add from your catalog.** The add bar suggests matching items as you type, with brand and size, and picking one registers the item on that exact product. This keeps "Milk", "milk 1 gal" and a typo from becoming three products with three separate price histories.
  - Quantities and units you type are kept (`2 lbs apples`), and a comma-separated batch adds what matches.
  - Text that matches nothing shows **"Product not found"** with an **Add as new product** button. Nothing is created behind your back.
  - A name that fits several products asks which one you mean instead of guessing.
- **Voice input** (Web Speech API) and **barcode scanning** (camera-based, with manual entry fallback) follow the same rule: a known barcode adds the exact product it belongs to, and an unknown one says "Product not found" and offers to add it as a new product, pre-filled and looked up on Open Food Facts.
- Categorized, collapsible sections with quantity steppers, an "Add again" strip and a "Quick re-add" list built from purchase history, and one-tap **Share** (copies a formatted checklist to the clipboard).
- **"What did you pay?"** When you tick an item off, its card offers a pre-filled *Paid* field. Confirming a price that's already right is one tap; correcting it is a type and a tap; ignoring it is fine.
- **Recipes**: ingredient lists parsed from free text, step-by-step instructions, photo upload, and one-click "Add to List."
- **Pantry tracker** with par levels that auto-restocks as you check off shopping items.
- **Store Mode** — a distraction-free, large-tap-target checkout view with a running total against your estimated budget.
- Schedule a "Go shopping" trip directly onto your daily planner.

### 🧺 Items
Every product you buy, with what you paid and what it tells you. Items are tracked automatically as you shop, and you can add them by hand.

**Insight tiles** across the top, each with a guided empty state that says what will unlock it:

| Tile | What it shows |
|---|---|
| **Spent this month** | The month so far, compared with the *same span of days* last month (not the whole month), plus any estimated-but-unconfirmed amount |
| **Where it went** | Spending by category or by store |
| **Time to restock** | Items due or overdue based on how often *you* buy them, and low pantry stock, each with a one-click **Add** |
| **Savings at the cheapest store** | What you'd have saved over the last 90 days by buying each item at its cheapest store |
| **Price movers** | What's getting dearer or cheaper, and a personal inflation figure |
| **Your habits** | Most-bought items, and ones you used to buy but haven't in 60+ days |
| **Price data** | How many items have enough confirmed prices for a trend, and how many purchases still need a price check |

**Product cards** show a photo or category emoji, brand and package size, the last price paid with a trend badge (`↑ +5%`, `↓ −10%`, `= Stable`), an *All-time low* / *More expensive than average* label, when it was last bought ("4 days ago"), the stores you usually buy it at, a restock meter, your buying rhythm ("You buy this every 12 days"), and a price sparkline.

**Click a card for everything:**
- Last paid, average, low/high, times bought (and this year), total spent, buying rhythm and best-price store.
- A **price history chart** with a hover and arrow-key readout, and a **store comparison** table.
- **Every purchase**, which you can edit in place, confirm with one click, or void. **Log a past purchase** to backfill history from a receipt.
- Edit the product, add it to a list, or delete it (with its history).

**Also:**
- **Add items by hand** — name, category, brand, package size, barcode, photo, notes — with an optional "also add to a list."
- **Barcode lookup** via Open Food Facts fills the name, brand, size, a category guess and a photo. Only the barcode number is sent, and only when you scan or click **Look up**.
- **Search, filter and sort**: by name, brand or barcode; by category or store; quick filters for *Due soon*, *Price up* and *Needs a price check*; and six sorts (name, recently bought, restock urgency, biggest price change, most bought, most spent).
- **Sample data**: *Load sample data* fills the section with 14 products, 3 stores and about five months of purchases so you can see everything working straight away. It's clearly labelled and comes off with one click, without touching your own data.

#### How the numbers are worked out
| Rule | Detail |
|---|---|
| **Only confirmed prices count** | A price pre-filled on a tick and never confirmed is a guess. Counting it would fill your history with copies of the last price and hide real changes. Unconfirmed amounts are shown separately. |
| **Prices compare per unit** | Trends use price ÷ quantity, so buying two isn't a price rise. |
| **Trend** | The last price against the average of up to the five before it. Within ±3% is *Stable*. |
| **All-time low / above average** | Needs at least three confirmed prices; "all-time low" also needs prices to have actually varied. |
| **Buying rhythm** | The *median* gap between purchase days (so one long gap doesn't distort it). Needs three purchase days; two purchases on one day count as one shop. |
| **Restock state** | *Suggested this week* from 70% of your usual gap, *Due* from 85%, *Overdue* from 115%. |
| **Best store** | The lowest average unit price, and only when two stores have confirmed prices. |
| **Inflation** | The median price change across items, and only once three items have a trend. |

Everything is calculated from your purchase log each time it's shown, never stored, so it can't drift from the data behind it.

### 🏪 Stores
Add the places you shop, with everything you'd want to know about them.
- **Fields**: name, category, icon (an emoji, or an uploaded logo), address, city, state/region, postal code, country, latitude/longitude, opening hours and notes.
- **Coordinates** three ways: type them, use **Use my location**, or **Look up from address** (OpenStreetMap). The lookup only runs when you click it.
- **Editable store categories** — Supermarket, Bakery, Butcher / Seafood, Farmers Market, Warehouse Club, Convenience Store, Pharmacy, Hardware Store, Department Store and Other. Deleting one moves its stores to *Other*, which can't be deleted.
- Adding a store can create its shopping list in the same step, so it shows up in the list bar straight away. Several lists can share one store, and plain lists ("Party") need no store.
- Cards show address, an "Open map" link, hours, notes, and each linked list with its remaining items and estimated total. Lists without a store are listed separately, with a quick way to link them.
- Deleting a store keeps its lists, and renaming a store renames a linked list only if that list still carries the old name.

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

### 📱 On a phone
On screens up to 600px wide the layout changes; desktop and tablet are untouched.
- **Bottom tab bar** with the five areas (Checklist, Timeline, Review, Learning, Shopping), always in thumb reach.
- **Waffle menu** (the nine-dot button in the header) opens every destination in groups — Planner, Shopping (jumping straight to a section) and App (Settings).
- **Shopping sections** sit in a strip along the top; in **My List** the add bar moves to the bottom with its suggestions opening upward, and the less-used tools (Categories, Units, store link, Delete list) fold behind **More**.
- **The main action floats above the tab bar** — New task, Add item, Add store, Create Recipe, Log Expense — instead of sitting in a header.
- **Dialogs are bottom sheets** with Save / Cancel pinned to the bottom, 16px inputs (so iOS doesn't zoom), and tap targets of at least 44px. A tap opens a task or a timeline card, since a phone has no hover to reveal Edit / Delete.

### 💾 Your data
Open **Settings → Your Data**:
- **Export backup** downloads everything as one JSON file that you own.
- **Import backup** restores from one, after an explicit confirmation, since it replaces what's there. A file from a newer version of the app is refused rather than partly imported, and a bad file leaves your data untouched.
- **Automatic upgrade** from older versions that kept data in `localStorage`. It runs once on first launch, copies everything across, and doesn't delete the old data; a verbatim snapshot is kept too. When you're satisfied, **Remove old storage** clears the old keys.

### ⚙️ Personalization
- Four themes: Default Dark, Default Light, and two HeroDay-branded teal themes (dark and light).
- Weather by saved location (auto-detect via geolocation or manual city search), in °F/°C.
- Fully custom categories for tasks, shopping, stores and budgeting.

## Tech stack

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- [Dexie 4](https://dexie.org/) over IndexedDB for storage. No backend, router, or state-management library.
- **TypeScript** (strict) for the data layer, analytics, hooks and utilities; the components are still JSX.
- Tests with [Vitest](https://vitest.dev/), jsdom and [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB); linting with ESLint.
- Charts are small inline SVG, with no charting library.
- Fonts: Inter (UI) and JetBrains Mono (numeric displays), loaded from Google Fonts.

## Getting started

```bash
npm install
npm run dev         # start the dev server
npm run build       # production build to dist/
npm run preview     # preview the production build
npm test            # run the test suite once (npm run test:watch to watch)
npm run typecheck   # TypeScript check
npm run lint        # ESLint
```

## Architecture

```
components (JSX)  →  hooks  →  operations (db/*Ops.ts)  →  Dexie tables (IndexedDB)
                        ↑
            analytics/  pure functions, computed on read
```

- **Components** render and collect input. **Hooks** (`useLiveQuery`) keep them in sync with the database. Writes live in `db/` (operations and repositories), plus small setters in the hooks for the older modules (budget, recipes, settings). An operation that touches more than one table runs in a single transaction, so it either lands completely or not at all.
- **Analytics** are pure functions with the clock passed in, so every rule is tested against a fixed date.
- **Soft deletes.** Every user-owned row carries `updatedAt` and `deletedAt`, and deleting sets a marker instead of removing the row. This keeps a future sync possible without a second migration over live data.
- **Schema upgrades** run inside Dexie's upgrade transaction and are tested against databases that were really created at the older version.
- **Images are stored as data-URL strings, never Blobs**, because the JSON backup can't serialise a Blob. They're validated when saved and again when displayed, since a backup file is just editable JSON.
- **Purchase dates are local calendar days**, not UTC, so an evening shop lands on the right date.
- **Two products are the same only if name, brand and size all match.** A list item is an instance of a catalog product, matched or picked, which is what keeps price histories from splitting.

## Project structure

```
src/
  components/   UI components (one per view/widget)
    shopping/   The shopping area: list, items, stores, recipes, pantry, scanner
  hooks/        React hooks over the database
  db/           Dexie schema, types, migrations, operations, backup/restore
  analytics/    Price trends, buying rhythm, store comparison, insights
  demo/         Removable sample data
  data/         Static data: categories, curated lists
  utils/        Formatting, dates, geo, product search, Open Food Facts client
  styles/       CSS split by area; index.css is the import manifest (mobile.css is the phone layer)
  test/         Test helpers
  App.jsx       Boot gate and view routing
public/         Static assets (favicon)
```

`src/index.css` only imports the files in `src/styles/`, and **import order is the cascade order**, so add new files at the end unless you mean to override something earlier.

## Testing

The suite covers the database operations, schema upgrades, backup and restore, the analytics, and the parsing and search logic. It also has **end-to-end tests that mount the real app** on `fake-indexeddb` and drive it through the DOM — adding stores and items, ticking and confirming prices, scanning, searching and filtering — so a wiring mistake shows up as a failing test and not a broken screen.

## Known limitations

- **Currency is dollars only.** Amounts are shown with `$` everywhere.
- **The quick-add parser knows a fixed list of units** (`gallon`, `lbs`, `oz`…). An abbreviation it doesn't recognise, such as `gal`, stays part of the name and can stop an item matching.
- **Recipe ingredients and renaming a list item can still create a product by name.** Typing, voice and scanning are catalog-only.
- **The timeline can't be dragged by touch.** Moving and resizing a card uses the mouse; on a phone, tap a card to edit its time instead.
- **There is no sync.** Data lives on one device in one browser. Use **Export backup** to move or protect it.

## Data & privacy

HeroDay stores everything in your browser's IndexedDB — tasks, categories, learning courses and goals, shopping lists, products and purchase history, stores, budget data, and settings. There are no accounts and no analytics. Clearing your browser's site data clears your data, so **export a backup** before you do.

Nothing leaves your device in the background. These services are contacted, and only for the reason given:

| Service | When | What is sent |
|---|---|---|
| [Open-Meteo](https://open-meteo.com/) | Showing weather for your saved location, and searching for a city in Settings | The coordinates or city name |
| [Nominatim / OpenStreetMap](https://nominatim.org/) | Settings' "Use my location" name lookup, and a store's **Look up from address** — only when you click | The coordinates or the address you typed |
| [Open Food Facts](https://openfoodfacts.org/) | Scanning an unknown barcode, or clicking **Look up** on an item — never as you type | The barcode number only |
| Google Fonts | Loading the interface fonts when the page opens | The usual request a browser makes for a font |
| Google Maps / OpenStreetMap links | Only if you click "Get directions" or "Open map" | Nothing until you click; then you're on their site |

Product photos from Open Food Facts are downloaded once, resized and stored on your device, so they aren't fetched again.
