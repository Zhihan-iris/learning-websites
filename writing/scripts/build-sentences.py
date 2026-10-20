"""Keep each connected source idea intact as an edited, bilingual sentence unit.
The original extraction remains available for audit and old progress restoration.
"""
import csv,json,re
from pathlib import Path
D=Path(__file__).resolve().parents[1]/'data'
src=json.loads((D/'source-collocations.json').read_text())
bank=json.loads((D/'collocation-bank.json').read_text())
texts=list(csv.DictReader((D/'sentences.tsv').open(),delimiter='\t'))
authored={r['id']:r for r in texts}
assert len(authored)==len(texts)
def norm(x):return re.sub(r'[\s‐‑–—-]+','',x.lower().replace('’',"'"))
by_row={s['row']:e for e in bank['entries'] for s in e['sources']}
units=[];covered_ideas=[];used_texts=set()
for t in src['topics']:
 for j,idea in enumerate(t['ideas']):
  rows=[i for i,r in enumerate(src['phrases']) if r['topic']==t['id'] and r['page']==idea['page'] and norm(r['phrase']) in norm(idea['text'])]
  if len(rows)<2:continue
  key=f'{t["id"]}-{j:03}';covered_ideas.append(key)
  # The PDF extractor joined a list of separate curriculum items here. Restore its
  # distinct ideas instead of forcing the whole list into a single enormous sentence.
  parts=[(key,rows)] if key!='topic-02-048' else [(key+'-'+suffix,rs) for suffix,rs in [
   ('a',[152,153,154,155]),('b',[156,157]),('c',[158,159]),('d',[160,161,162]),('e',[163,164,165]),('f',[166,167,168])]]
  for key,rs in parts:
   text=authored[key];used_texts.add(key)
   assert text['english'].endswith('.') and text['chinese'] and len(text['english'])<500
   components=list({by_row[r]['id']:by_row[r] for r in rs}.values())
   origins=[dict(row=r,phrase=src['phrases'][r]['phrase'],cue=src['phrases'][r]['cue'],page=src['phrases'][r]['page']) for r in rs]
   anchor=min(rs);e=dict(id='c-sentence-'+key.removeprefix('topic-'),word=text['english'],meaning=text['chinese'],topic=t['id'],page=idea['page'],sources=origins,sourceContext=idea['text'],unitType='sentence',contextCue=False,groupId=by_row[anchor]['groupId'],componentIds=[e['id'] for e in components],components=[dict(id=e['id'],word=e['word'],meaning=e['meaning']) for e in components],note='依据同一原文论点整理的完整英文句子，并非原文逐字引句；补足主语和连接关系，必要时订正搭配或限定表述范围。原搭配只作对照，不再拆为独立题。')
   units.append(e)
assert used_texts==set(authored),(used_texts^set(authored))
replacements={}
for e in units:
 for old in e['componentIds']:replacements.setdefault(old,e['id'])
kept=[dict(e) for e in bank['entries'] if e['id'] not in replacements]
# Standalone complete English sentences also remain whole, with editorial grammar fixes.
for e in kept:
 rows={s['row'] for s in e['sources']}
 if 813 in rows:
  e.update(word='The line between work and personal life has blurred, leading to fatigue and stress.',meaning='工作与个人生活之间的界限已经模糊，带来了疲劳和压力。',unitType='sentence',contextCue=False)
 if 1175 in rows:
  e.update(word='The cost of protecting some endangered species can be prohibitive.',meaning='保护某些濒危物种的成本可能高得难以承受。',unitType='sentence',contextCue=False,note='保留完整句意，订正 of saving 的搭配，并限定原文绝对化判断。')
entries=sorted(kept+units,key=lambda e:min(s['row'] for s in e['sources']))
groups=[]
for g in bank['groups']:
 ids=[e['id'] for e in entries if e['groupId']==g['id']]
 if ids:groups.append(dict(g,entryIds=ids,description='同一论点中的多个搭配已整理成完整英文句子：整句理解、朗读与默写；独立短语仍作为单独表达学习。'))
covered={s['row'] for e in entries for s in e['sources']}
assert covered==set(range(len(src['phrases'])))
assert len({e['id'] for e in entries})==len(entries)
assert sum(len(g['entryIds']) for g in groups)==len(entries)
result=dict(entries=entries,groups=groups,replacements=replacements,legacyExpressions=bank['entries'],audit=dict(sourceRows=len(src['phrases']),coveredRows=len(covered),combinedIdeas=covered_ideas,editedSentences=len(units)),meta=dict(entries=len(entries),groups=len(groups),topics=20,sentences=sum(e.get('unitType')=='sentence' for e in entries),sourceRows=len(src['phrases'])))
(D/'sentence-bank.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['meta'])
