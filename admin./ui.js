/* Small UI kit for the dashboard: icons, modals, drawers, form fields. */

import { esc } from '/shared/model.js';

export { esc };

export const ICONS = {
  overview: '<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z"/>',
  editor: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 6.5l3 3"/>',
  menu: '<path d="M6 3v8a3 3 0 0 0 6 0V3"/><path d="M9 11v10"/><path d="M17 3c-1.5 2-2 4-2 6s.5 3 2 3v9"/>',
  seasonal: '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.5"/>',
  media: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  analytics: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/>',
  business: '<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>',
  design: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.4"/><circle cx="15" cy="9" r="1.4"/><circle cx="9.5" cy="15" r="1.4"/>',
  seo: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h7V3"/><rect x="8" y="13" width="8" height="8"/>',
  upload: '<path d="M12 16V4m0 0L7 9m5-5l5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  drag: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.3 3.9"/><path d="M6.3 8.1C3.8 9.8 2 12 2 12s3.5 6 10 6a11 11 0 0 0 4.2-.8"/>',
  star: '<path d="M12 3.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  phone: '<path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  mobile: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  tablet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M11 18h2"/>',
  desktop: '<rect x="2" y="4" width="20" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 0 12h-1"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12h-9a6 6 0 0 0 0 12h1"/>',
  sparkle: '<path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.4l-1.8-4.9L5 9.7l5.2-1.8z"/><path d="M18.5 15l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4m0 3v.5"/>',
  bars: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};

export function icon(name, size = 20) {
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

export function debounce(fn, wait = 200) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

export function when(condition, callback, timeout = 6000) {
  const started = Date.now();
  const tick = () => {
    if (condition()) callback();
    else if (Date.now() - started < timeout) window.setTimeout(tick, 60);
  };
  tick();
}

export function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', options);
}

export function timeAgo(value) {
  if (!value) return 'never';
  const then = new Date(value).getTime();
  if (!then) return 'never';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return 'a minute ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + ' minutes ago';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : hours + ' hours ago';
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? 'yesterday' : days + ' days ago';
  return formatDate(value);
}

export function timeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ------------------------------------------------------------- modals -- */

let modalStack = [];

export function modal({ title, body, footer, wide = false, onMount, onClose, dismissible = true }) {
  const root = document.getElementById('modal-root');
  const wrapper = document.createElement('div');
  wrapper.className = 'modal' + (wide ? ' modal--wide' : '');
  wrapper.innerHTML = `
    <div class="modal__backdrop" data-close></div>
    <div class="modal__panel" role="dialog" aria-modal="true" aria-label="${esc(title || 'Dialog')}">
      <header class="modal__head">
        <h2>${esc(title || '')}</h2>
        ${dismissible ? `<button class="icon-btn" type="button" data-close aria-label="Close">${icon('close')}</button>` : ''}
      </header>
      <div class="modal__body"></div>
      ${footer ? `<footer class="modal__foot"></footer>` : ''}
    </div>`;
  const bodyNode = wrapper.querySelector('.modal__body');
  if (typeof body === 'string') bodyNode.innerHTML = body;
  else if (body) bodyNode.appendChild(body);
  if (footer) {
    const footNode = wrapper.querySelector('.modal__foot');
    if (typeof footer === 'string') footNode.innerHTML = footer;
    else footNode.appendChild(footer);
  }
  const close = () => {
    wrapper.classList.add('is-out');
    window.setTimeout(() => wrapper.remove(), 160);
    modalStack = modalStack.filter((item) => item !== close);
    onClose?.();
  };
  wrapper.querySelectorAll('[data-close]').forEach((node) =>
    node.addEventListener('click', () => {
      if (dismissible) close();
    })
  );
  document.body.appendChild(wrapper);
  document.body.classList.add('has-modal');
  modalStack.push(close);
  onMount?.(wrapper, close);
  const focusable = wrapper.querySelector('input, textarea, select, button:not([data-close])');
  if (focusable) window.setTimeout(() => focusable.focus(), 60);
  return { root: wrapper, body: bodyNode, close };
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalStack.length) {
    const close = modalStack[modalStack.length - 1];
    modalStack = modalStack.slice(0, -1);
    close();
  }
});

export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value, close) => {
      if (settled) return;
      settled = true;
      resolve(value);
      close();
    };
    modal({
      title,
      body: `<p class="modal__text">${message}</p>`,
      footer: `<button class="btn btn--ghost" type="button" data-cancel>${esc(cancelLabel)}</button>
               <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-confirm>${esc(confirmLabel)}</button>`,
      onMount(root, close) {
        root.querySelector('[data-cancel]').addEventListener('click', () => finish(false, close));
        root.querySelector('[data-confirm]').addEventListener('click', () => finish(true, close));
      },
      onClose: () => finish(false, () => {})
    });
  });
}

export function promptDialog({ title, label, value = '', placeholder = '', multiline = false, confirmLabel = 'Save' }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result, close) => {
      if (settled) return;
      settled = true;
      resolve(result);
      close();
    };
    modal({
      title,
      body: `<label class="field"><span class="field__label">${esc(label)}</span>
        ${multiline ? `<textarea class="input" rows="4" data-input placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input class="input" data-input value="${esc(value)}" placeholder="${esc(placeholder)}">`}
      </label>`,
      footer: `<button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
               <button class="btn btn--primary" type="button" data-confirm>${esc(confirmLabel)}</button>`,
      onMount(root, close) {
        const input = root.querySelector('[data-input]');
        const submit = () => finish(input.value, close);
        root.querySelector('[data-cancel]').addEventListener('click', () => finish(null, close));
        root.querySelector('[data-confirm]').addEventListener('click', submit);
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && !multiline) submit();
        });
      },
      onClose: () => finish(null, () => {})
    });
  });
}

