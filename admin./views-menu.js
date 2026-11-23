/* Menu & Drinks and Seasonal Specials. */

import {
  S, setValue, getValue, pushHistory, emit, emitStatus, scheduleAutosave,
  structuralChange, toast, publishWebsite
} from './store.js';
import {
  icon, esc, modal, drawer, confirmDialog, formatDate, emptyState, bindFields,
  field, textInput, textArea, selectInput, switchField, statusBadge
} from './ui.js';
import { pickImage, uploadFiles } from './media-lib.js';
import { slugify, uid } from '/shared/model.js';

const menuState = { search: '', category: 'all', collection: 'all', showHidden: false };

function sortedDrinks() {
  return [...S.content.drinks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function reindex() {
  sortedDrinks().forEach((drink, index) => {
    drink.order = index;
  });
}

function collectionName(id) {
  return S.content.collections.find((collection) => collection.id === id)?.name || id;
}

export const menu = {
  title: 'Menu & Drinks',
  subtitle: 'Add, change, reorder or hide anything on your menu.',
  render(root) {
    const content = S.content;
    const categories = content.categories;
    const collections = content.collections.filter((collection) => !collection.archived);
    const all = sortedDrinks();

    const drinks = all.filter((drink) => {
      if (menuState.search) {
        const haystack = (drink.name + ' ' + drink.label + ' ' + drink.flavors + ' ' + drink.description).toLowerCase();
        if (!haystack.includes(menuState.search.toLowerCase())) return false;
      }
      if (menuState.category !== 'all' && drink.categoryId !== menuState.category) return false;
      if (menuState.collection !== 'all' && !(drink.collectionIds || []).includes(menuState.collection)) return false;
      if (!menuState.showHidden && drink.hidden) return false;
      return true;
    });

    root.innerHTML = `
      <section class="page-head">
        <div>
          <h1>Menu &amp; Drinks</h1>
          <p>${all.length} drinks · ${all.filter((drink) => !drink.hidden).length} showing on the website</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--primary" type="button" data-action="add">${icon('plus', 18)} Add a drink</button>
        </div>
      </section>

      <div class="toolbar">
        <div class="toolbar__search">
          ${icon('seo', 16)}
          <input class="input" type="search" placeholder="Search drinks" data-search value="${esc(menuState.search)}">
        </div>
        <select class="input" data-category>
          <option value="all">All categories</option>
          ${categories.map((category) => `<option value="${esc(category.id)}"${menuState.category === category.id ? ' selected' : ''}>${esc(category.name)}</option>`).join('')}
        </select>
        <select class="input" data-collection>
          <option value="all">Every seasonal menu</option>
          ${collections.map((collection) => `<option value="${esc(collection.id)}"${menuState.collection === collection.id ? ' selected' : ''}>${esc(collection.name)}</option>`).join('')}
        </select>
        <label class="checkline"><input type="checkbox" data-hidden ${menuState.showHidden ? 'checked' : ''}> Show hidden drinks</label>
      </div>

      ${
        drinks.length
          ? `<div class="table-wrap">
              <table class="table drink-table">
                <thead><tr>
                  <th class="table__handle"></th><th>Drink</th><th>Category</th><th>Seasonal menu</th><th>Price</th><th>Status</th><th></th>
                </tr></thead>
                <tbody data-rows>
                  ${drinks.map((drink) => drinkRow(drink)).join('')}
                </tbody>
              </table>
            </div>
            <p class="muted table-hint">${icon('drag', 14)} Drag a row by its handle to change the order drinks appear on the website.</p>`
          : emptyState(
              'menu',
              'No drinks match that search',
              'Try a different word, or clear the filters to see your whole menu.'
            )
      }`;
  }
};

function drinkRow(drink) {
  const category = S.content.categories.find((item) => item.id === drink.categoryId);
  const collections = (drink.collectionIds || [])
    .map((id) => S.content.collections.find((collection) => collection.id === id))
    .filter((collection) => collection && !collection.archived)
    .map((collection) => `<span class="badge badge--soft">${esc(collection.name)}</span>`)
    .join(' ');
  return `<tr data-drink="${esc(drink.id)}" draggable="true">
    <td class="table__handle"><span class="drag-handle" title="Drag to reorder">${icon('drag', 16)}</span></td>
    <td>
      <div class="drink-cell">
        <span class="drink-cell__thumb">${drink.image ? `<img src="${esc(drink.image)}" alt="">` : icon('menu', 16)}</span>
        <span class="drink-cell__text">
          <strong>${esc(drink.name || 'Untitled drink')}</strong>
          <small>${esc(drink.label || '')}${drink.featured ? ' · featured' : ''}</small>
        </span>
      </div>
    </td>
    <td>${esc(category?.name || '—')}</td>
    <td>${collections || '<span class="muted">Everyday</span>'}</td>
    <td>${esc(drink.price || '—')}</td>
    <td class="nowrap">${drink.hidden ? statusBadge('hidden') : ''}${drink.archived ? statusBadge('archived') : ''}${
      !drink.hidden && !drink.archived ? statusBadge('live') : ''
    }</td>
    <td class="table__actions">
      <button class="icon-btn" type="button" data-action="edit" data-id="${esc(drink.id)}" title="Edit">${icon('editor', 16)}</button>
      <button class="icon-btn" type="button" data-action="duplicate" data-id="${esc(drink.id)}" title="Make a copy">${icon('copy', 16)}</button>
      <button class="icon-btn" type="button" data-action="hide" data-id="${esc(drink.id)}" title="${drink.hidden ? 'Show on website' : 'Hide from website'}">${icon(
        drink.hidden ? 'eyeOff' : 'eye',
        16
      )}</button>
      <button class="icon-btn icon-btn--danger" type="button" data-action="delete" data-id="${esc(drink.id)}" title="Delete">${icon('trash', 16)}</button>
    </td>
  </tr>`;
}

export function wireMenu(root) {
  const rerender = () => {
    root.innerHTML = '';
    menu.render(root);
    wireMenu(root);
  };

  const search = root.querySelector('[data-search]');
  search?.addEventListener(
    'input',
    (() => {
      let timer = 0;
      return () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          menuState.search = search.value;
          rerender();
          const next = root.querySelector('[data-search]');
          next?.focus();
          next?.setSelectionRange(next.value.length, next.value.length);
        }, 180);
      };
    })()
  );
  root.querySelector('[data-category]')?.addEventListener('change', (event) => {
    menuState.category = event.target.value;
    rerender();
  });
  root.querySelector('[data-collection]')?.addEventListener('change', (event) => {
    menuState.collection = event.target.value;
    rerender();
  });
  root.querySelector('[data-hidden]')?.addEventListener('change', (event) => {
    menuState.showHidden = event.target.checked;
    rerender();
  });
  root.querySelector('[data-action="add"]')?.addEventListener('click', () => addDrink());

  root.querySelectorAll('[data-action="edit"]').forEach((button) =>
    button.addEventListener('click', () => openDrinkDrawer(button.getAttribute('data-id')))
  );
  root.querySelectorAll('[data-action="duplicate"]').forEach((button) =>
    button.addEventListener('click', () => duplicateDrink(button.getAttribute('data-id')))
  );
  root.querySelectorAll('[data-action="delete"]').forEach((button) =>
    button.addEventListener('click', () => deleteDrink(button.getAttribute('data-id'), rerender))
  );
  root.querySelectorAll('[data-action="hide"]').forEach((button) =>
    button.addEventListener('click', () => {
      const drink = S.content.drinks.find((item) => item.id === button.getAttribute('data-id'));
      if (!drink) return;
      pushHistory('drink visibility');
      drink.hidden = !drink.hidden;
      structuralChange();
      rerender();
    })
  );

  const rows = root.querySelector('[data-rows]');
  if (rows) {
    let dragged = null;
    rows.querySelectorAll('[data-drink]').forEach((row) => {
      row.addEventListener('dragstart', (event) => {
        if (!event.target.closest('.drag-handle')) {
          event.preventDefault();
          return;
        }
        dragged = row;
        row.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.getAttribute('data-drink'));
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        dragged = null;
      });
      row.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (!dragged || dragged === row) return;
        const items = [...rows.children];
        if (items.indexOf(dragged) < items.indexOf(row)) row.after(dragged);
        else row.before(dragged);
      });
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const ids = [...rows.querySelectorAll('[data-drink]')].map((node) => node.getAttribute('data-drink'));
        pushHistory('drink order');
        const lookup = new Map(S.content.drinks.map((drink) => [drink.id, drink]));
        const reordered = ids.map((id) => lookup.get(id)).filter(Boolean);
        const rest = sortedDrinks().filter((drink) => !ids.includes(drink.id));
        const base = menuState.category !== 'all' || menuState.collection !== 'all' || menuState.search;
        S.content.drinks = base ? mergeOrder(reordered, rest) : reordered;
        reindex();
        structuralChange();
        rerender();
      });
    });
  }
}

