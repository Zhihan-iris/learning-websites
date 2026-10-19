import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { emptyProgress, startSession, submitAnswer, advance, isCorrect, loadProgress } from '../core.js';
const words = [{id:'a',word:'landlord'}, {id:'b',word:'tenant'}];
function setup() { const p=emptyProgress(); startSession(p,['a','b']); return p; }
test('blank input does not count; correct answer reveals before advancing',()=>{
 const p=setup();assert.equal(submitAnswer(p,words[0],'   '),'ignored');assert.equal(p.attempts,0);
 submitAnswer(p,words[0],'  LANDLORD ');assert.equal(p.session.phase,'correct');assert.equal(p.session.index,0);assert.equal(p.correct,1);
 submitAnswer(p,words[0],'landlord');assert.equal(p.attempts,1);advance(p);assert.equal(p.session.index,1);assert.equal(p.session.phase,'question');
});
test('wrong answers require five correct repetitions and a separate next action',()=>{
 const p=setup();submitAnswer(p,words[0],'landord');assert.equal(p.session.phase,'mistake');assert.equal(p.mistakes.a.count,1);
 advance(p);assert.equal(p.session.phase,'repairing');assert.equal(advance(p),false);
 submitAnswer(p,words[0],'landord');assert.equal(p.session.phase,'repair-error');assert.equal(p.session.repeats,0);
 advance(p);
 for(let i=1;i<=5;i++){submitAnswer(p,words[0],'landlord');assert.equal(p.session.repeats,i);assert.equal(p.session.index,0);if(i<5)assert.equal(advance(p),false);}
 assert.equal(p.session.phase,'repaired');assert.equal(p.mistakes.a.resolved,true);assert.equal(p.attempts,1);assert.equal(p.correct,0);
 advance(p);assert.equal(p.session.index,1);assert.equal(p.session.phase,'question');assert.equal(p.session.repeats,0);
});
test('reload preserves repair progress and wrong-answer history',()=>{
 const p=setup();submitAnswer(p,words[0],'oops');advance(p);submitAnswer(p,words[0],'landlord');submitAnswer(p,words[0],'landlord');
 const restored=loadProgress(JSON.stringify(p),words);assert.equal(restored.session.repeats,2);assert.equal(restored.session.phase,'repairing');assert.equal(restored.mistakes.a.lastAnswer,'oops');
 for(let i=0;i<3;i++)submitAnswer(restored,words[0],'landlord');assert.equal(restored.session.phase,'repaired');
});
test('new mistakes reopen old records and remove mastery; correct review keeps history',()=>{
 const p=setup();submitAnswer(p,words[0],'landlord');assert.deepEqual(p.mastered,['a']);
 startSession(p,['a'],true);submitAnswer(p,words[0],'oops');assert.deepEqual(p.mastered,[]);assert.equal(p.mistakes.a.count,1);
 startSession(p,['a'],true);submitAnswer(p,words[0],'landlord');assert.equal(p.mistakes.a.resolved,true);assert.equal(p.mistakes.a.count,1);advance(p);assert.equal(p.session.phase,'complete');
 startSession(p,['a'],true);submitAnswer(p,words[0],'wrong');assert.equal(p.mistakes.a.count,2);assert.equal(p.mistakes.a.resolved,false);
});
test('normalize whitespace, punctuation and British/American spelling, not synonyms',()=>{
 assert.equal(isCorrect('  STUDENT   ADVISOR  ','student adviser'),true);
 assert.equal(isCorrect('driver’s license',"driver's license"),true);
 assert.equal(isCorrect('neighbor','neighbour'),true);
 assert.equal(isCorrect('tenant','landlord'),false);assert.equal(isCorrect('sofa','couch'),false);
 assert.equal(isCorrect('tenants','tenant'),false);
});
test('untrusted saved data is validated',()=>{
 const p=emptyProgress();p.session={ids:['missing'],index:0,repeats:3,phase:'repairing'};p.correct=500;p.attempts=2;p.mastered=['a','a','missing'];p.settings={scene:'invalid',size:999,rate:8};
 const restored=loadProgress(JSON.stringify(p),words);assert.equal(restored.session,null);assert.deepEqual(restored.mastered,['a']);assert.equal(restored.correct,2);assert.equal(restored.settings.size,20);
 assert.throws(()=>loadProgress('{',words));
});
test('all vocabulary entries have unique IDs, valid scenes and clean speakable prompts',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../data/vocabulary.json',import.meta.url)));
 assert.equal(data.sourceRows,903);assert.equal(data.words.length,966);assert.equal(data.scenes.length,15);
 assert.equal(new Set(data.words.map(w=>w.id)).size,data.words.length);
 for(const w of data.words){assert.ok(w.word.trim());assert.ok(w.meaning.trim());assert.ok(data.scenes.some(s=>s.id===w.scene));assert.doesNotMatch(w.word,/[\u4e00-\u9fff/()]/);assert.ok(w.sourcePages.every(p=>p>=2&&p<=20));}
 for(const word of ['food allergies','be allergic to','closed-circuit TV','video surveillance','on-campus accommodation','water bill','primary course'])assert.ok(data.words.some(w=>w.word===word),word);
});

