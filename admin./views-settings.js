/* Business information, design, search settings and account pages. */

import {
  S, api, setValue, getValue, pushHistory, emit, emitStatus, scheduleAutosave,
  structuralChange, toast, restoreVersion, refreshContent
} from './store.js';
import {
  icon, esc, modal, confirmDialog, formatDate, timeAgo, bindFields, field,
  textInput, textArea, selectInput, switchField, colorField, emptyState
} from './ui.js';
import { pickImage, uploadFiles } from './media-lib.js';
import { DAY_NAMES, hoursLabel } from '/shared/model.js';

const FONT_PAIRS = [
  { id: 'fraunces', name: 'Fraunces + Manrope', note: 'The current look — warm serif headlines.' },
  { id: 'marcellus', name: 'Marcellus + Karla', note: 'Classic, calm and a little dressier.' },
  { id: 'dmserif', name: 'DM Serif + DM Sans', note: 'Editorial headlines with clean text.' },
  { id: 'cormorant', name: 'Cormorant + Inter', note: 'Light, elegant and airy.' }
];

const BUTTON_STYLES = [
  { id: 'square', name: 'Square corners' },
  { id: 'soft', name: 'Soft corners' },
  { id: 'round', name: 'Pill buttons' }
];

const PALETTES = [
  { name: 'Orchard (original)', primary: '#203D31', secondary: '#A8B89C', accent: '#DD8951', background: '#F5F1E8', ink: '#252723' },
  { name: 'Harvest', primary: '#3B2A1E', secondary: '#C9B38C', accent: '#C2683B', background: '#F7F1E6', ink: '#2A241E' },
  { name: 'Winter Pine', primary: '#1E3A3A', secondary: '#9DB9B0', accent: '#C97B5A', background: '#F2F4EF', ink: '#23302C' },
  { name: 'Berry & Cream', primary: '#40232F', secondary: '#C9A6AE', accent: '#B4614F', background: '#FAF3EF', ink: '#2B2124' }
];

function saveThenPreview(delay = 500) {
  emitStatus();
  scheduleAutosave();
  window.setTimeout(() => structuralChange(), delay);
}

function timeOptions(selected) {
  const options = [];
  for (let minutes = 5 * 60; minutes <= 23 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const value = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    options.push({ value, label: hoursLabel({ open: value, close: value }).split(' – ')[0] });
  }
  if (selected && !options.some((option) => option.value === selected)) {
    options.push({ value: selected, label: hoursLabel({ open: selected, close: selected }).split(' – ')[0] });
  }
  return options.sort((a, b) => a.value.localeCompare(b.value));
}

/* =====================================================================
   Business information
   ===================================================================== */

