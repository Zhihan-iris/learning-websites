import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProgress,loadProgress,startSession,submitAnswer,advance} from '../core.js';
import {roundCandidates,createRound,nextRoundIds} from '../rounds.js';
const words = [
  {id:'a',word:'apple',book:'scenes',scene:'food'},
  {id:'b',word:'bread',book:'scenes',scene:'food'},
  {id:'c',word:'class',book:'scenes',scene:'school'},
  {id:'d',word:'doctor',book:'scenes',scene:'health'},
  {id:'z',word:'zero',book:'numbers',scene:'digits'},
];
const options = {book:'scenes',scenes:[],mode:'all',shuffle:false};
function begin(p,size=2) {const r=p.rounds.scenes;startSession(p,nextRoundIds(r,size));Object.assign(p.session,{roundBook:'scenes',roundNumber:r.number});}
function answer(p) {const w=words.find(w=>w.id===p.session.ids[p.session.index]);submitAnswer(p,w,w.word);advance(p);}
test('fully mastered books restart at the first entry, and subsequent groups do not repeat the first group',()=>{
 const p=emptyProgress();p.mastered=words.map(w=>w.id);p.attempts=100;p.correct=90;
 createRound(p,words,options);begin(p);assert.deepEqual(p.session.ids,['a','b']);answer(p);answer(p);
 assert.equal(p.rounds.scenes.cursor,2);begin(p);assert.deepEqual(p.session.ids,['c','d']);answer(p);answer(p);
 assert.deepEqual(nextRoundIds(p.rounds.scenes,2),[]);assert.equal(p.rounds.scenes.cursor,4);
 const totals=[p.attempts,p.correct];createRound(p,words,options);assert.equal(p.rounds.scenes.number,2);assert.equal(p.rounds.scenes.cursor,0);assert.deepEqual([p.attempts,p.correct],totals);assert.deepEqual(p.mastered,words.map(w=>w.id));
});
test('multi-section and wrong-only filters are intersected within the selected book',()=>{
 const p=emptyProgress();p.mistakes={a:{count:2,resolved:true},c:{count:1,resolved:false},z:{count:1,resolved:false}};
 assert.deepEqual(roundCandidates(words,p,{...options,scenes:['food','school'],mode:'mistakes'}).map(w=>w.id),['a','c']);
 assert.deepEqual(roundCandidates(words,p,{...options,mode:'pending'}).map(w=>w.id),['c']);
 assert.deepEqual(roundCandidates(words,p,{...options,scenes:['health'],mode:'mistakes'}),[]);
 const history=structuredClone(p.mistakes);createRound(p,words,{...options,mode:'mistakes'});assert.deepEqual(p.rounds.scenes.ids,['a','c']);assert.deepEqual(p.mistakes,history);
});
test('empty filters cannot overwrite a current round or session',()=>{
 const p=emptyProgress();createRound(p,words,options);begin(p);const before=structuredClone(p);
 assert.equal(createRound(p,words,{...options,mode:'pending'}),null);assert.deepEqual(p,before);
});
test('reload resumes repair and round position; only advancing a finished word moves the cursor',()=>{
 let p=emptyProgress();p.settings.repairGoal=2;createRound(p,words,options);begin(p);
 submitAnswer(p,words[0],'wrong');assert.equal(p.rounds.scenes.cursor,0);advance(p);submitAnswer(p,words[0],'apple');
 p=loadProgress(JSON.stringify(p),words);assert.equal(p.session.repeats,1);assert.equal(p.session.roundBook,'scenes');assert.equal(p.rounds.scenes.cursor,0);
 submitAnswer(p,words[0],'apple');assert.equal(p.rounds.scenes.cursor,0);advance(p);assert.equal(p.rounds.scenes.cursor,1);assert.equal(advance(p),false);assert.equal(p.rounds.scenes.cursor,1);
 p=loadProgress(JSON.stringify(p),words);assert.equal(p.session.index,1);answer(p);p=loadProgress(JSON.stringify(p),words);assert.equal(p.session.phase,'complete');assert.equal(p.rounds.scenes.cursor,2);begin(p);assert.deepEqual(p.session.ids,['c','d']);
});
test('one-off mistake reviews do not consume the book round; partial groups resume without skipped words',()=>{
 const p=emptyProgress();createRound(p,words,options);begin(p);answer(p);p.session=null;begin(p);assert.deepEqual(p.session.ids,['b','c']);
 startSession(p,['a'],true);answer(p);assert.equal(p.rounds.scenes.cursor,1);begin(p);assert.deepEqual(p.session.ids,['b','c']);
});
test('shuffle is fixed once per round and survives reload; books retain independent cursors',()=>{
 let p=emptyProgress();createRound(p,words,{...options,shuffle:true},()=>0);const order=[...p.rounds.scenes.ids];begin(p);answer(p);
 createRound(p,words,{...options,book:'numbers'});p=loadProgress(JSON.stringify(p),words);assert.deepEqual(p.rounds.scenes.ids,order);assert.equal(p.rounds.scenes.cursor,1);assert.deepEqual(p.rounds.numbers.ids,['z']);
});
test('legacy records migrate without resetting history and corrupted rounds cannot attach a session',()=>{
 const p=emptyProgress();delete p.rounds;p.attempts=12;p.correct=10;p.mastered=['a'];p.mistakes={b:{count:2,lastAnswer:'bred',resolved:true}};startSession(p,['a','b']);
 let restored=loadProgress(JSON.stringify(p),words);assert.deepEqual(restored.rounds,{});assert.equal(restored.attempts,12);assert.deepEqual(restored.mistakes,p.mistakes);assert.deepEqual(restored.session.ids,['a','b']);
 createRound(p,words,options);begin(p);p.rounds.scenes.cursor=100;restored=loadProgress(JSON.stringify(p),words);assert.deepEqual(restored.rounds,{});assert.equal(restored.session,null);
});
test('history-based round snapshots retain resolved items while a new pending round reflects current status',()=>{
 const p=emptyProgress();p.mistakes={a:{count:1,lastAnswer:'aple',resolved:false},b:{count:1,lastAnswer:'bred',resolved:false}};
 createRound(p,words,{...options,mode:'pending'});begin(p,1);answer(p);assert.equal(p.mistakes.a.resolved,true);assert.deepEqual(p.rounds.scenes.ids,['a','b']);assert.deepEqual(nextRoundIds(p.rounds.scenes,1),['b']);
 createRound(p,words,{...options,mode:'pending'});assert.deepEqual(p.rounds.scenes.ids,['b']);
});