function mergeOrder(subset, rest) {
  const all = [...S.content.drinks];
  const positions = all.map((drink, index) => ({ drink, index })).filter((item) => subset.includes(item.drink));
  positions.forEach((item, offset) => {
    const replacement = subset[offset];
    const index = all.indexOf(item.drink);
    if (index >= 0) all[index] = replacement;
  });
  return all;
}

function blankDrink() {
  const id = 'drink-' + uid('x').slice(2);
  const order = S.content.drinks.length;
  return {
    id,
    name: '',
    categoryId: S.content.categories[0]?.id || 'shakes',
    collectionIds: [],
    label: '',
    flavors: '',
    description: '',
    price: '',
    image: null,
    available: '',
    featured: false,
    hidden: false,
    archived: false,
    order,
    macros: null,
    source: '',
    sourceUrl: '',
    createdAt: new Date().toISOString()
  };
}

function addDrink() {
  const drink = blankDrink();
  pushHistory('add drink');
  S.content.drinks.push(drink);
  structuralChange();
  openDrinkDrawer(drink.id, { isNew: true });
}

export function startNewDrink() {
  addDrink();
}

function duplicateDrink(id) {
  const source = S.content.drinks.find((drink) => drink.id === id);
  if (!source) return;
  pushHistory('duplicate drink');
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = 'drink-' + uid('x').slice(2);
  copy.name = source.name + ' (copy)';
  copy.hidden = true;
  copy.featured = false;
  copy.order = S.content.drinks.length;
  S.content.drinks.push(copy);
  reindex();
  structuralChange();
  toast('Copy added and hidden, so you can edit it before showing it.', 'success');
  emit();
}

