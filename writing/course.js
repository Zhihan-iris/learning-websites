import {normalize} from './core.js';
export const COURSE_KEY='zhihan-writing-course-v1';
export const emptyCourse=()=>({version:1,essays:{},returnGroup:''});
const canonical=s=>normalize(s).replace(/[.,!?;:]/g,'').replace(/\s+/g,' ').trim();
export function gapMatches(value,gap){return !!canonical(value)&&[gap.answer,...(gap.acceptedAnswers||[])].some(a=>canonical(value)===canonical(a));}
export function loadCourse(raw,essays){const state=emptyCourse();try{const obj=JSON.parse(raw);if(obj?.version!==1)return state;state.returnGroup=typeof obj.returnGroup==='string'?obj.returnGroup.slice(0,80):'';for(const e of essays){const r=obj.essays?.[e.id];if(!r||typeof r!=='object')continue;const draft={answers:{},submitted:r.submitted===true,everWrong:{},attempts:Number.isInteger(r.attempts)&&r.attempts>=0?r.attempts:0,completed:r.completed===true};for(const g of e.gaps){draft.answers[g.id]=typeof r.answers?.[g.id]==='string'?r.answers[g.id].slice(0,2000):'';draft.everWrong[g.id]=r.everWrong?.[g.id]===true;}if(e.gaps.some(g=>!draft.answers[g.id].trim()))draft.submitted=false;state.essays[e.id]=draft;}return state;}catch{return state;}}
export function essayDraft(state,essay){return state.essays[essay.id]??={answers:{},submitted:false,everWrong:{},attempts:0,completed:false};}
export function checkEssay(state,essay){const d=essayDraft(state,essay);const missing=essay.gaps.filter(g=>!d.answers[g.id]?.trim());if(missing.length)return {missing:missing.map(g=>g.id)};if(!d.submitted){d.attempts++;for(const g of essay.gaps)if(!gapMatches(d.answers[g.id],g))d.everWrong[g.id]=true;d.submitted=true;}const correct=essay.gaps.filter(g=>gapMatches(d.answers[g.id],g)).length;if(correct===essay.gaps.length)d.completed=true;return {correct,total:essay.gaps.length};}
export function retryEssay(state,essay,wrongOnly=true){const d=essayDraft(state,essay);for(const g of essay.gaps)if(!wrongOnly||!gapMatches(d.answers[g.id],g))d.answers[g.id]='';d.submitted=false;}
export function paragraphParts(essay,index){const text=essay.paragraphs[index].text;const gaps=essay.gaps.filter(g=>g.paragraph===index).map(g=>({...g,start:text.indexOf(g.answer)})).sort((a,b)=>a.start-b.start);let cursor=0,parts=[];for(const g of gaps){if(g.start<cursor)throw Error('Overlapping essay gaps');parts.push({text:text.slice(cursor,g.start)},{gap:g});cursor=g.start+g.answer.length;}parts.push({text:text.slice(cursor)});return parts;}
export function nextGroupIds(group,state,size=0){const unseen=group.entryIds.filter(id=>!state.records[id]?.practised);const pool=unseen.length?unseen:group.entryIds;return pool.slice(0,size||pool.length);}
export function groupProgress(group,state){return group.entryIds.filter(id=>state.records[id]?.practised>0).length;}

// Retain past phrase scores; a newly composed sentence starts its own practice record.
export function upgradeSentenceSession(state,replacements){
 const s=state.session;
 if(!s||s.kind!=='collocation'||s.phase==='complete')return false;
 const remaining=s.ids.slice(s.index);
 if(!remaining.some(id=>replacements[id]))return false;
 if(s.draft?.trim())state.notes[s.ids[s.index]]=s.draft;
 s.ids=[...new Set(remaining.map(id=>replacements[id]||id))];
 Object.assign(s,{flow:'block',phase:'block-study',index:0,repeats:0,repairGoal:1,repairTarget:'correct',hadError:false,draft:'',lastAnswer:'',checks:[]});
 return true;
}
