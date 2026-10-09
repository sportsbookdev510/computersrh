// The game guide's moving parts: the chapter drawer, the chapter pane (its scroll spy, reading line and deep
// links), stage viewers, the power planner, calculators, the parts browser and section reveals.
// Every number comes from docs-data.json.
import {celsius, hs, partsTable, pct, usd, watts} from './docs-content.mjs';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const observes = () => typeof IntersectionObserver === 'function';
let cleanups = [];

/** Wire every widget in the rendered guide page (and stop the previous page's timers and observers). */
export function mountDocsWidgets(root, data, {pageChanged = false} = {}) {
  for (const stop of cleanups) stop();
  cleanups = [];
  const page = root.querySelector('.docs-page');
  if (!page) return;
  // The chapter scrolls on its own pane (.journey-right); the page itself stays put (docs.css).
  const shell = page.closest('.docs-shell') ?? root, pane = page.closest('.journey-right');
  const target = pane ? hashTarget(pane) : null;
  if (pageChanged && !reduced()) {
    // A chapter opened at a section only fades in: a moving page would put the section off its place.
    page.animate(target ? [{opacity: 0}, {opacity: 1}] : [{opacity: 0, transform: 'translateY(12px)'}, {opacity: 1, transform: 'none'}], {duration: 340, easing: 'cubic-bezier(.16,1,.3,1)'});
  }
  reveal(page, pane);
  drawer(shell, pane);
  page.querySelectorAll('[data-stage-viewer]').forEach(element => stageViewer(element, pane));
  page.querySelectorAll('[data-power-planner]').forEach(element => powerPlanner(element, data));
  page.querySelectorAll('[data-energy-calc]').forEach(element => energyCalc(element, data));
  page.querySelectorAll('[data-care-slider]').forEach(element => careSlider(element, data));
  page.querySelectorAll('[data-bonus-calc]').forEach(element => bonusCalc(element, data));
  page.querySelectorAll('[data-parts-browser]').forEach(element => partsBrowser(element, data));
  page.querySelectorAll('[data-docs-faq]').forEach(oneOpen);
  if (!pane) return;
  if (target) {
    showSection(pane, target);
    // Text set in the web fonts can shift the section a little: land again unless the reader has moved on.
    const landed = pane.scrollTop;
    document.fonts?.ready?.then(() => {if (pane.isConnected && Math.abs(pane.scrollTop - landed) < 2) showSection(pane, target);});
  }
  sectionLinks(shell, pane);
  onPaneScroll(pane, [scrollSpy(shell, page, pane), readingLine(pane)]);
  showCurrentChapter(shell);
  settleFocus(root, pane, target);
}

/** Quick answers: opening one question closes the others (what <details name> does in newer browsers). */
function oneOpen(list) {
  const onToggle = event => {
    const opened = event.target;
    if (!(opened instanceof HTMLDetailsElement) || !opened.open) return;
    list.querySelectorAll('details[open]').forEach(other => {if (other !== opened) other.open = false;});
  };
  list.addEventListener('toggle', onToggle, true);
  cleanups.push(() => list.removeEventListener('toggle', onToggle, true));
}

function watch(elements, callback, options) {
  if (!observes()) {elements.forEach(element => callback(element, true));return;}
  const observer = new IntersectionObserver(entries => entries.forEach(entry => callback(entry.target, entry.isIntersecting, observer)), options);
  elements.forEach(element => observer.observe(element));
  cleanups.push(() => observer.disconnect());
}

// Sections slide in once as they scroll into view; with reduced motion they are simply there.
function reveal(page, pane) {
  const items = [...page.querySelectorAll('[data-reveal]')];
  if (reduced() || !observes()) return;
  page.classList.add('has-reveal');
  watch(items, (element, visible, observer) => {
    if (!visible) return;
    element.classList.add('is-in');
    observer?.unobserve(element);
  }, {root: pane, rootMargin: '0px 0px -6% 0px', threshold: 0.04});
}

