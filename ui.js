/* ============================================================================
 * ui.js — every piece of DOM work for the Shahid Time streaming template.
 * ---------------------------------------------------------------------------
 * Rendering (rows, cards, skeletons), live search box, the trailer + details
 * modals, the My List row and the navbar feed switching. It pulls raw data
 * from api.js and shapes it in `normalizeItem()` before painting it.
 * ==========================================================================*/

import {
  TMDB_IMAGE_BASE,
  TMDB_BACKDROP_BASE,
  FALLBACK_POSTER,
  FALLBACK_BACKDROP,
  YOUTUBE_EMBED_BASE,
  DEFAULT_MOVIE_ID,
  MY_LIST_STORAGE_KEY,
  GENRE_MAP,
} from './config.js';
import {
  hasApiKey,
  tmdbFetch,
  fetchTrendingMovies,
  fetchMovieDetails,
  fetchDetails,
  fetchVideos,
  fetchSearch,
  FEEDS,
} from './api.js';

/* ------------------------------- STATE ---------------------------------- */

/** Which navbar feed is currently rendered (used by retry + re-clicks). */
let activeFeed = 'home';
/** Guards against overlapping feed requests when switching quickly. */
let feedSeq = 0;
/** Set by initSearch() so nav clicks can reset an active search. */
let resetSearchFn = null;

/** Local cache of every normalized movie rendered on the page (key → movie). */
const movieStore = new Map();

/** The movie currently featured in the hero (set by initHero). */
let heroMovie = null;

/** The movie ID currently open in the "More Info" details overlay. */
let currentDetailMovieId = null;
/** Media type of the title currently shown in the details overlay. */
let currentDetailMediaType = 'movie';

/** Bookmarked movies: restore any previously saved list from local storage. */
let myList = JSON.parse(localStorage.getItem(MY_LIST_STORAGE_KEY)) || [];

/** The movie currently rendered in the details overlay (for its My List btn). */
let currentDetailMovieData = null;

