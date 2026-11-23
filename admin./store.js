/* Dashboard state: the single source of truth for the working draft.
   Every change saves automatically; publishing copies the draft to live. */

import { getPath, setPath } from '/shared/model.js';
import { renderPage } from '/shared/render.js';

export const S = {
  user: null,
  content: null,
  version: 0,
  published: null,
  versions: [],
  activity: [],
  dirty: false,
  saving: false,
  savedAt: null,
  error: null,
  view: 'overview',
  media: [],
  mediaFolders: [],
  analytics: null,
  analyticsRange: '30d',
  iframe: null,
  iframeReady: false,
  selection: null,
  device: 'desktop',
  history: [],
  historyIndex: -1,
  lastHistory: 0,
  sectionDrag: null
};

const listeners = { change: [], status: [] };

export function on(event, fn) {
  (listeners[event] || (listeners[event] = [])).push(fn);
}

export function emit(view) {
  if (view) S.view = view;
  listeners.change.forEach((fn) => fn(S.view));
}

export function emitStatus() {
  listeners.status.forEach((fn) => fn());
}

export async function api(path, options = {}) {
  const init = { method: options.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (options.body instanceof FormData) {
    init.body = options.body;
  } else if (options.body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const error = new Error((data && data.error) || 'Something went wrong.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function loadContent(payload) {
  S.content = payload.draft?.content || null;
  S.version = payload.draft?.version || 0;
  S.savedAt = payload.draft?.updatedAt || null;
  S.published = payload.published || null;
  S.pending = !!payload.published?.pending;
  S.versions = payload.versions || [];
  S.user = payload.user || S.user;
  S.dirty = false;
  S.history = [];
  S.historyIndex = -1;
  S.error = null;
}

/* ------------------------------------------------------------ editing -- */

export function pushHistory(label = 'Change') {
  if (!S.content) return;
  const now = Date.now();
  if (now - S.lastHistory < 900 && S.history.length) return;
  S.lastHistory = now;
  const snapshot = JSON.stringify(S.content);
  if (S.history[S.historyIndex] === snapshot) return;
  S.history = S.history.slice(0, S.historyIndex + 1);
  S.history.push(snapshot);
  if (S.history.length > 50) S.history.shift();
  S.historyIndex = S.history.length - 1;
  S.lastLabel = label;
}

export function undo() {
  if (S.historyIndex <= 0) return false;
  S.historyIndex -= 1;
  S.content = JSON.parse(S.history[S.historyIndex]);
  afterUndo();
  return true;
}

export function redo() {
  if (S.historyIndex >= S.history.length - 1) return false;
  S.historyIndex += 1;
  S.content = JSON.parse(S.history[S.historyIndex]);
  afterUndo();
  return true;
}

function afterUndo() {
  S.dirty = true;
  emitStatus();
  scheduleAutosave();
  reloadPreview();
  emit();
}

export function getValue(path) {
  return getPath(S.content, path);
}

export function setValue(path, value, options = {}) {
  if (!S.content) return;
  pushHistory(path);
  setPath(S.content, path, value);
  S.dirty = true;
  S.error = null;
  emitStatus();
  scheduleAutosave();
  if (options.preview !== false) {
    postToPreview({ type: 'patch', path, value, kind: options.kind || 'text', altPath: options.altPath, altValue: options.altValue });
  }
  if (options.rerender) emit();
}

export function toggleFlag(path, options = {}) {
  const next = !getValue(path);
  setValue(path, next, { preview: false, ...options });
  return next;
}

/* ------------------------------------------------------------- saving -- */

let autosaveTimer = 0;
let previewTimer = 0;

export function scheduleAutosave() {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => saveDraft({ silent: true }), 900);
}

export async function saveDraft({ silent = false } = {}) {
  if (!S.content || S.saving) {
    if (S.saving) scheduleAutosave();
    return true;
  }
  S.saving = true;
  emitStatus();
  try {
    const result = await api('/api/admin/content', {
      method: 'PUT',
      body: { content: S.content, baseVersion: S.version }
    });
    S.version = result.version;
    S.savedAt = result.savedAt;
    S.dirty = false;
    /* the draft is now newer than the published copy */
    S.pending = true;
    S.error = null;
    if (!silent) toast('Draft saved. Your website is unchanged until you publish.', 'success');
    return true;
  } catch (error) {
    if (error.status === 409) {
      S.error = 'Someone else saved a newer version. Reload to see it.';
      toast('A newer version was saved in another window. Reload the dashboard to continue.', 'error', 8000);
    } else {
      S.error = error.message;
      toast(error.message || 'Could not save your changes.', 'error');
    }
    return false;
  } finally {
    S.saving = false;
    emitStatus();
  }
}

export async function publishWebsite(note) {
  const ok = await saveDraft({ silent: true });
  if (!ok) return false;
  try {
    /* The page is built here, in the browser, and handed to the server, which
       writes it to index.html. That keeps the PHP side free of any rendering. */
    const html = renderPage(S.content, { origin: location.origin, version: 'v' + (S.version + 1) });
    const result = await api('/api/admin/publish', { method: 'POST', body: { note, html } });
    S.published = { version: result.version, publishedAt: result.publishedAt, publishedBy: S.user?.email };
    S.pending = false;
    S.dirty = false;
    emitStatus();
    if (S.iframe) window.dispatchEvent(new CustomEvent('otn:preview-refresh'));
    toast('Published! Your website is updated for everyone.', 'success', 5000);
    return true;
  } catch (error) {
    toast(error.message || 'Could not publish.', 'error');
    return false;
  }
}

export async function restoreVersion(id) {
  try {
    const saved = await api('/api/admin/versions/' + encodeURIComponent(id));
    const html = renderPage(saved.content, { origin: location.origin });
    const result = await api('/api/admin/versions/' + encodeURIComponent(id) + '/restore', {
      method: 'POST',
      body: { html }
    });
    S.published = { version: result.version, publishedAt: result.publishedAt, publishedBy: S.user?.email };
    await refreshContent();
    toast('That version is live again.', 'success', 5000);
    return true;
  } catch (error) {
    toast(error.message || 'Could not restore that version.', 'error');
    return false;
  }
}

export async function refreshContent() {
  const payload = await api('/api/admin/content');
  loadContent(payload);
  emitStatus();
  reloadPreview();
  emit();
}

/* ------------------------------------------------------------ preview -- */

export function postToPreview(message) {
  if (!S.iframe || !S.iframe.contentWindow) return;
  try {
    S.iframe.contentWindow.postMessage(message, location.origin);
  } catch {
    /* the iframe may still be loading */
  }
}

export function reloadPreview(delay = 500) {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => window.dispatchEvent(new CustomEvent('otn:preview-refresh')), delay);
}

export function structuralChange() {
  S.dirty = true;
  emitStatus();
  scheduleAutosave();
  reloadPreview(700);
}

/* ------------------------------------------------------------- toasts -- */

function toast(message, type = 'info', duration = 3600) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = 'toast toast--' + type;
  node.setAttribute('role', 'status');
  node.innerHTML = `<span class="toast__dot"></span><p></p><button type="button" aria-label="Dismiss">&times;</button>`;
  node.querySelector('p').textContent = message;
  node.querySelector('button').addEventListener('click', () => node.remove());
  root.appendChild(node);
  window.setTimeout(() => {
    node.classList.add('is-out');
    window.setTimeout(() => node.remove(), 300);
  }, duration);
}

export { toast };
