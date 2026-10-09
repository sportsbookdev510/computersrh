import * as THREE from 'three';

// Island theme packs (cosmetic, 0 hash): theme.glb props plus theme.json drawn on
// top of the personal island. ?theme=<id> previews a pack from the draft area on
// loopback only (same guard as ?world=draft); the owned theme item will call
// applyTheme/clearTheme later. No realtime lights: glowing materials, night_* meshes
// and additive halos follow the island's Day/Night (Ambience) instead.
//
// theme.json, as the runtime reads it (the Blender theme builder, scripts/build_island_theme.py,
// writes the same rules into each pack's "conventions"):
// - recolor.pairs: world vertex colours (linear) within recolor.tolerance of pair.from,
//   on the listed world meshes ('name', 'prefix*' or '*'), become pair.to; then
//   overrides.<key> paints the other vertices of its meshes one colour. Both are final:
//   the palette multipliers skip them. clearTheme restores the authored colours.
// - palette.<kind>: linear multipliers on the island's category materials; 'grass'
//   is the green part of the terrain mesh (lawns), 'terrain' its earth and rock.
// - night_palette.<kind>, and "night" on a recolor pair or an override: night-only linear
//   multipliers on top of the final colours, blended in with the island's night
//   (x mix(1, night, ambNight)). A pair's night reaches the vertices it recoloured, an
//   override's its meshes, night_palette.<kind> every other vertex of that category;
//   absent = 1. Draw calls and materials stay the same: the category values ride on the
//   palette uniforms, the owned vertices carry a themeNight attribute (clearTheme removes it).
// - sky.day_tint / night_tint: linear multipliers on the sky, horizon haze and cloud sea.
// - fog.color (sRGB) / density: three.js FogExp2 over the island. The overview camera
//   sits ~150 m away, so 0.002 is a ~9 % haze and 0.004 ~30 %; it dims at night, or
//   with night_only it fades in with the night instead.
// - animations: anim_<type>_<n> nodes (any in theme.glb without an entry use the
//   defaults below). Phases default to a hash of the node name. Times are seconds,
//   speeds radians per second, angles degrees, coordinates runtime (x, y-up, z).
//   orbit: the node circles center (default: its own origin) facing along its path
//   (front = glTF +Z = Blender -Y; face_travel false keeps its authored rotation) and
//   banks into the turn; bob: rises and falls; flicker: scales the emission below it;
//   flap: child wing_l*/wing_r* rotate about glTF Z; sway: the node swings about its
//   own origin (hang it from the pivot), amplitude or angle_deg in degrees; spin: the
//   node turns about its own up axis (glTF Y), phase + speed*t on top of its authored
//   rotation (put it under a bob node to bob and spin).
// - every material with an emissive map (and everything under glow_* / anim_flicker_*)
//   glows at its authored strength at night and at glow.day of it by day.
// - halos: additive sprites, colour*strength*(1 - d)^2; colour is linear, like the Blender
//   emission the packs are authored with; a halo with node follows that node (its origin
//   + offset); night_only (default true) fades with night_*.
// - moon (layer sky): every frame its node is pinned to moon.screen of the camera
//   (frame fractions, x right, y down), facing it, moon.diameter_frame_height of the
//   frame tall, behind the island and without fog. It replaces the sky's own moon.
// - particles: snow runs the island's weather snow pool (intensity, no rain, no ground
//   cover, clear sky); leaves fall from a small pool drawn here; embers are not drawn yet.

export const THEME_ROOT='/exports/island-v2-draft/themes/';
const LOOPBACK=['127.0.0.1','localhost','[::1]'];
export const THEME_ID=/^[a-z0-9][a-z0-9_-]{0,39}$/;
export const PALETTE_KINDS=Object.freeze(['grass','paving','trees','gardens','water','terrain','cloth']);
export const ANIMATION_TYPES=Object.freeze(['orbit','bob','flicker','flap','sway','spin']);
export const PARTICLE_TYPES=Object.freeze(['none','snow','leaves','embers']);
export const DRAWN_PARTICLES=Object.freeze(['none','snow','leaves']);
export const ANIMATION_DEFAULTS=Object.freeze({orbit:Object.freeze({radius:4,speed:.35,bob:.3}),bob:Object.freeze({amplitude:.2,speed:.8}),
  flicker:Object.freeze({min:.65,max:1,speed:6}),flap:Object.freeze({angle_deg:30,speed:8}),sway:Object.freeze({angle_deg:6,speed:1.1}),
  spin:Object.freeze({speed:.55})});
