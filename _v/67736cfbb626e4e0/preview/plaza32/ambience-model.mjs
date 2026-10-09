export const DAY_SECONDS=600;
// The draft world splits the approved 'cloth' mesh into one banner_N per banner (runtime tint). It lives here,
// in the small module the public homepage also loads; island-model.mjs re-exports it for the game.
export const clothBanner=name=>/^banner_\d+$/.test(name);
export const WEATHER_SECONDS=DAY_SECONDS;
export const WEATHER_BUDGET=Object.freeze({rain:900,snow:420,splashes:128,stars:90,pointLights:3});
// Owner decision, 7 Oct 2026: the island is always night and its weather is rain, snow or a clear night.
// One loop, in seconds: the first event (rain) is already falling at full strength when the page opens and
// clears by 180, a clear night, the second event (snow) from 270 to 450, a clear night while its snow melts,
// then the first event builds again from 540 and carries over the loop. Every change takes `ramp` seconds.
export const WEATHER_PLAN=Object.freeze({first:Object.freeze([540,180]),second:Object.freeze([270,450]),ramp:20,cover:.7});
// The moon sways this many orbit phase units around midnight (90), inside the night window (70–110).
export const MOON_SWAY=8;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function cycleState(seconds,timeMode='auto'){
  const fixed={day:30,night:90,sunrise:0,sunset:60};
  // Keep the artistic 0–120 phase coordinates independent of real duration.
  const phase=fixed[timeMode]??(((seconds%DAY_SECONDS)+DAY_SECONDS)%DAY_SECONDS)/DAY_SECONDS*120;
  // Dawn/dusk span twenty phase units; the scene controls their real duration.
  const n=phase<10?1-smooth(-10,10,phase):phase<70?smooth(50,70,phase):1-smooth(110,130,phase);
  const dusk=4*n*(1-n);
  return {phase,night:n,day:1-n,dusk};
}
const loopTime=seconds=>((seconds%DAY_SECONDS)+DAY_SECONDS)%DAY_SECONDS;
// One event of the plan (it may wrap the loop): it builds over `ramp` seconds and eases out over its last
// `ramp`; snow cover settles from 10 s in and melts away within 60 s of the event's end.
function weatherEvent(t,[start,end]){
  const {ramp,cover}=WEATHER_PLAN,age=(t-start+DAY_SECONDS)%DAY_SECONDS,length=(end-start+DAY_SECONDS)%DAY_SECONDS;
  return {intensity:smooth(0,ramp,age)*(1-smooth(length-ramp,length,age)),cover:cover*smooth(10,70,age)*(1-smooth(length-10,length+60,age))};
}
export function weatherState(seconds,mode='auto',firstWeather='rain'){
  if(mode!=='auto'){const rain=+(mode==='rain'),snow=+(mode==='snow');return {rain,snow,cover:snow*WEATHER_PLAN.cover,cloud:Math.max(rain*.75,snow*.6)};}
  const t=loopTime(seconds),first=weatherEvent(t,WEATHER_PLAN.first),second=weatherEvent(t,WEATHER_PLAN.second);
  const [rain,snow]=firstWeather==='snow'?[second,first]:[first,second];
  return {rain:rain.intensity,snow:snow.intensity,cover:snow.cover,cloud:Math.max(rain.intensity*.75,snow.intensity*.6)};
}
export function ambienceState(seconds,{time='auto',weather='auto',firstWeather='rain',reduced=false}={}){
  const elapsed=reduced?0:seconds;
  const t=loopTime(elapsed);
  // Never dawn, day or dusk: the moon sways gently around midnight and stays up with the stars all loop
  // (clouds only dim them). Normalize through cycleState for sky palettes. Reduced motion holds one calm,
  // clear night (nothing falls).
  const phase=90+MOON_SWAY*Math.sin(t/DAY_SECONDS*Math.PI*2);
  const sky=weatherState(elapsed,reduced&&weather==='auto'?'clear':weather,firstWeather);
  const stage=sky.rain>0?'rain':sky.snow>0?'snow':'clear-night';
  return {...cycleState(phase/120*DAY_SECONDS,time),...sky,stage,elapsed:t,firstWeather};
}
export function ambienceOptions(_search='',_random=Math.random){
  // Owner decision, 7 Oct 2026: every visit opens at night in the rain, whatever the link; nothing is rolled.
  // Old fixed-time/peak-weather links enter at that same start; UI time previews remain session-only choices.
  return {time:'auto',weather:'auto',firstWeather:'rain'};
}