/* ------------------------------------------------------------ drawers -- */

export function drawer({ title, subtitle, body, footer, wide = false, onMount, onClose }) {
  const host = document.getElementById('drawer-root');
  const node = document.createElement('div');
  node.className = 'drawer' + (wide ? ' drawer--wide' : '');
  node.innerHTML = `
    <div class="drawer__backdrop" data-close></div>
    <aside class="drawer__panel" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="drawer__head">
        <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        <button class="icon-btn" type="button" data-close aria-label="Close">${icon('close')}</button>
      </header>
      <div class="drawer__body"></div>
      ${footer ? `<footer class="drawer__foot"></footer>` : ''}
    </aside>`;
  const bodyNode = node.querySelector('.drawer__body');
  if (typeof body === 'string') bodyNode.innerHTML = body;
  else if (body) bodyNode.appendChild(body);
  if (footer) {
    const foot = node.querySelector('.drawer__foot');
    if (typeof footer === 'string') foot.innerHTML = footer;
    else foot.appendChild(footer);
  }
  const close = () => {
    node.classList.add('is-out');
    window.setTimeout(() => node.remove(), 200);
    onClose?.();
  };
  node.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  host.appendChild(node);
  document.body.classList.add('has-drawer');
  window.setTimeout(() => node.classList.add('is-open'), 20);
  onMount?.(node, close);
  return { root: node, body: bodyNode, close };
}

/* ------------------------------------------------------------- fields -- */

export function field(label, control, hint) {
  return `<label class="field">
    <span class="field__label">${esc(label)}</span>
    ${control}
    ${hint ? `<span class="field__hint">${hint}</span>` : ''}
  </label>`;
}

export function textInput(path, value, { placeholder = '', type = 'text', attrs = '' } = {}) {
  return `<input class="input" type="${type}" data-path="${esc(path)}" value="${esc(value ?? '')}" placeholder="${esc(
    placeholder
  )}" ${attrs}>`;
}

export function textArea(path, value, { rows = 3, placeholder = '' } = {}) {
  return `<textarea class="input" rows="${rows}" data-path="${esc(path)}" placeholder="${esc(placeholder)}">${esc(value ?? '')}</textarea>`;
}

export function selectInput(path, value, options) {
  return `<select class="input" data-path="${esc(path)}">${options
    .map(
      (option) =>
        `<option value="${esc(option.value)}"${String(option.value) === String(value ?? '') ? ' selected' : ''}>${esc(option.label)}</option>`
    )
    .join('')}</select>`;
}

export function switchField(path, value, label, hint) {
  return `<label class="switch-row">
    <span class="switch-row__text"><span class="switch-row__label">${esc(label)}</span>${hint ? `<span class="switch-row__hint">${hint}</span>` : ''}</span>
    <input type="checkbox" class="switch" data-path="${esc(path)}" data-toggle ${value ? 'checked' : ''}>
  </label>`;
}

export function colorField(path, value, label) {
  return `<div class="color-field">
    <span class="field__label">${esc(label)}</span>
    <div class="color-field__row">
      <input type="color" class="color-field__picker" data-color-for="${esc(path)}" value="${esc(value || '#203D31')}" aria-label="${esc(label)}">
      <input class="input input--mono" data-path="${esc(path)}" value="${esc(value || '')}" maxlength="7">
    </div>
  </div>`;
}

export function emptyState(iconName, title, message, action = '') {
  return `<div class="empty-state">
    <span class="empty-state__icon">${icon(iconName, 26)}</span>
    <h3>${esc(title)}</h3>
    <p>${message}</p>
    ${action}
  </div>`;
}

export function statusBadge(state) {
  if (state === 'live') return '<span class="badge badge--live">Live</span>';
  if (state === 'draft') return '<span class="badge badge--draft">Draft</span>';
  if (state === 'archived') return '<span class="badge badge--muted">Archived</span>';
  if (state === 'hidden') return '<span class="badge badge--muted">Hidden</span>';
  return '';
}

/* Generic form binding: any [data-path] control writes into the content. */
export function bindFields(root, onWrite) {
  const handle = (event) => {
    const input = event.target.closest('[data-path]');
    if (!input) return;
    const path = input.getAttribute('data-path');
    let value;
    if (input.type === 'checkbox') value = input.checked;
    else if (input.type === 'number') value = input.value === '' ? '' : Number(input.value);
    else value = input.value;
    onWrite(path, value, input);
  };
  root.addEventListener('input', handle);
  root.addEventListener('change', handle);
  root.querySelectorAll('[data-color-for]').forEach((picker) => {
    picker.addEventListener('input', () => {
      const path = picker.getAttribute('data-color-for');
      const text = root.querySelector(`[data-path="${path}"]`);
      if (text) text.value = picker.value;
      onWrite(path, picker.value, picker);
    });
  });
}
