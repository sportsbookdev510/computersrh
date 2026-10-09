import {icon, escapeHtml as e, formatDate, shortWallet} from './ui.mjs';
import {desktopWindow} from './desktop-window.mjs';
import {referralsView,referralLinkView} from './referrals-view.mjs';
import {accessModel} from './access-model.mjs';

function primaryAction(model) {
  if(model.gamePreparing)return '<p class="access-opening">Game access is being prepared.</p>';
  if(model.action!=='play')return '';
  return `<div class="access-primary"><a class="button primary task-action" href="/play?enter=1" data-route data-current="true"><span class="action-label">Play</span>${icon('arrow')}</a></div>`;
}

function savedCard(user,wallet) {
  return `<div class="access-invitation"><canvas id="invite-card" width="1536" height="1024" role="img" aria-label="Computers RH Early Access card for ${e(user.display_name)}"></canvas><div class="access-card-tools">${wallet}<button class="button primary access-card-download" type="button" data-action="download" aria-label="Download your card">${icon('download')}<span>Download</span></button></div><p class="card-status task-note" role="status"></p></div>`;
}

export function accessView(state,{surface='play'}={}) {
  const model=accessModel(state,{surface});
  const account=model.canSignOutX?`<div class="access-account"><button type="button" class="text-button access-signout" data-action="disconnect-x">${icon('x')}<span>Sign out of X</span></button></div>`:'';
  const wallet=model.wallet?`<div class="access-wallet"><span class="access-wallet-label">${e(model.walletLabel||'Registered wallet')}</span><span class="access-wallet-address" title="${e(model.wallet)}">${e(model.canSaveCard?model.wallet:shortWallet(model.wallet))}</span></div>`:'';
  const card=model.canSaveCard?`<div class="access-dashboard"><div class="access-card-column">${savedCard(state.xSession.user,wallet)}${referralLinkView(state.xSession.user.referral_url)}</div>${referralsView(state.xSession.referrals,{busy:state.referralsBusy,error:state.referralsError})}</div>`:wallet;
  const opening=model.opensAt?`<p class="access-opening"><span>${e(model.opensLabel||'Opens')}</span><time datetime="${e(model.opensAt)}">${e(formatDate(model.opensAt))}</time></p>`:'';
  const countdown=model.deadline?`<div class="countdown access-countdown" id="countdown" data-deadline="${e(model.deadline)}" role="timer" aria-label="Time until access opens" aria-live="off">${['Days','Hours','Minutes','Seconds'].map((label,index)=>`<div><strong data-count="${index}">--</strong><span>${label}</span></div>`).join('')}</div>`:'';
  const links=model.canApply?`<div class="access-apply"><p>Get in 24 hours before everyone else.</p><a class="button primary task-action" href="/early-access" data-route data-current="true"><span class="action-label">Join Early Access</span>${icon('arrow')}</a></div>`:'';
  const right=`<div class="access-panel${model.canSaveCard?' has-card':''}" data-membership="${e(model.membership)}">${account}<h2 class="access-title" id="access-title">${e(model.headline)}</h2>${card}<section class="access-launch" aria-label="${e(model.opensLabel)}">${opening}${countdown}${primaryAction(model)}</section>${state.error?`<div class="feedback error" role="alert">${e(state.error)}</div>`:''}${links}</div>`;
  return desktopWindow(state,{right,title:surface==='play'?'Play':'Early Access',status:'computersrh.xyz',className:model.canSaveCard?'access-card-screen':''});
}
