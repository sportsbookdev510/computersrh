const KEY='computersrh:invitation';const TTL=24*60*60*1000;
export function parseInvitation(location) {
  let url;try{url=new URL(location,'https://computersrh.xyz');}catch{return null;}
  const route=url.pathname.match(/^\/(?:ref=|r\/)([A-Za-z0-9_]{3,15})\/?$/);
  const refs=url.searchParams.getAll('ref');const value=route?.[1] || (refs.length===1?refs[0]:null);
  return value && /^[a-z0-9_]{3,15}$/i.test(value)?value.toLowerCase():null;
}
function safeStorage(storage){
  if(storage!==undefined)return storage;
  try{return globalThis.localStorage;}catch{return null;}
}
export function clearInvitation(storage){
  try{safeStorage(storage)?.removeItem(KEY);return true;}catch{return false;}
}
export function captureInvitation(url,storage,now=Date.now()) {
  storage=safeStorage(storage);
  let saved;try{saved=JSON.parse(storage?.getItem(KEY));}catch{}
  if(saved&&Number.isFinite(saved.at)&&now-saved.at<TTL&&now>=saved.at&&/^[a-z0-9_]{3,15}$/.test(saved.handle))return saved.handle;
  const handle=parseInvitation(url);
  try{if(handle)storage?.setItem(KEY,JSON.stringify({handle,at:now}));else storage?.removeItem(KEY);}catch{}
  return handle;
}

/** The game page Play opens (owner decision, 8 Oct 2026; site/scripts/mainnet-routing.mjs GAME_PAGE). Its earlier
 * address keeps serving the same game, and the website service still names it as the open entrance's value
 * (server/website_host.py GAME_ENTRY_PATH), so either value opens the entrance; Play always goes to GAME_PAGE. */
export const GAME_PAGE='/play/island';
export const LEGACY_GAME_PAGE='/preview/plaza32/';
/** Whether the website config says the game entrance is open (its game_entry_path names the game page). */
export const gameEntryOpen=config=>config?.game_entry_path===GAME_PAGE||config?.game_entry_path===LEGACY_GAME_PAGE;
/** Whether ``path`` (a same-origin URL's pathname) is the game page, not a route of this site's own app. */
export const isGamePage=path=>path===GAME_PAGE||path===GAME_PAGE+'/'||path===LEGACY_GAME_PAGE;

/** One link follows the shared launch schedule: the form while applications are open, then Play
 * (the invitation stays saved for the player profile). X is only needed for the form. */
export function invitationDestination(gate, inviter, {web3Enabled=false,applicationsOpen=false}={}) {
  if(!gate || gate.phase==='before_early')return applicationsOpen?'/early-access':'/play';
  const url=new URL(web3Enabled?GAME_PAGE:'/play?enter=1','https://computersrh.xyz');
  if(inviter && /^[a-z0-9_]{3,15}$/i.test(inviter))url.searchParams.set('ref',inviter.toLowerCase());
  return url.pathname+url.search;
}

/** Public Play opens the configured game directly; its server still checks wallet access. */
export function playDestination(state,{enterGame=false}={}){
  if(!state.web3Enabled||state.config?.game_launch_enabled===false)return null;
  const phase=state.gate?.phase;
  if(phase!=='public'&&!(enterGame&&phase==='early_access'))return null;
  return invitationDestination(state.gate,state.inviter,{web3Enabled:true});
}
