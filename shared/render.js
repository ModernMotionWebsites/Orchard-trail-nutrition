/* Renders the public website from a content document.
   The Worker uses it for every page request (so the published content is
   always what visitors get), and the same markup is reused inside the
   dashboard's live preview. Every editable element carries data-edit. */

import {
  esc, nl2br, DAY_NAMES, DAY_SHORT, hoursLabel, scheduleOf, openStatus,
  publicDrinks, menuFilters, drinkMatches, featuredCollection, featuredDrinks,
  priceLabel, collectionBadge, anchorOf, visibleSections, collectionDrinks
} from './model.js';

const FONT_PAIRS = {
  fraunces: {
    name: 'Fraunces + Manrope',
    display: '"Fraunces", "Iowan Old Style", Georgia, serif',
    sans: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    google: 'family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Manrope:wght@300..700'
  },
  marcellus: {
    name: 'Marcellus + Karla',
    display: '"Marcellus", "Iowan Old Style", Georgia, serif',
    sans: '"Karla", ui-sans-serif, system-ui, sans-serif',
    google: 'family=Marcellus&family=Karla:wght@300..700'
  },
  dmserif: {
    name: 'DM Serif + DM Sans',
    display: '"DM Serif Display", Georgia, serif',
    sans: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    google: 'family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300..700'
  },
  cormorant: {
    name: 'Cormorant + Inter',
    display: '"Cormorant Garamond", Georgia, serif',
    sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
    google: 'family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=Inter:wght@300..700'
  }
};

export const FONT_PAIR_LIST = Object.entries(FONT_PAIRS).map(([id, pair]) => ({ id, name: pair.name }));
export const BUTTON_STYLES = [
  { id: 'square', name: 'Square corners' },
  { id: 'soft', name: 'Soft corners' },
  { id: 'round', name: 'Pill buttons' }
];

function fontPairOf(branding) {
  return FONT_PAIRS[branding?.fontPair] || FONT_PAIRS.fraunces;
}

function radiusFor(style) {
  if (style === 'round') return '999px';
  if (style === 'soft') return '8px';
  return '2px';
}

function ed(path, label, kind = 'text', extra = '') {
  return ` data-edit="${esc(path)}" data-label="${esc(label)}" data-kind="${kind}"${extra}`;
}

function edList(path, name) {
  return ` data-list="${esc(path)}" data-item-name="${esc(name)}"`;
}

function linkAttrs(href, track) {
  const url = String(href || '').trim();
  const external = /^https?:/i.test(url);
  const attrs = [`href="${esc(url || '#')}"`];
  if (external) attrs.push('target="_blank"', 'rel="noopener"');
  if (track) attrs.push(`data-track="${esc(track)}"`);
  return attrs.join(' ');
}

function socialHref(content, key) {
  return String(content.business?.[key] || '').trim();
}

/* --------------------------------------------------------------- head -- */

export function renderHead(content, options = {}) {
  const seo = content.seo || {};
  const branding = content.branding || {};
  const pair = fontPairOf(branding);
  const share = seo.shareImage || content.sections?.find((s) => s.id === 'hero')?.photo?.src || '';
  const absoluteShare = share ? (options.origin || '') + share : '';
  const favicon =
    branding.favicon ||
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='${encodeURIComponent(branding.primary || '#203D31')}'/%3E%3Ccircle cx='16' cy='16' r='6.5' fill='${encodeURIComponent(branding.accent || '#DD8951')}'/%3E%3C/svg%3E`;

  const themeStyle = `
    :root{
      --forest:${esc(branding.primary || '#203D31')};
      --sage:${esc(branding.secondary || '#A8B89C')};
      --orange:${esc(branding.accent || '#DD8951')};
      --ivory:${esc(branding.background || '#F5F1E8')};
      --charcoal:${esc(branding.ink || '#252723')};
      --forest-deep:color-mix(in srgb, var(--forest) 78%, #000);
      --orange-deep:color-mix(in srgb, var(--orange) 62%, #000);
      --sage-soft:color-mix(in srgb, var(--sage) 68%, #fff);
      --ivory-deep:color-mix(in srgb, var(--ivory) 92%, var(--forest) 8%);
      --ivory-soft:color-mix(in srgb, var(--ivory) 70%, #fff);
      --display:${pair.display};
      --sans:${pair.sans};
      --radius:${radiusFor(branding.buttonStyle)};
    }`;

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(seo.title)}</title>
<meta name="description" content="${esc(seo.description)}">
<meta name="theme-color" content="${esc(branding.background || '#F5F1E8')}">
${seo.keywords ? `<meta name="keywords" content="${esc(seo.keywords)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(content.business?.name || '')}">
<meta property="og:title" content="${esc(seo.title)}">
<meta property="og:description" content="${esc(seo.description)}">
${absoluteShare ? `<meta property="og:image" content="${esc(absoluteShare)}">` : ''}
<meta name="twitter:card" content="${absoluteShare ? 'summary_large_image' : 'summary'}">
${absoluteShare ? `<meta name="twitter:image" content="${esc(absoluteShare)}">` : ''}
<link rel="canonical" href="${esc((options.origin || '') + (options.path || '/'))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${pair.google}&display=swap" rel="stylesheet">
<link rel="icon" href="${esc(favicon)}">
<link rel="stylesheet" href="/styles.css">
<style>${themeStyle}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd(content))}</script>`;
}