export const business = {
  title: 'Business Information',
  subtitle: 'Address, phone, opening hours and announcements.',
  render(root) {
    const data = S.content.business;
    const hours = [...data.hours].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
    const ann = S.content.announcement;

    root.innerHTML = `
      <section class="page-head">
        <div><h1>Business Information</h1><p>These details appear all over your website, and in Google search results.</p></div>
      </section>

      <div class="settings-grid">
        <section class="card-panel">
          <header class="card-panel__head"><h2>Basics</h2></header>
          ${field('Business name', textInput('business.name', data.name))}
          ${field('Tagline', textInput('business.tagline', data.tagline), 'Used in the footer and search results.')}
          ${field('Short description', textArea('business.description', data.description, { rows: 3 }), 'One or two sentences about the shop.')}
        </section>

        <section class="card-panel">
          <header class="card-panel__head"><h2>Contact</h2></header>
          <div class="form__grid">
            ${field('Street address', textInput('business.address1', data.address1))}
            ${field('City, state and ZIP', textInput('business.address2', data.address2))}
            ${field('City', textInput('business.city', data.city))}
            ${field('ZIP code', textInput('business.postalCode', data.postalCode))}
            ${field('Phone number', textInput('business.phone', data.phone), 'Shown exactly like this.')}
            ${field('Phone number for dialling', textInput('business.phoneDial', data.phoneDial), 'Numbers only, starting with +1.')}
          </div>
          ${field('Email address (optional)', textInput('business.email', data.email, { type: 'email' }))}
          ${field('Instagram link', textInput('business.instagram', data.instagram))}
          ${field('Facebook link', textInput('business.facebook', data.facebook))}
          ${field('Google Maps directions link', textInput('business.directionsUrl', data.directionsUrl))}
          ${field('Google Maps embed link', textInput('business.mapEmbed', data.mapEmbed), 'Used by the map on the Visit section.')}
        </section>
      </div>

      <section class="card-panel" id="hours">
        <header class="card-panel__head">
          <div><h2>Opening hours</h2><p>Switch a day off, or change its times. The website shows “Open now” automatically.</p></div>
        </header>
        <div class="hours-editor">
          ${hours
            .map((entry) => {
              const index = data.hours.findIndex((item) => item.day === entry.day);
              return `<div class="hours-row" data-day="${entry.day}" data-index="${index}">
                <span class="hours-row__day">${DAY_NAMES[entry.day]}</span>
                <label class="checkline"><input type="checkbox" data-closed ${entry.closed ? 'checked' : ''}> Closed</label>
                <span class="hours-row__times" ${entry.closed ? 'hidden' : ''}>
                  <select class="input" data-open>${timeOptions(entry.open)
                    .map((option) => `<option value="${option.value}"${option.value === entry.open ? ' selected' : ''}>${option.label}</option>`)
                    .join('')}</select>
                  <span class="hours-row__dash">to</span>
                  <select class="input" data-close>${timeOptions(entry.close)
                    .map((option) => `<option value="${option.value}"${option.value === entry.close ? ' selected' : ''}>${option.label}</option>`)
                    .join('')}</select>
                </span>
              </div>`;
            })
            .join('')}
        </div>
        ${field('Note under the hours (optional)', textArea('business.hoursNote', data.hoursNote, { rows: 2, placeholder: 'e.g. Kitchen closes 30 minutes before we do.' }))}
      </section>

      <section class="card-panel">
        <header class="card-panel__head">
          <div><h2>Holiday &amp; special hours</h2><p>Show one-off hours, like Thanksgiving week.</p></div>
          <button class="btn btn--ghost btn--small" type="button" data-add-holiday>${icon('plus', 15)} Add a date</button>
        </header>
        <div class="holiday-list" data-holidays>
          ${
            (data.holidayHours || []).length
              ? data.holidayHours.map((entry, index) => holidayRow(entry, index)).join('')
              : '<p class="muted">No special dates. Your normal weekly hours are used everywhere.</p>'
          }
        </div>
      </section>

      <section class="card-panel">
        <header class="card-panel__head">
          <div><h2>Announcement banner</h2><p>A short message at the top of every page.</p></div>
        </header>
        ${switchField('ann.enabled', ann.enabled, 'Show the announcement banner')}
        ${field('Announcement text', textArea('ann.text', ann.text, { rows: 2, placeholder: 'e.g. Closed Thanksgiving Day — back Friday at 7.' }))}
        <div class="form__grid">
          ${field('Button text (optional)', textInput('ann.linkLabel', ann.linkLabel))}
          ${field('Button link', textInput('ann.linkHref', ann.linkHref, { placeholder: '#menu' }))}
        </div>
        <div class="form__grid">
          ${field('Starts (optional)', textInput('ann.startDate', ann.startDate, { type: 'date' }))}
          ${field('Ends (optional)', textInput('ann.endDate', ann.endDate, { type: 'date' }))}
        </div>
        ${colorField('ann.background', ann.background, 'Banner colour')}
        <div class="announce-preview" style="--preview-bg:${esc(ann.background || '#203D31')}">
          <p>${esc(ann.text || 'Your announcement will appear here')}</p>
          ${ann.linkLabel ? `<span>${esc(ann.linkLabel)} →</span>` : ''}
        </div>
        <p class="fine-print">Published changes only — remember to press Publish website.</p>
      </section>`;
  }
};