async function deleteDrink(id, after) {
  const drink = S.content.drinks.find((item) => item.id === id);
  if (!drink) return;
  const ok = await confirmDialog({
    title: 'Delete "' + (drink.name || 'this drink') + '"?',
    message: 'This removes the drink from your menu everywhere. If it might come back, hide it instead — hidden drinks stay in your list.',
    confirmLabel: 'Delete drink',
    danger: true
  });
  if (!ok) return;
  pushHistory('delete drink');
  S.content.drinks = S.content.drinks.filter((item) => item.id !== id);
  reindex();
  structuralChange();
  toast('Drink deleted. Publish to update the website.', 'success');
  if (after) after();
  else emit();
}

/* ------------------------------------------------------- drink drawer -- */

export function openDrinkDrawer(id, { isNew = false } = {}) {
  const drink = S.content.drinks.find((item) => item.id === id);
  if (!drink) return;
  const categories = S.content.categories;
  const collections = S.content.collections.filter((collection) => !collection.archived);
  const base = 'drink.' + drink.id;

  const body = document.createElement('div');
  body.className = 'form';
  body.innerHTML = `
    <section class="form__section">
      <div class="photo-field">
        <span class="photo-field__preview">${drink.image ? `<img src="${esc(drink.image)}" alt="">` : icon('image', 24)}</span>
        <div class="photo-field__actions">
          <button class="btn btn--ghost btn--small" type="button" data-photo>${icon('media', 15)} ${
            drink.image ? 'Change photo' : 'Add a photo'
          }</button>
          <button class="btn btn--ghost btn--small" type="button" data-photo-upload>${icon('upload', 15)} Upload from this device</button>
          ${drink.image ? `<button class="btn btn--ghost btn--small btn--danger-text" type="button" data-photo-remove>Remove</button>` : ''}
          <span class="field__hint">A square or landscape photo looks best. We resize it automatically.</span>
        </div>
      </div>
      <input type="file" accept="image/*" hidden data-file>
    </section>

    <section class="form__section">
      ${field('Drink name', textInput(base + '.name', drink.name, { placeholder: 'e.g. December Mint Mocha' }), 'This is the big name on the card.')}
      ${field('Category', selectInput(base + '.categoryId', drink.categoryId, categories.map((category) => ({ value: category.id, label: category.name }))))}
      ${field('Small line above the name', textInput(base + '.label', drink.label, { placeholder: 'e.g. Mega Tea · 42 oz' }))}
      ${field('Flavor notes', textInput(base + '.flavors', drink.flavors, { placeholder: 'e.g. peppermint · dark chocolate' }))}
      ${field('Description', textArea(base + '.description', drink.description, { rows: 3, placeholder: 'Two short sentences about the drink.' }))}
      ${field('Price', textInput(base + '.price', drink.price, { placeholder: 'Optional — e.g. $7.50' }), 'Leave empty to show “Price in store”.')}
    </section>

    <section class="form__section">
      <h3 class="form__title">Seasonal menus</h3>
      <p class="field__hint">Tick every seasonal collection this drink belongs to. Leave all unticked for the everyday menu.</p>
      <div class="chip-checks">
        ${collections
          .map(
            (collection) => `<label class="chip-check">
              <input type="checkbox" data-collection="${esc(collection.id)}" ${
                (drink.collectionIds || []).includes(collection.id) ? 'checked' : ''
              }>
              <span>${esc(collection.name)}</span>
            </label>`
          )
          .join('')}
        ${
          collections.length
            ? ''
            : '<p class="muted">No seasonal menus yet. Create one under Seasonal Specials.</p>'
        }
      </div>
      ${field('Label shown on the card', textInput(base + '.available', drink.available, { placeholder: 'e.g. December 2026' }), 'Optional — used for the little badge on the card.')}
    </section>

    <section class="form__section">
      <h3 class="form__title">How it appears</h3>
      ${switchField(base + '.featured', drink.featured, 'Feature on the homepage', 'Featured drinks appear in the seasonal highlight band.')}
      ${switchField(base + '.hidden', drink.hidden, 'Hide from the website', 'The drink stays in your dashboard, just not on the menu.')}
      ${switchField(base + '.archived', drink.archived, 'Mark as a past board', 'Shows a “Past” badge. Use this for old weekly boards, not current drinks.')}
    </section>

    <details class="form__details">
      <summary>Nutrition numbers and source (optional)</summary>
      <div class="form__grid">
        ${field('Calories', textInput(base + '.macros.calories', drink.macros?.calories ?? '', { type: 'number' }))}
        ${field('Protein (g)', textInput(base + '.macros.protein', drink.macros?.protein ?? '', { type: 'number' }))}
        ${field('Carbs (g)', textInput(base + '.macros.carbs', drink.macros?.carbs ?? '', { type: 'number' }))}
        ${field('Sugar (g)', textInput(base + '.macros.sugar', drink.macros?.sugar ?? '', { type: 'number' }))}
        ${field('Fat (g)', textInput(base + '.macros.fat', drink.macros?.fat ?? '', { type: 'number' }))}
        ${field('Caffeine (mg)', textInput(base + '.macros.caffeine', drink.macros?.caffeine ?? '', { type: 'number' }))}
      </div>
      ${field('Where this came from', textInput(base + '.source', drink.source, { placeholder: 'e.g. Instagram · 2 Dec 2026' }))}
      ${field('Link to the post', textInput(base + '.sourceUrl', drink.sourceUrl, { placeholder: 'https://…' }))}
    </details>`;

  const panel = drawer({
    title: isNew ? 'Add a new drink' : drink.name || 'Edit drink',
    subtitle: 'Saved to your draft automatically.',
    body,
    wide: true,
    footer: `<button class="btn btn--ghost btn--danger-text" type="button" data-delete>${icon('trash', 15)} Delete</button>
      <span class="spacer"></span>
      <button class="btn btn--ghost" type="button" data-done>Done</button>
      <button class="btn btn--primary" type="button" data-publish>${icon('check', 16)} Publish now</button>`
  });

  bindFields(body, (path, value) => {
    setValue(path, value, { preview: false });
    reloadSoon();
  });

  body.querySelectorAll('[data-collection]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const collectionId = checkbox.getAttribute('data-collection');
      const current = new Set(drink.collectionIds || []);
      if (checkbox.checked) current.add(collectionId);
      else current.delete(collectionId);
      setValue(base + '.collectionIds', [...current], { preview: false });
      reloadSoon();
    });
  });

  const file = body.querySelector('[data-file]');
  const setPhoto = (url) => {
    setValue(base + '.image', url, { preview: false });
    const preview = body.querySelector('.photo-field__preview');
    if (preview) preview.innerHTML = url ? `<img src="${esc(url)}" alt="">` : icon('image', 24);
    reloadSoon();
    panel.root.querySelector('.drawer__head h2').textContent = drink.name || 'Edit drink';
  };
  body.querySelector('[data-photo]').addEventListener('click', () => {
    pickImage({
      onChoose: (choice) => setPhoto(choice.url),
      folder: 'Drinks'
    });
  });
  body.querySelector('[data-photo-upload]').addEventListener('click', () => file.click());
  body.querySelector('[data-photo-remove]')?.addEventListener('click', () => setPhoto(''));
  file.addEventListener('change', async () => {
    if (!file.files?.length) return;
    const uploaded = await uploadFiles(file.files, { folder: 'Drinks' });
    if (uploaded[0]) setPhoto(uploaded[0].url);
  });

  let reloadTimer = 0;
  function reloadSoon() {
    emitStatus();
    scheduleAutosave();
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(() => structuralChange(), 1200);
  }

  panel.root.querySelector('[data-done]').addEventListener('click', () => {
    if (!drink.name.trim()) {
      toast('Give the drink a name before closing.', 'error');
      return;
    }
    panel.close();
    emit();
  });
  panel.root.querySelector('[data-publish]').addEventListener('click', async () => {
    if (!drink.name.trim()) {
      toast('Give the drink a name first.', 'error');
      return;
    }
    const ok = await publishWebsite('Drink updated');
    if (ok) {
      panel.close();
      emit();
    }
  });
  panel.root.querySelector('[data-delete]').addEventListener('click', async () => {
    panel.close();
    await deleteDrink(drink.id);
  });

  panel.root.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) {
      if (!drink.name.trim()) {
        drink.name = 'New drink';
        setValue(base + '.name', 'New drink', { preview: false });
      }
      emit();
    }
  });
}

