export const STORAGE_KEY='zhihan-writing-v1';
const day=86400000;
const spellings={colour:'color',colours:'colors',labour:'labor',centre:'center',centres:'centers',neighbourhood:'neighborhood',neighbourhoods:'neighborhoods',traveller:'traveler',travellers:'travelers',organisation:'organization',organisations:'organizations',organisational:'organizational',behaviour:'behavior',behaviours:'behaviors',analyse:'analyze',analysing:'analyzing',realise:'realize',realize:'realize',minimise:'minimize',minimising:'minimizing',socialise:'socialize',globalisation:'globalization',globalization:'globalization',specialised:'specialized',specialise:'specialize',specialising:'specializing',subsidised:'subsidized',aging:'ageing',programme:'program',programmes:'programs',popularisation:'popularization',flavour:'flavor',defence:'defense',offence:'offense',offences:'offenses',counselling:'counseling',materialisation:'materialization',commercialisation:'commercialization',modernisation:'modernization'};
export function normalize(s){return String(s??'').normalize('NFKC').toLowerCase().trim().replace(/[‘’]/g,"'").replace(/[‐‑–—-]/g,' ').replace(/[.!?,;:]+$/g,'').replace(/\s+/g,' ').trim().replace(/[a-z]+/g,w=>spellings[w]||w);}
export function isCorrect(value,entry){const clean=v=>entry.unitType==='sentence'?normalize(v).replace(/[.,!?;:]/g,'').replace(/\s+/g,' ').trim():normalize(v);return !!clean(value)&&[entry.word,...(entry.acceptedAnswers||[])].some(w=>clean(w)===clean(value));}
export function emptyState(){return {version:1,records:{},notes:{},session:null,settings:{accent:'en-GB',rate:.85,volume:1,repairGoal:1,size:10,section:'all',topic:'all',shuffle:false,promptMode:'meaning'}};}
export function loadState(raw,entries){const fresh=emptyState();try{const d=JSON.parse(raw);if(d?.version!==1)return fresh;const ids=new Set(entries.map(e=>e.id));for(const [id,r] of Object.entries(d.records||{})){if(!ids.has(id)||!r||typeof r!=='object')continue;fresh.records[id]={};for(const k of ['attempts','correct','errors','streak','due','practised','completed'])fresh.records[id][k]=Number.isFinite(r[k])&&r[k]>=0?r[k]:0;fresh.records[id].resolved=r.resolved===true;fresh.records[id].lastAnswer=typeof r.lastAnswer==='string'?r.lastAnswer.slice(0,500):'';}for(const [id,n] of Object.entries(d.notes||{}))if(ids.has(id)&&typeof n==='string')fresh.notes[id]=n.slice(0,10000);const q=d.settings||{};if(['en-GB','en-US'].includes(q.accent))fresh.settings.accent=q.accent;if([.65,.85,1].includes(q.rate))fresh.settings.rate=q.rate;if([5,10,20,0].includes(q.size))fresh.settings.size=q.size;for(const k of ['section','topic'])if(typeof q[k]==='string')fresh.settings[k]=q[k].slice(0,100);fresh.settings.shuffle=q.shuffle===true;fresh.settings.promptMode='meaning';if(Number.isFinite(q.volume)&&q.volume>=0&&q.volume<=1)fresh.settings.volume=q.volume;if(Number.isInteger(q.repairGoal)&&q.repairGoal>=1&&q.repairGoal<=10)fresh.settings.repairGoal=q.repairGoal;
const s=d.session;const phases=['block-study','study','question','needs-review','mistake','repair','correct','repaired','recall','recall-ok','gap','gap-ok','write','selfcheck','complete'];if(s&&['vocab','collocation'].includes(s.kind)&&Array.isArray(s.ids)&&s.ids.length&&s.ids.every(id=>ids.has(id)&&id.startsWith(s.kind==='vocab'?'v-':'c-'))&&Number.isInteger(s.index)&&s.index>=0&&s.index<s.ids.length&&phases.includes(s.phase))fresh.session={flow:s.flow==='block'?'block':'legacy',groupId:typeof s.groupId==='string'?s.groupId.slice(0,80):'',kind:s.kind,ids:s.ids,index:s.index,phase:s.phase,reviewPhase:['question','recall','gap','repair'].includes(s.reviewPhase)?s.reviewPhase:'question',acceptedAlternative:s.acceptedAlternative===true,aiSummary:typeof s.aiSummary==='string'?s.aiSummary.slice(0,600):'',repeats:Number.isInteger(s.repeats)&&s.repeats>=0&&s.repeats<=10?s.repeats:0,repairGoal:Number.isInteger(s.repairGoal)&&s.repairGoal>=1&&s.repairGoal<=10?s.repairGoal:1,repairTarget:['correct','recall-ok','gap-ok'].includes(s.repairTarget)?s.repairTarget:'correct',hadError:s.hadError===true,draft:typeof s.draft==='string'?s.draft.slice(0,10000):'',lastAnswer:typeof s.lastAnswer==='string'?s.lastAnswer.slice(0,500):'',checks:Array.isArray(s.checks)?s.checks.filter(i=>[0,1,2].includes(i)):[]};return fresh;}catch{return fresh;}}
export function start(state,kind,ids,options={}){if(!ids.length)return false;state.session={kind,flow:options.flow==='block'?'block':'legacy',groupId:options.groupId||'',ids:[...ids],index:0,phase:options.flow==='block'?'block-study':kind==='vocab'?'question':'study',repeats:0,repairGoal:1,repairTarget:'correct',hadError:false,draft:'',lastAnswer:'',checks:[]};return true;}
function record(state,id){return state.records[id]??=( {attempts:0,correct:0,errors:0,streak:0,due:0,practised:0,completed:0,resolved:true,lastAnswer:''});}
function schedule(r,ok,now){r.streak=ok?r.streak+1:0;r.due=now+[1,3,7,14][Math.min(Math.max(r.streak-1,0),3)]*day;}
export function submit(state,entry,value,now=Date.now()){const s=state.session;if(!s||!['question','recall','gap','repair'].includes(s.phase)||!normalize(value))return 'ignored';const r=record(state,entry.id),ok=isCorrect(value,entry);s.lastAnswer=String(value).slice(0,500);if(s.phase==='repair'){if(ok){s.repeats=(s.repeats||0)+1;if(s.repeats<(s.repairGoal||1))return 'repair-progress';s.phase=s.repairTarget==='correct'?'repaired':s.repairTarget;r.resolved=true;r.practised++;return 'repaired';}r.lastAnswer=s.lastAnswer;s.phase='mistake';return 'mistake';}
r.attempts++;const old=s.phase;s.repairTarget={question:'correct',recall:'recall-ok',gap:'gap-ok'}[old];if(ok){r.correct++;r.resolved=true;s.phase=s.repairTarget;if(s.kind==='vocab'||s.flow==='block'){r.practised++;schedule(r,true,now);}return 'correct';}
s.repeats=0;s.repairGoal=state.settings.repairGoal;r.errors++;r.resolved=false;r.lastAnswer=s.lastAnswer;s.hadError=true;s.phase='mistake';schedule(r,false,now);return 'mistake';}
export function next(state){const s=state.session;if(!s)return false;if(s.phase==='block-study'){s.phase='question';return true;}if(s.phase==='study'){s.phase='recall';return true;}if(s.phase==='mistake'){s.phase='repair';return true;}if(s.phase==='recall-ok'){s.phase='gap';return true;}if(s.phase==='gap-ok'){s.phase='write';return true;}if(!['correct','repaired'].includes(s.phase))return false;return advanceItem(state);}
export function advanceItem(state){const s=state.session;if(s.index+1>=s.ids.length){s.phase='complete';return true;}s.index++;s.acceptedAlternative=false;s.aiSummary='';s.repeats=0;s.repairGoal=1;s.phase=s.kind==='vocab'||s.flow==='block'?'question':'study';s.hadError=false;s.draft='';s.lastAnswer='';s.checks=[];return true;}
export function completeLesson(state,entry,now=Date.now()){const s=state.session;if(!s||s.kind!=='collocation'||s.phase!=='selfcheck'||!s.draft.trim()||new Set(s.checks).size!==3)return false;const r=record(state,entry.id);r.completed++;r.practised++;r.resolved=true;schedule(r,!s.hadError,now);state.notes[entry.id]=s.draft;advanceItem(state);return true;}
export function dueEntries(state,entries,now=Date.now()){return entries.filter(e=>state.records[e.id]?.due>0&&state.records[e.id].due<=now);}
export function containsExpression(sentence,expression){return (' '+normalize(sentence)+' ').includes(' '+normalize(expression)+' ');}
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Free expression is ungraded until reviewed; exact recall remains a separate primitive.
export function submitExpression(state,entry,value,now=Date.now()){
 const s=state.session;
 if(!s||s.ids[s.index]!==entry.id||!['question','recall','gap','repair'].includes(s.phase)||!normalize(value))return 'ignored';
 s.acceptedAlternative=false;s.aiSummary='';
 if(isCorrect(value,entry))return submit(state,entry,value,now);
 s.reviewPhase=s.phase;s.lastAnswer=String(value).slice(0,500);s.phase='needs-review';return 'needs-review';
}
export function resolveExpression(state,entry,decision,now=Date.now()){
 const s=state.session;
 if(!s||s.phase!=='needs-review'||s.ids[s.index]!==entry.id||!['valid','error','skip'].includes(decision))return 'ignored';
 if(decision==='skip'){advanceItem(state);return 'skipped';}
 const answer=s.lastAnswer;s.phase=s.reviewPhase;
 const result=submit(state,entry,decision==='valid'?entry.word:answer,now);
 s.lastAnswer=answer;s.acceptedAlternative=decision==='valid';
 return result;
}

export function acceptTeacherReview(state,entry,answer,review,now=Date.now()){
 const s=state.session;
 if(!s||s.phase!=='needs-review'||s.ids[s.index]!==entry.id||s.lastAnswer!==answer||review?.verdict!=='valid'||!Array.isArray(review.issues)||review.issues.length||!['grammar','fluency','meaning','corePhrases'].every(k=>review.checks?.[k]===true))return 'ignored';
 const result=resolveExpression(state,entry,'valid',now);
 s.aiSummary=String(review.summary||'四项核对通过。').slice(0,600);return result;
}
