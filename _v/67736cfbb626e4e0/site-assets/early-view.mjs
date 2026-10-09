import {welcomeComputer} from './welcome-computer.mjs';
import {desktopWindow} from './desktop-window.mjs';
import {accessView} from './access-view.mjs';
import {launchPanel} from './launch-view.mjs';
import {icon, escapeHtml as e, formatDate} from './ui.mjs';
import {JOURNEY_STEPS, nextIncompleteStep, stepIssue, continueHint, validateProof, walletIssue, socialTargets} from './journey.mjs';

const errorBox = state => state.error ? `<div class="feedback error" role="alert">${e(state.error)}</div>` : '';
const tick = done => done ? `<span class="action-tick" aria-hidden="true">${icon('check')}</span>` : '';
const current = active => `data-current="${Boolean(active)}"`;
function socialAction(href,label,action,journey) {
  const done=Boolean(journey.opened[action]);
  return href ? `<a class="button primary large-action task-action" href="${e(href)}" target="_blank" rel="noopener noreferrer" data-social="${action}" data-done="${done}" ${current(!done)} aria-label="${e(label)}${done?', opened, not verified':''}">${icon(['post','like'].includes(action)?'x':'external')} <span class="action-label">${label}</span>${tick(done)}</a>` : `<button class="button secondary large-action" type="button" disabled>${label} ${icon('lock')}</button>`;
}
export function progressView(state,index=state.step===3?6:state.step===1?0:state.journey.index) {
  const available=state.session.profile ? nextIncompleteStep(state.draft,state.session.profile,state.journey,state.config) : 0;
  const complete=i=>index===6||(i<5&&i<available);
  const count=JOURNEY_STEPS.filter((_,i)=>complete(i+1)).length;
  return `<nav class="journey-progress" aria-label="Application steps"><ol>${JOURNEY_STEPS.map((label,n)=>{const i=n+1,done=complete(i);return `<li class="${index===i?'is-current ':''}${done?'is-done':''}"><button type="button" data-action="journey-step" data-step="${i}" ${index===i?'aria-current="step"':''} ${i>available||index===6||state.busy?'disabled':''}><span class="step-circle">${done?icon('check'):i}</span><span>${label}</span></button></li>`;}).join('')}</ol><div class="journey-meter"><div role="progressbar" aria-label="Application progress" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${count}"><i style="width:${count*20}%"></i></div><span>${count*20}%</span></div></nav>`;
}
function profileBadge(user) {
  const avatar=user.avatar_url?.startsWith('/api/early-access/x/avatar') ? `<img src="${e(user.avatar_url)}" alt="" width="44" height="44">` : `<span aria-hidden="true">${e(user.display_name?.slice(0,1)||'X')}</span>`;
  return `<div class="x-profile"><div class="profile-avatar">${avatar}</div><div><strong>${e(user.display_name)}</strong><p>@${e(user.handle)}</p></div><button class="text-button" type="button" data-action="disconnect-x">Switch account</button></div>`;
}
function invitation(state) {
  const {user,profile}=state.session;
  const joined=user.joined_at?new Date(user.joined_at):null;
  const date=joined&&Number.isFinite(joined.getTime())?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(joined):'';
  return `<div class="invitation-preview"><canvas id="invite-card" width="1536" height="1024" role="img" aria-label="Computers RH Early Access card for ${e(user.display_name)}${user.card_number?`, ID #${String(user.card_number).padStart(4,'0')}`:''}${date?`, joined ${e(date)}`:''}"></canvas><p class="card-status task-note" role="status"></p></div><p class="mobile-card-meta"><strong>${user.card_number?`ID #${String(user.card_number).padStart(4,'0')}`:''}</strong><span>${date?`Joined ${e(date)}`:''}</span></p>${user.referral_url?referral(user):profile?referral(profile):''}`;
}
function referral(profile) {
  const displayUrl=String(profile.referral_url).replace(/^https:\/\//,'');
  return `<div class="journey-referral"><label for="referral-link">Your referral link</label><div class="copy-field"><input id="referral-link" readonly value="${e(displayUrl)}"><button class="button primary" type="button" data-action="copy">Copy ${icon('copy')}</button></div></div>`;
}
function identity(state) {
  const {draft,session,busy}=state;
  const invitationNote=state.inviter&&!session.profile?`<div class="inviter-note">${icon('sparkle')} Invited by <strong>@${e(state.inviter)}</strong><button type="button" class="text-button" data-action="clear-invitation">Remove</button></div>`:'';
  if(!session.authenticated)return `<div class="identity-welcome"><h2 class="task-title">Your early start.</h2><button class="button primary large-action task-action" data-action="connect-x" ${current(true)} ${busy?'disabled':''}>${icon('x')} ${busy?'Opening X…':'Continue with X'} ${icon('arrow')}</button>${invitationNote}${errorBox(state)}</div>`;
  const walletProblem=walletIssue(draft.wallet),valid=!walletProblem,walletShown=Boolean(walletProblem&&draft.wallet?.trim());
  return `<form id="identity-form"><h2 class="task-title">Your game wallet.</h2><p class="task-description">Save the address you'll play with.</p>${profileBadge(session.user)}<label for="evm-wallet">EVM wallet address</label><div class="proof-input"><input id="evm-wallet" name="wallet" autocomplete="off" spellcheck="false" placeholder="0x…" pattern="\\s*0x[a-fA-F0-9]{40}\\s*" maxlength="64" value="${e(draft.wallet)}" ${current(!valid)} aria-describedby="wallet-help wallet-issue" ${walletShown?'aria-invalid="true"':''} required><span class="proof-tick" ${valid?'':'hidden'}>${icon('check')}</span></div><p class="proof-issue" id="wallet-issue" aria-live="polite" ${walletShown?'':'hidden'}>${walletShown?e(walletProblem):''}</p><p class="task-note" id="wallet-help">No connection needed here.</p>${invitationNote}${errorBox(state)}<div class="task-navigation identity-navigation"><button class="button primary task-action" data-wallet-continue type="submit" ${current(valid)} ${busy||!valid?'disabled':''}><span class="action-label">${busy?'Saving…':'Continue'}</span> ${icon('arrow')}</button></div></form>`;
}
function taskNavigation(state,index) {
  const ready=!stepIssue(index,state.draft,state.session.profile,state.journey,state.config);
  const hint=state.busy||ready?'':continueHint(index,state.draft,state.session.profile,state.journey,state.config);
  return `${errorBox(state)}<div class="task-navigation"><button class="task-back" type="button" data-action="journey-back" ${state.busy?'disabled':''}>${icon('back')} Back</button><button class="button primary task-action" data-continue type="submit" ${current(ready)} ${state.busy||!ready?'disabled':''}><span class="action-label">${state.busy?'Saving…':index===5?'Join Early Access':'Continue'}</span> ${icon('arrow')}</button></div><p class="continue-hint" id="continue-hint" aria-live="polite" ${hint?'':'hidden'}>${e(hint)}</p><p class="task-note self-report sr-only">X actions are self-reported.</p>`;
}
function proofField(state,key,label,opened) {
  if(!opened&&!state.draft[key])return '';
  const handle=state.session.user?.handle||state.session.profile.x_handle||state.session.profile.handle;
  const issue=validateProof(state.draft[key],handle,{otherUrl:key==='quote_url'?state.draft.reply_url:undefined,targetUrl:state.config.social.tweet_url});
  const valid=!issue;
  // An empty field is not an error yet; a pasted link that is rejected must say why.
  const shown=Boolean(issue&&state.draft[key]?.trim());
  return `<div class="proof-field"><label for="${key}">${label}</label><div class="proof-input"><input id="${key}" type="url" name="${key}" placeholder="https://x.com/${e(handle)}/status/…" maxlength="300" value="${e(state.draft[key])}" ${current(!valid)} aria-describedby="proof-help ${key}-issue" ${shown?'aria-invalid="true"':''} required><span class="proof-tick" ${valid?'':'hidden'} aria-label="Link format accepted">${icon('check')}</span></div><p class="proof-issue" id="${key}-issue" aria-live="polite" ${shown?'':'hidden'}>${shown?e(issue):''}</p><p class="sr-only" id="proof-help">Use a post from @${e(handle)}.</p></div>`;
}
function social(state,index) {
  const {config,session,draft,journey}=state, profile=session.profile;
  const targets=socialTargets(config,profile.referral_url);
  let content='';
  if(index===1) {
    content=`<h2 class="task-title">Meet ComputersRh</h2><p class="task-description">Follow us for updates.</p>${socialAction(targets.post,'Follow on X','post',journey)}`;
  }else if(index===2) {
    content=`<h2 class="task-title">Like our post</h2>${socialAction(targets.like,'Like on X','like',journey)}`;
  }else if(index===3) {
    content=`<h2 class="task-title">Reply to our post</h2><p class="task-description">Tag 2 friends.</p>${socialAction(targets.reply,'Reply on X','reply',journey)}${proofField(state,'reply_url','Your reply link',journey.opened.reply)}`;
  }else if(index===4) {
    content=`<h2 class="task-title">Share your card</h2><p class="task-description">Attach your card to your quote.</p><div class="share-actions"><button class="button ${journey.downloaded?'secondary':'primary'} large-action task-action" type="button" data-action="download" data-done="${journey.downloaded}" ${current(!journey.downloaded)}>${icon('download')} Download card${tick(journey.downloaded)}</button>${journey.downloaded?socialAction(targets.quote,'Quote on X','quote',journey):''}</div>${journey.downloaded?proofField(state,'quote_url','Your quote link',journey.opened.quote):''}`;
  }else {
    const rows=[['Your name',profile.display_name],['X account','@'+(profile.x_handle||profile.handle)],['Game wallet',profile.wallet],['Your invitation',profile.referrer?'From @'+profile.referrer:'Direct registration']];
    content=`<h2 class="task-title">Ready to join?</h2><dl class="journey-review">${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><button class="text-button edit-wallet" type="button" data-action="identity">Edit wallet</button><label class="checkbox-row task-confirm"><input type="checkbox" name="confirmed" ${current(!draft.confirmed)} ${draft.confirmed?'checked':''} required><span>I liked the post, tagged 2 friends, and shared my card.</span></label>`;
  }
  return `<form id="social-form" data-journey-index="${index}"><div class="task-content">${content}</div>${taskNavigation(state,index)}</form>`;
}
export function earlyView(state) {
  if(state.session.authenticated&&state.session.application&&state.session.profile?.wallet)return accessView({...state,xSession:state.session,session:state.walletSession||{authenticated:false}},{surface:'early'});
  const index=state.step===3?6:state.step===1?0:state.journey?.index||1;
  const signedIn=state.session.authenticated;
  const aside=signedIn?invitation(state):arrivalArt('Get in 24 hours before everyone else.');
  const right=`${index>0?progressView(state,index):''}${state.campaignNotice?`<p class="task-note" role="status">${e(state.campaignNotice)}</p>`:''}<div class="journey-task">${index===0?identity(state):social(state,index)}</div><p class="progress-save-status" role="status"></p>`;
  return desktopWindow(state,{index,aside,right,status:state.config.applications_close_at?`Applications close · ${formatDate(state.config.applications_close_at)}`:`Early Access · ${formatDate(state.config.early_access_at)}`});
}

function arrivalArt(caption) {
  return `${welcomeComputer()}<p class="card-caption">${e(caption)}</p>`;
}

/** Applications are closed: the same launch board as Play, plus a way for applicants to find their card. */
export function earlyClosedView(state) {
  const signedIn=state.xSession?.authenticated===true,handle=state.xSession?.user?.handle;
  const status=signedIn
    ? `<p class="launch-status">${icon('x')}<span>${handle?`@${e(handle)} is`:'This X account is'} not on the Early Access list. You can play from the public launch.</span></p><button class="text-button" type="button" data-action="disconnect-x" ${state.busy?'disabled':''}>Use another X account</button>`
    : `<button class="text-button" type="button" data-action="connect-x" ${state.busy?'disabled':''}>Applied? Check your application with X</button>`;
  const after=`${state.error?`<div class="feedback error" role="alert">${e(state.error)}</div>`:''}<div class="access-links launch-links">${status}<a data-route href="/play">${state.gate?.phase==='public'?'Play now':'Go to Play'} ${icon('arrow')}</a></div>`;
  return desktopWindow(state,{index:'closed',title:'Early Access',className:'launch-screen',right:launchPanel(state,{title:'Early Access is closed.',after}),status:'Applications closed'});
}
