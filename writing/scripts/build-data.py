"""Rebuild the writing practice bank from extracted source records and edited lessons."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1];data=root/'data'
raw=json.loads((data/'source-vocabulary.json').read_text());source=json.loads((data/'source-collocations.json').read_text())
# Edits keep the original row and page visible in the learner's reference panel.
fixes={
'public school':('public school','公立学校（美国用法）；英国常指收费私立中学','注意英美含义不同。'),
'specialized education':('specialized education','专业化教育','不必然等同于中国学历层次中的“专科”。'),
'vocational and technical education':('vocational and technical education','职业与技术教育','修正连写的中文释义。'),
'bachelor degree':("bachelor's degree",'学士学位','使用常规所有格形式。'),
'master degree':("master's degree",'硕士学位','使用常规所有格形式。'),
'home school':('homeschooling','家庭教育；在家上学','按原释义使用表示教育方式的名词。'),
'critical thinking':('critical thinking','批判性思维','不宜简单等同于辩证思考。'),
'promote literacy level':('improve literacy levels','提高读写能力','调整为更自然的搭配。'),
'enrich/abundant experience':("enrich one's experience",'丰富个人经历','原文把动词与形容词混合；本练习使用完整动词搭配。'),
'create learning environment':('create a learning environment','创造学习环境','补充单数可数名词前的冠词。'),
'build one’s world value':("develop one's worldview",'形成世界观','worldview 表示世界观。'),
'selective subjects':('elective subjects','选修课','选修课常用 elective subjects。'),
'practical/specialist knowledge':('practical knowledge / specialist knowledge','实践知识 / 专业知识','拆分两种不同含义。'),
'facilitate better hand-eye coordination':('improve hand-eye coordination','改善手眼协调能力','改为自然搭配并修正中文动词。'),
'hinder the social and emotional development':('hinder social and emotional development','阻碍社交和情感发展','泛指时不必加 the。'),
'lacks the face-to-face interaction':('lack face-to-face interaction','缺乏面对面互动','统一为动词原形并去掉泛指名词前的 the。'),
'expand friend circle':("expand one's circle of friends",'拓展朋友圈','补全惯用搭配。'),
'national identity':('national identity','国家或民族认同','identity 侧重认同。'),
'cultural assimilation':('cultural assimilation','文化同化','修正释义。'),
'historical interest':('a place of historical interest','历史名胜','补全与“古迹”对应的名词结构。'),
'increase productivity':('increase productivity','提高生产率','productivity 是生产率。'),
'ravel budget':('travel budget','旅行预算','修复漏字。'),
'carbon footprint':('carbon footprint','碳足迹','不是泛指一切碳排放。'),
'provide job':('provide jobs','提供工作岗位','补全泛指可数名词复数。'),
'broaden roads':('widen roads','拓宽道路','道路变宽通常用 widen。'),
'materialistic culture':('materialistic culture','物质主义文化','区分物质文化与物质主义。'),
'soft drink':('soft drink','不含酒精的饮料','不一定含气。'),
'low-carb diet':('low-carb diet','低碳水化合物饮食','carb 指 carbohydrate，非低碳排放。'),
'encourage materialism':('encourage materialism','助长物质主义','修正中文含义。'),
'reduce career advancement opportunities for younger employees':('reduce career advancement opportunities for younger employees','减少年轻员工的晋升机会','修正“升值”错字。'),
'difficulty in relating to younger':('difficulty in relating to younger customers','难以与年轻客户建立共鸣','根据原中文补足缺失的宾语。'),
'avoid abusing power':('avoid abusing power','避免滥用权力','修正“权利”为“权力”。'),
'criminal justice':('criminal justice','刑事司法','不是泛指司法公正。'),
'kidnap':('kidnap','绑架','原译“抢劫”有误；抢劫可用 rob。'),
'increase standard of living':('improve living standards','提高生活水平','改为自然搭配。'),
'create employment opportunity':('create employment opportunities','创造就业机会','泛指机会用复数。'),
'environmental protection and conservation':('environmental protection and conservation','环境保护与资源保育','避免重复释义。'),
'cultural clashes and conflicts':('cultural clashes and conflicts','文化碰撞与冲突','避免重复释义。'),
'biodiversity (n.)':('biodiversity','生物多样性','修正术语释义。'),
'environment deterioration':('environmental deterioration','环境恶化','使用形容词 environmental。'),
'deforestation (n.)':('deforestation','森林砍伐；毁林','与森林退化概念区分。'),
'recycle':('recycle','回收利用','修正不完整释义。'),
'virus invade':('virus infection','病毒感染','原词组语法不完整，改用名词搭配。'),
'accelerate energy consumption':('accelerate energy consumption','加快能源消耗','原中文栏重复英文，补充中文。'),
'exploration of mars':('exploration of Mars','火星探索','专名 Mars 大写。'),
'interplanetary trave':('interplanetary travel','行星间旅行','修复漏字。'),
'campaign for':('campaign for','为……开展活动；争取……','需接所争取的目标。'),
'publicize (v.)':('publicize','宣传；使公众知晓','补充准确释义。'),
'advertisement agency':('advertising agency','广告公司','采用惯用名词搭配。'),
'inspires curiosity':('inspire curiosity','激发好奇心','统一为动词原形。'),
'distract from educational':('distract from educational activities','使人分心，偏离教育活动','补足形容词后缺失的名词。'),
'promotion of unhealthy product':('promotion of unhealthy products','推广不健康产品','泛指可数产品使用复数。'),
'unhealthy or unattainable purchase':('unhealthy or unaffordable purchases','不健康或负担不起的购买行为','按消费语境修订词义与数。')
}
splits={
'elementary / primary education':[('elementary education','初等教育'),('primary education','小学教育')],
'private/independent school':[('private school','私立学校'),('independent school','独立学校；私立学校')],
'immediate feedback/response':[('immediate feedback','即时反馈'),('immediate response','即时回应')],
'practical knowledge / specialist knowledge':[('practical knowledge','实践知识'),('specialist knowledge','专业知识')],
'campus life/facilities':[('campus life','校园生活'),('campus facilities','校园设施')],
'cultural conflict /culture shock':[('cultural conflict','文化冲突'),('culture shock','文化冲击')],
'criminal/offender/convict/ prisoner/inmate':[('criminal','罪犯'),('offender','违法者'),('convict','已被定罪者'),('prisoner','囚犯'),('inmate','被收容者；狱中囚犯')],
'ex-prisoner/released prisoners/former inmate':[('ex-prisoner','曾服刑者'),('released prisoners','获释囚犯'),('former inmate','曾被收容或监禁者')],
'repeat criminal/recidivist':[('repeat offender','再犯者'),('recidivist','惯犯；再犯者')],
'vocational/job training':[('vocational training','职业培训'),('job training','岗位培训')],
'stereotype/bias':[('stereotype','刻板印象'),('bias','偏见')],
'(traditional) fossil fuel':[('fossil fuel','化石燃料'),('traditional fossil fuel','传统化石燃料')]
}
words=[];seen={}
for i,r in enumerate(raw):
 word,meaning,note=fixes.get(r['word'],(r['word'],r['meaning'],''));word=re.sub(r'\s*\((?:n|v|adj)\.\)','',word).strip()
 forms=splits.get(word,[(s.strip(),meaning) for s in word.split('/')])
 for j,(w,m) in enumerate(forms):
  key=(r['section'],w.lower())
  origin={'word':r['word'],'meaning':r['meaning'],'page':r['page'],'row':i}
  if key in seen:seen[key]['sources'].append(origin);continue
  entry={'id':f'v-{i:04}-{j}','word':w,'meaning':m,'topic':r['topic'],'section':r['section'],'note':note,'sources':[origin]}
  words.append(entry);seen[key]=entry
lessons=[]
for i,line in enumerate((data/'lessons.tsv').read_text().splitlines()):
 n,phrase,meaning,example,tip,prompt=line.split('\t');tid='topic-'+n
 candidates=[p for p in source['phrases'] if p['topic']==tid and phrase.lower().replace('’',"'") in p['phrase'].lower().replace('’',"'")]
 assert candidates,(tid,phrase)
 page=candidates[0]['page'];original=phrase
 if phrase=='raise the awareness of preservation':
  phrase='raise awareness of cultural preservation';example=example.replace(original,phrase);tip='raise awareness of + 保护对象；awareness 在此不需要 the。原资料搭配已作自然表达调整。'
 if phrase=='discrimination against pregnancy':
  phrase='discrimination against pregnant workers';example=example.replace(original,phrase);tip='discrimination against + 被歧视的人群；用 pregnant workers 比 pregnancy 更准确地说明受影响者。'
 assert phrase in example,(phrase,example)
 lessons.append({'id':f'c-{i+1:03}','topic':tid,'word':phrase,'meaning':meaning,'example':example,'tip':tip,'prompt':prompt,'page':page,'original':original})
topics=[{**t,'lessons':[l['id'] for l in lessons if l['topic']==t['id']]} for t in source['topics']]
result={'vocabulary':words,'lessons':lessons,'topics':topics,'meta':{'rawVocabulary':len(raw),'vocabulary':len(words),'lessons':len(lessons),'topics':len(topics),'sourceIdeas':sum(len(t['ideas']) for t in topics),'correctedRows':sum(r['word'] in fixes for r in raw),'updated':'2026-10-19'}}
(data/'content.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps(result['meta'],ensure_ascii=False))
