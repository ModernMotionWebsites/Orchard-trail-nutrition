/* Overview and the visual Website Editor. */

import {
  S, api, emit, emitStatus, setValue, getValue, saveDraft, publishWebsite,
  pushHistory, postToPreview, reloadPreview, structuralChange, toast, undo, redo
} from './store.js';
import {
  icon, esc, modal, confirmDialog, formatDate, timeAgo, timeOfDay, emptyState,
  statusBadge, bindFields, promptDialog
} from './ui.js';
import { pickImage, uploadFiles, cropImage } from './media-lib.js';
import { renderPage } from '/shared/render.js';
import { openDrinkDrawer } from './views-menu.js';

const ACTION_LABELS = {
  directions: 'Get Directions clicks',
  phone: 'Phone number clicks',
  instagram: 'Instagram clicks',
  facebook: 'Facebook clicks',
  menu: 'Menu link clicks',
  email: 'Email clicks',
  announcement: 'Announcement clicks',
  drink: 'Drink card clicks'
};

let overviewData = null;

export const overview = {
  title: 'Overview',
  subtitle: 'A friendly look at your website and your shop.',
  async render(root) {
    const content = S.content;
    const published = S.published;
    if (!overviewData) {
      root.innerHTML = `<div class="skeleton-card"></div>`;
      try {
        const [analytics, activity] = await Promise.all([
          api('/api/admin/analytics?range=30d'),
          api('/api/admin/activity')
        ]);
        overviewData = { analytics, activity: activity.activity || [] };
        S.analytics = analytics;
        S.activity = overviewData.activity;
      } catch {
        overviewData = { analytics: null, activity: [] };
      }
    }
    const analytics = overviewData.analytics;
    const actions = analytics?.actions || [];
    const directions = actions.find((row) => row.event === 'directions')?.clicks || 0;
    const featured = featuredCollection(content);
    const firstName = (S.user?.name || S.user?.email || '').split(/[@ ]/)[0] || 'there';
    const pending = S.dirty || !!S.pending;

    const drinkClicks = actions.find((row) => row.event === 'drink')?.clicks || 0;
    const topDrinkId = analytics?._topDrink;
    const topDrink = topDrinkId ? content.drinks.find((drink) => drink.id === topDrinkId) : null;
    const topCategory = topDrink
      ? content.categories.find((category) => category.id === topDrink.categoryId)?.name
      : null;

    root.innerHTML = `
      <section class="overview">
        <div class="overview__welcome">
          <div>
            <p class="eyebrow">${esc(formatDate(new Date().toISOString()))}</p>
            <h1>${esc(timeOfDay())}, ${esc(firstName)}!</h1>
            <p class="overview__lede">Here's what's happening with the Orchard Trail Nutrition website.</p>
          </div>
          <div class="overview__status ${pending ? 'is-pending' : 'is-live'}">
            <span class="dot"></span>
            <div>
              <strong>${pending ? 'You have changes waiting' : 'Your website is up to date'}</strong>
              <span>${
                published
                  ? 'Last published ' + timeAgo(published.publishedAt) + ' (version ' + published.version + ')'
                  : 'Not published yet'
              }</span>
            </div>
          </div>
        </div>

        <div class="metrics">
          <article class="metric">
            <span class="metric__icon">${icon('analytics', 18)}</span>
            <p class="metric__label">Visitors this month</p>
            <p class="metric__value">${analytics?.hasData ? analytics.totals.visitors.toLocaleString() : '—'}</p>
            <p class="metric__note">${
              analytics?.hasData ? analytics.totals.views.toLocaleString() + ' page views' : 'Starting to collect'
            }</p>
          </article>
          <article class="metric">
            <span class="metric__icon">${icon('pin', 18)}</span>
            <p class="metric__label">Get Directions clicks</p>
            <p class="metric__value">${analytics?.hasData ? directions.toLocaleString() : '—'}</p>
            <p class="metric__note">Last 30 days</p>
          </article>
          <article class="metric">
            <span class="metric__icon">${icon('menu', 18)}</span>
            <p class="metric__label">Drinks on the menu</p>
            <p class="metric__value">${content.drinks.filter((drink) => !drink.hidden).length}</p>
            <p class="metric__note">${content.categories.length} categories · ${content.drinks.filter((d) => d.featured).length} featured</p>
          </article>
          <article class="metric">
            <span class="metric__icon">${icon('sparkle', 18)}</span>
            <p class="metric__label">Seasonal collection</p>
            <p class="metric__value metric__value--small">${esc(featured ? featured.name : 'None yet')}</p>
            <p class="metric__note">${
              featured
                ? content.drinks.filter((drink) => (drink.collectionIds || []).includes(featured.id)).length + ' drinks'
                : 'Create one under Seasonal Specials'
            }</p>
          </article>
        </div>

        <div class="columns">
          <section class="card-panel">
            <header class="card-panel__head"><h2>Quick actions</h2><p>The things owners do most.</p></header>
            <div class="quick-actions">
              <a class="quick" href="#editor"><span>${icon('editor', 20)}</span><strong>Edit Website</strong><small>Change any text or photo</small></a>
              <a class="quick" href="#menu/new"><span>${icon('plus', 20)}</span><strong>Add a Drink</strong><small>New drink in under a minute</small></a>
              <a class="quick" href="#seasonal"><span>${icon('seasonal', 20)}</span><strong>Update Seasonal Menu</strong><small>Monthly boards</small></a>
              <a class="quick" href="#media"><span>${icon('media', 20)}</span><strong>Upload Photos</strong><small>From your phone or computer</small></a>
              <a class="quick" href="#analytics"><span>${icon('analytics', 20)}</span><strong>View Analytics</strong><small>How the site is doing</small></a>
              <a class="quick" href="#business/hours"><span>${icon('clock', 20)}</span><strong>Change Store Hours</strong><small>Open, closed, holidays</small></a>
            </div>
          </section>

          <section class="card-panel">
            <header class="card-panel__head"><h2>This month</h2><p>Real traffic, collected on your own website.</p></header>
            ${
              analytics?.hasData
                ? `<div class="mini-chart">${miniBars(analytics.series)}</div>
                   ${
                     analytics.series.filter((row) => row.views).length < 3
                       ? '<p class="mini-note">The chart fills in as more days are collected — the numbers below are the real ones so far.</p>'
                       : ''
                   }
                   <div class="mini-stats">
                     <div><strong>${analytics.totals.visitors}</strong><span>visitors</span></div>
                     <div><strong>${analytics.totals.views}</strong><span>page views</span></div>
                     <div><strong>${drinkClicks}</strong><span>drink clicks</span></div>
                   </div>
                   ${
                     topCategory
                       ? `<p class="mini-note">Most opened menu category: <strong>${esc(topCategory)}</strong></p>`
                       : ''
                   }`
                : emptyState(
                    'analytics',
                    'Analytics starts collecting now',
                    'Visits and customer actions on your live website are counted privately, without cookies. Numbers appear here as visitors arrive.',
                    '<a class="btn btn--ghost" href="#analytics">See the analytics page</a>'
                  )
            }
          </section>
        </div>

        <div class="columns">
          <section class="card-panel">
            <header class="card-panel__head"><h2>Current seasonal menu</h2><a class="link" href="#seasonal">Manage</a></header>
            ${
              featured
                ? `<div class="seasonal-summary">
                     ${featured.image ? `<img src="${esc(featured.image)}" alt="">` : `<span class="seasonal-summary__ph">${icon('seasonal', 22)}</span>`}
                     <div>
                       <h3>${esc(featured.name)}</h3>
                       <p>${esc(
                         featured.startDate
                           ? formatDate(featured.startDate) + (featured.endDate ? ' – ' + formatDate(featured.endDate) : '')
                           : 'No dates set'
                       )}</p>
                       <p class="muted">${content.drinks.filter((d) => (d.collectionIds || []).includes(featured.id)).length} drinks · ${
                         featured.featured ? 'Featured on the homepage' : 'Not featured'
                       }</p>
                     </div>
                   </div>`
                : emptyState('seasonal', 'No seasonal menu yet', 'Create a collection to show a monthly board on the website.')
            }
          </section>

          <section class="card-panel">
            <header class="card-panel__head"><h2>Recent activity</h2><a class="link" href="#account">History</a></header>
            <ul class="activity">
              ${
                overviewData.activity?.length
                  ? overviewData.activity
                      .slice(0, 6)
                      .map(
                        (item) =>
                          `<li><span class="activity__dot"></span><div><strong>${esc(item.action)}</strong>${
                            item.detail ? `<p>${esc(item.detail)}</p>` : ''
                          }<small>${esc(timeAgo(item.ts))}</small></div></li>`
                      )
                      .join('')
                  : '<li class="muted">Nothing yet. Your changes will be listed here.</li>'
              }
            </ul>
          </section>
        </div>
      </section>`;
  }
};

