/* Orchard Trail Nutrition — Website Manager
   Shell, sign-in, navigation and the global save / publish controls. */

import {
  S, api, loadContent, on, emit, emitStatus, saveDraft, publishWebsite, undo, redo, toast
} from './store.js';
import { icon, esc, modal, confirmDialog, timeAgo } from './ui.js';
import { overview, editor, handlePreviewMessage, resetOverview } from './views-site.js';
import { menu, wireMenu, seasonal, wireSeasonal, startNewDrink } from './views-menu.js';
import { media, wireMedia, analytics, wireAnalytics } from './views-assets.js';
import { business, wireBusiness, design, wireDesign, seo, wireSeo, account, wireAccount, showRecoveryCode } from './views-settings.js';

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'overview', view: overview },
  { id: 'editor', label: 'Website Editor', icon: 'editor', view: editor },
  { id: 'menu', label: 'Menu & Drinks', icon: 'menu', view: menu },
  { id: 'seasonal', label: 'Seasonal Specials', icon: 'seasonal', view: seasonal },
  { id: 'media', label: 'Photos & Media', icon: 'media', view: media },
  { id: 'analytics', label: 'Analytics', icon: 'analytics', view: analytics },
  { id: 'business', label: 'Business Information', icon: 'business', view: business },
  { id: 'design', label: 'Design & Branding', icon: 'design', view: design },
  { id: 'seo', label: 'SEO & Settings', icon: 'seo', view: seo },
  { id: 'account', label: 'Account & Security', icon: 'account', view: account }
];

const WIRING = {
  menu: wireMenu,
  seasonal: wireSeasonal,
  media: wireMedia,
  analytics: wireAnalytics,
  business: wireBusiness,
  design: wireDesign,
  seo: wireSeo,
  account: wireAccount
};

let editorMounted = false;
let booted = false;

/* -------------------------------------------------------------- theme -- */

const storedTheme = localStorage.getItem('otn-theme');
if (storedTheme) document.documentElement.dataset.theme = storedTheme;

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('otn-theme', next);
}

/* --------------------------------------------------------------- boot -- */

async function boot() {
  try {
    const status = await api('/api/auth/status');
    document.getElementById('boot').remove();
    if (status.needsSetup) {
      renderSetup();
      return;
    }
    if (!status.authenticated) {
      renderLogin();
      return;
    }
    S.user = status.user;
    await openDashboard();
  } catch (error) {
    const boot = document.getElementById('boot');
    if (boot) {
      boot.innerHTML = `<div class="boot__mark"><span>Orchard Trail</span><small>Website Manager</small></div>
        <p class="error-text">${esc(error.message || 'The dashboard could not load.')}</p>
        <button class="btn btn--primary" type="button" onclick="location.reload()">Try again</button>`;
    }
  }
}

function authShell(content) {
  const auth = document.getElementById('auth');
  auth.hidden = false;
  auth.innerHTML = `
    <div class="auth__card">
      <div class="auth__brand">
        <span class="auth__dot"></span>
        <div><strong>Orchard Trail</strong><small>Website Manager</small></div>
      </div>
      ${content}
    </div>
    <p class="auth__foot">65881 Van Dyke Rd · Washington, MI 48095</p>`;
  return auth;
}

