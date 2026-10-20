import {catalog,compactPayload,buildRequest,parseReview} from './providers.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const safeEqual=async(a,b)=>{const x=await sha(a),y=await sha(b);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0;};
async function boundedJSON(request){const reader=request.body?.getReader();if(!reader)throw Error();let size=0,chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>18000){await reader.cancel();throw Error();}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'https://zhihan-iris.github.io').split(',').map(x=>x.trim());
 if(!origin||!allowed.includes(origin))return json({error:'origin_denied'},403);
 const cors=response=>{const r=new Response(response.body,response);r.headers.set('Access-Control-Allow-Origin',origin);r.headers.set('Vary','Origin');r.headers.set('Access-Control-Allow-Headers','Authorization,Content-Type');r.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');return r;};
 if(request.method==='OPTIONS')return cors(new Response(null,{status:204}));
 try{
 if(!env.TEACHER_ACCESS_TOKEN||env.TEACHER_ACCESS_TOKEN.length<24||!env.TEACHER_GATE)return cors(json({error:'not_configured'},503));
 const auth=request.headers.get('Authorization')||'';if(auth.length>256||!await safeEqual(auth,'Bearer '+env.TEACHER_ACCESS_TOKEN))return cors(json({error:'unauthorized'},401));
 const path=new URL(request.url).pathname;
 if(path==='/models'&&request.method==='GET')return cors(json({providers:catalog(env),limits:{concise:650,detailed:1100,dailyRequests:dailyLimit(env)}}));
 if(path!=='/review'||request.method!=='POST')return cors(json({error:'not_found'},404));
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return cors(json({error:'invalid_input'},400));
 let raw,payload;try{raw=await boundedJSON(request);payload=compactPayload(raw);buildRequest(raw.provider,raw.model,payload,raw.detail,env);}catch{return cors(json({error:'invalid_input_or_model'},400));}
 const clean={provider:raw.provider,model:raw.model,detail:raw.detail==='detailed'?'detailed':'concise',...payload};
 const stub=env.TEACHER_GATE.get(env.TEACHER_GATE.idFromName('zhihan-personal-teacher'));
 return cors(await stub.fetch(new Request('https://internal/review',{method:'POST',body:JSON.stringify(clean)})));
 }catch{return cors(json({error:'service_unavailable'},503));}
}};
function dailyLimit(env){const n=Number(env.MAX_DAILY_REQUESTS);return Number.isInteger(n)&&n>0?Math.min(n,200):40;}
// One Durable Object serializes reservations across devices and Cloudflare locations.
export class TeacherGate{
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
 const raw=await request.json(),payload=compactPayload(raw),now=Date.now(),day=new Date(now).toISOString().slice(0,10),hash=await sha('teacher-v1|'+JSON.stringify(raw));
 const reservation=await this.ctx.storage.transaction(async tx=>{
 const s=await tx.get('budget')||{day,count:0,last:0,cache:{},pending:{}};if(s.day!==day){s.day=day;s.count=0;}
 for(const [k,v]of Object.entries(s.cache))if(now-v.at>86400000)delete s.cache[k];
 for(const [k,v]of Object.entries(s.pending))if(now-v>90000)delete s.pending[k];
 if(s.cache[hash])return {cached:{...s.cache[hash].result,cached:true}};
 if(s.pending[hash])return {error:'already_running',status:409};
 if(s.count>=dailyLimit(this.env))return {error:'daily_limit',status:429};
 if(now-s.last<10000)return {error:'rate_limit',status:429};
 s.count++;s.last=now;s.pending[hash]=now;await tx.put('budget',s);return {ok:true};
 });
 if(reservation.cached)return json(reservation.cached);if(reservation.error)return json({error:reservation.error},reservation.status);
 let result,error,status=502;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{const req=buildRequest(raw.provider,raw.model,payload,raw.detail,this.env);const response=await fetch(req.url,{method:'POST',headers:req.headers,body:JSON.stringify(req.body),signal:controller.signal});if(!response.ok){error=response.status===429?'provider_limit':'provider_error';}else{result={...parseReview(raw.provider,await response.json()),provider:raw.provider,model:raw.model,cached:false,createdAt:Date.now()};}}
 catch(e){error=e.name==='AbortError'?'timeout':['incomplete_response','invalid_response'].includes(e.message)?e.message:'provider_error';}finally{clearTimeout(timer);}
 await this.ctx.storage.transaction(async tx=>{const s=await tx.get('budget');delete s.pending[hash];if(result){s.cache[hash]={at:Date.now(),result};const keys=Object.keys(s.cache).sort((a,b)=>s.cache[a].at-s.cache[b].at);for(const k of keys.slice(0,Math.max(0,keys.length-80)))delete s.cache[k];}await tx.put('budget',s);});
 return result?json(result):json({error},status);
 }
}
