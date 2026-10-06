/* ============================================================================
 * config.example.js — TEMPLATE for personal configuration.
 * ---------------------------------------------------------------------------
 * Copy this file to `config.js`, then paste your TMDB v3 API key inside.
 * `config.js` is git-ignored so your real key is never uploaded to GitHub.
 *
 *   cp config.example.js config.js
 * ==========================================================================*/

/** Your TMDB v3 API key. Shared by every request in api.js. */
export const TMDB_API_KEY = "YOUR_API_KEY_HERE";

/** TMDB v3 REST base URL. */
export const TMDB_API_BASE = 'https://api.themoviedb.org/3';

/** TMDB poster size base URL — append the movie's `poster_path`. */
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500/';
/** TMDB backdrop size base URL — append the movie's `backdrop_path`. */
export const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/original/';

/** Placeholder images used when a poster/backdrop is missing or fails to load. */
export const FALLBACK_POSTER = 'https://placehold.co/400x600/1f1f1f/E50914?text=No+Poster';
export const FALLBACK_BACKDROP = 'https://placehold.co/1280x720/181818/E50914?text=No+Image';

/**
 * YouTube embed base URL. The `/embed/` path is required — `https://youtube.com{key}`
 * is not a playable address, so the iframe source is built as
 * `YOUTUBE_EMBED_BASE + key + '?autoplay=1'`.
 */
export const YOUTUBE_EMBED_BASE = 'https://www.youtube.com/embed/';

/** Default movie ID for the hero "Play" button (Fight Club). */
export const DEFAULT_MOVIE_ID = 550;

/** localStorage key used to persist the user's bookmarked titles. */
export const MY_LIST_STORAGE_KEY = 'netflixMyList';

/** TMDB genre id → name (list endpoints return `genre_ids`, not objects). */
export const GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};