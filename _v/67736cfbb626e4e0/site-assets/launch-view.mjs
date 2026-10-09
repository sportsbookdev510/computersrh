import {icon, escapeHtml as e, safeExternal} from './ui.mjs';

/* The two openings (Early Access, then everyone) shown on the homepage board and on Play.
 * Dates come from the site settings and live/next from the server's phase, never the visitor's clock. */

const UNITS = ['Days', 'Hours', 'Minutes', 'Seconds'];
const DEFAULT_ACCOUNT = 'https://x.com/computersrh';
// "4:00 PM" never breaks before AM/PM, whatever space the browser's Intl puts there.
const keepMeridiem = text => text.replace(/[  ](?=[AP]M\b)/g, ' ');

/** "Thu, Oct 8 · 4:00 PM UTC" plus the visitor's own time, or null for a missing or broken date. */
export function launchDate(iso) {
  const value = new Date(iso ?? '');
  if (!iso || !Number.isFinite(value.getTime())) return null;
  const day = new Intl.DateTimeFormat('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'}).format(value);
  const time = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC'}).format(value);
  const local = new Intl.DateTimeFormat('en-US', {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    hour12: true, timeZoneName: 'short'}).format(value);
  return {iso: value.toISOString(), utc: keepMeridiem(`${day} · ${time} UTC`), local: keepMeridiem(local)};
}

/** Each opening is ``live`` once the server says so (``opening`` while the owner has not opened the game yet),
 * the first closed one is ``next`` and the other ``later``. Applications have their own closing time. */
export function launchModel(state = {}) {
  const config = state.config || {}, phase = state.gate?.phase;
  const gamePreparing = config.game_launch_enabled === false;
  const milestones = [
    // The owner's announcement: the game and the token launch together for Early Access members, then everyone.
    {key: 'early', number: '01', title: 'Game launch', board: 'Game & token launch', who: 'Early Access members',
      at: config.early_access_at || null, open: phase === 'early_access' || phase === 'public'},
    {key: 'public', number: '02', title: 'Public launch', board: 'Public launch', who: 'Every wallet',
      at: config.public_access_at || null, open: phase === 'public'},
  ];
  const next = milestones.find(milestone => !milestone.open) || null;
  for (const milestone of milestones) milestone.state = milestone.open ? (gamePreparing ? 'opening' : 'live') : milestone === next ? 'next' : 'later';
  const account = safeExternal(config.social?.account_url) || DEFAULT_ACCOUNT;
  const handle = new URL(account).pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1] || 'computersrh';
  const xSession = state.xSession || {};
  return {milestones, next, phase, account, handle, gamePreparing,
    // The game is open to someone; until then the CA has not been posted.
    gameOpen: !gamePreparing && (phase === 'early_access' || phase === 'public'),
    applicationsOpen: config.applications_open === true, applicationsCloseAt: config.applications_close_at || null,
    listed: Boolean(xSession.authenticated && xSession.application && xSession.profile?.wallet)};
}

/** Four tiles that ``mountCountdown`` (countdown.mjs) fills in; dashes until it runs. */
export function launchTimer(deadline, {label = 'Time left', compact = false} = {}) {
  return `<div class="launch-timer${compact ? ' is-compact' : ''}" data-countdown data-deadline="${e(deadline || '')}" role="timer" aria-label="${e(label)}" aria-live="off">${UNITS.map((unit, index) => `<div><strong data-count="${index}">--</strong><span>${unit}</span></div>`).join('')}</div>`;
}

function dateLine(date, {local = true} = {}) {
  if (!date) return '<time>To be announced</time>';
  return `<time datetime="${e(date.iso)}">${e(date.utc)}</time>${local ? `<span>Your time · ${e(date.local)}</span>` : ''}`;
}

function liveBody(milestone, model) {
  if (milestone.state === 'opening') return '<div class="launch-live"><span class="launch-dot" aria-hidden="true"></span><strong>Opening soon</strong></div>';
  const enter = milestone.key === 'early' && model.phase === 'early_access'
    ? `<a class="button primary task-action launch-enter" href="/play?enter=1" data-route data-current="true"><span class="action-label">Enter Early Access</span>${icon('arrow')}</a>` : '';
  return `<div class="launch-live"><span class="launch-dot" aria-hidden="true"></span><strong>Live now</strong></div>${enter}`;
}

function launchCard(milestone, model) {
  const tag = {live: 'Open', opening: 'Opening', next: 'Up next', later: 'Then'}[milestone.state];
  const body = milestone.open ? liveBody(milestone, model) : launchTimer(milestone.at, {label: `Time until ${milestone.title}`});
  const listed = milestone.key === 'early' && model.listed ? `<p class="launch-listed">${icon('check')}<span>You're on the list</span></p>` : '';
  return `<article class="launch-card" data-state="${milestone.state}" data-milestone="${milestone.key}" aria-labelledby="launch-${milestone.key}-title"><header><span class="launch-number" aria-hidden="true">${milestone.number}</span><div><h3 id="launch-${milestone.key}-title">${milestone.title}</h3><p>${milestone.who}</p></div><span class="launch-tag">${tag}</span></header>${body}<p class="launch-date">${dateLine(launchDate(milestone.at))}</p>${listed}</article>`;
}

