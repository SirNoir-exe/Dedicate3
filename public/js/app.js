// Shared helpers used by every page: session, API calls, header/footer, small UI utilities.
// Plain script (no modules) so the site also works on the simplest static hosts.
(function () {
  const cfg = window.APP_CONFIG || {};
  // Empty (the default) means "same address as this page", which is what you want when the
  // backend serves the site. Set a full address in config.js only if the API lives elsewhere.
  const API_URL = String(cfg.API_URL == null ? '' : cfg.API_URL).replace(/\/+$/, '');
  const SCHOOL = cfg.SCHOOL_NAME || 'Our School';
  const SESSION_KEY = 'dedications.session';

  /* ---------- Session ---------- */
  let memorySession = null; // fallback when localStorage is blocked (private mode)

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : memorySession;
    } catch {
      return memorySession;
    }
  }
  function setSession(session) {
    memorySession = session;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }
  function clearSession() {
    memorySession = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  function getUser() {
    const s = getSession();
    return s && s.user ? s.user : null;
  }

  // Only allow redirects to our own simple pages (blocks open-redirect tricks).
  function safeNext(value) {
    return /^[a-z0-9-]+\.html(\?[\w=&%-]*)?$/i.test(value || '') ? value : 'index.html';
  }
  function currentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }
  function goToLogin() {
    location.replace('login.html?next=' + encodeURIComponent(currentPage() + location.search));
  }
  // Call at the top of pages that need a logged-in user. Returns the user, or redirects.
  function requireLogin() {
    const s = getSession();
    if (!s || !s.token) {
      goToLogin();
      return null;
    }
    return s.user;
  }

  /* ---------- API ---------- */
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    const session = getSession();
    if (auth && session && session.token) headers.Authorization = 'Bearer ' + session.token;

    let res;
    try {
      res = await fetch(API_URL + '/api' + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      if (location.protocol === 'file:') {
        throw new ApiError('This page was opened as a file. Start the server and open the site at http://localhost:4000 instead.', 0);
      }
      throw new ApiError('Could not reach the server at ' + (API_URL || location.origin) + '. Make sure it is running, then try again.', 0);
    }

    let data = null;
    if (res.status !== 204) {
      try {
        data = await res.json();
      } catch {
        /* non-JSON response */
      }
    }

    if (!res.ok) {
      if (res.status === 401 && auth) {
        clearSession();
        goToLogin();
      }
      throw new ApiError((data && data.error) || 'Something went wrong. Try again.', res.status);
    }
    return data;
  }

  /* ---------- DOM helpers (build elements safely, never from raw HTML) ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function toast(message, type) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' });
      document.body.append(box);
    }
    const t = h('div', { class: 'toast' + (type === 'error' ? ' toast-error' : ''), text: message });
    box.append(t);
    setTimeout(() => t.remove(), 4500);
  }

  function setBusy(button, busy, busyText) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = busyText || 'Please wait…';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  /* ---------- Dates ---------- */
  function todayISO() {
    // en-CA gives YYYY-MM-DD in the viewer's local time zone.
    return new Date().toLocaleDateString('en-CA');
  }
  function formatDay(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  function formatStamp(sqlUtc) {
    // The API returns UTC like "2026-11-05 13:00:00".
    const d = new Date(String(sqlUtc).replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  const STATUS_LABELS = {
    pending: 'Pending',
    played: 'Played',
    belated: 'Belated',
    cancelled: 'Cancelled',
  };
  function badge(status) {
    return h('span', { class: 'badge badge-' + status, text: STATUS_LABELS[status] || status });
  }

  /* ---------- Header & footer (edit once, shows on every page) ---------- */
  function buildHeader() {
    const user = getUser();
    const page = currentPage();
    const link = (href, text) =>
      h('a', { href, class: 'nav-link', 'aria-current': page === href ? 'page' : null, text });

    const nav = h('nav', { class: 'nav', 'aria-label': 'Main' });
    if (user) {
      nav.append(link('dedicate.html', 'New dedication'), link('mine.html', 'My dedications'));
      if (user.role === 'staff') nav.append(link('admin.html', 'Staff panel'));
      nav.append(
        h('button', {
          type: 'button',
          class: 'nav-link nav-button',
          text: 'Log out',
          onclick() {
            clearSession();
            location.href = 'index.html';
          },
        })
      );
    } else {
      nav.append(link('login.html', 'Log in'), h('a', { href: 'signup.html', class: 'btn btn-primary btn-small', text: 'Sign up' }));
    }

    return h(
      'header',
      { class: 'site-header' },
      h(
        'div',
        { class: 'wrap bar' },
        h(
          'a',
          { href: 'index.html', class: 'brand' },
          h('img', { src: 'favicon.svg', alt: '', width: '32', height: '32' }),
          h('span', { text: SCHOOL + ' Dedications' })
        ),
        nav
      )
    );
  }

  function buildFooter() {
    return h(
      'footer',
      { class: 'site-footer' },
      h('div', { class: 'wrap', text: SCHOOL + ' birthday song dedications' })
    );
  }

  // Each page calls App.init({ title: 'Page name' }) first.
  function init(options) {
    const opts = options || {};
    document.title = (opts.title ? opts.title + ' | ' : '') + SCHOOL + ' Dedications';
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    if (header) header.replaceWith(buildHeader());
    if (footer) footer.replaceWith(buildFooter());
    document.querySelectorAll('[data-school-name]').forEach((el) => (el.textContent = SCHOOL));
    setupPageTransitions();
  }

  // "Channel change" flash before moving to another page of this site.
  function setupPageTransitions() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.append(h('div', { class: 'channel-flip', 'aria-hidden': 'true' }));
    // Coming back with the browser's back button can restore the page mid-transition.
    window.addEventListener('pageshow', () => document.body.classList.remove('leaving'));
    if (reduce) return;

    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      document.body.classList.add('leaving');
      setTimeout(() => (location.href = url.href), 230);
    });
  }

  window.App = {
    SCHOOL, getSession, setSession, clearSession, getUser, requireLogin, safeNext,
    api, ApiError, h, toast, setBusy, todayISO, formatDay, formatStamp, badge, init,
  };
})();
