import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptyState,loadState,start,submit,next,isCorrect} from '../core.js';
import {upgradeSentenceSession} from '../course.js';
const read=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n,import.meta.url)));
const course=read('course.json'),bank=read('sentence-bank.json'),old=read('content.json');
const entries=[...old.vocabulary,...course.legacyExpressions,...old.lessons,...course.expressions];
const sentence=course.expressions.find(e=>e.id==='c-sentence-01-023');
test('all multi-expression source ideas have whole-sentence units and components never remain as separate active questions',()=>{
 assert.equal(bank.audit.combinedIdeas.length,320);assert.equal(bank.meta.sentences,327);
 const active=new Set(course.expressions.map(e=>e.id));
 for(const [from,to] of Object.entries(course.replacements)){assert.ok(!active.has(from));assert.ok(active.has(to));}
 for(const s of course.expressions.filter(e=>e.unitType==='sentence')){assert.ok(s.word.endsWith('.'));assert.ok(s.meaning);assert.ok(s.word.length<500);}
 assert.ok(sentence.word.includes('interact with peers and form friendships'));
 assert.equal(sentence.components.length,2);assert.ok(sentence.sourceContext.includes('form friendship'));
});
test('sentence grading checks the entire sentence while tolerating punctuation and line breaks',()=>{
 assert.ok(isCorrect(sentence.word.toUpperCase().replaceAll(' ','\n').replaceAll('.',''),sentence));
 assert.equal(isCorrect('interact with peers',sentence),false);
 assert.equal(isCorrect(sentence.word.replace('and form friendships',''),sentence),false);
 assert.equal(isCorrect(sentence.word.replace('activities give','activities gives'),sentence),false);
 const state=emptyState();state.settings.repairGoal=2;start(state,'collocation',[sentence.id],{flow:'block'});next(state);submit(state,sentence,'interact with peers');next(state);
 assert.equal(submit(state,sentence,sentence.word),'repair-progress');assert.equal(submit(state,sentence,sentence.word),'repaired');next(state);assert.equal(state.session.phase,'complete');
});
test('ongoing old fragment practice upgrades to one whole sentence without reusing completion or losing old scores',()=>{
 let state=emptyState();state.settings.volume=.34;state.settings.repairGoal=3;
 start(state,'collocation',sentence.componentIds,{flow:'block',groupId:sentence.groupId});next(state);submit(state,course.legacyExpressions.find(e=>e.id===sentence.componentIds[0]),'wrong');
 const saved=JSON.parse(JSON.stringify(state.records));state=loadState(JSON.stringify(state),entries);
 assert.ok(upgradeSentenceSession(state,course.replacements));assert.deepEqual(state.session.ids,[sentence.id]);assert.equal(state.session.phase,'block-study');assert.equal(state.settings.volume,.34);assert.equal(state.settings.repairGoal,3);
 assert.deepEqual(state.records,saved);assert.equal(state.records[sentence.id],undefined);assert.equal(upgradeSentenceSession(state,course.replacements),false);
});
test('old sentence drafts survive migration and only remaining questions are upgraded',()=>{
 const state=emptyState(),first=sentence.componentIds[0];start(state,'collocation',['c-old',first,sentence.componentIds[1]],{flow:'block'});state.session.index=1;state.session.phase='selfcheck';state.session.draft='My original draft.';
 assert.ok(upgradeSentenceSession(state,course.replacements));assert.equal(state.notes[first],'My original draft.');assert.deepEqual(state.session.ids,[sentence.id]);
});