// A recoloured vertex's night multiplier as a normalized byte (themeNight attribute):
// round(k*127), so 1 is exact and the palette range (up to 2) fits in 0..255.
export const NIGHT_BYTE=127;
// One look for every pack; a theme tunes its own colours in theme.json and the GLB.
export const THEME_RUNTIME=Object.freeze({
  maxBytes:2.5*1024*1024,paletteRange:Object.freeze([.2,2]),tintRange:Object.freeze([0,2]),maxFogDensity:.02,
  maxAnimations:96,maxHalos:128,maxRecolor:256,maxTolerance:.1,
  glow:Object.freeze({day:.3,night:1}),           // x authored emissive strength (authored = the night look)
  halo:Object.freeze({day:.2,night:1}),           // halos that are not night-only
  nightFade:Object.freeze([.25,.65]),             // night_* meshes, night halos and night-only fog fade in over this night range
  fogNight:.45,                                   // the haze dims with the light at night
  grassKey:Object.freeze([.03,.12]),              // terrain this much greener than red and blue is lawn
  orbitBank:.22,orbitDip:2,bobTwist:.12,
  sway:Object.freeze({z:.6,rate:.77,phase:1.3}),  // the side swing: 0.6 of the angle at 0.77 of the rate
  moonDepth:.96,                                  // the sky moon sits at this fraction of the camera's far plane
  leaves:Object.freeze({fallSeconds:14,min:12,max:160,night:.35}),
});
const R=THEME_RUNTIME,WHITE=Object.freeze([1,1,1]),ZERO=Object.freeze([0,0,0]),TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

// ------------------------------------------------------------------ the switch

export function themeRequested(search='',hostname=''){
  const id=new URLSearchParams(search).get('theme');
  return LOOPBACK.includes(hostname)&&id&&THEME_ID.test(id)?id:null;
}

// ------------------------------------------------------------------ validation

const fail=message=>{throw Error(message);};
const number=(value,label,min=-Infinity,max=Infinity)=>Number.isFinite(value)&&value>=min&&value<=max?value:fail(`${label} must be a number in [${min}, ${max}]`);
const triple=(value,label,min,max)=>Array.isArray(value)&&value.length===3?Object.freeze(value.map(v=>number(v,label,min,max))):fail(label+' must be a list of 3 numbers');
const duo=(value,label,min,max)=>Array.isArray(value)&&value.length===2?Object.freeze(value.map(v=>number(v,label,min,max))):fail(label+' must be a list of 2 numbers');
const object=(value,label)=>value===undefined?{}:value&&typeof value==='object'&&!Array.isArray(value)?value:fail(label+' must be an object');
const list=(value,label,max)=>value===undefined?[]:Array.isArray(value)&&value.length<=max?value:fail(`${label} must be a list of at most ${max}`);
const flag=(value,label,fallback)=>value===undefined?fallback:typeof value==='boolean'?value:fail(label+' must be true or false');
const nodeName=(value,label)=>typeof value==='string'&&value.length>0&&value.length<=64?value:fail(label+' must be a node name');
const meshPatterns=(value,label)=>Array.isArray(value)&&value.length>0&&value.length<=64&&value.every(p=>typeof p==='string'&&p.length>0&&p.length<=64)
  ?Object.freeze([...value]):fail(label+' must be a list of world mesh names (name, prefix* or *)');
export const meshMatch=(name,patterns)=>patterns.some(p=>p==='*'||p===name||(p.endsWith('*')&&name.startsWith(p.slice(0,-1))));

// A stable phase per node, so a flock never moves in lockstep and every visit looks the same.
export function namePhase(name){
  let hash=0x811c9dc5;
  for(const c of String(name)){hash^=c.codePointAt(0);hash=Math.imul(hash,0x01000193)>>>0;}
  return hash/4294967296*TAU;
}
const ANIMATED=new RegExp(`^anim_(${ANIMATION_TYPES.join('|')})_`);
export const animationType=name=>ANIMATED.exec(name||'')?.[1]||null;

export function animationParams(type,node,entry={},label=node){
  const d=ANIMATION_DEFAULTS[type],value=key=>entry[key]??d[key];
  const base={node,type,phase:entry.phase===undefined?namePhase(node):number(entry.phase,label+'.phase'),speed:number(value('speed'),label+'.speed',-60,60)};
  if(type==='orbit')return Object.freeze({...base,center:entry.center===undefined?null:triple(entry.center,label+'.center'),
    radius:number(value('radius'),label+'.radius',0,80),bob:number(value('bob'),label+'.bob',0,20),faceTravel:flag(entry.face_travel,label+'.face_travel',true)});
  if(type==='bob')return Object.freeze({...base,amplitude:number(value('amplitude'),label+'.amplitude',0,20)});
  if(type==='spin')return Object.freeze(base);
  if(type==='flicker'){
    const min=number(value('min'),label+'.min',0,4),max=number(value('max'),label+'.max',0,4);
    if(min>max)fail(label+'.min must not exceed max');
    return Object.freeze({...base,min,max});
  }
  // flap and sway: angle_deg, or amplitude (degrees) as the Blender theme builder writes it.
  return Object.freeze({...base,angle:number(entry.angle_deg??entry.amplitude??d.angle_deg,label+'.angle_deg',0,90)*Math.PI/180});
}

