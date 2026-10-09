// Serialize snapshots around sign-in, sign-out and registration writes.
// A response started before a write is never allowed to restore stale identity.
//
// Every refresh() without ``since`` gets a snapshot that starts after the call, as before.
// ``since`` (a performance.now() time) marks a refresh that a snapshot started at or after
// that time already answers: the one loading now or the last applied one, for the same page
// projection (``key``). Page load, focus and visibility then share one snapshot, and two
// timers that expire together share one. ``light`` lets the snapshot skip the visitor's
// identity reads; the first snapshot, and the first after invalidate(), is always full.
export function createRefreshCoordinator({load,apply,onError,key=()=>'',now=()=>performance.now()}) {
  let revision=0,mutations=0,running=null,pending=null,current=null,last=null,identityKnown=false;
  const covers=(snapshot,options)=>Boolean(snapshot)&&snapshot.key===key()&&snapshot.started>=options.since&&(snapshot.full||Boolean(options.light));
  function refresh(options={}) {
    if(options.since!==undefined&&!mutations){
      if(running&&covers(current,options)){current.quiet=current.quiet&&Boolean(options.quiet);return running;}
      if(!running&&covers(last,options))return Promise.resolve();
    }
    pending={quiet:(pending?pending.quiet:true)&&Boolean(options.quiet),full:Boolean(pending?.full)||!options.light};
    if(mutations)return Promise.resolve();
    if(running)return running;
    running=(async()=>{
      while(pending&&!mutations){
        const request=pending;pending=null;const started=revision;
        const attempt={started:now(),key:key(),full:request.full||!identityKnown,quiet:request.quiet};current=attempt;
        try{
          const snapshot=await load({full:attempt.full});
          if(started===revision&&!mutations&&apply(snapshot,{quiet:attempt.quiet})!==false){last=attempt;identityKnown||=attempt.full;}
        }
        catch(error){if(started===revision&&!mutations)onError(error,{quiet:attempt.quiet});}
      }
    })().finally(()=>{running=null;current=null;if(pending&&!mutations){const next=pending;pending=null;refresh({quiet:next.quiet,light:!next.full});}});
    return running;
  }
  async function mutate(action){
    revision++;mutations++;last=null;
    try{return await action();}
    finally{revision++;mutations--;refresh({quiet:false});}
  }
  // Another tab signed in or out: nothing loaded before now answers a later refresh.
  function invalidate(){last=null;identityKnown=false;}
  return {refresh,mutate,invalidate};
}

/**
 * Retries a failed load by itself with growing, jittered gaps (2 s, 4 s … 30 s) so a busy island is not
 * hammered by every open page in step; ``reset`` after a good load starts over at the first gap.
 */
export function createRetry(run,{first=2000,max=30000,random=Math.random,timers={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)}}={}){
  let timer=null,delay=0;
  return {
    schedule(){
      if(timer!==null)timers.clear(timer);
      delay=Math.min(delay?delay*2:first,max);
      timer=timers.set(()=>{timer=null;run();},Math.round(delay*(0.75+random()*0.5)));
    },
    reset(){if(timer!==null)timers.clear(timer);timer=null;delay=0;},
  };
}

export function nextDraft(previousSession,session,draft,blank){
  const previous=previousSession.wallet?.toLowerCase();
  const next=session.wallet?.toLowerCase();
  // Keep typed identity through the first wallet connection.
  return previous&&previous!==next?blank():draft;
}

/** Stands in for an X profile the island could not answer: the page keeps the one it shows. */
export const KEEP=Symbol('keep the X profile already shown');

// Shared launch/auth state stays fresh. Page-specific projections are requested only
// where they are displayed; this is request selection, not a session cache.
// ``identity`` says which identity reads a light snapshot keeps: a signed-out wallet or X
// account is not read again until a full snapshot (page load, focus, navigation, a write
// or another tab's sign-in). Skipped reads are null; the caller keeps what it has.
// The X profile is personal, so it always comes from the island itself (never Vercel's CDN): a failed
// read is KEEP instead of failing the shared launch board with it.
export async function loadWebsiteSnapshot({request, route, referralsPage=1, collabPage=1, identity={wallet:true,x:true}}) {
  return Promise.all([
    request('config'), identity.wallet ? request('session') : null, request('gate'),
    identity.x ? request(`x/session?referrals_page=${referralsPage}`).catch(()=>KEEP) : null, referralsPage,
    route==='/creators' ? request(`x/collab?page=${collabPage}`) : null,
    collabPage, route==='/collab' ? request('x/partner') : null, route,
  ]);
}

/** The page projection a snapshot carries; a recent snapshot answers only the same one. */
export function snapshotKey(route, collabPage=1) {
  return route==='/creators' ? `creators:${collabPage}` : route==='/collab' ? 'collab' : 'shared';
}

export const POLL_MS=30000;
const MINUTE=60000;

/** How long a visible tab waits between background refreshes. Input in the last five minutes keeps
 * 30 seconds; an untouched tab slows to one and then two minutes. Launch-critical moments never slow. */
export function pollInterval({idleMs, critical}) {
  if(critical||!(idleMs>=5*MINUTE))return POLL_MS;
  return idleMs<15*MINUTE ? 2*POLL_MS : 4*POLL_MS;
}

/** Times when open tabs must notice the owner's changes quickly: within 15 minutes of a scheduled
 * time, or an opening time has come and the game is not open yet. Countdowns still refresh by
 * themselves at each deadline; this only keeps the background refresh at its usual pace. */
export function launchCritical(config, gate, nowMs) {
  if(!config||!gate||!Number.isFinite(nowMs))return true;
  if((gate.phase==='early_access'||gate.phase==='public')&&config.game_launch_enabled===false)return true;
  return [config.applications_open===true?config.applications_close_at:null,config.early_access_at,config.public_access_at]
    .some(at=>{const time=Date.parse(at??'');return Number.isFinite(time)&&Math.abs(time-nowMs)<=15*MINUTE;});
}
