/* Pure helpers shared by the website renderer (inside the Worker) and the
   dashboard (in the browser). No DOM, no Node — safe on both sides. */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripTags(value) {
  return String(value == null ? '' : value).replace(/<[^>]*>/g, '');
}

export function nl2br(value) {
  return esc(value).replace(/\r?\n/g, '<br>');
}

export function uid(prefix = 'id') {
  const bytes = new Uint8Array(6);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return prefix + '-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || uid('item');
}

/* ---------------------------------------------------------------- paths --
   A path addresses one editable value inside the content document:
     seo.title            business.phone          branding.primary
     ann.text             nav.links.0.label       footer.tagline
     sec.hero.title       sec.hero.photo.src      sec.hero.facts.1.label
     cat.shakes.name      col.nov-2026.description
     drink.caramel-apple.price
   Everything resolves through getPath/setPath so the dashboard never needs
   to know how the document is arranged. */

/* Paths beginning with sec./cat./col./drink. address one item of a list by
   its id, so reordering the list never breaks a saved field. */
const LIST_PREFIXES = { sec: 'sections', cat: 'categories', col: 'collections', drink: 'drinks' };

function locate(root, path) {
  const parts = String(path).split('.');
  const head = parts[0];
  if (!root) return null;
  if (head === 'ann') return { target: root.announcement, keys: parts.slice(1) };
  if (LIST_PREFIXES[head]) {
    const list = root[LIST_PREFIXES[head]] || [];
    const item = list.find((entry) => entry && entry.id === parts[1]);
    if (!item) return null;
    return { target: item, keys: parts.slice(2) };
  }
  return { target: root, keys: parts };
}

export function getPath(obj, path) {
  const located = locate(obj, path);
  if (!located) return undefined;
  return located.keys.reduce((node, key) => (node == null ? undefined : node[key]), located.target);
}