/* =====================================================================
   Seasonal collections
   ===================================================================== */

export const seasonal = {
  title: 'Seasonal Specials',
  subtitle: 'Monthly boards, holiday menus and weekly specials.',
  render(root) {
    const content = S.content;
    const collections = [...content.collections].sort((a, b) => {
      if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
      return (b.startDate || '').localeCompare(a.startDate || '');
    });
    const live = collections.filter((collection) => !collection.archived);
    const archived = collections.filter((collection) => collection.archived);

    root.innerHTML = `
      <section class="page-head">
        <div>
          <h1>Seasonal Specials</h1>
          <p>Change what the homepage features, or start a new monthly board.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--primary" type="button" data-action="new">${icon('plus', 18)} New seasonal menu</button>
        </div>
      </section>

      <div class="info-banner">
        ${icon('sparkle', 18)}
        <p>The menu marked <strong>Featured</strong> is the one shown in the seasonal band on your homepage. Drinks stay on the site when a menu ends — nothing is deleted automatically.</p>
      </div>

      <div class="collection-grid">
        ${live.map((collection) => collectionCard(collection, content)).join('') || emptyState('seasonal', 'No live seasonal menus', 'Create one for this month’s specials.')}
      </div>

      ${
        archived.length
          ? `<section class="stack">
              <header class="stack__head"><h2>Archived menus</h2><p>Kept for reference — reactivate one any time.</p></header>
              <div class="collection-grid">
                ${archived.map((collection) => collectionCard(collection, content)).join('')}
              </div>
            </section>`
          : ''
      }`;
  }
};

