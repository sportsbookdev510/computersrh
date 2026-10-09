// A stable overview, never a cover/zoom crop. Portrait leaves room below the island.
export function islandPose(width, height) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const portrait = aspect < 1;
  const viewHeight = Math.max(48, 68 / aspect);
  return { height: viewHeight, h: portrait ? .3 : -Math.min(7, Math.max(0, (viewHeight * aspect - 62) / 2)),
    v: portrait ? 2 - viewHeight * .13 : 3 };
}

export function renderScale(width, height, deviceScale = 1, saveData = false) {
  const area = Math.max(1, width) * Math.max(1, height);
  // Keep native CSS resolution even on wide displays; cap only supersampling.
  return Math.max(1, Math.min(deviceScale || 1, saveData ? 1 : 2, Math.sqrt(6_000_000 / area)));
}

export function moonPhase(seconds) { return 90 + Math.sin(seconds / 160) * 6; }

export function shouldAnimate({ active = true, enabled, hidden, ready, contextLost }) {
  return Boolean(active && enabled && !hidden && ready && !contextLost);
}

// Website-only visual comparison. The ordinary homepage stays rainy.
export function landingWeather(search='') {
  const values=new URLSearchParams(search).getAll('weather');
  return values.length===1 && values[0]==='snow'?'snow':'rain';
}
