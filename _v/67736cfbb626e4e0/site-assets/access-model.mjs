/** X application status only. This screen never authenticates a game wallet. */
export function accessModel(state, {surface = 'play'} = {}) {
  const {xSession = {}, gate = {}, config = {}} = state;
  const signedIn = xSession.authenticated === true;
  const submitted = signedIn && Boolean(xSession.application && xSession.profile?.wallet);
  const membership = submitted ? 'listed' : signedIn ? 'unlisted' : 'unknown';
  const phase = gate.phase || 'before_early';
  const opensAt = submitted ? config.early_access_at : config.public_access_at;
  const hasOpened = phase === 'public' || (submitted && phase === 'early_access');
  return {
    membership,
    headline: submitted ? 'You are on the early access list!' : signedIn
      ? 'You are not on the early access list.' : 'The island opens soon.',
    wallet: submitted ? xSession.profile.wallet : '',
    walletLabel: 'Registered wallet',
    deadline: hasOpened ? null : opensAt,
    opensAt, opensLabel: submitted ? 'Early Access' : 'Public opening', phase,
    // Game sign-in is a separate flow. Returning players may use Play without X.
    action: config.game_launch_enabled !== false && (hasOpened || (surface === 'play' && phase === 'early_access')) ? 'play' : 'wait',
    gamePreparing: hasOpened && config.game_launch_enabled === false,
    canApply: config.applications_open === true && phase === 'before_early' && !submitted,
    canSaveCard: submitted && Boolean(xSession.user),
    canSignOutX: surface === 'early' && signedIn,
  };
}