function holidayRow(entry, index) {
  return `<div class="holiday-row" data-index="${index}">
    <label class="field"><span class="field__label">Label</span>
      <input class="input" data-holiday="label" value="${esc(entry.label || '')}" placeholder="e.g. Thanksgiving Day"></label>
    <label class="field"><span class="field__label">Date</span>
      <input class="input" type="date" data-holiday="date" value="${esc(entry.date || '')}"></label>
    <label class="checkline"><input type="checkbox" data-holiday="closed" ${entry.closed ? 'checked' : ''}> Closed all day</label>
    <span class="hours-row__times" ${entry.closed ? 'hidden' : ''}>
      <select class="input" data-holiday="open">${timeOptions(entry.open)
        .map((option) => `<option value="${option.value}"${option.value === entry.open ? ' selected' : ''}>${option.label}</option>`)
        .join('')}</select>
      <span class="hours-row__dash">to</span>
      <select class="input" data-holiday="close">${timeOptions(entry.close)
        .map((option) => `<option value="${option.value}"${option.value === entry.close ? ' selected' : ''}>${option.label}</option>`)
        .join('')}</select>
    </span>
    <button class="icon-btn icon-btn--danger" type="button" data-remove-holiday title="Remove">${icon('trash', 15)}</button>
  </div>`;
}

export function wireBusiness(root) {
  bindFields(root, (path, value) => {
    setValue(path, value, { preview: false });
    saveThenPreview();
  });

  root.querySelectorAll('.hours-row').forEach((row) => {
    const index = Number(row.getAttribute('data-index'));
    const entry = S.content.business.hours[index];
    if (!entry) return;
    const closed = row.querySelector('[data-closed]');
    const times = row.querySelector('.hours-row__times');
    const open = row.querySelector('[data-open]');
    const close = row.querySelector('[data-close]');
    closed.addEventListener('change', () => {
      entry.closed = closed.checked;
      times.hidden = closed.checked;
      saveThenPreview(150);
    });
    open.addEventListener('change', () => {
      entry.open = open.value;
      saveThenPreview(150);
    });
    close.addEventListener('change', () => {
      entry.close = close.value;
      saveThenPreview(150);
    });
  });

  const holidayList = root.querySelector('[data-holidays]');
  const readHolidays = () => {
    const list = S.content.business.holidayHours || (S.content.business.holidayHours = []);
    holidayList.querySelectorAll('[data-index]').forEach((row) => {
      const index = Number(row.getAttribute('data-index'));
      const entry = list[index];
      if (!entry) return;
      row.querySelectorAll('[data-holiday]').forEach((input) => {
        const key = input.getAttribute('data-holiday');
        if (input.type === 'checkbox') entry[key] = input.checked;
        else entry[key] = input.value;
        if (key === 'closed') row.querySelector('.hours-row__times').hidden = input.checked;
      });
    });
    saveThenPreview();
  };
  holidayList.querySelectorAll('[data-holiday]').forEach((input) => {
    input.addEventListener('change', readHolidays);
  });
  holidayList.querySelectorAll('[data-remove-holiday]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.closest('[data-index]').getAttribute('data-index'));
      S.content.business.holidayHours.splice(index, 1);
      toast('Special date removed.', 'success');
      saveThenPreview(100);
      const view = document.getElementById('view');
      view.innerHTML = '';
      business.render(view);
      wireBusiness(view);
    });
  });
  root.querySelector('[data-add-holiday]')?.addEventListener('click', () => {
    S.content.business.holidayHours = S.content.business.holidayHours || [];
    S.content.business.holidayHours.push({
      id: 'hol-' + Date.now().toString(36),
      label: '',
      date: new Date().toISOString().slice(0, 10),
      closed: true,
      open: '09:00',
      close: '13:00'
    });
    saveThenPreview(100);
    const view = document.getElementById('view');
    view.innerHTML = '';
    business.render(view);
    wireBusiness(view);
  });
}

/* =====================================================================
   Design & branding
   ===================================================================== */

