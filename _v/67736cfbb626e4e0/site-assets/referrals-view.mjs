import {icon,escapeHtml as e,shortWallet} from './ui.mjs';

export function referralLinkView(url){
  if(!/^https:\/\/computersrh\.xyz\/ref=[a-z0-9_]{3,15}$/.test(url||''))return '';
  return `<div class="access-referral-link"><label for="referral-link">Your referral link</label><div><input id="referral-link" aria-label="Your referral link" value="${e(url)}" readonly><button class="button primary" type="button" data-action="copy">${icon('copy')}<span>Copy</span></button></div></div>`;
}

export function referralsView(data,{busy=false,error=''}={}){
  const available=Boolean(data),total=data?.total??0,page=data?.page??1;
  const first=(page-1)*4+1,last=Math.min(page*4,total);
  const rows=(data?.items??[]).map(({wallet})=>`<li><span class="referral-wallet" title="${e(wallet)}">${e(shortWallet(wallet))}</span><button type="button" class="referral-copy" data-action="copy-referral-wallet" data-wallet="${e(wallet)}" aria-label="Copy wallet ${e(shortWallet(wallet))}">${icon('copy')}</button></li>`).join('');
  const empty=available?'No referrals yet. Share your link.':'Referrals could not load.';
  return `<aside class="access-referrals" aria-labelledby="referrals-title" aria-busy="${busy}"><h3 id="referrals-title">Your referrals</h3><strong class="referral-total">${available?total.toLocaleString('en-US'):'—'}</strong><p class="referral-caption">Completed applications</p><div class="referral-list-space">${rows?`<ul class="referral-wallets" aria-label="Referred wallets">${rows}</ul>`:`<p class="referral-empty">${empty}</p>`}</div><div class="referral-pagination"><span>${available&&total?`${first}–${last} of ${total}`:available?'0 referrals':''}</span><div><button type="button" data-action="referrals-page" data-page="${page-1}" aria-label="Previous referrals" ${busy||page===1||!available?'disabled':''}>${icon('back')}</button><button type="button" data-action="referrals-page" data-page="${page+1}" aria-label="Next referrals" ${busy||!data?.has_next?'disabled':''}>${icon('arrow')}</button></div></div><p class="referrals-feedback" role="status">${e(error||(busy?'Loading…':''))}</p>${error||!available?'<button type="button" class="text-button" data-action="referrals-page" data-page="1">Try again</button>':''}</aside>`;
}

export async function copyReferralWallet(button,write=text=>navigator.clipboard.writeText(text)){
  const wallet=button.dataset.wallet;
  if(!/^0x[0-9a-f]{40}$/i.test(wallet||''))return;
  const old=button.innerHTML,label=button.getAttribute('aria-label');
  try{
    await write(wallet);button.innerHTML=icon('check');button.classList.add('is-copied');button.setAttribute('aria-label','Wallet copied');
    const status=button.closest('.access-referrals')?.querySelector('.referrals-feedback');if(status)status.textContent='Wallet copied.';
    setTimeout(()=>{if(button.isConnected){button.innerHTML=old;button.classList.remove('is-copied');button.setAttribute('aria-label',label);}},2000);
  }catch{
    const row=button.closest('li');row.querySelector('.referral-wallet').textContent=wallet;row.classList.add('copy-fallback');
    const status=button.closest('.access-referrals')?.querySelector('.referrals-feedback');if(status)status.textContent='Select the address to copy it.';
  }
}