function renderLogin(prefill = '') {
  const auth = authShell(`
    <h1>Welcome back</h1>
    <p class="auth__lede">Sign in to update your website.</p>
    <form class="form" data-login>
      <label class="field"><span class="field__label">Email address</span>
        <input class="input" type="email" name="email" autocomplete="username" value="${esc(prefill)}" required></label>
      <label class="field"><span class="field__label">Password</span>
        <span class="password-wrap">
          <input class="input" type="password" name="password" autocomplete="current-password" required>
          <button class="password-eye" type="button" data-reveal aria-label="Show password">${icon('eye', 16)}</button>
        </span></label>
      <p class="form__error" data-error hidden></p>
      <button class="btn btn--primary btn--block" type="submit">Sign in</button>
    </form>
    <button class="link-btn" type="button" data-forgot>Forgot your password?</button>`);

  const reveal = auth.querySelector('[data-reveal]');
  reveal?.addEventListener('click', () => {
    const field = auth.querySelector('input[name="password"]');
    if (!field) return;
    field.type = field.type === 'password' ? 'text' : 'password';
    reveal.setAttribute('aria-label', field.type === 'password' ? 'Show password' : 'Hide password');
    field.focus();
  });

  const form = auth.querySelector('[data-login]');
  const error = auth.querySelector('[data-error]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Signing in…';
    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: { email: form.email.value, password: form.password.value }
      });
      S.user = result.user;
      await openDashboard();
    } catch (requestError) {
      error.hidden = false;
      error.textContent = requestError.message;
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });
  auth.querySelector('[data-forgot]').addEventListener('click', () => renderRecovery(form.email.value));
  form.email.focus();
}

function renderSetup() {
  const auth = authShell(`
    <h1>Set up your website manager</h1>
    <p class="auth__lede">This is a one-time step. Create the owner account for Orchard Trail Nutrition — you will use it to sign in from now on.</p>
    <form class="form" data-setup>
      <label class="field"><span class="field__label">Your name</span>
        <input class="input" name="name" autocomplete="name" placeholder="e.g. Laura" required></label>
      <label class="field"><span class="field__label">Email address</span>
        <input class="input" type="email" name="email" autocomplete="username" required></label>
      <label class="field"><span class="field__label">Choose a password</span>
        <input class="input" type="password" name="password" autocomplete="new-password" minlength="10" required>
        <span class="field__hint">At least 10 characters, including a number or symbol.</span></label>
      <label class="field"><span class="field__label">Repeat the password</span>
        <input class="input" type="password" name="repeat" autocomplete="new-password" minlength="10" required></label>
      <p class="form__error" data-error hidden></p>
      <button class="btn btn--primary btn--block" type="submit">Create my account</button>
    </form>`);

  const form = auth.querySelector('[data-setup]');
  const error = auth.querySelector('[data-error]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    if (form.password.value !== form.repeat.value) {
      error.hidden = false;
      error.textContent = 'The two passwords do not match.';
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await api('/api/auth/setup', {
        method: 'POST',
        body: { name: form.name.value, email: form.email.value, password: form.password.value }
      });
      S.user = result.user;
      showRecoveryCode(result.recoveryCode);
      await openDashboard();
    } catch (requestError) {
      error.hidden = false;
      error.textContent = requestError.message;
      button.disabled = false;
    }
  });
  form.name.focus();
}

function renderRecovery(email = '') {
  const auth = authShell(`
    <h1>Reset your password</h1>
    <p class="auth__lede">Use the recovery code you saved when the account was created.</p>
    <form class="form" data-recover>
      <label class="field"><span class="field__label">Email address</span>
        <input class="input" type="email" name="email" autocomplete="username" value="${esc(email)}" required></label>
      <label class="field"><span class="field__label">Recovery code</span>
        <input class="input input--mono" name="code" placeholder="OTN-XXXX-XXXX-XXXX" required></label>
      <label class="field"><span class="field__label">New password</span>
        <input class="input" type="password" name="password" autocomplete="new-password" minlength="10" required></label>
      <p class="form__error" data-error hidden></p>
      <button class="btn btn--primary btn--block" type="submit">Set new password</button>
    </form>
    <button class="link-btn" type="button" data-back>Back to sign in</button>`);

  const form = auth.querySelector('[data-recover]');
  const error = auth.querySelector('[data-error]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    try {
      const result = await api('/api/auth/recover', {
        method: 'POST',
        body: { email: form.email.value, code: form.code.value, password: form.password.value }
      });
      S.user = result.user;
      showRecoveryCode(result.recoveryCode);
      await openDashboard();
    } catch (requestError) {
      error.hidden = false;
      error.textContent = requestError.message;
    }
  });
  auth.querySelector('[data-back]').addEventListener('click', () => renderLogin());
}

/* ----------------------------------------------------------- dashboard -- */