export const design = {
  title: 'Design & Branding',
  subtitle: 'Colours, fonts and your logo — with safe, proven choices.',
  render(root) {
    const brand = S.content.branding;
    root.innerHTML = `
      <section class="page-head">
        <div><h1>Design &amp; Branding</h1><p>Every option here is chosen to keep your website readable and beautiful on phones.</p></div>
      </section>

      <div class="settings-grid">
        <section class="card-panel">
          <header class="card-panel__head"><h2>Logo &amp; name</h2></header>
          <div class="cover-field">
            <span class="cover-preview cover-preview--logo">${
              brand.logoImage ? `<img src="${esc(brand.logoImage)}" alt="">` : `<span class="wordmark-preview">${esc(brand.wordmark)}</span>`
            }</span>
            <div>
              <button class="btn btn--ghost btn--small" type="button" data-logo>${icon('media', 15)} ${
                brand.logoImage ? 'Change logo' : 'Upload a logo'
              }</button>
              ${brand.logoImage ? '<button class="btn btn--ghost btn--small btn--danger-text" type="button" data-logo-remove>Use text instead</button>' : ''}
              <p class="field__hint">A logo is optional — the text wordmark looks great on its own.</p>
            </div>
          </div>
          ${field('Name on the website', textInput('branding.wordmark', brand.wordmark))}
          ${field('Small word underneath', textInput('branding.wordmarkSub', brand.wordmarkSub))}
          <div class="cover-field">
            <span class="cover-preview cover-preview--favicon">${
              brand.favicon ? `<img src="${esc(brand.favicon)}" alt="">` : '<span>OTN</span>'
            }</span>
            <div>
              <button class="btn btn--ghost btn--small" type="button" data-favicon>${icon('image', 15)} Change browser icon</button>
              ${brand.favicon ? '<button class="btn btn--ghost btn--small btn--danger-text" type="button" data-favicon-remove>Use default</button>' : ''}
              <p class="field__hint">The tiny icon shown in browser tabs. A square image works best.</p>
            </div>
          </div>
        </section>

        <section class="card-panel">
          <header class="card-panel__head"><h2>Fonts &amp; buttons</h2></header>
          <div class="option-grid">
            ${FONT_PAIRS.map(
              (pair) => `<label class="option-card">
                <input type="radio" name="fontPair" value="${pair.id}" ${brand.fontPair === pair.id ? 'checked' : ''} data-path="branding.fontPair">
                <span class="option-card__preview font-${pair.id}"><strong>Orchard Trail</strong><small>Healthy shakes &amp; teas</small></span>
                <span class="option-card__label">${esc(pair.name)}</span>
                <span class="option-card__note">${esc(pair.note)}</span>
              </label>`
            ).join('')}
          </div>
          <div class="option-row">
            ${BUTTON_STYLES.map(
              (style) => `<label class="pill-option">
                <input type="radio" name="buttonStyle" value="${style.id}" ${brand.buttonStyle === style.id ? 'checked' : ''} data-path="branding.buttonStyle">
                <span class="pill-option__dot pill-option__dot--${style.id}">Button</span>
                <span>${esc(style.name)}</span>
              </label>`
            ).join('')}
          </div>
        </section>
      </div>

      <section class="card-panel">
        <header class="card-panel__head">
          <div><h2>Colours</h2><p>Pick a palette, or fine-tune each colour. Text contrast is kept safe automatically.</p></div>
        </header>
        <div class="palette-row">
          ${PALETTES.map(
            (palette, index) => `<button class="palette" type="button" data-palette="${index}">
              <span class="palette__chips">
                <i style="background:${palette.primary}"></i><i style="background:${palette.secondary}"></i>
                <i style="background:${palette.accent}"></i><i style="background:${palette.background}"></i>
              </span>
              <span>${esc(palette.name)}</span>
            </button>`
          ).join('')}
        </div>
        <div class="form__grid form__grid--colors">
          ${colorField('branding.primary', brand.primary, 'Main brand colour')}
          ${colorField('branding.accent', brand.accent, 'Accent colour')}
          ${colorField('branding.secondary', brand.secondary, 'Soft accent')}
          ${colorField('branding.background', brand.background, 'Page background')}
          ${colorField('branding.ink', brand.ink, 'Text colour')}
        </div>
        <p class="fine-print">Tip: keep the text colour very dark and the background very light for easy reading.</p>
      </section>`;
  }
};