// ------------------------------------------------------- the chapter pane

/** ``element``'s top inside the scrolling ``container`` (the pane and the drawer are positioned, docs.css). */
function offsetIn(element, container) {
  let top = 0;
  for (let node = element; node && node !== container; node = node.offsetParent) top += node.offsetTop;
  return top;
}

/** Scroll ``scroller`` to ``top`` at once (the pane scrolls smoothly for links, not for arrivals). */
function scrollTo(scroller, top) {
  const behavior = scroller.style.scrollBehavior;
  scroller.style.scrollBehavior = 'auto';
  scroller.scrollTop = Math.max(0, top);
  scroller.style.scrollBehavior = behavior;
}

/** Keep ``element`` inside the visible part of ``scroller`` when that scrolls (a long chapter list). */
function keepInView(scroller, element, margin = 16) {
  if (scroller.scrollHeight <= scroller.clientHeight + 1) return;
  const top = offsetIn(element, scroller), bottom = top + element.offsetHeight;
  if (top < scroller.scrollTop + margin) scrollTo(scroller, top - margin);
  else if (bottom > scroller.scrollTop + scroller.clientHeight - margin) scrollTo(scroller, bottom - scroller.clientHeight + margin);
}

/** The element in the pane that ``hash`` (the address's #section by default) names, or null. */
function hashTarget(pane, hash = location.hash) {
  let id = '';
  try {id = decodeURIComponent(String(hash).slice(1));} catch {}
  const target = id ? document.getElementById(id) : null;
  return target && pane.contains(target) ? target : null;
}

/** Where ``target`` sits at the top of the pane (its scroll margin above it). */
const sectionTop = (pane, target) => offsetIn(target, pane) - (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);

/** Reveal ``target``'s section at once: a section still waiting to rise would move under the reader. */
function revealNow(target) {
  const section = target.closest('[data-reveal]');
  if (!section || section.classList.contains('is-in')) return;
  section.style.transition = 'none';
  section.classList.add('is-in');
  void section.offsetWidth;
  section.style.transition = '';
}

// A deep link (/docs/power#sharing) opens its section at the top of the pane, already revealed.
function showSection(pane, target) {
  revealNow(target);
  scrollTo(pane, sectionTop(pane, target));
}

/** Focus ``element`` without scrolling; an element that isn't focusable is focusable only until it loses focus. */
function focusQuietly(element) {
  if (!element.hasAttribute('tabindex')) {
    element.tabIndex = -1;
    element.addEventListener('blur', () => element.removeAttribute('tabindex'), {once: true});
  }
  element.focus({preventScroll: true});
}

// Section links (the sidebar's sections, the # beside each heading, links inside a chapter) glide the pane to
// their section, focus it so the keyboard keeps reading from there, and put the section in the address without
// adding a history step.
function sectionLinks(shell, pane) {
  const onClick = event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = hashTarget(pane, link.hash);
    if (!target) return;
    event.preventDefault();
    revealNow(target);
    pane.scrollTo({top: Math.max(0, sectionTop(pane, target)), behavior: reduced() ? 'auto' : 'smooth'});
    if (location.hash !== link.hash) history.replaceState(history.state, '', link.hash);
    focusQuietly(target);
  };
  shell.addEventListener('click', onClick);
  cleanups.push(() => shell.removeEventListener('click', onClick));
}

/** Run ``handlers`` once now and then at most once a frame while the pane scrolls or the window resizes. */
function onPaneScroll(pane, handlers) {
  let frame = 0;
  const run = () => {frame = 0;handlers.forEach(handler => handler());};
  const schedule = () => {if (!frame) frame = requestAnimationFrame(run);};
  pane.addEventListener('scroll', schedule, {passive: true});
  addEventListener('resize', schedule);
  cleanups.push(() => {pane.removeEventListener('scroll', schedule);removeEventListener('resize', schedule);cancelAnimationFrame(frame);});
  run();
}