export function setPath(obj, path, value) {
  const located = locate(obj, path);
  if (!located || !located.keys.length) return obj;
  const keys = located.keys;
  let node = located.target;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (node[key] == null || typeof node[key] !== 'object') {
      node[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
  return obj;
}

export const SECTION_ALIASES = { hero: 'top', seasonal: 'november' };

export function anchorOf(section) {
  return SECTION_ALIASES[section?.id] || section?.id || 'section';
}

export function findSection(content, id) {
  return (content.sections || []).find((section) => section.id === id);
}

export function findDrink(content, id) {
  return (content.drinks || []).find((drink) => drink.id === id);
}

export function findCategory(content, id) {
  return (content.categories || []).find((category) => category.id === id);
}

export function visibleSections(content) {
  return (content.sections || []).filter((section) => section.visible !== false);
}

/* --------------------------------------------------------------- hours -- */

export function hoursLabel(entry) {
  if (!entry || entry.closed) return 'Closed';
  return clockLabel(entry.open) + ' – ' + clockLabel(entry.close);
}

export function clockLabel(value) {
  const [hRaw, mRaw] = String(value || '00:00').split(':');
  let h = parseInt(hRaw, 10);
  const m = parseInt(mRaw || '0', 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + (m ? ':' + String(m).padStart(2, '0') : ':00') + ' ' + suffix;
}

export function scheduleOf(business) {
  const map = {};
  (business.hours || []).forEach((entry) => {
    map[entry.day] = entry;
  });
  return map;
}

/* Returns the local time in the shop's timezone, independent of the visitor. */
export function shopClock(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value || '';
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = days[read('weekday')];
  const hour = parseInt(read('hour'), 10) % 24;
  const minute = parseInt(read('minute'), 10);
  return { day: Number.isFinite(day) ? day : date.getDay(), minutes: hour * 60 + minute };
}

export function openStatus(content, date = new Date()) {
  const schedule = scheduleOf(content.business);
  const now = shopClock('America/Detroit', date);
  const today = schedule[now.day];
  if (today && !today.closed) {
    const [oh, om] = String(today.open).split(':').map(Number);
    const [ch, cm] = String(today.close).split(':').map(Number);
    const open = oh * 60 + (om || 0);
    const close = ch * 60 + (cm || 0);
    if (now.minutes >= open && now.minutes < close) {
      return { open: true, text: 'Open today until ' + clockLabel(today.close) };
    }
  }
  for (let i = 1; i <= 7; i++) {
    const day = (now.day + i) % 7;
    const entry = schedule[day];
    if (entry && !entry.closed) {
      return {
        open: false,
        text: 'Closed now — opens ' + (i === 1 ? 'tomorrow' : DAY_NAMES[day]) + ' at ' + clockLabel(entry.open)
      };
    }
  }
  return { open: false, text: 'Closed now' };
}

/* ------------------------------------------------------------- drinks -- */

export function sortedDrinks(content) {
  return [...(content.drinks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function publicDrinks(content) {
  return sortedDrinks(content).filter((drink) => !drink.hidden);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* A collection is live when it is switched on, not archived and — only if the
   owner asked for it — its end date has not passed. */
export function collectionLive(collection, today = todayISO()) {
  if (!collection || collection.archived || collection.active === false) return false;
  if (collection.autoArchive && collection.endDate && today > collection.endDate) return false;
  return true;
}

export function featuredCollection(content) {
  const collections = content.collections || [];
  const featured = collections.find((c) => c.featured && collectionLive(c));
  if (featured) return featured;
  const active = collections
    .filter((c) => collectionLive(c))
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  return active[0] || collections[0] || null;
}

export function collectionById(content, id) {
  return (content.collections || []).find((collection) => collection.id === id) || null;
}

export function collectionDrinks(content, id) {
  const collection = collectionById(content, id);
  const order = collection?.drinkOrder || [];
  const list = publicDrinks(content).filter((drink) => (drink.collectionIds || []).includes(id));
  if (!order.length) return list;
  return list.slice().sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib) || (a.order ?? 0) - (b.order ?? 0);
  });
}

export function featuredDrinks(content, collectionId) {
  const inCollection = collectionDrinks(content, collectionId);
  const featured = inCollection.filter((drink) => drink.featured);
  return featured.length ? featured : inCollection.slice(0, 3);
}

/* Filter chips: "All drinks", live collections, the past-boards archive and
   categories the owner chose to show. */
export function menuFilters(content) {
  const filters = [{ id: 'all', label: 'All drinks', note: 'The everyday menu plus every seasonal board since the rename.' }];
  const collections = [...(content.collections || [])]
    .filter((collection) => collectionLive(collection))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  collections.forEach((collection) => {
    if (!collectionDrinks(content, collection.id).length) return;
    filters.push({
      id: 'col:' + collection.id,
      label: collection.navLabel || collection.name,
      note: collection.description || ''
    });
  });
  if ((content.collections || []).some((collection) => collection.archived)) {
    filters.push({
      id: 'past',
      label: 'Past boards',
      note: 'Weekly boards kept for reference — none of these are pouring now.'
    });
  }
  [...(content.categories || [])]
    .filter((category) => category.showInFilters && !category.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach((category) => {
      filters.push({ id: 'cat:' + category.id, label: category.name, note: category.note || '' });
    });
  return filters;
}

export function drinkMatches(content, drink, filterId) {
  if (!filterId || filterId === 'all') return true;
  if (filterId === 'past') {
    const archivedIds = (content.collections || []).filter((c) => c.archived).map((c) => c.id);
    return (drink.collectionIds || []).some((id) => archivedIds.includes(id));
  }
  if (filterId.startsWith('col:')) return (drink.collectionIds || []).includes(filterId.slice(4));
  if (filterId.startsWith('cat:')) return drink.categoryId === filterId.slice(4);
  return true;
}

export function priceLabel(drink) {
  const price = String(drink?.price ?? '').trim();
  return price || 'Price in store';
}

export function collectionBadge(drink, content) {
  if (!drink.available) return '';
  if (drink.archived) return 'Past · ' + String(drink.available).split(' · ')[0];
  return drink.available;
}

export function drinkStatus(content, drink) {
  if (drink.archived) return 'past';
  return 'current';
}

/* Number of active (not archived) collections a drink belongs to. */
export function activeCollectionsFor(content, drink) {
  return (drink.collectionIds || [])
    .map((id) => collectionById(content, id))
    .filter((collection) => collection && collection.active !== false && !collection.archived);
}

export function totals(content) {
  const drinks = content.drinks || [];
  return {
    drinks: drinks.length,
    visible: drinks.filter((d) => !d.hidden).length,
    featured: drinks.filter((d) => d.featured).length,
    archived: drinks.filter((d) => d.archived).length,
    collections: (content.collections || []).length,
    categories: (content.categories || []).length
  };
}
