export const JOURNEY_STEPS = Object.freeze(['Follow', 'Like', 'Reply', 'Share', 'Join']);

export function blankJourney(socialRevision = 1) {
  return {index: 1, opened: {}, downloaded: false, social_revision: socialRevision};
}

const POST_HOSTS = new Set(['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);
// Links copied from an attached image or video end in /photo/N or /video/N.
const POST_PATH = /^\/([A-Za-z0-9_]{1,15})\/status\/([0-9]{5,24})(?:\/(?:photo|video)\/[1-4])?\/?$/;

function post(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  // Check the original path as well: URL() normalizes dot segments and default
  // ports, which the server deliberately does not accept as proof links.
  const match = value.trim().match(/^https:\/\/([^/?#]+)([^?#]*)(?:\?[^#]*)?$/i);
  if (!match || !POST_HOSTS.has(match[1])) return null;
  const path = match[2].match(POST_PATH);
  if (!path) return null;
  return {handle: path[1].toLowerCase(), id: path[2]};
}

const WALLET = /^0x[a-fA-F0-9]{40}$/;

/**
 * '' when the wallet can be saved. Surrounding spaces or line breaks from a paste
 * are ignored, exactly as the submission trims them; nothing inside is changed.
 */
export function walletIssue(value) {
  const wallet = typeof value === 'string' ? value.trim() : '';
  if (!wallet) return 'Paste your EVM wallet address to continue.';
  if (WALLET.test(wallet)) return /^0x0{40}$/.test(wallet) ? 'Use your own wallet address, not the zero address.' : '';
  if (/\s/.test(wallet)) return 'Remove the spaces inside your wallet address.';
  if (!wallet.startsWith('0x')) return 'A wallet address starts with 0x.';
  if (/[^0-9a-fA-F]/.test(wallet.slice(2))) return 'After 0x, a wallet address only uses the characters 0-9 and a-f.';
  return `A wallet address has 42 characters. Yours has ${wallet.length}.`;
}

/** The canonical https://x.com/<handle>/status/<id> form the server accepts, or ''. */
export function canonicalPostUrl(value) {
  const proof = post(value);
  return proof ? `https://x.com/${proof.handle}/status/${proof.id}` : '';
}

export function validateProof(value, handle, {otherUrl, targetUrl} = {}) {
  if (typeof value !== 'string' || !value.trim()) return 'Paste the link to your X post to continue.';
  const proof = post(value);
  if (!proof) return 'Paste an https://x.com/your_handle/status/… post link.';
  const owner = typeof handle === 'string' ? handle.trim().replace(/^@/, '').toLowerCase() : '';
  if (!owner) return 'Sign in with X first.';
  // Checked before the owner: pasting our own post is a common slip and needs a clearer hint.
  const target = post(targetUrl);
  if (target && (target.id === proof.id || target.handle === proof.handle) && proof.handle !== owner) {
    return 'This is the Computers RH post, not yours. Paste the link to your own post.';
  }
  if (proof.handle !== owner) return `Use a post from @${owner}, the X account on your profile.`;
  if (target?.id === proof.id) return 'Use your own post link, not the launch post.';
  if (post(otherUrl)?.id === proof.id) return 'This is the same link as your reply. Use two different posts: paste the link of your quote post with your card.';
  return '';
}

function profilePage(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  const match = value.trim().match(/^https:\/\/([^/?#]+)\/([A-Za-z0-9_]{1,15})\/?(?:\?[^#]*)?$/);
  if (!match || !POST_HOSTS.has(match[1]) || ['home','intent','i','search','explore','settings','messages','notifications'].includes(match[2].toLowerCase())) return null;
  return `https://x.com/${match[2].toLowerCase()}`;
}

export function socialTargets(config, referralUrl = '') {
  const target = post(config?.social?.tweet_url);
  const account = profilePage(config?.social?.account_url);
  // Keep the saved 'post' progress key for existing applications.
  const follow = account ? `https://x.com/intent/follow?screen_name=${account.split('/').pop()}` : null;
  if (!target) return {post: follow, like: null, reply: null, quote: null};
  const official = `https://x.com/${target.handle}/status/${target.id}`;
  const text = `I've just joined Early Access for @ComputersRh.\nI'll be playing 24 hours before the public launch.\n\nMy ref link= ${referralUrl}\n${official}`;
  return {
    post: follow,
    like: `https://x.com/intent/like?tweet_id=${target.id}`,
    reply: `https://x.com/intent/tweet?in_reply_to=${target.id}`,
    quote: `https://x.com/intent/tweet?${new URLSearchParams({text})}`,
  };
}

export function stepIssue(index, draft = {}, profile = {}, journey = {}, config) {
  if (index >= 1 && index <= 5 && config?.applications_open === false) return 'Applications are closed.';
  if (index >= 1 && index <= 5 && Number.isSafeInteger(config?.social_revision) && journey.social_revision !== config.social_revision) return 'The launch post changed. Please complete the new steps.';
  if (index >= 1 && index <= 5 && config) {
    const targets = socialTargets(config);
    if (!(index === 1 ? targets.post : targets.like)) return 'The launch post is not available yet.';
  }
  if (index === 1 && !journey?.opened?.post) return 'Open Follow on X to continue.';
  if (index === 2 && !journey?.opened?.like) return 'Open Like on X to continue.';
  if (index === 3) {
    if (!journey?.opened?.reply) return 'Open Reply on X to continue.';
    return validateProof(draft.reply_url, profile?.x_handle || profile?.handle, {targetUrl: config?.social?.tweet_url});
  }
  if (index === 4) {
    if (journey?.downloaded !== true) return 'Download your invitation card before sharing it on X.';
    if (!journey?.opened?.quote) return 'Open Quote on X to continue.';
    return validateProof(draft.quote_url, profile?.x_handle || profile?.handle, {otherUrl: draft.reply_url, targetUrl: config?.social?.tweet_url});
  }
  if (index === 5) {
    for (let prior = 1; prior <= 4; prior += 1) {
      const issue = stepIssue(prior, draft, profile, journey, config);
      if (issue) return issue;
    }
    if (draft.confirmed !== true) return 'Confirm the actions you completed on X to join.';
  }
  return '';
}

/** Why Continue is disabled, or '' when a pasted link already shows its own message. */
export function continueHint(index, draft = {}, profile = {}, journey = {}, config) {
  const issue = stepIssue(index, draft, profile, journey, config);
  const field = index === 3 ? 'reply_url' : index === 4 ? 'quote_url' : null;
  const fieldShown = index === 3 ? journey?.opened?.reply === true
    : index === 4 && journey?.downloaded === true && journey?.opened?.quote === true;
  if (issue && field && fieldShown && typeof draft?.[field] === 'string' && draft[field].trim()) return '';
  return issue || '';
}

export function nextIncompleteStep(draft, profile, journey, config) {
  for (let index = 1; index <= 4; index += 1) {
    if (stepIssue(index, draft, profile, journey, config)) return index;
  }
  return 5;
}
