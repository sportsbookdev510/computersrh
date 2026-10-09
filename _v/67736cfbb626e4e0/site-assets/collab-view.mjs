import {desktopWindow} from './desktop-window.mjs';
import {icon, escapeHtml as e, formatDate, safeExternal} from './ui.mjs';
import {validateProof, walletIssue} from './journey.mjs';
import {collabModel, supplyModel, NFT_FACTS, NFT_ALLOCATION} from './collab-model.mjs';
import {FAQ_PATH} from './faq-view.mjs';

const number = value => value.toLocaleString('en-US');
const errorBox = state => state.error ? `<div class="feedback error" role="alert">${e(state.error)}</div>` : '';
const current = active => `data-current="${Boolean(active)}"`;

/** The NFT these spots are for: supply, mint price and mint date, on both screens. */
export function factsView() {
  return `<dl class="nft-facts" aria-label="Computers RH NFT"><div><dt>NFT supply</dt><dd>${number(NFT_FACTS.supply)}</dd></div><div class="is-free"><dt>Mint price</dt><dd>${e(NFT_FACTS.mint)}</dd></div><div><dt>Mint date</dt><dd>${e(NFT_FACTS.mintDate)}</dd></div></dl>`;
}

/** The compact form is a tile beside the NFT facts; the full form heads the creator column. */
export function supplyView(collab, {compact = false} = {}) {
  const supply = supplyModel(collab), kind = compact ? 'collab-supply is-compact' : 'collab-supply';
  const label = `<span class="collab-supply-label">${compact ? 'GTD WL' : 'GTD WL awarded'}</span>`;
  if (!supply) return `<section class="${kind}" aria-label="GTD WL awarded"><div class="collab-supply-head">${label}<p class="collab-supply-count"><strong>—</strong></p></div></section>`;
  const count = `<p class="collab-supply-count"><strong>${number(supply.awarded)}</strong><span>/ ${number(supply.capacity)}</span></p>`;
  const left = `<span class="collab-supply-left">${supply.remaining ? `${number(supply.remaining)} spots left` : 'All spots awarded'}</span>`;
  const meter = `<div class="collab-meter" role="progressbar" aria-label="GTD WL awarded" aria-valuemin="0" aria-valuemax="${supply.capacity}" aria-valuenow="${supply.awarded}" aria-valuetext="${number(supply.awarded)} of ${number(supply.capacity)} spots awarded"><i style="width:${supply.percent}%"></i></div>`;
  return `<section class="${kind}" aria-label="GTD WL awarded"><div class="collab-supply-head">${label}${count}</div>${meter}${left}</section>`;
}

export function profileCard(user) {
  const avatar = user.avatar_url?.startsWith('/api/early-access/x/avatar')
    ? `<img src="${e(user.avatar_url)}" alt="" width="52" height="52">` : `<span aria-hidden="true">${e(user.display_name?.slice(0, 1) || 'X')}</span>`;
  return `<div class="collab-profile"><div class="profile-avatar">${avatar}</div><div class="collab-profile-name"><strong>${e(user.display_name)}</strong><span>@${e(user.handle)}</span></div><button class="collab-switch" type="button" data-action="disconnect-x" aria-label="Switch X account">Switch</button></div>`;
}

function hero(collab, history) {
  const capacity = supplyModel(collab)?.capacity || NFT_ALLOCATION.creators;
  return `<div class="collab-hero"><p class="collab-kicker">${icon('sparkle')} Computers RH NFT</p><h2 class="collab-title">${number(capacity)}<span>GTD WL</span></h2>${factsView()}${supplyView(collab)}${history}</div>`;
}

const STEPS = [
  ['Post on X', 'Create a post about Computers RH.'],
  ['Submit it here', 'Once every 12 hours.'],
  ['Earn GTD WL', 'Our team reviews every post.'],
];

