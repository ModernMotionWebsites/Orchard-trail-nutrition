/* Orchard Trail Nutrition — front of house.
   The page arrives fully rendered from the server; this file adds motion,
   filtering, opening hours, visit tracking and the click-to-edit bridge used
   inside the dashboard preview. */

(function () {
  'use strict';

  const body = document.body;
  const editing = body.getAttribute('data-mode') === 'edit';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = readState();

  function readState() {
    const node = document.getElementById('site-state');
    try {
      return JSON.parse(node.textContent || '{}');
    } catch {
      return {};
    }
  }

  document.documentElement.classList.add('motion-ready');

  /* Keep the fixed header below the announcement banner. */
  function fitAnnouncement() {
    const bar = document.querySelector('.site-announce');
    if (!bar) {
      body.classList.remove('has-announce');
      return;
    }
    body.classList.add('has-announce');
    document.documentElement.style.setProperty('--ann-h', bar.offsetHeight + 'px');
  }
  fitAnnouncement();
  window.addEventListener('resize', fitAnnouncement, { passive: true });

  /* --------------------------------------------------------- preloader -- */
  const preloader = document.getElementById('preloader');
  if (preloader) {
    const finish = () => {
      preloader.classList.add('is-done');
      window.setTimeout(() => preloader.remove(), 900);
    };
    if (reduceMotion) preloader.remove();
    else {
      const started = performance.now();
      const done = () => window.setTimeout(finish, Math.max(0, 900 - (performance.now() - started)));
      if (document.readyState === 'complete') done();
      else window.addEventListener('load', done, { once: true });
      window.setTimeout(finish, 3200);
    }
  }

  /* ----------------------------------------------------- split headings -- */
  function splitHeadings() {
    document.querySelectorAll('[data-split]').forEach((node) => {
      if (node.dataset.splitDone) return;
      node.dataset.splitDone = '1';
      let index = 0;
      const frag = document.createDocumentFragment();
      const pushWord = (word) => {
        if (!word) return;
        const outer = document.createElement('span');
        outer.className = 'word';
        outer.style.setProperty('--i', String(index++));
        const inner = document.createElement('span');
        inner.textContent = word;
        outer.appendChild(inner);
        frag.appendChild(outer);
        frag.appendChild(document.createTextNode(' '));
      };
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) child.textContent.split(/\s+/).forEach(pushWord);
        else if (child.nodeName === 'BR') frag.appendChild(document.createElement('br'));
        else {
          const outer = document.createElement('span');
          outer.className = 'word';
          outer.style.setProperty('--i', String(index++));
          const inner = document.createElement('span');
          inner.appendChild(child.cloneNode(true));
          outer.appendChild(inner);
          frag.appendChild(outer);
          frag.appendChild(document.createTextNode(' '));
        }
      });
      node.textContent = '';
      node.appendChild(frag);
    });
  }

  splitHeadings();

  /* --------------------------------------------------------- scroll fx -- */
  const revealables = [...document.querySelectorAll('[data-reveal]'), ...document.querySelectorAll('[data-split]')];
  document.querySelectorAll('[data-reveal-delay]').forEach((el) => {
    el.style.setProperty('--reveal-delay', el.getAttribute('data-reveal-delay') + 'ms');
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  const header = document.getElementById('site-header');
  const navLinks = [...document.querySelectorAll('.nav__link')];
  const sections = navLinks
    .map((link) => {
      const href = link.getAttribute('href');
      return href && href.startsWith('#') ? document.querySelector(href) : null;
    })
    .filter(Boolean);
  let ticking = false;

  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-stuck', y > 24);
    if (sections.length) {
      const line = y + window.innerHeight * 0.32;
      let current = sections[0];
      sections.forEach((section) => {
        if (section.offsetTop <= line) current = section;
      });
      navLinks.forEach((link) => {
        const active = link.getAttribute('href') === '#' + current.id;
        link.classList.toggle('is-current', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(onScroll);
    },
    { passive: true }
  );
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------- mobile menu -- */
  const toggle = document.getElementById('nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (toggle && mobileMenu) {
    let closeTimer = 0;
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const open = () => {
      window.clearTimeout(closeTimer);
      mobileMenu.hidden = false;
      void mobileMenu.offsetWidth;
      mobileMenu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      body.classList.add('is-locked', 'menu-open');
      const first = mobileMenu.querySelector('a');
      if (first) window.setTimeout(() => first.focus({ preventScroll: true }), 320);
    };
    const close = (returnFocus) => {
      if (!isOpen()) return;
      mobileMenu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      body.classList.remove('is-locked', 'menu-open');
      closeTimer = window.setTimeout(() => {
        mobileMenu.hidden = true;
      }, reduceMotion ? 0 : 720);
      if (returnFocus) toggle.focus({ preventScroll: true });
    };
    toggle.addEventListener('click', () => (isOpen() ? close(true) : open()));
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => close(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) close(true);
    });
    mobileMenu.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const items = [...mobileMenu.querySelectorAll('a[href]')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900 && isOpen()) close(false);
    });
  }

  /* ------------------------------------------------------- the menu -- */
  const grid = document.getElementById('menu-grid');
  const cards = grid ? [...grid.querySelectorAll('.card')] : [];
  const chips = [...document.querySelectorAll('.chip[data-filter]')];
  const countEl = document.getElementById('menu-count');
  const emptyEl = document.getElementById('menu-empty');
  const moreWrap = document.getElementById('menu-more-wrap');
  const moreBtn = document.getElementById('menu-more');
  const noteEl = document.getElementById('menu-note');
  const PAGE_SIZE = Number(state.paging) || 12;

  let activeFilter = 'all';
  let shownLimit = PAGE_SIZE;

  function matches(card, filter) {
    if (filter === 'all') return true;
    if (filter === 'past') return card.dataset.archived === '1';
    if (filter.indexOf('col:') === 0) return (' ' + card.dataset.collections + ' ').indexOf(' ' + filter.slice(4) + ' ') !== -1;
    if (filter.indexOf('cat:') === 0) return card.dataset.category === filter.slice(4);
    return true;
  }

  function applyFilter(animate) {
    const matched = cards.filter((card) => matches(card, activeFilter));
    const shown = matched.slice(0, shownLimit);
    const set = new Set(shown);
    cards.forEach((card) => {
      const wasHidden = card.classList.contains('is-hidden');
      const show = set.has(card);
      card.classList.toggle('is-hidden', !show);
      if (!show) return;
      card.classList.add('is-in');
      if (animate && wasHidden && !reduceMotion) {
        card.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'none' }
          ],
          { duration: 480, easing: 'cubic-bezier(0.16,1,0.3,1)' }
        );
      }
    });
    const remaining = matched.length - shown.length;
    if (countEl) countEl.textContent = shown.length + ' of ' + matched.length + ' drinks';
    if (emptyEl) emptyEl.hidden = matched.length !== 0;
    if (moreWrap) moreWrap.hidden = remaining <= 0;
    if (moreBtn && remaining > 0) moreBtn.textContent = 'Show ' + Math.min(PAGE_SIZE, remaining) + ' more';
  }

  function setFilter(filter, animate) {
    activeFilter = filter;
    shownLimit = PAGE_SIZE;
    const chip = chips.find((item) => item.getAttribute('data-filter') === filter);
    if (noteEl) noteEl.textContent = chip ? chip.getAttribute('data-note') || '' : '';
    chips.forEach((item) => {
      const active = item.getAttribute('data-filter') === filter;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    applyFilter(animate !== false);
  }

  chips.forEach((chip) => chip.addEventListener('click', () => setFilter(chip.getAttribute('data-filter'))));
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      shownLimit += PAGE_SIZE;
      applyFilter(true);
    });
  }
  document.querySelectorAll('[data-jump]').forEach((link) => {
    link.addEventListener('click', () => setFilter(link.getAttribute('data-jump'), false));
  });
  if (cards.length) setFilter('all', false);

  /* --------------------------------------------------------- hours -- */
  const statusText = document.getElementById('open-status');
  const statusDot = document.getElementById('open-dot');
  const hourRows = [...document.querySelectorAll('.hours tr[data-day]')];
  const schedule = {};
  (state.hours || []).forEach((entry) => {
    schedule[entry.day] = entry;
  });
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function shopNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Detroit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const read = (type) => (parts.find((p) => p.type === type) || {}).value || '';
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = map[read('weekday')];
    return {
      day: typeof day === 'number' ? day : new Date().getDay(),
      minutes: (parseInt(read('hour'), 10) % 24) * 60 + parseInt(read('minute'), 10)
    };
  }

  function clockLabel(value) {
    const [hRaw, mRaw] = String(value || '00:00').split(':');
    let h = parseInt(hRaw, 10);
    const m = parseInt(mRaw || '0', 10);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + (m ? ':' + String(m).padStart(2, '0') : ':00') + ' ' + suffix;
  }

  function updateHours() {
    const now = shopNow();
    hourRows.forEach((row) => row.classList.toggle('is-today', Number(row.dataset.day) === now.day));
    if (!statusText) return;
    const today = schedule[now.day];
    if (today && !today.closed) {
      const [oh, om] = String(today.open).split(':').map(Number);
      const [ch, cm] = String(today.close).split(':').map(Number);
      if (now.minutes >= oh * 60 + (om || 0) && now.minutes < ch * 60 + (cm || 0)) {
        statusText.textContent = 'Open today until ' + clockLabel(today.close);
        if (statusDot) {
          statusDot.classList.add('is-open');
          statusDot.classList.remove('is-closed');
        }
        return;
      }
    }
    for (let i = 1; i <= 7; i++) {
      const day = (now.day + i) % 7;
      const entry = schedule[day];
      if (entry && !entry.closed) {
        if (statusDot) {
          statusDot.classList.add('is-closed');
          statusDot.classList.remove('is-open');
        }
        statusText.textContent =
          'Closed now — opens ' + (i === 1 ? 'tomorrow' : dayNames[day]) + ' at ' + clockLabel(entry.open);
        return;
      }
    }
    if (statusDot) statusDot.classList.add('is-closed');
    statusText.textContent = 'Closed now';
  }

  updateHours();
  window.setInterval(updateHours, 60000);

  /* ------------------------------------------------------ footer year -- */
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------- analytics -- */
  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const canTrack = !editing && !dnt && location.protocol.startsWith('http');
  let sessionId = '';
  try {
    sessionId = sessionStorage.getItem('otn_session') || '';
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('otn_session', sessionId);
    }
  } catch {
    sessionId = '';
  }

  function track(payload) {
    if (!canTrack) return;
    const data = JSON.stringify({ ...payload, session: sessionId, path: location.pathname + location.hash });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([data], { type: 'application/json' }));
        return;
      }
    } catch {
      /* fall through to fetch */
    }
    fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: data, keepalive: true }).catch(
      () => {}
    );
  }

  if (canTrack) {
    track({ type: 'view', referrer: document.referrer || '' });
    document.addEventListener('click', (event) => {
      const node = event.target.closest('[data-track]');
      if (!node) return;
      track({ type: 'event', event: node.getAttribute('data-track'), label: (node.textContent || '').trim().slice(0, 80) });
    });
    grid?.addEventListener('click', (event) => {
      const card = event.target.closest('.card');
      if (card && card.dataset.drinkId) track({ type: 'event', event: 'drink', label: card.dataset.drinkId });
    });
  }

  /* --------------------------------------------------- editor bridge -- */
  if (!editing) return;
  const parentWindow = window.parent;
  const send = (message) => parentWindow.postMessage(message, location.origin);

  function listInfo(node) {
    const item = node.closest('[data-list-item]');
    if (!item) return null;
    const list = node.closest('[data-list]');
    const path = list ? list.getAttribute('data-list') : item.getAttribute('data-list-item');
    const index = [...item.parentElement.children].indexOf(item);
    return { listPath: path, itemPath: item.getAttribute('data-list-item'), index };
  }

  function select(node) {
    const path = node.getAttribute('data-edit');
    if (!path) return;
    const info = listInfo(node);
    send({
      type: 'select',
      path,
      kind: node.getAttribute('data-kind') || 'text',
      label: node.getAttribute('data-label') || 'Text',
      altPath: node.getAttribute('data-alt-path') || '',
      listPath: info ? info.listPath : '',
      itemPath: info ? info.itemPath : '',
      index: info ? info.index : -1,
      drinkId: node.getAttribute('data-drink-id') || ''
    });
  }

  document.addEventListener(
    'click',
    (event) => {
      const addImage = event.target.closest('[data-add-image]');
      if (addImage) {
        event.preventDefault();
        send({ type: 'add-image', path: addImage.getAttribute('data-add-image') });
        return;
      }
      const node = event.target.closest('[data-edit]');
      if (!node) return;
      event.preventDefault();
      event.stopPropagation();
      select(node);
    },
    true
  );

  document.addEventListener(
    'mouseover',
    (event) => {
      const node = event.target.closest('[data-edit]');
      document.querySelectorAll('.is-edit-hover').forEach((el) => el.classList.remove('is-edit-hover'));
      if (node) node.classList.add('is-edit-hover');
    },
    true
  );

  function paint(node, value, kind) {
    if (node.tagName === 'IMG') {
      if (typeof value === 'string') node.src = value;
      return;
    }
    if (kind === 'link') {
      if (value && typeof value === 'object') {
        const span = node.querySelector('span');
        if (span) span.textContent = value.label || '';
        else node.textContent = value.label || '';
        if (value.href) node.setAttribute('href', value.href);
        if (/^https?:/i.test(value.href || '')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener');
        }
      }
      return;
    }
    node.textContent = String(value == null ? '' : value);
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.type === 'patch') {
      document.querySelectorAll('[data-edit="' + CSS.escape(data.path) + '"]').forEach((node) => paint(node, data.value, data.kind));
      if (data.altPath) {
        document.querySelectorAll('[data-edit="' + CSS.escape(data.path) + '"]').forEach((node) => {
          if (node.tagName === 'IMG') node.alt = data.altValue || '';
        });
      }
      if (data.path.endsWith('.photo.src') || data.path.endsWith('.src')) {
        document.querySelectorAll('[data-edit="' + CSS.escape(data.path) + '"]').forEach((node) => {
          if (node.tagName === 'IMG') {
            node.removeAttribute('srcset');
            node.removeAttribute('sizes');
          }
        });
      }
    }
    if (data.type === 'reload') {
      location.reload();
    }
    if (data.type === 'highlight') {
      const nodes = document.querySelectorAll('[data-edit="' + CSS.escape(data.path) + '"]');
      if (nodes.length) {
        const node = nodes[0];
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        node.classList.add('is-edit-flash');
        window.setTimeout(() => node.classList.remove('is-edit-flash'), 1400);
      }
    }
    if (data.type === 'order' && Array.isArray(data.ids)) {
      const main = document.getElementById('main');
      if (!main) return;
      data.ids.forEach((id) => {
        const node = main.querySelector('[data-section="' + CSS.escape(id) + '"]');
        if (node) main.appendChild(node);
      });
    }
  });

  send({ type: 'ready', url: location.href });
})();
