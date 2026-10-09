// The game guide's chapters, in reading order: /docs is the first, /docs/<slug> the others.
// The website build (scripts/build.mjs) reads this list for the guide's route files once the
// guide is published (docs-switch.mjs); nothing here touches the page.
// A chapter with ``gate`` has its own switch (docs-view.mjs): until it is on, the live guide lists
// it as locked and its page shows only a lock (its content ships only with the switch on).
export const DOCS_PATH = '/docs';
export const DOCS_PAGES = Object.freeze([
  {slug: '', title: 'Getting started', icon: 'start', blurb: 'Pick your first PC and start mining.'},
  {slug: 'island', title: 'Your island', icon: 'island', blurb: 'Plots, Island Levels and your builder.'},
  {slug: 'power', title: 'Power', icon: 'power', blurb: 'Shared capacity, PC access and power levels.'},
  {slug: 'energy', title: 'Electricity & energy', icon: 'energy', blurb: 'One flat price, refills and run time.'},
  {slug: 'pc-building', title: 'PC building', icon: 'parts', blurb: 'Parts, fit rules, H/s and watts.'},
  {slug: 'heat-and-care', title: 'Heat & care', icon: 'heat', blurb: 'Temperatures, paste, dust and wear.'},
  {slug: 'island-bonus', title: 'Island bonus', icon: 'bonus', blurb: 'Matched PCs and Island Levels.'},
  {slug: 'rewards', title: 'Rewards', icon: 'rewards', blurb: 'Your share, claiming and invites.'},
  {slug: 'market', title: 'Market & style', icon: 'market', blurb: 'Shopping, inventory, skins and sharing.'},
  {slug: 'questions', title: 'Quick answers', icon: 'questions', blurb: 'Short answers to common questions.'},
  {slug: 'nft', title: 'NFTs', icon: 'cube', gate: true},
].map(page => Object.freeze(page)));

export const docsHref = page => page.slug ? `${DOCS_PATH}/${page.slug}` : DOCS_PATH;

/** The chapter for a path (/docs, /docs/power, trailing slash allowed), or null for any other path. */
export function docsPageFor(pathname) {
  const match = /^\/docs(?:\/([a-z0-9-]+))?\/?$/.exec(String(pathname ?? ''));
  if (!match) return null;
  return DOCS_PAGES.find(page => page.slug === (match[1] ?? '')) ?? null;
}