export function wireDesign(root) {
  bindFields(root, (path, value) => {
    setValue(path, value, { preview: false });
    saveThenPreview(400);
  });
  root.querySelectorAll('[data-palette]').forEach((button) => {
    button.addEventListener('click', () => {
      const palette = PALETTES[Number(button.getAttribute('data-palette'))];
      pushHistory('palette');
      Object.assign(S.content.branding, {
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
        background: palette.background,
        ink: palette.ink
      });
      toast(palette.name + ' colours applied.', 'success');
      saveThenPreview(200);
      refreshSelf(design, wireDesign);
    });
  });
  const choose = (path) =>
    pickImage({
      folder: 'Branding',
      onChoose: (choice) => {
        setValue(path, choice.url, { preview: false });
        saveThenPreview(200);
        refreshSelf(design, wireDesign);
      }
    });
  root.querySelector('[data-logo]')?.addEventListener('click', () => choose('branding.logoImage'));
  root.querySelector('[data-favicon]')?.addEventListener('click', () => choose('branding.favicon'));
  root.querySelector('[data-logo-remove]')?.addEventListener('click', () => {
    setValue('branding.logoImage', '', { preview: false });
    saveThenPreview(150);
    refreshSelf(design, wireDesign);
  });
  root.querySelector('[data-favicon-remove]')?.addEventListener('click', () => {
    setValue('branding.favicon', '', { preview: false });
    saveThenPreview(150);
    refreshSelf(design, wireDesign);
  });
  root.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener('change', async () => {
      if (!input.files?.length) return;
      const uploaded = await uploadFiles(input.files, { folder: 'Branding' });
      if (uploaded[0]) {
        setValue(input.getAttribute('data-target'), uploaded[0].url, { preview: false });
        saveThenPreview(200);
        refreshSelf(design, wireDesign);
      }
    });
  });
}

function refreshSelf(view, wire) {
  const root = document.getElementById('view');
  if (!root) return;
  view.render(root);
  wire(root);
}

/* =====================================================================
   SEO & settings
   ===================================================================== */

export const seo = {
  title: 'SEO & Settings',
  subtitle: 'How your website appears in Google and when shared.',
  render(root) {
    const data = S.content.seo;
    root.innerHTML = `
      <section class="page-head">
        <div><h1>SEO &amp; Settings</h1><p>Plain-English settings for search engines and sharing.</p></div>
      </section>

      <div class="settings-grid">
        <section class="card-panel">
          <header class="card-panel__head"><h2>Search results</h2></header>
          ${field('Homepage title', textInput('seo.title', data.title), 'Shown as the blue line in Google. Around 60 characters is ideal.')}
          ${field('Search engine description', textArea('seo.description', data.description, { rows: 3 }), 'The short description under the title. Around 155 characters is ideal.')}
          ${field('Extra keywords (optional)', textInput('seo.keywords', data.keywords), 'Separate with commas. Google mostly ignores these, but they do no harm.')}
          <div class="google-preview">
            <span class="google-preview__label">Preview</span>
            <p class="google-preview__url">orchardtrailnutrition.com</p>
            <p class="google-preview__title">${esc(data.title)}</p>
            <p class="google-preview__desc">${esc(data.description)}</p>
          </div>
        </section>

        <section class="card-panel">
          <header class="card-panel__head"><h2>Sharing</h2></header>
          <div class="cover-field">
            <span class="cover-preview cover-preview--share">${
              data.shareImage ? `<img src="${esc(data.shareImage)}" alt="">` : icon('image', 22)
            }</span>
            <div>
              <button class="btn btn--ghost btn--small" type="button" data-share>${icon('media', 15)} Choose sharing image</button>
              <p class="field__hint">Shown when the site is shared on Facebook, Instagram or in a message.</p>
            </div>
          </div>
          ${field('Google Analytics measurement ID (optional)', textInput('seo.ga4Id', data.ga4Id, { placeholder: 'G-XXXXXXXXXX' }), 'Leave empty to use the built-in, cookie-free analytics. Paste an ID only if you already have a Google Analytics account.')}
        </section>
      </div>

      <section class="card-panel">
        <header class="card-panel__head"><h2>Technical healthy bits</h2></header>
        <ul class="plain-list">
          <li>${icon('check', 16)} Your address, phone and opening hours are automatically added to Google-friendly business data.</li>
          <li>${icon('check', 16)} A sitemap is generated automatically at <code>/sitemap.xml</code>.</li>
          <li>${icon('lock', 16)} The dashboard is kept out of search engines and protected by your password.</li>
        </ul>
        <div class="button-row">
          <a class="btn btn--ghost" href="/api/admin/export">${icon('save', 16)} Download a full backup</a>
          <a class="btn btn--ghost" href="/sitemap.xml" target="_blank" rel="noopener">${icon('external', 16)} View sitemap</a>
        </div>
        <p class="fine-print">The backup file contains everything on your website — content and photo list. Save it somewhere safe now and then.</p>
      </section>`;
  }
};