function collectionCard(collection, content) {
  const count = content.drinks.filter((drink) => (drink.collectionIds || []).includes(collection.id)).length;
  const dates = collection.startDate
    ? formatDate(collection.startDate, { month: 'short', day: 'numeric' }) +
      (collection.endDate ? ' – ' + formatDate(collection.endDate, { month: 'short', day: 'numeric' }) : '')
    : 'No dates set';
  const endPassed = collection.autoArchive && collection.endDate && collection.endDate < new Date().toISOString().slice(0, 10);
  return `<article class="collection-card${collection.archived ? ' is-archived' : ''}">
    <div class="collection-card__cover">
      ${collection.image ? `<img src="${esc(collection.image)}" alt="">` : `<span>${icon('seasonal', 24)}</span>`}
      ${collection.featured && !collection.archived ? '<span class="badge badge--featured">Featured on homepage</span>' : ''}
    </div>
    <div class="collection-card__body">
      <div class="collection-card__title">
        <h3>${esc(collection.name)}</h3>
        ${collection.archived ? statusBadge('archived') : collection.active === false ? statusBadge('hidden') : statusBadge('live')}
      </div>
      <p class="muted">${esc(dates)} · ${count} drink${count === 1 ? '' : 's'}</p>
      ${endPassed ? `<p class="warn-text">${icon('alert', 14)} End date passed — hidden automatically.</p>` : ''}
      <p class="collection-card__desc">${esc(collection.description || '')}</p>
      <div class="collection-card__actions">
        <button class="btn btn--ghost btn--small" type="button" data-edit="${esc(collection.id)}">${icon('editor', 15)} Edit menu</button>
        ${
          collection.archived
            ? `<button class="btn btn--ghost btn--small" type="button" data-reactivate="${esc(collection.id)}">${icon('restore', 15)} Reactivate</button>`
            : `<button class="btn btn--ghost btn--small" type="button" data-feature="${esc(collection.id)}" ${
                collection.featured ? 'disabled' : ''
              }>${icon('star', 15)} ${collection.featured ? 'Featured' : 'Feature'}</button>
               <button class="btn btn--ghost btn--small" type="button" data-archive="${esc(collection.id)}">${icon('trash', 15)} Archive</button>`
        }
      </div>
    </div>
  </article>`;
}