// The sidebar marks the section being read: the last one whose top has passed a line near the top of the pane,
// or the last section once the pane is scrolled to the end.
function scrollSpy(shell, page, pane) {
  const links = new Map([...shell.querySelectorAll('[data-docs-anchor]')].map(link => [link.dataset.docsAnchor, link]));
  const sections = [...page.querySelectorAll('.docs-section')].filter(section => links.has(section.id));
  const list = shell.querySelector('.docs-drawer');
  let active;
  return () => {
    if (!sections.length) return;
    const line = pane.scrollTop + Math.min(180, pane.clientHeight * .3);
    let current = null;
    for (const section of sections) {if (offsetIn(section, pane) <= line) current = section;else break;}
    if (pane.scrollTop > 0 && pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2) current = sections.at(-1);
    if (current === active) return;
    active = current;
    links.forEach((link, id) => {
      const on = id === current?.id;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'location');else link.removeAttribute('aria-current');
    });
    if (current && list) keepInView(list, links.get(current.id));
  };
}

// The line along the top of the pane fills as the chapter is read.
function readingLine(pane) {
  const line = pane.querySelector('.docs-progress');
  return () => {
    const room = pane.scrollHeight - pane.clientHeight;
    line?.style.setProperty('--progress', room > 1 ? (pane.scrollTop / room).toFixed(4) : '0');
  };
}

// A long chapter list scrolls in the sidebar: start with the current chapter's row in view.
function showCurrentChapter(shell) {
  const list = shell.querySelector('.docs-drawer'), row = list?.querySelector('.docs-rail-item.is-current > a');
  if (row) keepInView(list, row, 24);
}

// Arrow keys, Page Down and Space scroll the chapter right away. The pane is focusable (a click on its text
// focuses it), and after the router has settled (it focuses #main after a render) focus moves to the section
// a link named, or to the chapter's heading, unless something else already has it.
function settleFocus(root, pane, target) {
  pane.tabIndex = -1;
  const settle = () => {
    const active = document.activeElement;
    if (!pane.isConnected || (active && active !== document.body && active !== root && active !== pane)) return;
    focusQuietly(target ?? pane.querySelector('.docs-head h2') ?? pane);
  };
  if (typeof requestAnimationFrame === 'function') {
    const frame = requestAnimationFrame(settle);
    cleanups.push(() => cancelAnimationFrame(frame));
  } else settle();
}

// ------------------------------------------------------------ chapter drawer

// Below 1024 px the chapter list is a drawer behind the Chapters button: Escape, the scrim, a chapter or a
// section link close it, and the chapter behind it stays out of reach while it is open.
function drawer(shell, pane) {
  const button = shell.querySelector('[data-docs-menu]'), panel = shell.querySelector('.docs-drawer');
  if (!button || !panel) return;
  const behind = [pane, shell.querySelector('.window-status')].filter(Boolean);
  const isOpen = () => shell.classList.contains('is-menu-open');
  function set(open, {focus = false} = {}) {
    shell.classList.toggle('is-menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    behind.forEach(element => {element.inert = open;});
    if (open && focus) (panel.querySelector('[aria-current="page"]') ?? panel.querySelector('a'))?.focus({preventScroll: true});
    if (open) showCurrentChapter(shell);
  }
  button.addEventListener('click', () => set(!isOpen(), {focus: true}));
  shell.querySelector('[data-docs-close]')?.addEventListener('click', () => set(false));
  panel.addEventListener('click', event => {if (isOpen() && event.target.closest('a[href]')) set(false);});
  const onKey = event => {if (event.key === 'Escape' && isOpen()) {set(false);button.focus();}};
  document.addEventListener('keydown', onKey);
  // On a wide screen the chapters are a sidebar: never leave the chapter out of reach there.
  const wide = typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)') : null;
  const onWide = () => {if (wide.matches && isOpen()) set(false);};
  wide?.addEventListener('change', onWide);
  cleanups.push(() => {document.removeEventListener('keydown', onKey);wide?.removeEventListener('change', onWide);});
}