test('numeric dictation keeps leading zeros and distinguishes letters from digits',()=>{
 assert.equal(isCorrect('017 226-5628',{word:'0172265628',kind:'phone'}),true);
 assert.equal(isCorrect('172265628',{word:'0172265628',kind:'phone'}),false);
 assert.equal(isCorrect('0172265628abc',{word:'0172265628',kind:'phone'}),false);
 assert.equal(isCorrect('ra6 7bu',{word:'RA67BU',kind:'postcode'}),true);
 assert.equal(isCorrect('O1658867',{word:'01658867',kind:'phone'}),false);
 assert.equal(isCorrect('CO29LU',{word:'C029LU',kind:'postcode'}),false);
 assert.equal(isCorrect('2 Gold St.',{word:'No.2 Gold Street',kind:'address'}),true);
});
test('time answers accept equivalent clocks but reject wrong meridian and invalid times',()=>{
 assert.equal(isCorrect('06:30',{word:'6.30 am',kind:'time'}),true);
 assert.equal(isCorrect('6:30 a.m.',{word:'6.30 am',kind:'time'}),true);
 assert.equal(isCorrect('19:30',{word:'7.30 pm',kind:'time'}),true);
 assert.equal(isCorrect('7:30',{word:'7.30 pm',kind:'time'}),false);
 assert.equal(isCorrect('00:30',{word:'12.30 am',kind:'time'}),true);
 assert.equal(isCorrect('12:30',{word:'12.30 am',kind:'time'}),false);
 assert.equal(isCorrect('09:00–18:30',{word:'9.00am-6.30pm',kind:'time'}),true);
 assert.equal(isCorrect('9am to 6:30pm',{word:'9.00am-6.30pm',kind:'time'}),true);
 assert.equal(isCorrect('25:30',{word:'1.30 am',kind:'time'}),false);
});
const extra=JSON.parse(fs.readFileSync(new URL('../data/additional-books.json',import.meta.url)));
test('all three books preserve their source coverage and answer forms',()=>{
 assert.deepEqual(extra.sourceRows,{synonyms:852,gapfill:651,numbers:186});
 assert.equal(extra.words.length,1752);
 for(const w of extra.words){assert.ok(w.word&&w.meaning);assert.ok(w.sourcePages.length);assert.ok(extra.scenes.some(s=>s.id===w.scene&&s.book===w.book));assert.equal(isCorrect(w.word,w),true,w.word);}
 assert.equal(extra.words.filter(w=>w.book==='synonyms').length,917);
 assert.equal(extra.words.filter(w=>w.book==='gapfill').length,649);
 assert.equal(extra.words.filter(w=>w.book==='numbers').length,186);
 const date=extra.words.find(w=>w.kind==='date');
 for(const a of ['1 January','January 1','January 1st','01/01','1st January'])assert.equal(isCorrect(a,date),true,a);
 assert.equal(isCorrect('2 January',date),false);
 const tyre=extra.words.find(w=>w.word==='tyre');assert.equal(isCorrect('tire',tyre),true);
 const synonym=extra.words.find(w=>w.word==='refurbish');assert.equal(synonym.counterpart,'improve');assert.equal(isCorrect('improve',synonym),false);
 assert.ok(extra.words.filter(w=>w.kind==='phone').every(w=>w.speechText.includes(', ')));
 assert.equal(new Set(extra.words.map(w=>w.id)).size,extra.words.length);
});
test('existing v1 progress survives adding books; per-book choices persist',()=>{
 const base=JSON.parse(fs.readFileSync(new URL('../data/vocabulary.json',import.meta.url)));
 const all=[...base.words.map(w=>({...w,book:'scenes'})),...extra.words];
 const old=emptyProgress();delete old.settings.book;old.mastered=[base.words[0].id];startSession(old,[base.words[0].id]);submitAnswer(old,base.words[0],'typo');advance(old);submitAnswer(old,base.words[0],base.words[0].word);
 const restored=loadProgress(JSON.stringify(old),all);assert.equal(restored.settings.book,'scenes');assert.equal(restored.session.repeats,1);assert.equal(Object.keys(restored.mistakes).length,1);
 restored.settings.book='numbers';restored.settings.scene='num-phone1';const again=loadProgress(JSON.stringify(restored),all);assert.equal(again.settings.book,'numbers');assert.equal(again.settings.scene,'num-phone1');
 const repair=extra.words.find(w=>w.kind==='phone');startSession(restored,[repair.id]);submitAnswer(restored,repair,'wrong');advance(restored);for(let i=0;i<5;i++)submitAnswer(restored,repair,repair.word);assert.equal(restored.session.phase,'repaired');
});

