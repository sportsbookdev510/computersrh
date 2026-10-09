import * as THREE from 'three';
import { WeatherFX } from '/_v/67736cfbb626e4e0/preview/plaza32/weather-fx.mjs';
import { ambienceState } from '/_v/67736cfbb626e4e0/preview/plaza32/ambience-model.mjs';
import { worldView } from '/_v/67736cfbb626e4e0/preview/plaza32/world-view.mjs';
import { renderScale, shouldAnimate } from './scene-policy.mjs';
import { SkyClouds, normalizeSkyVariant } from './sky-clouds.mjs';

// Imagegen artwork layers preserve the approved composition. Shared game rain
// remains a live particle layer; no island or dense cloud-sea geometry is loaded.
export function mountRainySky(host, { variant = 'open', motion = 'animated' } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let still = motion === 'still';
  let enabled = !still && !reduced.matches && !connection?.saveData;
  let active = true, ready = false, disposed = false, contextLost = false, hasSize = false;
  let frame = 0, previous = 0, lastRendered = 0, elapsed = 0, frames = 0, aspect = 1, variantRequest = 0;
  const canvas = document.createElement('canvas');
  canvas.id = 'rainy-sky-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  host.append(canvas);
  host.dataset.scene = 'loading';
  host.dataset.kind = 'rainy-sky';
  host.dataset.frames = '0';

  const background = new THREE.Scene(), foreground = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 200);
  const yaw = 22 * Math.PI / 180, tilt = 33 * Math.PI / 180;
  const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const clouds = new SkyClouds(background, normalizeSkyVariant(variant));
  host.dataset.variant = clouds.variant; host.dataset.clouds = String(clouds.count);
  host.dataset.cloudSea = 'false'; host.dataset.mistLayers = clouds.variant === 'mist' ? '3' : '0';
  host.dataset.artwork = 'imagegen-layers';
  // No ground means no splash anchors. The shared bounded rain buffer is enough.
  const weather = new WeatherFX(foreground, [], !enabled);
  const options = { time: 'night', weather: 'rain', start: 'night' };

  function resize() {
    if (disposed || !active) return;
    const width = host.clientWidth, height = host.clientHeight;
    if (width <= 0 || height <= 0) { hasSize = false; syncLoop(); return; }
    const becameVisible = !hasSize;
    hasSize = true;
    aspect = width / height;
    renderer.setPixelRatio(renderScale(width, height, devicePixelRatio, connection?.saveData));
    renderer.setSize(width, height, false);
    const view = worldView({ h: .5, v: 11.5, height: Math.max(40, 52 / aspect) }, aspect);
    const pose = view.horizon;
    camera.left = -pose.height * aspect / 2; camera.right = -camera.left;
    camera.top = pose.height / 2; camera.bottom = -camera.top;
    const target = right.clone().multiplyScalar(pose.h).addScaledVector(up, pose.v);
    camera.position.copy(target).addScaledVector(direction, 70);
    camera.up.copy(up); camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    host.dataset.resolution = `${canvas.width}x${canvas.height}`;
    draw();
    if (becameVisible) syncLoop();
  }

  function draw() {
    if (!active || !hasSize || !ready || disposed || contextLost || document.hidden) return;
    const state = ambienceState(elapsed, options);
    clouds.step(elapsed, aspect, renderer.getPixelRatio(), host.clientHeight);
    // A still comparison renders the same rain particles once, without a loop.
    weather.reduced = reduced.matches || Boolean(connection?.saveData);
    weather.step(elapsed, state, camera, false);
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(background, camera);
    renderer.clearDepth(); renderer.render(foreground, camera);
    frames++;
    if (frames % 15 === 1 || !enabled) {
      host.dataset.elapsed = elapsed.toFixed(2);
      host.dataset.frames = String(frames);
      host.dataset.moon = clouds.moonPosition.toArray().map(x => x.toFixed(5)).join(',');
    }
  }

  function running() {
    return !disposed && shouldAnimate({ active: active && hasSize, enabled, hidden: document.hidden, ready, contextLost });
  }
  function tick(now) {
    frame = 0;
    if (!running()) return;
    if (!previous) { previous = now; lastRendered = now; }
    const delta = now - previous;
    if (delta >= 1000 / 30) {
      elapsed += Math.min((now - lastRendered) / 1000, .1);
      lastRendered = now; previous = now - delta % (1000 / 30); draw();
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
    syncLoop(); draw();
  }
  function setActive(value) {
    if (disposed || active === Boolean(value)) return;
    active = Boolean(value);
    if (active) resize();
    syncLoop();
  }
  function setVariant(value) {
    if (disposed) return;
    const variant = normalizeSkyVariant(value);
    if (variant === clouds.variant) return;
    const request = ++variantRequest;
    Promise.resolve(clouds.setVariant(variant)).then(() => {
      if (disposed || request !== variantRequest) return;
      host.dataset.variant = clouds.variant; host.dataset.clouds = String(clouds.count);
      host.dataset.mistLayers = clouds.variant === 'mist' ? '3' : '0';
      draw();
    }).catch(() => {
      if (!disposed && request === variantRequest) host.dataset.scene = 'unavailable';
    });
  }
  const motionChange = () => setEnabled(!still && !reduced.matches && !connection?.saveData);
  function setMotion(value) {
    if (disposed || still === (value === 'still')) return;
    still = value === 'still';
    motionChange();
  }
  const visibilityChange = () => { syncLoop(); draw(); };
  const lost = event => {
    event.preventDefault(); contextLost = true; host.dataset.scene = 'unavailable'; syncLoop();
  };
  const restored = () => {
    contextLost = false; resize(); host.dataset.scene = ready ? 'ready' : 'loading'; syncLoop();
  };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  document.addEventListener('visibilitychange', visibilityChange);
  reduced.addEventListener('change', motionChange);
  connection?.addEventListener?.('change', motionChange);
  const observer = new ResizeObserver(resize); observer.observe(host);
  resize();

  const loaded = clouds.loaded.then(() => Promise.all([
    renderer.compileAsync(background, camera), renderer.compileAsync(foreground, camera),
  ])).then(() => {
    if (disposed) return;
    ready = true; host.dataset.scene = contextLost ? 'unavailable' : 'ready'; draw(); syncLoop();
  }).catch(error => {
    if (!disposed) { ready = false; host.dataset.scene = 'unavailable'; syncLoop(); }
    throw error;
  });

  return {
    loaded, get enabled() { return enabled; }, get variant() { return clouds.variant; }, setActive, setVariant, setMotion,
    dispose() {
      if (disposed) return;
      disposed = true; ready = false; active = false; cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      reduced.removeEventListener('change', motionChange);
      connection?.removeEventListener?.('change', motionChange);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      clouds.dispose();
      const geometries = new Set(), materials = new Set();
      for (const root of [background, foreground]) root.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) for (const material of [].concat(object.material)) materials.add(material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      host.dataset.scene = 'disposed'; host.dataset.active = 'false';
    },
  };
}
