// The game guide (/docs): one full-screen app window. The title bar holds Back to island, the left sidebar the
// site logo and the chapter list (a drawer behind the Chapters button on phones and tablets), the chapter scrolls
// on its own pane, and the status bar has a place for the site's music control (app.mjs moves it there).
// Loaded only while the guide is open (docs-switch.mjs): published, or previewed on a local host.
// A gated chapter has its own switch: while it is off, the guide shows it locked and the public package carries
// none of its files, only the switch without a loader.
import {desktopWindow} from './desktop-window.mjs';
import {escapeHtml as e} from './ui.mjs';
import {DOCS_PAGES, docsHref, docsPageFor} from './docs-pages.mjs';
import {chapter, icon, statTiles} from './docs-content.mjs';
import {mountDocsWidgets} from './docs-widgets.mjs';
import {loadNftDocs as loadGated} from './docs-nft-switch.mjs';

export {DOCS_PAGES, docsPageFor};
const STYLES = new URL('./docs.css', import.meta.url);
const DATA = new URL('./docs-data.json', import.meta.url);
// The same mark as the site header's logo, which the guide's window replaces while it is open.
const LOGO = '/_media/f97ebd699464d8721e5a79920ef50775d515edfec8a68cff889d796ab5da2dd1/site-assets/early-rh-logo.webp';
let data = null, assets = null, gated = null;

/** The gated chapter's module when its switch lets this page have it; a chapter that can't load stays locked. */
async function loadGatedChapter() {
  try {
    const module = await loadGated?.();
    if (module) {await module.prepare();gated = module;}
  } catch {gated = null;}
}

function loadStyles() {
  const existing = document.querySelector('link[data-docs-styles]');
  if (existing?.dataset.ready === 'true') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = existing ?? Object.assign(document.createElement('link'), {rel: 'stylesheet', href: STYLES.href});
    link.dataset.docsStyles = '';
    link.addEventListener('load', () => {link.dataset.ready = 'true';resolve();}, {once: true});
    link.addEventListener('error', () => reject(new Error('The guide could not load.')), {once: true});
    if (!existing) document.head.append(link);
  });
}
async function loadData() {
  const response = await fetch(DATA, {cache: 'no-cache'});
  if (!response.ok) throw new Error('The guide could not load.');
  data = await response.json();
}
/** Load the guide's styles and numbers once; the page renders after this resolves. */
export function prepare() {
  assets ??= Promise.all([loadStyles(), loadData(), loadGatedChapter()]).catch(error => {assets = null;throw error;});
  return assets;
}

const pad = value => String(value).padStart(2, '0');
/** A gated chapter is open only with its module loaded (``chapter``); every other chapter always is. */
const isOpen = (page, chapter) => !page.gate || Boolean(chapter);

/** The sidebar: the Chapters button (shown below 1024 px), the drawer with the logo and chapters, and its scrim. */
function rail(page, sections, gatedChapter) {
  const index = page ? DOCS_PAGES.indexOf(page) : -1;
  const items = DOCS_PAGES.map((item, number) => {
    const current = item === page, locked = !isOpen(item, gatedChapter);
    const subs = current && sections.length ? `<ol class="docs-rail-sections">${sections.map(section => `<li><a href="#${e(section.id)}" data-docs-anchor="${e(section.id)}">${section.title}</a></li>`).join('')}</ol>` : '';
    const lock = locked ? `<span class="docs-rail-lock" title="Locked">${icon('lock')}<span class="sr-only">(locked)</span></span>` : '';
    return `<li class="docs-rail-item${current ? ' is-current' : ''}${locked ? ' is-locked' : ''}"><a href="${docsHref(item)}" data-route${current ? ' aria-current="page"' : ''}><span class="docs-rail-num">${pad(number + 1)}</span>${icon(item.icon, 'docs-rail-icon')}<span class="docs-rail-text">${e(item.title)}</span>${lock}</a>${subs}</li>`;
  }).join('');
  const label = page ? `<small>Chapter ${index + 1} of ${DOCS_PAGES.length}</small><strong>${e(page.title)}</strong>` : '<small>Game guide</small><strong>All chapters</strong>';
  const button = `<button class="docs-menu-button" type="button" data-docs-menu aria-expanded="false" aria-controls="docs-drawer">${icon('menu', 'is-menu')}${icon('close', 'is-close')}<span class="docs-menu-label"><span class="sr-only">Chapters: </span>${label}</span>${icon('down', 'docs-menu-chevron')}</button>`;
  const brand = `<a class="docs-brand" href="/" data-route aria-label="Computers RH home"><img src="${LOGO}" alt="RH Computers" width="400" height="190" decoding="async"></a>`;
  const nav = `<nav class="docs-rail" aria-label="Game guide chapters" style="--current:${Math.max(0, index)}"><p class="docs-rail-kicker">${icon('bonus')} Game guide</p><ol class="docs-rail-list">${items}</ol></nav>`;
  return `${button}<div class="docs-drawer" id="docs-drawer">${brand}${nav}</div><div class="docs-scrim" data-docs-close aria-hidden="true"></div>`;
}

