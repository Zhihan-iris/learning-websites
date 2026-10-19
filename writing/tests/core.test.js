import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STORAGE_KEY,emptyState,loadState,start,submit,next,completeLesson,dueEntries,isCorrect,escapeHTML} from '../core.js';
const data=JSON.parse(fs.readFileSync(new URL('../data/content.json',import.meta.url)));const entries=[...data.vocabulary,...data.lessons],word=data.vocabulary[0],lesson=data.lessons[0],DAY=86400000;
test('writing storage is isolated and a mistake requires exactly one successful repair',()=>{assert.notEqual(STORAGE_KEY,'scene-listening-v1');const s=emptyState();start(s,'vocab',[word.id]);assert.equal(submit(s,word,' '),'ignored');assert.equal(submit(s,word,'wrong',100),'mistake');assert.equal(s.records[word.id].errors,1);next(s);assert.equal(s.session.phase,'repair');assert.equal(submit(s,word,'wrong again',100),'mistake');next(s);assert.equal(submit(s,word,word.word,100),'repaired');assert.equal(s.session.phase,'repaired');assert.equal(s.records[word.id].resolved,true);next(s);assert.equal(s.session.phase,'complete');assert.equal(s.records[word.id].streak,0);});
test('correct dictation waits for a separate next action and schedules spaced recall',()=>{const s=emptyState();start(s,'vocab',[word.id]);submit(s,word,word.word,100);assert.equal(s.session.phase,'correct');assert.equal(s.records[word.id].due,100+DAY);assert.deepEqual(dueEntries(s,[word],100+DAY),[word]);start(s,'vocab',[word.id]);submit(s,word,word.word,100+DAY);assert.equal(s.records[word.id].due,100+4*DAY);});
test('reload restores one-repeat repair and validates damaged state',()=>{const s=emptyState();start(s,'vocab',[word.id]);submit(s,word,'wrong');next(s);const r=loadState(JSON.stringify(s),entries);assert.equal(r.session.phase,'repair');submit(r,word,word.word);assert.equal(r.session.phase,'repaired');assert.equal(loadState('{broken',entries).session,null);s.session.ids=['unknown'];assert.equal(loadState(JSON.stringify(s),entries).session,null);});
test('collocations require study, recall, context and explicit self-check; no automatic sentence grading',()=>{const s=emptyState();start(s,'collocation',[lesson.id]);assert.equal(s.session.phase,'study');assert.equal(submit(s,lesson,lesson.word),'ignored');next(s);submit(s,lesson,lesson.word);next(s);assert.equal(s.session.phase,'gap');submit(s,lesson,lesson.word);next(s);assert.equal(s.session.phase,'write');assert.equal(s.records[lesson.id].completed,0);s.session.draft='An example sentence.';s.session.phase='selfcheck';assert.equal(completeLesson(s,lesson),false);s.session.checks=[0,1,2];assert.equal(completeLesson(s,lesson,100),true);assert.equal(s.records[lesson.id].completed,1);assert.equal(s.notes[lesson.id],'An example sentence.');assert.equal(s.records[lesson.id].due,100+DAY);});
test('collocation errors repair once and return to the right stage without skipping context',()=>{const s=emptyState();start(s,'collocation',[lesson.id]);next(s);submit(s,lesson,'wrong');next(s);submit(s,lesson,lesson.word);assert.equal(s.session.phase,'recall-ok');next(s);assert.equal(s.session.phase,'gap');submit(s,lesson,'wrong');next(s);submit(s,lesson,lesson.word);assert.equal(s.session.phase,'gap-ok');next(s);assert.equal(s.session.phase,'write');});
test('spelling variants are accepted while missing words and wrong inflections are rejected',()=>{assert.ok(isCorrect('  ANALYZE and interpret data. ',{word:'analyse and interpret data'}));assert.ok(isCorrect('neighborhoods',{word:'neighbourhoods'}));assert.ok(isCorrect('long term commitment',{word:'long-term commitment'}));assert.equal(isCorrect('develop expertises',{word:'develop expertise'}),false);assert.equal(isCorrect('develop',{word:'develop expertise'}),false);assert.equal(isCorrect('develop expertise',{word:'build expertise'}),false);});
test('all 887 source rows are covered; all 20 topics have three usable lessons with intact examples',()=>{assert.equal(data.meta.rawVocabulary,887);assert.equal(data.vocabulary.length,903);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);assert.deepEqual([...new Set(data.vocabulary.flatMap(w=>w.sources.map(s=>s.row)))].sort((a,b)=>a-b),Array.from({length:887},(_,i)=>i));assert.equal(data.topics.length,20);assert.equal(data.lessons.length,60);for(const t of data.topics){assert.equal(t.lessons.length,3);assert.ok(t.ideas.length>0);}for(const l of data.lessons){assert.ok(l.example.includes(l.word));assert.ok(l.meaning&&l.tip&&l.prompt&&l.page>=3&&l.page<=88);}for(const w of data.vocabulary){assert.ok(w.word&&w.meaning&&w.sources.length);assert.ok(!w.word.includes('/'));assert.ok(!/[\u4e00-\u9fff]/.test(w.word));}assert.equal(data.vocabulary.find(w=>w.word==='kidnap').meaning,'绑架');assert.equal(data.vocabulary.find(w=>w.word==='low-carb diet').meaning,'低碳水化合物饮食');});
test('saved notes cannot inject markup into rendered output',()=>{assert.equal(escapeHTML('<img src=x onerror="bad">'),'&lt;img src=x onerror=&quot;bad&quot;&gt;');});