export function resetOverview() {
  overviewData = null;
}

function miniBars(series = []) {
  const last = series.slice(-21);
  if (!last.length) return '';
  const max = Math.max(1, ...last.map((row) => row.views || 0));
  return last
    .map((row) => {
      const height = Math.max(4, Math.round(((row.views || 0) / max) * 64));
      return `<span class="mini-chart__bar" style="height:${height}px" title="${esc(row.day)}: ${row.views} views"></span>`;
    })
    .join('');
}

function featuredCollection(content) {
  const collections = content.collections || [];
  return (
    collections.find((collection) => collection.featured && collection.active !== false && !collection.archived) ||
    collections.find((collection) => collection.active !== false && !collection.archived) ||
    null
  );
}

/* =====================================================================
   Website editor
   ===================================================================== */

const editorState = {
  mounted: false,
  root: null,
  stage: null,
  panel: null,
  iframe: null,
  device: 'desktop'
};

export const editor = {
  title: 'Website Editor',
  subtitle: 'Click anything on your website to change it.',
  fullbleed: true,
  render(root) {
    editorState.root = root;
    editorState.mounted = true;
    root.innerHTML = `
      <div class="editor">
        <div class="editor__bar">
          <div class="segmented" role="group" aria-label="Preview size">
            ${deviceButton('desktop', 'Desktop')}
            ${deviceButton('tablet', 'Tablet')}
            ${deviceButton('mobile', 'Mobile')}
          </div>
          <div class="editor__bar-right">
            <button class="icon-btn" type="button" data-action="undo" title="Undo (Ctrl+Z)">${icon('undo', 18)}</button>
            <button class="icon-btn" type="button" data-action="redo" title="Redo (Ctrl+Shift+Z)">${icon('redo', 18)}</button>
            <button class="btn btn--ghost btn--small" type="button" data-action="refresh">${icon('restore', 16)} Refresh preview</button>
            <button class="btn btn--ghost btn--small" type="button" data-action="full-preview">${icon('external', 16)} Open full size</button>
          </div>
        </div>
        <div class="editor__body">
          <div class="editor__stage is-${editorState.device}" data-stage>
            <iframe title="Your website preview" data-frame></iframe>
          </div>
          <aside class="editor__panel" data-panel></aside>
        </div>
      </div>`;

    editorState.stage = root.querySelector('[data-stage]');
    editorState.panel = root.querySelector('[data-panel]');
    editorState.iframe = root.querySelector('[data-frame]');
    S.iframe = editorState.iframe;
    S.iframeReady = false;
    /* The preview is built in the browser from the working draft, so it shows
       unsaved changes instantly and needs no server round trip. */
    drawPreview();
    window.addEventListener('otn:preview-refresh', drawPreview);
    editorState.iframe.addEventListener('load', () => {
      S.iframeReady = true;
      /* start the preview at the top of the page, not wherever it was last */
      try {
        editorState.iframe.contentWindow.scrollTo(0, 0);
      } catch {
        /* the frame may not be readable for a moment */
      }
    });

    root.querySelectorAll('[data-device]').forEach((button) => {
      button.addEventListener('click', () => {
        editorState.device = button.getAttribute('data-device');
        S.device = editorState.device;
        editorState.stage.className = 'editor__stage is-' + editorState.device;
        root.querySelectorAll('[data-device]').forEach((other) => other.classList.toggle('is-active', other === button));
      });
    });
    root.querySelectorAll('[data-device]').forEach((button) =>
      button.classList.toggle('is-active', button.getAttribute('data-device') === editorState.device)
    );
    root.querySelector('[data-action="undo"]').addEventListener('click', () => {
      if (undo()) toast('Undone.', 'info', 1800);
    });
    root.querySelector('[data-action="redo"]').addEventListener('click', () => {
      if (redo()) toast('Redone.', 'info', 1800);
    });
    root.querySelector('[data-action="refresh"]').addEventListener('click', () => {
      drawPreview();
    });
    root.querySelector('[data-action="full-preview"]').addEventListener('click', () => {
      const page = renderPage(S.content, { edit: true, origin: location.origin });
      const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    });

    refreshPanel();
  },
  refresh() {
    if (!editorState.mounted) return;
    refreshPanel();
  },
  unmount() {
    editorState.mounted = false;
    window.removeEventListener('otn:preview-refresh', drawPreview);
    S.iframe = null;
  }
};