/** Signed out: what creators earn and how, before anyone connects X. */
function intro(state) {
  const steps = STEPS.map(([title, text], index) => `<li><span class="collab-step-number" aria-hidden="true">${index + 1}</span><div><strong>${title}</strong><small>${text}</small></div></li>`).join('');
  return `<div class="collab-intro" data-collab-mode="signed-out"><h2 class="collab-intro-title">${icon('sparkle')}<span>Create. Earn WL.</span></h2><p class="collab-intro-copy">Create content about Computers RH on X and earn a GTD WL spot for the free mint.</p><ol class="collab-steps" aria-label="How it works">${steps}</ol><div class="collab-stats">${factsView()}${supplyView(state.collab, {compact: true})}</div><button class="button primary large-action task-action collab-connect" type="button" data-action="connect-x" ${current(true)} ${state.busy ? 'disabled' : ''}>${icon('x')} <span class="action-label">${state.busy ? 'Opening X…' : 'Continue with X'}</span> ${icon('arrow')}</button><p class="collab-intro-more"><a href="${FAQ_PATH}" data-route>Learn how the ${number(NFT_FACTS.supply)} NFT supply is allocated ${icon('arrow')}</a></p>${errorBox(state)}</div>`;
}

function compose(state, collab, model) {
  const handle = collab.user.handle, draft = state.collabDraft?.url || '';
  const issue = validateProof(draft, handle), valid = !issue, shown = Boolean(issue && draft.trim());
  const waiting = Boolean(model.nextAt), ready = valid && !waiting;
  const timer = waiting
    ? `<div class="collab-cooldown" id="collab-cooldown" data-deadline="${e(model.nextAt)}" role="timer" aria-live="off"><span>Next submission in</span><strong data-cooldown>--:--:--</strong></div>`
    : `<p class="collab-ready">${icon('check')} Ready for your next post</p>`;
  return `<form id="collab-form"><h2 class="task-title">Submit your post.</h2><p class="collab-compose-note">Share a post about Computers RH on X, then submit its link. You can submit once every 12 hours.</p>${profileCard(collab.user)}<label for="collab-url">Your X post link</label><div class="proof-input collab-link"><span class="collab-link-icon" aria-hidden="true">${icon('x')}</span><input id="collab-url" type="url" name="collab_url" placeholder="https://x.com/${e(handle)}/status/…" maxlength="300" value="${e(draft)}" autocomplete="off" spellcheck="false" ${current(!waiting && !valid)} aria-describedby="collab-url-issue" ${shown ? 'aria-invalid="true"' : ''} required><span class="proof-tick" ${valid ? '' : 'hidden'} aria-label="Link format accepted">${icon('check')}</span></div><p class="proof-issue" id="collab-url-issue" aria-live="polite" ${shown ? '' : 'hidden'}>${shown ? e(issue) : ''}</p>${timer}${errorBox(state)}<div class="task-navigation collab-navigation"><button class="button primary task-action" type="submit" data-collab-submit ${current(ready)} ${state.busy || !ready ? 'disabled' : ''}><span class="action-label">${state.busy ? 'Sending…' : 'Submit post'}</span> ${icon('arrow')}</button></div></form>`;
}

function closed(state, collab, model) {
  const capacity = supplyModel(collab)?.capacity || NFT_ALLOCATION.creators;
  const [title, text] = model.mode === 'full'
    ? ['All spots are awarded.', `All ${number(capacity)} GTD WL spots found their creators. Thank you!`]
    : ['Submissions are paused.', 'We are reviewing posts. Please check back soon.'];
  return `<h2 class="task-title">${title}</h2>${profileCard(collab.user)}<p class="task-description">${text}</p>${errorBox(state)}`;
}

function winner(state, collab, award) {
  return `<p class="collab-badge">${icon('sparkle')} GTD WL</p><h2 class="task-title collab-won">You won GTD WL!</h2>${profileCard(collab.user)}<div class="access-wallet collab-wallet"><span class="access-wallet-label">WL wallet</span><span class="access-wallet-address" title="${e(award.wallet)}">${e(award.wallet)}</span></div><p class="task-note">Your spot is saved to this wallet.</p>${errorBox(state)}`;
}

