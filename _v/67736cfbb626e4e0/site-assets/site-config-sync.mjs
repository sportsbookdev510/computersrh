// Same-origin hints only. Receivers always re-fetch the authoritative configuration.
const CONFIG = {channel: 'computersrh:site-config', key: 'computersrh:site-config-change'};
// A tab signed in or out (X or wallet): other open pages re-read who is signed in.
const AUTH = {channel: 'computersrh:site-auth', key: 'computersrh:site-auth-change', ownTokens: new WeakMap()};
const TOKEN = /^[a-zA-Z0-9_-]{16,128}$/;

function changeToken(environment) {
  try {
    const token = environment.crypto?.randomUUID?.();
    if (typeof token === 'string' && TOKEN.test(token)) return token;
  } catch { /* A notification identifier is not an authentication credential. */ }
  return Array.from({length: 4}, () => Math.random().toString(36).slice(2).padEnd(12, '0')).join('');
}

function openChannel(environment, topic) {
  try { return new environment.BroadcastChannel(topic.channel); } catch { return null; }
}

function publish(topic, environment) {
  const token = changeToken(environment);
  if (topic.ownTokens) {
    // The publishing page already knows; only the other pages need the hint.
    const own = topic.ownTokens.get(environment) ?? new Set();
    topic.ownTokens.set(environment, own.add(token));
    if (own.size > 64) own.delete(own.values().next().value);
  }
  let published = false;
  const channel = openChannel(environment, topic);
  try {
    if (channel) { channel.postMessage(token); published = true; }
  } catch { /* Storage and focus/poll refreshes remain available. */ }
  finally { try { channel?.close(); } catch {} }
  try {
    // Also covers tabs where BroadcastChannel is unavailable or blocked.
    environment.localStorage.setItem(topic.key, token);
    published = true;
    environment.localStorage.removeItem(topic.key);
  } catch { /* Private-mode storage may be unavailable. */ }
  return published;
}

function subscribe(topic, callback, environment) {
  const seen = new Set();
  let closed = false;
  const receive = token => {
    if (closed || typeof token !== 'string' || !TOKEN.test(token) || seen.has(token) || topic.ownTokens?.get(environment)?.has(token)) return;
    seen.add(token);
    if (seen.size > 64) seen.delete(seen.values().next().value);
    callback();
  };
  const channel = openChannel(environment, topic);
  const onMessage = event => receive(event.data);
  if (channel) channel.addEventListener('message', onMessage);
  const onStorage = event => {
    if (event.key === topic.key) receive(event.newValue);
  };
  environment.addEventListener?.('storage', onStorage);
  return () => {
    if (closed) return;
    closed = true;
    environment.removeEventListener?.('storage', onStorage);
    if (channel) {
      channel.removeEventListener('message', onMessage);
      channel.close();
    }
    seen.clear();
  };
}

export function publishSiteConfigChange(environment = globalThis) {
  return publish(CONFIG, environment);
}

export function subscribeSiteConfigChanges(callback, environment = globalThis) {
  if (typeof callback !== 'function') throw new TypeError('A configuration refresh callback is required.');
  return subscribe(CONFIG, callback, environment);
}

export function publishSiteAuthChange(environment = globalThis) {
  return publish(AUTH, environment);
}

export function subscribeSiteAuthChanges(callback, environment = globalThis) {
  if (typeof callback !== 'function') throw new TypeError('A sign-in refresh callback is required.');
  return subscribe(AUTH, callback, environment);
}
