import test from 'node:test';import assert from 'node:assert/strict';
import {compareExpression,teacherPrompt} from '../corrections.js';
test('aligns missing, extra and substituted words without labelling all variants wrong',()=>{
 const r=compareExpression('Students has opportunities interact with peers today',{word:'Students have opportunities to interact with peers.',unitType:'sentence'});
 assert.ok(r.changes.some(x=>x.before==='has'&&x.after==='have'));assert.ok(r.changes.some(x=>x.type==='insert'&&x.after==='to'));assert.ok(r.changes.some(x=>x.type==='delete'&&x.before==='today'));
 assert.equal(r.ops.filter(x=>x.type!=='insert').map(x=>x.before).join(' '),'Students has opportunities interact with peers today');
 assert.equal(r.ops.filter(x=>x.type!=='delete').map(x=>x.after).join(' '),'Students have opportunities to interact with peers');
});
test('respects accepted variants, punctuation and British/American spelling',()=>{
 assert.equal(compareExpression('STUDENTS socialize, with peers!',{word:'Students socialise with peers.',unitType:'sentence'}).matched,true);
 const r=compareExpression('get access to education',{word:'have access to education',acceptedAnswers:['get access to education']});assert.equal(r.reference,'get access to education');assert.deepEqual(r.changes,[]);
});
test('classifies small repairs and marks format-only mismatches without inventing grammar claims',()=>{
 assert.equal(compareExpression('committment',{word:'commitment'}).changes[0].label,'可能的拼写差异');
 assert.equal(compareExpression('student',{word:'students'}).changes[0].label,'词形需核对');
 assert.equal(compareExpression('rely in peers',{word:'rely on peers'}).changes[0].label,'介词或搭配差异');
 assert.equal(compareExpression('quality, time',{word:'quality time'}).formatOnly,true);
 assert.equal(compareExpression('improve education',{word:'enhance education'}).changes[0].label,'用词或顺序差异');
});
test('teacher handoff includes actual answer and context while asking for independent judgement',()=>{
 const p=teacherPrompt({answer:'provide students for support',entry:{word:'provide students with support',meaning:'为学生提供支持'},context:'Education'});assert.match(p,/provide students for support/);assert.match(p,/正确的替代表达/);assert.match(p,/Education/);assert.match(p,/JSON/);
});
