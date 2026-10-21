import test from 'node:test';import assert from 'node:assert/strict';
import worker,{TeacherGate} from '../teacher-server/worker.js';
import {catalog,buildRequest,compactPayload,parseReview} from '../teacher-server/providers.js';
const env={ALLOW_PAID_MODELS:'true',TEACHER_ACCESS_TOKEN:'test-access-code-24-characters',OPENAI_API_KEY:'test-openai',OPENAI_MODELS:'test-small,test-large',DEEPSEEK_API_KEY:'test-deepseek',DEEPSEEK_MODELS:'test-chat',QWEN_API_KEY:'test-qwen',QWEN_MODELS:'test-qwen',ANTHROPIC_API_KEY:'test-anthropic',ANTHROPIC_MODELS:'test-claude',MAX_DAILY_REQUESTS:'2'};
const payload={answer:'rely in parents',reference:'rely on parents',meaning:'依靠父母',context:'',usage:'rely on + 对象',contextCue:false};
const review={verdict:'needs_revision',summary:'介词搭配需要调整。',issues:[{before:'in',after:'on',reason:'rely on 表示依靠。'}],revision:'rely on parents',tip:'记忆 rely on + 对象。'};
const response={choices:[{finish_reason:'stop',message:{content:JSON.stringify(review)}}],usage:{prompt_tokens:200,completion_tokens:100}};
test('catalog exposes only configured model names, never keys; provider requests enforce token caps',()=>{
 assert.equal(catalog(env).length,4);assert.ok(!JSON.stringify(catalog(env)).includes('test-openai'));assert.equal(catalog({OPENAI_MODELS:'x'}).length,0);
 const a=buildRequest('openai','test-small',payload,'concise',env);assert.equal(a.body.max_completion_tokens,1200);assert.equal(a.body.store,false);
 const b=buildRequest('deepseek','test-chat',payload,'detailed',env);assert.equal(b.body.max_tokens,2000);assert.deepEqual(b.body.thinking,{type:'disabled'});
 const c=buildRequest('qwen','test-qwen',payload,'concise',{...env,QWEN_REGION:'singapore'});assert.match(c.url,/dashscope-intl/);assert.equal(c.body.enable_thinking,false);
 const d=buildRequest('anthropic','test-claude',payload,'concise',env);assert.equal(d.headers['anthropic-version'],'2023-06-01');assert.equal(d.body.max_tokens,1200);assert.ok(d.body.system);
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
test('configuration failures distinguish missing or short access codes from missing storage without exposing secrets',async()=>{
 const req=()=>new Request('https://teacher.test/models',{headers:{Origin:'https://zhihan-iris.github.io'}});
 for(const [config,error] of [
  [{...env,TEACHER_ACCESS_TOKEN:'',TEACHER_GATE:{}},'access_token_missing'],
  [{...env,TEACHER_ACCESS_TOKEN:'short-private-value',TEACHER_GATE:{}},'access_token_too_short'],
  [{...env},'storage_not_configured']
 ]){
  const r=await worker.fetch(req(),config);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error});
 }
 const r=await worker.fetch(req(),{...env,TEACHER_GATE:{}});assert.equal(r.status,401);
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


test('free-only mode blocks paid providers and paid model IDs even when keys exist',()=>{
 const free={...env,ALLOW_PAID_MODELS:'false',OPENROUTER_API_KEY:'test-router',OPENROUTER_MODELS:'openrouter/free,test/model:free,test/paid'};
 const list=catalog(free);assert.equal(list.length,1);assert.deepEqual(list[0].models,['openrouter/free','test/model:free']);
 assert.throws(()=>buildRequest('openai','test-small',payload,'concise',free));assert.throws(()=>buildRequest('openrouter','test/paid',payload,'concise',free));
 const req=buildRequest('openrouter','test/model:free',payload,'concise',free);assert.deepEqual(req.body.provider.max_price,{prompt:0,completion:0,request:0});assert.equal(req.body.provider.allow_fallbacks,false);assert.equal(req.body.provider.require_parameters,true);assert.equal(req.body.max_tokens,1200);
 const unset={...free};delete unset.ALLOW_PAID_MODELS;assert.deepEqual(catalog(unset),list);
});
test('model identity in a free router response is preserved for the learner',()=>{
 assert.equal(parseReview('openrouter',{...response,model:'test/actual:free'}).actualModel,'test/actual:free');
});

test('rejects contradictory or incomplete AI passes and preserves the criteria for genuine passes',()=>{
 const pass={...review,verdict:'valid',issues:[],checks:{grammar:true,fluency:true,meaning:true,corePhrases:true}};
 const reply=r=>({...response,choices:[{finish_reason:'stop',message:{content:JSON.stringify(r)}}]});
 assert.deepEqual(parseReview('openrouter',reply(pass)).review.checks,pass.checks);
 for(const key of Object.keys(pass.checks))for(const value of [false,null,undefined])assert.throws(()=>parseReview('openrouter',reply({...pass,checks:{...pass.checks,[key]:value}})));
 assert.throws(()=>parseReview('openrouter',reply({...pass,checks:undefined})));assert.throws(()=>parseReview('openrouter',reply({...pass,issues:review.issues})));
});
test('bounded core phrases travel separately from the reference and survive backend validation',async()=>{
 const {readFile}=await import('node:fs/promises');const {corePhrases}=await import('../corrections.js');const course=JSON.parse(await readFile(new URL('../data/course.json',import.meta.url),'utf8'));
 for(const e of course.expressions){const phrases=corePhrases(e);const clean=compactPayload({...payload,corePhrases:phrases});assert.deepEqual(clean.corePhrases,phrases);}
 assert.throws(()=>compactPayload({...payload,corePhrases:'not an array'}));assert.throws(()=>compactPayload({...payload,corePhrases:['x'.repeat(201)]}));assert.throws(()=>compactPayload({...payload,corePhrases:Array(13).fill('phrase')}));
 const request=buildRequest('openai','test-small',compactPayload({...payload,corePhrases:['rely on']}),'concise',env);assert.deepEqual(JSON.parse(request.body.messages[1].content).corePhrases,['rely on']);
});

test('free models use bounded reasoning and compact passes preserve the original answer',()=>{
 const free={ALLOW_PAID_MODELS:'false',OPENROUTER_API_KEY:'test-key',OPENROUTER_MODELS:'google/gemma-4-31b-it:free,minimax/minimax-m3.1-flash:free,openrouter/free'};
 const gemma=buildRequest('openrouter','google/gemma-4-31b-it:free',payload,'concise',free);assert.deepEqual(gemma.body.reasoning,{enabled:false,exclude:true});assert.equal(gemma.body.max_tokens,1200);
 for(const model of ['minimax/minimax-m3.1-flash:free','openrouter/free']){const req=buildRequest('openrouter',model,payload,'detailed',free);assert.deepEqual(req.body.reasoning,{effort:'low',exclude:true});assert.equal(req.body.max_tokens,2000);assert.equal(req.body.provider.max_price.completion,0);assert.equal(req.body.provider.allow_fallbacks,false);}
 const pass={...review,verdict:'valid',issues:[],revision:'',checks:{grammar:true,fluency:true,meaning:true,corePhrases:true}};
 const reply={...response,choices:[{finish_reason:'stop',message:{content:JSON.stringify(pass)}}]};assert.equal(parseReview('openrouter',reply,payload).review.revision,payload.answer);
});
test('truncated output is never graded, cached or automatically retried and exposes only bounded diagnostics',async()=>{
 const gate=new TeacherGate({storage:storage()},env),oldFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({model:'test-reasoning-model',choices:[{finish_reason:'length',message:{content:'{"verdict":"valid"',reasoning:'DO NOT EXPOSE RAW TEXT'}}],usage:{prompt_tokens:250,completion_tokens:1200,completion_tokens_details:{reasoning_tokens:1150}}});};
 try{const req=new Request('https://internal/review',{method:'POST',body:JSON.stringify({...payload,provider:'openai',model:'test-small',detail:'concise'})});const r=await gate.fetch(req),data=await r.json();assert.equal(r.status,502);assert.equal(data.error,'incomplete_response');assert.equal(data.diagnostics.usage.output,1200);assert.equal(data.diagnostics.usage.reasoning,1150);assert.equal(data.diagnostics.finishReason,'length');assert.equal(data.review,undefined);assert.ok(!JSON.stringify(data).includes('DO NOT EXPOSE'));assert.equal(calls,1);}finally{globalThis.fetch=oldFetch;}
});

test('Cloudflare binding is allowlisted and returns complete native JSON without a fake finish reason',async()=>{
 const model='@cf/meta/llama-3.3-70b-instruct-fp8-fast';let calls=0;
 const native={response:JSON.stringify({...review,checks:{grammar:false,fluency:false,meaning:true,corePhrases:false}}),usage:{prompt_tokens:350,completion_tokens:120}};
 const cf={CLOUDFLARE_FREE_PLAN_CONFIRMED:'true',CLOUDFLARE_MODELS:model+',@cf/paid/anything',AI:{run:async(m,b)=>{calls++;assert.equal(m,model);assert.equal(b.max_tokens,1200);return native;}}};
 assert.deepEqual(catalog(cf)[0].models,[model]);assert.equal(catalog({...cf,CLOUDFLARE_FREE_PLAN_CONFIRMED:'false'}).length,0);assert.equal(catalog({...cf,AI:undefined}).length,0);
 assert.equal(parseReview('cloudflare',native).usage.output,120);assert.throws(()=>parseReview('cloudflare',{response:'{"verdict":"valid"'}));
 const gate=new TeacherGate({storage:storage()},cf);const req=()=>new Request('https://internal/review',{method:'POST',body:JSON.stringify({...payload,provider:'cloudflare',model})});
 const out=await(await gate.fetch(req())).json();assert.equal(out.review.verdict,'needs_revision');assert.equal(calls,1);assert.equal((await(await gate.fetch(req())).json()).cached,true);assert.equal(calls,1);
});
test('Cloudflare daily allocation stops without retries or fallback',async()=>{
 let calls=0;const model='@cf/meta/llama-3.3-70b-instruct-fp8-fast',cf={CLOUDFLARE_FREE_PLAN_CONFIRMED:'true',CLOUDFLARE_MODELS:model,AI:{run:async()=>{calls++;throw Error('daily free allocation exceeded');}}};
 const gate=new TeacherGate({storage:storage()},cf),req=()=>new Request('https://internal/review',{method:'POST',body:JSON.stringify({...payload,provider:'cloudflare',model})});
 assert.equal((await(await gate.fetch(req())).json()).error,'cloudflare_daily_limit');assert.equal((await(await gate.fetch(req())).json()).error,'cloudflare_daily_limit');assert.equal(calls,1);
});
