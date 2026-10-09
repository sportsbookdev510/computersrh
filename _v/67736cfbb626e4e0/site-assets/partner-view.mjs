import {desktopWindow} from './desktop-window.mjs';
import {icon, escapeHtml as e} from './ui.mjs';
import {profileCard, factsView} from './collab-view.mjs';
import {NFT_FACTS, NFT_ALLOCATION, cooldownParts} from './collab-model.mjs';
import {FAQ_PATH} from './faq-view.mjs';

/* /collab: DAOs and communities apply with X; once approved they add wallets per group and tier. */

// Pastes go out 50 winners a request.
export const PARTNER_LIMITS = Object.freeze({projects: 400, about: 550, paste: 5000, batch: 50});
const OFFICIAL_X = 'https://x.com/computersrh';
// How approved communities run their raffle and hand out spots (owner, 2 October).
export const COLLAB_TEMPLATE = 'https://docs.google.com/document/d/14MRZM5BInOEFD86xtcqXvoJWn13kXJeSXESDHcVld7o/edit?tab=t.0';
const templateLink = () => `<a class="partner-template" href="${COLLAB_TEMPLATE}" target="_blank" rel="noopener noreferrer"><span class="partner-template-icon">${icon('sparkle')}</span><span class="partner-template-text"><strong>Collab template</strong><small>Read this first: how to run your raffle and hand out your spots.</small></span><span class="partner-template-go">Open ${icon('external')}</span></a>`;
const number = value => new Intl.NumberFormat('en-US').format(Number.isSafeInteger(value) && value >= 0 ? value : 0);
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const errorBox = message => message ? `<div class="feedback error" role="alert">${e(message)}</div>` : '';
const WALLET = /^0x[0-9a-fA-F]{40}$/;
const WALLET_IN = /0x[0-9a-fA-F]{40}/;
// Discord names are written freely (spaces, dots, brackets, emoji), at most 64 characters (owner, 4 October).
export const cleanName = text => String(text || '').split(/\s+/).filter(Boolean).join(' ').replace(/^[,;\s]+|[,;\s]+$/g, '');
const nameOk = name => name.length > 0 && [...name].length <= 64 && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name);
/** Lines in requests of at most 50 lines and about 6 KB, within the website's 8 KB request limit. */
export function chunkLines(lines, size = 50, bytes = 6000) {
  const chunks = []; let chunk = [], used = 0;
  for (const line of lines) {
    const cost = new TextEncoder().encode(line).length + 1;
    if (chunk.length && (chunk.length >= size || used + cost > bytes)) { chunks.push(chunk); chunk = []; used = 0; }
    chunk.push(line); used += cost;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}
// One person a row: a Discord name box and a wallet box (owner, 2 October).
// One row for each spot left (50 spots, 50 rows); the list scrolls inside the panel.
export const fitRows = (rows, spots) => [...(rows || []).map(row => ({...row})), ...Array.from({length: Math.max(0, spots - (rows?.length || 0))}, () => ({discord: '', wallet: ''}))];
/** Rows to winners ("name wallet" lines); empty rows are skipped. Returns {lines, wrong} with the row numbers to fix. */
export function rowWinners(rows) {
  const seen = new Map(), wrong = [];
  rows.forEach((row, index) => {
    const name = cleanName(row.discord), wallet = String(row.wallet || '').trim(), key = wallet.toLowerCase();
    if (!name && !wallet) return;
    if (!nameOk(name) || !WALLET.test(wallet) || (seen.has(key) && seen.get(key)[0] !== name)) wrong.push(index + 1);
    else seen.set(key, [name, `${name} ${wallet}`]);
  });
  return {lines: [...seen.values()].map(([, line]) => line), wrong};
}
/** A list pasted into one box fills the rows from there down, up to `limit` rows; a line with a name and a wallet
    fills both boxes. */
export function pasteRows(rows, at, column, text, limit = PARTNER_LIMITS.paste) {
  const next = rows.map(row => ({...row}));
  String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, Math.max(0, limit - at)).forEach((line, offset) => {
    const wallet = line.match(WALLET_IN)?.[0], name = wallet ? cleanName(line.replace(wallet, ' ')) : '';
    const row = next[at + offset] ??= {discord: '', wallet: ''};
    if (wallet && name) Object.assign(row, {discord: name, wallet});
    else row[column] = line;
  });
  return next;
}
const POST_LINK = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/[0-9]{1,25}(?:[/?#]\S*)?$/i;
const GROUP_TAG = {cm: 'TEAM', dao: 'DAO'};

export const blankPartnerDraft = () => ({projects: '', post: '', postUrl: '', about: '', channel: 'x', discord: ''});
export const blankPartnerUi = () => ({group: null, tier: 'gtd', page: 1, list: null, loading: false, busy: false, adding: null, rows: [], confirmSubmit: false, raffles: {}, error: '', notice: ''});
export const URGENT_MS = 6 * 3600 * 1000;

/** Only redraw the page when something the applicant can see changed. */
export function partnerKey(partner) {
  if (!partner) return '';
  const {server_now: _, ...rest} = partner;
  return JSON.stringify(rest);
}

/** One DAO or project per line, spaces collapsed and repeats dropped: the list the server keeps. */
export function projectNames(text) {
  const names = [], seen = new Set();
  for (const line of String(text || '').split('\n')) {
    const name = line.split(/\s+/).filter(Boolean).join(' '), key = name.toLowerCase();
    if (name && !seen.has(key)) { seen.add(key); names.push(name); }
  }
  return names;
}

/** Same rules as the server, so mistakes show before sending. */
export function partnerDraftIssue(draft) {
  const names = projectNames(draft.projects);
  if (!names.length || names.join('\n').length > PARTNER_LIMITS.projects) return 'Enter at least one DAO or project name, in up to 400 characters.';
  if (!['yes', 'no'].includes(draft.post)) return 'Choose Yes or No: did you post about Computers RH on X?';
  if (draft.post === 'yes' && !POST_LINK.test(String(draft.postUrl || '').trim())) return 'Paste the link to your post on X, like https://x.com/yourname/status/123….';
  const about = String(draft.about || '').trim();
  if (!about || about.length > PARTNER_LIMITS.about) return 'Tell us about your project in up to 550 characters.';
  if (draft.channel === 'discord') {
    const name = String(draft.discord || '').trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.]{2,32}$/.test(name) || name.includes('..')) return 'Enter your Discord username: 2–32 letters, numbers, dots or underscores.';
  }
  return '';
}

