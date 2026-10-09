import {createClock} from './countdown.mjs';

export const COLLAB_PATH='/creators';
/** The Computers RH NFT these GTD WL spots are for. */
export const NFT_FACTS=Object.freeze({supply:3333,mint:'Free',mintDate:'Oct 15'});
/** GTD WL spots per path; together they are the whole supply. */
export const NFT_ALLOCATION=Object.freeze({creators:333,collabs:1889,players:1111});
/** Where DAOs and communities apply for a collab. */
export const PARTNER_PATH='/collab';

export function cooldownParts(milliseconds){
  const seconds=Math.max(0,Math.ceil(milliseconds/1000));
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0'));
}
const nextSubmission=(hours,minutes)=>`Next submission in ${hours} hours, ${minutes} minutes`;
export function mountCooldown(element,{deadline,serverNow,onExpire,label=nextSubmission}){
  const remaining=createClock(deadline,serverNow),value=element.querySelector('[data-cooldown]');let expired=false;
  const update=()=>{const left=remaining();if(left===null||!value)return;
    const [hours,minutes,seconds]=cooldownParts(left);value.textContent=`${hours}:${minutes}:${seconds}`;
    element.setAttribute('aria-label',label(Number(hours),Number(minutes)));
    if(left<=0&&!expired){expired=true;onExpire?.();}};
  update();const interval=setInterval(update,1000);return ()=>clearInterval(interval);
}

const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
/** Never show a made-up 0 when the counter did not load. */
export function supplyModel(collab){
  const capacity=count(collab?.capacity),awarded=count(collab?.awarded);
  if(!capacity||awarded===null||awarded>capacity)return null;
  return {capacity,awarded,remaining:capacity-awarded,percent:Math.min(100,Math.round(awarded/capacity*1000)/10)};
}

export function collabModel(collab){
  const signedIn=collab?.authenticated===true&&Boolean(collab.user);
  const award=signedIn?collab.award:null;
  const mode=!signedIn?'signed-out':award?(award.needs_wallet?'claim-wallet':'winner'):collab.full?'full':collab.paused?'paused':'compose';
  return {mode,signedIn,award,nextAt:mode==='compose'?collab.next_submission_at||null:null,history:signedIn?collab.submissions:null};
}

/** Only re-render the whole page when something other than the public counter moved. */
export function collabKey(collab){
  if(!collab)return '';
  const {awarded,remaining,server_now:_,...rest}=collab;
  return JSON.stringify(rest);
}
