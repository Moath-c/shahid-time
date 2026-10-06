# **Shahid Time - Movie Streaming Web Application**

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![JavaScript (ESM)](https://img.shields.io/badge/JavaScript_ESM-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![TMDB API](https://img.shields.io/badge/TMDB_API-032541?style=for-the-badge&logo=themoviedb&logoColor=01D277)](https://developer.themoviedb.org/)

---

## Description

**Shahid Time** is a modular, highly responsive, Netflix-inspired movie and TV streaming interface built with **HTML5**, **Tailwind CSS**, and **modern ES6 JavaScript Modules**. The catalogue is not hard-coded — the interface connects **live to the TMDB (The Movie Database) v3 API**, fetching trending movies, top-rated titles, popular TV shows, trailers, and rich metadata in real time.

Instead of one monolithic script, the application is cleanly split into focused ES6 modules (`config`, `api`, `ui`, `app`) so the code stays easy to read, scale, and maintain. Everything runs client-side in the browser — no backend required.

---

## Completed Features

### 🎬 Live Movie & Show Discovery
- Home grid powered by TMDB's **Trending**, **Top Rated**, **Now Playing**, and genre-based **Discover** endpoints.
- Navbar feed switching: **Home**, **TV Shows** (via `/discover/tv`), **Movies** (via `/discover/movie`), and **New & Popular** (Upcoming movies + Popular shows).
- Cinematic hero banner with rotating featured titles, backdrop imagery, genre hints, % match, and runtime.

### 🔍 Real-Time Search
- Expanding navbar search box with **debounced live search** against TMDB's `/search/movie` endpoint.
- Race-safe results: stale responses are discarded, results render instantly, and clearing the query smoothly restores the home feed.

### ▶️ Interactive YouTube Trailer Modals
- Click any card to open a lightweight trailer player that automatically filters TMDB videos for a **YouTube "Trailer"** and loads it in an autoplaying iframe.
- Closes via the **X**, backdrop click, or **Esc** — playback is fully stopped when closed.

### 🎞️ Extensive Movie Detail Cards (More Info)
- Full details overlay reached from every card's **chevron** or the hero's **More Info** button.
- Title, italic tagline, release year, `Xh Ym` runtime, **% Match**, genre pills, overview, and a facts column (status, language, original title, release date) — for movies **and** TV shows.

### ❤️ Persistent "My List" Bookmarking
- Dedicated **My List** row beneath the hero, hidden until you save something.
- `+`/`✓` toggle buttons on every card, the hero, and the details overlay.
- Persisted to **`localStorage`** so bookmarks survive page reloads, with type-safe separation between movies and TV shows.

### 👤 Fully Functional Profile Navigation
- Interactive navbar links with active-state highlighting (desktop + mobile).
- Floating **profile dropdown** (Manage Profiles, Account, Help Centre, Sign out) that opens on click and closes on outside-click or **Esc**.
- Polished toast notifications for empty states and demo actions.

> **Bonus polish:** skeleton loading rows, hover-scale card animations, horizontal scroll arrows, IntersectionObserver row reveals, image fallbacks, and full keyboard accessibility on cards.

---

## Project Structure

The application follows a clean **ES6 module architecture**:

```
shahid-time/
├── index.html          # Single-page markup: navbar, hero, rows, My List, modals, footer
├── app.js              # Entry point — boots the app, binds navbar + profile dropdown
├── api.js              # TMDB v3 client — all async fetch functions & row configs
├── ui.js               # All DOM work — rendering, search, modals, My List, feed switching
├── config.js           # Central configuration — API key, base URLs, fallbacks, genres
└── README.md           # This file
```

| File | Responsibility |
| --- | --- |
| **`index.html`** | The entire page layout (sticky transparent navbar, cinematic hero, scrollable category rows, search section, details + trailer modals, footer). Branding, Tailwind CDN configuration, and the module `<script>` tag live here. |
| **`app.js`** | The application **entry point**. Sets up the `DOMContentLoaded` bootstrap, renders the default layout rows, and binds the navbar links + profile dropdown clicks. No business logic. |
| **`api.js`** | The TMDB **data layer**. Owns `tmdbFetch()` plus every async fetcher (trending, top rated, action, details, videos, search) and the `ROW_CONFIG` / `FEEDS` endpoint definitions. Never touches the DOM. |
| **`ui.js`** | The **presentation layer**. All DOM manipulation: card/row templates, live search box, trailer + details modals, My List persistence/rendering, and navbar feed switching through `renderFeed()` / `switchFeed()`. |
| **`config.js`** | **Single source of truth** for settings: `TMDB_API_KEY`, TMDB base/`image` URLs, `YOUTUBE_EMBED_BASE`, placeholder fallbacks, storage key, and the genre map. |

```
Dependency flow:  app.js → api.js → config.js
                        ↘ ui.js  → api.js, config.js
```

---

## Setup & Installation

### Prerequisites
- A modern browser (Chrome, Edge, Firefox, Safari).
- A free **TMDB v3 API key** ([themoviedb.org → Settings → API](https://www.themoviedb.org/settings/api)). Registration takes a minute.
- A local web server — the project uses ES6 modules, which browsers **will not load over `file://`**. The recommended option is the **Live Server** extension for VS Code.

### Step 1 — Clone the repository

```bash
git clone <your-repository-url>
cd shahid-time
```

### Step 2 — Create `config.js`

The project expects a `config.js` file in the project root that exports your API credentials and settings:

```js
// config.js
export const TMDB_API_KEY = "YOUR_API_KEY_HERE";
export const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500/";
export const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original/";
export const FALLBACK_POSTER = "https://placehold.co/400x600/1f1f1f/E50914?text=No+Poster";
export const FALLBACK_BACKDROP = "https://placehold.co/1280x720/181818/E50914?text=No+Image";
export const YOUTUBE_EMBED_BASE = "https://www.youtube.com/embed/";
export const DEFAULT_MOVIE_ID = 550;
export const MY_LIST_STORAGE_KEY = "netflixMyList";
export const GENRE_MAP = { 28: "Action", 35: "Comedy", /* … */ };
```

### Step 3 — Add your unique TMDB API key

Copy `config.example.js` to `config.js` and paste your key into the placeholder on the first line:

```bash
cp config.example.js config.js
```

```js
// config.js (first line)
export const TMDB_API_KEY = "YOUR_TMDB_API_KEY_GOES_HERE"; // <-- paste your key
```

> ⚠️ `config.js` is git-ignored, so your key is **never committed to the repository**. Do **not** paste your key into `index.html` or any other file that is tracked in git.

### Step 4 — Launch the app

**Option A — VS Code Live Server (recommended):**
1. Open the project folder in VS Code.
2. Install the **Live Server** extension (`ritwickdey.live-server`).
3. Right-click `index.html` → **Open with Live Server** (or click the "Go Live" button in the status bar).
4. The app opens at `http://127.0.0.1:5500`.

**Option B — Any static server:**
```bash
# Python
python -m http.server 8000
# then open http://localhost:8000
```

> 🚨 **Important:** Opening `index.html` directly by double-clicking it (`file://`) will produce a CORS error. ES6 modules must be served over HTTP — always use Live Server or one of the commands above.

---

## Security Note — Protecting Your API Key

Your `config.js` holds a personal TMDB API credential and must **never be tracked or committed** to version control:

1. Create a `.gitignore` file in the project root (if you don't have one) and add:

```gitignore
# Keep personal API credentials safe
config.js
*.local
```

2. Verify your key is ignored before committing:

```bash
git status          # config.js should NOT appear as untracked
git check-ignore config.js   # prints the path if it is properly ignored
```

3. Deploy safely:
   - Keep a **template copy** (e.g. `config.example.js`) committed to the repo with `YOUR_API_KEY_HERE`, so contributors know what to fill in.
   - Never commit the real `config.js` to a **public** repository.
   - If the key is ever exposed, regenerate it immediately from your TMDB dashboard.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Markup | HTML5 (semantic, accessible, ARIA-labelled) |
| Styling | Tailwind CSS (CDN + custom theme), custom keyframe animations |
| Scripting | Vanilla JavaScript — ES6+ modules (`import` / `export`) |
| Data | TMDB v3 REST API (`fetch` + `Promise.allSettled`) |
| Storage | Browser `localStorage` for the My List persistence |
| Media | YouTube embeds for trailers, TMDB image service for posters/backdrops |

## License & Disclaimer

Built for demonstration and learning purposes. **TMDB does not endorse or certify this project.** All movie/show titles, posters, and metadata are © their respective owners and are served via the TMDB API under TMDB's terms of use.