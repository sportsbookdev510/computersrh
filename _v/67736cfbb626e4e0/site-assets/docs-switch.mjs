// The game guide (Docs) switch. The owner publishes the guide himself, about a day before launch.
//
// false: the public build leaves every guide file out and ships this file without the loader below,
//   so the live menu has no Docs tab and /docs keeps opening the FAQ. Local hosts (127.0.0.1, localhost)
//   still preview the guide from the source files at http://127.0.0.1:<port>/docs.
// true (now, published 7 Oct 2026): the public build ships the guide, the menu shows Docs and /docs opens it.
//   The NFT chapter keeps its own switch (docs-nft-switch.mjs) and stays locked.
//
// Only this one word changes: see docs/OYUN_REHBERI_SITE_TR.md (how to preview and how to publish).
export const DOCS_PUBLISHED = true;
export const loadDocs = () => import('./docs-view.mjs');
