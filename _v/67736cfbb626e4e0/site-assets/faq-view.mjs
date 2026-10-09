import {desktopWindow} from './desktop-window.mjs';
import {icon, escapeHtml as e, safeExternal} from './ui.mjs';
import {COLLAB_PATH, NFT_FACTS, NFT_ALLOCATION, PARTNER_PATH} from './collab-model.mjs';

export const FAQ_PATH = '/faq';

const number = value => value.toLocaleString('en-US');
const external = (url, text) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;

/** The collection's three paths and their GTD WL spots, in the order they are shown. */
export const NFT_PATHS = Object.freeze([
  {key: 'creators', title: 'Creators', spots: NFT_ALLOCATION.creators, text: 'Create content about Computers RH on X.',
    footer: `<a href="${COLLAB_PATH}" data-route>Submit your post ${icon('arrow')}</a>`},
  {key: 'collabs', title: 'Collabs', spots: NFT_ALLOCATION.collabs, text: 'Reserved for our partner DAOs and communities.',
    footer: `<a href="${PARTNER_PATH}" data-route>Apply for a collab ${icon('arrow')}</a>`},
  {key: 'players', title: 'Players', spots: NFT_ALLOCATION.players, text: 'Earned by players through in-game token spending.'},
]);

// "4:00 PM" never breaks before AM/PM, whatever space the browser's Intl puts there.
const keepMeridiem = text => text.replace(/[ \u202f](?=[AP]M\b)/g, '\u00a0');

/** "Oct 6, 2026 · 4:00 PM UTC" plus the visitor's own time, or null for a missing or broken date. */
export function launchTime(iso) {
  const value = new Date(iso ?? '');
  if (!iso || !Number.isFinite(value.getTime())) return null;
  const day = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}).format(value);
  const time = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC'}).format(value);
  const local = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short'}).format(value);
  return {iso: value.toISOString(), utc: keepMeridiem(`${day} · ${time} UTC`), local: keepMeridiem(local)};
}

function ourX(config) {
  const url = safeExternal(config?.social?.account_url);
  const handle = url && new URL(url).pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1];
  return handle ? `our X account, ${external(url, `@${e(handle)}`)}` : 'our X account';
}

/** Live dates from the site settings; a dash until they load, never a made-up date. */
function schedule(config) {
  const rows = [['Early Access', launchTime(config?.early_access_at)], ['Public launch', launchTime(config?.public_access_at)]];
  if (config && rows.some(([, time]) => !time)) return '<p>The dates will be announced on our official X account.</p>';
  // Applications close on their own date, before Early Access starts (owner decision, 5 Oct 2026).
  const closing = launchTime(config?.applications_close_at);
  if (closing && rows[0][1] && closing.iso < rows[0][1].iso) rows.unshift(['Applications close', closing]);
  return `<p>Early Access members get in one day before everyone else.</p><dl class="faq-schedule">${rows.map(([label, time]) => time
    ? `<div><dt>${label}</dt><dd><time datetime="${e(time.iso)}">${e(time.utc)}</time><span>Your time: ${e(time.local)}</span></dd></div>`
    : `<div><dt>${label}</dt><dd><time>—</time></dd></div>`).join('')}</dl>`;
}

/** Answers are trusted HTML built here; only config values are escaped. The split itself is shown beside them. */
export function faqQuestions(config) {
  return [
    ['When does the game start?', schedule(config)],
    ['When will the token launch?', `<p>The token launches when Early Access begins. The contract address (CA) will be shared only on ${ourX(config)}.</p>`],
    ['Will there be an NFT collection?', `<p>Yes. The Computers RH collection has ${number(NFT_FACTS.supply)} NFTs, and the mint is free. The mint date is ${e(NFT_FACTS.mintDate)}.</p>`],
    ['What will the NFTs do?', `<p>Activate one Computers RH NFT in the game to boost your island's hashrate. Rarer tiers boost more.</p>`],
    ['How can I earn a GTD WL as a creator?', `<p>Sign in with X on the <a href="${COLLAB_PATH}" data-route>Creators page</a>, create a post about Computers RH and submit its link. You can submit once every 12 hours. Our team reviews every post and awards GTD WL spots to creators.</p>`],
    ['I won a GTD WL as a creator. Where do I submit my wallet?', `<p>On the <a href="${COLLAB_PATH}" data-route>Creators page</a>. Sign in with the same X account and submit your EVM wallet. You can save it only once.</p>`],
  ];
}

