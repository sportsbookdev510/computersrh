// The game guide's chapters. Every game number comes from docs-data.json (scripts/docs_data.py reads it
// from the game's own rules), so a price or a percentage changes here by itself when the game changes.
// Answers are trusted HTML built here; names from the data are escaped.
import {escapeHtml as e} from './ui.mjs';
import {DOCS_PAGES, docsHref} from './docs-pages.mjs';

// ---------------------------------------------------------------- numbers

const grouped = (value, digits = 0) => Number(value).toLocaleString('en-US', {maximumFractionDigits: digits});
/** "$25", "$0.55", "$1,173.30": whole dollars stay whole, anything else shows cents. */
export function usd(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  if (Math.abs(amount - Math.round(amount)) < 1e-9) return `$${grouped(Math.round(amount))}`;
  return `$${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}
// Units never wrap away from their numbers (a no-break space between them).
const NB = ' ';
/** A builder job's price: "$5 + $1 per 100 H/s" when it grows with the island's hash record, "$10", or "Free". */
export function builderPrice(row, per = 100) {
  const fixed = Number(row?.price_usd) || 0, grows = Number(row?.per_100_hs_usd) || 0;
  if (!fixed && !grows) return 'Free';
  return grows ? `${usd(fixed)} + ${usd(grows)} per ${grouped(per)}${NB}H/s` : usd(fixed);
}
export const num = (value, digits = 1) => grouped(value, digits);
export const hs = value => `${grouped(value, Number(value) < 10 ? 2 : 1)}${NB}H/s`;
export const watts = value => `${grouped(value, 1)}${NB}W`;
export const pct = (value, sign = false) => `${sign && Number(value) > 0 ? '+' : ''}${grouped(value, 2)}%`;
export const celsius = value => `${grouped(value, 1)}${NB}°C`;
/** An efficiency multiplier with fixed decimals: "×1.40", or "×1.4000" with ``digits`` 4. */
export const times = (value, digits = 2) => `×${Number(value).toFixed(digits)}`;
/** Builder minutes as "15 min", "1 h 15 min", "36 h". */
export function duration(minutes) {
  const total = Math.round(Number(minutes));
  if (total < 60) return `${total}${NB}min`;
  const hours = Math.floor(total / 60), rest = total % 60;
  return rest ? `${grouped(hours)}${NB}h ${rest}${NB}min` : `${grouped(hours)}${NB}h`;
}
/** A long stretch as days: "about 14.1 days". */
export const aboutDays = minutes => `about ${grouped(Number(minutes) / 1440, 1)} days`;
/** Time since the start of a timeline: "15 min", "5 h 5 min", "2 days 13 h". */
export function since(minutes) {
  const total = Math.round(Number(minutes));
  if (total < 48 * 60) return total ? duration(total) : 'Start';
  const daysPart = Math.floor(total / 1440), hours = Math.floor((total % 1440) / 60);
  return `${daysPart} days${hours ? ` ${hours} h` : ''}`;
}
/** "a quarter" for 25%, else the percentage. */
const share = value => ({25: 'a quarter', 50: 'half', 75: 'three quarters'}[Number(value)] ?? pct(value));
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = value => words[value] ?? grouped(value);
const plural = (value, one, many = `${one}s`) => `${grouped(value)} ${value === 1 ? one : many}`;
const range = values => {
  const list = [...new Set(values)].sort((a, b) => a - b);
  return list.length > 1 ? `${grouped(list[0])}–${grouped(list.at(-1))}` : grouped(list[0] ?? 0);
};
const listText = (items, word = 'and') => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`;
/** "a" or "an" before a name, from its first letter ("an Intellect Corps…", "a Novidia…"). */
const article = name => /^[aeiou]/i.test(String(name ?? '').trim()) ? 'an' : 'a';
/** "24 h each" when every value is the same, else "4 h to 12 h". */
const spanText = (values, format) => {
  const low = Math.min(...values), high = Math.max(...values);
  return low === high ? `${format(low)} each` : `${format(low)} to ${format(high)}`;
};
/** "plot 3" or "plots 3–4"; ``capital`` gives "Plot 3" / "Plots 3–4". */
const plotsText = (values, capital = false) => {
  const word = new Set(values).size > 1 ? 'plots' : 'plot';
  return `${capital ? word[0].toUpperCase() + word.slice(1) : word} ${range(values)}`;
};

// ------------------------------------------------------------------ icons

const PATHS = {
  start: 'M5 4v16M5 4h11l-2 4 2 4H5',
  island: 'M3 16h18M6 16l2 4h8l2-4M8 16v-5l4-4 4 4v5M11 16v-3h2v3',
  power: 'M13 2 4 14h7l-1 8 9-12h-7z',
  energy: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
  parts: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  heat: 'M10 5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0zM12 9v8',
  bonus: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  rewards: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
  market: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  questions: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01',
  tip: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6M12 7h.01',
  warn: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  arrow: 'M4 12h16m-6-6 6 6-6 6', back: 'M20 12H4m6-6-6 6 6 6',
  menu: 'M4 6h16M4 12h16M4 18h10', close: 'M6 6l12 12M18 6 6 18', down: 'm6 9 6 6 6-6',
  check: 'M4 12l5 5L20 6', play: 'M8 5v14l11-7z', pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
  case: 'M7 3h10v18H7zM10 6h4M10 17h4M12 13h.01', board: 'M4 4h16v16H4zM8 8h4v4H8zM15 8h2M15 11h2M8 15h9',
  cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  gpu: 'M3 7h18v9H3zM7 16v3M3 11h-1M8 11.5a2 2 0 1 0 0 .01M15.5 11.5a2 2 0 1 0 0 .01',
  ram: 'M3 8h18v7H3zM6 15v3M10 15v3M14 15v3M18 15v3M6 11h2M11 11h2M16 11h2',
  ssd: 'M5 6h14v12H5zM8 9h8M8 15h3',
  psu: 'M4 6h16v12H4zM12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M7 9h.01',
  cooler: 'M12 12m-7 0a7 7 0 1 0 14 0 7 7 0 1 0-14 0M12 5v14M5 12h14',
  fan: 'M12 12m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0M12 12c0-4 3-5 3-5M12 12c4 0 5 3 5 3M12 12c0 4-3 5-3 5M12 12c-4 0-5-3-5-3',
  system: 'M5 8h14v8H5zM8 19h8M12 16v3',
  cube: 'M12 2 21 7v10l-9 5-9-5V7zM12 2v20M3 7l9 5 9-5',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2',
};
export function icon(name, cls = '') {
  return `<svg class="docs-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name] ?? PATHS.info}"/></svg>`;
}

// --------------------------------------------------------------- blocks

const section = (id, title, html) => ({id, title, html});
const p = text => `<p>${text}</p>`;
const list = (items, ordered = false) => `<${ordered ? 'ol' : 'ul'} class="docs-list">${items.map(item => `<li>${item}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
const note = (kind, title, text) => `<aside class="docs-note is-${kind}">${icon({tip: 'tip', warn: 'warn'}[kind] ?? 'info', 'docs-note-icon')}<div><strong>${title}</strong><p>${text}</p></div></aside>`;
const formula = lines => `<pre class="docs-formula" tabindex="0"><code>${lines.join('\n')}</code></pre>`;
const link = (slug, text, hash = '') => {
  const page = DOCS_PAGES.find(item => item.slug === slug);
  return `<a href="${docsHref(page)}${hash ? `#${hash}` : ''}" data-route>${text}</a>`;
};
/** Stat tiles: [label, value, detail?, tone?]. */
function stats(tiles) {
  return `<dl class="docs-stats">${tiles.map(([label, value, detail = '', tone = 'mint']) =>
    `<div class="docs-stat is-${tone}"><dt>${label}</dt><dd><strong>${value}</strong>${detail ? `<span>${detail}</span>` : ''}</dd></div>`).join('')}</dl>`;
}
/** A table; cells are trusted HTML, ``numeric`` marks right-aligned columns. */
function table(head, rows, {numeric = [], caption = '', cls = ''} = {}) {
  const align = index => numeric.includes(index) ? ' class="is-num"' : '';
  return `<div class="docs-table-wrap" tabindex="0"><table class="docs-table ${cls}">${caption ? `<caption>${caption}</caption>` : ''}<thead><tr>${head.map((cell, index) => `<th scope="col"${align(index)}>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr${row.highlight ? ' class="is-highlight"' : ''}>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : `<td${align(index)}>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const chips = items => `<span class="docs-chips">${items.map(([text, tone = 'lilac']) => `<span class="docs-chip is-${tone}">${text}</span>`).join('')}</span>`;
const needsLevel = level => level > 1 ? `Island Level ${level}` : '—';

// ------------------------------------------------------------- shared views

const cardsOf = data => data.start.cards;
const ladderCards = data => cardsOf(data).filter(card => !card.entry);
const cardById = (data, id) => cardsOf(data).find(card => card.id === id);
const pad2 = value => String(value).padStart(2, '0');
// What counts toward the claims' spending rule (island_rules spend: every paid action).
const SPEND_COUNTS = 'Every purchase counts: PCs, parts, electricity, care and repairs, builder jobs (plots, power levels, Island Levels) and cosmetics.';
/** The cheapest available PC whose own purchase and hash meet the published claim requirements. */
export function starterPick(data) {
  const claim = data.rewards.claim;
  return cardsOf(data).filter(card => card.first_available && card.price_usd >= claim.min_spend_usd && card.hashrate >= claim.floor_hs).sort((a, b) => a.price_usd - b.price_usd)[0] ?? null;
}
function starterPickText(data, card) {
  const claim = data.rewards.claim, hours = Number(card.first_claim_hours);
  if (!(claim.min_spend_usd > 0) && !(claim.floor_hs > 0)) return 'There is no minimum spending or hashrate requirement for claims. You can claim rewards as they build up.';
  // With a hash floor a new island first fills its average; without one (since 5 Oct 2026) it claims at once.
  const when = claim.floor_hs > 0 ? `${hours > 0 ? `once it has mined for about ${plural(Math.ceil(hours), 'hour')}` : 'after a short while'} you can claim whenever you like`
    : 'you can claim right away, and whenever you like after that';
  return claim.min_spend_usd > 0
    ? `Its own purchase covers the ${usd(claim.min_spend_usd)} spending rule for claims, so ${when}.`
    : `It makes enough H/s to claim on its own: ${when}.`;
}
const partOf = (card, kind) => card.parts.find(part => part.kind === kind);
const PART_WORDS = {case: 'case', board: 'motherboard', cpu: 'CPU', gpu: 'graphics card', ram: 'RAM', ssd: 'drive', psu: 'power supply', cooler: 'cooler', fan: 'case fan'};
/** A card's parts split by whether the Market also sells them on their own. */
export function kitParts(data, card) {
  const sold = new Set(Object.values(data.parts.kinds).flat().map(row => row.name));
  const words = parts => [...new Set(parts.map(part => PART_WORDS[part.kind] ?? part.kind))];
  return {kitOnly: words(card.parts.filter(part => !sold.has(part.name))), sold: words(card.parts.filter(part => sold.has(part.name)))};
}
function cardSpec(card) {
  if (card.sealed) return e(card.parts[0].name);
  const ram = card.parts.filter(part => part.kind === 'ram').reduce((sum, part) => sum + part.quantity, 0);
  return [partOf(card, 'cpu')?.name, partOf(card, 'gpu')?.name, card.breakdown ? `${card.breakdown.ram_gb} GB RAM` : `${ram} RAM`]
    .filter(Boolean).map(e).join(' · ');
}
function cardBadges(card, data) {
  const badges = [];
  if (card.id === starterPick(data)?.id) badges.push(['Start here', 'mint']);
  if (!card.first_available) badges.push([`Needs Island Level ${card.min_island_level} · Power ${card.needs_power_level}`, 'blush']);
  if (card.limit) badges.push([`${card.limit} per island`, 'lilac']);
  if (card.sealed) badges.push(['Sealed', 'lilac']);
  if (card.best_value) badges.push(['Best value', 'gold']);
  if (card.hashrate < data.rewards.claim.floor_hs) badges.push(['Below claim floor', 'blush']);
  return badges.length ? chips(badges) : '';
}
/** A PC's name with its small picture (the game's own render of the card), for tables and lists. */
export function pcName(card) {
  return `<span class="docs-pcname">${card?.art ? `<img src="${e(card.art)}" alt="" width="40" height="30" loading="lazy" decoding="async">` : ''}<span>${e(card?.name ?? '')}</span></span>`;
}
/** The Choose-your-PC ladder: one small card per package, cheapest on the left, each with its picture. */
function cardLadder(data) {
  const pick = starterPick(data)?.id;
  return `<div class="docs-ladder-scroll" tabindex="0" aria-label="Starter PCs, cheapest first"><ol class="docs-ladder">${cardsOf(data).map((card, index) => `<li class="docs-pc${card.entry ? ' is-entry' : ''}${card.best_value ? ' is-best' : ''}${card.id === pick ? ' is-pick' : ''}" style="--i:${index}">${card.art ? `<span class="docs-pc-art"><img src="${e(card.art)}" alt="${e(card.name)}" width="264" height="200" loading="lazy" decoding="async"></span>` : ''}<p class="docs-pc-name">${e(card.name)}</p><p class="docs-pc-price">${usd(card.price_usd)}</p><p class="docs-pc-spec">${cardSpec(card)}</p><dl><div><dt>Hashrate</dt><dd>${hs(card.hashrate)}</dd></div><div><dt>Power</dt><dd>${watts(card.watts)}</dd></div><div><dt>H/s per W</dt><dd>${Number(card.hs_per_w).toFixed(2)}</dd></div><div><dt>Electricity</dt><dd>${usd(card.daily_usd)}/day</dd></div></dl>${cardBadges(card, data)}</li>`).join('')}</ol></div>`;
}
/** A stage viewer (Island Hall or POWER yard): renders stacked for a crossfade, wired by docs-widgets.mjs. */
function stageViewer(kind, stages, rows, label) {
  const first = rows[0];
  const items = stages.map((stage, index) => {
    const title = label(stage, rows[index]).title;
    return `<li data-stage="${index}" data-src="${e(stage.src)}" data-alt="${e(`${title}: ${stage.name}`)}"><button type="button" class="docs-stage-pip" data-stage-pick="${index}" aria-label="${e(title)}" aria-pressed="${index === 0}"><span>${stage.level}</span></button></li>`;
  }).join('');
  const details = stages.map((stage, index) => {
    const view = label(stage, rows[index]);
    return `<div class="docs-stage-detail" data-stage-detail="${index}"${index ? ' hidden' : ''}><p class="docs-stage-level">${view.title}</p><h4>${e(stage.name)}</h4>${stage.adds ? `<p class="docs-stage-adds">${e(stage.adds)}</p>` : ''}<dl class="docs-stage-facts">${view.facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl></div>`;
  }).join('');
  return `<figure class="docs-stage" data-stage-viewer="${kind}" data-count="${stages.length}"><div class="docs-stage-frame"><img class="docs-stage-img is-shown" src="${e(stages[0].src)}" alt="${e(`${label(stages[0], first).title}: ${stages[0].name}`)}" width="768" height="576" loading="lazy" decoding="async"><img class="docs-stage-img" alt="" width="768" height="576" decoding="async" aria-hidden="true"><button type="button" class="docs-stage-play" data-stage-play aria-label="Play the levels" aria-pressed="false">${icon('play', 'is-play')}${icon('pause', 'is-pause')}</button></div><figcaption class="docs-stage-side"><div class="docs-stage-details" aria-live="polite">${details}</div><div class="docs-stage-controls"><button type="button" class="docs-stage-step" data-stage-step="-1" aria-label="Previous level">${icon('back')}</button><ol class="docs-stage-pips">${items}</ol><button type="button" class="docs-stage-step" data-stage-step="1" aria-label="Next level">${icon('arrow')}</button></div></figcaption></figure>`;
}

// --------------------------------------------------------------- chapters

function gettingStarted(data) {
  const cards = cardsOf(data), pick = starterPick(data), strongest = cards.at(-1);
  const available = cards.filter(card => card.first_available);
  const limits = listText(Object.entries(data.start.limits).map(([id, limit]) => `${count(limit)} ${e(cardById(data, id)?.name ?? id)}`));
  return {
    kicker: 'Chapter 1', title: 'Your first PC',
    lead: 'Computers RH is a PC-building game on your own floating island. Your PCs make H/s, and your island’s share of all the H/s in the game sets your share of the daily rewards.',
    stats: [['Minimum PC', usd(data.start.minimum_pc_usd), 'your first paid package'],
      ['Energy included', `${data.start.energy_hours} h`, 'with every PC card', 'gold'],
      ['Starting power', watts(data.power.levels[0].capacity_w), 'shared by every desk', 'lilac']],
    sections: [
      section('choose', 'Choose your PC', `${p(`Pick one available PC to begin. The first purchase costs at least ${usd(data.start.minimum_pc_usd)}. At the start you can choose ${listText(available.map(card => e(card.name)))}; stronger cards show the Island Level and power they need.`)}${cardLadder(data)}${pick ? note('tip', `New here? Start with the ${e(pick.name)}`, `The ${usd(pick.price_usd)} ${e(pick.name)} is our pick for a first PC. ${starterPickText(data, pick)}`) : ''}${p('Stronger cards make more H/s per watt. The Best value label compares purchase price and electricity over 30 days; it does not include care, infrastructure or guarantee a return.')}`),
      section('desk-one', 'Your first desk shares the grid', `${p(`Your first PC is installed on desk 1, the MY PC desk. Every complete installed PC counts against your island’s power capacity, including a switched-off PC. Your starting ${watts(data.power.levels[0].capacity_w)} supports the available first PCs.`)}${p(`Island Level 1 allows up to ${hs(data.start.initial_hall_hash_cap)} of healthy base hash per PC. Higher-hash PCs and custom builds need Island Level ${data.start.hash_unlock_level} and enough total power capacity. Heat, wear and bonuses do not bypass this check.`)}${p(`Every card includes ${data.start.energy_hours} hours of electricity for that PC. Refill your shared energy stock to keep mining (${link('energy', 'Electricity &amp; energy')}).`)}`),
      section('claim', 'When claiming opens', `${p('Your PC’s rewards collect from day one and stay yours.')}${p(data.rewards.claim.min_spend_usd > 0 ? `The minimum first package covers the ${usd(data.rewards.claim.min_spend_usd)} spending rule for claims. ${SPEND_COUNTS}` : 'There is no minimum spending requirement for claims. Open Rewards &amp; Claim to send accumulated rewards to your wallet.')}`),
      section('next', 'What comes next', list([
        `<strong>Open more desks.</strong> Raise your Island Level and open plots in order. ${link('island', 'Your island')}`,
        `<strong>Build enough power for all installed PCs.</strong> Complete the power upgrade before installing the extra load. ${link('power', 'Power')}`,
        `<strong>Keep energy topped up.</strong> ${link('energy', 'Electricity &amp; energy')}`,
        `<strong>Upgrade tower parts or replace a sealed PC.</strong> Sealed parts cannot be extracted. You can also add another PC. ${link('pc-building', 'PC building')}`,
        `<strong>Keep your PCs cool and repaired.</strong> ${link('heat-and-care', 'Heat &amp; care')}`,
        `<strong>Match your PCs</strong> for up to ${pct(data.bonus.max_pct, true)}. ${link('island-bonus', 'Island bonus')}`,
        `<strong>Claim your rewards.</strong> ${link('rewards', 'Rewards')}`,
      ], true)),
      section('limits', 'Limits and prices', `${p(`An island can own at most ${limits}. Other cards can be bought again for an open desk once the PC meets the Hall and power requirements. Replaced parts stay in your inventory.`)}${p(`Cards range from ${usd(data.start.minimum_pc_usd)} to ${usd(strongest.price_usd)}. Prices are in US dollars; you pay tokens at the quoted price. The exact token amount is shown before confirmation.`)}`),
      section('map', 'Your island at a glance', `<ul class="docs-places">${[
        ['island', 'MY PC', 'Desk 1, where your first PC sits. It shares island power.'],
        ['start', `${grouped(data.island.max_plots - 1)} more plots`, 'Opened in order by your builder, each with its own desk.'],
        ['market', 'SHOP', 'Parts, complete PCs and cosmetics.'], ['parts', 'STORAGE', 'Everything you own that is not installed.'],
        ['power', 'POWER yard', 'The shared power capacity for every installed PC.'],
        ['bonus', 'Island Hall', 'Island progression, PC access and matching bonuses.'],
      ].map(([name,title,text]) => `<li>${icon(name)}<div><strong>${title}</strong><span>${text}</span></div></li>`).join('')}</ul>`),
    ],
  };
}

function yourIsland(data) {
  const island = data.island, levels = island.levels, plots = island.plots, totals = island.totals;
  const per = data.prices.per_hs, price = row => builderPrice(row, per);
  const last = levels.at(-1), gated = levels.filter(level => level.opens_plots.length || level.power_up_to);
  const bonusLevels = levels.filter(level => level.optional);
  const plotTimes = plots.slice(1).map(plot => plot.minutes), levelTimes = levels.slice(1).map(level => level.minutes);
  const powerTimes = data.power.levels.slice(1).map(level => level.minutes);
  const opens = level => [level.opens_plots.length ? plotsText(level.level === 1 ? [1, ...level.opens_plots] : level.opens_plots) : '',
    level.power_up_to ? `power up to Level ${level.power_up_to}` : ''].filter(Boolean).join(' and ');
  const gateText = gated.map(level => level.level === 1 ? `You start at Island Level 1, with ${opens(level)}` : `Island Level ${level.level} opens ${opens(level)}`);
  return {
    kicker: 'Chapter 2', title: 'Plots, Island Levels and your builder',
    lead: `Your island has ${count(island.max_plots)} desks. Desk 1 is ready from the start. Your builder opens the other ${count(island.max_plots - 1)}, raises your Island Level and builds your power, one job at a time.`,
    stats: [['Desks', grouped(island.max_plots), `desk 1 open from the start`],
      ['Island Levels', grouped(levels.length), `${count(bonusLevels.length)} add bonus only`, 'lilac'],
      ['Builder', `1 + ${island.builder.max_queue}`, 'one job, plus a queue', 'gold'],
      ['Max island', `${num(totals.max.minutes / 1440, 1)} days`, `${duration(totals.max.minutes)} of builder time`, 'blush']],
    sections: [
      section('plots', 'Desks and plots', `${p(`Each plot holds one desk. Plot 1 (desk 1) is open from day one; plots 2–${island.max_plots} are builder jobs and open in order. Every new plot comes with a basic desk set (desk, monitor, keyboard and mouse), so a PC has somewhere to sit.`)}${table(['Plot', 'Price (grows with your island)', 'Build time', 'Needs'], plots.map(plot => [plot.plot === island.home_desk ? `Plot ${plot.plot} · MY PC` : `Plot ${plot.plot}`, price(plot), plot.minutes ? duration(plot.minutes) : 'Open', needsLevel(plot.island_level)]), {numeric: [1, 2]})}${p(`A plot’s price is not the same for everyone: it is ${builderPrice(plots[1] ?? {}, per)} of your island’s hash record, its highest H/s ever, so a bigger island pays more (see ${link('island', 'Prices grow with your island', 'prices')}). Plots only need an Island Level, never a power level.`)}`),
      section('hall', 'Island Levels and the Island Hall', `${p(`Your Island Level shows on the island as the <strong>Island Hall</strong>, which grows from a builder’s hut into a grand hall. ${gateText.join('. ')}. Only Island Level ${last.level} is optional and adds bonus only. The intermediate levels are prerequisites for later expansion. Each Hall upgrade also needs the open plots shown below.`)}${stageViewer('hall', data.stages.hall, levels, (stage, level) => ({
        title: `Island Level ${level.level}`,
        facts: [['Price', price(level)], ['Build time', level.minutes ? duration(level.minutes) : 'Start'],
          ['Needs', plural(level.min_plots, 'open plot')], ['Opens', level.opens_plots.length || level.power_up_to ? [level.opens_plots.length ? plotsText(level.opens_plots, true) : '', level.power_up_to ? `Power up to Level ${level.power_up_to}` : ''].filter(Boolean).join(' · ') : level.optional ? 'Bonus only' : 'Next Island Level'],
          ['Bonus', level.bonus_pct ? `${pct(level.bonus_pct, true)} (total ${pct(level.total_bonus_pct, true)})` : '—']],
      }))}${table(['Level', 'Price', 'Build time', 'Needs', 'Opens', 'Bonus'], levels.map(level => [`Island Level ${level.level}`, price(level), level.minutes ? duration(level.minutes) : 'Start', plural(level.min_plots, 'open plot'), level.opens_plots.length || level.power_up_to ? [level.opens_plots.length ? plotsText(level.opens_plots, true) : '', level.power_up_to ? `Power to ${level.power_up_to}` : ''].filter(Boolean).join(' · ') : level.optional ? 'Bonus only' : 'Next Island Level', level.bonus_pct ? `${pct(level.bonus_pct, true)} <span class="docs-muted">(${pct(level.total_bonus_pct, true)})</span>` : '—']), {numeric: [1, 2]})}${note('info', 'The Island Level bonus needs company', `It counts only while at least ${count(data.bonus.level_needs_matched)} matched PCs run. See ${link('island-bonus', 'Island bonus')}.`)}`),
      section('builder', 'Your builder and the queue', `${list([
        '<strong>One builder, one job at a time.</strong> Jobs are plots, power levels and Island Levels.',
        `<strong>Up to ${count(island.builder.max_queue)} more jobs wait in the queue</strong> behind the one in progress.`,
        '<strong>You pay for a job when you queue it.</strong>',
        '<strong>Queued jobs can’t be cancelled</strong>: they are already paid. The Island Hall says so next to the queue.',
        '<strong>Change the order of waiting jobs</strong> with the arrows. The job in progress keeps going.',
        '<strong>When a job finishes, the next one starts by itself</strong>, even while you are offline.',
        '<strong>Each job is the next step of its kind.</strong> With Power Level 2 in the queue, the next power job is Power Level 3.',
        '<strong>Gates look ahead.</strong> You can queue the next Hall upgrade after its required plot, then the next plot after that Hall. Their prerequisites must be ready in that order.',
      ])}${builderDiagram(island.builder.max_queue)}`),
      section('times', 'Build times', `${p(`Plots take ${spanText(plotTimes, duration)}, power levels ${spanText(powerTimes, duration)} and Island Levels ${spanText(levelTimes, duration)}.`)}${timeChart(data)}${stats([
        [`All ${island.max_plots} desks`, price(totals.full), `${duration(totals.full.minutes)} · ${plural(totals.full.jobs, 'job')}`],
        ['All power levels', price(totals.power), `${duration(totals.power.minutes)} · ${plural(totals.power.jobs, 'job')}`, 'gold'],
        ['All Island Levels', price(totals.levels), `${duration(totals.levels.minutes)} · ${plural(totals.levels.jobs, 'job')}`, 'lilac'],
        ['Max island', price(totals.max), `${duration(totals.max.minutes)} · ${aboutDays(totals.max.minutes)}`, 'blush'],
      ])}${p(`“All desks” is every plot plus the Island Levels that open them. A max island also has Power Level ${data.power.levels.at(-1).level} and Island Level ${last.level}. Each job is priced at your island’s record when you queue it. Builder time runs on the game’s clock, so it keeps going while you are away: keep the queue full and no builder time is wasted.`)}`),
      section('prices', 'Prices grow with your island', pricesText(data)),
      section('name', 'Name your island', p(`Open the <strong>Island</strong> panel and tap your island’s name to rename it (up to ${island.name_length} characters). Under <strong>Island sign</strong> you can write a sign for visitors (up to ${island.sign_length}). Both are free; visitors read the sign on the board above your island gate.`)),
    ],
  };
}

function pricesText(data) {
  const pr = data.prices, per = pr.per_hs, last = data.island.levels.at(-1).level, top = data.power.levels.at(-1).level;
  const tiers = pr.power_tiers.map(tier => `Levels ${range(tier.levels)} ${usd(tier.price_usd)}`);
  const fixed = pr.fixed_levels.map(level => `Island Level ${level.level} ${usd(level.price_usd)}`);
  const examples = pr.examples.map(row => [`${grouped(8)} ${e(row.card_name)}s`, hs(row.record_hs), usd(row.plot_usd), row.power_usd.map(usd).join(' / '), usd(row.level_usd)]);
  return `${p(`Builder jobs don’t have one price for everyone. Plots, power levels and Island Levels cost a base price <strong>plus an amount for every ${grouped(per)}${NB}H/s of your island’s hash record</strong>: the highest H/s its PCs have ever reached together, its all-time high. Every complete PC on your desks counts, switched on or off, at its full speed; bonuses don’t count. The record never goes down, so switching PCs off or taking them apart never makes a job cheaper.`)}${list([
    `<strong>Plots 2–${data.island.max_plots}:</strong> ${usd(pr.plot_usd)} + ${usd(pr.plot_per_100_hs_usd)} per ${grouped(per)}${NB}H/s each.`,
    `<strong>Power levels 1–${top}:</strong> ${listText(tiers)}, each + ${usd(pr.power_per_100_hs_usd)} per ${grouped(per)}${NB}H/s.`,
    ...(fixed.length ? [`<strong>${listText(fixed)}:</strong> the same price on every island; they open desks.`] : []),
    ...data.island.levels.slice(1).map(level => `<strong>Island Level ${level.level}:</strong> ${builderPrice(level, per)}${level.optional ? '; optional bonus upgrade' : ''}.`),
  ])}${p(`A job’s price is locked in when you queue it, and you pay it then: a job in the queue keeps its price while your island grows. Prices are rounded up to the next cent.`)}${table(['Island', 'Record', 'Plot', 'Power Level 1 / 5 / 10', 'Island Level 4'], examples, {numeric: [1, 2, 3, 4]})}`;
}

function builderDiagram(slots) {
  const slotW = 66, gap = 8, x0 = 246, width = x0 + slots * (slotW + gap) + 6;
  const boxes = Array.from({length: slots}, (_, index) => `<g class="docs-q-slot" style="--i:${index}"><rect x="${x0 + index * (slotW + gap)}" y="52" width="${slotW}" height="44" rx="2"/><text x="${x0 + index * (slotW + gap) + slotW / 2}" y="79">Job ${index + 2}</text></g>`).join('');
  return `<figure class="docs-figure"><svg class="docs-svg docs-queue" viewBox="0 0 ${width} 140" role="img" aria-label="One builder works on one job while up to ${slots} more jobs wait in the queue; when it finishes, the next job starts by itself."><g class="docs-q-builder"><rect x="8" y="30" width="190" height="84" rx="3"/><text x="103" y="56" class="is-title">Job 1 · building</text><rect class="docs-q-track" x="26" y="70" width="154" height="12"/><rect class="docs-q-fill" x="26" y="70" width="154" height="12"/><text x="103" y="102" class="is-small">your builder at work</text></g><path class="docs-q-arrow" d="M${x0 - 8} 74 H214"/><path class="docs-q-head" d="M204 74 l10 -6 v12 z"/>${boxes}<text x="${x0}" y="34" class="is-small is-left">Waiting: paid when queued · reorder with the arrows · no cancel</text><text x="${x0}" y="122" class="is-small is-left">Each finished job hands over to the next one, even while you are offline.</text></svg></figure>`;
}

function timeChart(data) {
  const ladders = [['Plots', data.island.plots.slice(1).map(row => [`Plot ${row.plot}`, row.minutes]), 'mint'],
    ['Power levels', data.power.levels.slice(1).map(row => [`Level ${row.level}`, row.minutes]), 'gold'],
    ['Island Levels', data.island.levels.slice(1).map(row => [`Level ${row.level}`, row.minutes]), 'lilac']];
  const top = Math.max(...ladders.flatMap(([, rows]) => rows.map(([, minutes]) => minutes)));
  return `<div class="docs-timechart">${ladders.map(([title, rows, tone]) => `<div class="docs-timechart-group is-${tone}"><p>${title}</p><ol>${rows.map(([label, minutes], index) => `<li style="--h:${Math.max(3, Math.sqrt(minutes / top) * 100).toFixed(1)}%;--i:${index}" title="${label}: ${duration(minutes)}"><span class="docs-bar"></span><span class="docs-bar-label">${duration(minutes)}</span></li>`).join('')}</ol></div>`).join('')}<p class="docs-caption">Bar height grows with the square root of the time, so short jobs stay visible.</p></div>`;
}

function powerChapter(data) {
  const levels=data.power.levels, top=levels.at(-1), max=data.island.max_plots;
  const price=row=>builderPrice(row,data.prices.per_hs);
  const needs=cardsOf(data).map(card=>[pcName(card),watts(card.watts),`Island Level ${card.min_island_level}`,`Power Level ${card.needs_power_level}`]);
  return {
    kicker:'Chapter 3',title:'Power for every desk',
    lead:`Every complete installed PC shares island power, from desk 1 to desk ${max}. Switching a PC off saves electricity but keeps its capacity reserved.`,
    stats:[['Starting capacity',watts(levels[0].capacity_w),'all desks share it'],['Power levels',grouped(levels.length),`Level 0 to ${top.level}`,'gold'],['Top capacity',watts(top.capacity_w),'all installed PCs','lilac'],['All levels',price(data.power.totals),duration(data.power.totals.minutes),'blush']],
    sections:[
      section('home','Desk 1 counts too',p('The first desk has no separate home-power allowance. Buying a PC, replacing one or saving a custom build checks the total load of all complete installed PCs. A replacement subtracts the old PC’s watts before adding the new PC.')),
      section('sharing','Reserve enough capacity',`${p('Complete the required power upgrades before installing a PC. A purchase or build that exceeds capacity is refused without charging. Moving an installed PC to another desk preserves its reserved watts; storing or dismantling it removes its completed load.')}${p(`Island Level 1 also caps each PC at ${hs(data.start.initial_hall_hash_cap)} of healthy base hash. Island Level ${data.start.hash_unlock_level} removes that cap. These checks apply to custom builds as well as ready PCs.`)}${powerPlanner(data)}${note('info','Planning tool','The planner checks the total watts of your selected PCs. It assumes the plots and Hall requirements are already met; use the tables below for those requirements.')}`),
      section('levels','The power levels',`${p('The POWER yard shows your completed power level. A queued upgrade only adds capacity when construction finishes.')}${stageViewer('power',data.stages.power,levels,(stage,level)=>({title:`Power Level ${level.level}`,facts:[['Capacity',watts(level.capacity_w)],['Price',price(level)],['Build time',level.minutes?duration(level.minutes):'Start'],['Needs',needsLevel(level.island_level)]]}))}${table(['Level','Capacity','Price','Build time','Needs'],levels.map(level=>[`Power Level ${level.level}`,watts(level.capacity_w),price(level),level.minutes?duration(level.minutes):'Start',needsLevel(level.island_level)]),{numeric:[1,2,3]})}${p(`All power upgrades cost ${price(data.power.totals)} at a fixed record and take ${duration(data.power.totals.minutes)} of builder time. Each job is quoted at the record when it is queued.`)}`),
      section('needs','Which level does a PC need?',`${p('These requirements are for one PC on an otherwise empty island. With more PCs, add all installed watts, including switched-off PCs.')}${table(['PC','Draw','Minimum Hall','Power level alone'],needs,{numeric:[1]})}`),
    ],
  };
}

function powerPlanner(data) {
  const cards = ladderCards(data).filter(card => !card.sealed);
  const pick = (...ids) => ids.map(id => cards.find(card => card.id === id)?.id ?? '');
  const desks = ['grove', ...pick('redwood', 'seed', 'cedar', 'sapling'), '', '', ''];
  const options = selected => `<option value="">Empty</option>${cardsOf(data).filter(card => !card.entry).map(card => `<option value="${e(card.id)}"${card.id === selected ? ' selected' : ''}>${e(card.name)} · ${watts(card.watts)}</option>`).join('')}`;
  return `<div class="docs-widget docs-planner" data-power-planner><div class="docs-widget-head"><p class="docs-widget-title">${icon('power')} Try it: share the power</p><label class="docs-range"><span>Power level <output data-planner-level>1</output></span><input type="range" min="0" max="${data.power.levels.length - 1}" value="1" step="1" data-planner-slider aria-label="Power level"></label></div><div class="docs-planner-bar" aria-hidden="true"><div class="docs-planner-fill" data-planner-fill></div><span class="docs-planner-cap" data-planner-cap></span></div><p class="docs-planner-summary" data-planner-summary aria-live="polite"></p><ol class="docs-planner-desks">${desks.slice(0, data.island.max_plots).map((id, index) => `<li data-desk="${index + 1}"><span class="docs-desk-name">PC ${index + 1}${index === 0 ? ' · MY PC' : ''}</span><select data-desk-pick aria-label="PC on desk ${index + 1}">${options(id)}</select><span class="docs-desk-state" data-desk-state></span></li>`).join('')}</ol></div>`;
}

function energyChapter(data) {
  const energy = data.energy, fern = cardById(data, 'fern') ?? ladderCards(data)[0];
  const rows = cardsOf(data).map(card => [pcName(card), watts(card.watts), `${num(card.kwh_day, 3)} kWh`, usd(card.daily_usd)]);
  const hours = listText(energy.refill_hours.map(value => `${value}`), 'or');
  return {
    kicker: 'Chapter 4', title: 'Electricity and your energy stock',
    lead: `Every running PC uses electricity. There is one flat price for everyone: ${usd(energy.usd_per_kwh)} per kWh.`,
    stats: [['Price', `${usd(energy.usd_per_kwh)}/kWh`, 'same for every island'], ['Refills', energy.refill_hours.map(value => `${value} h`).join(' · '), 'of your running load', 'gold'],
      ['Included', `${energy.included_hours} h`, 'with every PC card', 'lilac']],
    sections: [
      section('price', 'One flat price', p(`Electricity costs the same <strong>${usd(energy.usd_per_kwh)} per kWh</strong> on every island and every power level. Power levels only decide how many watts all installed PCs may reserve; they never change the price.`)),
      section('kwh', 'What a PC costs per day', `${formula([`kWh = watts × hours ÷ 1,000`, `cost per day = watts × 24 ÷ 1,000 × ${usd(energy.usd_per_kwh)}`])}${p(`A ${e(fern.name)} draws ${watts(fern.watts)}: ${grouped(fern.watts)} × 24 ÷ 1,000 = ${num(fern.kwh_day, 3)} kWh a day, which costs ${usd(fern.daily_usd)}.`)}${table(['PC', 'Draw', 'Per day', 'Cost per day'], rows, {numeric: [1, 2, 3]})}`),
      section('stock', 'Your energy stock', `${p('Your island has <strong>one shared energy stock</strong>, measured in kWh. Every running PC draws from it, desk 1 included. PCs that are switched off draw nothing. A PC is installed only when your power capacity and Island Level allow it.')}${p(`<strong>Run time</strong> is your stock divided by your running load. The Energy window shows it, and warns you when less than ${plural(energy.low_hours, 'hour')} are left and again under ${plural(energy.critical_hours, 'hour')}.`)}${note('warn', 'When the stock runs out', 'Every PC on your island stops mining until you refill. Nothing breaks and nothing is lost, but no rewards build up while they are stopped.')}`),
      section('refills', 'Refills', `${p(`Buy <strong>${hours} hours</strong> of your current running load. The price follows the load: the more watts are running, the bigger the refill. If your load changes before you buy, the game asks you to refresh the offer.`)}${p(`Every PC card includes ${energy.included_hours} hours of its own electricity. Parts don’t include energy.`)}${energyCalculator(data)}`),
      section('saving', 'Spend less on electricity', list([
        `<strong>Compare H/s per W.</strong> It tells you how much a PC makes for each watt (see ${link('pc-building', 'PC building', 'efficiency')}).`,
        '<strong>Switch off a PC you don’t need.</strong> A switched-off PC draws nothing.',
        `<strong>Keep PCs cool.</strong> Heat doesn’t change the watts a PC uses, but it lowers its H/s, so care pays twice (see ${link('heat-and-care', 'Heat &amp; care')}).`,
      ])),
    ],
  };
}

function energyCalculator(data) {
  const options = cardsOf(data).map(card => `<option value="${e(card.id)}"${card.id === 'fern' ? ' selected' : ''}>${e(card.name)} · ${watts(card.watts)}</option>`).join('');
  return `<div class="docs-widget docs-calc" data-energy-calc><p class="docs-widget-title">${icon('energy')} Try it: price a refill</p><div class="docs-calc-inputs"><label><span>PC</span><select data-calc-card>${options}</select></label><label class="docs-range"><span>How many <output data-calc-count>1</output></span><input type="range" min="1" max="${data.island.max_plots}" value="1" data-calc-slider aria-label="How many of this PC"></label></div><dl class="docs-calc-out is-three" data-calc-out aria-live="polite"></dl></div>`;
}

function buildingChapter(data) {
  const parts = data.parts, kinds = parts.kinds, curve = parts.curve;
  const totalParts = Object.values(parts.counts).reduce((sum, value) => sum + value, 0);
  const minMax = (kind, key) => {const values = kinds[kind].map(row => row[key]).filter(value => value != null);return [Math.min(...values), Math.max(...values)];};
  const [cpuLow, cpuHigh] = minMax('cpu', 'hashrate'), [gpuLow, gpuHigh] = minMax('gpu', 'hashrate'), [ssdLow, ssdHigh] = minMax('ssd', 'hashrate');
  const [psuLow, psuHigh] = minMax('psu', 'capacity_w'), [coolLow, coolHigh] = minMax('cooler', 'rating'), [flowLow, flowHigh] = minMax('fan', 'flow');
  const [mountLow, mountHigh] = minMax('case', 'mounts'), [airLow, airHigh] = minMax('case', 'airflow');
  const sizes = [...new Set(kinds.case.flatMap(row => row.mount_sizes))].sort((a, b) => a - b);
  const memories = [...new Set(kinds.board.map(row => row.memory))];
  const [slotLow, slotHigh] = minMax('board', 'ram_slots'), [ramLow, ramHigh] = minMax('board', 'max_ram_gb');
  const reservePct = Math.round((parts.psu_reserve - 1) * 100), system = parts.systems[0];
  const example = cardById(data, 'grove') ?? ladderCards(data).find(card => card.breakdown);
  const families = {Retro775: 'Core 2 era desktop platform', Legacy1155: 'Older Intellect Corps i5 / i7', Grove: 'Modern desktop CPUs', sTR5: 'Threadrunner workstations'};
  const kindCards = [
    ['case', 'Case', false, false, `Holds the PC. Cases differ in their <strong>fan mounts</strong> (${mountLow} to ${mountHigh} mounts, ${sizes.join(', ')} mm) and their airflow score (${airLow}–${airHigh}). No H/s, no watts, and it never wears out.`],
    ['board', 'Motherboard', false, true, `Sets the <strong>CPU socket</strong>, the memory type (${listText(memories)}), the number of RAM slots (${range([slotLow, slotHigh])}), the most RAM it takes (${grouped(ramLow)}–${grouped(ramHigh)} GB), the biggest single module and the memory speed. Its base draw is ${parts.base_watts.modern} W (${parts.base_watts.legacy} W on DDR2/DDR3 boards).`],
    ['cpu', 'CPU', true, true, `Makes H/s and uses watts: from ${hs(cpuLow)} to ${hs(cpuHigh)}. It must match the motherboard’s socket.`],
    ['gpu', 'Graphics card', true, true, `Usually your biggest H/s source: ${hs(gpuLow)} to ${hs(gpuHigh)}. Each GPU has its own cooler rating, which sets how hot it runs.`],
    ['ram', 'RAM', true, true, 'Makes H/s from its total size and speed. It must match the board’s memory type, and all modules run at the slowest supported speed.'],
    ['ssd', 'SSD / storage', true, true, `A little H/s (${hs(ssdLow)} to ${hs(ssdHigh)}) for a few watts.`],
    ['psu', 'Power supply', false, false, `Powers the PC. Its capacity must cover the PC’s draw plus a <strong>${reservePct}% reserve</strong>. From ${watts(psuLow)} to ${watts(psuHigh)}.`],
    ['cooler', 'CPU cooler', false, true, `Cools the CPU, with ratings from ${num(coolLow, 2)} (basic) to ${num(coolHigh, 2)}. Old-socket coolers fit only boards of their own family.`],
    ['fan', 'Case fans', false, true, `Move air through the case. Any fan fits any mount, and bigger mounts move more air. Fan strength runs from ${num(flowLow, 2)} to ${num(flowHigh, 2)}.`],
  ];
  const ddr = parts.ram.modern, speedExample = 6000;
  const ramHs = gb => (ddr.base_hs + ddr.per_doubling_hs * Math.log2(gb / ddr.reference_gb)) * speedExample / ddr.reference_speed;
  const curveRows = ladderCards(data).map(card => [pcName(card), hs(card.parts_hashrate), times(card.multiplier, 4), hs(card.hashrate)]);
  return {
    kicker: 'Chapter 5', title: 'Build and upgrade your PCs',
    lead: 'A PC is a set of parts. Some parts make H/s, every running part uses watts, and every part must fit the others.',
    stats: [['Parts on sale', grouped(totalParts), `in ${Object.keys(kinds).length} kinds`], ['Efficiency bonus', `up to ${times(curve.top)}`, 'for stronger builds', 'gold'],
      ['PSU reserve', `${reservePct}%`, 'on top of the draw', 'lilac']],
    sections: [
      section('parts', 'The parts', `<ul class="docs-kinds">${kindCards.map(([kind, title, makes, uses, text], index) => `<li style="--i:${index}"><div class="docs-kind-head">${icon(kind)}<strong>${title}</strong></div>${chips([[makes ? 'Makes H/s' : 'No H/s', makes ? 'mint' : 'muted'], [uses ? 'Uses watts' : 'No watts', uses ? 'gold' : 'muted']])}<p>${text}</p><span class="docs-kind-count">${plural(parts.counts[kind], 'model')}</span></li>`).join('')}${system ? `<li style="--i:${kindCards.length}"><div class="docs-kind-head">${icon('system')}<strong>Sealed systems</strong></div>${chips([['Makes H/s', 'mint'], ['Uses watts', 'gold']])}<p>A complete machine in one box (${e(system.name)}): fixed parts, nothing to change. See <a href="#sealed">sealed systems</a>.</p><span class="docs-kind-count">${plural(parts.systems.length, 'model')}</span></li>` : ''}</ul>`),
      section('math', 'Where H/s and watts come from', `${formula([
        'parts H/s = CPU + GPU + SSD + RAM',
        `watts = board base (${parts.base_watts.modern} W, or ${parts.base_watts.legacy} W on DDR2/DDR3) + CPU + GPU + SSD + RAM + cooler + fans`,
        'PC H/s = parts H/s × efficiency multiplier',
      ])}${example ? breakdownFigure(example, parts.psu_reserve) : ''}`),
      section('ram', 'RAM: size and speed', `${p('RAM makes more H/s as you add capacity, a little less with each doubling, and it scales with its speed.')}${formula([
        `DDR5: (${ddr.base_hs} + ${ddr.per_doubling_hs} × log2(total GB ÷ ${ddr.reference_gb})) × speed ÷ ${grouped(ddr.reference_speed)}`,
        `DDR2 / DDR3: the table below × speed ÷ ${grouped(parts.ram.legacy.reference_speed)}`,
      ])}<div class="docs-two">${table(['DDR5 at 6,000 MT/s', 'RAM H/s'], [16, 32, 64, 128, 256].map(gb => [`${gb} GB`, hs(ramHs(gb))]), {numeric: [1]})}${table(['DDR2 / DDR3 total', 'Base H/s'], parts.ram.legacy.anchors.map(([gb, value]) => [`${gb} GB`, hs(value)]), {numeric: [1]})}</div>${p('The speed is the <strong>slowest</strong> of the board’s memory speed and every module’s speed. One slow module slows them all.')}`),
      section('fit', 'What fits', `${list([
        '<strong>One of each.</strong> A PC needs exactly one case, motherboard, CPU, graphics card, SSD, power supply and CPU cooler, plus at least one RAM module.',
        '<strong>Socket.</strong> The CPU’s socket must match the motherboard’s.',
        `<strong>Memory type.</strong> Every RAM module must match the board’s memory type (${listText(memories, 'or')}).`,
        '<strong>RAM slots and size.</strong> No more modules than slots, no more total RAM than the board’s maximum, and no module bigger than the board takes.',
        '<strong>Fans.</strong> No more case fans than the case has mounts.',
        `<strong>Power supply.</strong> The PC’s draw plus a ${reservePct}% reserve must fit. A ${grouped(400)} W PC needs at least a ${grouped(Math.ceil(400 * parts.psu_reserve))} W power supply.`,
        '<strong>Old coolers.</strong> A retro LGA775 or legacy LGA1155 cooler fits only a board of its own family. Modern air and liquid coolers fit every board.',
        '<strong>Sealed systems</strong> can’t be changed at all.',
      ])}${table(['Socket', 'Memory', 'CPUs', 'Boards', 'What it is'], parts.families.map(row => [e(row.socket), row.memory.join(', '), grouped(row.cpus), grouped(row.boards), families[row.socket] ?? '—']), {numeric: [2, 3]})}${p('The Build window checks every part as you go and won’t save a PC that doesn’t work.')}`),
      section('curve', 'The efficiency curve', `${p('Stronger builds get extra H/s from the same parts. The game gives every build a value:')}${formula([`value = ${num(curve.k, 4)} × parts H/s − ${num(curve.lam, 3)} × watts`])}${p(`A higher value earns a higher multiplier, from <strong>${times(curve.points[0].multiplier)}</strong> for a ${e(cardById(data, curve.points[0].card)?.name ?? 'starter')}-class build up to <strong>${times(curve.top)}</strong> at the top. Between the points below the multiplier grows smoothly (straight lines on a log-log chart), and it is already part of every H/s the game shows you.`)}${curveChart(data)}${table(['PC', 'Parts H/s', 'Multiplier', 'PC H/s'], curveRows, {numeric: [1, 2, 3]})}`),
      section('efficiency', 'H/s per W', `${p('H/s per W is how many H/s a PC makes for each watt it draws. It is the best way to compare running costs: a PC with twice the H/s per W makes the same H/s for half the electricity.')}${efficiencyBars(data)}`),
      section('parity', 'Ready PC or parts: same result', p('A ready PC and the same parts built by hand give exactly the same H/s and watts. Upgrading one part recalculates everything, the efficiency multiplier included.')),
      section('sealed', 'Sealed systems', system ? p(`The <strong>${e(system.name)}</strong> is a sealed system: its CPU, GPU, RAM and SSD are fixed, and it can’t be opened or changed. It makes ${hs(cardById(data, 'mac_mini')?.hashrate ?? system.hashrate)} on ${watts(system.watts)} and can be installed on an open desk once its Hall and power requirements are met. Put it where a tower was and your tower stays saved, so you can switch back. It runs at its own temperatures (${system.temps_c.map(celsius).join(' / ')} fresh) and still needs thermal paste and fan cleaning: one cleaning covers the whole machine.`) : p('Sealed systems have fixed parts and can’t be changed.')),
      section('upgrade', 'Upgrading', list([
        '<strong>Nothing is lost.</strong> A replaced part goes to your inventory, ready for another desk.',
        '<strong>Build keeps a draft.</strong> Your changes apply when you press Save &amp; Exit.',
        '<strong>Follow the tip.</strong> The Build window suggests your best next upgrade.',
      ])),
      section('reference', 'Parts reference', `${p(`Every part on sale, cheapest first. Prices in US dollars.`)}${partsBrowser(data)}`),
    ],
  };
}

function breakdownFigure(card, reserve) {
  const b = card.breakdown;
  const hsRows = [['CPU', b.hs.cpu, 'mint'], ['GPU', b.hs.gpu, 'lilac'], ['RAM', b.hs.ram, 'gold'], ['SSD', b.hs.ssd, 'blush']];
  const wRows = [['Base', b.watts.base, 'muted'], ['CPU', b.watts.cpu, 'mint'], ['GPU', b.watts.gpu, 'lilac'], ['RAM', b.watts.ram, 'gold'], ['SSD', b.watts.ssd, 'blush'], ['Cooler', b.watts.cooler, 'muted'], ['Fans', b.watts.fans, 'muted']];
  const totalHs = hsRows.reduce((sum, row) => sum + row[1], 0), totalW = wRows.reduce((sum, row) => sum + row[1], 0);
  const bar = (rows, total, unit) => `<div class="docs-stack" role="img" aria-label="${rows.map(([name, value]) => `${name} ${num(value, 2)} ${unit}`).join(', ')}">${rows.filter(row => row[1] > 0).map(([name, value, tone], index) => `<span class="is-${tone}" style="--w:${(value / total * 100).toFixed(2)}%;--i:${index}" title="${name}: ${num(value, 2)} ${unit}"></span>`).join('')}</div><ul class="docs-stack-legend">${rows.filter(row => row[1] > 0).map(([name, value, tone]) => `<li class="is-${tone}"><i></i>${name} <strong>${num(value, 2)}</strong></li>`).join('')}</ul>`;
  return `<figure class="docs-figure docs-breakdown"><figcaption>Example: the <strong>${e(card.name)}</strong> card</figcaption><div class="docs-breakdown-row"><p>Parts H/s <strong>${num(totalHs, 2)}</strong></p>${bar(hsRows, totalHs, 'H/s')}</div><div class="docs-breakdown-row"><p>Watts <strong>${num(totalW, 1)}</strong></p>${bar(wRows, totalW, 'W')}</div><p class="docs-breakdown-result">${num(totalHs, 3)} parts H/s × ${num(card.multiplier, 4)} = <strong>${hs(card.hashrate)}</strong> on ${watts(card.watts)} · its ${watts(b.psu_w)} power supply covers the ${watts(Math.round(card.watts * reserve * 10) / 10)} it needs with the reserve</p></figure>`;
}

function curveChart(data) {
  const {points, top} = data.parts.curve, cards = ladderCards(data);
  const W = 640, H = 260, L = 52, R = 18, T = 18, B = 40;
  const lo = Math.log10(points[0].value / 1.6), hi = Math.log10(points.at(-1).value * 1.6);
  const x = value => L + (Math.log10(value) - lo) / (hi - lo) * (W - L - R);
  const y = m => T + (top + 0.02 - m) / (top + 0.02 - 0.97) * (H - T - B);
  const line = [`M${L} ${y(points[0].multiplier).toFixed(1)}`, ...points.map(point => `L${x(point.value).toFixed(1)} ${y(point.multiplier).toFixed(1)}`), `L${W - R} ${y(top).toFixed(1)}`].join(' ');
  const ticks = [1, 1.1, 1.2, 1.3, 1.4].filter(m => m <= top + 1e-9);
  const decades = [10, 100, 1000, 10000].filter(value => Math.log10(value) > lo && Math.log10(value) < hi);
  const name = id => cards.find(card => card.id === id)?.name ?? id;
  return `<figure class="docs-figure"><svg class="docs-svg docs-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Efficiency multiplier rising from ${num(points[0].multiplier, 2)} to ${num(top, 2)} as the build value grows">${ticks.map(m => `<g class="docs-grid"><line x1="${L}" x2="${W - R}" y1="${y(m).toFixed(1)}" y2="${y(m).toFixed(1)}"/><text x="${L - 8}" y="${(y(m) + 4).toFixed(1)}" class="is-right">×${m.toFixed(1)}</text></g>`).join('')}${decades.map(value => `<g class="docs-grid"><line x1="${x(value).toFixed(1)}" x2="${x(value).toFixed(1)}" y1="${T}" y2="${H - B}"/><text x="${x(value).toFixed(1)}" y="${H - B + 18}">$${grouped(value)}</text></g>`).join('')}<path class="docs-curve-line" d="${line}"/>${points.map((point, index) => `<g class="docs-curve-dot" style="--i:${index}"><circle cx="${x(point.value).toFixed(1)}" cy="${y(point.multiplier).toFixed(1)}" r="4.5"/><text x="${x(point.value).toFixed(1)}" y="${(y(point.multiplier) + (index % 2 ? 20 : -10)).toFixed(1)}">${e(name(point.card))}</text></g>`).join('')}<text x="${(L + W - R) / 2}" y="${H - 6}" class="is-axis">build value (log scale)</text></svg></figure>`;
}

function efficiencyBars(data) {
  const cards = cardsOf(data), top = Math.max(...cards.map(card => card.hs_per_w));
  return `<ol class="docs-hbars">${cards.map((card, index) => `<li style="--w:${(card.hs_per_w / top * 100).toFixed(1)}%;--i:${index}"><span class="docs-hbar-name">${pcName(card)}</span><span class="docs-hbar"><i></i></span><span class="docs-hbar-value">${Number(card.hs_per_w).toFixed(2)}</span></li>`).join('')}</ol>`;
}

function partsBrowser(data) {
  const tabs = [['cpu', 'CPUs'], ['gpu', 'GPUs'], ['ram', 'RAM'], ['ssd', 'Storage'], ['board', 'Boards'], ['psu', 'Power'], ['cooler', 'Coolers'], ['case', 'Cases'], ['fan', 'Fans']]
    .filter(([kind]) => data.parts.kinds[kind]?.length);
  return `<div class="docs-widget docs-browser" data-parts-browser><div class="docs-tabs" role="tablist" aria-label="Part kinds">${tabs.map(([kind, label], index) => `<button type="button" role="tab" id="docs-tab-${kind}" aria-controls="docs-parts-panel" aria-selected="${index === 0}" tabindex="${index ? -1 : 0}" data-parts-tab="${kind}">${label} <span>${data.parts.kinds[kind].length}</span></button>`).join('')}</div><div id="docs-parts-panel" role="tabpanel" aria-labelledby="docs-tab-${tabs[0][0]}" data-parts-panel>${partsTable(data, tabs[0][0])}</div></div>`;
}

/** One kind's reference table (also used by the browser widget when a tab changes). */
export function partsTable(data, kind) {
  const rows = data.parts.kinds[kind] ?? [];
  const name = row => e(row.name);
  const spec = {
    cpu: [['Socket', 'H/s', 'Watts', 'Price'], row => [name(row), e(row.socket), num(row.hashrate, 2), num(row.watts), usd(row.price_usd)], [2, 3, 4]],
    gpu: [['H/s', 'Watts', 'Cooler', 'Price'], row => [name(row), num(row.hashrate, 2), num(row.watts), num(row.cooler, 2), usd(row.price_usd)], [1, 2, 3, 4]],
    ram: [['Memory', 'Size', 'Speed', 'Watts', 'Price'], row => [name(row), e(row.memory), `${row.capacity_gb} GB${row.modules > 1 ? ` (${row.modules}×)` : ''}`, `${grouped(row.speed)} MT/s`, num(row.watts), usd(row.price_usd)], [2, 3, 4, 5]],
    ssd: [['H/s', 'Watts', 'Price'], row => [name(row), num(row.hashrate, 2), num(row.watts), usd(row.price_usd)], [1, 2, 3]],
    board: [['Socket', 'Memory', 'Slots', 'Max RAM', 'Price'], row => [name(row), e(row.socket), `${e(row.memory)}-${grouped(row.memory_speed)}`, grouped(row.ram_slots), `${grouped(row.max_ram_gb)} GB`, usd(row.price_usd)], [3, 4, 5]],
    psu: [['Capacity', 'Carries up to', 'Price'], row => [name(row), watts(row.capacity_w), watts(Math.floor(row.capacity_w / data.parts.psu_reserve * 10) / 10), usd(row.price_usd)], [1, 2, 3]],
    cooler: [['Rating', 'Watts', 'Fits', 'Price'], row => [name(row), num(row.rating, 2), num(row.watts), row.family ? `${e(row.family)} boards` : 'Every board', usd(row.price_usd)], [1, 2, 4]],
    case: [['Fan mounts', 'Sizes', 'Airflow', 'Price'], row => [name(row), grouped(row.mounts), row.mount_sizes.map(size => `${size} mm`).join(', '), `${row.airflow}%`, usd(row.price_usd)], [1, 3, 4]],
    fan: [['Strength', 'Watts', 'Price'], row => [name(row), num(row.flow, 2), num(row.watts), usd(row.price_usd)], [1, 2, 3]],
  }[kind];
  if (!spec) return '';
  return table(['Part', ...spec[0]], rows.map(spec[1]), {numeric: spec[2], cls: 'is-compact'});
}

function heatChapter(data) {
  const h = data.heat, examples = h.cooling[0], worn = h.worn_example;
  const budgetPCs = (data.start.budget_pcs ?? [data.start.entry_pc]).filter(pc => pc?.care_usd);
  const entryCare = budgetPCs.map(pc => {
    const care = pc.care_usd;
    return note('info', `${e(pc.name)} care`, `This sealed PC has its own care prices: CPU paste ${usd(care.cpu_paste)}, GPU paste ${usd(care.gpu_paste)}, whole-PC fan cleaning ${usd(care.fan_clean)}, and repair ${usd(care.repair)}. Its parts stay fixed; replace the PC to upgrade it.`);
  }).join('');
  const rows = h.builds.map(row => [pcName(cardById(data, row.id) ?? row), watts(row.watts), celsius(row.fresh_c), celsius(row.neglected_c), pct(row.neglected_loss_pct), row.no_fans_c == null ? '<span class="docs-muted">sealed</span>' : `${celsius(row.no_fans_c)}${row.no_fans_loss_pct ? ` <span class="docs-muted">(−${pct(row.no_fans_loss_pct)})</span>` : ''}`]);
  const at80 = Math.min(h.max_loss_pct, (80 - h.throttle_c) * h.loss_per_c_pct);
  return {
    kicker: 'Chapter 6', title: 'Keep your PCs cool and healthy',
    lead: 'Heat and wear can slow a PC down. A little care keeps every PC at full speed.',
    stats: [['Throttling from', celsius(h.throttle_c), `${pct(h.loss_per_c_pct)} per degree above`], ['Most heat loss', pct(h.max_loss_pct), `at ${celsius(h.max_c)}`, 'blush'],
      ['Thermal paste', `from ${usd(Math.min(h.care.paste_usd, ...budgetPCs.flatMap(pc => [pc.care_usd.cpu_paste, pc.care_usd.gpu_paste])))}`, 'priced for the chosen chip', 'gold'], ['Fan cleaning', `from ${usd(Math.min(h.care.fan_clean_usd, ...budgetPCs.map(pc => pc.care_usd.fan_clean)))}`, 'per fan', 'lilac']],
    sections: [
      section('temps', 'Temperatures', `${p('Every mining PC shows a CPU and a GPU temperature. The hotter chip sets its state:')}<ul class="docs-states"><li class="is-cool"><strong>Cool</strong><span>below ${celsius(h.warm_c)}</span></li><li class="is-warm"><strong>Warm</strong><span>${grouped(h.warm_c)}–${num(h.throttle_c - 0.1, 1)} °C</span></li><li class="is-hot"><strong>Throttling</strong><span>${celsius(h.throttle_c)} and up</span></li></ul>${p('A PC that isn’t mining (switched off, out of energy or not complete) shows no temperature and loses nothing to heat.')}`),
      section('throttle', 'Throttling', `${p(`Up to <strong>${celsius(h.throttle_c)}</strong> a PC runs at full speed. Above it, every degree costs <strong>${pct(h.loss_per_c_pct)}</strong> of its speed, up to <strong>${pct(h.max_loss_pct)}</strong> at ${celsius(h.max_c)}. At 80 °C, for example, a PC loses ${pct(at80)}.`)}${heatChart(h)}`),
      section('formula', 'What sets the temperature', `${p('Each chip’s temperature comes from the whole PC’s heat, the chip’s own heat, its cooler and the case’s airflow:')}${formula([
        `chip °C = ${h.base_c} + (PC heat + chip heat ÷ cooler) ÷ airflow + dry paste`,
        `PC heat = ${h.pc_c_per_w} × (PC watts − fan and cooler watts)`,
        `chip heat = CPU: ${h.cpu_c} × CPU watts ÷ ${h.cpu_ref_w}  ·  GPU: ${h.gpu_c} × GPU watts ÷ ${h.gpu_ref_w}`,
        'cooler = the CPU cooler’s rating, or the GPU’s own cooler rating',
        `airflow = case airflow % × (${num(h.fan_base, 2)} + ${num(h.fan_gain, 2)} × flow ÷ (flow + case target))`,
        `flow = for each fan: strength × (mount mm ÷ 120)² × (${h.dusty_flow_pct}% dusty … 100% clean)`,
        `dry paste = up to +${h.paste_rise_c} °C on its own chip`,
      ])}${p('In plain words: more watts make more heat; a better cooler divides the chip’s own heat; a case with good airflow and more, stronger, cleaner fans divides everything; and dry paste adds heat on top. Fans and coolers move air instead of heating the case, so adding one never costs you heat.')}${note('info', 'Fans have diminishing returns', 'Every extra fan helps, but a little less than the one before. A PC with no case fans at all runs much hotter.')}`),
      section('paste', 'Thermal paste', `${p(`Paste dries out as a PC mines: a CPU’s paste lasts <strong>${h.clocks_h.cpu_paste} hours</strong> of mining and a GPU’s <strong>${h.clocks_h.gpu_paste} hours</strong>. Dry paste adds up to <strong>+${h.paste_rise_c} °C</strong> to its own chip.`)}${p(`Standard pricing for one dose is <strong>the greater of ${usd(h.care.paste_usd)} or ${pct(h.care.paste_pct)} of the chosen chip’s list price</strong>. Buy it from that CPU or GPU’s care card. The prepaid dose belongs to that exact component and target; manual application is free. A sealed PC uses its system list price.`)}${entryCare}${note('tip', 'Auto-paste', `Turn on auto-paste for a PC’s CPU or GPU and the game re-pastes it at ${h.auto_paste_pct}% of the paste’s life, using compatible prepaid doses from your inventory. It never buys paste for you, so keep a few in stock.`)}`),
      section('dust', 'Fans and dust', p(`Fans collect dust over <strong>${h.clocks_h.fan} hours</strong> of mining. A fully dusty fan moves only <strong>${h.dusty_flow_pct}%</strong> of its air. Standard fan cleaning costs <strong>the greater of ${usd(h.care.fan_clean_usd)} or ${pct(h.care.fan_pc_pct)} of the PC value divided by its installed fan count</strong>, rounded up to a micro-dollar. An exact ready-PC recipe uses its card total; a custom PC uses its parts’ list-price total, excluding cosmetics. Each fan retains its highest installed cleaning fee, so stripping the PC or moving the fan to storage cannot lower its quote. A sealed PC is one cleaning unit.${budgetPCs.map(pc => ` ${e(pc.name)} uses its sealed-PC cleaning price of ${usd(pc.care_usd.fan_clean)}.`).join('')}`)),
      section('wear', 'Wear and repairs', `${p(`Every part except the case wears as it mines. Over <strong>${h.clocks_h.hardware} hours</strong> (${h.clocks_h.hardware / 24} days) of mining, wear grows to a <strong>${pct(h.wear.max_pct)}</strong> speed loss; the most worn part sets the loss. A part counts as worn from ${pct(h.wear.worn_pct)}.`)}${p(`A standard part repair restores it to 100% for <strong>${pct(h.care.repair_pct)} of its list price</strong>, at least ${usd(h.care.repair_min_usd)}. Repairing ${article(worn.name)} ${e(worn.name)} (${usd(worn.price_usd)}), for example, costs ${usd(worn.repair_usd)}.`)}`),
      section('floor', 'The 50% floor', p(`Heat and wear together never take more than <strong>${pct(100 - h.floor_pct)}</strong> of a PC’s speed: a neglected PC always keeps at least ${pct(h.floor_pct)}.`)),
      section('clocks', 'Care clocks only run while mining', p('Paste, dust and wear only age while a PC mines. A PC that is switched off or out of energy keeps its condition.')),
      section('numbers', 'Care in numbers', `${careSlider(data)}${p(`The table shows every PC card fresh, after ${h.care_hours.at(-1)} hours of mining with no care at all (fully dry paste, fully dusty fans), and fresh but without any case fans. Wear comes on top.`)}${table(['PC', 'Draw', 'Fresh', 'No care', 'Heat loss', 'No case fans'], rows, {numeric: [1, 2, 3, 4, 5]})}`),
      section('cooling', 'Good cooling pays', `${p(`An example from the game: ${article(examples.cpu)} <strong>${e(examples.cpu)}</strong> with ${article(examples.gpu)} <strong>${e(examples.gpu)}</strong>, halfway through its paste’s life.`)}${coolingCompare(h, examples)}${p(`Better coolers, cases with high airflow and more, stronger fans all lower temperatures. Cases differ a lot: compare their fan mounts and airflow in the ${link('pc-building', 'parts reference', 'reference')}.`)}`),
      section('sealed', 'Sealed PCs', p(`Sealed PCs start from their own temperatures. Dry paste adds up to +${h.paste_rise_c} °C and a clogged fan up to +${h.sealed_dust_rise_c} °C.`)),
    ],
  };
}

/** The calibration's two cooling setups for the same hot PC, side by side. */
function coolingCompare(h, example) {
  const setups = h.cooling_setups;
  if (!setups) return '';
  const fans = names => {
    const counts = new Map();
    names.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1));
    return [...counts].map(([name, total]) => `${total} × ${e(name)}`).join(', ') || 'none';
  };
  const card = (kind, title, setup, temp, speed) => `<div class="docs-compare-card is-${kind}"><p class="docs-compare-label">${title}</p><ul><li><span>Cooler</span>${e(setup.cooler)}</li><li><span>Case</span>${e(setup.case)}</li><li><span>Case fans</span>${fans(setup.fans)}</li></ul><p class="docs-compare-result"><strong>${celsius(temp)}</strong><span>${pct(speed)} speed</span></p></div>`;
  return `<div class="docs-compare">${card('stock', 'Basic cooling', setups.stock, example.stock_c, example.stock_pct)}${card('best', 'Strong cooling', setups.best, example.best_c, example.best_pct)}</div>`;
}

function heatChart(h) {
  const W = 640, H = 220, L = 46, R = 16, T = 16, B = 36, lo = 40, hi = 100;
  const x = c => L + (c - lo) / (hi - lo) * (W - L - R), y = loss => T + (1 - loss / (h.max_loss_pct * 1.1)) * (H - T - B);
  const path = `M${x(lo)} ${y(0)} L${x(h.throttle_c)} ${y(0)} L${x(h.max_c)} ${y(h.max_loss_pct)} L${x(hi)} ${y(h.max_loss_pct)}`;
  return `<figure class="docs-figure"><svg class="docs-svg docs-heat" viewBox="0 0 ${W} ${H}" role="img" aria-label="Speed loss is zero up to ${h.throttle_c} °C, then grows by ${h.loss_per_c_pct}% per degree to ${h.max_loss_pct}% at ${h.max_c} °C"><rect class="docs-zone is-cool" x="${x(lo)}" y="${T}" width="${x(h.warm_c) - x(lo)}" height="${H - T - B}"/><rect class="docs-zone is-warm" x="${x(h.warm_c)}" y="${T}" width="${x(h.throttle_c) - x(h.warm_c)}" height="${H - T - B}"/><rect class="docs-zone is-hot" x="${x(h.throttle_c)}" y="${T}" width="${x(hi) - x(h.throttle_c)}" height="${H - T - B}"/>${[0, 10, 20, 30].filter(v => v <= h.max_loss_pct).map(v => `<g class="docs-grid"><line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" class="is-right">${v ? `−${v}%` : '0%'}</text></g>`).join('')}${[40, 50, 60, 70, 80, 90, 100].map(c => `<text x="${x(c)}" y="${H - B + 18}" class="docs-tick">${c}°</text>`).join('')}<text x="${(x(lo) + x(h.warm_c)) / 2}" y="${T + 16}" class="is-small">cool</text><text x="${(x(h.warm_c) + x(h.throttle_c)) / 2}" y="${T + 16}" class="is-small">warm</text><text x="${(x(h.throttle_c) + x(hi)) / 2}" y="${T + 16}" class="is-small">throttling</text><path class="docs-heat-line" d="${path}"/><circle class="docs-heat-dot" cx="${x(h.throttle_c)}" cy="${y(0)}" r="4.5"/><circle class="docs-heat-dot" cx="${x(h.max_c)}" cy="${y(h.max_loss_pct)}" r="4.5"/><text x="${x(h.max_c) - 10}" y="${y(h.max_loss_pct) + 4}" class="is-right">−${h.max_loss_pct}% at ${h.max_c} °C</text><text x="${x(h.throttle_c) - 10}" y="${y(0) - 10}" class="is-right">no loss up to ${h.throttle_c} °C</text></svg></figure>`;
}

function careSlider(data) {
  const h = data.heat, options = h.builds.map(row => `<option value="${e(row.id)}"${row.id === 'grove' ? ' selected' : ''}>${e(row.name)}</option>`).join('');
  const marks = h.care_hours;
  return `<div class="docs-widget docs-care" data-care-slider><p class="docs-widget-title">${icon('heat')} Try it: skip the care</p><div class="docs-calc-inputs"><label><span>PC</span><select data-care-card>${options}</select></label><label class="docs-range"><span>Hours mined without care <output data-care-hours>0</output></span><input type="range" min="0" max="${marks.length - 1}" value="0" step="1" data-care-input aria-label="Hours mined without care"></label></div><div class="docs-care-out" aria-live="polite"><div class="docs-thermo" aria-hidden="true"><span data-care-fill></span></div><dl class="docs-calc-out is-two" data-care-out></dl></div></div>`;
}

function bonusChapter(data) {
  const b = data.bonus, ex = b.example, cards = ladderCards(data);
  const best = cardById(data, 'cedar') ?? cards[Math.floor(cards.length / 2)];
  const need = best.hashrate * b.match_share_pct / 100;
  const yes = cards.filter(card => card.hashrate >= need && card.hashrate < best.hashrate).at(0);
  const no = [...cards].reverse().find(card => card.hashrate < need && card.hashrate >= b.min_pc_hs);
  // "Island Levels 2 and 3 add +4% each, levels 4–11 add +2% each": runs of equal steps.
  const groups = [];
  for (const level of b.levels.filter(row => row.pct > 0)) {
    const last = groups.at(-1);
    if (last && last.pct === level.pct) last.to = level.level;else groups.push({from: level.level, to: level.level, pct: level.pct});
  }
  const levelParts = groups.map(group => group.from === group.to ? `Island Level ${group.from} adds ${pct(group.pct, true)}`
    : `${group.from < 4 ? 'Island Levels' : 'levels'} ${group.to - group.from === 1 ? `${group.from} and ${group.to}` : `${group.from}–${group.to}`} add ${pct(group.pct, true)} each`);
  return {
    kicker: 'Chapter 7', title: 'The island bonus',
    lead: `PCs of similar strength working together earn a bonus on your island’s hash, up to ${pct(b.max_pct, true)}.`,
    stats: [['Combo', `up to ${pct(b.combo_cap_pct, true)}`, 'from matched PCs'], ['Island Level', `up to ${pct(b.level_cap_pct, true)}`, `with ${count(b.level_needs_matched)}+ matched PCs`, 'lilac'],
      ['Maximum', pct(b.max_pct, true), 'on your island’s hash', 'gold']],
    sections: [
      section('matched', 'Matched PCs', `${p(`A <strong>matched PC</strong> is a running PC that makes at least <strong>${hs(b.min_pc_hs)}</strong> healthy and at least <strong>${share(b.match_share_pct)}</strong> of your strongest running PC’s healthy H/s.`)}${p('Healthy H/s is a PC’s H/s after the efficiency multiplier but before heat and wear, so a hot or worn PC never drops in and out.')}${p(`Example: if your strongest PC is a ${e(best.name)} (${hs(best.hashrate)}), every other PC needs at least ${hs(need)}${yes ? `: a ${e(yes.name)} (${hs(yes.hashrate)}) matches` : ''}${no ? `, a ${e(no.name)} (${hs(no.hashrate)}) doesn’t` : ''}.`)}`),
      section('combo', 'The combo bonus', `${p(`Every matched PC after the first adds <strong>${pct(b.per_matched_pct, true)}</strong>. With all ${count(b.full_island_pcs)} matched you get <strong>${pct(b.full_island_pct, true)}</strong> more. The combo tops out at ${pct(b.combo_cap_pct, true)}.`)}${comboBars(b)}`),
      section('level', 'The Island Level bonus', `${p(`While at least <strong>${count(b.level_needs_matched)} matched PCs</strong> run, your Island Level adds its bonus: ${listText(levelParts)}, up to ${pct(b.level_cap_pct, true)}.`)}${table(['Island Level', 'Adds', 'Total'], b.levels.map(level => [`Level ${level.level}`, level.pct ? pct(level.pct, true) : '—', level.total_pct ? pct(level.total_pct, true) : '—']), {numeric: [1, 2]})}`),
      section('calculator', 'Bonus calculator', bonusCalculator(data)),
      section('how', 'How the bonus works', `${formula(['island hash = base hash × (1 + combo + Island Level bonus)'])}${p(`Your PCs still show their own H/s; your island’s total includes the bonus, and so does your reward share${data.rewards.claim.floor_hs > 0 ? ' and the claim floor' : ''} (see ${link('rewards', 'Rewards')}).`)}${note('info', 'The bonus shares, it doesn’t print', 'The daily rewards stay the same size. A bonus gives your island a bigger share of them.')}`),
      section('max', `Reaching the full ${pct(b.max_pct)}`, `${list([
        `<strong>Open all ${data.island.max_plots} desks.</strong> Island Level ${Math.max(...data.island.plots.map(plot => plot.island_level))} opens the last plots.`,
        `<strong>Run ${count(b.full_island_pcs)} matched PCs.</strong> Keep the weakest at least ${share(b.match_share_pct)} of the strongest.`,
        `<strong>Build enough power</strong> for all ${data.island.max_plots} desks.`,
        `<strong>Raise your Island Level to ${b.levels.at(-1).level}.</strong>`,
      ], true)}${note('tip', 'Your best next step', `In the game, tap the <strong>BOOST</strong> card at the top of the screen, the first of your resource cards. It shows your bonus out of the ${pct(b.max_pct)} maximum, your PCs and your Island Level, and the single most useful next step, with its gain, time and price and a button to where it is done.`)}`),
      section('example', `Worked example: ${count(b.full_island_pcs)} ${e(ex.card_name)}s`, `${p(`Here is the real game playing it out: a new island buys a ${e(ex.card_name)} (${usd(ex.card_price_usd)}, ${hs(ex.card_hashrate)}, ${watts(ex.card_watts)}) for each open desk once the completed power capacity admits it, keeps the builder queue full and builds power as the desks fill. Electricity and maintenance charges are excluded from this infrastructure example; energy is kept available.`)}${bonusTimeline(ex)}${p(`It reaches ${pct(ex.total_pct, true)} after ${since(ex.minutes)} of builder time, having spent ${usd(ex.spent_usd)} in total on PCs and builder jobs. The final Island Level ${b.levels.at(-1).level} is optional bonus; earlier Hall levels are needed for later plots or power.`)}`),
    ],
  };
}

function comboBars(b) {
  return `<ol class="docs-combo">${b.combo.map((row, index) => `<li style="--h:${(row.combo_pct / b.combo_cap_pct * 100).toFixed(1)}%;--i:${index}"><span class="docs-combo-bar"><i></i></span><strong>${row.combo_pct ? pct(row.combo_pct, true) : '0%'}</strong><span>${row.matched} PC${row.matched === 1 ? '' : 's'}</span></li>`).join('')}</ol>`;
}

function bonusCalculator(data) {
  const b = data.bonus;
  return `<div class="docs-widget docs-bonus" data-bonus-calc><div class="docs-calc-inputs"><label class="docs-range"><span>Matched PCs <output data-bonus-matched>2</output></span><input type="range" min="1" max="${data.island.max_plots}" value="2" data-bonus-input="matched" aria-label="Matched PCs"></label><label class="docs-range"><span>Island Level <output data-bonus-level>2</output></span><input type="range" min="1" max="${b.levels.at(-1).level}" value="2" data-bonus-input="level" aria-label="Island Level"></label></div><div class="docs-bonus-bars" aria-hidden="true"><span class="is-combo" data-bonus-bar="combo"></span><span class="is-level" data-bonus-bar="level"></span></div><dl class="docs-calc-out" data-bonus-out aria-live="polite"></dl></div>`;
}

function bonusTimeline(ex) {
  const card = e(ex.card_name);
  // A PC is bought only when the completed power capacity admits it (event.bought), so it mines at once:
  // nothing is delivered to wait for power. A new plot whose desk power cannot carry yet stays empty.
  const what = event => {
    if (!event.job) return `Buys a ${card} for desk 1: it mines at once`;
    const done = `${e(event.job.name)} is ready`;
    if (event.bought > 0) return `${done}: ${event.bought === 1 ? `a ${card} moves in` : `${event.bought} ${card}s move in`}`;
    if (event.job.kind === 'plot') return `${done}: its desk stays empty until there is power for another ${card}`;
    return done;
  };
  return `<ol class="docs-timeline">${ex.events.map((event, index) => `<li class="docs-tl is-${event.job?.kind ?? 'start'}" style="--i:${index}"><span class="docs-tl-time">${since(event.minute)}</span><span class="docs-tl-dot" aria-hidden="true"></span><div class="docs-tl-body"><p>${what(event)}</p><p class="docs-tl-meta">${plural(event.running, 'PC')} mining · ${event.matched} matched · Island Level ${event.island_level}</p></div><span class="docs-tl-bonus" style="--w:${(event.total_pct / ex.total_pct * 100).toFixed(1)}%"><i></i><strong>${event.total_pct ? pct(event.total_pct, true) : '0%'}</strong></span></li>`).join('')}</ol>`;
}

function rewardsChapter(data) {
  const r = data.rewards, claim = r.claim, split = r.split_pct;
  const ladder = ladderCards(data).filter(card => card.first_claim_hours), floor = claim.floor_hs > 0;
  const requirements = [claim.min_spend_usd > 0 ? `<strong>Your island has spent at least ${usd(claim.min_spend_usd)}</strong> in total. ${SPEND_COUNTS}` : '', floor ? `<strong>Your island’s average hash over the last ${claim.window_hours} hours is at least ${hs(claim.floor_hs)}.</strong>` : ''].filter(Boolean);
  return {
    kicker: 'Chapter 8', title: 'How rewards work',
    lead: 'Every minute, the day’s rewards are shared out by hash. The bigger your island’s share of all the hash, the more you earn.',
    stats: [['Into the pool', pct(split.pool), 'of every purchase'], ['Released daily', pct(r.daily_release_pct), 'of the pool', 'gold'],
      ['Invites', pct(r.referral_pct), 'of your friends’ rewards', 'lilac']],
    sections: [
      section('pool', 'Where rewards come from', `${flowDiagram(r)}${p(`Every purchase in the game (PCs, parts, electricity, care, builder jobs and cosmetics) is split three ways: <strong>${pct(split.pool)}</strong> goes into the reward pool, <strong>${pct(split.burn)}</strong> is burned for good and <strong>${pct(split.treasury)}</strong> goes to the treasury.`)}${p(`A purchase’s pool share counts from the <strong>next game day</strong>. A game day is ${r.day_hours} hours long and starts at the same time every day.`)}`),
      section('budget', 'The daily budget', `${p(`The initial reward pool is ${pct(r.initial_pool_pct)} of token supply. Each game day the pool releases <strong>${pct(r.daily_release_pct)}</strong> of what it holds, not counting rewards players have already earned. That day’s budget is paid out evenly, minute by minute.`)}${formula([`day budget = ${pct(r.daily_release_pct)} × pool`, 'minute budget = day budget ÷ 1,440'])}${p('If no PC is mining during a stretch, that stretch’s rewards simply stay in the pool.')}`),
      section('share', 'Your share', `${p('Each minute’s budget is split between all mining islands by hash, island bonus included:')}${formula(['your rewards = minute budget × your island’s hash ÷ all islands’ hash'])}<div class="docs-example"><p class="docs-example-title">Example with round numbers</p>${list([
        `The pool holds <strong>1,000,000</strong> tokens, so today’s budget is <strong>${grouped(1_000_000 * r.daily_release_pct / 100)}</strong>.`,
        `Your island has <strong>2%</strong> of all hash, all day: you earn <strong>${grouped(1_000_000 * r.daily_release_pct / 100 * 0.02)}</strong> tokens today.`,
        `Mine only half the day at that share and you earn <strong>${grouped(1_000_000 * r.daily_release_pct / 100 * 0.01)}</strong>.`,
      ])}</div>${note('info', 'Nothing is promised', 'Rewards depend on the pool and on everyone’s hash, so they change every day.')}`),
      section('claim', 'Claiming', `${requirements.length ? `${p('Rewards build up all the time. Claim them into your wallet once these requirements are met:')}${list(requirements, true)}${p('Until then your rewards keep building up and stay yours: nothing is lost.')}` : p('Rewards build up all the time. Claim them into your wallet whenever you like; there is no minimum spending or hashrate requirement.')}${p('One claim at a time: the game signs your claim, and your wallet sends it to the reward vault on Robinhood Chain, which pays the tokens into your wallet. You pay the small network fee.')}${floor && ladder.length ? `${p(`The ${claim.window_hours}-hour average counts the time before your first PC mined as 0 H/s, so a new island needs a little while before its first claim:`)}${table(['PC on its own', 'Hashrate', 'First claim after'], ladder.map(card => [pcName(card), hs(card.hashrate), duration(card.first_claim_hours * 60)]), {numeric: [1, 2]})}` : ''}`),
      section('invites', 'Invite friends', p(`Share your invite link. When a friend joins with it, you receive <strong>${pct(r.referral_pct)}</strong> of their rewards and they keep ${pct(100 - r.referral_pct)}. If you joined with someone’s link, the same applies to you. Mining and invite rewards add up to one total in Rewards &amp; Claim.`)),
      section('boards', 'Leaderboards', p(`Two boards rank every island that owns a PC: <strong>${e(r.boards[0])}</strong> (your island’s total hash, bonus included) and <strong>${e(r.boards[1])}</strong> (the tokens you have spent in total). Search by island or owner name, and visit any island to look around, read-only.`)),
      section('summary', 'In short', formula([
        `purchase → ${pct(split.pool)} pool (from the next day) · ${pct(split.burn)} burned · ${pct(split.treasury)} treasury`,
        `day → budget = ${pct(r.daily_release_pct)} × pool, paid out minute by minute`,
        'minute → your share = your island hash ÷ all island hash',
        'claim → '+([claim.min_spend_usd > 0 ? `spent ≥ ${usd(claim.min_spend_usd)}` : '', floor ? `${claim.window_hours} h average ≥ ${hs(claim.floor_hs)}` : ''].filter(Boolean).join(' and ') || 'any time, no minimum spending or hashrate requirement'),
        `invites → your friend’s rewards: ${pct(100 - r.referral_pct)} to them, ${pct(r.referral_pct)} to you`,
      ])),
    ],
  };
}

function flowDiagram(r) {
  const s = r.split_pct;
  return `<figure class="docs-figure"><svg class="docs-svg docs-flow" viewBox="0 0 640 230" role="img" aria-label="Every purchase: ${s.pool}% to the reward pool, ${s.burn}% burned, ${s.treasury}% to the treasury. The pool releases ${r.daily_release_pct}% a day to players by hash."><g class="docs-flow-box is-buy"><rect x="12" y="88" width="132" height="54" rx="3"/><text x="78" y="112" class="is-title">Purchase</text><text x="78" y="130" class="is-small">100%</text></g><path class="docs-flow-line is-pool" d="M144 115 C 190 115 190 115 236 115"/><path class="docs-flow-line is-burn" d="M144 108 C 190 108 196 40 236 40"/><path class="docs-flow-line is-treasury" d="M144 122 C 190 122 196 190 236 190"/><g class="docs-flow-box is-burn"><rect x="236" y="18" width="128" height="44" rx="3"/><text x="300" y="38" class="is-title">Burned</text><text x="300" y="54" class="is-small">${s.burn}% · gone for good</text></g><g class="docs-flow-box is-pool"><rect x="236" y="88" width="128" height="54" rx="3"/><text x="300" y="110" class="is-title">Reward pool</text><text x="300" y="128" class="is-small">${s.pool}% · from next day</text></g><g class="docs-flow-box is-treasury"><rect x="236" y="168" width="128" height="44" rx="3"/><text x="300" y="188" class="is-title">Treasury</text><text x="300" y="204" class="is-small">${s.treasury}%</text></g><path class="docs-flow-line is-release" d="M364 115 C 410 115 410 115 456 115"/><text x="410" y="104" class="is-small">${r.daily_release_pct}% a day</text><g class="docs-flow-box is-players"><rect x="456" y="70" width="170" height="90" rx="3"/><text x="541" y="98" class="is-title">Mining islands</text><text x="541" y="118" class="is-small">shared by hash,</text><text x="541" y="134" class="is-small">minute by minute</text></g></svg></figure>`;
}

function marketChapter(data) {
  const m = data.market, groups = Object.fromEntries(m.groups.map(group => [group.kind, group]));
  const priceRange = kinds => {const rows = kinds.map(kind => groups[kind]).filter(Boolean);if (!rows.length) return '';const lo = Math.min(...rows.map(row => row.min_usd)), hi = Math.max(...rows.map(row => row.max_usd));return lo === hi ? usd(lo) : `${usd(lo)}–${usd(hi)}`;};
  const skinSet = m.groups.find(group => group.kind === 'bundle');
  const style = m.style, decor = m.decor;
  const cosmeticRows = m.groups.filter(group => !['desk', 'monitor', 'keyboard', 'mouse', 'accessory'].includes(group.kind))
    .map(group => [e(group.label), grouped(group.count), group.min_usd === group.max_usd ? usd(group.min_usd) : `${usd(group.min_usd)}–${usd(group.max_usd)}`]);
  const deskRows = m.groups.filter(group => ['desk', 'monitor', 'keyboard', 'mouse', 'accessory'].includes(group.kind))
    .map(group => [e(group.label), grouped(group.count), group.min_usd === group.max_usd ? usd(group.min_usd) : `${usd(group.min_usd)}–${usd(group.max_usd)}`]);
  return {
    kicker: 'Chapter 9', title: 'Market, inventory and style',
    lead: 'Buy parts and complete PCs in the Market, keep everything in your inventory, and make the island yours.',
    stats: [['Prices', 'US dollars', 'paid in tokens'], ['Per purchase', `up to ${data.parts.max_quantity}`, 'of one part', 'gold'],
      ['Moving a PC', 'Free', 'to any empty desk', 'lilac']],
    sections: [
      section('market', 'The Market', `${p('The Market (the SHOP on your island) sells parts, complete PCs, desk items, hardware skins and island cosmetics. Prices are in US dollars and paid in tokens; the game shows the exact amount before you confirm.')}${list([
        `Buy up to ${data.parts.max_quantity} of a part at once.`,
        'Parts and cosmetics go to your inventory. Buy prepaid paste doses for the chosen component from its care card. A ready PC goes straight onto the desk you choose, and energy into your stock.',
        'Sort by price, by name or by efficiency (H/s per W).',
      ])}`),
      section('ready', 'Complete PCs', p(`After your first PC, the ready PC cards remain in the Market, subject to their Hall and power requirements. Set one up on an empty desk, or replace a PC: the old PC’s parts go to your inventory. Each one includes ${data.start.energy_hours} hours of its own electricity. ${listText(cardsOf(data).filter(card => card.limit).map(card => `${e(card.name)}: ${count(card.limit)} per island`))}. A replaced sealed PC stays whole in inventory; its parts cannot be extracted.`)),
      section('inventory', 'Inventory and Build', p('Your inventory (STORAGE) holds every part you own that isn’t installed, plus thermal paste and cosmetics. Open <strong>Build</strong> on a desk to install parts: your changes stay a draft until you press Save &amp; Exit, and every part is checked as you go. If your inventory holds everything for a working PC, the game tells you.')),
      section('skins', 'Hardware skins', `${p(`Skins dress your parts: case wraps, GPU skins, cooler caps and fan sets (${priceRange(['skin_case', 'skin_gpu', 'skin_cooler', 'skin_fans'])}), or a full set of all four${skinSet ? ` from ${usd(skinSet.min_usd)}` : ''}. A PC wears one skin of each kind. It shows on any PC that has the part it dresses (a sealed PC like the Mack mini shows none) and stays on when you swap that part. You can own up to ${m.skins.owned} of each skin.`)}${p('Skins are cosmetic only: 0 H/s and 0 W.')}`),
      section('cosmetics', 'Island cosmetics', `${p(`<strong>Decorate</strong> places decor on lit spots around the island: ${decor.ground_spots} spots on the grounds and ${decor.deck_spots} on every open plot’s deck. Floor decor comes in sizes S, M and L and fits a spot of its size or bigger; rugs have spots of their own. Buy up to ${decor.per_buy} at a time.`)}${p(`<strong>Island Style</strong> adds one island theme, up to ${count(style.night_slots)} night-light packs (each in ${count(style.night_variants)} colour moods), a centerpiece for your island’s fountain, up to ${count(style.pet_slots)} pets you can name and an outfit for your builder. Your builder’s hat and overall colours are free (${style.builder_swatches} colours).`)}${p('Both open from your profile (your name at the top of the screen), under <strong>Your island</strong>. Items you buy also have their own buttons in your inventory: <strong>Place on island</strong> for decor and <strong>Use on island</strong> for style items.')}${table(['Cosmetic', 'Items', 'Price'], cosmeticRows, {numeric: [1, 2]})}${table(['Desk items', 'Items', 'Price'], deskRows, {numeric: [1, 2]})}`),
      section('free', 'Free customization', list([
        'RGB lighting for the whole PC.',
        'Your own wallpaper on monitors and on the case glass.',
        'Photos on cooler screens.',
        'Swap desk accessories any time; the default plant always comes back.',
        `Your island’s name (up to ${data.island.name_length} characters) and sign (up to ${data.island.sign_length}).`,
      ])),
      section('move', 'Move a PC', `${p('Move any PC to an empty desk for free. Its parts, skins, power switch and auto-paste settings move together. Desk items stay with their desks.')}${p(`Every desk shares the same grid. Moving a PC preserves its reserved watts and does not free power capacity (${link('power', 'Power')}).`)}`),
      section('share', 'Share card', `${p('Open your profile (your name at the top of the screen) and press <strong>Share my island</strong>. The game draws a card from your live island (its name, owner, hash and a few stats, with your invite link) and opens X with a post ready to go.')}${p(`The post links to your island’s own page (<span class="docs-code">${e(m.share.link)}…</span>). Anyone with the link can look at your island, no wallet needed. It never shows your wallet or balances.`)}`),
    ],
  };
}

function questionsChapter(data) {
  const claim = data.rewards.claim, gate = claim.min_spend_usd > 0, pick = starterPick(data);
  const items = [
    ['Which PC should I start with?', `${pick ? `We suggest the ${usd(pick.price_usd)} <strong>${e(pick.name)}</strong>. ${starterPickText(data, pick)} ` : ''}Stronger cards make more H/s per watt, but require the Hall and power shown on their cards. ${link('', 'Getting started', 'choose')}`],
    ['Are prices in dollars or tokens?', `Every price in the game is set in US dollars: PCs, parts, electricity, care, builder jobs and cosmetics. You pay in tokens at the token price of the moment, and the game shows the exact token amount before you confirm. Builder jobs are also in dollars; they grow with your island’s hash record. ${link('island', 'Prices grow with your island', 'prices')}`],
    ['Do I need a power level for my first PC?', `Every PC, including your first, must fit the shared grid. You start with ${watts(data.power.levels[0].capacity_w)} and a ${hs(data.start.initial_hall_hash_cap)} healthy per-PC cap at Island Level 1. Stronger PCs need Island Level ${data.start.hash_unlock_level} and enough completed power. ${link('power', 'Power')}`],
    ['Why can’t I install this PC yet?', `Its healthy hash must fit your Hall access and the total installed watts must fit completed power capacity. Finish the upgrades shown on the card first. Moving it to desk 1 or switching another PC off does not bypass these checks. ${link('power', 'Power', 'sharing')}`],
    ['My PC makes less H/s than its card says. Why?', `Heat or wear. Check its temperature and care card: re-paste, clean the fans or repair worn parts. Heat and wear never take more than ${pct(100 - data.heat.floor_pct)}. ${link('heat-and-care', 'Heat &amp; care')}`],
    ['What happens when my energy runs out?', `All your PCs stop mining until you refill. Nothing breaks and nothing is lost, but no rewards build up while they are stopped. ${link('energy', 'Electricity &amp; energy')}`],
    ['Can I cancel a builder job?', 'No: queued jobs are paid when you queue them. You can change the order of waiting jobs any time.'],
    ['Why do builder jobs cost more on a bigger island?', `Every paid plot, power and Hall upgrade grows with the highest healthy base H/s ever installed on your island. Each level has its own base and rate. Its quote is locked when queued; switching PCs off never lowers the record. ${link('island', 'Prices grow with your island', 'prices')}`],
    ['Do I lose rewards if I can’t claim yet?', `No. Your rewards keep building up and stay yours until you claim them. ${link('rewards', 'Rewards', 'claim')}`],
    ['Does the island bonus create extra tokens?', 'No. The daily rewards stay the same size; the bonus gives your island a bigger share of them.'],
    [`How to get the ${pct(data.bonus.max_pct, true)} maximum multiplier?`, `Open all ${data.island.max_plots} desks, run ${count(data.bonus.full_island_pcs)} matched PCs and raise your Island Level to ${data.bonus.levels.at(-1).level}. ${link('island-bonus', 'Island bonus', 'max')}`],
    ['How long until my first claim?', claim.floor_hs > 0
      ? `Your island needs ${gate ? `${usd(claim.min_spend_usd)} of spending in total (any card of ${usd(claim.min_spend_usd)} or more covers it with its own purchase) and ` : ''}a ${claim.window_hours}-hour average of ${hs(claim.floor_hs)}. A stronger PC reaches that average faster. ${link('rewards', 'Rewards', 'claim')}`
      : gate ? `No waiting: as soon as your island has spent ${usd(claim.min_spend_usd)} in total, you can claim. Any card of ${usd(claim.min_spend_usd)} or more covers it with its own purchase. ${link('rewards', 'Rewards', 'claim')}` : `You can claim rewards as they build up. There is no minimum spending or hashrate requirement. ${link('rewards', 'Rewards', 'claim')}`],
    ['What is a game day?', `${data.rewards.day_hours} hours, starting at the same time every day. The daily budget is set at the start of each game day, and a purchase’s pool share counts from the next one.`],
    ['Can other players see my wallet?', 'No. Visits and your share page show your island, its name and its hash, never your wallet or balances.'],
  ];
  return {
    kicker: 'Chapter 10', title: 'Quick answers',
    lead: 'Short answers to the questions new players ask most. Tap a question to open it.',
    stats: [],
    // One answer open at a time, like the site's FAQ: the shared ``name`` closes the others (docs-widgets.mjs
    // does the same for browsers without exclusive <details>).
    sections: [section('answers', 'Common questions', `<div class="docs-faq" data-docs-faq>${items.map(([question, answer], index) => `<details class="docs-faq-item" name="docs-faq" style="--i:${index}"><summary><span class="docs-faq-num">${pad2(index + 1)}</span><span class="docs-faq-q">${question}</span><i class="docs-faq-toggle" aria-hidden="true"></i></summary><div class="docs-faq-answer"><p>${answer}</p></div></details>`).join('')}</div>`)],
  };
}

const CHAPTERS = {
  '': gettingStarted, island: yourIsland, power: powerChapter, energy: energyChapter, 'pc-building': buildingChapter,
  'heat-and-care': heatChapter, 'island-bonus': bonusChapter, rewards: rewardsChapter, market: marketChapter, questions: questionsChapter,
};

/** One chapter's content: dict(kicker, title, lead, stats, sections: [{id, title, html}]). */
export function chapter(slug, data) {
  const build = CHAPTERS[slug];
  return build ? build(data) : null;
}
export {stats as statTiles};
