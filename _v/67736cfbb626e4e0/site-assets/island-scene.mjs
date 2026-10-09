import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { CozySky } from '/_v/67736cfbb626e4e0/preview/plaza32/cozy-sky.mjs';
import { Ambience } from '/_v/67736cfbb626e4e0/preview/plaza32/ambience.mjs';
import { loadRobinhoodLandmark } from '/_v/67736cfbb626e4e0/preview/plaza32/robinhood-landmark.mjs';
import { SoftNightGlow } from '/_v/67736cfbb626e4e0/preview/plaza32/soft-night-glow.mjs';
import { worldView } from '/_v/67736cfbb626e4e0/preview/plaza32/world-view.mjs';
import { islandPose, renderScale, moonPhase, shouldAnimate } from './scene-policy.mjs';

// Only the authored world and rendering modules: no game session or inventory.
export function mountIslandScene(host, {weather='rain',onProgress=()=>{}} = {}) {
  onProgress(8);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let enabled = !reduced.matches && !connection?.saveData;
  let ready = false, disposed = false, contextLost = false, active = true, hasSize = false;
  let frame = 0, previous = 0, lastRendered = 0, elapsed = 0, frames = 0;
  const canvas = document.createElement('canvas');
  canvas.id = 'island-canvas';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  host.append(canvas);
  host.dataset.scene = 'loading';
  const scene = new THREE.Scene(), background = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 500);
  const skyCamera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 200);
  const radians = Math.PI / 180, yaw = 22 * radians, tilt = 33 * radians;
  const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const hemi = new THREE.HemisphereLight('#eff4ff', '#819194', 2.1);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.1);
  sun.position.set(-24, 45, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 38, bottom: -38, near: .5, far: 120 });
  sun.shadow.normalBias = .032; sun.shadow.bias = -.0001;
  scene.add(hemi, sun, sun.target);
  const sky = new CozySky(background, 16 / 9);
  const skyStep = sky.step.bind(sky);
  sky.step = (time, state, reducedMotion, aspect) => skyStep(time, {
    ...state, phase: moonPhase(time), cloud: state.cloud * .45,
  }, reducedMotion, aspect);
  const ambience = new Ambience({ scene, background, hemi, sun, sky, reduced: false, renderer });
  ambience.options = { time: 'night', weather: weather==='snow'?'snow':'rain', start: 'night' };
  host.dataset.weather = ambience.options.weather;
  const clock = { value: 0 };
  const draco = new DRACOLoader().setDecoderPath('/preview/vendor/node_modules/three/examples/jsm/libs/draco/gltf/').setWorkerLimit(1);
  const manager = new THREE.LoadingManager();
  manager.onProgress=(_url,loaded,total)=>onProgress(12+Math.round(loaded/Math.max(total,1)*48));
  const loader = new GLTFLoader(manager).setDRACOLoader(draco);
  let landmark, glow, aspect = 1;

  function material(kind) {
    if (kind === 'website_displays') {
      const display = new THREE.MeshBasicMaterial({color: 'white', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
      display.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float shine=clamp((1.-vUv.x)*.64+vUv.y*.36,0.,1.);
          diffuseColor.rgb=mix(vec3(.003,.065,.30),vec3(.025,.53,.94),pow(shine,.78))*.92;`);
      };
      display.defines = {USE_UV: ''};
      display.customProgramCacheKey = () => 'website-fitted-blue-display-v1';
      return display;
    }
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 });
    if (['water', 'cloth'].includes(kind)) m.side = THREE.DoubleSide;
    if (kind === 'water') {
      m.roughness = .55; m.emissive.set('#15425a'); m.emissiveIntensity = .18;
      m.transparent = true; m.depthWrite = false; m.forceSinglePass = true;
    }
    if (kind === 'crystal') { m.roughness = .25; m.emissive.set('#177ac5'); m.emissiveIntensity = .28; }
    if (['trees', 'gardens', 'water', 'cloth', 'crystal'].includes(kind)) {
      m.onBeforeCompile = shader => {
        shader.uniforms.idleTime = clock;
        shader.vertexShader = 'uniform float idleTime; varying vec3 authoredPosition;\n' + shader.vertexShader;
        const motion = {
          trees: 'transformed.x += sin(idleTime*.70+position.x*.18+position.z*.22)*.018*max(0.,position.y-5.8);',
          gardens: 'transformed.x += sin(idleTime*.75+position.x*.8)*.008*smoothstep(6.05,6.7,position.y);',
          cloth: 'transformed.z += sin(idleTime*1.2+position.y*4.)*.035;',
          crystal: 'transformed.y += sin(idleTime*.628)*.085;',
          water: 'transformed.z += sin(idleTime*2.+position.y*6.)*.014*(1.-smoothstep(3.6,4.,position.y));',
        }[kind];
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nauthoredPosition=position;\n' + motion);
        if (kind === 'water') {
          shader.fragmentShader = 'uniform float idleTime; varying vec3 authoredPosition;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            float fall=1.-smoothstep(3.7,4.05,authoredPosition.y);
            float ripple=sin(mix(authoredPosition.z*7.,authoredPosition.y*5.5,fall)+idleTime*2.8+sin(authoredPosition.x*7.));
            diffuseColor.rgb*=1.+smoothstep(.80,1.,ripple)*.14;
            diffuseColor.a*=smoothstep(-7.7,-4.5,authoredPosition.y);`);
        }
      };
      m.customProgramCacheKey = () => `landing-idle-${kind}`;
    }
    ambience.patchMaterial(m, kind);
    return m;
  }

  function positionCamera(cam, pose, ratio, distance) {
    cam.left = -pose.height * ratio / 2; cam.right = -cam.left;
    cam.top = pose.height / 2; cam.bottom = -cam.top;
    const target = right.clone().multiplyScalar(pose.h).addScaledVector(up, pose.v);
    cam.position.copy(target).addScaledVector(direction, distance);
    cam.up.copy(up); cam.lookAt(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  function resize() {
    if (disposed || !active) return;
    const width = host.clientWidth, height = host.clientHeight;
    // A display:none route must not allocate a viewport-sized WebGL surface.
    // ResizeObserver will resume sizing when the host is visible again.
    if (width <= 0 || height <= 0) {
      hasSize = false;
      syncLoop();
      return;
    }
    const becameVisible = !hasSize;
    hasSize = true;
    aspect = width / Math.max(height, 1);
    renderer.setPixelRatio(renderScale(width, height, devicePixelRatio, connection?.saveData));
    renderer.setSize(width, height, false);
    const pose = islandPose(width, height);
    positionCamera(camera, pose, aspect, 150);
    const skyPose = { h: .5, v: 11.5, height: Math.max(40, 52 / aspect) };
    const view = worldView(skyPose, aspect);
    positionCamera(skyCamera, view.horizon, aspect, 70);
    // The sky is a distant panorama; keep its moon visible on narrow screens.
    sky.setView(aspect < 1 ? { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } } : view);
    sky.uniforms.aspect.value = aspect < 1 ? aspect : 16 / 9;
    host.dataset.resolution = `${canvas.width}x${canvas.height}`;
    if (ready && !contextLost) draw();
    if (becameVisible) syncLoop();
  }

  function draw() {
    if (!active || !hasSize || !ready || disposed || contextLost || document.hidden) return;
    clock.value = elapsed;
    const state = ambience.step(elapsed, camera, null, aspect);
    landmark?.step(elapsed);
    if (glow) glow.render(background, skyCamera, scene, camera, state.night);
    else { renderer.setRenderTarget(null); renderer.clear(); renderer.render(background, skyCamera); renderer.clearDepth(); renderer.render(scene, camera); }
    frames++;
    // Small DOM diagnostics also let QA verify genuine rendered animation.
    if (frames % 15 === 1 || !enabled) {
      host.dataset.elapsed = elapsed.toFixed(2);
      host.dataset.frames = String(frames);
      host.dataset.snowCover = state.cover.toFixed(2);
      host.dataset.snow = state.snow.toFixed(2);
      host.dataset.rain = state.rain.toFixed(2);
      host.dataset.moon = sky.uniforms.moonPosition.value.toArray().map(x => x.toFixed(5)).join(',');
    }
  }

  function running() { return shouldAnimate({ active: active && hasSize, enabled, hidden: document.hidden, ready, contextLost }) && !disposed; }
  function tick(now) {
    frame = 0;
    if (!running()) return;
    if (!previous) { previous = now; lastRendered = now; }
    const delta = now - previous;
    if (delta >= 1000 / 30) {
      elapsed += Math.min((now - lastRendered) / 1000, .1);
      lastRendered = now; previous = now - (delta % (1000 / 30)); draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function syncLoop() {
    cancelAnimationFrame(frame); frame = 0; previous = 0; lastRendered = 0;
    host.dataset.motion = enabled ? 'on' : 'off';
    host.dataset.active = active ? 'true' : 'false';
    if (running()) frame = requestAnimationFrame(tick);
  }
  function setEnabled(value) {
    if (disposed) return;
    enabled = Boolean(value);
    syncLoop();
    if (ready && !document.hidden && !contextLost) draw();
  }
  function setActive(value) {
    if (disposed || active === Boolean(value)) return;
    active = Boolean(value);
    // Route visibility is independent of accessibility and connection settings.
    if (active) resize();
    syncLoop();
  }
  const motionChange = () => setEnabled(!reduced.matches && !connection?.saveData);
  const lost = event => { event.preventDefault(); contextLost = true; host.dataset.scene = 'unavailable'; syncLoop(); };
  const restored = () => { contextLost = false; renderer.shadowMap.needsUpdate = true; resize(); host.dataset.scene = ready ? 'ready' : 'loading'; syncLoop(); };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  document.addEventListener('visibilitychange', syncLoop);
  reduced.addEventListener('change', motionChange);
  connection?.addEventListener?.('change', motionChange);
  const observer = new ResizeObserver(resize); observer.observe(host);
  resize();

  async function load() {
    const [world, stations] = await Promise.all([
      loader.loadAsync('/_media/1b956a5d4dcac4f3c34e7ab68265b403e0e4271d421573796efdf9ef0642bebf/exports/concept1-32/world-workshop.glb'),
      loader.loadAsync('/_media/87434e35e239a06157a460bd130444a9184811491b9625ee21fb4d1c4a82723f/site-assets/plaza-varied-stations.glb'),
      sky.horizon.load(loader),
    ]);
    if (disposed) return;
    for (const name of ['stations', 'own_station', 'own_monitor']) {
      const old = world.scene.getObjectByName(name);
      old?.removeFromParent();
      old?.geometry.dispose();
      if (old?.material) for (const m of [].concat(old.material)) m.dispose();
    }
    world.scene.add(stations.scene);
    world.scene.traverse(object => {
      if (!object.isMesh) return;
      for (const old of [].concat(object.material)) old.dispose();
      object.material = material(object.name);
      object.castShadow = !['water', 'cloth', 'crystal', 'website_displays'].includes(object.name);
      object.receiveShadow = true;
    });
    scene.add(world.scene);
    onProgress(68);
    landmark = await loadRobinhoodLandmark(scene, loader, ambience.uniforms.night);
    onProgress(76);
    await ambience.load(loader, landmark.lightSources);
    // Replacement hardware owns its display surfaces; old overlays no longer fit.
    for (const name of ['ambience_rgb', 'ambience_screens']) {
      ambience.overlay?.getObjectByName(name)?.traverse(object => { object.visible = false; });
    }
    onProgress(86);
    if (disposed) return;
    ambience.step(0, camera, null, aspect); landmark.step(0);
    // Preserve sharp original color; diffuse only the bright highlights on desktop.
    if (host.clientWidth > 680 && !connection?.saveData) glow = new SoftNightGlow(renderer);
    await Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(background, skyCamera)]);
    if (disposed) return;
    onProgress(96);
    renderer.shadowMap.needsUpdate = true; ready = true; draw();
    host.dataset.scene = 'ready'; syncLoop();
    draco.dispose();
  }
  const loaded = load().catch(error => {
    host.dataset.scene = 'unavailable';
    console.error('The island scene could not load.', error);
    ready = false; syncLoop(); draco.dispose();
    throw error;
  });

  function setWeather(value) {
    const next=value==='snow'?'snow':'rain';
    if(ambience.options.weather===next)return;
    ambience.options.weather=next;
    ambience.optionsWithMotion=null;
    host.dataset.weather=next;
    draw();
  }

  return { loaded, get enabled() { return enabled; }, setActive, setWeather,
    dispose() {
      disposed = true; ready = false; cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener('visibilitychange', syncLoop); reduced.removeEventListener('change', motionChange);
      connection?.removeEventListener?.('change', motionChange);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      landmark?.dispose(); draco.dispose();
      const geometries = new Set(), materials = new Set();
      for (const root of [scene, background]) root.traverse(o => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) for (const m of [].concat(o.material)) materials.add(m);
      });
      for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
      if (glow) { for (const target of [glow.world, glow.a, glow.b]) target.dispose(); glow.blur.dispose(); glow.finish.dispose(); glow.quad.geometry.dispose(); }
      sun.shadow.map?.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