function collection() {
  const paths = NFT_PATHS.map(path => `<li class="faq-path is-${path.key}"><p class="faq-path-count">${number(path.spots)}<span>GTD WL</span></p><div><h3>${e(path.title)}</h3><p>${e(path.text)}</p>${path.footer ? `<p class="faq-path-footer">${path.footer}</p>` : ''}</div></li>`).join('');
  const split = NFT_PATHS.map(path => `${number(path.spots)} GTD WL for ${path.title.toLowerCase()}`).join(', ');
  // The bar is drawn to scale: each segment is as wide as its share of the supply.
  const scale = NFT_PATHS.map(path => `${path.spots}fr`).join(' ');
  return `<section class="faq-collection" aria-labelledby="faq-collection-title"><p class="faq-kicker">${icon('sparkle')} Computers RH NFT</p><div class="faq-collection-head"><h2 class="faq-collection-title" id="faq-collection-title">${number(NFT_FACTS.supply)}<span>NFTs</span></h2><div class="faq-mint-row"><p class="faq-mint"><span>Mint price</span><strong>${e(NFT_FACTS.mint)}</strong></p><p class="faq-mint is-date"><span>Mint date</span><strong>${e(NFT_FACTS.mintDate)}</strong></p></div></div><div class="faq-split" role="img" aria-label="${e(split)}" style="grid-template-columns:${scale}">${NFT_PATHS.map(path => `<i class="is-${path.key}"></i>`).join('')}</div><ol class="faq-paths">${paths}</ol></section>`;
}

// A few chapters of the game guide (/docs) for the FAQ's corner once the guide is open.
const GUIDE_LINKS = [['/docs', 'Getting started'], ['/docs/power', 'Power'], ['/docs/island-bonus', 'Island bonus'], ['/docs/rewards', 'Rewards']];

/** Placeholder cards only; nothing about the guide is in the page until it is published (``state.docsOpen``). */
function mechanics(state) {
  if (state?.docsOpen) {
    return `<section class="faq-mechanics" aria-labelledby="faq-mechanics-title"><div class="faq-heading-row"><h2 class="faq-subheading" id="faq-mechanics-title">Game mechanics</h2><span class="faq-soon is-open">Game guide</span></div><nav class="faq-guide" aria-label="Game guide">${GUIDE_LINKS.map(([href, label]) => `<a href="${href}" data-route>${e(label)}</a>`).join('')}<a class="faq-guide-all" href="/docs" data-route>Read the whole game guide ${icon('arrow')}</a></nav></section>`;
  }
  const card = '<div class="faq-ghost"><i></i><b></b><span></span><span class="is-short"></span></div>';
  return `<section class="faq-mechanics" aria-labelledby="faq-mechanics-title"><div class="faq-heading-row"><h2 class="faq-subheading" id="faq-mechanics-title">Game mechanics</h2><span class="faq-soon">Coming soon</span></div><div class="faq-locked"><div class="faq-ghosts" aria-hidden="true">${card.repeat(4)}</div><p class="faq-lock">${icon('lock')}<span>The full game guide is on its way.</span></p></div></section>`;
}

/** All questions start closed; one answer open at a time keeps the window on one screen. */
function questions(config) {
  const items = faqQuestions(config).map(([question, answer]) =>
    `<details class="faq-item" name="faq"><summary><span>${e(question)}</span><i class="faq-toggle" aria-hidden="true"></i></summary><div class="faq-answer">${answer}</div></details>`).join('');
  return `<section class="faq-questions" aria-labelledby="faq-questions-title"><h2 class="faq-heading" id="faq-questions-title">Frequently asked questions</h2><div class="faq-list">${items}</div></section>`;
}

export function faqView(state) {
  return desktopWindow(state, {index: 'faq', aside: `${collection()}${mechanics(state)}`, right: questions(state.config), title: 'FAQ', status: 'Computers RH', className: 'faq-shell'});
}