function jsonLd(content) {
  const business = content.business || {};
  const hours = scheduleOf(business);
  const groups = new Map();
  (business.hours || []).forEach((entry) => {
    if (entry.closed) return;
    const key = entry.open + '-' + entry.close;
    if (!groups.has(key)) groups.set(key, { open: entry.open, close: entry.close, days: [] });
    groups.get(key).days.push(DAY_NAMES[entry.day]);
  });
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    description: business.description,
    telephone: business.phoneDial || business.phone,
    priceRange: business.priceRange || '$$',
    image: content.seo?.shareImage || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address1,
      addressLocality: business.city,
      addressRegion: business.region,
      postalCode: business.postalCode,
      addressCountry: business.country || 'US'
    },
    sameAs: [business.facebook, business.instagram].filter(Boolean),
    openingHoursSpecification: [...groups.values()].map((group) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: group.days,
      opens: group.open,
      closes: group.close
    }))
  };
  if (Number.isFinite(business.latitude)) {
    data.geo = { '@type': 'GeoCoordinates', latitude: business.latitude, longitude: business.longitude };
  }
  if (business.email) data.email = business.email;
  if (hours && Object.keys(hours).length) data.openingHours = undefined;
  return data;
}

/* -------------------------------------------------------------- chrome -- */

function renderAnnouncement(content) {
  const ann = content.announcement || {};
  if (!ann.enabled || !String(ann.text || '').trim()) return '';
  const today = new Date().toISOString().slice(0, 10);
  if (ann.startDate && today < ann.startDate) return '';
  if (ann.endDate && today > ann.endDate) return '';
  const bg = ann.background || content.branding?.primary || '#203D31';
  return `<div class="site-announce" style="--ann-bg:${esc(bg)}" role="region" aria-label="Announcement">
  <div class="site-announce__inner">
    <p${ed('ann.text', 'Announcement text')}>${nl2br(ann.text)}</p>
    ${ann.linkLabel && ann.linkHref ? `<a class="site-announce__link" ${linkAttrs(ann.linkHref, 'announcement')}${ed('ann.linkLabel', 'Announcement button text')}>${esc(ann.linkLabel)}<span aria-hidden="true">&rarr;</span></a>` : ''}
  </div>
</div>`;
}

function renderHeader(content) {
  const branding = content.branding || {};
  const business = content.business || {};
  const cta = content.nav?.cta || {};
  const ctaHref = String(cta.href || '').trim() || business.directionsUrl || '';
  const logo = String(branding.logoImage || '').trim();
  const ig = socialHref(content, 'instagram');
  const links = (content.nav?.links || [])
    .map(
      (link, index) => `<li><a class="nav__link" ${linkAttrs(link.href, link.href === '#menu' ? 'menu' : '')}${ed(
        `nav.links.${index}.label`,
        'Navigation label',
        'text',
        ` data-list-item="nav.links"`
      )}>${esc(link.label)}</a></li>`
    )
    .join('');

  return `<header class="site-header" id="site-header">
  <div class="site-header__inner">
    <a class="brand" href="#top" aria-label="${esc(business.name || 'Home')} — home"${ed('branding.wordmark', 'Business name in the header logo')}>
      ${logo ? `<img class="brand__logo" src="${esc(logo)}" alt="${esc(business.name || '')}" width="160" height="40">` : `<span class="brand__name">${esc(branding.wordmark || business.name || '')}</span>
      <span class="brand__sub"${ed('branding.wordmarkSub', 'Small word under the business name')}>${esc(branding.wordmarkSub || '')}</span>`}
    </a>

    <nav class="nav" id="primary-nav" aria-label="Primary">
      <ul class="nav__list"${edList('nav.links', 'navigation link')}>
        ${links}
      </ul>
    </nav>

    <div class="site-header__actions">
      ${ig ? `<a class="icon-link" ${linkAttrs(ig, 'instagram')} aria-label="Instagram">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M7.5 2.75h9a4.75 4.75 0 0 1 4.75 4.75v9a4.75 4.75 0 0 1-4.75 4.75h-9A4.75 4.75 0 0 1 2.75 16.5v-9A4.75 4.75 0 0 1 7.5 2.75Z"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.35" cy="6.7" r="1.15" fill="currentColor"/></svg>
      </a>` : ''}
      <a class="btn btn--small btn--solid" ${linkAttrs(ctaHref, 'directions')}${ed('nav.cta.label', 'Header button text', 'link')}>
        <span>${esc(cta.label || 'Get Directions')}</span>
      </a>
      <button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">
        <span></span><span></span>
      </button>
    </div>
  </div>
</header>

<div class="mobile-menu" id="mobile-menu" hidden>
  <nav class="mobile-menu__inner" aria-label="Mobile">
    <ol class="mobile-menu__list">
      ${(content.nav?.links || [])
        .map(
          (link, index) =>
            `<li><a ${linkAttrs(link.href)}><span class="mm__idx">${String(index + 1).padStart(2, '0')}</span>${esc(link.label)}</a></li>`
        )
        .join('')}
    </ol>
    <div class="mobile-menu__meta">
      <p>${esc(business.address1)}<br>${esc(business.address2)}</p>
      ${business.phone ? `<p><a href="tel:${esc(business.phoneDial)}" data-track="phone">${esc(business.phone)}</a></p>` : ''}
      <p class="mobile-menu__social">
        ${ig ? `<a ${linkAttrs(ig, 'instagram')}>Instagram</a>` : ''}
        ${socialHref(content, 'facebook') ? `<a ${linkAttrs(socialHref(content, 'facebook'), 'facebook')}>Facebook</a>` : ''}
      </p>
    </div>
  </nav>
</div>`;
}

