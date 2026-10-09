const paths = {
  sound:'M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  soundOff:'M3 9h4l5-5v16l-5-5H3zM17 9l5 6m0-6-5 6',
  sliders:'M4 7h3m6 0h7M4 17h9m6 0h1M7 4h6v6H7zM13 14h6v6h-6z',
  x:'M4 3h4l12 18h-4L4 3Zm16 0L4 21',
  arrow:'M4 12h16m-6-6 6 6-6 6', back:'M20 12H4m6-6-6 6 6 6',
  wallet:'M20 7V5H4a2 2 0 0 0 0 4h17v11H4a2 2 0 0 1-2-2V7m14 6h6v4h-6z',
  door:'M5 21h14M7 21V9a5 5 0 0 1 10 0v12M10 11v10m4-7h.01M3 21h18',
  calendar:'M4 5h16v16H4zM8 2v6m8-6v6M4 11h16',
  globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  external:'M14 3h7v7m0-7L10 14M10 3H4v17h17v-6',
  check:'M4 12l5 5L20 6', copy:'M8 8h12v13H8zM16 8V3H3v13h5',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', close:'m5 5 14 14M19 5 5 19',
  lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3', clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  sparkle:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  feather:'M5 22 9 16 7 15 7 10 10 10 10 6 13 6 13 3 19 2 21 5 20 10 17 10 17 14 13 14 11 17 9 17M9 17 17 5',
  play:'M7 4.5v15L19.5 12Z',
};
export function icon(name, cls='') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.arrow}"/></svg>`; }
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const shortWallet = wallet => wallet ? `${wallet.slice(0,6)}…${wallet.slice(-4)}` : '';
export function formatDate(date) { const value = new Date(date);return Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat('en-US',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'UTC'}).format(value)+' UTC' : 'To be announced'; }
export function announce(message) { document.querySelector('#announcements').textContent=message; }
export function safeExternal(url, hosts=['x.com','www.x.com','twitter.com','www.twitter.com']) { try { const u=new URL(url);return u.protocol==='https:' && hosts.includes(u.hostname) ? u.href : null; } catch {return null;} }
