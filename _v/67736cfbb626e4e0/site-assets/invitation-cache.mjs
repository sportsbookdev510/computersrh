/** The invitation belongs to the signed-in X identity, not its optional wallet profile. */
export function invitationCard(session,config={}){
  const user=session?.authenticated&&session.user;
  if(!user?.id)return null;
  const options={displayName:user.display_name,handle:user.handle,avatarUrl:user.avatar_url,
    referralUrl:user.referral_url??session.profile?.referral_url??'',cardNumber:user.card_number,
    joinedAt:user.joined_at,earlyAccessAt:config?.early_access_at,publicAccessAt:config?.public_access_at};
  return {options,key:JSON.stringify({identity:user.id,avatarVersion:user.avatar_version??null,...options})};
}

/** Reuse the entire left pane even while its first canvas render is still pending. */
export function retainInvitationAside(previous,next,card){
  if(!next||!card||!next.querySelector('#invite-card'))return null;
  if(previous?.dataset.invitationKey===card.key&&previous.querySelector('#invite-card')){
    next.replaceWith(previous);return previous;
  }
  next.dataset.invitationKey=card.key;return next;
}

/** Coalesce slow portrait/font loads across unrelated form renders. */
export function createInvitationPainter(load){
  const pending=new WeakMap();
  return function paint(canvas,card,isCurrent=()=>true){
    if(!canvas||!card||canvas.dataset.cardKey===card.key)return Promise.resolve();
    const active=pending.get(canvas);
    if(active?.key===card.key)return active.promise;
    const job={key:card.key};pending.set(canvas,job);
    const current=()=>pending.get(canvas)===job&&isCurrent();
    job.promise=(async()=>{
      const module=await load();if(!current())return;
      const meta=await module.renderInviteCard(canvas,card.options);
      if(current()){canvas.setAttribute('aria-label',meta.altText);if(meta.avatarLoaded!==false)canvas.dataset.cardKey=card.key;}
    })().catch(error=>{if(current())throw error;}).finally(()=>{if(pending.get(canvas)===job)pending.delete(canvas);});
    return job.promise;
  };
}
