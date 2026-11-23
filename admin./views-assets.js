/* Photos & Media and Analytics. */

import { S, api, toast, emit, pushHistory, structuralChange } from './store.js';
import { icon, esc, modal, confirmDialog, formatDate, emptyState, field, promptDialog } from './ui.js';
import { dropzone, pickImage, cropImage, uploadFiles } from './media-lib.js';

const mediaState = { q: '', folder: 'all' };
const analyticsState = { range: '30d', from: '', to: '' };

/* =====================================================================
   Photos & media
   ===================================================================== */

export const media = {
  title: 'Photos & Media',
  subtitle: 'Every photo used on your website, in one place.',
  async render(root) {
    root.innerHTML = `<div class="skeleton-card"></div>`;
    let data;
    try {
      data = await api('/api/admin/media?q=' + encodeURIComponent(mediaState.q) + '&folder=' + encodeURIComponent(mediaState.folder));
      S.media = data.media || [];
      S.mediaFolders = data.folders || [];
    } catch (error) {
      root.innerHTML = emptyState('alert', 'Could not load your photos', esc(error.message));
      return;
    }

    const totalSize = S.media.reduce((sum, item) => sum + (item.size || 0), 0);
    root.innerHTML = `
      <section class="page-head">
        <div>
          <h1>Photos &amp; Media</h1>
          <p>${S.media.length} photos · ${(totalSize / 1024 / 1024).toFixed(1)} MB stored</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--primary" type="button" data-action="upload">${icon('upload', 18)} Upload photos</button>
        </div>
      </section>

      <div class="toolbar">
        <div class="toolbar__search">${icon('seo', 16)}
          <input class="input" type="search" placeholder="Search by file name" data-search value="${esc(mediaState.q)}">
        </div>
        <select class="input" data-folder>
          <option value="all">All folders</option>
          ${S.mediaFolders
            .map((folder) => `<option value="${esc(folder)}"${mediaState.folder === folder ? ' selected' : ''}>${esc(folder)}</option>`)
            .join('')}
        </select>
      </div>

      <div data-upload-host hidden></div>

      ${
        S.media.length
          ? `<div class="media-grid">
              ${S.media
                .map(
                  (item) => `<figure class="media-card" data-id="${esc(item.id)}">
                    <button class="media-card__image" type="button" data-open="${esc(item.id)}">
                      <img src="${esc(item.url)}" alt="${esc(item.alt || item.filename)}" loading="lazy">
                    </button>
                    <figcaption>
                      <strong title="${esc(item.filename)}">${esc(item.filename)}</strong>
                      <small>${esc(item.folder || 'Website')} · ${formatDate(item.created_at)}</small>
                      <span class="media-card__actions">
                        <button class="icon-btn" type="button" data-open="${esc(item.id)}" title="Details and cropping">${icon('editor', 15)}</button>
                        <button class="icon-btn" type="button" data-copy="${esc(item.url)}" title="Copy photo link">${icon('copy', 15)}</button>
                        <button class="icon-btn icon-btn--danger" type="button" data-delete="${esc(item.id)}" title="Delete">${icon('trash', 15)}</button>
                      </span>
                    </figcaption>
                  </figure>`
                )
                .join('')}
            </div>`
          : emptyState(
              'media',
              'No photos yet',
              'Upload photos of your drinks, the shop or your team. They are stored safely and can be used anywhere on the website.',
              '<button class="btn btn--primary" type="button" data-action="upload">Upload your first photo</button>'
            )
      }`;
  }
};

function findMedia(id) {
  return S.media.find((item) => item.id === id);
}

