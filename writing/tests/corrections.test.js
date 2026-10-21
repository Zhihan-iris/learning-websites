import test from 'node:test';import assert from 'node:assert/strict';
import {compareExpression,teacherPrompt} from '../corrections.js';
import {emptyState,start,next,submitExpression,resolveExpression,loadState} from '../core.js';
const entry={id:'c-test',word:'Students have opportunities to interact with peers.',meaning:'学生有机会与同龄人交流。',unitType:'sentence'};
function ready(){const s=emptyState();start(s,'collocation',[entry.id],{flow:'block'});next(s);return s;}
test('keeps whole expressions and punctuation without inventing word-level corrections',()=>{
 for(const answer of ['Students can communicate with their peers.','Students has opportunities interact with peers today','<img src=x>']){
  const r=compareExpression(answer,entry);assert.equal(r.answer,answer);assert.equal(r.reference,entry.word);assert.equal(r.matched,false);assert.ok(!('changes' in r));assert.ok(!('ops' in r));
 }
 assert.equal(compareExpression('STUDENTS socialize, with peers!',{word:'Students socialise with peers.',unitType:'sentence'}).matched,true);
 const r=compareExpression('get access to education',{word:'have access to education',acceptedAnswers:['get access to education']});assert.equal(r.reference,'get access to education');assert.equal(r.matched,true);
});
test('alternative wording stays ungraded across reload and self-acceptance does not record an error',()=>{
 let s=ready();const answer='Students can communicate with their peers.';
 assert.equal(submitExpression(s,entry,answer,100),'needs-review');assert.equal(s.records[entry.id],undefined);assert.equal(next(s),false);
 s=loadState(JSON.stringify(s),[entry]);assert.equal(s.session.phase,'needs-review');assert.equal(s.session.reviewPhase,'question');
 assert.equal(resolveExpression(s,entry,'valid',100),'correct');assert.equal(s.records[entry.id].errors,0);assert.equal(s.records[entry.id].correct,1);assert.equal(s.session.lastAnswer,answer);assert.equal(s.session.acceptedAlternative,true);
 assert.equal(resolveExpression(s,entry,'error',100),'ignored');assert.equal(s.records[entry.id].errors,0);
});
test('only confirmed errors enter repair and reviewed alternatives count towards the configured goal',()=>{
 let s=ready();s.settings.repairGoal=2;
 submitExpression(s,entry,'Students has opportunities.',100);assert.equal(resolveExpression(s,entry,'error',100),'mistake');assert.equal(s.records[entry.id].errors,1);next(s);
 assert.equal(submitExpression(s,entry,'Students can interact with their peers.',100),'needs-review');
 s=loadState(JSON.stringify(s),[entry]);assert.equal(s.session.reviewPhase,'repair');assert.equal(resolveExpression(s,entry,'valid',100),'repair-progress');assert.equal(s.session.repeats,1);
 assert.equal(submitExpression(s,entry,entry.word,100),'repaired');assert.equal(s.session.repeats,2);assert.equal(s.records[entry.id].errors,1);assert.equal(s.records[entry.id].resolved,true);
});
test('uncertain answers can be skipped without becoming errors or mastered entries',()=>{
 const s=ready();submitExpression(s,entry,'A different thought.');assert.equal(resolveExpression(s,entry,'uncertain'),'ignored');assert.equal(s.session.phase,'needs-review');resolveExpression(s,entry,'skip');assert.equal(s.records[entry.id],undefined);assert.equal(s.session.phase,'complete');
});
test('teacher requests contextual grammar and phrase corrections, not reference alignment',()=>{
 const p=teacherPrompt({answer:'provide students for support',entry:{word:'provide students with support',meaning:'为学生提供支持'},context:'Education'});
 for(const text of ['provide students for support','正确的替代表达','Education','JSON','禁止逐词对齐','不计作错误','最小订正'])assert.ok(p.includes(text));
});
