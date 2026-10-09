// Progress follows scene milestones. A slow or unavailable GPU never traps visitors.
export function mountIslandBoot(doc, {raf=callback=>requestAnimationFrame(callback),later=setTimeout,cancel=clearTimeout,decode=()=>{const image=new Image();image.src='/_media/b82b557be6ce56e53369640ac868e59e66a3ed020a1f5d7f1e8c1e43d2f75f0c/site-assets/island-night.webp';return image.decode();}}={}) {
  const html=doc.documentElement, overlay=doc.querySelector('.site-loader');
  const bar=overlay?.querySelector('[role="progressbar"]'), button=overlay?.querySelector('.boot-fallback');
  const parts=[...doc.querySelectorAll('.site-header,main,.site-footer,.site-music')];
  let value=0,done=html.dataset.islandBoot!=='loading',fallbackAction=()=>{},timer,revealTimer;
  if(!done){for(const part of parts)part.inert=true;timer=later(()=>{if(button)button.hidden=false;},18000);}
  function progress(next){if(done||!Number.isFinite(next))return;value=Math.max(value,Math.min(99,Math.max(0,next)));bar?.style.setProperty('--boot-progress',value);bar?.setAttribute('aria-valuenow',String(value));}
  function release(){if(done)return;done=true;cancel(timer);cancel(revealTimer);delete html.dataset.islandBoot;for(const part of parts)part.inert=false;}
  async function finish(){
    if(done)return;cancel(timer);bar?.style.setProperty('--boot-progress',100);bar?.setAttribute('aria-valuenow','100');
    await new Promise(resolve=>raf(()=>raf(resolve)));
    if(done)return;html.dataset.islandBoot='revealing';for(const part of parts)part.inert=false;
    revealTimer=later(release,420);
  }
  async function fallback(){
    if(done)return;fallbackAction();
    let timeout;try{await Promise.race([decode(),new Promise(resolve=>{timeout=later(resolve,2500);})]);}catch{}finally{cancel(timeout);}
    await finish();
  }
  button?.addEventListener('click',()=>void fallback());
  return {progress,finish,fallback,release,onFallback(callback){fallbackAction=callback;}};
}
