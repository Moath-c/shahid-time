/* ============================================================================
 * app.js — application entry point.
 * ---------------------------------------------------------------------------
 * Wires the UI modules together: sets up the DOMContentLoaded bootstrap,
 * renders the default layout rows, binds the navbar links and profile
 * dropdown, and initialises the search / trailer / details / My List
 * features. No business logic lives here — it only connects the dots.
 * ==========================================================================*/

import { FEEDS } from './api.js';
import {
  renderFeed,
  switchFeed,
  showToast,
  initDetailsModal,
  initSearch,
  initTrailerModal,
  initMyList,
  initHero,
} from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initDetailsModal();
  initSearch();
  initTrailerModal();
  initMyList();

  // Default home rows, then the live hero banner
  renderFeed(FEEDS.home);
  initHero();
});

/**
 * Navbar wiring: scroll state, mobile menu, feed links and the profile
 * dropdown menu (nav *helpers* like switchFeed/setActiveNav live in ui.js).
 */
function initNavbar() {
  // Transparent at the top, solid after scrolling past the hero
  const navbar = document.getElementById('navbar');
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu (hamburger) toggle + close-on-navigate
  const menuBtn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');
  menuBtn?.addEventListener('click', () => menu.classList.toggle('hidden'));

  // Navigation links (desktop + mobile) drive the feed
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchFeed(link.dataset.nav);
      menu?.classList.add('hidden'); // close the mobile menu after navigating
    });
  });

  initProfileDropdown();
}

/** Profile icon → small floating dropdown; closes on outside click / Escape. */
function initProfileDropdown() {
  const profileBtn = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');
  if (!profileBtn || !profileMenu) return;

  const closeProfileMenu = () => {
    profileMenu.classList.remove('open');
    profileBtn.setAttribute('aria-expanded', 'false');
  };

  // Toggle the floating menu directly beneath the profile icon
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !profileMenu.classList.contains('open');
    profileMenu.classList.toggle('open', willOpen);
    profileBtn.setAttribute('aria-expanded', String(willOpen));
  });

  // Clicking anywhere else on the window closes it
  document.addEventListener('click', (e) => {
    if (profileMenu.contains(e.target) || profileBtn.contains(e.target)) return;
    closeProfileMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfileMenu();
  });

  // Dropdown items are demo links: acknowledge + close
  profileMenu.querySelectorAll('[data-profile-action]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      closeProfileMenu();
      showToast(`${item.textContent.trim()} isn’t wired up in this template.`);
    });
  });
}