async function openDashboard() {
  const payload = await api('/api/admin/content');
  loadContent(payload);
  S.user = payload.user || S.user;
  document.getElementById('auth').hidden = true;
  const shell = document.getElementById('shell');
  shell.hidden = false;
  renderSidebar();
  renderTopbar();
  applyHash();
  if (!booted) {
    booted = true;
    window.addEventListener('hashchange', applyHash);
    window.addEventListener('message', onPreviewMessage);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('otn:logout', logout);
    on('status', paintStatus);
    paintStatus();
  }
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  const view = currentView();
  sidebar.innerHTML = `
    <div class="sidebar__head">
      <a class="sidebar__brand" href="#overview">
        <span class="sidebar__mark">OT</span>
        <span><strong>Orchard Trail</strong><small>Website Manager</small></span>
      </a>
      <button class="icon-btn sidebar__close" type="button" data-nav-close aria-label="Close menu">${icon('close')}</button>
    </div>
    <a class="sidebar__live" href="/" target="_blank" rel="noopener">
      <span>${icon('external', 17)} View live website</span>
      <small>orchardtrailnutrition.com</small>
    </a>
    <nav class="sidebar__nav" aria-label="Dashboard">
      ${NAV.map(
        (item) => `<a href="#${item.id}" class="side-link${item.id === view.id ? ' is-active' : ''}" data-nav="${item.id}">
          ${icon(item.icon, 18)}<span>${item.label}</span>
        </a>`
      ).join('')}
    </nav>
    <div class="sidebar__foot">
      <button class="side-link" type="button" data-theme-toggle>
        ${icon('sparkle', 18)}<span data-theme-label>Dark mode</span>
      </button>
      <div class="user-chip">
        <span class="avatar">${esc((S.user?.name || S.user?.email || '?').charAt(0).toUpperCase())}</span>
        <div><strong>${esc(S.user?.name || 'Owner')}</strong><small>${esc(S.user?.email || '')}</small></div>
        <button class="icon-btn" type="button" data-logout title="Sign out">${icon('logout', 16)}</button>
      </div>
    </div>`;
  sidebar.querySelector('[data-theme-toggle]').addEventListener('click', () => {
    toggleTheme();
    document.querySelector('[data-theme-label]').textContent =
      document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode';
  });
  document.querySelector('[data-theme-label]').textContent =
    document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode';
  sidebar.querySelector('[data-logout]').addEventListener('click', logout);
  sidebar.querySelector('[data-nav-close]').addEventListener('click', () => {
    document.getElementById('shell').classList.remove('is-nav-open');
  });
  sidebar.querySelectorAll('[data-nav]').forEach((link) =>
    link.addEventListener('click', () => document.getElementById('shell').classList.remove('is-nav-open'))
  );
}

function renderTopbar() {
  const topbar = document.getElementById('topbar');
  const view = currentView();
  topbar.innerHTML = `
    <button class="icon-btn nav-toggle-btn" type="button" data-nav-toggle aria-label="Open menu">${icon('bars', 20)}</button>
    <div class="topbar__titles">
      <h1>${esc(view.title)}</h1>
      <p>${esc(view.subtitle || '')}</p>
    </div>
    <div class="topbar__actions">
      <span class="save-state" data-status></span>
      <button class="btn btn--ghost btn--small" type="button" data-save>${icon('save', 16)} <span>Save draft</span></button>
      <button class="btn btn--primary" type="button" data-publish>Publish website</button>
    </div>`;
  topbar.querySelector('[data-nav-toggle]').addEventListener('click', () => {
    document.getElementById('shell').classList.toggle('is-nav-open');
  });
  topbar.querySelector('[data-save]').addEventListener('click', async () => {
    const ok = await saveDraft();
    if (ok) paintStatus();
  });
  topbar.querySelector('[data-publish]').addEventListener('click', openPublish);
}