export function wireSeo(root) {
  bindFields(root, (path, value) => {
    setValue(path, value, { preview: false });
    saveThenPreview(500);
    updateGooglePreview(root);
  });
  root.querySelector('[data-share]')?.addEventListener('click', () => {
    pickImage({
      folder: 'Website',
      title: 'Choose a sharing image',
      onChoose: (choice) => {
        setValue('seo.shareImage', choice.url, { preview: false });
        saveThenPreview(200);
        refreshSelf(seo, wireSeo);
      }
    });
  });
}

function updateGooglePreview(root) {
  const title = getValue('seo.title') || '';
  const description = getValue('seo.description') || '';
  const titleNode = root.querySelector('.google-preview__title');
  const descNode = root.querySelector('.google-preview__desc');
  if (titleNode) titleNode.textContent = title;
  if (descNode) descNode.textContent = description;
}

/* =====================================================================
   Account & security
   ===================================================================== */

export const account = {
  title: 'Account & Security',
  subtitle: 'Your sign-in, team members, backups and published versions.',
  async render(root) {
    const user = S.user || {};
    let users = [];
    let canManage = true;
    try {
      const result = await api('/api/admin/users');
      users = result.users || [];
      canManage = result.canManage !== false;
    } catch {
      users = [];
    }

    root.innerHTML = `
      <section class="page-head">
        <div><h1>Account &amp; Security</h1><p>Everything needed to keep the website yours.</p></div>
      </section>

      <div class="settings-grid">
        <section class="card-panel">
          <header class="card-panel__head"><h2>Your account</h2></header>
          <div class="account-row">
            <span class="avatar avatar--lg">${esc((user.name || user.email || '?').charAt(0).toUpperCase())}</span>
            <div>
              <strong>${esc(user.name || 'Owner')}</strong>
              <p class="muted">${esc(user.email || '')} · ${esc(user.role === 'owner' ? 'Owner' : 'Editor')}</p>
            </div>
          </div>
          <form class="form" data-email-form>
            <h3 class="form__title">Sign-in email</h3>
            ${field(
              'Email address',
              `<input class="input" type="email" name="email" autocomplete="email" value="${esc(user.email || '')}" required>`,
              'The address you type on the sign-in screen.'
            )}
            ${field(
              'Current password',
              '<input class="input" type="password" name="current" autocomplete="current-password" required>',
              'Confirms it is really you.'
            )}
            <button class="btn btn--ghost" type="submit">Save email</button>
          </form>
          <form class="form" data-password-form>
            <h3 class="form__title">Change your password</h3>
            ${field('Current password', '<input class="input" type="password" name="current" autocomplete="current-password">')}
            ${field('New password', '<input class="input" type="password" name="next" autocomplete="new-password">', 'At least 10 characters, with a number or symbol.')}
            ${field('Repeat new password', '<input class="input" type="password" name="repeat" autocomplete="new-password">')}
            <button class="btn btn--primary" type="submit">Update password</button>
          </form>
          <div class="button-row">
            <button class="btn btn--ghost" type="button" data-recovery>${icon('lock', 16)} Get a recovery code</button>
            <button class="btn btn--ghost btn--danger-text" type="button" data-logout>${icon('logout', 16)} Sign out</button>
          </div>
          <p class="fine-print">A recovery code lets you set a new password if you ever forget this one. Keep it somewhere safe — it is shown only once.</p>
        </section>

        <section class="card-panel">
          <header class="card-panel__head"><h2>Published versions</h2><p>Restore the website exactly as it was.</p></header>
          <ul class="version-list">
            ${
              (S.versions || []).length
                ? S.versions
                    .slice(0, 12)
                    .map(
                      (version) => `<li>
                        <div><strong>Version ${version.version}</strong><small>${esc(timeAgo(version.created_at))} · ${esc(
                          version.created_by || 'owner'
                        )}</small><p>${esc(version.note || '')}</p></div>
                        <button class="btn btn--ghost btn--small" type="button" data-restore="${esc(version.id)}" data-version="${
                          version.version
                        }">${icon('restore', 14)} Restore</button>
                      </li>`
                    )
                    .join('')
                : '<li class="muted">Nothing published yet.</li>'
            }
          </ul>
          <p class="fine-print">Restoring publishes that version immediately, so visitors see it right away.</p>
        </section>
      </div>

      <section class="card-panel">
        <header class="card-panel__head">
          <div><h2>People with access</h2><p>Invite someone you trust to help with the website.</p></div>
          ${canManage ? `<button class="btn btn--ghost btn--small" type="button" data-add-user>${icon('plus', 15)} Add a person</button>` : ''}
        </header>
        <ul class="people-list">
          ${users
            .map(
              (person) => `<li>
                <span class="avatar">${esc((person.name || person.email).charAt(0).toUpperCase())}</span>
                <div><strong>${esc(person.name || person.email)}</strong><small>${esc(person.email)} · ${esc(
                  person.role === 'owner' ? 'Owner' : 'Editor'
                )}</small></div>
                <span class="muted">${person.last_login_at ? 'Last signed in ' + timeAgo(person.last_login_at) : 'Never signed in'}</span>
                ${
                  person.id !== user.id && canManage
                    ? `<button class="icon-btn icon-btn--danger" type="button" data-remove-user="${esc(person.id)}" data-email="${esc(
                        person.email
                      )}" title="Remove access">${icon('trash', 15)}</button>`
                    : ''
                }
              </li>`
            )
            .join('')}
        </ul>
      </section>

      <section class="card-panel card-panel--soft">
        <header class="card-panel__head"><h2>Keeping the website safe</h2></header>
        <ul class="plain-list">
          <li>${icon('lock', 16)} Only signed-in people can change the website. Visitors can only read it.</li>
          <li>${icon('undo', 16)} Your work is saved as a draft. Publishing is always a deliberate step.</li>
          <li>${icon('save', 16)} Download a backup any time from <a href="#seo">SEO &amp; Settings</a>.</li>
          <li>${icon('mail', 16)} Sign-in emails and this dashboard belong to your account — nobody else can see the password.</li>
        </ul>
      </section>`;
  }
};