// theme.json -> a frozen pack with every default filled in, or a readable error.
export function validateThemePack(raw,id){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('theme.json must be an object');
  if(typeof raw.id!=='string'||!THEME_ID.test(raw.id))fail('id must be lowercase letters, digits, - or _');
  if(id!==undefined&&raw.id!==id)fail(`id "${raw.id}" does not match the requested theme "${id}"`);
  if(!Number.isInteger(raw.version)||raw.version<1)fail('version must be a positive integer');
  // palette and night_palette: a multiplier per category, 1 where the pack names none.
  const categories=(value,label)=>{
    const out={};
    for(const [kind,multiplier] of Object.entries(object(value,label))){
      if(!PALETTE_KINDS.includes(kind))fail(`unknown ${label} category "${kind}" (use ${PALETTE_KINDS.join(', ')})`);
      out[kind]=triple(multiplier,label+'.'+kind,...R.paletteRange);
    }
    for(const kind of PALETTE_KINDS)out[kind]??=WHITE;
    return Object.freeze(out);
  };
  const palette=categories(raw.palette,'palette'),nightPalette=categories(raw.night_palette,'night_palette');
  const night=(value,label)=>value===undefined?WHITE:triple(value,label,...R.paletteRange);
  const recolor=object(raw.recolor,'recolor');
  const pairs=list(recolor.pairs,'recolor.pairs',R.maxRecolor).map((entry,index)=>{
    const label=`recolor.pairs[${index}]`,pair=object(entry,label);
    return Object.freeze({label:typeof pair.label==='string'&&pair.label?pair.label:label,meshes:meshPatterns(pair.meshes,label+'.meshes'),
      from:triple(pair.from,label+'.from',0,1),to:triple(pair.to,label+'.to',0,1),night:night(pair.night,label+'.night')});
  });
  const overrides=Object.entries(object(raw.overrides,'overrides')).map(([key,entry])=>{
    const label='overrides.'+key,override=object(entry,label);
    return Object.freeze({key,meshes:meshPatterns(override.meshes,label+'.meshes'),color:triple(override.color,label+'.color',0,1),night:night(override.night,label+'.night')});
  });
  const sky=object(raw.sky,'sky'),fog=object(raw.fog,'fog'),particles=object(raw.particles,'particles'),tint=key=>sky[key]===undefined?WHITE:triple(sky[key],'sky.'+key,...R.tintRange);
  const seen=new Set(),animations=list(raw.animations,'animations',R.maxAnimations).map((entry,index)=>{
    const label=`animations[${index}]`,{node,type}=object(entry,label);
    if(!ANIMATION_TYPES.includes(type))fail(`${label}.type must be one of ${ANIMATION_TYPES.join(', ')}`);
    if(typeof node!=='string'||!node.startsWith(`anim_${type}_`))fail(`${label}.node must be named anim_${type}_<n>`);
    if(seen.has(node))fail(`${label}.node ${node} is animated twice`);
    seen.add(node);return animationParams(type,node,entry,label);
  });
  const halos=list(raw.halos,'halos',R.maxHalos).map((entry,index)=>{
    const label=`halos[${index}]`,halo=object(entry,label),node=halo.node===undefined?null:nodeName(halo.node,label+'.node');
    return Object.freeze({position:node&&halo.position===undefined?null:triple(halo.position,label+'.position'),node,
      offset:halo.offset===undefined?ZERO:triple(halo.offset,label+'.offset',-100,100),color:triple(halo.color,label+'.color',0,4),
      radius:number(halo.radius,label+'.radius',.01,20),strength:number(halo.strength??1,label+'.strength',0,8),nightOnly:flag(halo.night_only,label+'.night_only',true)});
  });
  let moon=null;
  if(raw.moon!==undefined){
    const m=object(raw.moon,'moon');
    if((m.layer??'sky')!=='sky')fail('moon.layer must be "sky" (a sky ornament pinned to the frame)');
    moon=Object.freeze({node:nodeName(m.node,'moon.node'),screen:duo(m.screen,'moon.screen',0,1),diameter:number(m.diameter_frame_height,'moon.diameter_frame_height',.01,.5),
      meshRadius:number(m.mesh_radius,'moon.mesh_radius',.01,100),nightOnly:flag(m.night_only,'moon.night_only',true)});
  }
  if(!PARTICLE_TYPES.includes(particles.type??'none'))fail(`particles.type must be one of ${PARTICLE_TYPES.join(', ')}`);
  return Object.freeze({id:raw.id,name:typeof raw.name==='string'&&raw.name?raw.name:raw.id,version:raw.version,palette,nightPalette,
    recolor:Object.freeze({tolerance:number(recolor.tolerance??.01,'recolor.tolerance',0,R.maxTolerance),pairs:Object.freeze(pairs)}),overrides:Object.freeze(overrides),
    sky:Object.freeze({day_tint:tint('day_tint'),night_tint:tint('night_tint')}),
    fog:Object.freeze({color:fog.color===undefined?WHITE:triple(fog.color,'fog.color',0,1),density:number(fog.density??0,'fog.density',0,R.maxFogDensity),nightOnly:flag(fog.night_only,'fog.night_only',false)}),
    animations:Object.freeze(animations),halos:Object.freeze(halos),moon,
    particles:Object.freeze({type:particles.type??'none',rate:number(particles.rate??0,'particles.rate',0,1e4),intensity:number(particles.intensity??1,'particles.intensity',0,1),
      colors:Object.freeze(list(particles.colors,'particles.colors',16).map((colour,index)=>triple(colour,`particles.colors[${index}]`,0,1)))})});
}

