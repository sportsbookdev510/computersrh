import {request} from './api.mjs';
const providers=new Map();let selected=null;let listener=null;let connecting=false;let pendingSignout=Promise.resolve();
if(typeof window!=='undefined'){
  window.addEventListener('eip6963:announceProvider',event=>{const detail=event.detail;if(detail?.info?.uuid&&detail?.provider?.request)providers.set(detail.info.uuid,{name:detail.info.name,provider:detail.provider});});
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}
export function availableWallets(){
  if(providers.size)return Array.from(providers.values());
  if(globalThis.window?.ethereum?.request)return [{name:window.ethereum.isMetaMask?'MetaMask':'Browser wallet',provider:window.ethereum}];
  return [];
}
export async function connectWallet(provider,onAccountChange){
  if(connecting)throw new Error('A wallet connection is already in progress. Finish it in your wallet first.');
  connecting=true;
  if(selected&&listener)selected.removeListener?.('accountsChanged',listener);
  selected=null;listener=null;
  let expected=null,changed=false,verified=false;
  const changedDuringSignIn=accounts=>{if(expected&&accounts?.[0]?.toLowerCase()!==expected)changed=true;};
  const changedError=()=>new Error('Your wallet changed. Connect again to continue.');
  const checkAccount=async()=>{
    const current=await provider.request({method:'eth_accounts'});
    if(changed||current?.[0]?.toLowerCase()!==expected)throw changedError();
  };
  try{
    // Finish any previous account-change logout before a new response sets a cookie.
    await pendingSignout;
    provider.on?.('accountsChanged',changedDuringSignIn);
    const accounts=await provider.request({method:'eth_requestAccounts'});
    const wallet=accounts?.[0];if(!/^0x[a-fA-F0-9]{40}$/.test(wallet||''))throw new Error('No wallet address was returned. Unlock your wallet and try again.');
    expected=wallet.toLowerCase();
    const challenge=await request('challenge',{wallet});
    const encoded='0x'+Array.from(new TextEncoder().encode(challenge.message),n=>n.toString(16).padStart(2,'0')).join('');
    const signature=await provider.request({method:'personal_sign',params:[encoded,wallet]});
    await checkAccount();
    const session=await request('verify',{nonce:challenge.nonce,signature});
    verified=true;
    // Account events can arrive while the verification HTTP request is in flight.
    await checkAccount();
    if(!session.authenticated||session.wallet?.toLowerCase()!==expected)throw changedError();
    provider.removeListener?.('accountsChanged',changedDuringSignIn);
    selected=provider;
    const activeListener=accounts=>{
      if(selected!==provider||listener!==activeListener)return;
      if(accounts?.[0]?.toLowerCase()===expected)return;
      selected?.removeListener?.('accountsChanged',listener);selected=null;listener=null;
      pendingSignout=Promise.resolve().then(()=>onAccountChange?onAccountChange():request('logout',{})).catch(()=>{});
    };
    listener=activeListener;
    provider.on?.('accountsChanged',listener);
    return session;
  }catch(error){
    if(verified){
      // Revoke a successfully created session that no longer matches the provider.
      await request('logout',{});
    }
    throw error;
  }finally{
    provider.removeListener?.('accountsChanged',changedDuringSignIn);
    connecting=false;
  }
}
export function walletError(error){
  if(error?.code===4001 || error?.code==='ACTION_REJECTED')return 'Connection cancelled. You can reconnect whenever you’re ready.';
  if(error?.code===-32002)return 'Your wallet is waiting for a response. Open the wallet extension to continue.';
  return error?.message||'Could not connect your wallet. Please try again.';
}
