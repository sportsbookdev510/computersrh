const ACTIONS = ['post', 'like', 'reply', 'quote'];

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function proofDraft(value) {
  // Keep unfinished input, but never turn an overlong URL into a valid proof
  // by truncating it. The journey validator still checks ownership and format.
  return typeof value === 'string' && value.length <= 300 ? value : '';
}

/** Restore display state only. Validate tasks before trusting the step hint. */
export function restoreJourneyState(saved) {
  const state = record(saved);
  const draft = record(state.draft);
  const journey = record(state.journey);
  const opened = record(journey.opened);
  return {
    draft: {
      liked: draft.liked === true,
      confirmed: draft.confirmed === true,
      reply_url: proofDraft(draft.reply_url),
      quote_url: proofDraft(draft.quote_url),
    },
    journey: {
      index: Number.isInteger(journey.index) && journey.index >= 1 && journey.index <= 5 ? journey.index : 1,
      opened: Object.fromEntries(ACTIONS.filter(action => opened[action] === true).map(action => [action, true])),
      downloaded: journey.downloaded === true,
      social_revision: Number.isSafeInteger(journey.social_revision) && journey.social_revision >= 1 ? journey.social_revision : 1,
    },
  };
}

/** A new launch post requires new actions, while the same identity and card stay. */
export function reconcileJourneyRevision(draft, journey, socialRevision, {submitted = false} = {}) {
  const revision = Number.isSafeInteger(socialRevision) && socialRevision >= 1 ? socialRevision : 1;
  const current = restoreJourneyState({draft, journey});
  if (submitted || current.journey.social_revision === revision) return {changed: false, draft, journey};
  return {
    changed: true,
    draft: {...draft, liked: false, confirmed: false, reply_url: '', quote_url: ''},
    journey: {index: 1, opened: {}, downloaded: current.journey.downloaded, social_revision: revision},
  };
}

/**
 * A cookie-authenticated, single-writer queue. Only the latest pending snapshot
 * is retained. Failed saves stay pending until another schedule() or flush().
 *
 * Before changing authentication cookies, setIdentity(null), then await
 * pendingPromise. This discards queued old-account work and waits for requests
 * already sent. To save remaining edits first, await flush() before that pair.
 */
export function createJourneyStore({save, onError, delay = 350} = {}) {
  if (typeof save !== 'function') throw new TypeError('A journey save function is required.');
  const debounce = Number.isFinite(delay) && delay >= 0 ? delay : 350;
  let identity = null;
  let generation = 0;
  let revision = 0;
  let pending = null;
  let running = null;
  let timer = null;
  let disposed = false;

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function isCurrent(entry) {
    return !disposed && identity !== null && entry.generation === generation && entry.identity === identity;
  }

  async function drain() {
    while (pending && !disposed) {
      const entry = pending;
      pending = null;
      if (!isCurrent(entry)) continue;
      clearTimer();
      try {
        // Bind each write to the account that queued it. A different tab can
        // replace the browser's cookie without calling this store's methods;
        // the server must reject that mismatch rather than save to its user.
        await save({...entry.payload, x_id: entry.identity});
      } catch (error) {
        // A previous account's response cannot overwrite or report errors in
        // the new account. Its already-dispatched request cannot be cancelled.
        if (!isCurrent(entry)) continue;
        if (!pending || pending.revision < entry.revision) pending = entry;
        clearTimer();
        try { onError?.(error, entry.payload); } catch { /* Preserve the original save error. */ }
        throw error;
      }
    }
  }

  function flush() {
    clearTimer();
    if (running) return running;
    if (disposed || !pending || identity === null) return Promise.resolve();
    // Defer the first save until `running` is set, including for synchronous
    // save implementations and exceptions.
    running = Promise.resolve().then(drain).finally(() => { running = null; });
    return running;
  }

  return {
    setIdentity(value) {
      if (disposed) return false;
      const next = typeof value === 'string' && value ? value : null;
      if (next === identity) return false;
      identity = next;
      generation += 1;
      pending = null;
      clearTimer();
      return true;
    },

    invalidate() {
      if (disposed) return;
      generation += 1;
      pending = null;
      clearTimer();
    },

    schedule(draft, journey) {
      if (disposed || identity === null) return false;
      pending = {
        identity,
        generation,
        revision: ++revision,
        payload: restoreJourneyState({draft, journey}),
      };
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        // Background failures are reported via onError and retained for retry;
        // only explicit flush callers receive a rejected promise.
        void flush().catch(() => {});
      }, debounce);
      return true;
    },

    flush,

    get pendingPromise() {
      // Authentication changes need a settlement barrier even after a failure.
      return running ? running.then(() => {}, () => {}) : Promise.resolve();
    },

    dispose() {
      disposed = true;
      identity = null;
      generation += 1;
      pending = null;
      clearTimer();
    },
  };
}