// The GLB's own JSON chunk: size, compression, lights and node names, read before parsing.
export function glbInfo(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(16,true)!==0x4e4f534a||view.getUint32(12,true)>bytes.length-20)
    fail('theme.glb is not a binary glTF 2.0 file');
  const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+view.getUint32(12,true))));
  const used=json.extensionsUsed||[];
  return {bytes:bytes.length,draco:used.includes('KHR_draco_mesh_compression'),lights:used.includes('KHR_lights_punctual'),nodes:(json.nodes||[]).map(node=>node.name||'')};
}
export function packWarnings(pack,info){
  const warnings=[],names=new Set(info.nodes),mb=bytes=>(bytes/1048576).toFixed(2)+' MB';
  if(info.bytes>R.maxBytes)warnings.push(`theme.glb is ${mb(info.bytes)}, over the ${mb(R.maxBytes)} budget`);
  if(info.draco)warnings.push('theme.glb uses Draco; export it uncompressed (the decoder is released after the world loads)');
  if(info.lights)warnings.push('theme.glb contains lights; they are removed (the island keeps its 3-light budget)');
  const missing=[...pack.animations.map(a=>a.node),...pack.halos.map(h=>h.node).filter(Boolean),...(pack.moon?[pack.moon.node]:[])].filter(node=>!names.has(node));
  if(missing.length)warnings.push('nodes missing from theme.glb: '+[...new Set(missing)].join(', '));
  if(!DRAWN_PARTICLES.includes(pack.particles.type))warnings.push(`particles "${pack.particles.type}" are not drawn by the preview yet`);
  return warnings;
}

// ------------------------------------------------------------------ the look

// World vertex colours of one mesh under the pack: (r, g, b) -> the recolor pair (first) or
// the override that owns that vertex (its .night is the vertex's night multiplier), else null.
// Null: nothing to do.
export function worldOwner(mesh,pack){
  const pairs=pack.recolor.pairs.filter(p=>meshMatch(mesh,p.meshes)),override=pack.overrides.find(o=>meshMatch(mesh,o.meshes))||null,t=pack.recolor.tolerance;
  if(!pairs.length&&!override)return null;
  return (r,g,b)=>{
    for(const p of pairs)if(Math.abs(r-p.from[0])<=t&&Math.abs(g-p.from[1])<=t&&Math.abs(b-p.from[2])<=t)return p;
    return override;
  };
}
// The same, as the final colour: (r, g, b) -> the owner's colour, else null.
export function worldRemap(mesh,pack){
  const owner=worldOwner(mesh,pack);
  return owner&&((r,g,b)=>{const o=owner(r,g,b);return o?o.to??o.color:null;});
}
const unlit=multiplier=>multiplier.every(k=>k===1);
// Night multipliers blend in with the night: mix(1, multiplier, night).
export const nightMix=(multiplier,night)=>multiplier.map(k=>1+(k-1)*clamp(night));
// A category's palette multiplier at this night level (palette x night_palette).
export const paletteTint=(pack,kind,night)=>nightMix(pack.nightPalette[kind],night).map((k,i)=>pack.palette[kind][i]*k);
// The categories whose multiplier changes with the night (the Ambience updates only these).
export const nightKinds=pack=>PALETTE_KINDS.filter(kind=>pack?.nightPalette&&!unlit(pack.nightPalette[kind]));
// Does any recolor pair or override carry a night multiplier? Then every recoloured mesh gets themeNight.
export const nightOwners=pack=>[...pack.recolor.pairs,...pack.overrides].some(o=>!unlit(o.night));
export const nightByte=k=>Math.max(0,Math.min(255,Math.round(k*NIGHT_BYTE)));
export const skyTint=(pack,night)=>pack.sky.day_tint.map((day,i)=>day+(pack.sky.night_tint[i]-day)*clamp(night));
export const fogLevel=night=>1+(R.fogNight-1)*clamp(night);
export const grassWeight=([r,g,b])=>smooth(...R.grassKey,g-Math.max(r,b));
export const glowLevel=night=>R.glow.day+(R.glow.night-R.glow.day)*clamp(night);
export const nightFade=night=>smooth(...R.nightFade,night);
export const haloLevel=(night,nightOnly)=>nightOnly?nightFade(night):R.halo.day+(R.halo.night-R.halo.day)*clamp(night);
// Frame fraction (x right, y down) -> where the sky moon sits for an orthographic or perspective camera.
export function moonPose(camera,moon){
  camera.updateMatrixWorld();
  const position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();camera.matrixWorld.decompose(position,quaternion,scale);
  let width,height,depth=camera.far*R.moonDepth,cx=0,cy=0;
  if(camera.isOrthographicCamera){
    width=(camera.right-camera.left)/camera.zoom;height=(camera.top-camera.bottom)/camera.zoom;cx=(camera.right+camera.left)/2/camera.zoom;cy=(camera.top+camera.bottom)/2/camera.zoom;
  }else{height=2*depth*Math.tan(camera.fov*Math.PI/360)/camera.zoom;width=height*camera.aspect;}
  const along=(x,y,z)=>new THREE.Vector3(x,y,z).applyQuaternion(quaternion);
  position.addScaledVector(along(1,0,0),cx+(moon.screen[0]-.5)*width).addScaledVector(along(0,1,0),cy+(.5-moon.screen[1])*height).addScaledVector(along(0,0,1),-depth);
  return {position,quaternion,scale:moon.diameter*height/2/moon.meshRadius};
}

// ------------------------------------------------------------------ motion