export function partnerPayload(draft) {
  return {projects: draft.projects, posted: draft.post === 'yes', post_url: draft.post === 'yes' ? String(draft.postUrl || '').trim() : '',
    about: draft.about.trim(), channel: draft.channel, discord: draft.channel === 'discord' ? draft.discord.trim() : ''};
}

const fillOf = (group, tier) => count(group[`filled_${tier}`]);
const tiersOf = group => ['gtd', 'fcfs'].filter(tier => count(group[tier]) > 0);
const spotsText = group => tiersOf(group).map(tier => `${number(group[tier])} ${tier.toUpperCase()}`).join(' · ');
export function walletTotals(agreement) {
  const groups = agreement?.groups || [], sum = pick => groups.reduce((total, group) => total + pick(group), 0);
  return {filled: sum(group => fillOf(group, 'gtd') + fillOf(group, 'fcfs')), spots: sum(group => count(group.gtd) + count(group.fcfs))};
}

/** Steps done and current; declined or expired. */
export function partnerStage(partner) {
  const state = partner?.state;
  if (state === 'submitted') return {done: 3, current: 3, declined: false, expired: false};
  if (state === 'approved' || state === 'locked' || state === 'expired') return {done: 2, current: 3, declined: false, expired: state === 'expired'};
  if (state === 'pending' || state === 'declined') return {done: 1, current: 2, declined: state === 'declined', expired: false};
  return {done: 0, current: 1, declined: false, expired: false};
}

const PROGRESS = ['Apply', 'Review', 'Add wallets'];
/** The Early Access steps and meter (shown once a step is done; none when declined or expired). Once approved,
    the wallet row replaces the meter, under the steps so their button styles stay off it. */
function progressView(partner, row = '') {
  const {done, current, declined, expired} = partnerStage(partner), percent = Math.round(done / PROGRESS.length * 100);
  const steps = PROGRESS.map((label, index) => {
    const step = index + 1, refused = (declined && step === 2) || (expired && step === 3), finished = !refused && step <= done;
    const kind = refused ? 'is-declined' : finished ? 'is-done' : step === current ? 'is-current' : '';
    return `<li${kind ? ` class="${kind}"` : ''}${step === current && !finished ? ' aria-current="step"' : ''}><span class="journey-step"><span class="step-circle">${refused ? icon('close') : finished ? icon('check') : step}</span><span>${refused ? (expired ? 'Expired' : 'Not approved') : label}</span></span></li>`;
  }).join('');
  const meter = row || declined || expired || !done ? '' : `<div class="journey-meter"><div role="progressbar" aria-label="Collab progress" aria-valuemin="0" aria-valuemax="${PROGRESS.length}" aria-valuenow="${done}"><i style="width:${percent}%"></i></div><span>${percent}%</span></div>`;
  return `<div class="journey-progress partner-progress" role="group" aria-label="Collab steps"><ol>${steps}</ol>${meter}</div>${row}`;
}

function poolTile() {
  return `<section class="collab-supply is-compact partner-pool" aria-label="Collab GTD WL"><div class="collab-supply-head"><span class="collab-supply-label">Collab GTD WL</span><p class="collab-supply-count"><strong>${number(NFT_ALLOCATION.collabs)}</strong></p></div><span class="collab-supply-left">Set per DAO by our team</span></section>`;
}

const STEPS = [['Apply with X', 'Tell us about your community.'], ['Get approved', 'We set your spots per DAO.'], ['Add wallets', 'Submit them and your raffle link in 72 hours.']];
const steps = () => `<ol class="collab-steps partner-steps" aria-label="How it works">${STEPS.map(([title, text], index) =>
  `<li><span class="collab-step-number" aria-hidden="true">${index + 1}</span><div><strong>${title}</strong><small>${text}</small></div></li>`).join('')}</ol>`;