function renderFooter(content) {
  const business = content.business || {};
  const footer = content.footer || {};
  const schedule = scheduleOf(business);
  const weekdays = [1, 2, 3, 4, 5].map((day) => schedule[day]).filter(Boolean);
  const sameWeekday = weekdays.length === 5 && weekdays.every((d) => !d.closed && d.open === weekdays[0].open && d.close === weekdays[0].close);
  const summary = sameWeekday
    ? `Mon–Fri ${shortClock(weekdays[0].open)}–${shortClock(weekdays[0].close)}`
    : '';
  const weekend = [6, 0].map((day) => schedule[day]);
  const weekendLine = weekend
    .map((entry, i) => (entry ? `${DAY_SHORT[i === 0 ? 6 : 0]} ${entry.closed ? 'closed' : shortClock(entry.open) + '–' + shortClock(entry.close)}` : ''))
    .filter(Boolean)
    .join(' · ');

  return `<footer class="site-footer">
  <div class="shell">
    <div class="site-footer__top">
      <p class="site-footer__eyebrow">${esc(business.name)}</p>
      <p class="site-footer__line"${ed('footer.tagline', 'Footer tagline', 'text')}>${esc(footer.tagline)}</p>
    </div>

    <div class="site-footer__cols">
      <nav class="site-footer__nav" aria-label="Footer"${edList('footer.links', 'footer link')}>
        ${(footer.links || [])
          .map(
            (link, index) =>
              `<a ${linkAttrs(link.href)}${ed(`footer.links.${index}.label`, 'Footer link text', 'text', ' data-list-item="footer.links"')}>${esc(link.label)}</a>`
          )
          .join('')}
      </nav>
      <div class="site-footer__meta">
        <p>${esc(business.address1)}<br>${esc(business.address2)}</p>
        ${business.phone ? `<p><a href="tel:${esc(business.phoneDial)}" data-track="phone">${esc(business.phone)}</a></p>` : ''}
      </div>
      <div class="site-footer__meta">
        <p>${summary ? esc(summary) + '<br>' : ''}${esc(weekendLine)}</p>
        <p class="site-footer__social">
          ${socialHref(content, 'instagram') ? `<a ${linkAttrs(socialHref(content, 'instagram'), 'instagram')}>Instagram</a>` : ''}
          ${socialHref(content, 'facebook') ? `<a ${linkAttrs(socialHref(content, 'facebook'), 'facebook')}>Facebook</a>` : ''}
        </p>
      </div>
    </div>

    <p class="site-footer__wordmark" aria-hidden="true">${esc((content.branding?.wordmark || business.name || '').split(' ')[0])}</p>

    <div class="site-footer__base">
      <p>&copy; <span id="year">${new Date().getFullYear()}</span> ${esc(business.name)}. All rights reserved.</p>
      <p${ed('footer.copyright', 'Footer note', 'multiline')}>${esc(footer.copyright)}${footer.credit ? '<br>' + esc(footer.credit) : ''}</p>
    </div>
  </div>
</footer>`;
}