export function wireMedia(root) {
  const refresh = () => {
    root.innerHTML = '';
    media.render(root);
    wireMedia(root);
  };

  const host = root.querySelector('[data-upload-host]');
  const openUploader = () => {
    host.hidden = false;
    host.innerHTML = '';
    host.appendChild(
      dropzone({
        folder: mediaState.folder === 'all' ? 'Website' : mediaState.folder,
        onUploaded: () => refresh()
      })
    );
    host.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  root.querySelector('[data-action="upload"]')?.addEventListener('click', openUploader);

  const search = root.querySelector('[data-search]');
  search?.addEventListener(
    'input',
    (() => {
      let timer = 0;
      return () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          mediaState.q = search.value;
          refresh();
          const next = root.querySelector('[data-search]');
          next?.focus();
          next?.setSelectionRange(next.value.length, next.value.length);
        }, 200);
      };
    })()
  );
  root.querySelector('[data-folder]')?.addEventListener('change', (event) => {
    mediaState.folder = event.target.value;
    refresh();
  });

  root.querySelectorAll('[data-copy]').forEach((button) =>
    button.addEventListener('click', async () => {
      const url = location.origin + button.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(url);
        toast('Photo link copied.', 'success');
      } catch {
        toast(url, 'info', 6000);
      }
    })
  );

  root.querySelectorAll('[data-open]').forEach((button) =>
    button.addEventListener('click', () => openMediaDetail(button.getAttribute('data-open'), refresh))
  );

  root.querySelectorAll('[data-delete]').forEach((button) =>
    button.addEventListener('click', () => deleteMedia(button.getAttribute('data-delete'), refresh))
  );
}

