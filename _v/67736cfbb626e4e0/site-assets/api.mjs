export class ApiError extends Error { constructor(message,status=0){super(message);this.status=status;} }
/**
 * Vercel's CDN may answer the shared launch data from a copy that is ``Age`` seconds old (a busy or
 * unreachable island keeps it for up to a day). The server clock in that copy is moved forward by its
 * age, so every countdown keeps the server's time instead of running late.
 */
export function ageCorrected(payload,age){
  const seconds=Number(age),at=Date.parse(payload?.server_now);
  if(!age||!Number.isFinite(seconds)||seconds<=0||seconds>7*86400||!Number.isFinite(at))return payload;
  return {...payload,server_now:new Date(at+seconds*1000).toISOString()};
}
export async function request(endpoint,body,options={}) {
  const {timeoutMs=12000,...fetchOptions}=options;
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new TypeError('Request timeout must be between 1 and 60000 milliseconds.');
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(`/api/early-access/${endpoint}`,{
      method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',
      headers:body===undefined?{'Accept':'application/json'}:{'Content-Type':'application/json','Accept':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,...fetchOptions,
    });
    const payload=await response.json().catch(()=>({error:'The island could not respond. Please try again.'}));
    if(!response.ok)throw new ApiError(payload.error || 'Please try again.',response.status);
    return ageCorrected(payload,response.headers?.get?.('age'));
  } catch(error) {
    if(error instanceof ApiError)throw error;
    throw new ApiError(error.name==='AbortError'?'The connection took too long. Please try again.':'The island is offline. Check your connection and try again.');
  } finally{clearTimeout(timer);}
}