/** Icons swapped between "+" (not bookmarked) and "✓" (bookmarked). */
const ICON_PLUS = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg>`;
const ICON_CHECK = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;

/* ------------------------- DATA NORMALIZATION ---------------------------- */

/**
 * Builds a full TMDB image URL, falling back to a placeholder if missing.
 * TMDB paths always start with "/", so the leading slash is stripped to avoid
 * a double slash when appending to the base URL.
 */
const imageUrl = (path, base = TMDB_IMAGE_BASE, fallback = FALLBACK_POSTER) =>
  path ? `${base}${String(path).replace(/^\/+/, '')}` : fallback;

const clampMatch = (voteAverage) => {
  const pct = Math.round((voteAverage || 0) * 10);
  return Math.min(99, Math.max(0, pct));
};

const formatRuntime = (minutes) =>
  minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : '—';

/**
 * Maps a raw TMDB payload (movie *or* TV) onto the shape the UI expects.
 *
 * @param {object} raw       — TMDB result object
 * @param {string} mediaType — 'movie' | 'tv' | 'all' (trending sends its own)
 */
function normalizeItem(raw, mediaType = 'movie') {
  const type =
    raw.media_type === 'movie' || raw.media_type === 'tv'
      ? raw.media_type
      : mediaType === 'all'
        ? 'movie'
        : mediaType;

  const date = raw.release_date || raw.first_air_date || '';

  const movie = {
    id: raw.id,
    mediaType: type,               // 'movie' | 'tv'
    storeKey: `${type}-${raw.id}`, // movie ids and tv ids can collide
    title: raw.title || raw.name || 'Untitled',
    year: date ? date.slice(0, 4) : '—',
    releaseDate: date,
    match: clampMatch(raw.vote_average),
    voteAverage: (raw.vote_average || 0).toFixed(1),
    rating: raw.adult ? 'R' : 'HD', // certification needs an extra endpoint; HD is the quality badge
    duration: '—', // runtime only exists on the details endpoint
    genres: (raw.genre_ids || [])
      .map((id) => GENRE_MAP[id])
      .filter(Boolean),
    poster: imageUrl(raw.poster_path),
    backdrop: imageUrl(raw.backdrop_path, TMDB_BACKDROP_BASE, FALLBACK_BACKDROP),
    description: raw.overview || 'No synopsis available for this title.',
  };
  movieStore.set(movie.storeKey, movie);
  return movie;
}

/** Movie-only normaliser (search results + hero picks are always movies). */
const normalizeMovie = (raw) => normalizeItem(raw, 'movie');

/** Looks an item up in the store by id + media type. */
const getStoredItem = (id, mediaType = 'movie') => movieStore.get(`${mediaType}-${id}`);

/* ---------------------------- RENDER HELPERS ----------------------------- */

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const chevron = (direction) => {
  const d = direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7';
  return `<svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="${d}" />
    </svg>`;
};

/** Builds a single hover-animated movie card (poster + TMDB metadata). */
function cardTemplate(movie) {
  const title = escapeHtml(movie.title);
  const genres = escapeHtml(movie.genres.join(' • ') || 'Movie');
  const inList = isInMyList(movie.id, movie.mediaType);

  return `
    <article
      class="movie-card group relative w-[150px] shrink-0 cursor-pointer overflow-hidden rounded-lg bg-netflix-card sm:w-[190px] lg:w-[220px]"
      tabindex="0"
      role="button"
      aria-label="${title}"
      data-movie-id="${movie.id}"
      data-media-type="${movie.mediaType || 'movie'}">
      <img
        src="${movie.poster}"
        alt="${title} poster"
        loading="lazy"
        class="poster-img aspect-[2/3] w-full object-cover"
        onerror="this.onerror=null;this.src='${FALLBACK_POSTER}';" />

      <!-- Hover overlay with quick actions -->
      <div class="card-overlay absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3">
        <div class="flex items-center gap-2">
          <span class="grid h-7 w-7 place-items-center rounded-full bg-white text-black transition hover:scale-110" aria-hidden="true">
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </span>

          <!-- "+" toggle: bookmarks the movie (turns into a ✓) -->
          <button
            type="button"
            data-action="list"
            aria-label="${inList ? 'Remove from My List' : 'Add to My List'}"
            class="grid h-7 w-7 place-items-center rounded-full border border-gray-400/70 bg-black/40 text-white transition hover:scale-110 hover:border-white">
            ${inList ? ICON_CHECK : ICON_PLUS}
          </button>

          <button
            type="button"
            data-action="info"
            aria-label="More info about ${title}"
            class="ml-auto grid h-7 w-7 place-items-center rounded-full border border-gray-400/70 bg-black/40 text-white transition hover:scale-110 hover:border-white">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        <p class="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-300">
          <span class="text-green-400">${movie.match}% Match</span>
          <span class="rounded border border-gray-500 px-1 font-normal text-gray-300">${movie.rating}</span>
          <span class="font-normal text-gray-400">★ ${movie.voteAverage}</span>
        </p>
        <p class="mt-1 truncate text-[13px] font-semibold text-white">${title}</p>
        <p class="mt-0.5 truncate text-[11px] text-gray-400">${genres}</p>
      </div>
    </article>`;
}

/** Builds one scrollable category row (header + arrows + card strip). */
function rowTemplate(row, rowIndex) {
  const cards = row.movies.map(cardTemplate).join('');

  return `
    <section class="row-reveal row-nav group/row" data-row-index="${rowIndex}">
      <div class="mx-auto flex max-w-[1800px] items-center justify-between px-4 pb-3 sm:px-6 lg:px-12">
        <h2 class="text-lg font-bold tracking-tight text-gray-100 sm:text-2xl">${escapeHtml(row.title)}</h2>
        <div class="flex items-center gap-2 text-xs font-semibold text-gray-400">
          <a href="#" class="hidden transition hover:text-white sm:block">Explore All</a>
          <span class="hidden text-netflix-red transition hover:translate-x-0.5 sm:block">›</span>
        </div>
      </div>

      <div class="relative px-4 sm:px-6 lg:px-12">
        <!-- Left arrow -->
        <button
          type="button"
          class="row-arrow absolute left-0 top-1/2 z-40 hidden h-24 w-10 -translate-y-1/2 items-center justify-center rounded-r-md bg-black/60 text-white md:flex"
          data-scroll="left"
          aria-label="Scroll ${escapeHtml(row.title)} left">
          ${chevron('left')}
        </button>

        <!-- Scrollable strip -->
        <div
          class="no-scrollbar flex gap-2.5 overflow-x-auto overflow-y-visible py-4 pr-4 sm:gap-3.5"
          data-strip
          style="scroll-behavior: smooth;">
          ${cards}
        </div>

        <!-- Right arrow -->
        <button
          type="button"
          class="row-arrow absolute right-0 top-1/2 z-40 hidden h-24 w-10 -translate-y-1/2 items-center justify-center rounded-l-md bg-black/60 text-white md:flex"
          data-scroll="right"
          aria-label="Scroll ${escapeHtml(row.title)} right">
          ${chevron('right')}
        </button>
      </div>
    </section>`;
}

/** Shown while the TMDB requests are in flight. */
function loadingRowTemplate(config) {
  const skeleton = `
    <div class="w-[150px] shrink-0 sm:w-[190px] lg:w-[220px]">
      <div class="aspect-[2/3] w-full animate-pulse rounded-lg bg-white/[0.06]"></div>
    </div>`;

  return `
    <section aria-busy="true" aria-label="Loading ${escapeHtml(config.title)}">
      <div class="mx-auto max-w-[1800px] px-4 pb-3 sm:px-6 lg:px-12">
        <div class="h-6 w-52 animate-pulse rounded bg-white/[0.08]"></div>
      </div>
      <div class="no-scrollbar flex gap-2.5 overflow-hidden px-4 py-4 sm:gap-3.5 sm:px-6 lg:px-12">
        ${skeleton.repeat(8)}
      </div>
    </section>`;
}

/** Setup notice shown when no API key has been pasted into config.js yet. */
function apiKeyNoticeTemplate() {
  return `
    <div class="mx-auto max-w-2xl px-6 py-14 text-center">
      <div class="rounded-xl border border-netflix-red/40 bg-netflix-panel p-8 shadow-2xl">
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-netflix-red/15 text-netflix-red">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a4 4 0 11-3.9 5H9v2h2v2h2v-2h2.1A4 4 0 1115 7z" />
          </svg>
        </span>
        <h2 class="mt-4 text-xl font-bold text-white">Add your TMDB API key</h2>
        <p class="mt-2 text-sm leading-relaxed text-gray-400">
          Open <code class="rounded bg-black/40 px-1.5 py-0.5 text-netflix-red">config.js</code>,
          replace <code class="rounded bg-black/40 px-1.5 py-0.5 text-netflix-red">TMDB_API_KEY</code>
          with your v3 API key from
          <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" class="text-white underline hover:text-netflix-red">themoviedb.org</a>,
          then reload the page.
        </p>
      </div>
    </div>`;
}

/** Error state — also rendered if a row's request fails (e.g. invalid key). */
function errorTemplate(message) {
  return `
    <div class="mx-auto max-w-2xl px-6 py-14 text-center">
      <div class="rounded-xl border border-white/10 bg-netflix-panel p-8">
        <h2 class="text-xl font-bold text-white">Couldn't load the catalogue</h2>
        <p class="mt-2 text-sm text-gray-400">${escapeHtml(message)}</p>
        <p class="mt-1 text-xs text-gray-500">Check that your TMDB API key is valid and that you are online.</p>
        <button id="retryButton" type="button" class="mt-5 rounded bg-netflix-red px-6 py-2.5 font-bold text-white transition hover:bg-netflix-darkred">
          Retry
        </button>
      </div>
    </div>`;
}

/* ------------------------------- BEHAVIOUR ------------------------------ */

/** Attaches trailer / info / My List behaviour to a single movie card. */
function attachCardBehaviour(card) {
  const movieId = Number(card.dataset.movieId);
  const mediaType = card.dataset.mediaType || 'movie';

  // Clicking a card launches that title's trailer
  const open = () => openModal(movieId, mediaType);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });

  // The card's chevron ("More Info") trigger opens the details overlay
  card.querySelector('[data-action="info"]')?.addEventListener('click', (e) => {
    e.stopPropagation(); // …without also launching the trailer
    openDetailsModal(movieId, mediaType);
  });

  // The card's "+" action toggles the bookmark
  card.querySelector('[data-action="list"]')?.addEventListener('click', (e) => {
    e.stopPropagation(); // …without also launching the trailer
    const movie =
      getStoredItem(movieId, mediaType) ||
      myList.find((m) => m.id === movieId && (m.mediaType || 'movie') === mediaType);
    if (movie) toggleMyList(movie);
  });
}

/** Wires arrow scrolling + card behaviour for every rendered row. */
function wireRowBehaviour(container) {
  container.querySelectorAll('.row-nav').forEach((rowNav) => {
    const strip = rowNav.querySelector('[data-strip]');
    rowNav.querySelectorAll('[data-scroll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const distance = strip.clientWidth * 0.85;
        const delta = btn.dataset.scroll === 'left' ? -distance : distance;
        strip.scrollBy({ left: delta, behavior: 'smooth' });
      });
    });
  });

  container.querySelectorAll('.movie-card').forEach(attachCardBehaviour);
}

/**
 * Fetches a set of row definitions from TMDB and renders them into the grid.
 *
 * @param {Array<{title: string, path: string, params?: object, type?: string}>} rows
 */
export async function renderFeed(rows) {
  const container = document.getElementById('rowsContainer');
  if (!container) return;

  if (!hasApiKey()) {
    container.innerHTML = apiKeyNoticeTemplate();
    document.getElementById('retryButton')?.addEventListener('click', () => renderFeed(rows));
    return;
  }

  const seq = ++feedSeq; // ignore this response if the user switches feeds again

  // Skeleton rows while the requests are in flight
  container.innerHTML = rows.map(loadingRowTemplate).join('');

  const settled = await Promise.allSettled(
    rows.map((config) => tmdbFetch(config.path, config.params))
  );
  if (seq !== feedSeq) return; // a newer feed took over

  const loadedRows = [];
  const failures = [];

  settled.forEach((result, index) => {
    const config = rows[index];
    if (result.status === 'fulfilled') {
      const movies = (result.value.results || []).map((item) =>
        normalizeItem(item, config.type || 'movie')
      );
      if (movies.length) loadedRows.push({ title: config.title, movies });
    } else {
      console.error(`[TMDB] ${config.title} failed:`, result.reason);
      failures.push(result.reason);
    }
  });

  if (!loadedRows.length) {
    container.innerHTML = errorTemplate(
      failures[0]?.message || 'No rows could be loaded from TMDB.'
    );
    document.getElementById('retryButton')?.addEventListener('click', () => renderFeed(rows));
    return;
  }

  container.innerHTML = loadedRows.map(rowTemplate).join('');

  // Surface partial failures beneath the successfully loaded rows
  if (failures.length) {
    container.insertAdjacentHTML(
      'beforeend',
      `<p class="px-6 text-center text-xs text-gray-500">
         ${failures.length} row(s) failed to load: ${escapeHtml(failures[0].message)}
       </p>`
    );
  }

  wireRowBehaviour(container);
  revealRowsOnScroll();
}

/** IntersectionObserver fade-in for each category row. */
function revealRowsOnScroll() {
  const rowsEls = document.querySelectorAll('.row-reveal');
  if (!('IntersectionObserver' in window)) {
    rowsEls.forEach((el) => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  rowsEls.forEach((el) => observer.observe(el));
}

/* ------------------------------ NAV FEEDS -------------------------------- */

/** Small transient toast used for empty states and demo actions. */
let toastTimer = null;
export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('opacity-0', 'translate-y-4');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('opacity-0', 'translate-y-4'), 3200);
}

/** Marks the matching navbar link(s) as active (desktop + mobile copies). */
function setActiveNav(feed) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    const active = link.dataset.nav === feed;
    link.classList.toggle('font-semibold', active);
    link.classList.toggle('text-white', active);
    link.classList.toggle('text-gray-200', !active);
  });
}

/** "My List" → smooth-scroll to the bookmark row (or nudge when it's empty). */
function scrollToMyList() {
  const section = document.getElementById('myListSection');
  if (!section || section.classList.contains('is-empty')) {
    showToast('Your list is empty — tap + on any title to save it here.');
    return;
  }
  section.classList.add('visible');
  section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Switches the main grid to one of the navbar feeds.
 * 'home' re-renders the default rows (clearing any filters),
 * 'tv' / 'movies' / 'new' fetch their own TMDB row sets,
 * 'list' scrolls to the bookmarked row.
 *
 * @param {string} feed — 'home' | 'tv' | 'movies' | 'new' | 'list'
 */
export async function switchFeed(feed) {
  if (feed === 'list') {
    setActiveNav('list');
    scrollToMyList();
    return;
  }

  const rows = FEEDS[feed];
  if (!rows) return;

  const isSameFeed = feed === activeFeed;
  activeFeed = feed;
  setActiveNav(feed);
  resetSearchFn?.(); // clear an active search so home content is unfiltered

  if (isSameFeed) {
    // Already showing this feed — just bring the grid back into view
    document.getElementById('rowsContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  await renderFeed(rows);
}

/* --------------------------------- HERO ---------------------------------- */

/**
 * Hero: pulls live trending movies, enriches them with runtime/genre details
 * and rotates through them. The static HTML hero stays visible on failure.
 */
export async function initHero() {
  if (!hasApiKey()) return;

  const title = document.getElementById('heroTitle');
  const description = document.getElementById('heroDescription');
  const year = document.getElementById('heroYear');
  const duration = document.getElementById('heroDuration');
  const match = document.getElementById('heroMatch');
  const image = document.getElementById('heroImage');
  const eyebrow = document.getElementById('heroEyebrow');
  if (!title || !image) return;

  try {
    const data = await fetchTrendingMovies();
    const picks = (data.results || [])
      .filter((m) => m.backdrop_path)
      .slice(0, 3)
      .map(normalizeMovie);

    if (!picks.length) return;

    // Enrich each pick with runtime + full genre names from the details endpoint
    const featured = await Promise.all(
      picks.map(async (movie) => {
        try {
          const details = await fetchMovieDetails(movie.id);
          return {
            ...movie,
            duration: formatRuntime(details.runtime),
            genres: details.genres.map((g) => g.name),
          };
        } catch {
          return movie;
        }
      })
    );

    let index = 0;
    const apply = (movie) => {
      heroMovie = movie; // remembered for the hero "Play" / "More Info" buttons
      syncListButtons(); // …and to keep the hero My List icon in sync
      title.textContent = movie.title;
      description.textContent = movie.description;
      year.textContent = movie.year;
      duration.textContent = movie.duration;
      match.textContent = `${movie.match}% Match`;
      eyebrow.textContent = movie.genres.slice(0, 2).join(' • ') || 'Featured';

      image.onerror = () => {
        image.onerror = null;
        image.src = FALLBACK_BACKDROP;
      };
      image.src = movie.backdrop;

      title.classList.remove('animate-fade-in-up');
      void title.offsetWidth; // restart the animation
      title.classList.add('animate-fade-in-up');
    };

    apply(featured[0]);
    if (featured.length > 1) {
      setInterval(() => {
        index = (index + 1) % featured.length;
        apply(featured[index]);
      }, 9000);
    }
  } catch (error) {
    console.error('[TMDB] Hero failed to load:', error);
  }
}

/* ------------------------------ LIVE SEARCH ----------------------------- */

/** Fades an element out, then hides it. */
function fadeOut(el) {
  if (!el || el.classList.contains('hidden')) return Promise.resolve();
  el.classList.add('content-exit');
  return new Promise((resolve) =>
    setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('content-exit');
      resolve();
    }, 280)
  );
}

/** Un-hides an element and fades it back in. */
function fadeIn(el) {
  if (!el || !el.classList.contains('hidden')) return;
  el.classList.remove('hidden');
  el.classList.add('content-exit');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => el.classList.remove('content-exit'))
  );
}

/**
 * Navbar live search.
 * - The magnifier icon expands into an input (#searchBox / .search-open).
 * - Typing (debounced) hits TMDB's /search/movie endpoint.
 * - A non-empty query hides the home hero + genre rows and shows a
 *   "Search Results" row; clearing the query transitions back to home.
 */
export function initSearch() {
  const box = document.getElementById('searchBox');
  const toggle = document.getElementById('searchToggle');
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  const searchSection = document.getElementById('searchSection');
  const searchRows = document.getElementById('searchRowsContainer');
  const homeContent = [
    document.getElementById('hero'),
    document.getElementById('myListSection'),
    document.getElementById('rowsContainer'),
  ].filter(Boolean);

  if (!box || !input || !searchSection || !searchRows) return;

  const DEBOUNCE_MS = 320;
  let debounceTimer = null;
  let requestSeq = 0; // guards against out-of-order responses
  let mode = 'home'; // 'home' | 'search'

  const query = () => input.value.trim();

  /* --------------------------- mode switching --------------------------- */

  function enterSearchMode() {
    if (mode === 'search') return;
    mode = 'search';
    homeContent.forEach(fadeOut);
    fadeIn(searchSection);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exitSearchMode() {
    if (mode === 'home') return;
    mode = 'home';
    requestSeq++; // drop any in-flight search responses
    clearTimeout(debounceTimer);
    fadeOut(searchSection).then(() => {
      // Clear the results once the fade finishes, unless a new search began
      if (mode === 'home' && !query()) searchRows.innerHTML = '';
    });
    homeContent.forEach(fadeIn);
  }

  /* ------------------------------ searching ----------------------------- */

  async function runSearch(q) {
    const seq = ++requestSeq;
    searchRows.innerHTML = loadingRowTemplate({ title: 'Search Results' });

    try {
      const data = await fetchSearch(q);
      if (seq !== requestSeq) return; // stale — a newer query replaced this one
      renderSearchResults(q, (data.results || []).map(normalizeMovie));
    } catch (error) {
      if (seq !== requestSeq) return;
      console.error('[TMDB] Search failed:', error);
      searchRows.innerHTML = `
        <div class="px-4 py-10 text-center sm:px-6 lg:px-12">
          <p class="text-base font-semibold text-white">Search failed</p>
          <p class="mt-1 text-sm text-gray-400">${escapeHtml(error.message)}</p>
        </div>`;
    }
  }

  function renderSearchResults(q, movies) {
    if (!movies.length) {
      searchRows.innerHTML = `
        <div class="px-4 py-10 sm:px-6 lg:px-12">
          <p class="text-lg font-semibold text-white">No results for “${escapeHtml(q)}”</p>
          <p class="mt-1 text-sm text-gray-400">Try different keywords, titles or genres.</p>
        </div>`;
      return;
    }

    searchRows.innerHTML = rowTemplate({ title: 'Search Results', movies }, 0);
    // The row lives inside a section that starts hidden, so reveal it directly
    // instead of waiting on the IntersectionObserver.
    searchRows.querySelector('.row-reveal')?.classList.add('visible');
    wireRowBehaviour(searchRows);
  }

  /* ---------------------------- input events ---------------------------- */

  input.addEventListener('input', () => {
    box.classList.toggle('has-value', query().length > 0);
    clearTimeout(debounceTimer);

    const q = query();
    if (!q) {
      requestSeq++; // cancel in-flight results
      exitSearchMode();
      return;
    }
    enterSearchMode();
    debounceTimer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSearch(true);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      if (query()) runSearch(query());
    }
  });

  input.addEventListener('blur', () => {
    if (!query()) closeSearchBox();
  });

  function clearSearch(collapseBox) {
    input.value = '';
    box.classList.remove('has-value');
    requestSeq++;
    clearTimeout(debounceTimer);
    exitSearchMode();
    if (collapseBox) {
      closeSearchBox();
      toggle.focus();
    } else {
      input.focus();
    }
  }

  clearBtn.addEventListener('click', () => clearSearch(false));

  /**
   * Fully resets the search (query, box and results). Exposed to the navbar
   * so switching feeds while a search is active returns to the home grid.
   */
  function resetSearch() {
    input.value = '';
    box.classList.remove('has-value');
    requestSeq++;
    clearTimeout(debounceTimer);
    exitSearchMode();
  }
  resetSearchFn = resetSearch;

  /* --------------------------- expand / collapse ------------------------ */

  function openSearchBox() {
    box.classList.add('search-open');
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();
  }

  function closeSearchBox() {
    box.classList.remove('search-open');
    toggle.setAttribute('aria-expanded', 'false');
    input.blur();
  }

  toggle.addEventListener('click', () => {
    // Toggling collapses the box; any active results stay on screen
    if (box.classList.contains('search-open')) closeSearchBox();
    else openSearchBox();
  });

  // Clicking anywhere outside a collapsed, empty search box closes it
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && !query() && box.classList.contains('search-open')) {
      closeSearchBox();
    }
  });
}

/* --------------------- DETAILED INFO OVERLAY ---------------------------- */

/** A single styled genre pill badge. */
const genrePill = (name) =>
  `<span class="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-gray-200 transition hover:border-netflix-red/60 hover:text-white">${escapeHtml(name)}</span>`;

/**
 * Maps a raw TMDB details payload onto the overlay's DOM.
 * Handles both `/movie/{id}` and `/tv/{id}` responses (TV uses `name`,
 * `first_air_date`, `episode_run_time` and `original_name`).
 */
function renderDetails(details, mediaType = 'movie') {
  const img = document.getElementById('modalImage');
  const title = details.title || details.name || 'Untitled';
  const date = details.release_date || details.first_air_date || '';
  const runtime = details.runtime || (details.episode_run_time || [])[0];

  // Background backdrop image panel
  img.src = imageUrl(details.backdrop_path, TMDB_BACKDROP_BASE, FALLBACK_BACKDROP);
  img.alt = `${title} backdrop`;

  // Title + tagline (italic, hidden when TMDB has none)
  document.getElementById('modalTitle').textContent = title;
  const tagline = document.getElementById('modalTagline');
  tagline.textContent = details.tagline ? `“${details.tagline}”` : '';
  tagline.classList.toggle('hidden', !details.tagline);

  // Meta row: year, runtime, percentage match
  document.getElementById('modalMatch').textContent = `${clampMatch(details.vote_average)}% Match`;
  document.getElementById('modalYear').textContent = date ? date.slice(0, 4) : '—';
  document.getElementById('modalDuration').textContent = formatRuntime(runtime); // 134 → "2h 14m"

  // Genre pill badges
  document.getElementById('modalGenres').innerHTML = (details.genres || [])
    .map((genre) => genrePill(genre.name))
    .join('');

  // Full plot description
  document.getElementById('modalOverview').textContent = details.overview || 'No synopsis available for this title.';

  // Snapshot shaped like a card, so the overlay's My List button can toggle it
  currentDetailMovieData = normalizeItem(
    {
      id: details.id,
      title: details.title,
      name: details.name,
      adult: details.adult,
      overview: details.overview,
      release_date: details.release_date,
      first_air_date: details.first_air_date,
      vote_average: details.vote_average,
      genre_ids: (details.genres || []).map((genre) => genre.id),
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
    },
    mediaType
  );
  syncListButtons();

  // Facts column
  document.getElementById('modalStatus').textContent = details.status || '—';
  document.getElementById('modalLanguage').textContent = details.original_language || '—';
  document.getElementById('modalOriginalTitle').textContent =
    details.original_title || details.original_name || '—';
  document.getElementById('modalReleaseDate').textContent = date || '—';
}

/** Instantly fills the overlay from the cached card data (shown pre-fetch). */
function renderDetailsFromCache(movie) {
  document.getElementById('modalTitle').textContent = movie.title;
  document.getElementById('modalTagline').textContent = '';
  document.getElementById('modalTagline').classList.add('hidden');
  document.getElementById('modalMatch').textContent = `${movie.match}% Match`;
  document.getElementById('modalYear').textContent = movie.year;
  document.getElementById('modalDuration').textContent = movie.duration;
  document.getElementById('modalGenres').innerHTML = movie.genres.map(genrePill).join('');
  document.getElementById('modalOverview').textContent = movie.description;

  const img = document.getElementById('modalImage');
  img.src = movie.backdrop;
  img.alt = `${movie.title} backdrop`;
}

/**
 * Opens the detailed movie/TV info overlay.
 * Fetches the full payload from TMDB's `/movie/${movieId}` (or `/tv/${movieId}`)
 * endpoint and maps title, tagline, year, runtime, % match, genre pills and
 * overview into view.
 *
 * @param {number|string} movieId   — TMDB id
 * @param {string}        mediaType — 'movie' | 'tv'
 */
async function openDetailsModal(movieId, mediaType = 'movie') {
  const modal = document.getElementById('detailModal');
  if (!modal || !hasApiKey()) return;

  const id = Number(movieId);
  if (!id) return;
  currentDetailMovieId = id;
  currentDetailMediaType = mediaType;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';

  // Paint cached card data immediately while the request is in flight
  const cached = getStoredItem(id, mediaType);
  if (cached) renderDetailsFromCache(cached);

  try {
    const details = await fetchDetails(id, mediaType);

    // Ignore stale responses: overlay closed or a different movie opened
    if (currentDetailMovieId !== id || modal.classList.contains('hidden')) return;
    renderDetails(details, mediaType);
  } catch (error) {
    console.error('[TMDB] Failed to load details:', error);
    if (currentDetailMovieId === id && !modal.classList.contains('hidden')) {
      document.getElementById('modalOverview').textContent =
        'Could not load details for this title. Please try again.';
    }
  }
}

/** Resets every field of the overlay so nothing stale flashes on next open. */
function resetDetailsModal() {
  ['modalTitle', 'modalMatch', 'modalYear', 'modalDuration', 'modalOverview',
   'modalStatus', 'modalLanguage', 'modalOriginalTitle', 'modalReleaseDate'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });

  const tagline = document.getElementById('modalTagline');
  tagline.textContent = '';
  tagline.classList.add('hidden');
  document.getElementById('modalGenres').innerHTML = '';

  const img = document.getElementById('modalImage');
  img.onerror = null;
  img.removeAttribute('src');
  img.onerror = () => {
    img.onerror = null;
    img.src = FALLBACK_BACKDROP;
  };
}

/** Safely hides the details overlay without touching any other UI state. */
function closeDetailsModal() {
  const modal = document.getElementById('detailModal');
  if (!modal || modal.classList.contains('hidden')) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  currentDetailMovieId = null;
  currentDetailMovieData = null;
  resetDetailsModal();

  // Only release the scroll lock if nothing else (e.g. the trailer) is open
  const trailer = document.getElementById('trailerModal');
  if (!trailer || trailer.classList.contains('hidden')) {
    document.body.style.overflow = '';
  }
}

/** Wires the details overlay: X button, backdrop click, Esc, Play handoff. */
export function initDetailsModal() {
  const modal = document.getElementById('detailModal');
  const closeBtn = document.getElementById('modalClose');
  const playBtn = document.getElementById('modalPlayBtn');
  if (!modal) return;

  const img = document.getElementById('modalImage');
  img.onerror = () => {
    img.onerror = null;
    img.src = FALLBACK_BACKDROP;
  };

  // 'X' closes and resets the overlay
  closeBtn?.addEventListener('click', closeDetailsModal);

  // Clicking the dark backdrop closes it
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDetailsModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeDetailsModal();
  });

  // "Play" inside the overlay hands off to the trailer player
  playBtn?.addEventListener('click', () => {
    const id = currentDetailMovieId;
    const type = currentDetailMediaType;
    closeDetailsModal();
    if (id) openModal(id, type);
  });
}

/* --------------------------- TRAILER MODAL ------------------------------ */

/**
 * Opens the trailer popup for a movie or TV show.
 * Fetches `/movie/${movieId}/videos` (or `/tv/${movieId}/videos`), picks the
 * first YouTube "Trailer" and loads it into the iframe with autoplay enabled.
 *
 * @param {number|string} movieId   — TMDB id
 * @param {string}        mediaType — 'movie' | 'tv'
 */
async function openModal(movieId, mediaType = 'movie') {
  const modal = document.getElementById('trailerModal');
  const frame = document.getElementById('trailerFrame');
  const status = document.getElementById('trailerStatus');
  const statusText = document.getElementById('trailerStatusText');
  const title = document.getElementById('trailerTitle');
  if (!modal || !frame) return;

  const movie = getStoredItem(Number(movieId), mediaType);

  // Show the overlay immediately with a loading state
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  frame.src = '';
  title.textContent = movie ? movie.title : '';
  statusText.textContent = 'Loading trailer…';
  status.classList.remove('hidden');
  status.classList.add('grid');

  try {
    const data = await fetchVideos(movieId, mediaType);

    // The user may have closed the modal while the request was in flight
    if (modal.classList.contains('hidden')) return;

    // Filter for a YouTube trailer
    const trailer = (data.results || []).find(
      (video) => video.type === 'Trailer' && video.site === 'YouTube'
    );

    if (trailer && trailer.key) {
      status.classList.add('hidden');
      status.classList.remove('grid');
      title.textContent = movie ? `${movie.title} — Official Trailer` : 'Official Trailer';
      frame.src = `${YOUTUBE_EMBED_BASE}${trailer.key}?autoplay=1`;
    } else {
      title.textContent = movie ? movie.title : '';
      statusText.textContent = 'No trailer available for this title.';
      frame.src = '';
    }
  } catch (error) {
    console.error('[TMDB] Failed to load trailer:', error);
    if (!modal.classList.contains('hidden')) {
      statusText.textContent = 'Could not load the trailer. Please try again.';
      frame.src = '';
    }
  }
}

/** Closes the trailer popup and stops playback by clearing the iframe src. */
function closeModal() {
  const modal = document.getElementById('trailerModal');
  const frame = document.getElementById('trailerFrame');
  if (!modal || !frame) return;

  frame.src = ''; // removes the source URL so audio stops immediately
  modal.classList.add('hidden');
  modal.classList.remove('flex');

  // Only release the scroll lock if the details overlay isn't also open
  const details = document.getElementById('detailModal');
  if (!details || details.classList.contains('hidden')) {
    document.body.style.overflow = '';
  }
}

/** Wires the trailer modal: hero Play, More Info, close button, backdrop, Esc. */
export function initTrailerModal() {
  const modal = document.getElementById('trailerModal');
  const closeBtn = document.getElementById('trailerClose');
  const heroPlayBtn = document.getElementById('heroPlayBtn');
  const heroInfoBtn = document.getElementById('heroInfoBtn');
  if (!modal) return;

  // 'X' button closes the player
  closeBtn?.addEventListener('click', closeModal);

  // Clicking the dark backdrop overlay closes the player
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  // Hero "Play" → featured movie's trailer, falling back to the default ID
  heroPlayBtn?.addEventListener('click', () => openModal(heroMovie?.id ?? DEFAULT_MOVIE_ID));

  // Hero "More Info" → detailed movie info overlay
  heroInfoBtn?.addEventListener('click', () => {
    openDetailsModal(heroMovie?.id ?? DEFAULT_MOVIE_ID);
  });
}

/* -------------------------------- MY LIST ------------------------------- */

/**
 * @param {number} movieId
 * @param {string} [mediaType] — 'movie' | 'tv' (older saved items default to movie)
 * @returns {boolean} whether that exact title is bookmarked
 */
export function isInMyList(movieId, mediaType = 'movie') {
  return myList.some(
    (m) => m.id === movieId && (m.mediaType || 'movie') === mediaType
  );
}

/**
 * Adds/removes a movie from My List, persists the array to local storage and
 * refreshes every My List UI surface (row, card icons, hero + modal buttons).
 *
 * @param {{id: number, mediaType?: string}} movie
 */
export function toggleMyList(movie) {
  if (!movie || !movie.id) return;

  const type = movie.mediaType || 'movie';
  const index = myList.findIndex(
    (m) => m.id === movie.id && (m.mediaType || 'movie') === type
  );
  if (index > -1) {
    myList.splice(index, 1);          // already bookmarked → remove it
  } else {
    myList.push(movie);               // not bookmarked → push it
  }

  // Persist on every change
  localStorage.setItem(MY_LIST_STORAGE_KEY, JSON.stringify(myList));

  refreshMyListUI();
}

/** Syncs every "+" / "✓" toggle on the page with the current list. */
function syncListButtons() {
  // Movie cards (all rows, including search results)
  document.querySelectorAll('.movie-card').forEach((card) => {
    const btn = card.querySelector('[data-action="list"]');
    if (!btn) return;
    const active = isInMyList(
      Number(card.dataset.movieId),
      card.dataset.mediaType || 'movie'
    );
    btn.innerHTML = active ? ICON_CHECK : ICON_PLUS;
    btn.setAttribute('aria-label', active ? 'Remove from My List' : 'Add to My List');
  });

  // Hero "My List" button
  const heroIcon = document.getElementById('heroListIcon');
  const heroBtn = document.getElementById('heroListBtn');
  const heroActive = Boolean(
    heroMovie && isInMyList(heroMovie.id, heroMovie.mediaType || 'movie')
  );
  if (heroIcon) heroIcon.innerHTML = heroActive ? ICON_CHECK : ICON_PLUS;
  heroBtn?.setAttribute('aria-label', heroActive ? 'Remove from My List' : 'Add to My List');

  // Details overlay "My List" button
  const modalIcon = document.getElementById('modalListIcon');
  const modalActive = Boolean(
    currentDetailMovieData &&
      isInMyList(currentDetailMovieData.id, currentDetailMovieData.mediaType || 'movie')
  );
  if (modalIcon) modalIcon.innerHTML = modalActive ? ICON_CHECK : ICON_PLUS;
}

/**
 * Re-renders the "My List" row with the bookmarked cards and toggles its
 * visibility: the row is hidden entirely when the list is empty.
 */
function refreshMyListUI() {
  const section = document.getElementById('myListSection');
  const strip = document.getElementById('myListStrip');
  if (!section || !strip) return;

  const hasItems = myList.length > 0;
  section.classList.toggle('is-empty', !hasItems);

  if (hasItems) {
    section.classList.add('visible'); // don't wait on the scroll observer
    strip.innerHTML = myList.map(cardTemplate).join('');
    strip.querySelectorAll('.movie-card').forEach(attachCardBehaviour);
  } else {
    strip.innerHTML = '';
  }

  syncListButtons();
}

/** Initial wiring: hero button, overlay button, row arrows, first paint. */
export function initMyList() {
  const section = document.getElementById('myListSection');
  if (section) wireRowBehaviour(section); // arrows only — no cards yet

  // Hero "My List" button
  document.getElementById('heroListBtn')?.addEventListener('click', () => {
    if (heroMovie) toggleMyList(heroMovie);
  });

  // Details overlay "My List" button
  document.getElementById('modalListBtn')?.addEventListener('click', () => {
    if (currentDetailMovieData) toggleMyList(currentDetailMovieData);
  });

  refreshMyListUI();
}