export function orbitPose(a,t,center=a.center){
  const angle=a.phase+a.speed*t,[x,y,z]=center;
  return {position:[x+Math.cos(angle)*a.radius,y+a.bob*Math.sin(angle*R.orbitDip),z+Math.sin(angle)*a.radius],
    yaw:(a.speed<0?Math.PI:0)-angle,bank:Math.sign(a.speed)*R.orbitBank};
}
export const bobOffset=(a,t)=>({y:a.amplitude*Math.sin(a.phase+a.speed*t),twist:R.bobTwist*Math.min(1,a.amplitude/.25)*Math.sin(a.phase*1.7+a.speed*t*.5)});
// Three incommensurate waves: a candle that never repeats within a visit, yet is deterministic.
export function flickerNoise(x){return (1+.55*Math.sin(x)+.3*Math.sin(x*2.31+1.3)+.15*Math.sin(x*5.13+.7))/2;}
export const flickerLevel=(a,t)=>a.min+(a.max-a.min)*flickerNoise(a.phase+a.speed*t);
export const flapAngle=(a,t)=>a.angle*Math.sin(a.phase+a.speed*t);
export const swayAngles=(a,t)=>({x:a.angle*Math.sin(a.phase+a.speed*t),z:a.angle*R.sway.z*Math.sin(a.phase*R.sway.phase+a.speed*t*R.sway.rate)});
// Radians about the node's own up axis (the builder: rotation.y = phase + speed*t).
export const spinAngle=(a,t)=>a.phase+a.speed*t;

// ------------------------------------------------------------------ loading

// Both files are fetched fresh (the Blender theme builder re-exports in place).
// Missing or invalid pack: a console warning and null; the island stays as it is.
export async function loadThemePack(id,{loader,fetcher=globalThis.fetch,root=THEME_ROOT}={}){
  try{
    if(!THEME_ID.test(id||''))fail(`invalid theme id "${id}"`);
    const base=root+id+'/',get=(name,read)=>fetcher(base+name,{cache:'no-store'}).then(r=>r.ok?read(r):fail(`${name} not found (${r.status})`));
    const [raw,buffer]=await Promise.all([get('theme.json',r=>r.json()),get('theme.glb',r=>r.arrayBuffer())]);
    const meta=validateThemePack(raw,id),info=glbInfo(buffer);
    for(const warning of packWarnings(meta,info))console.warn(`Island theme "${id}": ${warning}.`);
    const gltf=await loader.parseAsync(buffer,base);
    return {meta,scene:gltf.scene,info};
  }catch(error){
    console.warn(`Island theme "${id}" unavailable; the island is unchanged. ${error.message}`);
    return null;
  }
}

// view: {scene, ambience?, renderer?, camera?, world?}; the applied theme is kept on view.theme.
// world is the island's world.glb scene (recolor and overrides); camera pins the sky moon.
export function applyTheme(view,pack){clearTheme(view);view.theme=new IslandTheme(view,pack);return view.theme;}
export function clearTheme(view){view.theme?.dispose();view.theme=null;}

// ------------------------------------------------------------------ the theme

const rawName=o=>o.userData?.name??o.name;
const Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),turn=new THREE.Quaternion(),bank=new THREE.Quaternion(),euler=new THREE.Euler();
const spot=new THREE.Vector3(),ahead=new THREE.Vector3();

