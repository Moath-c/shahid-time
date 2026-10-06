/* ============================================================================
 * api.js — the TMDB v3 client.
 * ---------------------------------------------------------------------------
 * Every async network call lives here: generic `tmdbFetch`, the named
 * convenience fetchers (trending, top rated, action, details, videos, search)
 * and the row definitions powering the homepage + navbar feeds.
 * Nothing in this module touches the DOM.
 * ==========================================================================*/

import { TMDB_API_KEY, TMDB_API_BASE } from './config.js';

/** True once a real API key has been pasted into config.js. */
export const hasApiKey = () =>
  Boolean(TMDB_API_KEY) && TMDB_API_KEY !== 'YOUR_API_KEY_HERE';

/**
 * Generic async GET against a TMDB v3 endpoint. Throws on non-2xx responses.
 *
 * @param {string} path   — TMDB endpoint path, e.g. '/trending/movie/week'
 * @param {object} params — extra query params merged onto the request
 */
export async function tmdbFetch(path, params = {}) {
  const url = new URL(TMDB_API_BASE + path);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/* ------------------------ Convenience fetchers --------------------------- */

/** 1. Trending Movies — /trending/movie/week */
export const fetchTrendingMovies = () => tmdbFetch('/trending/movie/week', { page: 1 });

/** 2. Top Rated — /movie/top_rated */
export const fetchTopRatedMovies = () => tmdbFetch('/movie/top_rated', { page: 1 });

/** 3. Action — /discover/movie filtered to the Action genre (28). */
export const fetchActionMovies = () =>
  tmdbFetch('/discover/movie', {
    with_genres: '28',
    sort_by: 'popularity.desc',
    include_adult: 'false',
    page: 1,
  });

/** Full details for a single movie (runtime, genres) — used by the hero. */
export const fetchMovieDetails = (id) => tmdbFetch(`/movie/${id}`);

/** Details for either media type: `/movie/{id}` or `/tv/{id}`. */
export const fetchDetails = (id, mediaType = 'movie') =>
  tmdbFetch(mediaType === 'tv' ? `/tv/${id}` : `/movie/${id}`);

/** Videos for either media type: `/movie/{id}/videos` or `/tv/{id}/videos`. */
export const fetchVideos = (id, mediaType = 'movie') =>
  tmdbFetch(mediaType === 'tv' ? `/tv/${id}/videos` : `/movie/${id}/videos`, { language: 'en-US' });

/** Movie search used by the navbar's live search box. */
export const fetchSearch = (query, extraParams = {}) =>
  tmdbFetch('/search/movie', {
    query,
    include_adult: 'false',
    page: 1,
    ...extraParams,
  });

/* ------------------------------ Row configs ------------------------------ */

/**
 * Category rows: title + TMDB v3 endpoint + query params.
 * Required rows: Trending Movies, Top Rated, Action (discover by genre 28).
 */
export const ROW_CONFIG = [
  { title: 'Trending Now',        path: '/trending/movie/week', params: { page: 1 } },
  { title: 'Top Rated',           path: '/movie/top_rated',     params: { page: 1 } },
  { title: 'Action Thrillers',    path: '/discover/movie',      params: { with_genres: '28', sort_by: 'popularity.desc', include_adult: 'false', page: 1 } },
  { title: 'Sci-Fi Hits',         path: '/discover/movie',      params: { with_genres: '878', sort_by: 'popularity.desc', include_adult: 'false', page: 1 } },
  { title: 'New Releases',        path: '/movie/now_playing',   params: { page: 1 } },
];

/**
 * Row definitions for every navbar feed, keyed by the link's `data-nav` value.
 * `type` tells the normaliser how to interpret each payload ('tv' results use
 * `name` / `first_air_date`, trending results carry their own `media_type`).
 */
export const FEEDS = {
  // Home → the default movie rows above
  home: ROW_CONFIG,

  // TV Shows → only TV data
  tv: [
    { title: 'Popular TV Shows',   path: '/discover/tv',    params: { sort_by: 'popularity.desc', page: 1 }, type: 'tv' },
    { title: 'Top Rated TV Shows', path: '/discover/tv',    params: { sort_by: 'vote_average.desc', 'vote_count.gte': '200', page: 1 }, type: 'tv' },
    { title: 'Airing Tonight',     path: '/tv/airing_today', params: { page: 1 }, type: 'tv' },
    { title: 'Drama Series',       path: '/discover/tv',    params: { with_genres: '18', sort_by: 'popularity.desc', page: 1 }, type: 'tv' },
    { title: 'Comedy Series',      path: '/discover/tv',    params: { with_genres: '35', sort_by: 'popularity.desc', page: 1 }, type: 'tv' },
  ],

  // Movies → only movie data
  movies: [
    { title: 'Popular Movies',     path: '/discover/movie', params: { sort_by: 'popularity.desc', include_adult: 'false', page: 1 } },
    { title: 'Top Rated Movies',   path: '/movie/top_rated', params: { page: 1 } },
    { title: 'Now Playing',        path: '/movie/now_playing', params: { page: 1 } },
    { title: 'Action Thrillers',   path: '/discover/movie', params: { with_genres: '28', sort_by: 'popularity.desc', include_adult: 'false', page: 1 } },
    { title: 'Comedy Favourites',  path: '/discover/movie', params: { with_genres: '35', sort_by: 'popularity.desc', include_adult: 'false', page: 1 } },
  ],

  // New & Popular → upcoming movies + popular shows
  new: [
    { title: 'Upcoming Movies',    path: '/movie/upcoming', params: { page: 1 } },
    { title: 'Popular TV Shows',   path: '/tv/popular',     params: { page: 1 }, type: 'tv' },
    { title: 'Trending This Week', path: '/trending/all/week', params: { page: 1 }, type: 'all' },
  ],
};