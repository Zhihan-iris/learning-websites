import test from 'node:test';import assert from 'node:assert/strict';
import {readFreeQuota,retryTime} from '../teacher-server/limits.js';
import {TeacherGate} from '../teacher-server/worker.js';
const env={OPENROUTER_API_KEY:'never-expose',OPENROUTER_MODELS:'test/a:free,test/b:free',MAX_DAILY_REQUESTS:'40'};
function storage(){const map=new Map();let tail=Promise.resolve();const db={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v)),transaction:fn=>{const call=tail.then(()=>fn(db));tail=call.catch(()=>{});return call;}};return db;}
const req=model=>new Request('https://internal/review',{method:'POST',body:JSON.stringify({provider:'openrouter',model,detail:'concise',answer:'rely in peers',reference:'rely on peers',meaning:'依靠同龄人'})});
test('quota reads return only validated counts; absent or invalid quota remains unknown',async()=>{
 const original=fetch;
 try{for(const quota of [undefined,{used:1,limit:50,remaining:49},{used:1,limit:50,remaining:-1}]){
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://openrouter.ai/api/v1/key');assert.equal(options.method,undefined);return Response.json({data:{label:'private-account',free_model_daily_requests:quota}});};
  const q=await readFreeQuota(env);if(quota?.remaining===49){assert.equal(q.remaining,49);assert.ok(q.resetsAt>Date.now());assert.ok(!JSON.stringify(q).includes('private'));assert.ok(!JSON.stringify(q).includes('never-expose'));}else assert.equal(q,null);
 }}finally{globalThis.fetch=original;}
});
test('retry hints support seconds and dates without inventing a provider deadline',()=>{
 const now=Date.now();assert.equal(retryTime(new Headers({'Retry-After':'90'}),now),now+90000);assert.equal(retryTime(new Headers(),now),null);assert.equal(retryTime(new Headers({'Retry-After':'invalid'}),now),null);assert.ok(retryTime(new Headers({'Retry-After':new Date(now+90000).toUTCString()}),now)>now);
});
test('daily free quota blocks all models without another model request',async()=>{
 const original=fetch,db=storage(),gate=new TeacherGate({storage:db},env);let modelCalls=0,quotaCalls=0;
 globalThis.fetch=async url=>{if(url.endsWith('/key')){quotaCalls++;return Response.json({data:{free_model_daily_requests:{used:50,limit:50,remaining:0}}});}modelCalls++;return Response.json({error:{message:'never forward upstream details'}},{status:429});};
 try{const r=await gate.fetch(req('test/a:free')),a=await r.json();assert.equal(r.status,429);assert.equal(a.error,'provider_daily_limit');assert.equal(a.limit.quota.remaining,0);assert.equal(a.limit.scope,'provider');assert.ok(!JSON.stringify(a).includes('never forward'));
 const b=await(await gate.fetch(req('test/b:free'))).json();assert.equal(b.error,'provider_daily_limit');assert.equal(modelCalls,1);assert.equal(quotaCalls,1);assert.equal((await db.get('budget')).count,1);
 }finally{globalThis.fetch=original;}
});
test('temporary rate limiting obeys Retry-After and does not block existing cached feedback',async()=>{
 const original=fetch,db=storage(),gate=new TeacherGate({storage:db},env);let calls=0;
 globalThis.fetch=async url=>url.endsWith('/key')?Response.json({data:{free_model_daily_requests:{used:2,limit:50,remaining:48}}}):(calls++,Response.json({}, {status:429,headers:{'Retry-After':'120'}}));
 try{const a=await(await gate.fetch(req('test/a:free'))).json();assert.equal(a.error,'provider_rate_limit');assert.equal(a.limit.waitSource,'provider');assert.equal(a.limit.quota.remaining,48);assert.ok(a.limit.retryAt>Date.now()+110000);
 assert.equal((await(await gate.fetch(req('test/a:free'))).json()).error,'provider_rate_limit');assert.equal(calls,1);
 const s=await db.get('budget');s.last=0;await db.put('budget',s);await gate.fetch(req('test/b:free'));assert.equal(calls,2);
 const raw=await req('test/a:free').json(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('teacher-native-v6|'+JSON.stringify(raw))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const cachedState=await db.get('budget');cachedState.cache[hash]={at:Date.now(),result:{review:{summary:'Existing feedback'}}};await db.put('budget',cachedState);const cached=await(await gate.fetch(req('test/a:free'))).json();assert.equal(cached.cached,true);assert.equal(cached.review.summary,'Existing feedback');assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});