function drawPreview() {
  if (!editorState.iframe || !S.content) return;
  try {
    editorState.iframe.srcdoc = renderPage(S.content, { edit: true, origin: location.origin });
  } catch (error) {
    toast('The preview could not be drawn. Reload the dashboard.', 'error');
  }
}

function deviceButton(device, label) {
  return `<button type="button" class="${device === 'desktop' ? 'is-active' : ''}" data-device="${device}">${icon(
    device,
    16
  )}<span>${label}</span></button>`;
}

function selectionOf() {
  return S.selection;
}

function sectionOfPath(path) {
  if (!path || !path.startsWith('sec.')) return null;
  const id = path.split('.')[1];
  return S.content.sections.find((section) => section.id === id) || null;
}

function refreshPanel() {
  const panel = editorState.panel;
  if (!panel) return;
  const selection = selectionOf();
  if (!selection) {
    panel.innerHTML = sectionsPanel();
    wireSectionsPanel(panel);
    return;
  }
  panel.innerHTML = selectionPanel(selection);
  wireSelectionPanel(panel, selection);
}

function sectionsPanel() {
  const content = S.content;
  return `
    <div class="panel">
      <div class="panel__head">
        <h2>Page sections</h2>
        <p>Drag to reorder, or hide a section. Everything else is edited by clicking it.</p>
      </div>
      <ol class="section-list" data-sections>
        ${content.sections
          .map(
            (section, index) => `
          <li class="section-item" draggable="true" data-section-id="${esc(section.id)}" data-index="${index}">
            <span class="section-item__handle" title="Drag to reorder">${icon('drag', 16)}</span>
            <div class="section-item__text">
              <strong>${esc(section.name)}</strong>
              <small>${section.visible === false ? 'Hidden from the website' : 'Visible'}</small>
            </div>
            <button class="icon-btn" type="button" data-action="visibility" data-id="${esc(section.id)}" title="${
              section.visible === false ? 'Show this section' : 'Hide this section'
            }">${icon(section.visible === false ? 'eyeOff' : 'eye', 16)}</button>
            <button class="icon-btn" type="button" data-action="up" data-id="${esc(section.id)}" title="Move up">${
              icon('chevron', 16)
            }</button>
          </li>`
          )
          .join('')}
      </ol>
      <div class="panel__tip">
        ${icon('sparkle', 16)}
        <p>Click any headline, paragraph, button or photo in the preview to edit it. Changes save to your draft automatically.</p>
      </div>
    </div>`;
}