test('custom writing goals count only correct repetitions, survive reload and keep current target',()=>{
 for(const goal of [1,3,10]){
  let s=emptyState();s.settings.repairGoal=goal;s.settings.volume=.42;start(s,'vocab',[word.id,data.vocabulary[1].id]);submit(s,word,'wrong');next(s);s.settings.repairGoal=2;
  for(let i=1;i<=goal;i++){
   submit(s,word,'wrong again');assert.equal(s.session.repeats,i-1);next(s);
   assert.equal(submit(s,word,word.word),i===goal?'repaired':'repair-progress');
   s=loadState(JSON.stringify(s),entries);assert.equal(s.session.repeats,i);assert.equal(s.session.repairGoal,goal);assert.equal(s.session.phase,i===goal?'repaired':'repair');assert.equal(s.records[word.id].resolved,i===goal);assert.equal(s.settings.volume,.42);
  }
  next(s);submit(s,data.vocabulary[1],'wrong');assert.equal(s.session.repairGoal,2);assert.equal(s.session.repeats,0);
 }
});
test('multi-repeat collocation repairs finish at their original recall and gap stages',()=>{
 let s=emptyState();s.settings.repairGoal=3;start(s,'collocation',[lesson.id]);next(s);
 for(const target of ['recall-ok','gap-ok']){
  submit(s,lesson,'wrong');next(s);assert.equal(s.session.repeats,0);
  for(let i=0;i<3;i++){submit(s,lesson,lesson.word);s=loadState(JSON.stringify(s),entries);}
  assert.equal(s.session.phase,target);next(s);
 }
 assert.equal(s.session.phase,'write');assert.equal(s.records[lesson.id].completed,0);
});
test('legacy writing repairs keep one repetition and invalid settings cannot bypass practice',()=>{
 const s=emptyState();start(s,'vocab',[word.id]);submit(s,word,'wrong');next(s);delete s.settings.volume;delete s.settings.repairGoal;delete s.session.repeats;delete s.session.repairGoal;
 let r=loadState(JSON.stringify(s),entries);assert.equal(r.settings.volume,1);assert.equal(r.settings.repairGoal,1);assert.equal(r.session.repeats,0);assert.equal(submit(r,word,word.word),'repaired');
 for(const bad of [0,-1,11,2.5,'3',null]){s.settings.repairGoal=bad;s.settings.volume=2;r=loadState(JSON.stringify(s),entries);assert.equal(r.settings.repairGoal,1);assert.equal(r.settings.volume,1);}
 s.settings.volume=0;assert.equal(loadState(JSON.stringify(s),entries).settings.volume,0);
});