function shortClock(value) {
  const [hRaw, mRaw] = String(value || '00:00').split(':');
  const h = parseInt(hRaw, 10);
  const m = parseInt(mRaw || '0', 10);
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}` : `${hour}`;
}

/* ------------------------------------------------------------ sections -- */

function renderHero(content, section) {
  const business = content.business || {};
  const photo = section.photo || {};
  const facts = (section.facts || [])
    .map(
      (fact, index) =>
        `<li>
          <strong${ed(`sec.hero.facts.${index}.value`, 'Hero fact value', 'text', ' data-list-item="sec.hero.facts"')}>${esc(fact.value)}</strong>
          <span${ed(`sec.hero.facts.${index}.label`, 'Hero fact label')}>${esc(fact.label)}</span>
        </li>`
    )
    .join('');

  const boardItems = (section.boardItems || [])
    .map(
      (item, index) =>
        `<li>
          <span${ed(`sec.hero.boardItems.${index}.name`, 'Special name', 'text', ' data-list-item="sec.hero.boardItems"')}>${esc(item.name)}</span>
          <em${ed(`sec.hero.boardItems.${index}.note`, 'Special description')}>${esc(item.note)}</em>
        </li>`
    )
    .join('');

  return `<section class="hero" id="top" data-section="hero" data-section-type="hero" aria-label="Welcome">
  <div class="hero__grid">
    <div class="hero__copy">
      <p class="eyebrow" data-reveal>
        <span class="eyebrow__dot" aria-hidden="true"></span>
        <span${ed('sec.hero.eyebrow', 'Small line above the headline')}>${esc(section.eyebrow)}</span>
      </p>

      <h1 class="hero__title" data-split${ed('sec.hero.title', 'Homepage headline', 'multiline')}>${nl2br(section.title)}</h1>

      <p class="hero__lede" data-reveal data-reveal-delay="120"${ed('sec.hero.lede', 'Homepage introduction', 'multiline')}>${nl2br(section.lede)}</p>

      <div class="hero__actions" data-reveal data-reveal-delay="220">
        <a class="btn btn--solid" ${linkAttrs(section.primary?.href, section.primary?.href?.includes('menu') ? 'menu' : '')}${ed('sec.hero.primary', 'Main button', 'link')}><span>${esc(section.primary?.label)}</span><i aria-hidden="true" class="btn__arrow">&rarr;</i></a>
        <a class="btn btn--ghost" ${linkAttrs(section.secondary?.href)}${ed('sec.hero.secondary', 'Second button', 'link')}><span>${esc(section.secondary?.label)}</span></a>
      </div>

      <ul class="hero__facts" data-reveal data-reveal-delay="320"${edList('sec.hero.facts', 'hero highlight')}>${facts}</ul>
    </div>

    <aside class="hero__board" data-reveal data-reveal-delay="80" aria-label="This month's specials">
      ${photo?.src ? `<figure class="hero__shot">
        <img src="${esc(photo.src)}" width="816" height="576" alt="${esc(photo.alt)}" fetchpriority="high" decoding="async"${ed('sec.hero.photo.src', 'Hero photo', 'image', ` data-alt-path="sec.hero.photo.alt"`)}>
        <figcaption${ed('sec.hero.photo.caption', 'Photo caption')}>${esc(photo.caption)}</figcaption>
      </figure>` : `<button class="hero__shot hero__shot--empty" type="button" data-add-image="sec.hero.photo.src">Add a photo</button>`}
      <p class="hero__board-k"${ed('sec.hero.boardKicker', 'Label above the specials list')}>${esc(section.boardKicker)}</p>
      <ol class="hero__board-list"${edList('sec.hero.boardItems', 'special')}>${boardItems}</ol>
      <p class="hero__board-note"${ed('sec.hero.boardNote', 'Note under the specials list', 'multiline')}>${esc(section.boardNote)}</p>
    </aside>
  </div>

  <a class="scroll-cue" href="#story" aria-label="Scroll to our story">
    <span class="scroll-cue__label">Scroll</span>
    <span class="scroll-cue__line" aria-hidden="true"><i></i></span>
  </a>
</section>`;
}

function renderMarquee(content, section) {
  const items = section.items || [];
  const group = items
    .map(
      (item, index) =>
        `<em${ed(`sec.marquee.items.${index}`, 'Strip text', 'text', ' data-list-item="sec.marquee.items"')}>${esc(item)}</em><i>&#9679;</i>`
    )
    .join('');
  return `<div class="marquee" aria-hidden="true" data-section="marquee" data-section-type="marquee">
    <div class="marquee__track">
      <span class="marquee__group">${group}</span>
      <span class="marquee__group">${group}</span>
    </div>
  </div>`;
}