// ------------------------------------------------------------ stage viewer

function stageViewer(element, scroller = null) {
  const steps = [...element.querySelectorAll('[data-stage]')];
  const pips = steps.map(step => step.querySelector('[data-stage-pick]'));
  const details = [...element.querySelectorAll('[data-stage-detail]')];
  const images = [...element.querySelectorAll('.docs-stage-img')];
  const play = element.querySelector('[data-stage-play]');
  let index = 0, front = 0, timer = 0, visible = false, stopped = reduced(), loaded = false;
  const preload = () => {
    if (loaded) return;
    loaded = true;
    steps.forEach(step => {const image = new Image();image.decoding = 'async';image.src = step.dataset.src;});
  };
  function show(next) {
    const target = (next + steps.length) % steps.length;
    if (target === index) return;
    index = target;
    const back = images[1 - front], current = images[front], step = steps[index];
    const swap = () => {
      if (steps[index] !== step) return;
      back.alt = step.dataset.alt;back.removeAttribute('aria-hidden');back.classList.add('is-shown');
      current.classList.remove('is-shown');current.alt = '';current.setAttribute('aria-hidden', 'true');
      front = 1 - front;
    };
    back.onload = null;
    if (back.getAttribute('src') === step.dataset.src && back.complete) swap();
    else {back.onload = swap;back.src = step.dataset.src;}
    pips.forEach((pip, i) => pip.setAttribute('aria-pressed', String(i === index)));
    details.forEach((detail, i) => {detail.hidden = i !== index;});
    element.style.setProperty('--stage', index);
    element.style.setProperty('--progress', steps.length > 1 ? index / (steps.length - 1) : 1);
  }
  const tick = () => show(index + 1);
  function schedule() {
    clearInterval(timer);
    timer = 0;
    const running = visible && !stopped && !document.hidden;
    if (running) timer = setInterval(tick, 2300);
    play.setAttribute('aria-pressed', String(running));
    play.setAttribute('aria-label', running ? 'Pause the levels' : 'Play the levels');
    element.classList.toggle('is-playing', running);
  }
  const userPick = next => {stopped = true;schedule();show(next);};
  pips.forEach((pip, i) => pip.addEventListener('click', () => userPick(i)));
  element.querySelectorAll('[data-stage-step]').forEach(button => button.addEventListener('click', () => userPick(index + Number(button.dataset.stageStep))));
  element.querySelector('.docs-stage-pips').addEventListener('keydown', event => {
    const move = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[event.key];
    if (move === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    userPick(event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : index + move);
    pips[index].focus();
  });
  play.addEventListener('click', () => {stopped = !stopped;if (!stopped && index === steps.length - 1) show(0);schedule();});
  const onVisibility = () => schedule();
  document.addEventListener('visibilitychange', onVisibility);
  cleanups.push(() => {clearInterval(timer);document.removeEventListener('visibilitychange', onVisibility);});
  element.style.setProperty('--progress', 0);
  watch([element], (_, isVisible) => {visible = isVisible;if (isVisible) preload();schedule();}, {root: scroller, threshold: 0.35});
}

// ----------------------------------------------------------- power planner

/** Capacity admission: every selected complete PC reserves watts, including the first desk and off PCs. */
export function allocate(rows, capacityW) {
  const total = rows.reduce((sum,row)=>sum+(row.card ? Math.round(row.card.watts*1000) : 0),0);
  const capacity = Math.round(capacityW*1000), allowed = total<=capacity;
  const result = new Map(rows.filter(row=>row.card).map(row=>[row.desk,allowed?'grid':'waiting']));
  return {result,left:Math.max(0,capacity-total)/1000,required:total/1000,allowed};
}

function powerPlanner(element, data) {
  const levels = data.power.levels, cards = data.start.cards;
  const slider = element.querySelector('[data-planner-slider]'), output = element.querySelector('[data-planner-level]');
  const fill = element.querySelector('[data-planner-fill]'), cap = element.querySelector('[data-planner-cap]');
  const summary = element.querySelector('[data-planner-summary]');
  const desks = [...element.querySelectorAll('[data-desk]')];
  function update() {
    const level = levels[Number(slider.value)];
    output.textContent = `${level.level} · ${watts(level.capacity_w)}`;
    const rows = desks.map((item, index) => ({item, desk: index + 1, card: cards.find(card => card.id === item.querySelector('[data-desk-pick]').value)}));
    const {result, left, required, allowed} = allocate(rows, level.capacity_w);
    const used = required;
    fill.innerHTML = rows.filter(row => result.get(row.desk) === 'grid').map((row, index) =>
      `<span style="--w:${(row.card.watts / Math.max(1, level.capacity_w) * 100).toFixed(2)}%;--i:${index}" title="PC ${row.desk}: ${watts(row.card.watts)}"><b>PC ${row.desk}</b></span>`).join('');
    cap.textContent = `${watts(used)} / ${watts(level.capacity_w)}`;
    let waiting = 0;
    for (const row of rows) {
      const state = row.item.querySelector('[data-desk-state]'), status = result.get(row.desk) ?? 'empty';
      row.item.dataset.state = status;
      if (status === 'empty') state.textContent = 'Empty desk';
      else if (status === 'grid') state.textContent = `Powered · ${watts(row.card.watts)}`;
      else {
        waiting += 1;
        const need = levels.slice(level.level + 1).find(next => allocate(rows, next.capacity_w).result.get(row.desk) === 'grid');
        state.textContent = need ? `Plan needs Power Level ${need.level}` : 'Plan exceeds maximum capacity';
      }
    }
    summary.textContent = `${watts(used)} reserved across all ${desks.length} desks; capacity ${watts(level.capacity_w)}. ${allowed ? 'This plan fits the power budget.' : 'This plan cannot be installed until capacity is increased.'}`;
  }
  slider.addEventListener('input', update);
  element.addEventListener('change', event => {if (event.target.matches('[data-desk-pick]')) update();});
  update();
}

// --------------------------------------------------------------- calculators

const outRows = rows => rows.map(([term, value, tone = '']) => `<div${tone ? ` class="is-${tone}"` : ''}><dt>${term}</dt><dd>${value}</dd></div>`).join('');

function energyCalc(element, data) {
  const select = element.querySelector('[data-calc-card]'), slider = element.querySelector('[data-calc-slider]');
  const count = element.querySelector('[data-calc-count]'), out = element.querySelector('[data-calc-out]');
  const price = data.energy.usd_per_kwh;
  const refill = (load, hours) => Math.ceil(load * hours / 1000 * price * 1e6) / 1e6;
  function update() {
    const card = data.start.cards.find(item => item.id === select.value) ?? data.start.cards[0];
    const pcs = Number(slider.value), load = card.watts * pcs;
    count.textContent = String(pcs);
    out.innerHTML = outRows([
      ['Running load', watts(load)], ['Per day', `${(load * 24 / 1000).toLocaleString('en-US', {maximumFractionDigits: 3})} kWh`],
      ['Cost per day', usd(load * 24 / 1000 * price), 'gold'],
      ...data.energy.refill_hours.map(hours => [`${hours} h refill`, usd(refill(load, hours)), 'mint']),
    ]);
  }
  select.addEventListener('change', update);
  slider.addEventListener('input', update);
  update();
}

function careSlider(element, data) {
  const heat = data.heat, select = element.querySelector('[data-care-card]'), input = element.querySelector('[data-care-input]');
  const hoursOut = element.querySelector('[data-care-hours]'), out = element.querySelector('[data-care-out]');
  const fill = element.querySelector('[data-care-fill]');
  function update() {
    const build = heat.builds.find(row => row.id === select.value) ?? heat.builds[0];
    const point = build.care[Number(input.value)] ?? build.care[0];
    const wear = Math.min(heat.wear.max_pct, point.hours / heat.clocks_h.hardware * heat.wear.max_pct);
    const speed = Math.max(heat.floor_pct, 100 - point.loss_pct - wear);
    const state = point.hottest_c < heat.warm_c ? 'cool' : point.hottest_c < heat.throttle_c ? 'warm' : 'hot';
    hoursOut.textContent = `${point.hours} h`;
    element.dataset.state = state;
    fill.style.setProperty('--t', Math.max(0, Math.min(1, (point.hottest_c - 35) / 65)).toFixed(3));
    out.innerHTML = outRows([
      ['Hottest chip', `${celsius(point.hottest_c)} · ${{cool: 'cool', warm: 'warm', hot: 'throttling'}[state]}`, state === 'hot' ? 'blush' : state === 'warm' ? 'gold' : 'mint'],
      ['Heat loss', point.loss_pct ? `−${pct(point.loss_pct)}` : 'none'],
      ['Wear by then', wear ? `−${pct(Math.round(wear * 100) / 100)}` : 'none'],
      ['Speed left', pct(Math.round(speed * 100) / 100), speed < 100 ? 'gold' : 'mint'],
    ]);
  }
  select.addEventListener('change', update);
  input.addEventListener('input', update);
  update();
}

function bonusCalc(element, data) {
  const bonus = data.bonus, inputs = element.querySelectorAll('[data-bonus-input]');
  const matchedOut = element.querySelector('[data-bonus-matched]'), levelOut = element.querySelector('[data-bonus-level]');
  const out = element.querySelector('[data-bonus-out]'), bars = element.querySelectorAll('[data-bonus-bar]');
  function update() {
    const matched = Number(element.querySelector('[data-bonus-input="matched"]').value);
    const level = Number(element.querySelector('[data-bonus-input="level"]').value);
    const combo = bonus.combo[matched - 1]?.combo_pct ?? 0;
    const active = matched >= bonus.level_needs_matched;
    const levelPct = active ? bonus.levels[level - 1]?.total_pct ?? 0 : 0;
    const total = combo + levelPct;
    matchedOut.textContent = String(matched);
    levelOut.textContent = String(level);
    bars.forEach(bar => bar.style.setProperty('--w', `${((bar.dataset.bonusBar === 'combo' ? combo : levelPct) / bonus.max_pct * 100).toFixed(2)}%`));
    out.innerHTML = outRows([
      ['Combo', combo ? `+${pct(combo)}` : '0%'],
      ['Island Level bonus', active ? (levelPct ? `+${pct(levelPct)}` : '0%') : `needs ${bonus.level_needs_matched} matched PCs`],
      ['Total bonus', `+${pct(total)}`, 'gold'],
      ['100 H/s of PCs count as', hs(100 * (1 + total / 100)), 'mint'],
    ]);
  }
  inputs.forEach(input => input.addEventListener('input', update));
  update();
}

// ------------------------------------------------------------- parts browser

function partsBrowser(element, data) {
  const tabs = [...element.querySelectorAll('[data-parts-tab]')], panel = element.querySelector('[data-parts-panel]');
  function select(tab, focus = false) {
    tabs.forEach(item => {const on = item === tab;item.setAttribute('aria-selected', String(on));item.tabIndex = on ? 0 : -1;});
    panel.setAttribute('aria-labelledby', tab.id);
    panel.innerHTML = partsTable(data, tab.dataset.partsTab);
    if (!reduced()) panel.animate([{opacity: 0}, {opacity: 1}], {duration: 180, easing: 'ease-out'});
    if (focus) tab.focus();
  }
  tabs.forEach(tab => tab.addEventListener('click', () => select(tab)));
  element.querySelector('[role="tablist"]').addEventListener('keydown', event => {
    const move = {ArrowRight: 1, ArrowLeft: -1}[event.key];
    if (!move) return;
    event.preventDefault();
    const current = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
    select(tabs[(current + move + tabs.length) % tabs.length], true);
  });
}