function wireSectionsPanel(panel) {
  let dragged = null;
  panel.querySelectorAll('[data-section-id]').forEach((item) => {
    item.addEventListener('dragstart', (event) => {
      dragged = item;
      item.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.getAttribute('data-section-id'));
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('is-dragging');
      dragged = null;
    });
    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!dragged || dragged === item) return;
      const list = item.parentElement;
      const items = [...list.children];
      if (items.indexOf(dragged) < items.indexOf(item)) item.after(dragged);
      else item.before(dragged);
    });
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      const order = [...panel.querySelectorAll('[data-section-id]')].map((node) => node.getAttribute('data-section-id'));
      reorderSections(order);
    });
  });

  panel.querySelectorAll('[data-action="visibility"]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = S.content.sections.find((item) => item.id === button.getAttribute('data-id'));
      if (!section) return;
      pushHistory('section visibility');
      section.visible = section.visible === false;
      structuralChange();
      refreshPanel();
    });
  });
  panel.querySelectorAll('[data-action="up"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-id');
      const order = S.content.sections.map((section) => section.id);
      const index = order.indexOf(id);
      if (index <= 0) return;
      order.splice(index - 1, 0, order.splice(index, 1)[0]);
      reorderSections(order);
    });
  });
}

function reorderSections(order) {
  pushHistory('section order');
  S.content.sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  structuralChange();
  postToPreview({ type: 'order', ids: order });
  refreshPanel();
}

