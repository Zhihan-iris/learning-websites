import test from 'node:test';import assert from 'node:assert/strict';
import worker,{TeacherGate} from '../teacher-server/worker.js';
import {catalog,buildRequest,compactPayload,parseReview} from '../teacher-server/providers.js';
const env={TEACHER_ACCESS_TOKEN:'test-access-code-24-characters',OPENAI_API_KEY:'test-openai',OPENAI_MODELS:'test-small,test-large',DEEPSEEK_API_KEY:'test-deepseek',DEEPSEEK_MODELS:'test-chat',QWEN_API_KEY:'test-qwen',QWEN_MODELS:'test-qwen',ANTHROPIC_API_KEY:'test-anthropic',ANTHROPIC_MODELS:'test-claude',MAX_DAILY_REQUESTS:'2'};
const payload={answer:'rely in parents',reference:'rely on parents',meaning:'依靠父母',context:'',usage:'rely on + 对象',contextCue:false};
const review={verdict:'needs_revision',summary:'介词搭配需要调整。',issues:[{before:'in',after:'on',reason:'rely on 表示依靠。'}],revision:'rely on parents',tip:'记忆 rely on + 对象。'};
const response={choices:[{finish_reason:'stop',message:{content:JSON.stringify(review)}}],usage:{prompt_tokens:200,completion_tokens:100}};
test('catalog exposes only configured model names, never keys; provider requests enforce token caps',()=>{
 assert.equal(catalog(env).length,4);assert.ok(!JSON.stringify(catalog(env)).includes('test-openai'));assert.equal(catalog({OPENAI_MODELS:'x'}).length,0);
 const a=buildRequest('openai','test-small',payload,'concise',env);assert.equal(a.body.max_completion_tokens,650);assert.equal(a.body.store,false);
 const b=buildRequest('deepseek','test-chat',payload,'detailed',env);assert.equal(b.body.max_tokens,1100);assert.deepEqual(b.body.thinking,{type:'disabled'});
 const c=buildRequest('qwen','test-qwen',payload,'concise',{...env,QWEN_REGION:'singapore'});assert.match(c.url,/dashscope-intl/);assert.equal(c.body.enable_thinking,false);
 const d=buildRequest('anthropic','test-claude',payload,'concise',env);assert.equal(d.headers['anthropic-version'],'2023-06-01');assert.equal(d.body.max_tokens,650);assert.ok(d.body.system);
 assert.throws(()=>buildRequest('openai','unapproved',payload,'concise',env));assert.throws(()=>compactPayload({...payload,answer:'x'.repeat(2001)}));
});
test('parses real usage fields and rejects truncated or malformed model responses',()=>{
 assert.equal(parseReview('openai',response).usage.input,200);assert.equal(parseReview('deepseek',response).review.verdict,'needs_revision');
 const a=parseReview('anthropic',{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(review)}],usage:{input_tokens:100,output_tokens:50}});assert.equal(a.usage.output,50);
 assert.throws(()=>parseReview('openai',{...response,choices:[{finish_reason:'length'}]}));assert.throws(()=>parseReview('openai',{choices:[{finish_reason:'stop',message:{content:'{}'}}]}));
});
test('CORS and access code are required before exposing models or calling the backend',async()=>{
 const ready={...env,TEACHER_GATE:{}};const req=(origin,token)=>new Request('https://teacher.test/models',{headers:{Origin:origin,Authorization:'Bearer '+token}});
 assert.equal((await worker.fetch(req('https://evil.test',env.TEACHER_ACCESS_TOKEN),ready)).status,403);
 assert.equal((await worker.fetch(req('https://zhihan-iris.github.io','wrong'),ready)).status,401);
 const r=await worker.fetch(req('https://zhihan-iris.github.io',env.TEACHER_ACCESS_TOKEN),ready);assert.equal(r.status,200);assert.equal((await r.json()).providers.length,4);
});
function storage(){const map=new Map();let tail=Promise.resolve();const db={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v)),transaction:fn=>{const call=tail.then(()=>fn(db));tail=call.catch(()=>{});return call;}};return db;}
test('backend caches identical reviews, prevents concurrent duplicates and enforces daily quota',async()=>{
 const db=storage(),gate=new TeacherGate({storage:db},env),oldFetch=globalThis.fetch;let calls=0,release;
 globalThis.fetch=async()=>{calls++;await new Promise(r=>release=r);return Response.json(response);};
 const req=answer=>new Request('https://internal/review',{method:'POST',body:JSON.stringify({...payload,answer,provider:'openai',model:'test-small',detail:'concise'})});
 try{
 const first=gate.fetch(req('rely in parents'));while(!release)await new Promise(r=>setTimeout(r,1));
 assert.equal((await gate.fetch(req('rely in parents'))).status,409);release();assert.equal((await first).status,200);
 const cached=await(await gate.fetch(req('rely in parents'))).json();assert.equal(cached.cached,true);assert.equal(calls,1);
 assert.equal((await gate.fetch(req('rely for parents'))).status,429);
 const budget=await db.get('budget');budget.count=2;budget.last=0;await db.put('budget',budget);const limited=await gate.fetch(req('rely for parents'));assert.equal((await limited.json()).error,'daily_limit');assert.equal(calls,1);
 }finally{globalThis.fetch=oldFetch;}
});