export function wireSeasonal(root) {
  const rerender = () => {
    root.innerHTML = '';
    seasonal.render(root);
    wireSeasonal(root);
  };
  root.querySelector('[data-action="new"]')?.addEventListener('click', () => openCollectionEditor(null, rerender));
  root.querySelectorAll('[data-edit]').forEach((button) =>
    button.addEventListener('click', () => openCollectionEditor(button.getAttribute('data-edit'), rerender))
  );
  root.querySelectorAll('[data-feature]').forEach((button) =>
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-feature');
      pushHistory('feature collection');
      S.content.collections.forEach((collection) => {
        collection.featured = collection.id === id;
      });
      structuralChange();
      toast('That menu now appears in the homepage specials band.', 'success');
      rerender();
    })
  );
  root.querySelectorAll('[data-archive]').forEach((button) =>
    button.addEventListener('click', async () => {
      const collection = S.content.collections.find((item) => item.id === button.getAttribute('data-archive'));
      if (!collection) return;
      const ok = await confirmDialog({
        title: 'Archive "' + collection.name + '"?',
        message: 'The menu comes off the website, but every drink stays in your library and can be reused. You can reactivate it later.',
        confirmLabel: 'Archive menu'
      });
      if (!ok) return;
      pushHistory('archive collection');
      collection.archived = true;
      collection.active = false;
      if (collection.featured) {
        collection.featured = false;
        const next = S.content.collections.find((item) => !item.archived && item.id !== collection.id);
        if (next) next.featured = true;
      }
      structuralChange();
      toast('Menu archived. Drinks are safe in your library.', 'success');
      rerender();
    })
  );
  root.querySelectorAll('[data-reactivate]').forEach((button) =>
    button.addEventListener('click', () => {
      const collection = S.content.collections.find((item) => item.id === button.getAttribute('data-reactivate'));
      if (!collection) return;
      pushHistory('reactivate collection');
      collection.archived = false;
      collection.active = true;
      structuralChange();
      toast('Menu is live again. Publish to show it on the website.', 'success');
      rerender();
    })
  );
}