function claimWallet(state, collab) {
  const draft = state.collabDraft?.wallet || '', problem = walletIssue(draft), valid = !problem;
  const shown = Boolean(problem && draft.trim());
  return `<form id="collab-wallet-form"><p class="collab-badge">${icon('sparkle')} GTD WL</p><h2 class="task-title collab-won">You won GTD WL!</h2>${profileCard(collab.user)}<p class="task-description">Add the wallet for your spot.</p><label for="collab-wallet">EVM wallet address</label><div class="proof-input"><input id="collab-wallet" name="collab_wallet" autocomplete="off" spellcheck="false" placeholder="0x…" maxlength="64" value="${e(draft)}" ${current(!valid)} aria-describedby="collab-wallet-issue collab-wallet-help" ${shown ? 'aria-invalid="true"' : ''} required><span class="proof-tick" ${valid ? '' : 'hidden'}>${icon('check')}</span></div><p class="proof-issue" id="collab-wallet-issue" aria-live="polite" ${shown ? '' : 'hidden'}>${shown ? e(problem) : ''}</p><p class="task-note" id="collab-wallet-help">Double-check your address. It can only be saved once.</p>${errorBox(state)}<div class="task-navigation collab-navigation"><button class="button primary task-action" type="submit" data-collab-wallet ${current(valid)} ${state.busy || !valid ? 'disabled' : ''}><span class="action-label">${state.busy ? 'Saving…' : 'Save wallet'}</span> ${icon('arrow')}</button></div></form>`;
}

/** Newest first. Paged lists keep a five-row height so the window never jumps. */
export function historyView(history, {busy = false, error = ''} = {}) {
  if (!history) return '';
  const {total = 0, page = 1, page_size: size = 5, items = [], has_next: more = false} = history;
  const first = total ? (page - 1) * size + 1 : 0, last = Math.min(page * size, total), paged = total > size;
  const rows = items.map(item => {
    const href = safeExternal(item.url);
    return `<li><span class="collab-post-number">#${e(item.number)}</span><time datetime="${e(item.submitted_at)}">${e(formatDate(item.submitted_at))}</time>${href ? `<a href="${e(href)}" target="_blank" rel="noopener noreferrer" aria-label="View post ${e(item.number)} on X">View ${icon('external')}</a>` : '<span></span>'}</li>`;
  }).join('');
  const pages = paged ? `<div class="collab-pages"><span class="collab-range">${first}–${last} of ${number(total)}</span><div class="collab-pagination" role="group" aria-label="Submission pages"><button type="button" data-action="collab-page" data-page="${page - 1}" aria-label="Newer submissions" ${busy || page <= 1 ? 'disabled' : ''}>${icon('back')}</button><button type="button" data-action="collab-page" data-page="${page + 1}" aria-label="Older submissions" ${busy || !more ? 'disabled' : ''}>${icon('arrow')}</button></div></div>` : '';
  return `<section class="collab-history${paged ? ' is-paged' : ''}" aria-labelledby="collab-history-title" aria-busy="${busy}"><h3 id="collab-history-title">Your posts${total ? ` <span>${number(total)}</span>` : ''}</h3>${rows ? `<ol>${rows}</ol>` : '<p class="collab-empty">Your submitted posts will appear here.</p>'}${pages}${error ? `<p class="collab-history-error" role="status">${e(error)}</p>` : ''}</section>`;
}

export function collabView(state) {
  const collab = state.collab, model = collabModel(collab);
  if (model.mode === 'signed-out') {
    return desktopWindow(state, {index: 'collab', right: intro(state), title: 'Creators', status: 'Computers RH', className: 'collab-shell collab-intro-shell'});
  }
  const content = model.mode === 'compose' ? compose(state, collab, model)
    : model.mode === 'claim-wallet' ? claimWallet(state, collab)
    : model.mode === 'winner' ? winner(state, collab, model.award)
    : closed(state, collab, model);
  const right = `<div class="journey-task collab-task" data-collab-mode="${model.mode}">${content}</div>`;
  const history = historyView(model.history, {busy: state.collabBusy, error: state.collabError});
  return desktopWindow(state, {index: 'collab', aside: hero(collab, history), right, title: 'Creators', status: 'Computers RH · GTD WL', className: 'collab-shell collab-member'});
}