/** Previous and next open chapters: a locked chapter is never offered as the next read. */
function pager(page, gatedChapter) {
  const open = DOCS_PAGES.filter(item => item === page || isOpen(item, gatedChapter));
  const index = open.indexOf(page), previous = open[index - 1], next = open[index + 1];
  const link = (item, kind) => item ? `<a class="docs-pager-link is-${kind}" href="${docsHref(item)}" data-route>${kind === 'prev' ? icon('back') : ''}<span><small>${kind === 'prev' ? 'Previous' : 'Next'}</small><strong>${e(item.title)}</strong></span>${kind === 'next' ? icon('arrow') : ''}</a>` : '<span class="docs-pager-gap"></span>';
  return `<nav class="docs-pager" aria-label="More chapters">${link(previous, 'prev')}${link(next, 'next')}</nav>`;
}

const previewBanner = () => `<div class="docs-preview" role="note">${icon('warn')}<p><strong>Private preview.</strong> This guide is not on the live site yet. It goes live when <code>DOCS_PUBLISHED</code> is switched on in docs-switch.mjs.</p></div>`;

/** A locked chapter's page: its title, a lock and nothing of its content (none of it is in the package). */
function lockedPage(page, preview, more) {
  const number = DOCS_PAGES.indexOf(page) + 1;
  const ghosts = Array.from({length: 3}, (_, index) => `<span class="docs-locked-ghost" style="--i:${index}"><i></i><b></b><b class="is-short"></b></span>`).join('');
  return `<article class="docs-page is-locked" data-docs-page="${e(page.slug)}">${preview ? previewBanner() : ''}<header class="docs-head"><p class="docs-kicker">${icon('lock')} Chapter ${number} <span>of ${DOCS_PAGES.length}</span></p><h2>${e(page.title)}</h2><p class="docs-lead">This chapter is locked for now. It opens here later.</p></header><div class="docs-locked" role="img" aria-label="Locked chapter"><div class="docs-locked-ghosts" aria-hidden="true">${ghosts}</div><div class="docs-locked-badge"><span class="docs-locked-icon">${icon('lock')}</span><strong>Locked</strong><span>Coming soon</span></div></div>${more}</article>`;
}
// Back to island lives in the title bar; the music control (app.mjs) docks at the end of the status bar.
const backLink = `<div class="docs-actions"><a class="docs-back" href="/" data-route aria-label="Back to island">${icon('back')}<span>Back to island</span></a></div>`;
const musicSlot = '<div class="docs-music" data-music-slot></div>';
// A thin line along the top of the chapter pane that fills as the chapter is read (docs-widgets.mjs).
const progress = '<div class="docs-progress" aria-hidden="true"><i></i></div>';

/**
 * The guide's page for ``pathname`` with the numbers in ``guide`` (pure: no DOM, testable). ``gated`` is the gated
 * chapter's module when that chapter is open here, else null: the chapter is then shown locked.
 */
export function renderDocs(guide, pathname, {preview = false, windowExpanded = false, gated: gatedChapter = null} = {}) {
  const page = docsPageFor(pathname);
  const locked = page ? !isOpen(page, gatedChapter) : false;
  const content = page && guide && !locked ? (page.gate ? gatedChapter.chapter(guide) : chapter(page.slug, guide)) : null;
  let right;
  if (locked) {
    right = lockedPage(page, preview, pager(page, gatedChapter));
  } else if (!content) {
    right = `<article class="docs-page is-missing">${preview ? previewBanner() : ''}<header class="docs-head"><p class="docs-kicker">${icon('questions')} Game guide</p><h2>This page isn’t in the guide.</h2><p class="docs-lead">It may have moved. Start from the beginning or pick a chapter.</p></header><p><a class="docs-start" href="/docs" data-route>Go to Getting started ${icon('arrow')}</a></p></article>`;
  } else {
    // A gated chapter may bring its own note above it (content.banner).
    const banner = `${preview ? previewBanner() : ''}${content.banner ?? ''}`;
    const sections = content.sections.map(section => `<section class="docs-section" id="${e(section.id)}" data-reveal><h3><a class="docs-anchor" href="#${e(section.id)}" aria-label="Link to ${e(section.title.replace(/<[^>]+>/g, ''))}">#</a>${section.title}</h3>${section.html}</section>`).join('');
    right = `<article class="docs-page" data-docs-page="${e(page.slug || 'start')}">${banner}<header class="docs-head"><p class="docs-kicker">${icon(page.icon)} ${e(content.kicker)} <span>of ${DOCS_PAGES.length}</span></p><h2>${content.title}</h2><p class="docs-lead">${content.lead}</p>${content.stats.length ? statTiles(content.stats) : ''}</header>${sections}${pager(page, gatedChapter)}</article>`;
  }
  const status = page ? `Game guide · ${page.title}${locked ? ' · Locked' : ''}` : 'Game guide';
  return desktopWindow({windowExpanded}, {index: 'docs', aside: rail(page, content?.sections ?? [], gatedChapter), right: `${progress}${right}`, title: 'Docs', status, className: 'docs-shell', barExtra: backLink, statusExtra: musicSlot});
}

/** The page for the site's router (app.mjs): ``state.docsPublished`` false shows the preview note. */
export function docsView(state, pathname) {
  return renderDocs(data, pathname, {preview: !state.docsPublished, windowExpanded: state.windowExpanded, gated});
}

/** The browser tab title for a guide path. */
export function docsTitle(pathname) {
  const page = docsPageFor(pathname);
  return page?.slug ? `${page.title} · Docs` : 'Docs';
}

/** Wire the page's drawer, pane, sliders, stage viewers and reveals after it is in the document. */
export function afterDocsRender(root, {pageChanged = false} = {}) {
  if (data) mountDocsWidgets(root, data, {pageChanged});
  // The gated chapter's own moving parts (its module stops the previous page's timers itself).
  gated?.mount(root);
}