export class IslandTheme{
  constructor(view,{meta,scene}){
    Object.assign(this,{view,meta,root:scene});
    this.root.name='Island theme '+meta.id;
    this.animations=[];this.glows=[];this.nights=[];this.nightNodes=[];this.materials=new Set();this.recoloured=[];this.followers=[];this.recolouredVertices=this.nightVertices=0;
    // The island's light budget is fixed: authored lamps become emission and halos.
    const extras=[];this.root.traverse(o=>{if(o.isLight||o.isCamera)extras.push(o);});
    extras.forEach(o=>o.removeFromParent());this.removed=extras.length;
    view.scene.add(this.root);this.root.updateMatrixWorld(true);
    this.moon=meta.moon&&this.find(meta.moon.node);
    if(meta.moon&&!this.moon)console.warn(`Island theme "${meta.id}": moon node ${meta.moon.node} is missing from theme.glb.`);
    if(this.moon&&this.moon.parent!==this.root)this.root.attach(this.moon);
    this.bindAnimations();this.bindMaterials();this.bindHalos();
    if(view.world)this.recolourWorld(view.world);
    if(meta.particles.type==='leaves'){this.leaves=makeLeaves(meta.particles);view.scene.add(this.leaves);}
    view.ambience?.setTheme?.(meta);
    if(view.renderer)view.renderer.shadowMap.needsUpdate=true;
    this.stats={meshes:0,animated:this.animations.length,glow:this.glows.length,night:this.nightNodes.length,halos:this.haloCount,followers:this.followers.length,
      recoloured:this.recolouredVertices,nightRecoloured:this.nightVertices,moon:!!this.moon,particles:DRAWN_PARTICLES.includes(meta.particles.type)?meta.particles.type:'none',lightsRemoved:this.removed};
    this.root.traverse(o=>{if(o.isMesh)this.stats.meshes++;});
    this.step(0,view.ambience?.state?.night??0);
  }
  find(name){let found=null;this.root.traverse(o=>{if(!found&&rawName(o)===name)found=o;});return found;}
  bindAnimations(){
    const entries=new Map(this.meta.animations.map(a=>[a.node,a]));
    this.root.traverse(node=>{
      const name=rawName(node),type=animationType(name);if(!type)return;
      const params=entries.get(name)||entries.get(node.name)||animationParams(type,name);
      const record={node,params,position:node.position.clone(),quaternion:node.quaternion.clone(),level:1};
      // theme.json centres are island space; the node moves in its parent's space.
      if(type==='orbit')record.center=params.center?node.parent.worldToLocal(new THREE.Vector3(...params.center)).toArray():node.position.toArray();
      if(type==='flap'){
        record.wings=[];
        node.traverse(child=>{const wing=/^wing_([lr])/.exec(rawName(child));if(wing&&child!==node)record.wings.push({node:child,side:wing[1]==='l'?1:-1,quaternion:child.quaternion.clone()});});
        if(!record.wings.length)console.warn(`Island theme "${this.meta.id}": ${name} has no wing_l / wing_r children to flap.`);
      }
      this.animations.push(record);
    });
  }
  // Each material is cloned per role (static, glow, night, sky moon, one flickering node)
  // so shared GLB materials never fight, then patched for rain, snow and night.
  bindMaterials(){
    const clones=new Map(),sources=new Set(),flickers=new Map(this.animations.filter(a=>a.params.type==='flicker').map(a=>[a.node,a]));
    const moonNight=this.moon&&this.meta.moon.nightOnly;
    this.root.traverse(o=>{if(rawName(o).startsWith('night_')||(moonNight&&o===this.moon))this.nightNodes.push(o);});
    this.root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      let glow=false,night=false,animated=false,sky=false,flicker=null;
      for(let o=mesh;o&&o!==this.root.parent;o=o.parent){
        const name=rawName(o),type=animationType(name);
        glow||=name.startsWith('glow_');night||=name.startsWith('night_');animated||=!!type;
        if(o===this.moon){sky=true;night||=moonNight;}
        if(type==='flicker'&&!flicker)flicker=flickers.get(o);
      }
      // Animated shadows would go stale: the island bakes its shadow map once per change.
      mesh.castShadow=!animated&&!night&&!sky;mesh.receiveShadow=!night&&!sky;
      // The sky moon is drawn first among the transparent parts, behind everything on the island.
      if(sky){mesh.frustumCulled=false;mesh.renderOrder=-1;}
      const kind=glow||flicker?'theme_glow':night?'theme_night':'details';
      const swap=source=>{
        const key=source.uuid+'|'+kind+'|'+(flicker?.node.uuid||'')+(sky?'|sky':'');sources.add(source);
        if(clones.has(key))return clones.get(key);
        const material=source.clone();material.customProgramCacheKey=()=>'island-theme-'+kind;
        if(sky)Object.assign(material,{fog:false,depthWrite:false,transparent:true});
        this.view.ambience?.patchMaterial(material,kind);this.materials.add(material);clones.set(key,material);
        if(night){material.transparent=true;this.nights.push({material,opacity:material.opacity});}
        // Every material with an emissive map glows (the pack's shared emissive palette), plus glow_* and flickering parts.
        if((glow||flicker||material.emissiveMap)&&'emissiveIntensity' in material)this.glows.push({material,intensity:material.emissiveIntensity,flicker});
        return material;
      };
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(swap):swap(mesh.material);
    });
    for(const source of sources)source.dispose();
  }
  // Halos with a node follow it (its origin + offset); one whose node is missing is dropped.
  bindHalos(){
    const entries=[];
    for(const halo of this.meta.halos){
      const target=halo.node?this.find(halo.node):null;
      if(halo.node&&!target){console.warn(`Island theme "${this.meta.id}": halo node ${halo.node} is missing from theme.glb.`);continue;}
      entries.push({halo,target,offset:new THREE.Vector3(...halo.offset)});
    }
    this.haloCount=entries.length;if(!entries.length)return;
    this.halos=makeHalos(entries.map(({halo,target,offset})=>({...halo,position:target?target.getWorldPosition(spot).add(offset).toArray():halo.position})));
    this.followers=entries.map((entry,index)=>({...entry,index})).filter(entry=>entry.target);
    this.view.scene.add(this.halos);
  }
  // recolor pairs, then overrides, on the island's own world.glb vertex colours. The
  // recoloured vertices carry themeKeep = 1, so the palette multipliers skip them.
  // When the pack gives pairs or overrides a night multiplier, every recoloured mesh also
  // carries themeNight (that multiplier per owned vertex, NIGHT_BYTE = 1; Ambience blends it
  // in with the night).
  // An override owns its meshes while the theme is on: a material tint (the island
  // identity's banner colour, island-identity.mjs) steps aside and comes back on clear.
  recolourWorld(world){
    const geometries=new Set(),withNight=nightOwners(this.meta),bytes=new Map();
    const nightOf=owner=>{if(!bytes.has(owner))bytes.set(owner,unlit(owner.night)?null:owner.night.map(nightByte));return bytes.get(owner);};
    world.traverse(mesh=>{
      if(!mesh.isMesh)return;
      for(let o=mesh;o;o=o.parent)if(o===this.root)return;
      const name=rawName(mesh),colour=mesh.geometry?.getAttribute('color'),owner=colour&&!geometries.has(mesh.geometry)&&worldOwner(name,this.meta);
      if(!owner)return;
      geometries.add(mesh.geometry);
      const original=colour.array.slice(),keep=new Float32Array(colour.count),night=withNight?new Uint8Array(colour.count*4).fill(NIGHT_BYTE):null;let changed=0,lit=0;
      for(let i=0;i<colour.count;i++){
        const o=owner(colour.getX(i),colour.getY(i),colour.getZ(i));if(!o)continue;
        const to=o.to??o.color;colour.setXYZ(i,to[0],to[1],to[2]);keep[i]=1;changed++;
        const k=night&&nightOf(o);if(k){night[i*4]=k[0];night[i*4+1]=k[1];night[i*4+2]=k[2];lit++;}
      }
      if(!changed)return;
      colour.needsUpdate=true;mesh.geometry.setAttribute('themeKeep',new THREE.BufferAttribute(keep,1));
      if(night)mesh.geometry.setAttribute('themeNight',new THREE.BufferAttribute(night,4,true));
      const materials=[].concat(mesh.material),tints=[];
      for(const material of materials){material.userData.themeKeep=true;material.userData.themeNight=!!night;material.needsUpdate=true;}
      if(this.meta.overrides.some(o=>meshMatch(name,o.meshes))){
        for(const material of materials){tints.push({material,vertexColors:material.vertexColors,color:material.color?.clone()});material.vertexColors=true;material.color?.setRGB(1,1,1);}
        mesh.userData.themeOverride=true;
      }
      this.recoloured.push({mesh,colour,original,materials,tints});this.recolouredVertices+=changed;this.nightVertices+=lit;
    });
  }
  step(seconds,night=0){
    for(const a of this.animations){
      const p=a.params,node=a.node;
      if(p.type==='orbit'){
        // Facing the path replaces the authored yaw: the builder exports each flyer already turned along its path.
        const pose=orbitPose(p,seconds,a.center);node.position.fromArray(pose.position);
        if(p.faceTravel)node.quaternion.copy(turn.setFromAxisAngle(Y,pose.yaw)).multiply(bank.setFromAxisAngle(Z,pose.bank));
      }else if(p.type==='bob'){
        const b=bobOffset(p,seconds);node.position.copy(a.position);node.position.y+=b.y;node.quaternion.copy(a.quaternion).multiply(turn.setFromAxisAngle(Y,b.twist));
      }else if(p.type==='flicker')a.level=flickerLevel(p,seconds);
      else if(p.type==='flap'){const angle=flapAngle(p,seconds);for(const w of a.wings)w.node.quaternion.copy(w.quaternion).multiply(turn.setFromAxisAngle(Z,angle*w.side));}
      else if(p.type==='spin')node.quaternion.copy(a.quaternion).multiply(turn.setFromAxisAngle(Y,spinAngle(p,seconds)));
      else if(p.type==='sway'){const s=swayAngles(p,seconds);node.quaternion.copy(a.quaternion).multiply(turn.setFromEuler(euler.set(s.x,0,s.z)));}
    }
    const glow=glowLevel(night),fade=nightFade(night);
    for(const g of this.glows)g.material.emissiveIntensity=g.intensity*glow*(g.flicker?.level??1);
    for(const n of this.nights)n.material.opacity=n.opacity*fade;
    for(const node of this.nightNodes)node.visible=fade>.01;
    if(this.halos){
      const u=this.halos.material.uniforms;u.levelAll.value=haloLevel(night,false);u.levelNight.value=haloLevel(night,true);
      this.halos.visible=u.levelAll.value>.005||u.levelNight.value>.005;
      if(this.followers.length){
        const anchor=this.halos.geometry.getAttribute('anchor');
        for(const f of this.followers){f.target.getWorldPosition(spot).add(f.offset);anchor.setXYZ(f.index,spot.x,spot.y,spot.z);}
        anchor.needsUpdate=true;
      }
    }
    const camera=this.view.camera;
    if(this.moon&&camera){const pose=moonPose(camera,this.meta.moon);this.moon.position.copy(pose.position);this.moon.quaternion.copy(pose.quaternion);this.moon.scale.setScalar(pose.scale);}
    if(this.leaves){
      const u=this.leaves.material.uniforms;u.clock.value=seconds;u.light.value=1+(R.leaves.night-1)*clamp(night);
      this.leaves.visible=!this.view.ambience?.reduced;
      if(camera){
        // The pool follows the view like the weather: centred where the camera looks at the deck.
        camera.getWorldDirection(ahead);const distance=(6-camera.position.y)/ahead.y;
        u.center.value.copy(camera.position).addScaledVector(ahead,Number.isFinite(distance)?Math.max(0,distance):0);
        if(camera.isOrthographicCamera)u.radius.value=Math.min(38,Math.max(18,(camera.right-camera.left)/camera.zoom*.7));
        u.cameraRight.value.setFromMatrixColumn(camera.matrixWorld,0);u.cameraUp.value.setFromMatrixColumn(camera.matrixWorld,1);
      }
    }
  }
  dispose(){
    this.root.removeFromParent();this.halos?.removeFromParent();this.leaves?.removeFromParent();
    const textures=new Set();
    for(const material of this.materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
    textures.forEach(texture=>texture.dispose());
    this.root.traverse(o=>o.geometry?.dispose());
    for(const mesh of [this.halos,this.leaves])if(mesh){mesh.geometry.dispose();mesh.material.dispose();}
    for(const r of this.recoloured){
      r.colour.array.set(r.original);r.colour.needsUpdate=true;r.mesh.geometry.deleteAttribute('themeKeep');r.mesh.geometry.deleteAttribute('themeNight');
      for(const material of r.materials){material.userData.themeKeep=material.userData.themeNight=false;material.needsUpdate=true;}
      for(const tint of r.tints){tint.material.vertexColors=tint.vertexColors;if(tint.color)tint.material.color.copy(tint.color);}
      delete r.mesh.userData.themeOverride;
    }
    this.recoloured=[];
    this.view.ambience?.setTheme?.(null);
    if(this.view.renderer)this.view.renderer.shadowMap.needsUpdate=true;
  }
}
// One additive billboard batch for every halo of the pack: colour*strength*(1 - d)^2.
function makeHalos(halos){
  const g=new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1,1));g.instanceCount=halos.length;
  const attribute=(values,size)=>new THREE.InstancedBufferAttribute(new Float32Array(values),size);
  g.setAttribute('anchor',attribute(halos.flatMap(h=>h.position),3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('extent',attribute(halos.map(h=>h.radius*2),1));
  g.setAttribute('glowColor',attribute(halos.flatMap(h=>h.color),3));
  g.setAttribute('nightOnly',attribute(halos.map(h=>h.nightOnly?1:0),1));g.setAttribute('strength',attribute(halos.map(h=>h.strength),1));
  const m=new THREE.ShaderMaterial({uniforms:{levelAll:{value:0},levelNight:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 anchor,glowColor;attribute float extent,nightOnly,strength;uniform float levelAll,levelNight;varying vec2 q;varying vec3 tint;varying float amount;
    void main(){q=uv;tint=glowColor;amount=mix(levelAll,levelNight,nightOnly)*strength;vec4 p=modelViewMatrix*vec4(anchor,1.);p.xy+=position.xy*extent;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec2 q;varying vec3 tint;varying float amount;void main(){float f=max(0.,1.-length((q-.5)*2.));gl_FragColor=vec4(tint,f*f*amount);
    #include <colorspace_fragment>
    }`});
  const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=4;mesh.name='Island theme halos';return mesh;
}
// Falling leaves: one wrapped, camera-facing batch like the weather pools (rate leaves a second).
function makeLeaves({rate,colors}){
  const L=R.leaves,count=Math.round(Math.min(L.max,Math.max(L.min,rate*L.fallSeconds))),palette=colors.length?colors:[[.85,.42,.12]];
  let seed=7177;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const g=new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1,1));g.instanceCount=count;
  g.setAttribute('seed',new THREE.InstancedBufferAttribute(Float32Array.from({length:count*4},random),4));
  g.setAttribute('leafColor',new THREE.InstancedBufferAttribute(new Float32Array(Array.from({length:count},(_,i)=>palette[i%palette.length]).flat()),3));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{clock:{value:0},light:{value:1},radius:{value:26},center:{value:new THREE.Vector3(0,6,0)},cameraRight:{value:new THREE.Vector3(1,0,0)},cameraUp:{value:new THREE.Vector3(0,1,0)}},
    vertexShader:`attribute vec4 seed;attribute vec3 leafColor;uniform float clock,radius;uniform vec3 center,cameraRight,cameraUp;varying vec2 q;varying vec3 tint;varying float fade;
    void main(){q=uv;tint=leafColor;float t=clock/${L.fallSeconds.toFixed(1)}+seed.w;
      vec3 p=vec3((seed.x-.5)*radius*2.,mix(5.9,19.,1.-fract(t)),(seed.y-.5)*radius*2.);
      p.x+=sin(clock*.8+seed.z*31.)*1.2;p.z+=cos(clock*.63+seed.z*17.)*.9;p.xz+=center.xz;
      fade=smoothstep(5.9,7.,p.y)*(1.-smoothstep(.8,1.,max(abs(seed.x-.5),abs(seed.y-.5))*2.));
      vec2 v=position.xy*(.2+seed.z*.14);v.y*=.35+.65*abs(sin(clock*(1.6+seed.y*1.4)+seed.x*40.));
      float spin=clock*(1.2+seed.z*1.8)+seed.w*6.2832;v=vec2(v.x*cos(spin)-v.y*sin(spin),v.x*sin(spin)+v.y*cos(spin));
      p+=cameraRight*v.x+cameraUp*v.y;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float light;varying vec2 q;varying vec3 tint;varying float fade;
    void main(){vec2 d=abs(q-.5)*2.;float a=(1.-smoothstep(.75,1.,d.x+d.y*d.y*.9))*fade;if(a<.02)discard;gl_FragColor=vec4(tint*light,a);
    #include <colorspace_fragment>
    }`});
  const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=12;mesh.name='Island theme leaves';return mesh;
}
