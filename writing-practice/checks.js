export const KEY='zhihan-free-writing-v1';
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const tokens=text=>[...text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)].map(m=>({word:m[0],offset:m.index,length:m[0].length}));
export const countWords=text=>tokens(text).length;
// Conservative phrase rules, not a claim to understand every possible context.
export const PHRASES=[
 ['discuss(?:es|ed|ing)? about','discuss + the topic','discuss 通常直接接讨论的对象，不加 about。'],
 ['depend(?:s|ed|ing)? of','depend on','表示“取决于、依赖”时，通常搭配 on。'],
 ['concentrat(?:e|es|ed|ing) in','concentrate on','表示“专注于某事”时通常用 on；请结合原句判断。'],
 ['listen(?:s|ed|ing)? music','listen to music','listen 后接听的对象时通常需要 to。'],
 ['married with','married to','表示与某人结婚通常是 married to；若后面是 children，“已婚有孩子”可能正确。'],
 ['interested on','interested in','对某事感兴趣用 interested in。'],
 ['good in English','good at English','表示擅长英语通常用 good at English。'],
 ['responsible of','responsible for','表示“对……负责”用 responsible for。'],
 ['similar with','similar to','表示两者相似，通常用 similar to。'],
 ['different with','different from','比较两者的不同通常用 different from；英美语也有不同的合法搭配。'],
 ['according with','according to','表示“根据某人或某资料”时用 according to。'],
 ['in the other hand','on the other hand','表示“另一方面”的固定表达是 on the other hand。'],
 ['on the contrary of','contrary to','表示“与……相反”可用 contrary to；on the contrary 可单独作连接语。'],
 ['despite of','despite / in spite of','despite 后直接接名词或动名词；in spite of 是另一种结构。'],
 ['in despite of','in spite of / despite','不要混合 despite 和 in spite of 两个结构。'],
 ['more better','better / much better','better 已经是比较级；如需加强程度，可用 much better。'],
 ['more easier','easier / much easier','easier 已经是比较级，不再叠加 more。'],
 ['much people','many people','people 作复数名词时，通常用 many 修饰数量。'],
 ['less informations?','less information','information 在一般含义下不可数，不加复数 -s。'],
 ['many informations?','much information / a lot of information','information 通常不可数，不能与 many 搭配。'],
 ['an advice','a piece of advice / some advice','advice 通常不可数；一条建议可用 a piece of advice。'],
 ['an information','a piece of information','information 通常不可数；一条信息可用 a piece of information。'],
 ['do(?:es|ing)? a decision','make a decision','“作决定”通常搭配 make；注意保留原句时态。'],
 ['did a decision','made a decision','decision 通常搭配 make，过去式为 made。'],
 ['make(?:s)? homework','do homework','“做作业”用 do homework。'],
 ['made homework','did homework','“做作业”的过去式通常写 did homework。'],
 ['strong rain','heavy rain','形容雨势大，通常搭配 heavy rain。'],
 ['heavy wind','strong wind','形容风力强，通常搭配 strong wind。'],
 ['big progress','great progress / significant progress','progress 更常与 great 或 significant 搭配，需结合语境。'],
 ['take attention to','pay attention to','表示“注意……”用 pay attention to。'],
 ['pay importance to','attach importance to','表示“重视……”通常用 attach importance to。'],
 ['play an important effect','have an important effect / play an important role','effect 搭配 have；role 搭配 play。'],
 ['bring negative effects to','have negative effects on','表示“对……有负面影响”通常用 have negative effects on。'],
 ['benefit for people','benefit people / be beneficial to people','动词 benefit 可以直接接受益者；形容词 beneficial 通常接 to。'],
 ['lack of the ability','lack the ability / a lack of the ability','若 lack 是动词，后面通常直接接宾语；名词 a lack of 是正确结构。'],
 ['cope up with','cope with','应对某事通常是 cope with，不加 up。'],
 ['emphasiz(?:e|es|ed|ing) on','emphasize + the point','动词 emphasize 直接接宾语；名词 emphasis 可搭配 on。'],
 ['emphasis(?:e|es|ed|ing) on','emphasise + the point','动词 emphasise 直接接宾语；名词 emphasis 可搭配 on。'],
 ['prevent (?:people|students|children) to','prevent someone from doing','prevent 表示阻止时，一般用 prevent someone from doing。'],
 ['informations','information','information 在常见学术写作中通常不可数。'],
 ['advices','advice','advice 在一般“建议”义下通常不可数。'],
 ['equipments','equipment','equipment 在一般“设备”义下通常不可数。'],
 ['knowledges','knowledge','knowledge 在一般“知识”义下通常不可数。'],
 ['alot','a lot','a lot 通常写成两个词。']
].filter(x=>x[2] && !['married with','lack of the ability','benefit for people'].includes(x[0]));
export function phraseIssues(text){const issues=[];for(const [pattern,after,reason]of PHRASES){for(const m of text.matchAll(new RegExp('\\b(?:'+pattern+')\\b','gi'))){if(issues.some(i=>m.index<i.offset+i.length&&m.index+m[0].length>i.offset))continue;issues.push({type:'collocation',offset:m.index,length:m[0].length,before:m[0],suggestions:[after],reason,source:'本地搭配规则'});}}return issues.sort((a,b)=>a.offset-b.offset);}
export function normalizeRemote(data,text){if(!data||!Array.isArray(data.matches))throw Error('检查服务返回格式异常。');return data.matches.filter(m=>Number.isInteger(m.offset)&&Number.isInteger(m.length)&&m.offset>=0&&m.length>0&&m.offset+m.length<=text.length).filter(m=>!['CASING','PUNCTUATION','TYPOGRAPHY','STYLE','REDUNDANCY'].includes(m.rule?.category?.id)).map(m=>{const before=text.slice(m.offset,m.offset+m.length);const replacements=(m.replacements||[]).filter(r=>typeof r.value==='string').map(r=>r.value).slice(0,5);return {type:m.rule?.issueType==='misspelling'?'spelling':'collocation',offset:m.offset,length:m.length,before,suggestions:replacements,reason:String(m.message||'请结合上下文核对。').slice(0,1200),source:'LanguageTool',rule:String(m.rule?.id||'')};}).filter(i=>!(i.suggestions.length&&i.suggestions.every(s=>s.toLowerCase()===i.before.toLowerCase())));}
export function mergeIssues(local,remote){const all=[...remote];for(const i of local)if(!all.some(r=>i.offset<r.offset+r.length&&r.offset<i.offset+i.length))all.push(i);return all.sort((a,b)=>a.offset-b.offset||a.length-b.length).slice(0,160);}
export function annotated(text,issues){let at=0,html='';for(const [index,i]of issues.entries()){if(i.offset<at||text.slice(i.offset,i.offset+i.length)!==i.before)continue;html+=escapeHTML(text.slice(at,i.offset))+`<mark class="${i.type}" id="mark-${index}">${escapeHTML(i.before)}<sup>${index+1}</sup></mark>`;at=i.offset+i.length;}return html+escapeHTML(text.slice(at));}
export function readDraft(raw){let r;try{r=JSON.parse(raw);}catch{}return {topic:typeof r?.topic==='string'?r.topic.slice(0,2000):'',text:typeof r?.text==='string'?r.text.slice(0,12000):'',dialect:['en-GB','en-US'].includes(r?.dialect)?r.dialect:'en-GB',online:r?.online===true,started:r?.started===true,ignored:Array.isArray(r?.ignored)?r.ignored.filter(s=>typeof s==='string'&&s.length<80).slice(0,100):[]};}