function openCollectionEditor(id, after) {
  const isNew = !id;
  const name = isNew ? 'New seasonal menu' : S.content.collections.find((item) => item.id === id)?.name;
  const body = document.createElement('div');
  body.className = 'form';
  body.innerHTML = isNew
    ? `<section class="form__section">
        <p class="muted">Give the menu a name and we will take care of the rest. You can add drinks next.</p>
        <label class="field"><span class="field__label">Menu name</span>
          <input class="input" data-new-name placeholder="e.g. December 2026"></label>
        <div class="form__grid">
          <label class="field"><span class="field__label">Starts (optional)</span><input class="input" type="date" data-new-start></label>
          <label class="field"><span class="field__label">Ends (optional)</span><input class="input" type="date" data-new-end></label>
        </div>
        <label class="field"><span class="field__label">Short description</span>
          <textarea class="input" rows="3" data-new-desc placeholder="A line or two about this month's specials."></textarea></label>
        <label class="switch-row"><span class="switch-row__text"><span class="switch-row__label">Feature on the homepage</span>
          <span class="switch-row__hint">Shows this menu in the seasonal band.</span></span>
          <input type="checkbox" class="switch" data-new-featured checked></label>
      </section>`
    : collectionForm(id);

  const dialog = modal({
    title: isNew ? 'New seasonal menu' : 'Edit ' + name,
    body,
    wide: true,
    footer: isNew
      ? `<button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
         <button class="btn btn--primary" type="button" data-create>Create menu</button>`
      : `<button class="btn btn--ghost btn--danger-text" type="button" data-delete>${icon('trash', 15)} Delete menu</button>
         <span class="spacer"></span>
         <button class="btn btn--ghost" type="button" data-close>Close</button>
         <button class="btn btn--primary" type="button" data-publish>${icon('check', 16)} Publish changes</button>`
  });

  if (isNew) {
    dialog.root.querySelector('[data-cancel]')?.addEventListener('click', () => dialog.close());
    dialog.root.querySelector('[data-create]').addEventListener('click', () => {
      const value = body.querySelector('[data-new-name]').value.trim();
      if (!value) {
        toast('Give the menu a name.', 'error');
        return;
      }
      pushHistory('new collection');
      const collection = {
        id: slugify(value) + '-' + uid('c').slice(2, 6),
        name: value,
        navLabel: value,
        kind: 'monthly',
        description: body.querySelector('[data-new-desc]').value,
        image: null,
        startDate: body.querySelector('[data-new-start]').value || '',
        endDate: body.querySelector('[data-new-end]').value || '',
        active: true,
        featured: body.querySelector('[data-new-featured]').checked,
        autoArchive: false,
        archived: false,
        order: S.content.collections.length,
        drinkOrder: []
      };
      if (collection.featured) S.content.collections.forEach((item) => (item.featured = false));
      S.content.collections.push(collection);
      structuralChange();
      dialog.close();
      toast('Menu created. Now add the drinks that belong to it.', 'success');
      after?.();
    });
    return;
  }

  const collection = S.content.collections.find((item) => item.id === id);
  if (!collection) return;
  const base = 'col.' + id;
  bindFields(body, (path, value) => {
    setValue(path, value, { preview: false });
    emitStatus();
    scheduleAutosave();
    window.setTimeout(() => structuralChange(), 900);
  });

  const imageButton = body.querySelector('[data-cover]');
  imageButton?.addEventListener('click', () => {
    pickImage({
      folder: 'Seasonal',
      onChoose: (choice) => {
        setValue(base + '.image', choice.url, { preview: false });
        const cover = body.querySelector('.cover-preview');
        if (cover) cover.innerHTML = `<img src="${esc(choice.url)}" alt="">`;
        structuralChange();
      }
    });
  });
  body.querySelector('[data-cover-remove]')?.addEventListener('click', () => {
    setValue(base + '.image', '', { preview: false });
    const cover = body.querySelector('.cover-preview');
    if (cover) cover.innerHTML = icon('seasonal', 24);
    structuralChange();
  });

  wireCollectionDrinks(body, collection);

  dialog.root.querySelector('[data-delete]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete "' + collection.name + '"?',
      message: 'The menu is removed but every drink in it stays in your menu list. If you might reuse it, archive it instead.',
      confirmLabel: 'Delete menu',
      danger: true
    });
    if (!ok) return;
    pushHistory('delete collection');
    S.content.collections = S.content.collections.filter((item) => item.id !== collection.id);
    S.content.drinks.forEach((drink) => {
      drink.collectionIds = (drink.collectionIds || []).filter((item) => item !== collection.id);
    });
    structuralChange();
    dialog.close();
    toast('Menu deleted. Drinks kept.', 'success');
    after?.();
  });
  dialog.root.querySelector('[data-publish]').addEventListener('click', async () => {
    const ok = await publishWebsite('Seasonal menu updated');
    if (ok) {
      dialog.close();
      after?.();
    }
  });
}

function collectionForm(id) {
  const collection = S.content.collections.find((item) => item.id === id);
  const base = 'col.' + id;
  return `<section class="form__section">
      <div class="cover-field">
        <span class="cover-preview">${collection.image ? `<img src="${esc(collection.image)}" alt="">` : icon('seasonal', 24)}</span>
        <div>
          <button class="btn btn--ghost btn--small" type="button" data-cover>${icon('media', 15)} Choose cover photo</button>
          ${collection.image ? '<button class="btn btn--ghost btn--small btn--danger-text" type="button" data-cover-remove>Remove</button>' : ''}
          <p class="field__hint">Optional. A wide photo works best.</p>
        </div>
      </div>
      ${field('Menu name', textInput(base + '.name', collection.name))}
      ${field(
        'Short name for the filter buttons',
        textInput(base + '.navLabel', collection.navLabel),
        'This is what customers see on the menu filter buttons.'
      )}
      ${field('Description', textArea(base + '.description', collection.description, { rows: 3 }))}
      <div class="form__grid">
        ${field('Starts', textInput(base + '.startDate', collection.startDate, { type: 'date' }))}
        ${field('Ends', textInput(base + '.endDate', collection.endDate, { type: 'date' }))}
      </div>
      ${switchField(base + '.active', collection.active, 'Show this menu on the website')}
      ${switchField(base + '.featured', collection.featured, 'Feature on the homepage', 'Only one menu is featured at a time.')}
      ${switchField(
        base + '.autoArchive',
        collection.autoArchive,
        'Hide automatically after the end date',
        'Leave off if you would rather hide menus yourself.'
      )}
    </section>
    <section class="form__section">
      <h3 class="form__title">Drinks in this menu</h3>
      <p class="field__hint">Drag to set the order they appear in this collection.</p>
      <div class="mini-drink-list" data-collection-drinks></div>
      <button class="btn btn--ghost btn--small" type="button" data-add-drinks>${icon('plus', 15)} Add drinks to this menu</button>
    </section>`;
}