function renderStory(content, section) {
  const photo = section.photo || {};
  const paragraphs = (section.paragraphs || [])
    .map(
      (text, index) =>
        `<p data-reveal data-reveal-delay="${80 + index * 60}"${ed(`sec.story.paragraphs.${index}`, 'Story paragraph', 'multiline', ' data-list-item="sec.story.paragraphs"')}>${nl2br(text)}</p>`
    )
    .join('');
  const facts = (section.facts || [])
    .map(
      (fact, index) =>
        `<div><dt${ed(`sec.story.facts.${index}.label`, 'Fact label', 'text', ' data-list-item="sec.story.facts"')}>${esc(fact.label)}</dt><dd${ed(`sec.story.facts.${index}.value`, 'Fact value')}>${esc(fact.value)}</dd></div>`
    )
    .join('');

  return `<section class="story section" id="story" data-section="story" data-section-type="story">
    <div class="shell">
      <div class="section-head">
        <p class="eyebrow" data-reveal><span class="eyebrow__dot" aria-hidden="true"></span><span${ed('sec.story.eyebrow', 'Story eyebrow')}>${esc(section.eyebrow)}</span></p>
        <h2 class="section-title" data-split${ed('sec.story.title', 'Story headline', 'multiline')}>${nl2br(section.title)}</h2>
      </div>

      <div class="story__grid">
        ${photo?.src ? `<figure class="story__photo" data-reveal>
          <img src="${esc(photo.src)}"${photo.srcset ? ` srcset="${esc(photo.srcset)}"` : ''}${photo.sizes ? ` sizes="${esc(photo.sizes)}"` : ''} width="960" height="1280" loading="lazy" decoding="async" alt="${esc(photo.alt)}"${ed('sec.story.photo.src', 'Story photo', 'image', ` data-alt-path="sec.story.photo.alt"`)}>
          <figcaption>
            <span class="story__photo-k"${ed('sec.story.photo.kicker', 'Small label over the caption')}>${esc(photo.kicker)}</span>
            <span${ed('sec.story.photo.caption', 'Photo caption', 'multiline')}>${nl2br(photo.caption)}</span>
          </figcaption>
        </figure>` : `<button class="story__photo story__photo--empty" type="button" data-add-image="sec.story.photo.src">Add a photo</button>`}

        <div class="story__body">
          <p class="lead" data-reveal${ed('sec.story.lead', 'Story opening line', 'multiline')}>${nl2br(section.lead)}</p>
          ${paragraphs}

          <dl class="story__facts" data-reveal data-reveal-delay="200"${edList('sec.story.facts', 'story fact')}>${facts}</dl>

          <a class="link-arrow" ${linkAttrs(section.cta?.href, 'menu')} data-reveal data-reveal-delay="260"${ed('sec.story.cta', 'Story link', 'link')}>
            ${esc(section.cta?.label)} <i aria-hidden="true">&rarr;</i>
          </a>
        </div>
      </div>
    </div>
  </section>`;
}

function renderDrinkMeta(content, drink, priceClass, sourceClass) {
  const source = String(drink.source || '').trim();
  const url = String(drink.sourceUrl || '').trim();
  const price = `<span class="${priceClass}">${esc(priceLabel(drink))}</span>`;
  const src = source
    ? url
      ? `<a class="${sourceClass}" href="${esc(url)}" target="_blank" rel="noopener">${esc(source)}</a>`
      : `<span class="${sourceClass}">${esc(source)}</span>`
    : '';
  return `<p class="card__meta">${price}${src}</p>`;
}

function macroLine(macros) {
  if (!macros) return '';
  const parts = [];
  const push = (value, unit) => {
    if (value !== null && value !== undefined && value !== '') parts.push(value + ' ' + unit);
  };
  push(macros.calories, 'cal');
  push(macros.protein, 'g protein');
  push(macros.carbs, 'g carbs');
  push(macros.sugar, 'g sugar');
  push(macros.fat, 'g fat');
  if (macros.caffeine) push(macros.caffeine, 'mg caffeine');
  return parts.join(' · ');
}

function renderCard(content, drink, index) {
  const badge = collectionBadge(drink, content);
  const macros = macroLine(drink.macros);
  return `<article class="card${drink.archived ? ' is-past' : ''}" data-drink-id="${esc(drink.id)}" data-category="${esc(drink.categoryId)}" data-collections="${esc((drink.collectionIds || []).join(' '))}" data-archived="${drink.archived ? '1' : '0'}" data-index="${index}" data-reveal data-reveal-delay="${Math.min(index % 4, 3) * 60}"${ed(`drink.${drink.id}.name`, 'Drink', 'drink')}>
    ${drink.image ? `<div class="card__photo"><img src="${esc(drink.image)}" alt="${esc(drink.name)}" loading="lazy" decoding="async" width="480" height="360"></div>` : ''}
    <div class="card__body">
      ${badge ? `<span class="card__badge${drink.archived ? ' card__badge--past' : ''}">${esc(badge)}</span>` : ''}
      <p class="card__tag">${esc(drink.label)}</p>
      <h3 class="card__name">${esc(drink.name)}</h3>
      ${drink.flavors ? `<p class="card__flavors">${esc(drink.flavors)}</p>` : ''}
      ${drink.description ? `<p class="card__desc">${esc(drink.description)}</p>` : ''}
      ${macros ? `<p class="card__macros">${esc(macros)}</p>` : ''}
      ${renderDrinkMeta(content, drink, 'card__price', 'card__src')}
    </div>
  </article>`;
}

function renderSpecial(content, drink) {
  return `<article class="special" data-drink-id="${esc(drink.id)}" data-reveal${ed(`drink.${drink.id}.name`, 'Drink', 'drink')}>
    ${drink.image ? `<div class="special__photo"><img src="${esc(drink.image)}" alt="${esc(drink.name)}" loading="lazy" decoding="async" width="640" height="420"></div>` : ''}
    <div class="special__body">
      <p class="special__tag">${esc(drink.label)}</p>
      <h3 class="special__name">${esc(drink.name)}</h3>
      <p class="special__flavors">${esc(drink.flavors)}</p>
      ${drink.description ? `<p class="special__desc">${esc(drink.description)}</p>` : ''}
      ${renderDrinkMeta(content, drink, 'special__price', 'special__src')}
    </div>
  </article>`;
}

