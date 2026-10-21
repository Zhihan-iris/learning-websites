import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {emptyState,loadState,start,submit,next} from '../core.js';
const read=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n,import.meta.url)));
const base=read('content.json'),course=read('course.json'),usage=read('usage.json').entries;
const entries=[...new Map([...base.vocabulary,...course.legacyExpressions,...base.lessons,...course.expressions].map(e=>[e.id,e])).values()];
const word=w=>entries.find(e=>e.word===w);
test('every live vocabulary, whole sentence and component has a nonempty usage guide',()=>{
 for(const e of entries){const u=usage[e.id];assert.ok(u,e.id);assert.ok(u.pattern&&u.notes.length&&u.collocations.length,e.word);for(const part of e.components||[])assert.ok(usage[part.id],part.id);}
});
test('usage distinguishes count nouns, adjectives, verbs and common complement patterns',()=>{
 assert.equal(usage[word('bilingual').id].kind,'adjective');assert.equal(usage[word('school bullying').id].kind,'noun');assert.equal(usage[word('direct public attention').id].kind,'verb');
 assert.equal(usage[word('travel agency').id].kind,'noun');assert.equal(usage[word('access to global markets').id].kind,'noun');assert.equal(usage[word('work ethic').id].kind,'noun');
 assert.ok(usage[word('commitment').id].notes.some(x=>x.includes('介词')));assert.ok(usage[word('lead to social disconnection').id].collocations.some(x=>x.includes('动名词')));
 assert.ok(usage[word('educational institution').id].collocations.includes('establish an educational institution'));
 assert.equal(usage[word('school bullying').id].meaning,'校园欺凌');
});
test('existing listening preference becomes translation without resetting current repair or settings',()=>{
 const state=emptyState(),e=base.vocabulary[0];state.settings.promptMode='listen';state.settings.volume=.42;state.settings.vocabRepairGoal=3;
 start(state,'vocab',[e.id],{flow:'block'});next(state);submit(state,e,'wrong');next(state);submit(state,e,e.word);
 const reloaded=loadState(JSON.stringify(state),entries);assert.equal(reloaded.settings.promptMode,'meaning');assert.equal(reloaded.settings.volume,.42);assert.equal(reloaded.session.phase,'repair');assert.equal(reloaded.session.repeats,1);assert.equal(reloaded.session.repairGoal,3);assert.deepEqual(reloaded.records,state.records);
 assert.equal(emptyState().settings.promptMode,'meaning');
});
test('linked examples contain their learning expression and come from actual course material',()=>{
 const canonical=x=>x.toLowerCase().replace(/[’]/g,"'").replace(/-/g,' ').replace(/[.,!?;:]/g,' ').replace(/\s+/g,' ').trim();
 for(const e of entries){const u=usage[e.id];if(u.example)assert.ok((' '+canonical(u.example.text)+' ').includes(' '+canonical(e.word)+' '),e.word);}
});
