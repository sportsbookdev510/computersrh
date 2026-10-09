import {icon} from './ui.mjs';

export const MUSIC_SOURCE = new URL('/_media/0fbe5ee5010a8a031c512a5ca82dff2af226fd53a2a7b12848786a895aae8543/site-assets/lofi-gaming-v1.m4a', import.meta.url).href;
export const MUSIC_PREFERENCE = 'computersrh:music:v1';
const DEFAULT_VOLUME = .3;

// One media element lives outside the routed content for the entire visit.
export function createMusicController({audio, document:doc, window:win, storage, onChange=()=>{}}) {
  let saved;
  try { saved=JSON.parse(storage?.getItem(MUSIC_PREFERENCE)||'null'); } catch {}
  let muted=saved?.muted===true;
  let volume=typeof saved?.volume==='number' && Number.isFinite(saved.volume)
    ? Math.max(0,Math.min(1,saved.volume)) : DEFAULT_VOLUME;
  let status='idle', pending=false, generation=0, disposed=false, pageAway=false;
  audio.loop=true;
  audio.preload='none';
  audio.volume=volume;
  audio.muted=muted;
  const enabled=()=>!muted && volume>0;
  const allowed=()=>enabled() && !doc.hidden && !pageAway && !disposed;
  const snapshot=()=>({muted,volume,status,playing:allowed() && !audio.paused && status==='playing'});
  const emit=()=>onChange(snapshot());
  function save() {
    try { storage?.setItem(MUSIC_PREFERENCE,JSON.stringify({muted,volume})); } catch {}
  }
  function pause() {
    generation++;
    pending=false;
    audio.pause();
    status='idle';
    emit();
  }
  function play() {
    if(!allowed() || pending || (!audio.paused && status==='playing'))return;
    if(!audio.src)audio.src=MUSIC_SOURCE;
    else if(audio.error)audio.load();
    const current=++generation;
    pending=true;
    status='loading';
    emit();
    // Call play synchronously inside the gesture: iOS must retain activation.
    let result;
    try { result=audio.play(); } catch(error) { result=Promise.reject(error); }
    Promise.resolve(result).then(()=>{
      if(disposed || current!==generation)return;
      status=audio.paused?'idle':'playing';
      emit();
    }).catch(error=>{
      if(disposed || current!==generation)return;
      status=error?.name==='NotAllowedError' || error?.name==='AbortError'?'waiting':'error';
      emit();
    }).finally(()=>{if(current===generation)pending=false;});
  }
  function toggle() {
    if(enabled() && status==='playing')muted=true;
    else if(enabled() && status==='loading')muted=true;
    else {muted=false;if(volume===0)volume=DEFAULT_VOLUME;}
    audio.muted=muted;
    audio.volume=volume;
    save();
    if(enabled())play();else pause();
  }
  function setVolume(value) {
    if(!Number.isFinite(value))return;
    volume=Math.max(0,Math.min(1,value));
    muted=volume===0;
    audio.volume=volume;
    audio.muted=muted;
    save();
    emit();
    if(enabled())play();else pause();
  }
  function gesture(event) {
    if(event.target?.closest?.('#site-music') || event.isComposing || event.metaKey || event.ctrlKey || event.altKey)return;
    if(status!=='error')play();
  }
  const visibility=()=>{if(doc.hidden)pause();else play();};
  const leave=()=>{pageAway=true;pause();};
  const enter=()=>{pageAway=false;play();};
  const playing=()=>{if(!allowed()){pause();return;}status='playing';emit();};
  const paused=()=>{if(!disposed){status='idle';emit();}};
  const failed=()=>{if(!disposed){generation++;pending=false;status='error';emit();}};
  doc.addEventListener('pointerup',gesture);
  doc.addEventListener('keydown',gesture);
  doc.addEventListener('visibilitychange',visibility);
  win.addEventListener('pagehide',leave);
  win.addEventListener('pageshow',enter);
  audio.addEventListener('playing',playing);
  audio.addEventListener('pause',paused);
  audio.addEventListener('error',failed);
  emit();
  play();
  return {toggle,setVolume,snapshot,destroy(){
    disposed=true;
    pause();
    doc.removeEventListener('pointerup',gesture);
    doc.removeEventListener('keydown',gesture);
    doc.removeEventListener('visibilitychange',visibility);
    win.removeEventListener('pagehide',leave);
    win.removeEventListener('pageshow',enter);
    audio.removeEventListener('playing',playing);
    audio.removeEventListener('pause',paused);
    audio.removeEventListener('error',failed);
  }};
}

export function mountMusic(root) {
  if(!root)return;
  root.innerHTML=`<button type="button" class="music-toggle" aria-label="Play music" aria-pressed="false"><span class="music-speaker">${icon('sound')}</span><span>Music</span><span class="music-bars" aria-hidden="true"><i></i><i></i><i></i></span></button><details class="music-volume"><summary aria-label="Music volume" title="Music volume">${icon('sliders')}</summary><div class="music-volume-panel"><label for="music-level">Volume <output id="music-level-value" for="music-level">30%</output></label><input id="music-level" type="range" min="0" max="100" step="5" value="30" aria-label="Music volume"></div></details><audio id="site-music-audio" preload="none" loop hidden></audio>`;
  const button=root.querySelector('.music-toggle');
  const speaker=root.querySelector('.music-speaker');
  const slider=root.querySelector('input');
  const output=root.querySelector('output');
  const details=root.querySelector('details');
  let storage;
  try { storage=window.localStorage; } catch {}
  const controller=createMusicController({audio:root.querySelector('audio'),document,window,storage,onChange:state=>{
    root.dataset.playing=String(state.playing);
    button.setAttribute('aria-pressed',String(state.playing));
    const label=state.playing?'Mute music':state.status==='loading'?'Mute music':state.status==='error'?'Retry music':'Play music';
    button.setAttribute('aria-label',label);
    button.title=state.status==='error'?'Music could not load. Click to retry.':label;
    speaker.innerHTML=icon(state.playing?'sound':'soundOff');
    slider.value=String(Math.round(state.volume*100));
    output.textContent=`${slider.value}%`;
    slider.setAttribute('aria-valuetext',`${slider.value}%`);
  }});
  button.addEventListener('click',()=>controller.toggle());
  slider.addEventListener('input',()=>controller.setVolume(Number(slider.value)/100));
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){details.open=false;details.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))details.open=false;});
  root.hidden=false;
  return controller;
}