function intro(state) {
  return `<div class="collab-intro" data-partner-mode="signed-out"><h2 class="collab-intro-title">${icon('sparkle')}<span>Collab with us.</span></h2><p class="collab-intro-copy">Have a DAO, guild or community that belongs on the island? Apply with your X account and get WL spots for your members.</p>${steps()}<div class="collab-stats">${factsView()}${poolTile()}</div><button class="button primary large-action task-action collab-connect" type="button" data-action="connect-x" data-current="true" ${state.busy ? 'disabled' : ''}>${icon('x')} <span class="action-label">${state.busy ? 'Opening X…' : 'Continue with X'}</span> ${icon('arrow')}</button><p class="collab-intro-more"><a href="${FAQ_PATH}" data-route>Learn how the ${number(NFT_FACTS.supply)} NFT supply is allocated ${icon('arrow')}</a></p>${errorBox(state.error)}</div>`;
}

/** One wide window, like the signed-out page: the long answers get large boxes on the left; the short questions and the
    send button sit on the right, and the signed-in account beside the title. A "Yes" opens the post link field, as
    Discord opens its username field. */
function applyForm(state) {
  const draft = state.partnerDraft || blankPartnerDraft(), handle = state.partner.user?.handle || '';
  const discord = draft.channel === 'discord', posted = draft.post === 'yes';
  const radio = (name, value, label, checked) => `<label class="partner-option"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
  return `<form id="partner-form" class="partner-form" novalidate><div class="partner-form-head"><h2 class="task-title">Apply for a collab.</h2><p class="partner-account">Signed in as <strong>@${e(handle)}</strong> <button class="text-button" type="button" data-action="disconnect-x">Switch</button></p></div>
<div class="partner-form-grid"><div class="partner-form-main">
<label for="partner-projects">DAO / project names <small>One per line</small></label>
<textarea id="partner-projects" name="partner_projects" rows="4" maxlength="${PARTNER_LIMITS.projects}" placeholder="e.g. Nouns DAO or nouns.wtf">${e(draft.projects)}</textarea>
<div class="partner-label-row"><label for="partner-about">About your DAO / project</label><span class="partner-count" aria-live="off"><span data-partner-count>${number(draft.about.length)}</span> / ${PARTNER_LIMITS.about}</span></div>
<textarea id="partner-about" name="partner_about" rows="7" maxlength="${PARTNER_LIMITS.about}" placeholder="Your collab idea, average raffle entries, Alphabot or other links, and how many spots you’d like…">${e(draft.about)}</textarea>
</div><div class="partner-form-side">
<fieldset class="partner-choice"><legend>Did you post on X about us?</legend><div>${radio('partner_post', 'yes', 'Yes', posted)}${radio('partner_post', 'no', 'No', draft.post === 'no')}</div><div class="partner-post-link" data-partner-posted ${posted ? '' : 'hidden'}><label for="partner-post-url" class="sr-only">Link to your post on X</label><input id="partner-post-url" name="partner_post_url" type="url" inputmode="url" maxlength="300" autocomplete="off" spellcheck="false" placeholder="https://x.com/yourname/status/…" value="${e(draft.postUrl)}"></div></fieldset>
<fieldset class="partner-choice"><legend>Where can we reach you?</legend><div>${radio('partner_channel', 'x', 'X', !discord)}${radio('partner_channel', 'discord', 'Discord', discord)}</div><p class="partner-help" data-partner-channel="x" ${discord ? 'hidden' : ''}>We’ll message @${e(handle)} on X.</p><div class="partner-discord" data-partner-channel="discord" ${discord ? '' : 'hidden'}><label for="partner-discord" class="sr-only">Discord username</label><input id="partner-discord" name="partner_discord" maxlength="33" autocomplete="off" spellcheck="false" placeholder="Discord username" value="${e(draft.discord)}"></div></fieldset>
${errorBox(state.error)}
<div class="task-navigation collab-navigation"><button class="button primary task-action" type="submit" data-current="true" ${state.busy ? 'disabled' : ''}><span class="action-label">${state.busy ? 'Sending…' : 'Send application'}</span> ${icon('arrow')}</button></div>
</div></div></form>`;
}

/** Before approval the left column shows the collab pool, the NFT facts, what they applied for and who is signed in. */
function memberAside(partner) {
  const names = partner.application?.projects || [];
  const applied = names.length ? `<section class="partner-applied" aria-labelledby="partner-applied-title"><h3 id="partner-applied-title">Your DAOs / projects</h3><ul>${names.map(name => `<li>${e(name)}</li>`).join('')}</ul></section>` : '';
  return `<div class="partner-aside collab-hero"><p class="collab-kicker">${icon('sparkle')} Collab</p><h2 class="collab-title">${number(NFT_ALLOCATION.collabs)}<span>GTD WL</span></h2>${factsView()}${applied}${profileCard(partner.user)}</div>`;
}

function statusCard(mode, pill, title, text, extra = '') {
  return `<div class="partner-status" data-partner-mode="${mode}"><span class="partner-pill is-${mode}">${pill}</span><h2 class="task-title">${title}</h2><p class="task-description">${text}</p>${extra}</div>`;
}

/** Under review: we reply where they asked to be reached; following us lets our X message arrive. */
function pendingCard(partner) {
  const discord = partner.application?.channel === 'discord' ? partner.application.discord : '';
  const follow = discord ? '' : `<a class="button secondary partner-x" href="${OFFICIAL_X}" target="_blank" rel="noopener noreferrer">${icon('x')} Follow @computersrh ${icon('external')}</a>`;
  return statusCard('pending', 'Under review', 'Application received.',
    `Our team will review your request and message you ${discord ? `on Discord (@${e(discord)})` : 'on X'} if your collab is approved. Keep an eye on your DMs. Once approved, you have 72 hours to submit your wallets and raffle links.`, follow);
}

/** The group and tier shown, kept valid as spots change. */
export function partnerSelection(agreement, ui) {
  const groups = agreement?.groups || [];
  const group = groups.find(item => item.id === ui.group) || groups[0] || null;
  if (!group) return {group: null, tier: 'gtd'};
  const tiers = tiersOf(group);
  return {group, tier: tiers.includes(ui.tier) ? ui.tier : tiers[0] || 'gtd'};
}

function groupNav(agreement, selected) {
  return `<nav class="partner-groups" aria-label="Your groups">${agreement.groups.map(group => {
    const spots = count(group.gtd) + count(group.fcfs), filled = fillOf(group, 'gtd') + fillOf(group, 'fcfs');
    return `<button type="button" data-partner-group="${e(group.id)}" ${group.id === selected.id ? 'aria-current="true"' : ''}><span class="partner-group-icon" aria-hidden="true">${GROUP_TAG[group.kind] || 'DAO'}</span><span class="partner-group-text"><strong>${e(group.label || group.name)}</strong><small>${spotsText(group)}</small></span><span class="partner-group-fill${filled >= spots ? ' is-done' : ''}">${number(filled)}/${number(spots)}</span></button>`;
  }).join('')}</nav>`;
}

const shownList = (ui, group, tier) => ui.list && ui.list.group_id === group.id && ui.list.tier === tier ? ui.list : null;

/** The wallet panel shows either the saved list or the paste box. A tier without wallets opens on the paste box;
    otherwise the list shows until "Add wallets" is chosen. Locked and full tiers only list. */
export function partnerPanel(partner, ui) {
  const {group, tier} = partnerSelection(partner?.agreement, ui);
  if (!group || partner.state !== 'approved') return 'list';
  const filled = fillOf(group, tier);
  if (filled >= count(group[tier])) return 'list';
  return (ui.adding ?? filled === 0) ? 'add' : 'list';
}

/** The add view: one person a row, the Discord name and the wallet in their own boxes. */
function winnerRows(rows) {
  const items = rows.map((row, index) => `<li><span class="partner-slot">${index + 1}</span><input name="partner_row_discord" data-row="${index}" autocomplete="off" spellcheck="false" placeholder="discordname" aria-label="Discord name ${index + 1}" value="${e(row.discord)}"><input name="partner_row_wallet" data-row="${index}" autocomplete="off" spellcheck="false" placeholder="0x…" aria-label="Wallet ${index + 1}" value="${e(row.wallet)}"></li>`).join('');
  return `<div class="partner-row-labels" aria-hidden="true"><span></span><span>Discord name</span><span>Wallet</span></div><ol class="partner-rows">${items}</ol><p class="partner-row-tip">One person per row. Paste a list to fill the rows below.</p>`;
}

function walletRows(ui, list, tier, locked) {
  if (!list) return `<p class="partner-loading">${ui.error && !ui.loading ? '' : 'Loading wallets…'}</p>`;
  if (!list.items.length) return `<p class="partner-empty">No ${tier.toUpperCase()} wallets yet.</p>`;
  const rows = list.items.filter(item => WALLET.test(item.wallet)).map(item => `<li><span class="partner-slot">#${number(item.number)}</span>${item.discord ? `<span class="partner-who" title="${e(item.discord)}">${e(item.discord)}</span>` : '<span class="partner-who is-missing">No Discord name</span>'}<code title="${e(item.wallet)}">${e(item.wallet.slice(0, 8))}…${e(item.wallet.slice(-6))}</code>${locked ? '' : `<button type="button" data-partner-remove="${e(item.wallet)}" ${ui.busy ? 'disabled' : ''} aria-label="Remove ${e(item.wallet)}">Remove</button>`}</li>`).join('');
  return `<ol class="partner-wallets" aria-busy="${ui.loading}">${rows}</ol>`;
}