function breadcrumb(path) {
  const parts = String(path).split('.');
  if (parts[0] === 'sec') {
    const section = sectionOfPath(path);
    return esc(section ? section.name : 'Section');
  }
  if (parts[0] === 'business') return 'Business information';
  if (parts[0] === 'branding') return 'Design & branding';
  if (parts[0] === 'seo') return 'Search settings';
  if (parts[0] === 'ann') return 'Announcement';
  if (parts[0] === 'nav') return 'Navigation';
  if (parts[0] === 'footer') return 'Footer';
  if (parts[0] === 'col') return 'Seasonal collection';
  if (parts[0] === 'drink') return 'Drink';
  if (parts[0] === 'cat') return 'Menu category';
  return 'Website';
}

function selectionPanel(selection) {
  const { path, kind, label } = selection;
  const value = getValue(path);
  const head = `
    <div class="panel__head">
      <button class="panel__back" type="button" data-action="clear">${icon('chevron', 14)} All sections</button>
      <p class="panel__crumb">${breadcrumb(path)}</p>
      <h2>${esc(label)}</h2>
    </div>`;

  if (kind === 'drink') {
    return `<div class="panel">${head}
      <p class="muted">This card is a drink from your menu. Everything about it — name, description, price, photo, availability — is in Menu &amp; Drinks.</p>
      <button class="btn btn--primary btn--block" type="button" data-action="edit-drink">Edit this drink</button>
    </div>`;
  }

  if (kind === 'image') {
    const isPhoto = typeof value === 'string' && value;
    return `<div class="panel">${head}
      <div class="panel__image">${
        isPhoto ? `<img src="${esc(value)}" alt="">` : `<span class="panel__image-empty">${icon('image', 24)} No photo yet</span>`
      }</div>
      <div class="panel__stack">
        <button class="btn btn--primary btn--block" type="button" data-action="choose">${icon('media', 16)} Choose from library</button>
        <button class="btn btn--ghost btn--block" type="button" data-action="upload">${icon('upload', 16)} Upload from this device</button>
        <button class="btn btn--ghost btn--block" type="button" data-action="crop" ${isPhoto ? '' : 'disabled'}>${icon(
          'image',
          16
        )} Crop for this spot</button>
        ${isPhoto ? `<button class="btn btn--ghost btn--block btn--danger-text" type="button" data-action="remove">Remove photo</button>` : ''}
      </div>
      ${
        selection.altPath
          ? `<label class="field"><span class="field__label">Description for screen readers</span>
              <input class="input" data-alt value="${esc(getValue(selection.altPath) || '')}" placeholder="What is in this photo?">
              <span class="field__hint">A short description helps visitors who cannot see the image.</span></label>`
          : ''
      }
      <input type="file" accept="image/*" data-file hidden>
    </div>`;
  }

  if (kind === 'link') {
    const link = value && typeof value === 'object' ? value : { label: '', href: '' };
    const sectionLinks = S.content.sections
      .filter((section) => section.visible !== false)
      .map((section) => ({
        value: '#' + (section.id === 'hero' ? 'top' : section.id === 'seasonal' ? 'november' : section.id),
        label: 'Jump to ' + section.name
      }));
    return `<div class="panel">${head}
      <label class="field"><span class="field__label">Button text</span>
        <input class="input" data-link-label value="${esc(link.label)}"></label>
      <label class="field"><span class="field__label">Where it goes</span>
        <input class="input" data-link-href value="${esc(link.href || '')}" placeholder="#menu or https://…">
        <span class="field__hint">Use <code>#menu</code> for a section of your site, or a full web address for another website.</span></label>
      <label class="field"><span class="field__label">Or pick a section</span>
        <select class="input" data-link-pick>
          <option value="">Choose a section…</option>
          ${sectionLinks.map((option) => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join('')}
        </select></label>
      <div class="panel__tip">${icon('sparkle', 16)}<p>Changing the link does not change the text on the button.</p></div>
    </div>`;
  }

  const text = value == null ? '' : String(value);
  const multiline = kind === 'multiline' || text.length > 90;
  const listActions = selection.listPath
    ? `<div class="panel__list-tools">
         <button class="btn btn--ghost btn--small" type="button" data-action="add-item">${icon('plus', 14)} Add another</button>
         <button class="btn btn--ghost btn--small" type="button" data-action="move-up" ${
           selection.index === 0 ? 'disabled' : ''
         }>Move up</button>
         <button class="btn btn--ghost btn--small" type="button" data-action="move-down">Move down</button>
         <button class="btn btn--ghost btn--small btn--danger-text" type="button" data-action="remove-item">${icon(
           'trash',
           14
         )} Delete this one</button>
       </div>`
    : '';

  return `<div class="panel">${head}
    <label class="field"><span class="field__label">${esc(label)}</span>
      ${
        multiline
          ? `<textarea class="input" rows="${Math.min(8, Math.max(3, Math.ceil(text.length / 42)))}" data-text>${esc(text)}</textarea>`
          : `<input class="input" data-text value="${esc(text)}">`
      }
      <span class="field__hint">Changes appear in the preview as you type and save automatically.</span>
    </label>
    ${listActions}
    <div class="panel__tip">${icon('check', 16)}<p>Nothing is public until you press <strong>Publish website</strong>.</p></div>
  </div>`;
}