/** The token's contract address is posted only on X, at the Early Access opening (owner announcement). */
function caNotice(model) {
  const heading = model.gameOpen ? 'Find the token CA on our X account.' : `Token CA will be shared on ${caDate(model)} on X.`;
  return `<aside class="launch-ca" aria-label="Token contract address"><span class="launch-ca-badge" aria-hidden="true">CA</span><div class="launch-ca-copy"><strong>${e(heading)}</strong><p>The token launches with the game. Only on our X account; any other CA is fake.</p></div><a class="launch-x" href="${e(model.account)}" target="_blank" rel="noopener noreferrer">${icon('x')}<span>@${e(model.handle)}</span></a></aside>`;
}

/** While applications are open: their own countdown and the way in. They close by themselves at that time. */
function applyBar(model) {
  const date = launchDate(model.applicationsCloseAt);
  return `<section class="launch-apply" aria-labelledby="launch-apply-title"><div class="launch-apply-copy"><h3 id="launch-apply-title">Early Access applications close in</h3>${date ? `<p><time datetime="${e(date.iso)}">${e(date.utc)}</time></p>` : ''}</div>${launchTimer(model.applicationsCloseAt, {label: 'Time until applications close', compact: true})}<a class="button primary task-action launch-apply-cta" href="/early-access" data-route data-current="true"><span class="action-label">Join Early Access</span>${icon('arrow')}</a></section>`;
}

/** Play's waiting screen (also the closed Early Access page): both openings with their own countdown. */
export function launchPanel(state, {title = null, after = ''} = {}) {
  const model = launchModel(state);
  title ??= model.phase === 'public' ? (model.gamePreparing ? 'The island is opening.' : 'The island is open.')
    : model.phase === 'early_access' ? (model.gamePreparing ? 'Early Access is opening.' : 'Early Access is live.') : 'The island opens soon.';
  const opened = model.milestones.some(milestone => milestone.open);
  const how = model.gamePreparing && opened
    ? `<p class="launch-how">${icon('clock')}<span>Game access is being prepared. It opens right here.</span></p>`
    : `<p class="launch-how">${icon('wallet')}<span>${model.phase === 'early_access' ? 'Everyone else: at the public launch, connect' : 'When the island opens, connect'} your wallet here, create your player and start building.</span></p>`;
  const top = model.applicationsOpen ? '' : `<p class="launch-kicker">${icon('lock')}<span>Early Access applications are closed</span></p>`;
  return `<div class="launch-panel">${top}<h2 class="launch-title" id="launch-title">${e(title)}</h2>${model.applicationsOpen ? applyBar(model) : ''}<div class="launch-cards">${model.milestones.map(milestone => launchCard(milestone, model)).join('')}</div>${how}${caNotice(model)}${after}</div>`;
}

/** "Oct 8 · 4:00 PM UTC" for the board's CA line, or "at launch" before the dates load. */
function caDate(model) {
  return launchDate(model.milestones[0].at)?.utc.replace(/^[A-Z][a-z]{2}, /, '') ?? 'at launch';
}

/** The homepage board: a small desktop window counting down to the next opening. */
export function homeLaunch(state) {
  const model = launchModel(state), next = model.next;
  const heading = !next ? (model.gamePreparing ? 'The game is opening' : 'The game is live') : next.key === 'early' ? 'Game launch in' : 'Public launch in';
  const live = model.phase === 'early_access' ? `<p class="home-launch-live"><span class="launch-dot" aria-hidden="true"></span>${model.gamePreparing ? 'Game is opening' : 'Game is live · Early Access'}</p>` : '';
  const closing = launchDate(model.applicationsCloseAt);
  // While the form is open, its closing time leads the list; the word Applications links to the form.
  const apply = model.applicationsOpen && closing ? `<li data-state="apply"><span><a href="/early-access" data-route>Applications</a> close</span><time datetime="${e(closing.iso)}">${e(closing.utc)}</time></li>` : '';
  const rows = model.milestones.map(milestone => {
    const date = launchDate(milestone.at);
    return `<li data-state="${milestone.state}"><span>${e(milestone.board)}</span>${date ? `<time datetime="${e(date.iso)}">${e(date.utc)}</time>` : '<time>—</time>'}</li>`;
  }).join('');
  return `<aside class="home-launch" aria-labelledby="home-launch-title"><div class="home-launch-bar" aria-hidden="true"><i></i><i></i><i></i><span>Launch</span><b>RH</b></div><div class="home-launch-body">${live}<h2 id="home-launch-title">${heading}</h2>${next ? launchTimer(next.at, {label: heading}) : ''}<ol class="home-launch-dates">${apply}${rows}</ol><p class="home-launch-ca"><span>CA</span> ${model.gameOpen ? 'Official CA is posted on' : 'Official CA will be posted on'} <a href="${e(model.account)}" target="_blank" rel="noopener noreferrer">@${e(model.handle)}</a>${model.gameOpen ? '' : ' at launch'}</p></div></aside>`;
}