function renderCollection(content, section) {
  const collection = featuredCollection(content);
  if (!collection) {
    return `<section class="specials section" id="${esc(anchorOf(section))}" data-section="${esc(section.id)}" data-section-type="collection">
      <div class="shell"><div class="section-empty">No seasonal collection is featured yet. Pick one in the dashboard under Seasonal Specials.</div></div>
    </section>`;
  }
  const drinks = featuredDrinks(content, collection.id);
  const dateLine = collection.startDate
    ? new Date(collection.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: undefined })
    : collection.name;
  return `<section class="specials section" id="${esc(anchorOf(section))}" data-section="${esc(section.id)}" data-section-type="collection" aria-labelledby="${esc(anchorOf(section))}-title">
    <div class="shell">
      <div class="specials__head">
        <div>
          <p class="eyebrow eyebrow--light" data-reveal><span class="eyebrow__dot" aria-hidden="true"></span><span${ed('sec.seasonal.eyebrow', 'Seasonal eyebrow')}>${esc(section.eyebrow)}</span> <span class="specials__date">${esc(dateLine)}</span></p>
          <h2 class="section-title" id="${esc(anchorOf(section))}-title" data-split${ed('sec.seasonal.title', 'Seasonal headline', 'multiline')}>${nl2br(section.title || collection.name)}</h2>
        </div>
        <p class="specials__note" data-reveal data-reveal-delay="120"${ed(`col.${collection.id}.description`, 'Seasonal description', 'multiline')}>${nl2br(collection.description)}</p>
      </div>

      <div class="specials__grid"${drinks.length ? '' : ' data-empty="No drinks in this collection yet"'}>${drinks.map((drink) => renderSpecial(content, drink)).join('')}</div>

      <div class="specials__foot" data-reveal>
        <p>${esc(section.footNote)}</p>
        ${section.linkLabel ? `<p class="specials__fine"><a href="${esc(section.linkHref || '#menu')}" class="link-arrow"${ed('sec.seasonal.linkLabel', 'Seasonal link', 'link')}>${esc(section.linkLabel)} <i aria-hidden="true">&rarr;</i></a></p>` : ''}
      </div>
    </div>
  </section>`;
}

function renderMenu(content, section) {
  const drinks = publicDrinks(content);
  const filters = menuFilters(content);
  const collectionsFilters = filters.filter((f) => f.id === 'all' || f.id.startsWith('col:') || f.id === 'past');
  const categoryFilters = filters.filter((f) => f.id.startsWith('cat:'));

  const chip = (filter, active) =>
    `<button class="chip${active ? ' is-active' : ''}" type="button" data-filter="${esc(filter.id)}" aria-pressed="${active}" data-note="${esc(filter.note)}">${esc(filter.label)}</button>`;

  const cards = drinks.map((drink, index) => renderCard(content, drink, index)).join('');

  const kits = (content.kits || [])
    .map(
      (group) => `<div class="kit-group">
        <h4 class="kit-group__title">${esc(group.title)}</h4>
        <ul class="kit-list">${(group.items || [])
          .map((kit) => `<li><span class="kit-name">${esc(kit.name)}</span>${kit.flavors ? `<span class="kit-flavors">${esc(kit.flavors)}</span>` : ''}</li>`)
          .join('')}</ul>
        ${group.note ? `<p class="kit-note">${esc(group.note)}</p>` : ''}
      </div>`
    )
    .join('');

  return `<section class="menu section" id="menu" data-section="menu" data-section-type="menu">
    <div class="shell">
      <div class="section-head section-head--row">
        <div>
          <p class="eyebrow" data-reveal><span class="eyebrow__dot" aria-hidden="true"></span><span${ed('sec.menu.eyebrow', 'Menu eyebrow')}>${esc(section.eyebrow)}</span></p>
          <h2 class="section-title" data-split${ed('sec.menu.title', 'Menu headline', 'multiline')}>${nl2br(section.title)}</h2>
        </div>
        <p class="section-note" data-reveal data-reveal-delay="120"${ed('sec.menu.note', 'Menu introduction', 'multiline')}>${nl2br(section.note)}</p>
      </div>

      <div class="menu__bar" data-reveal>
        <div class="filters" role="group" aria-label="Filter the menu">
          <div class="filter-row">
            <span class="filters__label">Now pouring</span>
            ${collectionsFilters.map((filter, i) => chip(filter, i === 0)).join('')}
          </div>
          ${categoryFilters.length ? `<div class="filter-row">
            <span class="filters__label">Everyday</span>
            ${categoryFilters.map((filter) => chip(filter, false)).join('')}
          </div>` : ''}
        </div>
        <p class="menu__count" id="menu-count" role="status" aria-live="polite"></p>
      </div>

      <p class="menu__note" id="menu-note"></p>

      <div class="cards" id="menu-grid">${cards}</div>
      <p class="menu__empty" id="menu-empty" hidden>Nothing in this filter yet &mdash; try another board.</p>

      <div class="menu__more" id="menu-more-wrap" hidden>
        <button class="btn btn--ghost" type="button" id="menu-more" aria-controls="menu-grid">Show more</button>
      </div>

      <div class="kits" id="kits">
        <div class="kits__head">
          <p class="eyebrow" data-reveal><span class="eyebrow__dot" aria-hidden="true"></span>${esc(section.kitsEyebrow)}</p>
          <h3 class="kits__title" data-reveal>${esc(section.kitsTitle)}</h3>
          <p class="kits__note" data-reveal>${esc(section.kitsNote)}</p>
        </div>
        <div class="kits__grid">${kits}</div>
      </div>

      <p class="menu__foot" data-reveal${ed('sec.menu.footNote', 'Note under the menu', 'multiline')}>${nl2br(section.footNote)}</p>
    </div>
  </section>`;
}