export function wireAccount(root) {
  root.querySelector('[data-logout]')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('otn:logout'));
  });
  root.querySelector('[data-email-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const email = form.querySelector('[name="email"]').value.trim();
    const current = form.querySelector('[name="current"]').value;
    try {
      const result = await api('/api/auth/email', { method: 'POST', body: { email, current } });
      S.user = result.user || { ...S.user, email };
      toast('Sign-in email updated. Use it the next time you sign in.', 'success', 6000);
      refreshSelf(account, wireAccount);
    } catch (error) {
      toast(error.message || 'Could not change the email.', 'error');
    }
  });

  root.querySelector('[data-password-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const current = form.querySelector('[name="current"]').value;
    const next = form.querySelector('[name="next"]').value;
    const repeat = form.querySelector('[name="repeat"]').value;
    if (next !== repeat) {
      toast('The new passwords do not match.', 'error');
      return;
    }
    try {
      await api('/api/auth/password', { method: 'POST', body: { current, next } });
      toast('Password updated.', 'success');
      form.reset();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  root.querySelector('[data-recovery]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Create a new recovery code?',
      message: 'Any older recovery code stops working. You will see the new code once — write it down or save it somewhere safe.',
      confirmLabel: 'Create code'
    });
    if (!ok) return;
    try {
      const result = await api('/api/auth/recovery-code', { method: 'POST' });
      showRecoveryCode(result.recoveryCode);
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  root.querySelectorAll('[data-restore]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Restore version ' + button.getAttribute('data-version') + '?',
        message: 'The website will be published with the content from that version. Your current draft is replaced.',
        confirmLabel: 'Restore and publish'
      });
      if (!ok) return;
      const done = await restoreVersion(button.getAttribute('data-restore'));
      if (done) {
        refreshSelf(account, wireAccount);
      }
    });
  });

  root.querySelector('[data-add-user]')?.addEventListener('click', () => {
    const body = `<div class="form">
      ${field('Name', '<input class="input" name="name" placeholder="Their name">')}
      ${field('Email', '<input class="input" type="email" name="email" placeholder="them@example.com">')}
      ${field('Role', `<select class="input" name="role"><option value="editor">Editor — can change the website</option><option value="owner">Owner — full control</option></select>`)}
      ${field('Starting password', '<input class="input" type="text" name="password" placeholder="At least 10 characters">', 'Share this with them privately. They can change it after signing in.')}
    </div>`;
    const dialog = modal({
      title: 'Add a person',
      body,
      footer: `<button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
        <button class="btn btn--primary" type="button" data-create>Add person</button>`
    });
    dialog.root.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    dialog.root.querySelector('[data-create]').addEventListener('click', async () => {
      const container = dialog.root.querySelector('.modal__body');
      const payload = {
        name: container.querySelector('[name="name"]').value,
        email: container.querySelector('[name="email"]').value,
        role: container.querySelector('[name="role"]').value,
        password: container.querySelector('[name="password"]').value
      };
      try {
        await api('/api/admin/users', { method: 'POST', body: payload });
        dialog.close();
        toast('They can now sign in at /admin.', 'success');
        refreshSelf(account, wireAccount);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  root.querySelectorAll('[data-remove-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      const email = button.getAttribute('data-email');
      const ok = await confirmDialog({
        title: 'Remove ' + email + '?',
        message: 'They will be signed out and will not be able to sign in again.',
        confirmLabel: 'Remove access',
        danger: true
      });
      if (!ok) return;
      try {
        await api('/api/admin/users/' + encodeURIComponent(button.getAttribute('data-remove-user')), { method: 'DELETE' });
        toast('Access removed.', 'success');
        refreshSelf(account, wireAccount);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

export function showRecoveryCode(code) {
  const dialog = modal({
    title: 'Your recovery code',
    body: `<p class="modal__text">Write this down and keep it somewhere safe. It is the only way back in if you forget your password.</p>
      <p class="recovery-code">${esc(code)}</p>`,
    footer: `<button class="btn btn--ghost" type="button" data-copy>${icon('copy', 16)} Copy</button>
      <button class="btn btn--primary" type="button" data-close>I have saved it</button>`
  });
  dialog.root.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Recovery code copied.', 'success');
    } catch {
      toast('Select the code and copy it manually.', 'info');
    }
  });
  dialog.root.querySelector('[data-close]').addEventListener('click', () => dialog.close());
}

void emptyState;
void formatDate;
void emit;
void refreshContent;
