const SUPABASE_HOST='jehohdnvkmrggqyhgpvn.supabase.co';
const AUTH_PARAMETERS=new Set(['code','state','error','error_code','error_description','error_uri','x_error','access_token','refresh_token','provider_token','provider_refresh_token','expires_at','expires_in','token_type']);
const FAILED='X sign-in did not finish. Please try again.';
const CANCELLED='X sign-in was cancelled. You can try again whenever you’re ready.';

// Remove callback credentials before any API request, scene load or navigation.
// Only the short-lived PKCE code is sent back to our same-origin server. The
// browser never exchanges or stores Supabase access, refresh or provider tokens.
export function consumeXCallback(href,replaceUrl){
  const url=new URL(href),query=[...url.searchParams];
  const fragment=new URLSearchParams(url.hash.slice(1));
  const fragmentAuth=[...fragment].filter(([key])=>AUTH_PARAMETERS.has(key.toLowerCase()));
  const queryAuth=query.filter(([key])=>AUTH_PARAMETERS.has(key.toLowerCase()));
  if(!queryAuth.length&&!fragmentAuth.length)return {kind:'none'};
  for(const [key] of queryAuth)url.searchParams.delete(key);
  // OAuth fragments have no application meaning. Remove the whole fragment,
  // including unknown provider fields, rather than retaining sensitive extras.
  if(fragmentAuth.length)url.hash='';
  replaceUrl(url.pathname+url.search+url.hash);
  const parameters=[...queryAuth,...fragmentAuth];
  const errors=parameters.filter(([key])=>['error','error_code','error_description','error_uri','x_error'].includes(key.toLowerCase()));
  if(errors.length)return {kind:'error',error:errors.some(([key,value])=>['error','error_code'].includes(key.toLowerCase())&&value==='access_denied')?CANCELLED:FAILED};
  const codes=queryAuth.filter(([key])=>key.toLowerCase()==='code');
  if(fragmentAuth.length||parameters.some(([key])=>key.toLowerCase().includes('token'))||
      codes.length!==1||codes[0][0]!=='code'||!/^\/(?:early-access|creators|collab)\/?$/.test(url.pathname)||
      !/^[A-Za-z0-9._~-]{1,2048}$/.test(codes[0][1]))return {kind:'error',error:FAILED};
  return {kind:'code',code:codes[0][1]};
}

export async function completeXCallback(callback,request){
  if(callback.kind!=='code')return callback;
  try{
    await request('x/complete',{code:callback.code},{timeoutMs:30000});
    return {kind:'complete'};
  }catch{
    // Provider response details can contain credentials or account data. Show a
    // fixed message; the user can restart sign-in to obtain a fresh PKCE code.
    return {kind:'error',error:FAILED};
  }
}

export function xAuthorizationUrl(value,mode){
  const unavailable=()=>{throw new Error('X sign-in is unavailable. Please try again later.');};
  if(typeof value!=='string'||value.length>8192||/[\u0000-\u0020\u007f\\#]/.test(value))return unavailable();
  let url;try{url=new URL(value);}catch{return unavailable();}
  const authority=/^https:\/\/([^/?#]+)\//.exec(value)?.[1];
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||authority!==url.hostname)return unavailable();
  if(mode==='oauth'&&url.hostname==='x.com'&&url.pathname==='/i/oauth2/authorize')return url.href;
  if(mode==='supabase'&&url.hostname===SUPABASE_HOST&&url.pathname==='/auth/v1/authorize'&&
      url.searchParams.getAll('provider').length===1&&url.searchParams.get('provider')==='x')return url.href;
  return unavailable();
}