function renderEditorial(content, section) {
  return `<section class="editorial" aria-labelledby="editorial-title" data-section="editorial" data-section-type="editorial">
    <div class="editorial__inner shell">
      <p class="eyebrow eyebrow--light" data-reveal><span class="eyebrow__dot" aria-hidden="true"></span><span${ed('sec.editorial.eyebrow', 'Band eyebrow')}>${esc(section.eyebrow)}</span></p>
      <h2 class="editorial__title" id="editorial-title" data-split${ed('sec.editorial.title', 'Band headline', 'multiline')}>${nl2br(section.title)}</h2>
      <p class="editorial__copy" data-reveal data-reveal-delay="120"${ed('sec.editorial.copy', 'Band paragraph', 'multiline')}>${nl2br(section.copy)}</p>
      <a class="btn btn--light" ${linkAttrs(section.cta?.href)} data-reveal data-reveal-delay="200"${ed('sec.editorial.cta', 'Band button', 'link')}><span>${esc(section.cta?.label)}</span><i aria-hidden="true" class="btn__arrow">&rarr;</i></a>
    </div>
  </section>`;
}

function renderVisit(content, section) {
  const business = content.business || {};
  const status = openStatus(content);
  const holidayHours = (business.holidayHours || [])
    .filter((entry) => entry.label)
    .map(
      (entry) =>
        `<li><span>${esc(entry.label)}</span><span>${entry.closed ? 'Closed' : esc(hoursLabel(entry))}</span></li>`
    )
    .join('');

  const rows = [...(business.hours || [])]
    .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7))
    .map(
      (entry) =>
        `<tr data-day="${entry.day}"><th scope="row">${DAY_NAMES[entry.day]}</th><td>${esc(hoursLabel(entry))}</td></tr>`
    )
    .join('');

  return `<section class="visit section" id="visit" data-section="visit" data-section-type="visit">
    <div class="shell">
      <div class="visit__grid">
        <div class="visit__info">
          <p class="eyebrow" data-reveal><span class="eyebrow__dot" aria-hidden="true"></span><span${ed('sec.visit.eyebrow', 'Visit eyebrow')}>${esc(section.eyebrow)}</span></p>
          <h2 class="section-title" data-split${ed('sec.visit.title', 'Visit headline', 'multiline')}>${nl2br(section.title)}</h2>

          <div class="visit__status" data-reveal data-reveal-delay="80">
            <span class="dot${status.open ? ' is-open' : ' is-closed'}" id="open-dot" aria-hidden="true"></span>
            <span id="open-status">${esc(status.text)}</span>
          </div>

          <address class="visit__address" data-reveal data-reveal-delay="120">
            <span${ed('business.address1', 'Street address')}>${esc(business.address1)}</span>
            <span${ed('business.address2', 'City, state and ZIP')}>${esc(business.address2)}</span>
          </address>

          <div class="visit__rows">
            ${business.phone ? `<div class="visit__row" data-reveal data-reveal-delay="160">
              <span class="visit__k">Phone</span>
              <a class="visit__v" href="tel:${esc(business.phoneDial)}" data-track="phone"${ed('business.phone', 'Phone number')}>${esc(business.phone)}</a>
            </div>` : ''}
            <div class="visit__row" data-reveal data-reveal-delay="190">
              <span class="visit__k">Directions</span>
              <a class="visit__v" ${linkAttrs(business.directionsUrl, 'directions')}>Open in Google Maps &rarr;</a>
            </div>
            <div class="visit__row" data-reveal data-reveal-delay="220">
              <span class="visit__k">Follow</span>
              <span class="visit__v visit__v--links">
                ${socialHref(content, 'instagram') ? `<a ${linkAttrs(socialHref(content, 'instagram'), 'instagram')}>Instagram</a>` : ''}
                ${socialHref(content, 'facebook') ? `<a ${linkAttrs(socialHref(content, 'facebook'), 'facebook')}>Facebook</a>` : ''}
              </span>
            </div>
            ${business.email ? `<div class="visit__row" data-reveal data-reveal-delay="240">
              <span class="visit__k">Email</span>
              <a class="visit__v" href="mailto:${esc(business.email)}" data-track="email"${ed('business.email', 'Email address')}>${esc(business.email)}</a>
            </div>` : ''}
          </div>

          ${business.hoursNote ? `<p class="visit__hours-note"${ed('business.hoursNote', 'Note under the hours', 'multiline')}>${nl2br(business.hoursNote)}</p>` : ''}
          ${holidayHours ? `<ul class="visit__holiday" data-reveal>${holidayHours}</ul>` : ''}

          <table class="hours" data-reveal data-reveal-delay="260">
            <caption class="hours__caption">Opening hours</caption>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="visit__map" data-reveal data-reveal-delay="120">
          ${section.showMap !== false && business.mapEmbed ? `<iframe title="Map showing ${esc(business.name)} at ${esc(business.address1)}" src="${esc(business.mapEmbed)}" width="600" height="640" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
          <div class="visit__map-tag">
            <span class="visit__map-k"${ed('sec.visit.mapTagKicker', 'Map label')}>${esc(section.mapTagKicker)}</span>
            <span class="visit__map-v"${ed('sec.visit.mapTagValue', 'Map label value')}>${esc(section.mapTagValue)}</span>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderGallery(content, section) {
  const images = section.images || [];
  if (!images.length) {
    return `<section class="gallery section" id="gallery" data-section="gallery" data-section-type="gallery" data-empty="Add photos from your library to fill this gallery">
      <div class="shell">
        <div class="section-head"><p class="eyebrow"><span class="eyebrow__dot"></span>${esc(section.eyebrow)}</p><h2 class="section-title">${esc(section.title)}</h2></div>
        <p class="section-empty">Photos you add here appear in a gallery on the website.</p>
      </div>
    </section>`;
  }
  return `<section class="gallery section" id="gallery" data-section="gallery" data-section-type="gallery">
    <div class="shell">
      <div class="section-head">
        <div>
          <p class="eyebrow" data-reveal><span class="eyebrow__dot" aria-hidden="true"></span><span${ed('sec.gallery.eyebrow', 'Gallery eyebrow')}>${esc(section.eyebrow)}</span></p>
          <h2 class="section-title" data-split${ed('sec.gallery.title', 'Gallery headline')}>${esc(section.title)}</h2>
        </div>
        <p class="section-note"${ed('sec.gallery.note', 'Gallery note', 'multiline')}>${nl2br(section.note)}</p>
      </div>
      <div class="gallery__grid"${edList('sec.gallery.images', 'photo')}>
        ${images
          .map(
            (image, index) => `<figure class="gallery__item" data-list-item="sec.gallery.images">
              <img src="${esc(image.src)}" alt="${esc(image.alt || '')}" loading="lazy" decoding="async" width="720" height="720"${ed(`sec.gallery.images.${index}.src`, 'Gallery photo', 'image', ` data-alt-path="sec.gallery.images.${index}.alt"`)}>
              ${image.caption ? `<figcaption${ed(`sec.gallery.images.${index}.caption`, 'Photo caption')}>${esc(image.caption)}</figcaption>` : ''}
            </figure>`
          )
          .join('')}
      </div>
    </div>
  </section>`;
}