/** "8–14 of 20" and the arrows under the list; a fresh confirmation takes the range's place. */
function walletPager(ui, list, notice) {
  const range = notice ? `<span class="partner-notice" role="status">${notice}</span>`
    : list?.items.length ? `<span class="collab-range">${number(list.items[0].number)}–${number(list.items[list.items.length - 1].number)} of ${number(list.total)}</span>` : '';
  const arrows = list && list.pages > 1 ? `<div class="collab-pagination" role="group" aria-label="Wallet pages"><button type="button" data-partner-page="${list.page - 1}" aria-label="Previous wallets" ${ui.loading || list.page <= 1 ? 'disabled' : ''}>${icon('back')}</button><button type="button" data-partner-page="${list.page + 1}" aria-label="Next wallets" ${ui.loading || list.page >= list.pages ? 'disabled' : ''}>${icon('arrow')}</button></div>` : '';
  return `<div class="partner-pager">${range}${arrows}</div>`;
}

/** Time left with Submit, "submitted", or paused. */
export function walletRow(partner, ui) {
  const agreement = partner.agreement, {filled, spots} = walletTotals(agreement);
  const fill = `<span class="partner-deadline-fill">${number(filled)} / ${number(spots)} spots filled</span>`;
  if (partner.state === 'submitted') return `<div class="partner-deadline is-done" role="status">${icon('check')}<strong>Wallets submitted</strong>${fill}</div>`;
  if (partner.state === 'locked') return `<div class="partner-deadline is-paused">${icon('lock')}<span>Wallet collection is closed for now.</span>${fill}</div>`;
  const deadline = agreement?.deadline_at, left = Date.parse(deadline) - Date.parse(partner.server_now);
  if (!Number.isFinite(left)) return '';
  const [hours, minutes, seconds] = cooldownParts(left);
  const timer = `<span class="partner-deadline-time">${icon('clock')}<strong data-cooldown>${hours}:${minutes}:${seconds}</strong><span>left to submit</span></span>`;
  const shell = (kind, body) => `<div class="partner-deadline${kind}${left < URGENT_MS ? ' is-urgent' : ''}" id="partner-deadline" data-deadline="${e(deadline)}" role="timer">${timer}${body}</div>`;
  if (ui.confirmSubmit) return shell(' is-confirm', '');
  return shell('', `<button class="button primary partner-submit" type="button" data-partner-submit ${ui.busy || !filled ? 'disabled' : ''} ${filled ? '' : 'title="Add at least one wallet first"'}>${icon('check')} Submit wallets</button>`);
}

