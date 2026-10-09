import {mountIslandBoot} from './island-boot.mjs';
const islandBoot=mountIslandBoot(document);
import {copyReferralWallet,referralsView} from './referrals-view.mjs';
import {request} from './api.mjs';
import {homeView,earlyView,playView,soonView,loadingView,errorView,closedView} from './views.mjs';
import {faqView,FAQ_PATH} from './faq-view.mjs';
import {icon,escapeHtml as e,announce} from './ui.mjs';
import {captureInvitation,clearInvitation,invitationDestination,playDestination,gameEntryOpen,isGamePage} from './referral.mjs';
import {createRefreshCoordinator,loadWebsiteSnapshot,snapshotKey,pollInterval,launchCritical,POLL_MS,KEEP,createRetry} from './sync.mjs';
import {subscribeSiteConfigChanges,publishSiteAuthChange,subscribeSiteAuthChanges} from './site-config-sync.mjs';
import {mountCountdown} from './countdown.mjs';
import {availableWallets,connectWallet,walletError} from './wallet.mjs';
import {blankJourney,stepIssue,continueHint,nextIncompleteStep,validateProof,walletIssue,canonicalPostUrl} from './journey.mjs';
import {progressView} from './early-view.mjs';
import {createJourneyStore,restoreJourneyState,reconcileJourneyRevision} from './journey-store.mjs';
import {consumeXCallback,completeXCallback,xAuthorizationUrl} from './x-auth.mjs';
import {readBackdrop,readSkyMotion} from './backdrop.mjs';
import {landingWeather} from './scene-policy.mjs';
import {invitationCard,retainInvitationAside,createInvitationPainter} from './invitation-cache.mjs';
import {collabView,supplyView,historyView} from './collab-view.mjs';
import {COLLAB_PATH,PARTNER_PATH,mountCooldown,cooldownParts,collabKey,collabModel} from './collab-model.mjs';
import {partnerView,partnerKey,mountPartnerPage} from './partner-view.mjs';

import {mountMusic} from './music.mjs';
import {DOCS_PUBLISHED,loadDocs} from './docs-switch.mjs';

mountMusic(document.querySelector('#site-music'));
// One music control (and media element) serves the whole visit. The guide's window has a place for it in its
// status bar (data-music-slot): render() moves it there after the guide renders and back to the page before
// anything replaces the window, within the same task, so playback, volume and focus carry on.
const siteMusic=document.querySelector('#site-music'),siteMusicHome=siteMusic?.nextElementSibling??null;
function placeMusic(slot){
  const parent=slot||document.body;
  if(!siteMusic||siteMusic.parentElement===parent)return;
  const focused=siteMusic.contains(document.activeElement)?document.activeElement:null;
  parent.insertBefore(siteMusic,slot?null:siteMusicHome);
  focused?.focus({preventScroll:true});
}