function wireSelectionPanel(panel, selection) {
  const { path, kind } = selection;
  const clear = panel.querySelector('[data-action="clear"]');
  clear?.addEventListener('click', () => {
    S.selection = null;
    refreshPanel();
  });

  if (kind === 'drink') {
    panel.querySelector('[data-action="edit-drink"]')?.addEventListener('click', () => {
      const id = path.split('.')[1];
      openDrinkDrawer(id);
    });
    return;
  }

  if (kind === 'image') {
    const file = panel.querySelector('[data-file]');
    const applyImage = (url, alt) => {
      pushHistory('image');
      setValue(path, url, { kind: 'image', preview: true, altPath: selection.altPath, altValue: alt });
      if (selection.altPath && alt) setValue(selection.altPath, alt, { preview: false });
      reloadPreview(300);
      refreshPanel();
    };
    panel.querySelector('[data-action="choose"]')?.addEventListener('click', () => {
      pickImage({ onChoose: (choice) => applyImage(choice.url, choice.alt) });
    });
    panel.querySelector('[data-action="upload"]')?.addEventListener('click', () => file.click());
    file?.addEventListener('change', async () => {
      if (!file.files?.length) return;
      const uploaded = await uploadFiles(file.files, { folder: 'Website' });
      if (uploaded[0]) applyImage(uploaded[0].url, uploaded[0].alt || '');
    });
    panel.querySelector('[data-action="crop"]')?.addEventListener('click', () => {
      const current = getValue(path);
      if (!current) return;
      cropImage({
        url: current,
        onDone: async (cropped) => {
          const uploaded = await uploadFiles([cropped], { folder: 'Website' });
          if (uploaded[0]) applyImage(uploaded[0].url, '');
        }
      });
    });
    panel.querySelector('[data-action="remove"]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Remove this photo?',
        message: 'The photo will be taken off this part of the website. The file stays in your photo library.',
        confirmLabel: 'Remove photo',
        danger: true
      });
      if (!ok) return;
      pushHistory('image');
      setValue(path, '', { kind: 'image', preview: false });
      reloadPreview(200);
      refreshPanel();
    });
    const alt = panel.querySelector('[data-alt]');
    alt?.addEventListener('input', () => {
      if (selection.altPath) setValue(selection.altPath, alt.value, { preview: false });
    });
    return;
  }

  if (kind === 'link') {
    const labelInput = panel.querySelector('[data-link-label]');
    const hrefInput = panel.querySelector('[data-link-href]');
    let current = getValue(path);
    if (!current || typeof current !== 'object') current = { label: '', href: '' };
    const write = () => {
      const next = { label: labelInput.value, href: hrefInput.value };
      setValue(path, next, { kind: 'link', preview: true });
    };
    labelInput?.addEventListener('input', write);
    hrefInput?.addEventListener('input', write);
    panel.querySelector('[data-link-pick]')?.addEventListener('change', (event) => {
      if (!event.target.value) return;
      hrefInput.value = event.target.value;
      write();
    });
    return;
  }

  const input = panel.querySelector('[data-text]');
  input?.addEventListener('input', () => {
    setValue(path, input.value, { kind: input.tagName === 'TEXTAREA' ? 'multiline' : 'text', preview: true });
  });

  const listPath = selection.listPath;
  const index = selection.index;
  if (listPath) {
    const list = getValue(listPath);
    panel.querySelector('[data-action="add-item"]')?.addEventListener('click', () => {
      if (!Array.isArray(list)) return;
      const template = list[index];
      let copy;
      if (template && typeof template === 'object') {
        copy = JSON.parse(JSON.stringify(template));
        Object.keys(copy).forEach((key) => {
          if (typeof copy[key] === 'string') copy[key] = '';
        });
      } else {
        copy = '';
      }
      list.splice(index + 1, 0, copy);
      structuralChange();
      toast('Added. Fill in the new line and publish when ready.', 'success');
      refreshPanel();
    });
    panel.querySelector('[data-action="remove-item"]')?.addEventListener('click', async () => {
      if (!Array.isArray(list)) return;
      const ok = await confirmDialog({
        title: 'Remove this line?',
        message: 'It will disappear from the website once you publish.',
        confirmLabel: 'Remove',
        danger: true
      });
      if (!ok) return;
      list.splice(index, 1);
      S.selection = null;
      structuralChange();
      refreshPanel();
    });
    panel.querySelector('[data-action="move-up"]')?.addEventListener('click', () => {
      if (!Array.isArray(list) || index <= 0) return;
      list.splice(index - 1, 0, list.splice(index, 1)[0]);
      selection.index = index - 1;
      structuralChange();
      refreshPanel();
    });
    panel.querySelector('[data-action="move-down"]')?.addEventListener('click', () => {
      if (!Array.isArray(list) || index >= list.length - 1) return;
      list.splice(index + 1, 0, list.splice(index, 1)[0]);
      selection.index = index + 1;
      structuralChange();
      refreshPanel();
    });
  }
}

/* Messages coming from the preview frame. */
export function handlePreviewMessage(data) {
  if (!editorState.mounted) return;
  if (data.type === 'ready') {
    S.iframeReady = true;
    return;
  }
  if (data.type === 'select') {
    S.selection = {
      path: data.path,
      kind: data.kind,
      label: data.label,
      altPath: data.altPath,
      listPath: data.listPath,
      index: data.index
    };
    refreshPanel();
    return;
  }
  if (data.type === 'add-image') {
    S.selection = { path: data.path, kind: 'image', label: 'Photo', altPath: '' };
    refreshPanel();
  }
}