const walletsIn = group => fillOf(group, 'gtd') + fillOf(group, 'fcfs');
const raffleOf = (group, ui) => String(ui.raffles?.[group.id] ?? group.raffle_url ?? '');

/** Every DAO needs a raffle link or "none". */
export function raffleIssue(agreement, ui) {
  const missing = (agreement?.groups || []).find(group => group.kind === 'dao' && !raffleOf(group, ui).trim());
  return missing ? `Add the raffle link for ${missing.name}, or write none.` : '';
}
export function rafflePayload(agreement, ui) {
  return {raffles: (agreement?.groups || []).filter(group => group.kind === 'dao').map(group => ({group: group.id, url: raffleOf(group, ui).trim()}))};
}

/** The submit confirmation, in the wallet panel's place. */
export function submitPanel(agreement, ui) {
  const {filled, spots} = walletTotals(agreement), empty = Math.max(0, spots - filled);
  const rows = (agreement?.groups || []).filter(group => group.kind === 'dao').map(group => {
    const id = `partner-raffle-${e(group.id)}`;
    return `<li><label for="${id}"><span>${e(group.name)}</span><small>${number(walletsIn(group))} / ${number(count(group.gtd) + count(group.fcfs))} wallets</small></label><input id="${id}" name="partner_raffle" data-raffle-group="${e(group.id)}" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://www.alphabot.app/… or none" value="${e(raffleOf(group, ui))}"></li>`;
  }).join('');
  return `<div class="partner-panel partner-confirm" data-partner-view="confirm"><p class="partner-confirm-lead">Paste each DAO’s raffle link: your Alphabot raffle or your X post. No raffle? Write <strong>none</strong>.</p><ol class="partner-confirm-groups">${rows}</ol><p class="partner-confirm-note">${number(filled)} of ${number(spots)} spots have a wallet${empty ? `; ${number(empty)} stay empty` : ''}. Wallets and links can’t be changed after you submit.</p>${ui.error ? errorBox(ui.error) : ''}<div class="partner-panel-foot"><button class="text-button" type="button" data-partner-submit-cancel ${ui.busy ? 'disabled' : ''}>Cancel</button><button class="button primary task-action" type="button" data-partner-submit-confirm ${ui.busy ? 'disabled' : ''}><span class="action-label">${ui.busy ? 'Submitting…' : 'Submit wallets'}</span> ${icon('arrow')}</button></div></div>`;
}