// The game guide (/docs): open when published, and as a private preview on a local host (docs-switch.mjs).
// While unpublished the public build ships no guide file and no loader, so it stays closed everywhere else.
const docsOpen=typeof loadDocs==='function'&&(DOCS_PUBLISHED||['127.0.0.1','localhost','[::1]'].includes(location.hostname));
const DOCS_ROUTE=/^\/docs(?:\/[a-z0-9-]+)?$/;
if(docsOpen){const faqLink=document.querySelector('.site-header nav [data-nav="faq"]');if(faqLink&&!document.querySelector('.site-header nav [data-nav="docs"]'))faqLink.insertAdjacentHTML('beforebegin','<a href="/docs" data-route data-nav="docs">Docs</a>');}
// Old address: /docs is the FAQ until the guide is open.
if(!docsOpen&&/^\/docs\/?$/.test(location.pathname))history.replaceState({},'',FAQ_PATH+location.search+location.hash);
const xCallback=consumeXCallback(location.href,url=>history.replaceState({},'',url));
// X returns to the page that started sign-in; keep that page's frame while it completes.
if(xCallback.kind==='code')document.querySelector('#main').innerHTML=loadingView({},/^\/creators\/?$/.test(location.pathname)?'Creators':/^\/collab\/?$/.test(location.pathname)?'Collab':'Early Access');
const xCallbackResult=await completeXCallback(xCallback,request);
// Other open tabs of the site skip identity reads while signed out; tell them to look again.
if(xCallbackResult.kind==='complete')publishSiteAuthChange();
const main=document.querySelector('#main');
let earlyBackdrop='corners',earlyMotion='animated';
function syncBackdropChoice(){
  earlyBackdrop=readBackdrop(location.search);
  earlyMotion=readSkyMotion(location.search);
  document.body.dataset.earlyBackdrop=earlyBackdrop;
  // Comparison options stay in local preview; public links have a clean URL.
  if (['computersrh.xyz','www.computersrh.xyz'].includes(location.hostname) && location.pathname==='/early-access') {
    const url=new URL(location.href);
    if(url.searchParams.has('backdrop')||url.searchParams.has('motion')){
      url.searchParams.delete('backdrop');url.searchParams.delete('motion');
      history.replaceState({},'',url.pathname+url.search+url.hash);
    }
  }
}
const blank=()=>({wallet:'',liked:false,confirmed:false,reply_url:'',quote_url:''});
// Collab page controller; mounted once render, request and the refresh coordinator exist.
let partnerPage=null;
const state={partner:null,collab:null,collabPage:1,collabBusy:false,collabError:'',collabDraft:{url:'',wallet:''},referralsPage:1,referralsBusy:false,referralsError:'',web3Enabled:false,config:null,gate:null,session:{authenticated:false},xSession:{authenticated:false},draft:blank(),journey:blankJourney(),step:1,busy:false,error:xCallbackResult.error||'',loadError:'',inviter:captureInvitation(location.href)};
const progressStore=createJourneyStore({save:async payload=>{await request('x/progress',payload);if(payload.x_id!==state.xSession.user?.id||payload.journey.social_revision!==state.journey.social_revision)return;state.progressError='';const node=main.querySelector('.progress-save-status');if(node)node.textContent='';},onError:error=>{state.progressError='Progress could not sync. Keep this page open and try Continue again.';const node=main.querySelector('.progress-save-status');if(node)node.textContent=state.progressError;if(error.status===409)void refresh({quiet:false});}});
const saveProgress=()=>{if(state.xSession.authenticated&&!state.xSession.application)progressStore.schedule(state.draft,state.journey);};
let stopCountdown=()=>{},stopCooldown=()=>{},stopDeadline=()=>{},cardModule=null,serverSyncedAt=0,collabSyncedAt=0,closureTimer,renderedStep=1;
const loadCardModule=async()=>cardModule||=(await import('./share-card.mjs'));
const invitationPainter=createInvitationPainter(loadCardModule);
const route=()=>location.pathname.replace(/\/$/,'')||'/';
state.docsOpen=docsOpen;
const docsRoute=()=>docsOpen&&DOCS_ROUTE.test(route());
// The guide's module loads on its first visit; a failed load waits for Try again instead of retrying by itself.
let docsModule=null,docsLoading=null,docsFailed=false,docsShown='';
function ensureDocs(){
  if(docsModule||docsLoading)return docsModule;
  docsLoading=loadDocs().then(async module=>{await module.prepare();docsModule=module;}).catch(()=>{docsFailed=true;}).finally(()=>{docsLoading=null;if(docsRoute())render();});
  return null;
}
/** Render the guide page for ``current``; true when the page already on screen was kept as it is. */
function renderDocsPage(current){
  if(docsFailed){main.innerHTML=errorView('The game guide could not load. Check your connection and try again.');docsShown='';return false;}
  const module=docsModule||ensureDocs();
  if(!module){if(!main.querySelector('.loading-shell'))main.innerHTML=loadingView(state,'Docs',{heading:'Opening the guide…',text:'Getting every page ready.'});docsShown='';return false;}
  if(docsShown===current&&main.querySelector('.docs-shell'))return true;
  const changed=Boolean(docsShown)&&docsShown!==current;
  main.innerHTML=module.docsView({...state,docsPublished:DOCS_PUBLISHED},current);
  docsShown=current;
  module.afterDocsRender(main,{pageChanged:changed});
  return false;
}
const serverNow=()=>new Date(Date.parse(state.gate.server_now)+Math.max(0,performance.now()-serverSyncedAt)).toISOString();
function setGate(gate){state.gate=gate;serverSyncedAt=performance.now();}
const collabNow=()=>new Date(Date.parse(state.collab.server_now)+Math.max(0,performance.now()-collabSyncedAt)).toISOString();
// The collab state is set here and by the page's own writes; each records when it arrived.
const partnerNow=()=>new Date(Date.parse(state.partner.server_now)+Math.max(0,performance.now()-(state.partnerSyncedAt??performance.now()))).toISOString();
function setCollab(collab){
  if(state.collab?.user?.id!==collab.user?.id)state.collabDraft={url:'',wallet:''};
  state.collab=collab;collabSyncedAt=performance.now();state.collabPage=collab.submissions?.page||1;state.collabBusy=false;state.collabError='';
}
function hydrate(session){if(state.session.wallet!==session.wallet)state.skipRegistration=false;state.session=session;}
function hydrateX(session,{saved=false}={}){
  progressStore.setIdentity(session.user?.id);
  const changed=state.xSession.user?.id!==session.user?.id;
  if(changed){state.referralsPage=session.referrals?.page||1;state.referralsBusy=false;state.referralsError='';const restored=restoreJourneyState(session.journey_state);state.draft={...blank(),...restored.draft};state.journey=restored.journey;state.progressError='';state.campaignNotice='';progressStore.setIdentity(session.user?.id);}
  const registrationChanged=state.xSession.profile?.registration_id!==session.profile?.registration_id;
  state.xSession=session;
  if(session.profile&&(changed||registrationChanged||saved))state.draft.wallet=session.profile.wallet;
  const revised=reconcileJourneyRevision(state.draft,state.journey,state.config?.social_revision,{submitted:Boolean(session.application)});
  if(revised.changed){const hadProgress=Object.values(state.journey.opened).some(Boolean)||Boolean(state.draft.reply_url||state.draft.quote_url||state.draft.confirmed);progressStore.invalidate();state.draft=revised.draft;state.journey=revised.journey;state.progressError='';state.campaignNotice=hadProgress?'The launch post changed. Please complete the new steps.':'';saveProgress();}
  if((changed||revised.changed)&&session.profile)state.journey.index=Math.min(state.journey.index,nextIncompleteStep(state.draft,session.profile,state.journey,state.config));
  if(session.application){progressStore.invalidate();state.progressError='';Object.assign(state.draft,{liked:true,confirmed:true,reply_url:session.application.reply_url,quote_url:session.application.quote_url});state.campaignNotice='';state.step=3;}
  else if(changed||state.step===3)state.step=session.profile?2:1;
}
function navigate(href,{replace=false}={}){
  const url=new URL(href,location.href);if(url.origin!==location.origin)return;
  history[replace?'replaceState':'pushState']({},'',url.pathname+url.search+url.hash);
  state.error='';state.loadError='';state.inviter=state.inviter||captureInvitation(location.href);render();window.scrollTo(0,0);main.focus({preventScroll:true});
  if(url.hash)requestAnimationFrame(()=>document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView());
  refresh({quiet:true,since:recent()});
}
// Page load, navigation, focus and visibility share a snapshot that started in the last 10 seconds.
const FRESH_MS=10000,recent=()=>performance.now()-FRESH_MS;
const currentCard=()=>invitationCard(state.xSession,state.config);
const cardOptions=()=>currentCard()?.options||{};
async function paintCard(){
  const canvas=main.querySelector('#invite-card'),card=currentCard();if(!canvas||!card)return;
  const current=()=>main.querySelector('#invite-card')===canvas&&currentCard()?.key===card.key;
  try{await invitationPainter(canvas,card,current);if(current()){const status=main.querySelector('.card-status');if(status)status.innerHTML=canvas.dataset.cardKey===card.key?'':'<button class="text-button" type="button" data-action="retry-card-photo">Retry profile photo</button>';}}
  catch(error){if(current()){const status=main.querySelector('.card-status');if(status)status.textContent='Your card could not load. Try again in a moment.';}}
}
function render(){
  placeMusic(null);
  if(/^\/(?:ref=|r\/)[A-Za-z0-9_]{3,15}\/?$/.test(route()) && !state.loadError){
    if(!state.gate){main.innerHTML=loadingView(state);return;}
    const target=invitationDestination(state.gate,state.inviter,{web3Enabled:state.web3Enabled&&state.config?.game_launch_enabled!==false,applicationsOpen:state.config?.applications_open===true});
    // The game page is its own document (/play/island), never a route of this app: load it.
    const targetPath=new URL(target,location.origin).pathname;
    if(isGamePage(targetPath)||targetPath.startsWith('/preview/')){main.innerHTML=loadingView(state,'Play');location.assign(target);return;}
    history.replaceState({},'',target);
  }
  const gameDestination=route()==='/play'?playDestination(state,{enterGame:new URLSearchParams(location.search).get('enter')==='1'}):null;
  if(gameDestination){
    main.innerHTML=loadingView(state,'Play');location.assign(gameDestination);return;
  }
  const previousAside=main.querySelector('.journey-aside'),previousWindow=main.querySelector('.desktop-window'),previousCard=main.querySelector('.access-invitation #invite-card');
  const focusWasInside=main.contains(document.activeElement);
  const current=route();stopCountdown();stopCooldown();stopDeadline();
  let docsKept=false;if(!docsRoute())docsShown='';
  const stepKey=current===COLLAB_PATH?'collab':current===PARTNER_PATH?`partner-${state.partner?.state||'out'}`:state.step===2?`social-${state.journey.index}`:state.step;
  const stepChanged=renderedStep!==stepKey;renderedStep=stepKey;
  // Until the admin launches it, /creators shows a plain "Soon" page.
  const collabSoon=current===COLLAB_PATH&&Boolean(state.collab)&&state.collab.launched!==true;
  const partnerSoon=current===PARTNER_PATH&&Boolean(state.partner)&&state.partner.launched!==true;
  document.body.dataset.page=collabSoon||partnerSoon?'soon':docsRoute()?'docs':current===PARTNER_PATH?'partners':current===FAQ_PATH?'faq':current==='/play'?'play':current==='/early-access'?'early':current===COLLAB_PATH?'collab':'home';
  syncBackdropChoice();
  syncBackdrop();
  document.querySelectorAll('[data-nav]').forEach(link=>{const active=link.dataset.nav===(docsRoute()?'docs':current===FAQ_PATH?'faq':current===COLLAB_PATH?'collab':current===PARTNER_PATH?'partners':current==='/'?'home':'');if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  document.title=current==='/'?'Computers RH | PC-building game on Robinhood Chain':docsRoute()?`${docsModule?.docsTitle(current)??'Docs'} — Computers RH`:`${current==='/play'?'Play':current==='/early-access'?'Early Access':current===COLLAB_PATH?'Creators':current===PARTNER_PATH?'Collab':current===FAQ_PATH?'FAQ':'Page'} — Computers RH`;
  if(current===FAQ_PATH)main.innerHTML=faqView(state);
  else if(docsRoute())docsKept=renderDocsPage(current);
  else if(current==='/')main.innerHTML=homeView(state);
  else if(state.loadError)main.innerHTML=errorView(state.loadError);
  // These page projections load on their first visit; keep progress visible.
  else if(current===COLLAB_PATH&&!state.collab)main.innerHTML=loadingView(state,'Creators');
  else if(current===PARTNER_PATH&&!state.partner)main.innerHTML=loadingView(state,'Collab');
  else if(!state.config||!state.gate)main.innerHTML=loadingView(state,current==='/play'?'Play':'Early Access');
  else if(collabSoon||partnerSoon)main.innerHTML=soonView();
  else if(current===PARTNER_PATH)main.innerHTML=partnerView(state);
  else if(current===COLLAB_PATH)main.innerHTML=collabView(state);
  else if(current==='/early-access'){
    main.innerHTML=!state.config.applications_open&&!state.xSession.application?closedView(state):earlyView({...state,session:state.xSession,walletSession:state.session});
  } else if(current==='/play')main.innerHTML=playView({...state,enterGame:new URLSearchParams(location.search).get('enter')==='1'});
  else main.innerHTML=errorView('This path isn’t on the map. Return to the island to begin.');
  // Every countdown on the page (Play and the homepage board show one per opening) runs on the server's clock.
  if(state.gate){
    const timers=[...document.querySelectorAll('#countdown,[data-countdown]')].map(countdown=>{const deadline=countdown.dataset.deadline||(countdown.id!=='countdown'?'':current==='/early-access'?state.config.public_access_at:state.gate.opens_at);return mountCountdown(countdown,{deadline,serverNow:serverNow(),onExpire:()=>spread(()=>refreshAfter(deadline))});});
    stopCountdown=()=>timers.forEach(stop=>stop());
  }
  const cooldown=main.querySelector('#collab-cooldown');
  if(cooldown&&state.collab)stopCooldown=mountCooldown(cooldown,{deadline:cooldown.dataset.deadline,serverNow:collabNow(),onExpire:()=>setTimeout(()=>refresh({quiet:false}),250)});
  // An approved collab counts down its 72 hours; at zero the page reloads and shows that it expired.
  const deadline=main.querySelector('#partner-deadline[data-deadline]');
  if(deadline&&state.partner)stopDeadline=mountCooldown(deadline,{deadline:deadline.dataset.deadline,serverNow:partnerNow(),label:(hours,minutes)=>`${hours} hours, ${minutes} minutes left to submit your wallets`,onExpire:()=>setTimeout(()=>refresh({quiet:false}),250)});
  retainInvitationAside(previousAside,main.querySelector('.journey-aside'),currentCard());
  if(previousCard?.dataset.cardKey===currentCard()?.key)main.querySelector('.access-invitation #invite-card')?.replaceWith(previousCard);
  void paintCard();
  partnerPage?.afterRender();
  const saveStatus=main.querySelector('.progress-save-status');if(saveStatus)saveStatus.textContent=state.progressError||'';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const desktop=main.querySelector('.desktop-window');
    const arrivedFromLoading=previousWindow?.closest('.loading-shell')&&!desktop?.closest('.loading-shell');
    if(desktop&&(!previousWindow||arrivedFromLoading))desktop.animate([{opacity:0,transform:'translateY(55px) scale(.87) rotateX(5deg)'},{opacity:1,transform:'translateY(0) scale(1) rotateX(0)'}],{duration:480,easing:'cubic-bezier(.16,1,.3,1)'});
    else if(desktop&&stepChanged)main.querySelector('.journey-task')?.animate([{opacity:0,transform:'translateX(12px)'},{opacity:1,transform:'translateX(0)'}],{duration:260,easing:'ease-out'});
  }
  // The guide focuses its chapter heading: it sits in the chapter pane, so the keyboard scrolls the chapter.
  if(focusWasInside&&!docsKept){const heading=main.querySelector('.journey-task h2,.docs-head h2')||main.querySelector('.form-pane h2, h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
  if(stepChanged&&current!==COLLAB_PATH&&!docsRoute()&&state.step!==1&&matchMedia('(max-width:760px)').matches)main.querySelector('.journey-right')?.scrollIntoView({block:'start',behavior:'instant'});
  placeMusic(main.querySelector('[data-music-slot]'));
}
function scheduleClosure(){
  clearTimeout(closureTimer);
  if(!state.config?.applications_open||!state.gate)return;
  const remaining=Date.parse(state.config.applications_close_at)-Date.parse(serverNow());
  closureTimer=setTimeout(()=>{
    if(Date.parse(serverNow())<Date.parse(state.config.applications_close_at)){scheduleClosure();return;}
    const closedAt=state.config.applications_close_at;
    state.config.applications_open=false;render();spread(()=>refreshAfter(closedAt));
  },Math.min(Math.max(remaining,0),2147483647));
}
// A scheduled time has passed: only the launch state changes, so a light snapshot that started after
// that time answers every countdown and the closing timer for it (several can expire together).
function refreshAfter(deadline){
  const passed=Date.parse(serverNow())-Date.parse(deadline);
  void refresh({quiet:false,light:true,since:performance.now()-(passed>0?passed:0)});
}
// Every open page reaches a shared deadline (an opening, the applications close) in the same second. The
// page changes at once; its refresh is spread over a few seconds so that moment is not one burst on the island.
const spread=task=>setTimeout(task,250+Math.floor(Math.random()*2500));
const coordinator=createRefreshCoordinator({
  key:()=>snapshotKey(route(),state.collabPage),
  // A light snapshot reads the wallet and X sessions only while signed in to them, and the X profile only on
  // every fourth one (about two minutes): the shared launch data comes from Vercel's CDN, the profile from
  // the island itself.
  load:({full})=>loadWebsiteSnapshot({request,route:route(),referralsPage:state.referralsPage,collabPage:state.collabPage,
    identity:full?undefined:{wallet:state.session.authenticated===true,x:state.xSession.authenticated===true&&++lightXReads%4===0}}),
  apply:([config,loadedSession,gate,loadedXSession,requestedPage,loadedCollab,requestedCollabPage,loadedPartner,requestedRoute],{quiet})=>{
    // Navigation may happen while a snapshot is loading. Fetch the new page's
    // projection before applying anything; mutation fencing remains in sync.mjs.
    if(snapshotKey(requestedRoute)!==snapshotKey(route())){void coordinator.refresh({quiet});return false;}
    autoRetry.reset();
    // Identity a light snapshot did not read stays as known, and so does an X profile the busy island could
    // not answer (KEEP): the launch board still updates, and the next refresh reads the profile again.
    const xFailed=loadedXSession===KEEP;
    const session=loadedSession??state.session,xSession=loadedXSession===null||xFailed?state.xSession:loadedXSession;
    if(state.xSession.user?.id!==xSession.user?.id){
      state.collab=null;state.collabDraft={url:'',wallet:''};state.partner=null;partnerPage?.reset();
    }
    const partnerChanged=Boolean(loadedPartner)&&partnerKey(state.partner)!==partnerKey(loadedPartner);
    if(loadedPartner){state.partner=loadedPartner;state.partnerSyncedAt=performance.now();}
    // A refresh started before a page click must not undo the requested page.
    const collab=loadedCollab&&requestedCollabPage===state.collabPage?loadedCollab:null,collabSettled=Boolean(collab)&&state.collabBusy;
    if(!xFailed&&requestedPage!==state.referralsPage&&xSession.user?.id===state.xSession.user?.id)return false;
    const referralsChanged=JSON.stringify(state.xSession.referrals)!==JSON.stringify(xSession.referrals)||state.referralsBusy||Boolean(state.referralsError);
    if(!xFailed){state.referralsBusy=false;state.referralsError='';state.referralsPage=xSession.referrals?.page||1;}
    else if(state.referralsBusy){state.referralsBusy=false;state.referralsPage=state.xSession.referrals?.page||1;state.referralsError='Could not load this page. Try again.';}
    state.web3Enabled=gameEntryOpen(config);
    const changed=Boolean(state.loadError)||!state.config||state.config.game_launch_enabled!==config.game_launch_enabled||state.config.game_entry_path!==config.game_entry_path||state.config.applications_open!==config.applications_open||state.config.applications_enabled!==config.applications_enabled||state.config.early_access_at!==config.early_access_at||state.config.public_access_at!==config.public_access_at||state.config.social_revision!==config.social_revision||state.config.social?.tweet_url!==config.social?.tweet_url||state.config.social?.account_url!==config.social?.account_url||state.gate?.phase!==gate.phase||state.gate?.allowed!==gate.allowed||state.gate?.eligible!==gate.eligible||state.gate?.opens_at!==gate.opens_at||state.session.wallet!==session.wallet||Boolean(state.session.application)!==Boolean(session.application)||Boolean(state.session.profile)!==Boolean(session.profile)||state.gate?.reason!==gate.reason||state.xSession.user?.id!==xSession.user?.id||Boolean(state.xSession.profile)!==Boolean(xSession.profile)||Boolean(state.xSession.application)!==Boolean(xSession.application)||currentCard()?.key!==invitationCard(xSession,config)?.key;
    const collabChanged=Boolean(collab)&&collabKey(state.collab)!==collabKey(collab),counterChanged=Boolean(collab)&&state.collab?.awarded!==collab.awarded;
    if(collab)setCollab(collab);
    state.config=config;setGate(gate);if(changed)hydrate(session);else state.session=session;hydrateX(xSession);state.loadError='';scheduleClosure();
    if(!quiet||changed||collabChanged&&route()===COLLAB_PATH||partnerChanged&&route()===PARTNER_PATH)render();else{if(referralsChanged)renderReferrals();if(counterChanged)renderCollabSupply();if(collabSettled)renderCollabHistory();}
    // The profile is still unknown: the next refresh, light or not, reads identity in full again.
    if(xFailed){coordinator.invalidate();return false;}
  },onError:(error,{quiet})=>{if(state.collabBusy){state.collabBusy=false;state.collabPage=state.collab?.submissions?.page||1;state.collabError='Could not load this page. Try again.';renderCollabHistory();}else if(state.referralsBusy){state.referralsBusy=false;state.referralsPage=state.xSession.referrals?.page||1;state.referralsError='Could not load this page. Try again.';renderReferrals();}else if(!quiet||!state.config||route()===COLLAB_PATH&&!state.collab||route()===PARTNER_PATH&&!state.partner){
      // A page that already shows the launch board keeps it through a failed refresh; only a page with
      // nothing to show yet gets the error. Either way it tries again by itself, with growing gaps.
      const showing=Boolean(state.config&&state.gate)&&!(route()===COLLAB_PATH&&!state.collab)&&!(route()===PARTNER_PATH&&!state.partner);
      if(showing)announce('The island is busy. Retrying in a moment.');else{state.loadError=error.message;render();}
      autoRetry.schedule();
    }}
});
let lightXReads=0;
const autoRetry=createRetry(()=>{void refresh({quiet:true});});
const refresh=options=>coordinator.refresh(options);
partnerPage=mountPartnerPage({main,state,request,mutate:task=>coordinator.mutate(task),render,announce,active:()=>route()===PARTNER_PATH});
function renderCollabSupply(){const panel=main.querySelector('.collab-supply');if(panel&&state.collab)panel.outerHTML=supplyView(state.collab,{compact:panel.classList.contains('is-compact')});}
function renderCollabHistory(){const panel=main.querySelector('.collab-history');if(panel&&state.collab)panel.outerHTML=historyView(collabModel(state.collab).history,{busy:state.collabBusy,error:state.collabError});}
function collabFeedback(input,reveal){
  const url=input.name==='collab_url',key=url?'url':'wallet';
  const problem=url?validateProof(input.value,state.collab?.user?.handle):walletIssue(input.value),valid=!problem;
  const shown=valid||!input.value.trim()||!reveal?'':problem;
  input.dataset.current=String(!valid);const tick=input.parentElement.querySelector('.proof-tick');if(tick)tick.hidden=!valid;
  const note=main.querySelector(`#collab-${key}-issue`);if(note){note.textContent=shown;note.hidden=!shown;}
  if(shown)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
  const ready=valid&&!(url&&collabModel(state.collab).nextAt);
  const button=main.querySelector(url?'[data-collab-submit]':'[data-collab-wallet]');if(button){button.dataset.current=String(ready);button.disabled=state.busy||!ready;}
}
function renderReferrals(){const panel=main.querySelector('.access-referrals');if(panel)panel.outerHTML=referralsView(state.xSession.referrals,{busy:state.referralsBusy,error:state.referralsError});}
const stopConfigSync=subscribeSiteConfigChanges(()=>{void refresh({quiet:false});});
// Another tab signed in or out: read both sessions again now, not at the next full refresh.
const stopAuthSync=subscribeSiteAuthChanges(()=>{coordinator.invalidate();void refresh({quiet:true});});
window.addEventListener('pagehide',event=>{if(!event.persisted){stopConfigSync();stopAuthSync();}});
function closeDialog(){const dialog=document.querySelector('dialog');dialog?.close();document.querySelector('#dialog-root').replaceChildren();}
// Phones and tablets, including X's in-app browser, cannot reliably download a file: the in-app
// browser opens the image as a new page and the unsaved step is lost. Show the card in the page.
const savesCardInPage=()=>matchMedia('(hover: none) and (pointer: coarse)').matches;
function markCardSaved(journey,message){
  if(state.journey!==journey)return;
  state.journey.downloaded=true;saveProgress();void progressStore.flush().catch(()=>{});render();announce(message);
}
async function showCardSaver(prepared,onSaved){
  // A data URL keeps "press and hold → Save to Photos" working where blob: images do not.
  const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The card image could not be prepared.'));reader.readAsDataURL(prepared.blob);});
  const file=typeof File==='function'?new File([prepared.blob],prepared.filename,{type:'image/png'}):null;
  const canShare=Boolean(file&&navigator.canShare?.({files:[file]}));
  const root=document.querySelector('#dialog-root');
  root.innerHTML=`<dialog class="wallet-dialog card-saver" aria-labelledby="card-saver-title"><button class="dialog-close" type="button" aria-label="Close">${icon('close')}</button><h2 id="card-saver-title">Save your card</h2><p>Press and hold the card, then choose <strong>Save to Photos</strong> or <strong>Download image</strong>.</p><img class="card-saver-image" src="${e(image)}" alt="${e(prepared.altText||'Your Early Access card')}" width="1536" height="1024">${canShare?`<button class="button secondary wide" type="button" data-card-share>${icon('external')} Save or share card</button>`:''}<button class="button primary wide" type="button" data-card-saved>${icon('check')} I saved my card</button><p id="card-saver-status" role="status"></p></dialog>`;
  const dialog=root.querySelector('dialog');
  const dismiss=()=>{try{closeDialog();}catch{root.replaceChildren();}};
  const done=()=>{dismiss();onSaved();};
  root.querySelector('.dialog-close').onclick=dismiss;dialog.addEventListener('cancel',dismiss);
  root.querySelector('[data-card-saved]').onclick=done;
  root.querySelector('[data-card-share]')?.addEventListener('click',async()=>{
    try{await navigator.share({files:[file]});done();}
    catch(error){if(error?.name!=='AbortError'){const status=root.querySelector('#card-saver-status');if(status)status.textContent='Sharing is not available here. Press and hold the card to save it.';}}
  });
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
async function disconnect(){await request('logout',{});publishSiteAuthChange();hydrate({authenticated:false});state.error='';await refresh();}
function showWallet(){
  const wallets=availableWallets();const root=document.querySelector('#dialog-root');
  root.innerHTML=`<dialog class="wallet-dialog" aria-labelledby="wallet-title"><button class="dialog-close" aria-label="Close wallet selection">${icon('close')}</button>${icon('wallet','large-icon')}<h2 id="wallet-title">Your key to the island.</h2><p>Connect a wallet and sign a message to make this place yours.</p><div class="wallet-options">${wallets.length?wallets.map((wallet,index)=>`<button class="button secondary wide" data-wallet="${index}">${icon('wallet')}${e(wallet.name)}${icon('arrow')}</button>`).join(''):'<div class="message info">No browser wallet found. Enable your wallet extension, or open this site in your EVM wallet’s browser, then try again.</div>'}</div><p class="field-hint">A sign-in message only. No transaction, payment or gas.</p><p id="wallet-status" role="status"></p></dialog>`;
  const dialog=root.querySelector('dialog');dialog.showModal();root.querySelector('.dialog-close').onclick=closeDialog;dialog.addEventListener('cancel',closeDialog);
  root.querySelectorAll('[data-wallet]').forEach(button=>button.addEventListener('click',async()=>{
    root.querySelectorAll('[data-wallet]').forEach(b=>b.disabled=true);root.querySelector('#wallet-status').textContent='Open your wallet to connect and sign the message…';
    try{await coordinator.mutate(async()=>{const session=await connectWallet(wallets[Number(button.dataset.wallet)].provider,()=>coordinator.mutate(()=>disconnect().catch(()=>{hydrate({authenticated:false});state.error='Your wallet changed. Connect again to continue.';render();})));hydrate(session);publishSiteAuthChange();closeDialog();});announce('Wallet connected.');}
    catch(error){if(root.querySelector('#wallet-status')){root.querySelector('#wallet-status').textContent=walletError(error);root.querySelectorAll('[data-wallet]').forEach(b=>b.disabled=false);}}
  }));
}
async function withBusy(task){if(state.busy)return;const authSurface=route();state.busy=true;state.error='';render();try{await coordinator.mutate(task);}catch(error){state.error=error.message;if(error.status===401){if(authSurface==='/early-access'||authSurface===COLLAB_PATH||authSurface===PARTNER_PATH)hydrateX({authenticated:false});else hydrate({authenticated:false});}if(error.status===403)await refresh({quiet:true});}finally{state.busy=false;render();}}
function updateTaskFeedback(){
  const next=main.querySelector('[data-continue]');
  if(next){const ready=!stepIssue(state.journey.index,state.draft,state.xSession.profile,state.journey,state.config);next.dataset.current=String(ready);next.disabled=state.busy||!ready;
    const hint=main.querySelector('#continue-hint');if(hint){const text=state.busy||ready?'':continueHint(state.journey.index,state.draft,state.xSession.profile,state.journey,state.config);hint.textContent=text;hint.hidden=!text;}}
  const progress=main.querySelector('.journey-progress');
  if(progress){const previous=progress.querySelector('.journey-meter i')?.style.width;progress.outerHTML=progressView({...state,session:state.xSession});const meter=main.querySelector('.journey-meter i');if(meter&&previous){const target=meter.style.width;meter.style.width=previous;requestAnimationFrame(()=>{meter.style.width=target;});}}
}
main.addEventListener('input',event=>{
  const input=event.target;
  if(input.name==='collab_url'||input.name==='collab_wallet'){
    state.collabDraft[input.name==='collab_url'?'url':'wallet']=input.value;state.error='';main.querySelectorAll('.feedback[role="alert"]').forEach(node=>node.remove());
    const note=main.querySelector(input.name==='collab_url'?'#collab-url-issue':'#collab-wallet-issue');
    collabFeedback(input,input.name==='collab_url'||/^insertFrom(Paste|Drop)/.test(event.inputType||'')||Boolean(note&&!note.hidden));return;
  }
  if(!(input.name in state.draft))return;
  state.draft[input.name]=input.type==='checkbox'?input.checked:input.value;
  if(['reply_url','quote_url'].includes(input.name))state.draft.confirmed=false;
  state.draft.liked=state.draft.confirmed===true&&state.journey.opened.like===true;
  if(input.name==='confirmed')input.dataset.current=String(!input.checked);
  state.error='';main.querySelectorAll('.feedback[role="alert"]').forEach(node=>node.remove());input.removeAttribute('aria-invalid');
  if(['reply_url','quote_url'].includes(input.name)){
    const handle=state.xSession.user?.handle||state.xSession.profile?.x_handle||state.xSession.profile?.handle;
    const valid=!validateProof(input.value,handle,{otherUrl:input.name==='quote_url'?state.draft.reply_url:undefined,targetUrl:state.config.social.tweet_url});
    input.dataset.current=String(!valid);const tick=input.parentElement.querySelector('.proof-tick');if(tick)tick.hidden=!valid;
    const issue=main.querySelector(`#${input.name}-issue`);if(issue){const text=valid||!input.value.trim()?'':validateProof(input.value,handle,{otherUrl:input.name==='quote_url'?state.draft.reply_url:undefined,targetUrl:state.config.social.tweet_url});issue.textContent=text;issue.hidden=!text;}
    if(!valid&&input.value.trim())input.setAttribute('aria-invalid','true');
  }
  if(input.name==='wallet'){
    // While typing, stay quiet; explain after a paste, after leaving the field, or once already shown.
    const note=main.querySelector('#wallet-issue');
    walletFeedback(input,/^insertFrom(Paste|Drop)/.test(event.inputType||'')||Boolean(note&&!note.hidden));
  }
  updateTaskFeedback();saveProgress();
});
function walletFeedback(input,reveal){
  const problem=walletIssue(input.value),valid=!problem,shown=!reveal||valid||!input.value.trim()?'':problem;
  input.dataset.current=String(!valid);const tick=input.parentElement.querySelector('.proof-tick');if(tick)tick.hidden=!valid;
  const note=main.querySelector('#wallet-issue');if(note){note.textContent=shown;note.hidden=!shown;}
  if(shown)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
  const next=main.querySelector('[data-wallet-continue]');if(next){next.dataset.current=String(valid);next.disabled=state.busy||!valid;}
}
main.addEventListener('focusout',event=>{if(event.target.name==='wallet')walletFeedback(event.target,true);if(event.target.name==='collab_wallet')collabFeedback(event.target,true);});
main.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;if(!form.reportValidity())return;
  if(form.id==='identity-form'){
    withBusy(async()=>{const result=await request('x/profile',{wallet:state.draft.wallet.trim(),...(state.xSession.profile?{}:{referrer:state.inviter})});hydrateX(result,{saved:true});state.step=2;saveProgress();announce('Your profile is saved.');});
  }
  if(form.id==='collab-form'){
    const url=state.collabDraft.url;
    withBusy(async()=>{setCollab(await request('x/collab/submit',{url:canonicalPostUrl(url)||url.trim()}));state.collabDraft.url='';announce('Post submitted. Thank you for creating!');});
  }
  if(form.id==='collab-wallet-form'){
    withBusy(async()=>{setCollab(await request('x/collab/wallet',{wallet:state.collabDraft.wallet.trim()}));announce('Wallet saved for your GTD WL.');});
  }
  if(form.id==='game-profile-form'){
    const data=new FormData(form);
    withBusy(async()=>{hydrate(await request('profile',{display_name:data.get('display_name'),handle:data.get('handle'),referrer:state.inviter||null}));setGate(await request('gate'));});
  }
  if(form.id==='social-form'){
    const index=state.journey.index;
    const issue=stepIssue(index,state.draft,state.xSession.profile,state.journey,state.config);
    if(issue){state.error=issue;if(index===5)state.journey.index=nextIncompleteStep(state.draft,state.xSession.profile,state.journey,state.config);render();announce(issue);return;}
    if(index<5){state.journey.index=index+1;state.error='';state.campaignNotice='';saveProgress();void progressStore.flush().catch(()=>{});render();announce(`Step ${index} complete. Your next step is ready.`);return;}
    withBusy(async()=>{const confirmed=state.draft.confirmed===true;const result=await request('x/application',{reply_url:canonicalPostUrl(state.draft.reply_url)||state.draft.reply_url.trim(),quote_url:canonicalPostUrl(state.draft.quote_url)||state.draft.quote_url.trim(),liked:confirmed&&state.journey.opened.like===true,tagged_two:confirmed&&state.journey.opened.reply===true,card_attached:confirmed&&state.journey.downloaded===true&&state.journey.opened.quote===true,social_revision:state.config.social_revision});hydrateX(result);setGate(await request('gate'));announce('Application saved. You’re on the list.');});
  }
});
document.addEventListener('click',async event=>{
  const social=event.target.closest('[data-social]');
  if(social&&event.button===0){state.journey.opened[social.dataset.social]=true;state.error='';saveProgress();void progressStore.flush().catch(()=>{});setTimeout(render,0);}
  const link=event.target.closest('a[data-route]');if(link&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&event.button===0){event.preventDefault();const href=link.href,desktop=main.querySelector('.desktop-window');
    // Moving between guide chapters keeps the window: the chapter itself slides in (docs-widgets.mjs).
    const docsHop=docsRoute()&&DOCS_ROUTE.test(new URL(href).pathname.replace(/\/$/,''));
    if(desktop&&!docsHop&&new URL(href).pathname!=='/early-access'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){await desktop.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(20px) scale(.95)'}],{duration:160,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{});}navigate(href);return;}
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(action==='retry-card-photo'){button.disabled=true;void paintCard();return;}
  if(action==='expand-window'){state.windowExpanded=!state.windowExpanded;const desktop=main.querySelector('.desktop-window');desktop?.classList.toggle('is-expanded',state.windowExpanded);button.setAttribute('aria-pressed',String(state.windowExpanded));button.setAttribute('aria-label',`${state.windowExpanded?'Restore':'Expand'} ${button.dataset.windowTitle||'Early Access'}`);}
  if(action==='connect')showWallet();
  if(action==='connect-x')withBusy(async()=>{const result=await request('x/start',route()===COLLAB_PATH?{return:'creators'}:route()===PARTNER_PATH?{return:'collab'}:{},{timeoutMs:30000});location.assign(xAuthorizationUrl(result.auth_url,state.config?.x_auth?.mode));});
  if(action==='disconnect-x')withBusy(async()=>{if(!state.xSession.application)await progressStore.flush();progressStore.setIdentity(null);await progressStore.pendingPromise;try{await request('x/logout',{});}catch(error){progressStore.setIdentity(state.xSession.user?.id);throw error;}publishSiteAuthChange();hydrateX({authenticated:false});state.step=1;if(state.partner)state.partner={...state.partner,authenticated:false,user:null,state:null,application:null,agreement:null};partnerPage?.reset();if(state.collab)setCollab({...state.collab,authenticated:false,user:null,submissions:null,award:null,next_submission_at:null});});
  if(action==='skip-registration'){state.skipRegistration=true;state.error='';render();}
  if(action==='claim')withBusy(async()=>{const row=button.closest('[data-registration]');hydrate(await request('claim-registration',{registration_id:row.dataset.registration,accept_referrer:Boolean(row.querySelector('[name="accept_referrer"]')?.checked)}));setGate(await request('gate'));});
  if(action==='retry'){docsFailed=false;state.loadError='';render();refresh();}
  if(action==='clear-invitation'){clearInvitation();state.inviter=null;const url=new URL(location.href);url.searchParams.delete('ref');history.replaceState({},'',url.pathname+url.search+url.hash);state.error='';render();announce('Invitation removed. You can register directly.');}
  if(action==='identity'){state.step=1;state.error='';render();}
  if(action==='journey-back'){if(state.journey.index===1)state.step=1;else state.journey.index--;state.error='';saveProgress();render();}
  if(action==='journey-step'){
    const target=Number(button.dataset.step),available=state.xSession.profile?nextIncompleteStep(state.draft,state.xSession.profile,state.journey,state.config):0;
    if(target>=1&&target<=available&&!state.xSession.application){state.step=2;state.journey.index=target;state.error='';saveProgress();render();}
  }
  if(action==='disconnect')withBusy(disconnect);
  if(action==='enter')withBusy(async()=>{const result=await request('enter',{});const url=new URL(result.game_url,location.origin);if(url.origin!==location.origin||!isGamePage(url.pathname))throw new Error('The game entrance could not be verified. Try again.');location.assign(url.href);});
  if(action==='copy-referral-wallet'){await copyReferralWallet(button);return;}
  if(action==='collab-page'){
    const page=Number(button.dataset.page);if(state.collabBusy||!Number.isSafeInteger(page)||page<1)return;
    state.collabPage=page;state.collabBusy=true;state.collabError='';renderCollabHistory();
    await refresh({quiet:true});
    main.querySelector('.collab-pagination button:not(:disabled)')?.focus({preventScroll:true});return;
  }
  if(action==='referrals-page'){
    const page=Number(button.dataset.page);if(state.referralsBusy||!Number.isSafeInteger(page)||page<1)return;
    state.referralsPage=page;state.referralsBusy=true;state.referralsError='';renderReferrals();
    await refresh({quiet:true});
    const next=main.querySelector('.referral-pagination button:not(:disabled)');next?.focus({preventScroll:true});return;
  }
  if(action==='copy'){
    try{const referralUrl=cardOptions().referralUrl;if(!referralUrl)throw Error('Your invitation link is not ready.');await navigator.clipboard.writeText(referralUrl);const old=button.innerHTML;button.innerHTML=icon('check')+' Copied';announce('Invitation link copied.');setTimeout(()=>{if(button.isConnected)button.innerHTML=old;},2200);}
    catch{document.querySelector('#referral-link')?.select();announce('Select and copy the invitation link.');}
  }
  if(action==='download'){
    const journey=state.journey,card=currentCard(),options=card?.options;if(!options)return;
    button.disabled=true;try{const module=await loadCardModule();
      if(savesCardInPage()){const prepared=await module.prepareInviteCard(options);if(state.journey!==journey||currentCard()?.key!==card.key)return;await showCardSaver(prepared,()=>markCardSaved(journey,'Card saved. Attach the image when you post on X.'));return;}
      await module.downloadInviteCard(options);if(state.journey!==journey||currentCard()?.key!==card.key)return;markCardSaved(journey,'Card download started. Attach the image when you post on X.');}
    catch(error){const status=document.querySelector('.card-status');if(status)status.textContent='The card could not be downloaded. Please try again.';}
    finally{button.disabled=false;}
  }
});
document.addEventListener('auxclick',event=>{const social=event.target.closest('[data-social]');if(social&&event.button===1){state.journey.opened[social.dataset.social]=true;state.error='';saveProgress();void progressStore.flush().catch(()=>{});setTimeout(render,0);}});
window.addEventListener('popstate',()=>{state.error='';render();refresh({quiet:true,since:recent()});});
// Input keeps the background refresh at its usual pace (pollInterval); an untouched tab slows down.
let lastInput=performance.now();
const noteInput=()=>{lastInput=performance.now();};
for(const type of ['pointerdown','keydown','wheel','touchstart'])window.addEventListener(type,noteInput,{capture:true,passive:true});
window.addEventListener('focus',()=>{noteInput();if(route()!=='/')void refresh({quiet:true,since:recent()});});
let island,sceneLoading,rainySky,rainLoading,skipIsland=false;
islandBoot.onFallback(()=>{skipIsland=true;island?.dispose();island=null;document.querySelector('.world').dataset.scene='unavailable';});
const cloudRoute=()=>['/early-access','/play',COLLAB_PATH,PARTNER_PATH,FAQ_PATH].includes(route());
// The guide's pages share the cloud sky of the other windows.
const skyRoute=()=>cloudRoute()||docsRoute();
const skyVariant=()=>earlyBackdrop;
const skyMotion=()=>earlyMotion;
const rainActive=()=>skyRoute()&&skyVariant()!=='pixel';
function syncBackdrop(){
  const active=!skyRoute();
  if(!active)islandBoot.release();
  island?.setWeather(landingWeather(location.search));
  island?.setActive(active);
  if(rainActive()){rainySky?.setVariant(skyVariant());rainySky?.setMotion(skyMotion());}
  rainySky?.setActive(rainActive());
  if(rainActive()&&!rainLoading){
    rainLoading=import('./rainy-sky.mjs').then(async({mountRainySky})=>{
      rainySky=mountRainySky(document.querySelector('.early-weather'),{variant:skyVariant(),motion:skyMotion()});
      rainySky.setActive(rainActive());
      await rainySky.loaded;
    }).catch(()=>{
      rainySky?.dispose();
      document.querySelector('.early-weather').dataset.scene='unavailable';
    });
  }
  if(active&&!sceneLoading){
    sceneLoading=import('./island-scene.mjs').then(async({mountIslandScene})=>{
      if(skipIsland)return;
      island=mountIslandScene(document.querySelector('.world'),{weather:landingWeather(location.search),onProgress:value=>islandBoot.progress(value)});
      island.setActive(!skyRoute());
      await island.loaded;
      await islandBoot.finish();
    }).catch(async()=>{
      island?.dispose();
      document.querySelector('.world').dataset.scene='unavailable';
      await islandBoot.fallback();
    });
  }
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveProgress();void progressStore.flush().catch(()=>{});}else{noteInput();if(route()!=='/')refresh({quiet:true,since:recent()});}});
// Pages with live state refresh in the background while visible: a light snapshot once per interval,
// counted from the last snapshot of any kind, so focus or navigation pushes the next one back.
setInterval(()=>{
  if(document.hidden||!['/play','/early-access',COLLAB_PATH,PARTNER_PATH].includes(route()))return;
  const interval=pollInterval({idleMs:performance.now()-lastInput,critical:launchCritical(state.config,state.gate,state.gate?Date.parse(serverNow()):NaN)});
  void refresh({quiet:true,light:true,since:performance.now()-interval+1000});
},POLL_MS);
render();refresh({quiet:true});
