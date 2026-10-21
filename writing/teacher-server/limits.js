// Only expose numeric quota information; never forward account details or upstream errors.
export async function readFreeQuota(env){
 if(!env.OPENROUTER_API_KEY)return null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const r=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+env.OPENROUTER_API_KEY},signal:controller.signal});if(!r.ok)return null;
 const q=(await r.json())?.data?.free_model_daily_requests;
 if(!q||!['used','limit','remaining'].every(k=>Number.isSafeInteger(q[k])&&q[k]>=0)||q.remaining>q.limit)return null;
 const now=new Date();return {used:q.used,limit:q.limit,remaining:q.remaining,resetsAt:Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)};
 }catch{return null;}finally{clearTimeout(timer);}
}
export function retryTime(headers,now=Date.now()){
 const raw=headers.get('Retry-After');if(!raw)return null;
 const seconds=Number(raw),time=Number.isFinite(seconds)?now+seconds*1000:Date.parse(raw);
 return Number.isFinite(time)&&time>now?Math.min(time,now+86400000):null;
}
export async function rateLimitDetails(response,provider,env){
 const quota=provider==='openrouter'?await readFreeQuota(env):null;
 const exhausted=quota?.remaining===0,now=Date.now(),reported=retryTime(response.headers,now);
 return {error:exhausted?'provider_daily_limit':'provider_rate_limit',scope:exhausted?'provider':'model',retryAt:exhausted?quota.resetsAt:reported||now+60000,waitSource:exhausted?'quota':reported?'provider':'suggested',quota};
}