const {buildSynonymGroups,migrateSynonymProgress}=await import('../synonyms.js');
const {checkSynonymAnswers}=await import('../core.js');
const groups=buildSynonymGroups(extra.words);
const multi=groups.find(g=>g.cue==='entertainment'&&g.scene==='syn-20');
test('synonym grouping preserves all source rows and context; exact duplicates merge',()=>{
 assert.equal(groups.flatMap(g=>g.memberIds).length,917);
 assert.equal(new Set(groups.map(g=>g.id)).size,groups.length);
 assert.deepEqual(multi.answers.map(a=>a.word),['a show','songs and short plays']);
 for(const g of groups){assert.ok(g.cue);assert.ok(g.answers.length);assert.ok(g.answers.every(a=>a.contexts.length));}
});
test('group recall is order independent and requires every distinct expression',()=>{
 assert.equal(isCorrect(['songs and short plays','A SHOW'],multi),true);
 assert.equal(isCorrect(['a show','a show'],multi),false);
 assert.equal(isCorrect(['a show',''],multi),false);
 assert.equal(isCorrect(['entertainment','songs and short plays'],multi),false);
 assert.equal(checkSynonymAnswers(['a show','typo'],multi).missing[0].word,'songs and short plays');
});
test('synonym groups have a persisted study step and five complete-group repairs',()=>{
 const p=emptyProgress();startSession(p,[multi.id,groups[0].id],false,multi);
 assert.equal(p.session.phase,'study');assert.equal(submitAnswer(p,multi,['a show','songs and short plays']),'ignored');
 advance(p);submitAnswer(p,multi,['a show','typo']);assert.equal(p.session.phase,'mistake');advance(p);
 const answer=multi.answers.map(a=>a.word);
 for(let i=0;i<2;i++)submitAnswer(p,multi,answer);
 const restored=loadProgress(JSON.stringify(p),groups);assert.equal(restored.session.repeats,2);
 submitAnswer(restored,multi,['a show','a show']);assert.equal(restored.session.repeats,2);assert.equal(restored.session.phase,'repair-error');advance(restored);
 for(let i=0;i<3;i++)submitAnswer(restored,multi,answer);
 assert.equal(restored.session.phase,'repaired');assert.equal(restored.mistakes[multi.id].resolved,true);
 advance(restored,groups[0]);assert.equal(restored.session.phase,'study');assert.equal(restored.session.index,1);
 assert.equal(loadProgress(JSON.stringify(restored),groups).session.phase,'study');
});
test('legacy synonym records migrate without losing totals or unresolved mistakes',()=>{
 const p=emptyProgress();p.attempts=8;p.correct=5;p.mastered=[...multi.memberIds];
 multi.memberIds.forEach((id,i)=>p.mistakes[id]={count:i+1,lastAnswer:'old typo',resolved:i===0});
 startSession(p,[multi.memberIds[0]],true);p.session.phase='repairing';p.session.repeats=3;
 assert.equal(migrateSynonymProgress(p,groups),true);
 assert.equal(p.attempts,8);assert.equal(p.correct,5);assert.ok(p.mastered.includes(multi.id));
 assert.equal(p.mistakes[multi.id].count,3);assert.equal(p.mistakes[multi.id].resolved,false);
 assert.equal(p.session.phase,'study');assert.equal(p.session.ids[0],multi.id);
 const snapshot=JSON.stringify(p);assert.equal(migrateSynonymProgress(p,groups),false);assert.equal(JSON.stringify(p),snapshot);
});