function workspace(state) {
  const partner = state.partner, agreement = partner.agreement, ui = state.partnerUi || blankPartnerUi();
  const submitted = partner.state === 'submitted', locked = submitted || partner.state === 'locked', {group, tier} = partnerSelection(agreement, ui);
  const aside = groups => `<div class="partner-aside"><p class="collab-kicker">${icon('sparkle')} ${submitted ? 'Wallets submitted' : locked ? 'Collection closed' : 'Collab live'}</p>${templateLink()}<h2 class="partner-heading">Your groups</h2>${groups}${profileCard(partner.user)}<p class="partner-help">Questions? DM <a href="${OFFICIAL_X}" target="_blank" rel="noopener noreferrer">@computersrh</a> on X.</p></div>`;
  if (!group) return {aside: aside(''), right: `<div class="partner-workspace" data-partner-mode="${partner.state}"><h2 class="task-title">Your collab is approved.</h2><p class="task-description">Your groups are being prepared. Check back soon.</p></div>`};
  const list = shownList(ui, group, tier), filled = fillOf(group, tier), left = Math.max(0, count(group[tier]) - filled), name = tier.toUpperCase();
  const tabs = tiersOf(group).map(option => `<button type="button" data-partner-tier="${option}" aria-pressed="${option === tier}">${option.toUpperCase()} <small>${number(fillOf(group, option))} / ${number(group[option])}</small></button>`).join('');
  const notice = ui.notice ? `${icon('check')} ${e(ui.notice)}` : '';
  // One panel at one height holds the saved list or the paste box, so each gets the room and the window never jumps.
  const panel = partnerPanel(partner, ui) === 'add'
    ? `<div class="partner-panel partner-paste" data-partner-view="add"><div class="partner-paste-head"><span class="partner-paste-title">Add ${name} winners</span><span class="partner-left">${number(left)} ${name} ${left === 1 ? 'spot' : 'spots'} left</span></div>${winnerRows(fitRows(ui.rows, left))}${ui.error ? errorBox(ui.error) : ''}<div class="partner-panel-foot">${filled ? '<button class="text-button" type="button" data-partner-adding="false">Cancel</button>' : '<span></span>'}<button class="button primary task-action" type="button" data-partner-add ${ui.busy ? 'disabled' : ''}><span class="action-label">${ui.busy ? 'Saving…' : 'Add wallets'}</span> ${icon('arrow')}</button></div></div>`
    : `<div class="partner-panel" data-partner-view="list">${walletRows(ui, list, tier, locked)}${ui.error ? errorBox(ui.error) : ''}<div class="partner-panel-foot">${walletPager(ui, list, notice)}${submitted ? `<span class="partner-full">${icon('check')} Submitted. Your wallets are in.</span>` : locked ? `<span class="partner-locked">${icon('lock')} Collection closed. Your wallets are kept.</span>` : left ? `<button class="button secondary partner-open-add" type="button" data-partner-adding="true">+ Add wallets</button>` : `<span class="partner-full">${icon('check')} Every ${name} spot has a wallet.</span>`}</div></div>`;
  const confirming = ui.confirmSubmit && partner.state === 'approved';
  const title = confirming ? '<h2 class="task-title">Submit your wallets</h2>'
    : `<h2 class="task-title" title="${e(group.label || group.name)}">${e(group.label || group.name)}${group.kind === 'cm' ? ' <small>(team)</small>' : ''}</h2><div class="partner-tiers" role="group" aria-label="Spot type">${tabs}</div>`;
  const right = `<div class="partner-workspace" data-partner-mode="${confirming ? 'confirm' : partner.state}"><div class="partner-title-row">${title}</div>${confirming ? submitPanel(agreement, ui) : panel}</div>`;
  return {aside: aside(groupNav(agreement, group)), right};
}

export function partnerView(state) {
  const partner = state.partner, base = {index: 'partners', title: 'Collab', status: 'Computers RH'};
  if (!partner.authenticated || !partner.user) return desktopWindow(state, {...base, right: intro(state), className: 'collab-shell collab-intro-shell partner-shell'});
  const member = {...base, className: 'collab-shell collab-member partner-shell'};
  // The steps stay put above the content; each state's content slides in like the Early Access steps.
  const right = (mode, html, row = '') => `${progressView(partner, row)}<div class="journey-task partner-task" data-partner-mode="${mode}">${html}</div>`;
  if (['approved', 'locked', 'submitted'].includes(partner.state)) {
    const view = workspace(state);
    return desktopWindow(state, {...member, aside: view.aside, right: right(partner.state, view.right, walletRow(partner, state.partnerUi || blankPartnerUi()))});
  }
  const aside = memberAside(partner);
  if (partner.state === 'pending') return desktopWindow(state, {...member, aside, right: right('pending', pendingCard(partner))});
  if (partner.state === 'declined') return desktopWindow(state, {...member, aside, right: right('declined', statusCard('declined', 'Not approved', 'Not this time.', 'Thank you for applying. We can’t offer a collab right now.'))});
  if (partner.state === 'expired') return desktopWindow(state, {...member, aside, right: right('expired', statusCard('expired', 'Expired', 'Time ran out.',
    `Wallets had to be submitted within 72 hours of approval, so this collab expired. Questions? DM <a href="${OFFICIAL_X}" target="_blank" rel="noopener noreferrer">@computersrh</a> on X.`))});
  if (partner.applications_open === false) return desktopWindow(state, {...member, aside, right: right('closed', statusCard('closed', 'Closed', 'Applications are closed.', 'Please check back soon.'))});
  // Applying uses the whole window, so the answers get room; the steps stay on top.
  return desktopWindow(state, {...base, right: `<div class="partner-apply">${right('none', applyForm(state))}</div>`, className: 'collab-shell partner-shell partner-apply-shell'});
}

/**
 * Page behaviour: the form draft, group/tier selection, wallet pages and edits.
 * `mutate` serialises writes with the site's background refresh.
 */
