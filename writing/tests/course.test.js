import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptyState,loadState,start,submit,next} from '../core.js';
import {emptyCourse,loadCourse,essayDraft,checkEssay,retryEssay,gapMatches,paragraphParts,nextGroupIds,groupProgress} from '../course.js';
const read=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n,import.meta.url)));
const course=read('course.json'),original=read('content.json'),source=read('source-collocations.json');
const entries=[...original.vocabulary,...course.expressions],e=course.essays[0];
test('all source expressions, vocabulary sections and collocation topics belong to complete groups',()=>{
 assert.equal(course.expressions.length,source.phrases.length);
 assert.deepEqual([...new Set(course.expressions.flatMap(x=>x.sources.map(s=>s.row)))].sort((a,b)=>a-b),source.phrases.map((_,i)=>i));
 const ids=new Set(entries.map(x=>x.id));assert.equal(ids.size,entries.length);
 const grouped=course.groups.flatMap(g=>g.entryIds);assert.equal(new Set(grouped).size,entries.length);assert.equal(grouped.length,entries.length);
 assert.equal(course.groups.filter(g=>g.kind==='vocab').length,28);
 assert.equal(new Set(course.groups.filter(g=>g.kind==='collocation').map(g=>g.topic)).size,20);
 for(const g of course.groups){assert.ok(g.entryIds.length);assert.ok(g.entryIds.every(id=>ids.has(id)));const essay=course.essays.find(e=>e.id===g.essayId);assert.ok(essay);assert.ok(g.kind==='vocab'?essay.sections.includes(g.section):essay.topics.includes(g.topic));}
 for(const x of entries){assert.ok(x.word&&x.meaning);assert.ok(x.word.length<500);}
});
test('each complete essay exceeds 250 words and every gap reconstructs the original paragraph exactly',()=>{
 assert.equal(course.essays.length,27);
 for(const essay of course.essays){assert.ok(essay.wordCount>=250);assert.equal(essay.paragraphs.length,4);assert.equal(essay.plan.length,4);assert.ok(essay.gaps.length>=5);assert.ok(essay.gaps.some(g=>g.answer.length>60&&g.answer.endsWith('.')));assert.equal(new Set(essay.gaps.map(g=>g.id)).size,essay.gaps.length);
  essay.paragraphs.forEach((p,i)=>assert.equal(paragraphParts(essay,i).map(p=>p.gap?.answer??p.text).join(''),p.text));
  for(const g of essay.gaps){assert.ok(g.hint&&g.explanation);assert.ok(gapMatches(g.answer,g));}
 }
});
test('block collocations follow dictation with configurable repair; reload retains group and repetitions',()=>{
 const w=course.expressions[0];let state=emptyState();state.settings.repairGoal=3;start(state,'collocation',[w.id],{flow:'block',groupId:'cg-test'});assert.equal(state.session.phase,'block-study');next(state);submit(state,w,'wrong');next(state);
 for(let i=0;i<3;i++){assert.equal(submit(state,w,w.word),i===2?'repaired':'repair-progress');state=loadState(JSON.stringify(state),entries);assert.equal(state.session.groupId,'cg-test');assert.equal(state.session.repeats,i+1);}
 assert.equal(state.records[w.id].practised,1);next(state);assert.equal(state.session.phase,'complete');
});
test('later batches choose unseen entries; completed group can be reviewed',()=>{
 const state=emptyState(),group=course.groups[0];const batch=nextGroupIds(group,state,5);for(const id of batch)state.records[id]={practised:1};assert.equal(groupProgress(group,state),5);assert.ok(nextGroupIds(group,state,5).every(id=>!batch.includes(id)));for(const id of group.entryIds)state.records[id]={practised:1};assert.deepEqual(nextGroupIds(group,state,0),group.entryIds);
});
test('incomplete essays stay hidden; submission and wrong-only retry retain answer history across reload',()=>{
 let state=emptyCourse(),d=essayDraft(state,e);d.answers[e.gaps[0].id]='wrong';assert.ok(checkEssay(state,e).missing);assert.equal(d.submitted,false);assert.equal(d.attempts,0);assert.equal(d.completed,false);
 for(const g of e.gaps.slice(1))d.answers[g.id]=g.answer;
 assert.equal(checkEssay(state,e).correct,e.gaps.length-1);checkEssay(state,e);assert.equal(d.attempts,1);assert.equal(d.everWrong[e.gaps[0].id],true);
 state=loadCourse(JSON.stringify(state),course.essays);retryEssay(state,e,true);d=essayDraft(state,e);assert.equal(d.answers[e.gaps[0].id],'');assert.equal(d.answers[e.gaps[1].id],e.gaps[1].answer);assert.equal(d.submitted,false);
 d.answers[e.gaps[0].id]=e.gaps[0].answer;assert.equal(checkEssay(state,e).correct,e.gaps.length);assert.equal(d.completed,true);assert.equal(d.everWrong[e.gaps[0].id],true);
});
test('draft validation removes unknown records and unfilled submitted state; exact expression matching handles punctuation',()=>{
 const state=emptyCourse();state.essays[e.id]={answers:{[e.gaps[0].id]:'<script>test</script>'},submitted:true,attempts:-1};state.essays.unknown={};const restored=loadCourse(JSON.stringify(state),course.essays);assert.equal(restored.essays.unknown,undefined);assert.equal(restored.essays[e.id].submitted,false);assert.equal(restored.essays[e.id].attempts,0);assert.ok(gapMatches('ANALYZE, DATA.',{answer:'analyse data'}));assert.equal(gapMatches('analyse',{answer:'analyse data'}),false);
});