const RENDERERS = {
  hero: renderHero,
  marquee: renderMarquee,
  story: renderStory,
  collection: renderCollection,
  menu: renderMenu,
  editorial: renderEditorial,
  visit: renderVisit,
  gallery: renderGallery
};

export function renderSections(content) {
  return visibleSections(content)
    .map((section) => {
      const render = RENDERERS[section.type];
      if (!render) return '';
      return render(content, section);
    })
    .join('\n');
}

export function renderBody(content, options = {}) {
  const state = {
    hours: content.business?.hours || [],
    paging: content.sections?.find((s) => s.id === 'menu')?.paging || 12,
    ga4Id: content.seo?.ga4Id || '',
    version: options.version || ''
  };

  return `<a class="skip-link" href="#main">Skip to content</a>
${renderAnnouncement(content)}
${renderHeader(content)}

<main id="main">
${renderSections(content)}
</main>

${renderFooter(content)}

<script type="application/json" id="site-state">${JSON.stringify(state).replace(/</g, '\\u003c')}</script>
<script src="/app.js" defer></script>`;
}

export function renderPage(content, options = {}) {
  const editing = !!options.edit;
  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead(content, options)}
</head>
<body${editing ? ' class="is-editing"' : ''} data-mode="${editing ? 'edit' : 'live'}">
${editing ? '' : `<div class="preloader" id="preloader" aria-hidden="true"><div class="preloader__mark"><span class="preloader__word">Orchard Trail</span><span class="preloader__rule"><i></i></span><span class="preloader__sub">Nutrition</span></div></div>`}
${renderBody(content, options)}
${editing ? '<div class="edit-hint" id="edit-hint">Click anything on the page to change it</div>' : ''}
</body>
</html>`;
}
