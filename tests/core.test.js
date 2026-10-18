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
