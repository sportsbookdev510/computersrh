import * as THREE from 'three';
import {ambienceOptions,ambienceState,WEATHER_BUDGET,clothBanner} from './ambience-model.mjs';
import {WeatherFX} from './weather-fx.mjs';
import {islandLightRig} from './island-lights.mjs';
import {skyTint,fogLevel,nightFade,paletteTint,nightKinds,NIGHT_BYTE,THEME_RUNTIME} from './island-theme.mjs';

const C=hex=>new THREE.Color(hex);
const PLAZA_LIGHTS=Object.freeze({glb:'/_media/6ef60a956dead58595e7e27ad7c79d2555542ab53de3d39f50a64940433ce311/exports/concept1-32/ambience-lights.glb',json:'/exports/concept1-32/ambience-lights.json'});
// Lights that exist only while a plot deck is open or a POWER tier is built.
const lightGroup=name=>name.match(/^ambience_(?:lanterns|fixtures)_(.+)$/)?.[1]||null;
const staticGroup=group=>!group||group==='world'||group==='plot_1';
export class Ambience{
  constructor({scene,background,hemi,sun,sky,reduced,renderer,lights=PLAZA_LIGHTS}){
    Object.assign(this,{scene,background,hemi,sun,sky,reduced,renderer,lights});this.options=ambienceOptions(location.search);
    this.uniforms={night:{value:0},rain:{value:0},snowCover:{value:0}};
    this.daySky=C('#edf5ff');this.nightSky=C('#adb8e7');this.dayGround=C('#859b87');this.nightGround=C('#766789');
    this.sunDay=C('#fff0d2');this.sunNight=C('#acbdff');this.sunDusk=C('#ffb58b');this.overcast=C('#b5cadc');
    this.origin=new THREE.Vector3();this.color=new THREE.Color();this.screenOffset=new THREE.Vector3(0,0,1.0);this.rgbOffset=new THREE.Vector3(0,1.2,1.4);
    // Fixed light count: no lights per remote desk and no extra shadow maps.
    this.pointLights=Array.from({length:WEATHER_BUDGET.pointLights},(_,i)=>{const l=new THREE.PointLight(i===0?'#7bb6ff':i===1?'#b48bff':'#ffbf72',0,6,2);l.layers.enable(1);scene.add(l);return l;});
    // Island theme preview (island-theme.mjs): a palette multiplier per material category;
    // the categories with a night_palette entry are re-tinted every step as the night changes.
    this.tints=new Map();this.grassTint={value:new THREE.Color(1,1,1)};this.themeTint=new THREE.Color();this.theme=this.themeFog=null;this.themeNightKinds=[];
  }
  tint(kind){let uniform=this.tints.get(kind);if(!uniform)this.tints.set(kind,uniform={value:new THREE.Color(1,1,1)});return uniform;}
  patchMaterial(material,kind){
    if(kind.startsWith('building_'))kind='architecture';
    if(kind.startsWith('plot_')||kind.startsWith('power_t'))kind='details';
    material.userData.islandAmbience=true;
    const original=material.onBeforeCompile;const key=material.customProgramCacheKey();
    const tint=this.tint(kind),lawn={value:kind==='terrain'?1:0},[lawnFrom,lawnTo]=THEME_RUNTIME.grassKey;
    material.onBeforeCompile=shader=>{
      original.call(material,shader);Object.assign(shader.uniforms,{ambNight:this.uniforms.night,ambRain:this.uniforms.rain,ambSnow:this.uniforms.snowCover,
        ambTint:tint,ambGrassTint:this.grassTint,ambLawn:lawn});
      shader.vertexShader='varying float upwardSurface;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nupwardSurface=smoothstep(.45,.94,normal.y);');
      shader.fragmentShader='uniform float ambNight,ambRain,ambSnow,ambLawn;uniform vec3 ambTint,ambGrassTint;varying float upwardSurface;\n'+shader.fragmentShader;
      if(['terrain','paving','architecture','trees','gardens','details'].includes(kind))shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.79,ambRain*upwardSurface*.38);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.79,.85,.92),ambSnow*upwardSurface*.76);`);
      // The theme tint goes first, so rain and snow still cover the themed colours.
      // Every material carries the same code; only terrain (ambLawn) splits off its green lawn.
      // A theme's recoloured world vertices (themeKeep = 1, island-theme.mjs) are final: no tint,
      // only their own night multiplier (themeNight, blended in with the night) when the pack has one.
      const tinted=`mix(ambTint,ambGrassTint,ambLawn*smoothstep(${lawnFrom.toFixed(3)},${lawnTo.toFixed(3)},diffuseColor.g-max(diffuseColor.r,diffuseColor.b)))`;
      const keep=material.userData.themeKeep,keepNight=keep&&material.userData.themeNight;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        diffuseColor.rgb*=${keep?`mix(${tinted},${keepNight?'mix(vec3(1.),themeNightVertex,ambNight)':'vec3(1.)'},themeKeepVertex)`:tinted};`);
      if(keep){
        shader.vertexShader='attribute float themeKeep;varying float themeKeepVertex;\n'+(keepNight?'attribute vec4 themeNight;varying vec3 themeNightVertex;\n':'')+
          shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nthemeKeepVertex=themeKeep;'+(keepNight?`themeNightVertex=themeNight.rgb*(255./${NIGHT_BYTE}.);`:''));
        shader.fragmentShader='varying float themeKeepVertex;\n'+(keepNight?'varying vec3 themeNightVertex;\n':'')+shader.fragmentShader;
      }
      if(material.userData.lanternWarmth){
        shader.vertexShader='attribute vec3 lanternWarmth;varying vec3 localWarmth;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlocalWarmth=lanternWarmth;');
        shader.fragmentShader='varying vec3 localWarmth;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight += diffuseColor.rgb * localWarmth * ambNight;\n#include <opaque_fragment>');
      }
    };
    material.customProgramCacheKey=()=>key+'-ambience-reference-v3-'+Boolean(material.userData.lanternWarmth)+
      (material.userData.themeKeep?'-theme-keep'+(material.userData.themeNight?'-night':''):'');
  }
  async load(loader,localSources=[]){
    const [gltf,data]=await Promise.all([loader.loadAsync(this.lights.glb),fetch(this.lights.json).then(r=>r.json())]);
    this.data=data;this.overlay=gltf.scene;this.scene.add(this.overlay);this.emissions=[];
    const rig=islandLightRig(data.lamps,data.screens,data.landmarks);
    // Monument spill joins the same baked surface-light batch and night fade.
    rig.sources.push(...localSources);
    // Baked warmth is static; lamps of closed plots and unbuilt POWER tiers
    // only glow (halos, pools, glass) while their group is shown.
    this.bakeSources=rig.sources.filter(source=>staticGroup(source.group));this.centerSources=localSources;
    this.bakeLanternWarmth(this.bakeSources);
    this.overlay.traverse(o=>{if(!o.isMesh)return;o.material.dispose();
      const screen=o.name==='ambience_screens';
      const mat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,color:screen?new THREE.Color(1.6,1.9,2.1):o.name.startsWith('ambience_lanterns')?new THREE.Color(1.7,.82,.22):new THREE.Color(1,1,1)});
      if(screen)this.makeScreenGradient(o,mat,data.screens);
      o.material=mat;this.emissions.push(mat);o.renderOrder=3;
    });
    this.pools=this.makeGlows(rig.pools,false);
    this.halos=this.makeGlows(rig.halos,true);
    this.bulbs=this.makeBulbs(rig.bulbs);
    this.glowEntries=[[this.pools,rig.pools],[this.halos,rig.halos]];this.bulbEntries=rig.bulbs;
    this.weather=new WeatherFX(this.scene,data.splashes,this.reduced);
    this.applyExtraLights('power');this.applyExtraLights('hall');this.applyGroups();
  }
  // A theme pack (island-theme.mjs validateThemePack): palette multipliers (night_palette
  // blended in every step), the sky tint, a pack moon instead of the sky's own, theme snow
  // (applied every step) and the island haze; null restores the authored island.
  setTheme(pack){
    this.theme=pack||null;
    for(const uniform of [...this.tints.values(),this.grassTint])uniform.value.setRGB(1,1,1);
    for(const [kind,value] of Object.entries(pack?.palette||{}))(kind==='grass'?this.grassTint:this.tint(kind)).value.fromArray(value);
    this.themeNightKinds=nightKinds(pack);this.themePalette(this.state?.night??0);
    if(!('authoredFog' in this))this.authoredFog=this.scene.fog;
    this.themeFog=pack?.fog.density>0?new THREE.FogExp2(new THREE.Color().setRGB(...pack.fog.color,THREE.SRGBColorSpace),pack.fog.density):null;
    this.scene.fog=this.themeFog||this.authoredFog;
  }
  // The categories the pack's night_palette changes, at this night level (palette x mix(1, night, night level)).
  themePalette(night){
    for(const kind of this.themeNightKinds)(kind==='grass'?this.grassTint:this.tint(kind)).value.fromArray(paletteTint(this.theme,kind,night));
  }
  // Personal island: show the night lights of open plot decks and the built POWER tier.
  // ``powerStage`` / ``hallStage``: the lights of the POWER level stage and of the Island Hall
  // stage on show (drafts, personal-island.mjs), or null; left out, those lights stay as they are.
  setGroups(groups,{powerStage,hallStage}={}){
    this.groups=new Set(groups);
    if(powerStage!==undefined){this.extraLights.power=powerStage;this.applyExtraLights('power');}
    if(hallStage!==undefined){this.extraLights.hall=hallStage;this.applyExtraLights('hall');}
    this.applyGroups();
  }
  get extraLights(){return this._extraLights||(this._extraLights={power:null,hall:null});}
  get powerStage(){return this.extraLights.power;}
  applyPowerStage(){this.applyExtraLights('power');}
  // A stage's glowing faces and lantern glass join the night overlay; its light spots get
  // their own pools and halos (the same look as the world's yards, added and removed per stage).
  applyExtraLights(key){
    const shown=this._extraShown||(this._extraShown={}),overlays=this._extraOverlay||(this._extraOverlay={}),glows=this._extraGlows||(this._extraGlows={});
    const stage=this.extraLights[key]||null;
    if(!this.overlay||shown[key]===stage)return;
    for(const mesh of overlays[key]||[])mesh.removeFromParent();
    for(const mesh of glows[key]||[]){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}
    const old=new Set((overlays[key]||[]).map(mesh=>mesh.material));
    this.emissions=(this.emissions||[]).filter(material=>!old.has(material));
    overlays[key]=[];glows[key]=[];shown[key]=stage;
    if(!stage)return;
    for(const mesh of stage.overlay||[]){
      if(!mesh.userData.ambience){
        mesh.material.dispose?.();
        mesh.material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
          color:mesh.name.startsWith('ambience_lanterns')?new THREE.Color(1.7,.82,.22):new THREE.Color(1,1,1)});
        mesh.renderOrder=3;mesh.userData.ambience=true;
      }
      this.overlay.add(mesh);overlays[key].push(mesh);this.emissions.push(mesh.material);
    }
    const rig=islandLightRig(stage.lamps||[],[],{fixtures:stage.fixtures||[],bulbs:[],cherries:[]});
    if(rig.pools.length)glows[key].push(this.makeGlows(rig.pools,false));
    if(rig.halos.length)glows[key].push(this.makeGlows(rig.halos,true));
    // A stage that brings its meshes (the Island Hall) gets the world lanterns' baked warmth like the world itself
    // (its own lights already glow through the overlay, pools and halos; baked as well they would wash it out).
    if(stage.meshes?.length&&this.bakeSources)this.bakeLanternWarmth(this.bakeSources,{meshes:stage.meshes});
  }
  get stageGlows(){return Object.values(this._extraGlows||{}).flat();}
  applyGroups(){
    if(!this.groups||!this.overlay)return;
    const shown=group=>staticGroup(group)||this.groups.has(group);
    this.overlay.traverse(o=>{if(o.isMesh&&lightGroup(o.name))o.visible=shown(lightGroup(o.name));});
    for(const [mesh,entries] of this.glowEntries){
      const strength=mesh.geometry.getAttribute('strength');
      entries.forEach((entry,i)=>strength.setX(i,shown(entry.group)?entry.strength:0));strength.needsUpdate=true;
    }
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
    this.bulbEntries.forEach((entry,i)=>{position.fromArray(entry.position);scale.setScalar(shown(entry.group)?entry.size:0);matrix.compose(position,rotation,scale);this.bulbs.setMatrixAt(i,matrix);});
    this.bulbs.instanceMatrix.needsUpdate=true;
  }
  // The fountain's own light (the orb's green, or a centerpiece's glow: draft-tryon.mjs)
  // baked again in place of the previous one, into the meshes baked at load only.
  setCenterSources(sources){
    if(!this.bakeSources)return;
    const previous=new Set(this.centerSources||[]);
    this.bakeSources=[...this.bakeSources.filter(source=>!previous.has(source)),...sources];this.centerSources=sources;
    this.bakeLanternWarmth(this.bakeSources,{near:[...previous,...sources]});
  }
  // near: re-bake only the vertices those sources reach (the rest keep their warmth).
  // meshes: bake only these (meshes added after load), not the whole scene.
  bakeLanternWarmth(sources,{near=null,meshes=null}={}){
    // Static RGB irradiance lets orange fixtures and blue screens illuminate
    // stone, timber and blossom canopies without dozens of realtime lights.
    this.scene.updateMatrixWorld(true);const point=new THREE.Vector3(),sphere=new THREE.Sphere();
    const reach=source=>source.radius/Math.min(1,source.verticalScale??.64);
    const reaches=p=>near.some(source=>{const [x,y,z]=source.position;return (p.x-x)**2+(p.y-y)**2+(p.z-z)**2<reach(source)**2;});
    (meshes?visit=>meshes.forEach(visit):visit=>this.scene.traverse(visit))(o=>{
      if(!o.isMesh||!o.material?.userData?.islandAmbience||['water','cloth','crystal'].includes(o.name)||clothBanner(o.name))return;
      if(near){
        if(!o.geometry.getAttribute('lanternWarmth'))return;
        if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
        sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
        if(!near.some(source=>sphere.center.distanceTo(point.fromArray(source.position))<sphere.radius+reach(source)))return;
      }
      // Instanced and add-on meshes (draft decor) carry no per-vertex warmth of their own.
      if(o.isInstancedMesh||o.userData?.noLanternBake)return;
      const position=o.geometry.attributes.position,values=near?o.geometry.getAttribute('lanternWarmth').array:new Float32Array(position.count*3);
      for(let i=0;i<position.count;i++){
        point.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);let r=0,g=0,b=0;
        if(near&&!reaches(point))continue;
        for(const source of sources){
          const [x,y,z]=source.position,dx=point.x-x,dy=(point.y-y)*(source.verticalScale??.64),dz=point.z-z;
          const distance2=dx*dx+dy*dy+dz*dz;
          if(distance2<source.radius*source.radius){
            const trunkShade=(source.canopyMin!==undefined&&point.y<source.canopyMin)? .18 : 1;
            const bounce=Math.pow(1-Math.sqrt(distance2)/source.radius,1.65)*source.power*trunkShade;
            r+=bounce*source.color[0];g+=bounce*source.color[1];b+=bounce*source.color[2];
          }
        }
        values[i*3]=Math.min(1.65,r);values[i*3+1]=Math.min(1.20,g);values[i*3+2]=Math.min(.90,b);
      }
      if(near){o.geometry.getAttribute('lanternWarmth').needsUpdate=true;return;}
      o.geometry.setAttribute('lanternWarmth',new THREE.BufferAttribute(values,3));o.material.userData.lanternWarmth=true;o.material.needsUpdate=true;
    });
  }
  makeScreenGradient(mesh,material,screens){
    const position=mesh.geometry.attributes.position,coords=new Float32Array(position.count*2),p=new THREE.Vector3();
    for(let i=0;i<position.count;i++){
      p.fromBufferAttribute(position,i);let nearest=screens[0],distance=Infinity;
      for(const screen of screens){const s=screen.position,d=(s[0]-p.x)**2+(s[1]-p.y)**2+(s[2]-p.z)**2;if(d<distance){distance=d;nearest=screen;}}
      coords[i*2]=(p.x-nearest.position[0])/1.3+.5;coords[i*2+1]=(p.y-nearest.position[1])/.75+.5;
    }
    mesh.geometry.setAttribute('screenCoord',new THREE.BufferAttribute(coords,2));material.vertexColors=false;material.color.set('white');
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute vec2 screenCoord;varying vec2 displayUV;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndisplayUV=screenCoord;');
      shader.fragmentShader='varying vec2 displayUV;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float shine=clamp((1.-displayUV.x)*.64+displayUV.y*.36,0.,1.);
        diffuseColor.rgb=mix(vec3(.003,.065,.30),vec3(.025,.53,.94),pow(shine,.78));`);
    };material.customProgramCacheKey=()=> 'cozy-night-monitor-gradient';
  }
  makeBulbs(entries){
    const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:'#fff0ae',transparent:true,opacity:0,depthWrite:false}),entries.length);
    const matrix=new THREE.Matrix4(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),position=new THREE.Vector3();
    entries.forEach((entry,i)=>{position.fromArray(entry.position);scale.setScalar(entry.size);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);});
    mesh.name='Landmark amber bulbs';mesh.instanceMatrix.needsUpdate=true;this.scene.add(mesh);return mesh;
  }
  makeGlows(entries,billboard){
    const g=new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1,1));g.instanceCount=entries.length;
    g.setAttribute('anchor',new THREE.InstancedBufferAttribute(new Float32Array(entries.flatMap(e=>e.position)),3));
    g.setAttribute('extent',new THREE.InstancedBufferAttribute(new Float32Array(entries.flatMap(e=>e.size)),2));
    g.setAttribute('glowColor',new THREE.InstancedBufferAttribute(new Float32Array(entries.flatMap(e=>C(e.color).toArray())),3));
    g.setAttribute('strength',new THREE.InstancedBufferAttribute(new Float32Array(entries.map(e=>e.strength)),1));
    const m=new THREE.ShaderMaterial({uniforms:{night:this.uniforms.night},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:`attribute vec3 anchor,glowColor;attribute vec2 extent;attribute float strength;varying vec2 q;varying vec3 tint;varying float amount;
      void main(){q=uv;tint=glowColor;amount=strength;${billboard?'vec4 p=modelViewMatrix*vec4(anchor,1.);p.xy+=position.xy*extent;gl_Position=projectionMatrix*p;':'vec3 p=anchor+vec3(position.x*extent.x,0.,position.y*extent.y);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);'}}`,
      fragmentShader:`uniform float night;varying vec2 q;varying vec3 tint;varying float amount;void main(){float d=length((q-.5)*2.);float glow=pow(max(0.,1.-d),1.7);gl_FragColor=vec4(tint,glow*amount*night);
      #include <colorspace_fragment>
      }`});
    const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=4;mesh.name=billboard?'Lantern soft halos':'Light pools';this.scene.add(mesh);return mesh;
  }
  step(seconds,camera,workshop,aspect=innerWidth/innerHeight){
    const s=ambienceState(seconds,this.optionsWithMotion||(this.optionsWithMotion={...this.options,reduced:this.reduced}));this.state=s;
    // Theme snow is decoration, not a storm: a steady fall under a clear sky, no rain and no
    // ground cover (the pack's recolor already paints the snow).
    const particles=this.theme?.particles;
    if(particles?.type==='snow')Object.assign(s,{snow:particles.intensity,rain:0,cover:0,cloud:0});
    this.uniforms.night.value=s.night;this.uniforms.rain.value=s.rain;this.uniforms.snowCover.value=s.cover;
    if(this.themeNightKinds.length)this.themePalette(s.night);
    this.hemi.color.copy(this.daySky).lerp(this.nightSky,s.night);this.hemi.groundColor.copy(this.dayGround).lerp(this.nightGround,s.night);
    this.hemi.intensity=THREE.MathUtils.lerp(1.9,1.30,s.night)*(1-s.cloud*.18);
    this.sun.color.copy(this.sunDay).lerp(this.sunNight,s.night).lerp(this.sunDusk,s.dusk*.5);
    this.sun.intensity=THREE.MathUtils.lerp(2.15,.80,s.night)*(1-s.cloud*.55);
    this.orbit=this.sky.step(seconds,s,this.reduced,aspect);
    if(this.theme){
      // The sky just recomputed its colours: the theme tints the gradient, horizon haze and cloud sea.
      const tint=this.themeTint.fromArray(skyTint(this.theme,s.night)),u=this.sky.uniforms;
      u.zenith.value.multiply(tint);u.horizon.value.multiply(tint);
      this.background.fog?.color.multiply(tint);this.sky.horizon?.clouds?.material.uniforms.fogColor?.value.multiply(tint);
      // The pack's moon (pinned to the frame by island-theme.mjs) replaces the sky's own.
      if(this.theme.moon)u.moonPosition.value.set(-9,-9);
      if(this.themeFog){
        const fog=this.theme.fog;this.themeFog.color.setRGB(...fog.color,THREE.SRGBColorSpace);
        if(fog.nightOnly)this.themeFog.density=fog.density*nightFade(s.night);else this.themeFog.color.multiplyScalar(fogLevel(s.night));
      }
    }
    if(this.overlay)this.overlay.visible=s.night>.005;
    // Detailed desks supply their own screens and fan RGB; baked equipment
    // lights belong to the placeholder furniture that the playground replaces.
    if(workshop?.playground||workshop?.personalIsland){
      for(const name of ['ambience_screens','ambience_rgb'])this.overlay?.getObjectByName(name)?.traverse(o=>o.visible=false);
    }
    for(const m of this.emissions||[])m.opacity=s.night*.92;
    if(this.pools){this.pools.visible=this.halos.visible=s.night>.005;}
    for(const glow of this.stageGlows||[])glow.visible=s.night>.005;
    if(this.bulbs){this.bulbs.visible=s.night>.005;this.bulbs.material.opacity=s.night;}
    const inspection=workshop?.mode==='build';this.weather?.step(seconds,s,camera,inspection);
    const rgb=workshop?.assets.rgb,screen=workshop?.wallpaper.screen;
    if(rgb)rgb.night.value=s.night;
    if(screen){
      screen.getWorldPosition(this.origin);this.pointLights[0].position.copy(this.origin).add(this.screenOffset);this.pointLights[0].intensity=.65*s.night;
      workshop.rig.getWorldPosition(this.origin);this.pointLights[1].position.copy(this.origin).add(this.rgbOffset);
      this.pointLights[1].color.copy(rgb.color.value);
      if(rgb.mode.value===0)this.pointLights[1].color.setHSL((seconds*.045)%1,.68,.68);
      const breathe=rgb.mode.value===2?.35+.65*(.5+.5*Math.sin(seconds*1.3)):1;
      const lit=[...workshop.parts.values()].some(p=>p.root.visible&&p.materials.some(m=>m.userData.rgb&&m.userData.rgbEnabled.value));
      this.pointLights[1].intensity=lit&&rgb.mode.value!==3?.75*s.night*rgb.brightness.value*breathe:0;
      this.pointLights[2].position.set(-4,10,5);this.pointLights[2].intensity=s.night*.6;
    }
    return s;
  }
}