function openMediaDetail(id, refresh) {
  const item = findMedia(id);
  if (!item) return;
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="media-detail">
      <div class="media-detail__preview"><img src="${esc(item.url)}" alt="${esc(item.alt || '')}"></div>
      <div class="media-detail__fields">
        ${field('File name', `<input class="input" data-filename value="${esc(item.filename)}">`)}
        ${field('Description', `<input class="input" data-alt value="${esc(item.alt || '')}" placeholder="What is in this photo?">`, 'Helps visitors who cannot see the image, and helps Google understand it.')}
        ${field('Folder', `<input class="input" data-folder-name value="${esc(item.folder || 'Website')}" list="folder-list">
          <datalist id="folder-list">${S.mediaFolders.map((folder) => `<option value="${esc(folder)}">`).join('')}</datalist>`)}
        <p class="muted">Uploaded ${formatDate(item.created_at)} · ${(item.size || 0) / 1024 < 1024 ? Math.round((item.size || 0) / 1024) + ' KB' : ((item.size || 0) / 1024 / 1024).toFixed(1) + ' MB'}</p>
      </div>
    </div>`;
  const dialog = modal({
    title: item.filename,
    body,
    wide: true,
    footer: `<button class="btn btn--ghost btn--danger-text" type="button" data-delete>${icon('trash', 15)} Delete</button>
      <span class="spacer"></span>
      <button class="btn btn--ghost" type="button" data-crop>${icon('image', 15)} Crop</button>
      <button class="btn btn--primary" type="button" data-save>Save details</button>`
  });

  dialog.root.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      await api('/api/admin/media/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: {
          filename: body.querySelector('[data-filename]').value,
          alt: body.querySelector('[data-alt]').value,
          folder: body.querySelector('[data-folder-name]').value
        }
      });
      toast('Photo details saved.', 'success');
      dialog.close();
      refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
  dialog.root.querySelector('[data-crop]').addEventListener('click', () => {
    cropImage({
      url: item.url,
      onDone: async (file) => {
        const uploaded = await uploadFiles([file], { folder: item.folder || 'Website', alt: item.alt || '' });
        if (uploaded[0]) {
          toast('Cropped copy added to your library.', 'success');
          dialog.close();
          refresh();
        }
      }
    });
  });
  dialog.root.querySelector('[data-delete]').addEventListener('click', () => {
    dialog.close();
    deleteMedia(id, refresh);
  });
}

async function deleteMedia(id, refresh) {
  const item = findMedia(id);
  const ok = await confirmDialog({
    title: 'Delete this photo?',
    message: 'If the photo is used on your website you will be asked to replace it first. This cannot be undone.',
    confirmLabel: 'Delete photo',
    danger: true
  });
  if (!ok) return;
  try {
    await api('/api/admin/media/' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Photo deleted.', 'success');
    refresh();
  } catch (error) {
    if (error.status === 409) {
      const usedBy = error.data?.usedBy || [];
      modal({
        title: 'This photo is still in use',
        body: `<p class="modal__text">It appears on the ${usedBy.join(' and ') || 'website'}. Replace it there first, then delete it here.</p>`,
        footer: '<button class="btn btn--primary" type="button" data-close>Got it</button>'
      }).root.querySelector('[data-close]').addEventListener('click', () => document.querySelectorAll('.modal').forEach((m) => m.remove()));
    } else {
      toast(error.message, 'error');
    }
  }
  void item;
}

/* =====================================================================
   Analytics
   ===================================================================== */

const ACTION_META = {
  directions: { label: 'Get Directions clicks', hint: 'Someone asked for directions to the shop.' },
  phone: { label: 'Phone number clicks', hint: 'A visitor tapped your phone number.' },
  instagram: { label: 'Instagram clicks', hint: 'A visitor opened your Instagram.' },
  facebook: { label: 'Facebook clicks', hint: 'A visitor opened your Facebook page.' },
  menu: { label: 'Menu link clicks', hint: 'Someone jumped to the menu.' },
  email: { label: 'Email clicks', hint: 'A visitor started an email to you.' },
  announcement: { label: 'Announcement clicks', hint: 'Someone followed your announcement link.' },
  drink: { label: 'Drink card clicks', hint: 'A visitor tapped a drink to look closer.' }
};

export const analytics = {
  title: 'Analytics',
  subtitle: 'Real numbers from visits to your own website.',
  async render(root) {
    root.innerHTML = `<div class="skeleton-card"></div>`;
    if (!S.content) return;
    let report;
    try {
      const params = new URLSearchParams({ range: analyticsState.range });
      if (analyticsState.range === 'custom') {
        params.set('from', analyticsState.from);
        params.set('to', analyticsState.to);
      }
      report = await api('/api/admin/analytics?' + params.toString());
      S.analytics = report;
    } catch (error) {
      root.innerHTML = emptyState('alert', 'Analytics are not available yet', esc(error.message));
      return;
    }

    const topDrink = report.topDrinkId ? S.content.drinks.find((drink) => drink.id === report.topDrinkId) : null;
    const actions = report.actions || [];
    const change = report.change;

    root.innerHTML = `
      <section class="page-head">
        <div>
          <h1>Analytics</h1>
          <p>Private, cookie-free counting on your own website.</p>
        </div>
        <div class="page-head__actions">
          <div class="segmented" data-range>
            ${['today', '7d', '30d', '90d']
              .map(
                (range) =>
                  `<button type="button" data-value="${range}" class="${analyticsState.range === range ? 'is-active' : ''}">${
                    range === 'today' ? 'Today' : range.replace('d', ' days').replace('7 days', '7 days')
                  }</button>`
              )
              .join('')}
            <button type="button" data-value="custom" class="${analyticsState.range === 'custom' ? 'is-active' : ''}">Custom</button>
          </div>
        </div>
      </section>

      ${
        analyticsState.range === 'custom'
          ? `<div class="toolbar">
              <label class="field field--inline"><span class="field__label">From</span><input class="input" type="date" data-from value="${esc(analyticsState.from)}"></label>
              <label class="field field--inline"><span class="field__label">To</span><input class="input" type="date" data-to value="${esc(analyticsState.to)}"></label>
              <button class="btn btn--primary btn--small" type="button" data-apply>Show this range</button>
            </div>`
          : ''
      }

      ${
        report.hasData
          ? `
        <div class="metrics metrics--analytics">
          <article class="metric"><p class="metric__label">Visitors</p><p class="metric__value">${report.totals.visitors.toLocaleString()}</p>
            <p class="metric__note">${changeText(change.visitors, change, 'visitors')}</p></article>
          <article class="metric"><p class="metric__label">Page views</p><p class="metric__value">${report.totals.views.toLocaleString()}</p>
            <p class="metric__note">${changeText(change.views, change, 'views')}</p></article>
          <article class="metric"><p class="metric__label">Visits</p><p class="metric__value">${report.totals.visits.toLocaleString()}</p>
            <p class="metric__note">Separate browsing sessions</p></article>
          <article class="metric"><p class="metric__label">Average time</p><p class="metric__value">${formatSeconds(report.totals.engagementSeconds)}</p>
            <p class="metric__note">How long people stay</p></article>
          <article class="metric"><p class="metric__label">Returning visitors</p><p class="metric__value">${report.totals.returning.toLocaleString()}</p>
            <p class="metric__note">Visited on more than one day</p></article>
        </div>

        <section class="card-panel">
          <header class="card-panel__head">
            <div><h2>Visitors by day</h2><p>${esc(report.label)}</p></div>
          </header>
          <div class="chart">${lineChart(report.series)}</div>
        </section>

        <div class="columns columns--even">
          <section class="card-panel">
            <header class="card-panel__head"><h2>Most viewed pages</h2></header>
            <ul class="bar-list">
              ${
                (report.pages || []).length
                  ? report.pages
                      .map(
                        (page) => `<li><span class="bar-list__label">${esc(pageLabel(page.path))}</span>
                        <span class="bar-list__bar"><i style="width:${percentOf(page.views, report.pages[0].views)}%"></i></span>
                        <span class="bar-list__value">${page.views}</span></li>`
                      )
                      .join('')
                  : '<li class="muted">No page views in this range.</li>'
              }
            </ul>
          </section>

          <section class="card-panel">
            <header class="card-panel__head"><h2>Where visitors come from</h2></header>
            <ul class="bar-list">
              ${
                (report.sources || []).length
                  ? report.sources
                      .map(
                        (source) => `<li><span class="bar-list__label">${esc(source.source === 'Direct' ? 'Direct or unknown' : source.source)}</span>
                        <span class="bar-list__bar"><i style="width:${percentOf(source.views, report.sources[0].views)}%"></i></span>
                        <span class="bar-list__value">${source.views}</span></li>`
                      )
                      .join('')
                  : '<li class="muted">No referrers recorded yet.</li>'
              }
            </ul>
          </section>
        </div>

        <div class="columns columns--even">
          <section class="card-panel">
            <header class="card-panel__head"><h2>Important customer actions</h2><p>Button taps on your website.</p></header>
            <div class="actions-list">
              ${
                actions.length
                  ? actions
                      .map(
                        (action) => `<div class="action-row">
                          <span class="action-row__icon">${icon(actionIcon(action.event), 16)}</span>
                          <div class="action-row__text">
                            <strong>${esc(ACTION_META[action.event]?.label || action.event)}</strong>
                            <small>${esc(ACTION_META[action.event]?.hint || '')}</small>
                          </div>
                          <span class="action-row__value">${action.clicks}</span>
                        </div>`
                      )
                      .join('')
                  : '<p class="muted">No customer actions recorded in this range yet.</p>'
              }
            </div>
            <p class="fine-print">These count clicks on your website — not completed visits, calls or purchases.</p>
          </section>

          <section class="card-panel">
            <header class="card-panel__head"><h2>Devices</h2><p>What customers use to browse.</p></header>
            <ul class="bar-list">
              ${
                (report.devices || []).length
                  ? report.devices
                      .map(
                        (device) => `<li><span class="bar-list__label">${esc(capitalise(device.device || 'unknown'))}</span>
                        <span class="bar-list__bar"><i style="width:${percentOf(device.visitors, report.devices[0].visitors)}%"></i></span>
                        <span class="bar-list__value">${device.visitors}</span></li>`
                      )
                      .join('')
                  : '<li class="muted">No device data yet.</li>'
              }
            </ul>
            ${
              topDrink
                ? `<p class="mini-note">Most opened drink: <strong>${esc(topDrink.name)}</strong></p>`
                : ''
            }
          </section>
        </div>
      `
          : emptyState(
              'analytics',
              'No visits recorded yet',
              'Analytics start working the moment someone opens your live website. This page stays empty until the first visitor arrives — nothing is invented.',
              '<a class="btn btn--primary" href="/" target="_blank" rel="noopener">Open the live website</a>'
            )
      }

      <section class="card-panel card-panel--soft">
        <header class="card-panel__head"><h2>How this works</h2></header>
        <ul class="plain-list">
          <li>${icon('lock', 16)} Visits are counted on your own website. No cookies, no advertising trackers, no selling data.</li>
          <li>${icon('clock', 16)} Visitors are counted with a rotating anonymous identifier, so numbers stay private.</li>
          <li>${icon('analytics', 16)} Numbers come from real visits only. Comparisons appear once there is enough history to be fair.</li>
          <li>${icon('sparkle', 16)} Want Google Analytics too? Add your measurement ID under <a href="#seo">SEO &amp; Settings</a>.</li>
        </ul>
      </section>`;
  }
};

function changeText(value, change, noun) {
  if (!change?.enoughData || value == null) return 'No comparison yet';
  if (value === 0) return 'About the same as before';
  const direction = value > 0 ? 'up' : 'down';
  return `<span class="${value > 0 ? 'trend-up' : 'trend-down'}">${direction} ${Math.abs(value)}%</span> compared with the period before`;
  void noun;
}

function percentOf(value, max) {
  if (!max) return 0;
  return Math.max(3, Math.round((value / max) * 100));
}

function capitalise(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function formatSeconds(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return seconds + 's';
  return Math.round(seconds / 60) + ' min';
}

function pageLabel(path) {
  if (!path || path === '/') return 'Home page';
  return path.replace(/^\//, '').replace(/[?#].*$/, '') || 'Home page';
}

function actionIcon(event) {
  return (
    { directions: 'pin', phone: 'phone', instagram: 'image', facebook: 'image', menu: 'menu', email: 'mail', drink: 'sparkle' }[event] ||
    'sparkle'
  );
}

function lineChart(series = []) {
  const rows = series.length ? series : [{ day: new Date().toISOString().slice(0, 10), views: 0 }];
  const width = 760;
  const height = 220;
  const padding = { top: 18, right: 12, bottom: 26, left: 32 };
  const max = Math.max(4, ...rows.map((row) => row.views || 0));
  const stepX = rows.length > 1 ? (width - padding.left - padding.right) / (rows.length - 1) : 0;
  const point = (row, index) => {
    const x = padding.left + index * stepX;
    const y = height - padding.bottom - ((row.views || 0) / max) * (height - padding.top - padding.bottom);
    return [x, y];
  };
  const points = rows.map(point);
  const line = points.map(([x, y], index) => (index === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const area = `${line} L${points[points.length - 1][0]},${height - padding.bottom} L${points[0][0]},${height - padding.bottom} Z`;
  const gridLines = [0, 0.5, 1]
    .map((fraction) => {
      const y = padding.top + fraction * (height - padding.top - padding.bottom);
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart__grid"/>`;
    })
    .join('');
  const labels = rows
    .map((row, index) => {
      if (index % Math.ceil(rows.length / 6) !== 0 && index !== rows.length - 1) return '';
      const [x] = point(row, index);
      const date = new Date(row.day + 'T12:00:00');
      return `<text x="${x}" y="${height - 6}" class="chart__label" text-anchor="middle">${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="chart__svg" role="img" aria-label="Visitors by day">
    ${gridLines}
    <path d="${area}" class="chart__area"/>
    <path d="${line}" class="chart__line"/>
    ${points
      .map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="3.2" class="chart__dot"><title>${esc(rows[index].day)}: ${rows[index].views} views</title></circle>`)
      .join('')}
    ${labels}
    <text x="${padding.left - 8}" y="${padding.top + 4}" class="chart__axis" text-anchor="end">${max}</text>
    <text x="${padding.left - 8}" y="${height - padding.bottom}" class="chart__axis" text-anchor="end">0</text>
  </svg>`;
}

export function wireAnalytics(root) {
  root.querySelectorAll('[data-range] [data-value]').forEach((button) => {
    button.addEventListener('click', () => {
      analyticsState.range = button.getAttribute('data-value');
      S.analyticsRange = analyticsState.range;
      if (analyticsState.range === 'custom') {
        analyticsState.from = analyticsState.from || new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
        analyticsState.to = analyticsState.to || new Date().toISOString().slice(0, 10);
      }
      refreshAnalytics(root);
    });
  });
  root.querySelector('[data-apply]')?.addEventListener('click', () => {
    analyticsState.from = root.querySelector('[data-from]').value;
    analyticsState.to = root.querySelector('[data-to]').value;
    refreshAnalytics(root);
  });
}

function refreshAnalytics(root) {
  root.innerHTML = '<div class="skeleton-card"></div>';
  analytics.render(root).then(() => wireAnalytics(root));
}

void emit;
void pushHistory;
void structuralChange;
void pickImage;
void promptDialog;
