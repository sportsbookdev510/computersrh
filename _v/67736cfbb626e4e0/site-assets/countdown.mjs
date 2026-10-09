export function remainingParts(milliseconds) {
  const seconds=Math.max(0,Math.ceil(milliseconds/1000));
  return [Math.floor(seconds/86400),Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0'));
}
// A monotonic clock avoids trusting a visitor's wall clock after synchronization.
export function createClock(deadline,serverNow,monotonic=()=>performance.now()) {
  const total=Date.parse(deadline)-Date.parse(serverNow); const mark=monotonic();
  return ()=>Number.isFinite(total)?Math.max(0,total-(monotonic()-mark)):null;
}
export function mountCountdown(element,{deadline,serverNow,onExpire}) {
  const remaining=createClock(deadline,serverNow);let expired=false;
  const update=()=>{const value=remaining();if(value===null)return;
    const values=remainingParts(value);element.querySelectorAll('[data-count]').forEach((node,i)=>{node.textContent=values[i];});
    element.setAttribute('aria-label',`${values[0]} days, ${values[1]} hours, ${values[2]} minutes, ${values[3]} seconds remaining`);
    if(value<=0&&!expired){expired=true;onExpire?.();}
  };update();const interval=setInterval(update,1000);return ()=>clearInterval(interval);
}