test('custom repair goals preserve partial work and apply changed preferences to the next mistake',()=>{
 for(const goal of [1,3,10]){
  let p=setup();p.settings.repairGoal=goal;p.settings.volume=.37;
  submitAnswer(p,words[0],'wrong');advance(p);p.settings.repairGoal=2;
  for(let i=1;i<=goal;i++){
   submitAnswer(p,words[0],'wrong again');assert.equal(p.session.repeats,i-1);advance(p);
   submitAnswer(p,words[0],words[0].word);
   p=loadProgress(JSON.stringify(p),words);
   assert.equal(p.session.repeats,i);assert.equal(p.session.repairGoal,goal);
   assert.equal(p.session.phase,i===goal?'repaired':'repairing');assert.equal(p.mistakes.a.resolved,i===goal);
   assert.equal(p.settings.volume,.37);
  }
  advance(p);submitAnswer(p,words[1],'wrong');assert.equal(p.session.repairGoal,2);assert.equal(p.session.repeats,0);
 }
});
test('old listening sessions retain five repetitions; invalid preferences fall back safely',()=>{
 const p=setup();submitAnswer(p,words[0],'wrong');advance(p);submitAnswer(p,words[0],words[0].word);
 delete p.settings.volume;delete p.settings.repairGoal;delete p.session.repairGoal;
 let restored=loadProgress(JSON.stringify(p),words);assert.equal(restored.settings.volume,1);assert.equal(restored.settings.repairGoal,5);assert.equal(restored.session.repairGoal,5);assert.equal(restored.session.repeats,1);
 for(const bad of [-1,11,1.5,'3',null]){p.settings.repairGoal=bad;p.settings.volume=2;restored=loadProgress(JSON.stringify(p),words);assert.equal(restored.settings.repairGoal,5);assert.equal(restored.settings.volume,1);}
 p.settings.volume=0;assert.equal(loadProgress(JSON.stringify(p),words).settings.volume,0);
});
test('custom synonym goal counts complete groups, not individual matching expressions',()=>{
 const p=emptyProgress();p.settings.repairGoal=2;startSession(p,[multi.id],false,multi);advance(p);
 submitAnswer(p,multi,['incorrect']);advance(p);
 submitAnswer(p,multi,[multi.answers[0].word]);assert.equal(p.session.repeats,0);advance(p);
 const answers=multi.answers.map(a=>a.word);submitAnswer(p,multi,answers);assert.equal(p.session.repeats,1);assert.equal(p.session.phase,'repairing');
 const restored=loadProgress(JSON.stringify(p),groups);submitAnswer(restored,multi,answers);assert.equal(restored.session.phase,'repaired');assert.equal(restored.session.repeats,2);
});
