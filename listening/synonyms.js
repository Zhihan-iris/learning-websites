import {normalize,isCorrect} from './core.js?v=3';
// Group only identical cues within the same Cambridge volume; retain source context.
export function buildSynonymGroups(words){
 const map=new Map();
 for(const w of words.filter(w=>w.book==='synonyms')){
  const key=w.scene+'|'+normalize(w.counterpart);
  if(!map.has(key))map.set(key,{id:'syn-group:'+w.id,word:w.counterpart,cue:w.counterpart,book:'synonyms',scene:w.scene,kind:'synonym-group',group:w.scene.replace('syn-','剑')+' · 同义替换组',sourcePages:[],answers:[],memberIds:[]});
  const g=map.get(key);g.memberIds.push(w.id);g.sourcePages=[...new Set([...g.sourcePages,...w.sourcePages])];
  const found=g.answers.find(a=>isCorrect(w.word,{word:a.word,kind:'synonym',acceptedAnswers:a.acceptedAnswers}));
  const context={group:w.group,meaning:w.meaning,sourcePages:w.sourcePages,original:w.original};
  if(found){found.contexts.push(context);found.memberIds.push(w.id);}
  else g.answers.push({word:w.word,speechText:w.speechText||w.word,meaning:w.meaning,acceptedAnswers:w.acceptedAnswers||[],contexts:[context],memberIds:[w.id]});
 }
 return [...map.values()].map(g=>({...g,meaning:g.answers.map(a=>a.meaning).join('；'),speechText:g.answers.map(a=>a.speechText).join('. ')}));
}
export function migrateSynonymProgress(p,groups){
 const oldToNew=new Map(groups.flatMap(g=>g.memberIds.map(id=>[id,g.id])));
 const oldMastered=new Set(p.mastered);p.mastered=p.mastered.filter(id=>!oldToNew.has(id));
 for(const g of groups){if(g.memberIds.every(id=>oldMastered.has(id))&&!p.mastered.includes(g.id))p.mastered.push(g.id);
  const records=g.memberIds.filter(id=>p.mistakes[id]);if(!records.length)continue;
  const all=[...(p.mistakes[g.id]?[p.mistakes[g.id]]:[]),...records.map(id=>p.mistakes[id])];
  p.mistakes[g.id]={count:all.reduce((n,m)=>n+m.count,0),lastAnswer:all.at(-1).lastAnswer,resolved:all.every(m=>m.resolved)};
  for(const id of records)delete p.mistakes[id];
 }
 const s=p.session;let restarted=false;
 if(s&&s.ids.some(id=>oldToNew.has(id))){
  if(s.phase==='complete'){p.session=null;return false;}
  const ids=[...new Set(s.ids.slice(s.index).map(id=>oldToNew.get(id)||id))];
  p.session={ids,index:0,repeats:0,phase:groups.some(g=>g.id===ids[0])?'study':'question',correct:0,wrong:0,review:s.review};restarted=true;
 }
 return restarted;
}