export function mountPartnerPage({main, state, request, mutate, render, announce, active}) {
  state.partnerDraft = state.partnerDraft || blankPartnerDraft();
  state.partnerUi = state.partnerUi || blankPartnerUi();
  const ui = () => state.partnerUi;
  let loadToken = 0;

  function select(changes) {
    Object.assign(state.partnerUi, changes, {list: null, error: '', notice: ''});
    render();
  }
  async function loadWallets() {
    const agreement = state.partner?.agreement, {group, tier} = partnerSelection(agreement, ui());
    if (!group || !count(group[tier])) return;
    const token = ++loadToken;
    state.partnerUi.loading = true;
    try {
      const result = await request(`x/partner/wallets?${new URLSearchParams({group: String(group.id), tier, page: String(ui().page)})}`);
      if (token !== loadToken) return;
      Object.assign(state.partnerUi, {list: result, page: result.page, loading: false});
    } catch (error) {
      if (token !== loadToken) return;
      Object.assign(state.partnerUi, {loading: false, error: error.message});
    }
    if (active()) render();
  }
  /** One request or batches; on a refusal the box keeps what was not added. */
  async function write(path, payloads, done) {
    if (ui().busy) return;
    Object.assign(state.partnerUi, {busy: true, error: '', notice: ''});
    render();
    const batches = [].concat(payloads), total = {added: 0, already_listed: 0};
    let sent = 0;
    try {
      for (const payload of batches) {
        const result = await mutate(() => request(path, payload));
        state.partner = result.state; state.partnerSyncedAt = performance.now();
        Object.assign(state.partnerUi, {list: result.wallets, page: result.wallets.page});
        total.added += result.added || 0; total.already_listed += result.already_listed || 0; sent += 1;
      }
      done(total);
    } catch (error) {
      if (sent) state.partnerUi.rows = pasteRows([], 0, 'wallet', batches.slice(sent).map(payload => payload.wallets).join('\n'));
      state.partnerUi.error = sent ? `${number(total.added)} added. The rest are still in the box: ${error.message}` : error.message;
    } finally { state.partnerUi.busy = false; if (active()) render(); }
  }

  async function submitWallets() {
    if (ui().busy) return;
    Object.assign(state.partnerUi, {busy: true, error: '', notice: ''});
    render();
    try {
      state.partner = await mutate(() => request('x/partner/submit', rafflePayload(state.partner.agreement, ui())));
      state.partnerSyncedAt = performance.now();
      Object.assign(state.partnerUi, {confirmSubmit: false, adding: false, rows: [], list: null, raffles: {}});
      announce('Wallets submitted. Thank you!');
    } catch (error) { state.partnerUi.error = error.message; }
    finally { state.partnerUi.busy = false; if (active()) render(); }
  }

  /** The rows on screen, kept in the state from the first keystroke (a fresh panel draws blank rows). */
  function shownRows() {
    state.partnerUi.rows = fitRows(ui().rows, main.querySelectorAll('[name="partner_row_wallet"]').length);
    return state.partnerUi.rows;
  }
  main.addEventListener('paste', event => {
    const input = event.target, text = event.clipboardData?.getData('text') || '';
    if (!active() || !['partner_row_discord', 'partner_row_wallet'].includes(input.name)) return;
    const lines = text.trim().split(/\r?\n/), tokens = text.trim().split(/[\s,;]+/);
    if (lines.length < 2 && !(tokens.some(token => WALLET.test(token)) && tokens.some(token => !WALLET.test(token)))) return;
    event.preventDefault();
    const rows = shownRows(), at = Number(input.dataset.row), pasted = lines.filter(line => line.trim()).length, extra = pasted - (rows.length - at);
    state.partnerUi.rows = pasteRows(rows, at, input.name.slice(12), text, rows.length);
    state.partnerUi.error = extra > 0 ? `Only ${number(rows.length)} ${rows.length === 1 ? 'spot' : 'spots'} here: the last ${number(extra)} pasted ${extra === 1 ? 'line was' : 'lines were'} left out.` : '';
    render();
  });
  main.addEventListener('input', event => {
    const input = event.target;
    if (!active() || !input.name?.startsWith('partner_')) return;
    const draft = state.partnerDraft;
    if (input.name === 'partner_projects') draft.projects = input.value;
    if (input.name === 'partner_about') {
      draft.about = input.value;
      const counter = main.querySelector('[data-partner-count]'); if (counter) counter.textContent = new Intl.NumberFormat('en-US').format(input.value.length);
    }
    if (input.name === 'partner_discord') draft.discord = input.value;
    if (input.name === 'partner_post_url') draft.postUrl = input.value;
    if (input.name === 'partner_row_discord' || input.name === 'partner_row_wallet') shownRows()[Number(input.dataset.row)][input.name.slice(12)] = input.value;
    if (input.name === 'partner_raffle') state.partnerUi.raffles = {...state.partnerUi.raffles, [input.dataset.raffleGroup]: input.value};
    main.querySelectorAll('#partner-form .feedback[role="alert"]').forEach(node => node.remove());
    state.error = '';
  });
  main.addEventListener('change', event => {
    const input = event.target;
    if (!active() || input.type !== 'radio') return;
    if (input.name === 'partner_post') {
      state.partnerDraft.post = input.value;
      main.querySelectorAll('[data-partner-posted]').forEach(node => { node.hidden = input.value !== 'yes'; });
      if (input.value === 'yes') main.querySelector('#partner-post-url')?.focus();
    }
    if (input.name === 'partner_channel') {
      state.partnerDraft.channel = input.value;
      main.querySelectorAll('[data-partner-channel]').forEach(node => { node.hidden = node.dataset.partnerChannel !== input.value; });
      if (input.value === 'discord') main.querySelector('#partner-discord')?.focus();
    }
  });
  main.addEventListener('submit', async event => {
    if (!active() || event.target.id !== 'partner-form' || state.busy) return;
    const issue = partnerDraftIssue(state.partnerDraft);
    if (issue) { state.error = issue; render(); announce(issue); return; }
    state.busy = true; state.error = ''; render();
    try {
      state.partner = await mutate(() => request('x/partner/apply', partnerPayload(state.partnerDraft)));
      state.partnerDraft = blankPartnerDraft();
      announce('Application sent. We will review it soon.');
    } catch (error) { state.error = error.message; }
    finally { state.busy = false; render(); }
  });
  main.addEventListener('click', event => {
    if (!active()) return;
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const {group, tier} = partnerSelection(state.partner?.agreement, ui());
    if (button.hasAttribute('data-partner-submit')) { Object.assign(state.partnerUi, {confirmSubmit: true, error: '', notice: ''}); render(); (main.querySelector('[data-raffle-group]') || main.querySelector('[data-partner-submit-confirm]'))?.focus(); return; }
    if (button.hasAttribute('data-partner-submit-cancel')) { Object.assign(state.partnerUi, {confirmSubmit: false, error: ''}); render(); return; }
    if (button.hasAttribute('data-partner-submit-confirm')) {
      const issue = raffleIssue(state.partner?.agreement, ui());
      if (issue) {
        state.partnerUi.error = issue; render(); announce(issue);
        const missing = [...main.querySelectorAll('[data-raffle-group]')].find(input => !input.value.trim());
        (missing || main.querySelector('[data-raffle-group]'))?.focus();
        return;
      }
      void submitWallets(); return;
    }
    if (button.dataset.partnerGroup) { select({group: Number(button.dataset.partnerGroup), page: 1, rows: [], adding: null}); return; }
    if (button.dataset.partnerTier) { select({tier: button.dataset.partnerTier, page: 1, rows: [], adding: null}); return; }
    if (button.dataset.partnerPage) { select({page: Math.max(1, Number(button.dataset.partnerPage))}); return; }
    if (button.dataset.partnerAdding) {
      Object.assign(state.partnerUi, {adding: button.dataset.partnerAdding === 'true', error: '', notice: ''});
      render();
      if (state.partnerUi.adding) main.querySelector('[name="partner_row_discord"]')?.focus();
      return;
    }
    if (!group) return;
    if (button.hasAttribute('data-partner-add')) {
      const {lines: tokens, wrong} = rowWinners(shownRows());
      if (!tokens.length && !wrong.length) { state.partnerUi.error = 'Add at least one winner: a Discord name and a wallet.'; render(); return; }
      if (tokens.length > PARTNER_LIMITS.paste) { state.partnerUi.error = `Add at most ${PARTNER_LIMITS.paste} winners at a time.`; render(); return; }
      if (wrong.length) { state.partnerUi.error = `Each row needs a Discord name and a wallet (0x…): check row ${wrong.slice(0, 5).join(', ')}${wrong.length > 5 ? ` and ${wrong.length - 5} more` : ''}.`; render(); return; }
      const batches = [];
      for (const chunk of chunkLines(tokens, PARTNER_LIMITS.batch)) batches.push({group: group.id, tier, wallets: chunk.join('\n')});
      void write('x/partner/wallets', batches, result => {
        Object.assign(state.partnerUi, {rows: [], adding: false});
        state.partnerUi.notice = `${number(result.added)} ${tier.toUpperCase()} ${result.added === 1 ? 'wallet' : 'wallets'} added${result.already_listed ? ` · ${number(result.already_listed)} already listed` : ''}.`;
        announce(state.partnerUi.notice);
      });
      return;
    }
    if (button.dataset.partnerRemove) {
      const wallet = button.dataset.partnerRemove;
      void write('x/partner/wallet-remove', {group: group.id, tier, wallet, page: ui().page}, () => {
        state.partnerUi.notice = 'Wallet removed.'; announce('Wallet removed.');
      });
    }
  });

  return {
    /** After each render: fetch the shown wallet page once the list needs one (the paste box needs none). */
    afterRender() {
      if (!active()) return;
      const agreement = state.partner?.agreement;
      if (!agreement || !['approved', 'locked', 'submitted'].includes(state.partner.state)) return;
      const {group, tier} = partnerSelection(agreement, ui()), list = ui().list;
      state.partnerUi.group = group?.id ?? null; state.partnerUi.tier = tier;
      if (group && partnerPanel(state.partner, ui()) === 'list' && !ui().loading && !(list && list.group_id === group.id && list.tier === tier && list.page === ui().page) && !ui().error) void loadWallets();
    },
    reset() { state.partnerDraft = blankPartnerDraft(); state.partnerUi = blankPartnerUi(); loadToken += 1; },
  };
}
