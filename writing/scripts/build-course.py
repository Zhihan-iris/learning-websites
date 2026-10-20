import json
from pathlib import Path
D=Path(__file__).resolve().parents[1]/'data'
base=json.loads((D/'content.json').read_text());bank=json.loads((D/'sentence-bank.json').read_text());essays=json.loads((D/'essays.json').read_text())
groups=[]
for i,section in enumerate(dict.fromkeys(w['section'] for w in base['vocabulary'])):
 es=[w for w in base['vocabulary'] if w['section']==section]
 groups.append(dict(id=f'vg-{i+1:02}',kind='vocab',title=section,section=section,topic=es[0]['topic'],description='同一写作板块的词汇一起预习，再逐项回忆。',entryIds=[e['id'] for e in es],essayId=next(e['id'] for e in essays if section in e['sections'])))
for g in bank['groups']:groups.append(dict(g,kind='collocation',essayId=next(e['id'] for e in essays if g['topic'] in e['topics'])))
result=dict(groups=groups,expressions=bank['entries'],legacyExpressions=bank['legacyExpressions'],replacements=bank['replacements'],essays=essays,meta=dict(bank['meta'],sourceRows=bank['audit']['sourceRows'],vocabGroups=28,essayCount=len(essays),updated='2026-10-20'))
(D/'course.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print('Course:',len(groups),'groups;',len(result['expressions']),'expressions;',len(essays),'essays')