function paintStatus() {
  const node = document.querySelector('[data-status]');
  if (!node) return;
  if (S.saving) {
    node.innerHTML = `<span class="save-state__dot is-saving"></span> Saving…`;
    node.className = 'save-state is-saving';
    return;
  }
  if (S.error) {
    node.innerHTML = `<span class="save-state__dot is-error"></span> ${esc(S.error)}`;
    node.className = 'save-state is-error';
    return;
  }
  if (S.dirty) {
    node.innerHTML = `<span class="save-state__dot is-dirty"></span> Unsaved changes`;
    node.className = 'save-state is-dirty';
    return;
  }
  node.innerHTML = `<span class="save-state__dot is-saved"></span> All changes saved${
    S.published ? ' · live v' + S.published.version : ''
  }`;
  node.className = 'save-state is-saved';
}

async function openPublish() {
  const pending = S.dirty || !!S.pending;
  const ok = await confirmDialog({
    title: 'Publish your website?',
    message: pending
      ? 'Your saved changes will replace what visitors see right now. You can restore an earlier version at any time from Account &amp; Security.'
      : 'Your website is already up to date. Publishing again creates a new saved version of the same content.',
    confirmLabel: 'Publish website'
  });
  if (!ok) return;
  const done = await publishWebsite('Published from the dashboard');
  if (done) {
    resetOverview();
    if (S.view === 'overview') {
      const root = document.getElementById('view');
      root.innerHTML = '';
      overview.render(root);
    }
  }
  paintStatus();
}

function logout() {
  api('/api/auth/logout', { method: 'POST' })
    .catch(() => {})
    .then(() => location.reload());
}

/* -------------------------------------------------------------- routing -- */

function hashParts() {
  const raw = location.hash.replace(/^#/, '');
  const [name, param] = raw.split('/');
  return { name: name || 'overview', param: param || '' };
}

function currentView() {
  const { name } = hashParts();
  return NAV.find((item) => item.id === name) || NAV[0];
}

function applyHash() {
  const { name, param } = hashParts();
  const item = NAV.find((entry) => entry.id === name) || NAV[0];
  S.view = item.id;
  S.selection = null;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('data-nav') === item.id);
  });
  const heading = document.querySelector('.topbar__titles h1');
  const subtitle = document.querySelector('.topbar__titles p');
  if (heading) heading.textContent = item.title;
  if (subtitle) subtitle.textContent = item.subtitle || '';

  const root = document.getElementById('view');
  root.classList.toggle('view--full', item.id === 'editor');

  if (item.id === 'editor') {
    if (!editorMounted) {
      root.innerHTML = '';
      item.view.render(root);
      editorMounted = true;
    } else {
      item.view.refresh();
    }
    document.getElementById('shell').classList.remove('is-nav-open');
    return;
  }

  if (editorMounted) {
    editor.unmount();
    editorMounted = false;
  }

  root.innerHTML = '';
  Promise.resolve(item.view.render(root))
    .then(() => {
      const wire = WIRING[item.id];
      if (wire) wire(root);
      if (item.id === 'menu' && param === 'new') startNewDrink();
      if (item.id === 'business' && param === 'hours') {
        const hours = root.querySelector('#hours');
        hours?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      root.focus({ preventScroll: true });
    })
    .catch((error) => {
      root.innerHTML = `<div class="card-panel"><h2>Something went wrong</h2><p>${esc(error.message)}</p></div>`;
    });
  document.getElementById('shell').classList.remove('is-nav-open');
}

function onPreviewMessage(event) {
  if (event.origin !== location.origin) return;
  if (S.view !== 'editor') return;
  handlePreviewMessage(event.data || {});
}

function onKeyDown(event) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  const meta = event.metaKey || event.ctrlKey;
  if (meta && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveDraft().then(paintStatus);
    return;
  }
  if (!typing && meta && event.key.toLowerCase() === 'z') {
    if (event.shiftKey) {
      if (redo()) toast('Redone.', 'info', 1600);
    } else if (undo()) {
      toast('Undone.', 'info', 1600);
    }
    event.preventDefault();
  }
}

/* Keep the overview fresh after edits. */
on('change', () => {
  if (S.view === 'overview') resetOverview();
});

boot();
