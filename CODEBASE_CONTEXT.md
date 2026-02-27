# Exercise Recorder — Codebase Context

## Project Overview
Mobile-first gym logging PWA. Offline-first with IndexedDB + server sync.
- **Dev server**: `PORT=3002 node server.js` (3000 is used by stock-portfolio-app)
- **URL**: http://localhost:3002
- **Stack**: Vanilla JS + Express + IndexedDB + JSON file DB (`data/exercises.json`)

## Key Files
| File | Purpose |
|------|---------|
| `server.js` | Express API + static file server |
| `public/index.html` | App shell, all 3 screens + 2 bottom sheets |
| `public/js/app.js` | All UI logic, state, navigation |
| `public/js/db.js` | IndexedDB wrapper (ExerciseDB) |
| `public/js/chart.js` | Canvas chart for progression |
| `public/css/style.css` | All styles |
| `data/exercises.json` | Server-side JSON DB (synced from client) |

## UX Flow (3-step)
1. **Home** → Category grid (Chest / Back / Shoulders / Legs / Arms / Core) + "Custom Exercise" card
2. **Category tap** → Exercise list for that category. Each row shows last logged weight/sets/reps. "+ Add exercise to [Cat]" at bottom.
3. **Exercise tap** → Bottom sheet slides up. Pre-fills last weight/unit/sets/reps. Weight display + kg/lbs toggle + −5/−2.5/+2.5/+5 chips + steppers for sets×reps + Save.

## Architecture
- **Navigation**: Pure CSS show/hide (`view.active`). Header swaps between `#header-main` (home) and `#header-back` (exercise list).
- **State**: `currentCategory`, `currentExercise`, `selectedUnit`, `addingForCat`
- **Custom exercises**: Stored in `localStorage` as `{ Chest: ['My Ex'], ... }`. Merged with `DEFAULT_EXERCISES` at render time.
- **Data storage**: IndexedDB (offline), synced to server via `POST /api/sync` when online. Names stored **lowercase** in DB.
- **Tabs**: Record / History / Charts

## Bottom Sheets
- `#log-sheet` — log an exercise entry
- `#add-sheet` — add a new custom exercise (name input + optional category picker)
- `#sheet-backdrop` — shared backdrop for both sheets
- Both use CSS `transform: translateY(100%) → translateY(0)` transition

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/exercises` | All entries (sorted by date desc) |
| GET | `/api/exercises/names` | Distinct names sorted by frequency |
| GET | `/api/exercises/progression/:name` | Entries for one exercise (asc) |
| POST | `/api/exercises` | Add/upsert single entry |
| POST | `/api/sync` | Batch sync from client |
| DELETE | `/api/exercises/:id` | Delete entry |

## Design Tokens (CSS vars)
- `--bg: #0a0a12` — page background
- `--surface: #13131e` — cards
- `--surface2: #1c1c2b` — inputs, sheet body
- `--primary: #7c6fff` — purple accent
- `--accent: #00e5b4` — green (success, weights)
- `--muted: #55556a` — secondary text

## Category Colours
Chest `#ff5c7a` · Back `#4895ef` · Shoulders `#a78bfa` · Legs `#34d399` · Arms `#fb923c` · Core `#fbbf24`

## Known Issues
- IndexedDB `getUnsynced()` throws a `DataError` (IDBIndex.getAll with boolean key). Sync falls back gracefully — entries marked "pending sync" until fixed.

## Change History
### 2026-02-27
- Complete UI redesign: 3-screen flow replacing single-form approach
- Removed "X done" category badges and "✓ today" exercise badges
- New log sheet: large weight input, kg/lbs pill toggle, ±2.5/±5 quick chips, steppers for sets×reps
- Added custom exercise support (localStorage) from both home and exercise list
- Dev port changed to 3002 (3000 taken by stock-portfolio-app)
- Playwright screenshots use `--channel chrome` (not chromium) to avoid Google login issues