function wireCollectionDrinks(body, collection) {
  const host = body.querySelector('[data-collection-drinks]');
  const drinks = collectionDrinksFor(collection);
  host.innerHTML = drinks.length
    ? drinks
        .map(
          (drink) => `<div class="mini-drink" draggable="true" data-id="${esc(drink.id)}">
            <span class="drag-handle">${icon('drag', 14)}</span>
            <span class="mini-drink__thumb">${drink.image ? `<img src="${esc(drink.image)}" alt="">` : icon('menu', 14)}</span>
            <span>${esc(drink.name)}</span>
            <button class="icon-btn icon-btn--danger" type="button" data-remove="${esc(drink.id)}" title="Remove from this menu">${icon(
              'close',
              14
            )}</button>
          </div>`
        )
        .join('')
    : '<p class="muted">No drinks in this menu yet.</p>';

  host.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const drink = S.content.drinks.find((item) => item.id === button.getAttribute('data-remove'));
      if (!drink) return;
      pushHistory('remove from collection');
      drink.collectionIds = (drink.collectionIds || []).filter((id) => id !== collection.id);
      structuralChange();
      wireCollectionDrinks(body, collection);
    });
  });

  let dragged = null;
  host.querySelectorAll('[data-id]').forEach((row) => {
    row.addEventListener('dragstart', (event) => {
      dragged = row;
      row.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!dragged || dragged === row) return;
      const items = [...host.children];
      if (items.indexOf(dragged) < items.indexOf(row)) row.after(dragged);
      else row.before(dragged);
    });
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      pushHistory('collection order');
      collection.drinkOrder = [...host.querySelectorAll('[data-id]')].map((node) => node.getAttribute('data-id'));
      structuralChange();
    });
  });

  body.querySelector('[data-add-drinks]').addEventListener('click', () => {
    const dialog = modal({
      title: 'Add drinks to ' + collection.name,
      body: `<div class="picker">
        <input class="input" type="search" placeholder="Search your drinks" data-search>
        <div class="picker__list" data-list></div>
      </div>`,
      wide: true,
      footer: '<button class="btn btn--primary" type="button" data-close>Done</button>'
    });
    const list = dialog.body.querySelector('[data-list]');
    const search = dialog.body.querySelector('[data-search]');
    const paint = () => {
      const term = search.value.toLowerCase();
      list.innerHTML = sortedDrinks()
        .filter((drink) => !term || drink.name.toLowerCase().includes(term))
        .map(
          (drink) => `<label class="pick-row">
            <input type="checkbox" data-pick="${esc(drink.id)}" ${
              (drink.collectionIds || []).includes(collection.id) ? 'checked' : ''
            }>
            <span class="pick-row__thumb">${drink.image ? `<img src="${esc(drink.image)}" alt="">` : icon('menu', 14)}</span>
            <span>${esc(drink.name || 'Untitled')}</span>
            <small>${esc(drink.label || '')}</small>
          </label>`
        )
        .join('');
      list.querySelectorAll('[data-pick]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          const drink = S.content.drinks.find((item) => item.id === checkbox.getAttribute('data-pick'));
          if (!drink) return;
          const set = new Set(drink.collectionIds || []);
          if (checkbox.checked) set.add(collection.id);
          else set.delete(collection.id);
          drink.collectionIds = [...set];
          structuralChange();
          wireCollectionDrinks(body, collection);
        });
      });
    };
    paint();
    search.addEventListener('input', paint);
    dialog.root.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  });
}

function collectionDrinksFor(collection) {
  const order = collection.drinkOrder || [];
  return S.content.drinks
    .filter((drink) => (drink.collectionIds || []).includes(collection.id))
    .sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib) || (a.order ?? 0) - (b.order ?? 0);
    });
}
