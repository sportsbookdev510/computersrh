import {desktopWindow} from './desktop-window.mjs';
import {earlyView,earlyClosedView} from './early-view.mjs';
export {earlyView};
import {icon,escapeHtml as e,formatDate,shortWallet,safeExternal} from './ui.mjs';
import {homeLaunch,launchPanel} from './launch-view.mjs';

export function homeView(state={}){return `<section class="home" aria-labelledby="home-title"><div class="home-copy"><h1 id="home-title">Build your<br>dream PC.</h1><p>A PC-building play-to-earn game in development. Build and upgrade computers on your own pixel-art-style island.</p><div class="home-actions"><a class="button primary play-cta" href="/play" data-route>${icon('play','play-icon')}<span>Play</span>${icon('arrow')}</a></div><p class="home-chain">${icon('feather','chain-feather')}<span>Coming to Robinhood Chain mainnet.</span></p></div>${homeLaunch(state)}</section>`;}
export const backLink=()=>`<a class="back-link" data-route href="/">${icon('back')} Back to island</a>`;
const message=(text,kind='error')=>text?`<div class="message ${kind}" role="${kind==='error'?'alert':'status'}">${e(text)}</div>`:'';
export function loadingView(state={},title='Early Access',{heading='Finding your place…',text='Connecting to the island.'}={}){
  const right=`<div class="loading-content" role="status" aria-live="polite" aria-busy="true"><div class="loading-pixels" aria-hidden="true"><i></i><i></i><i></i></div><h2>${e(heading)}</h2><p>${e(text)}</p></div>`;
  return desktopWindow(state,{right,title,className:'loading-shell',status:'computersrh.xyz'});
}
export function errorView(error){return `<section class="page-shell"><div class="glass loading-panel">${icon('globe','large-icon')}<h1>A little interruption.</h1><p>${e(error)}</p><button class="button primary" data-action="retry">Try again ${icon('arrow')}</button></div>${backLink()}</section>`;}
export function playView(state) {
  const {session,gate} = state;
  if(state.config?.game_launch_enabled===false || gate.phase==='before_early' || (!state.enterGame&&gate.phase!=='public'))return launchView(state);
  if(session.authenticated && gate.reason==='claim_registration' && !(gate.phase==='public'&&state.skipRegistration))return claimView(state);
  if(gate.phase==='public' && session.authenticated && !session.profile)return gameProfileView(state);
  return gameEntryView(state);
}
function gameEntryView(state) {
  const {session,gate,config,busy,error}=state;
  const signed=session.authenticated;
  const title=!signed?'Enter the island.':gate.allowed?'Your desk is waiting.':'Your access opens soon.';
  const countdown=signed&&!gate.allowed&&gate.phase!=='public'?`<p class="access-opening">Public opening · ${formatDate(config.public_access_at)}</p><div class="countdown access-countdown" id="countdown" data-deadline="${e(gate.opens_at||config.public_access_at)}" role="timer" aria-live="off">${['Days','Hours','Minutes','Seconds'].map((label,i)=>`<div><strong data-count="${i}">--</strong><span>${label}</span></div>`).join('')}</div>`:'';
  const cta=!signed?`<button class="button primary large-action task-action" data-current="true" data-action="connect">Connect wallet ${icon('arrow')}</button>`:gate.allowed?`<button class="button primary large-action task-action" data-current="true" data-action="enter" ${busy?'disabled':''}>${busy?'Opening the island…':'Enter the island'} ${icon('arrow')}</button>`:'';
  const content=`<div class="access-panel"><h2 class="access-title">${title}</h2>${signed?`<div class="access-wallet"><span>Game wallet</span><strong title="${e(session.wallet)}">${e(shortWallet(session.wallet))}</strong><button class="text-button" data-action="disconnect">Disconnect</button></div>`:''}${countdown}${message(error)}${cta}</div>`;
  return desktopWindow(state,{title:'Play',index:'game-entry',right:content,status:'computersrh.xyz'});
}
export const closedView=earlyClosedView;
/** Play before the island opens for this visitor: both openings with their countdowns and the CA notice. */
export function launchView(state){
  return desktopWindow(state,{title:'Play',index:'launch',className:'launch-screen',right:launchPanel(state),status:'computersrh.xyz'});
}
export function soonView(){return `<section class="page-soon" aria-labelledby="page-soon-title"><h1 id="page-soon-title">Soon</h1></section>`;}

function gameProfileView(state){return desktopWindow(state,{title:"Create player",index:"player",className:"player-setup-window",right:`<div class="journey-task"><form id="game-profile-form"><h1 class="task-title">Make the island yours.</h1><p class="task-description">Choose your name for the game.</p><label for="game-name">Display name</label><input id="game-name" name="display_name" autocomplete="nickname" minlength="2" maxlength="32" required><label for="game-handle">Player handle</label><input id="game-handle" name="handle" pattern="[A-Za-z0-9_]{3,15}" minlength="3" maxlength="15" autocomplete="off" spellcheck="false" required><p class="task-note">${e(shortWallet(state.session.wallet))}</p>${message(state.error)}<div class="task-navigation"><button class="button primary wide" type="submit" ${state.busy?'disabled':''}>${state.busy?'Saving…':'Create player'} ${icon('arrow')}</button></div></form></div>`});}
function claimView(state){return desktopWindow(state,{title:"Play",index:"claim",className:"player-setup-window",right:`<div class="journey-task"><h2 class="task-title">Found your invitation.</h2><p class="task-description">Choose your Early Access registration for this wallet.</p>${(state.session.registration_candidates||[]).map(p=>`<div class="registration-choice" data-registration="${e(p.registration_id)}"><strong>${e(p.display_name)}</strong><p>@${e(p.x_handle||p.handle)}</p>${p.referrer?`<label class="checkbox-row"><input type="checkbox" name="accept_referrer" checked><span>Keep @${e(p.referrer)} as my inviter.</span></label>`:'<p class="task-note">Direct registration</p>'}<button class="button primary wide" data-action="claim" ${state.busy?'disabled':''}>Use this registration ${icon('arrow')}</button></div>`).join('')}${message(state.error)}<p class="task-note">${e(shortWallet(state.session.wallet))} · Wallet ownership confirmed</p>${state.gate.phase==='public'?'<button class="button secondary wide" data-action="skip-registration">Create my own player</button>':''}<button class="text-button" data-action="disconnect">Use another wallet</button></div>`});}
