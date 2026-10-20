"""Build traceable usage guides from curated lexical notes and explicit grammar patterns."""
import csv,json,re
from pathlib import Path
D=Path(__file__).resolve().parents[1]/'data'
base=json.loads((D/'content.json').read_text());course=json.loads((D/'course.json').read_text())
lex={r['word'].lower():r for r in csv.DictReader((D/'usage-words.tsv').open(),delimiter='\t')}
verbs=set('abide accelerate access achieve address advance advocate alleviate allocate apply avoid become boost build carry catch combat commit communicate connect contribute control create cultivate curb damage develop die discover distinguish distract download drive educate empower emulate enact encourage enforce enhance enrich ensure escape expand experience exploit facilitate feature form foster generate get give go guide have help hinder hold impose improve increase influence inform inspire integrate introduce invade invest issue join keep lack lead learn limit listen live lower maintain make master meet monitor need obtain offend offer pay pose prevent process produce promote protect provide publicize purify pursue put raise receive recruit recycle reduce regulate reinforce release relieve require result satisfy save seek serve set shape share show socialise socialize spark specialise specialize spread start stay stimulate store strain strengthen study suffer support suppress tackle take target teach threaten transfer travel trigger undermine use violate widen work answer replay select construct evaluate embrace inherit appreciate manage control imitate expose showcase connect contain demand juggle care acquire find feel face prepare choose follow earn lose negotiate absorb bring gather distribute recognise recognize attract reveal facilitate suit lend retain afford differ demonstrate act participate launch reflect rehabilitate distinguish separate represent preserve record compile donate publicise organise organize showcase celebrate navigate encounter purchase spend fund subsidise subsidize depend focus adopt deal gain grow tend view witness express assist consolidate train read write translate import export end seem remain practice practise hamper entertain tempt cater communicate ban cope assess contribute adapt protect grant render eliminate discourage maximise maximize minimise minimize cease delay engage interact render attempt enrich detect endanger sustain pass waste worsen rebuild obey struggle exploit reflect support widen'.split())
verbs.update('prompt direct abuse add adjust affect allow benefit breed campaign cause come constitute consume cost deploy designate destroy destruct deter differentiate disrupt do ease emphasise enable establish exacerbate exaggerate explain fail fall fertilize fight force fuel glamourize highlight impact impair impart implement include intend interpret interrupt intervene involve lay leave lessen let levy lighten look measure migrate mistake narrow occupy outweigh place plan play possess prolong re-emphasize realize reconnect rely renew replace report run sacrifice sell send shoulder step strike strive switch think treat turn volunteer want wreak'.split())
adjectival=('devoted to ','committed to ','dependent on ','responsible for ','concerned about ','aware of ','capable of ','likely to ','unable to ','willing to ','unwilling to ','suitable for ','beneficial to ','harmful to ','worth ')
# Each pattern applies only when its actual English sequence occurs in the entry.
rules=[
(r'\binteract(?:s|ing)? with\b','interact with + 人 / 事物','with 引出互动对象；可写 interact with peers，不直接写 interact peers。'),
(r'\bcommunicat(?:e|es|ing) with\b','communicate with + 人','with 引出交流对象；交流内容可用 about + 话题补充。'),
(r'\bform friendships\b','form friendships with + 人','form friendships 表示建立友谊；需要说明与谁建立友谊时，用 with 引出对象。'),
(r'\b(?:become|get) familiar with\b','become / get familiar with + 事物','表示逐渐熟悉某事；with 引出所熟悉的对象。'),
(r'\b(?:interest|interested) in\b','interest in / be interested in + 名词或 doing','名词 interest 与形容词 interested 都用 in 引出对象；形容词作谓语时需要 be。'),
(r'\battend\b','attend + 学校 / 课程 / 活动','attend 作出席、上学讲时直接接对象，不加 to；attend to 则表示处理或照料。'),
(r'\b(?:enable|allow|encourage|require|motivate)\b','按动词含义选择对象 + to do','enable 表示使能够，allow 表示允许，encourage 表示鼓励，require 表示要求，motivate 表示激励。'),
(r'\b(?:increase|decrease|reduction|rise|fall) in\b','名词 + in + 指标','作为变化名词时，in 引出发生变化的指标，如 a rise in unemployment。'),
(r'\b(?:attitudes|attitude) towards\b','attitude(s) towards + 对象','towards 引出态度所针对的对象；单数 attitude 通常需要冠词或所有格。'),
(r'\b(?:advantages|disadvantages|benefits|drawbacks) of\b','优点或缺点名词 + of + 对象','of 引出被评价的事物或做法；动作通常使用 doing。'),
(r'\b(?:a wide|a broad) range of\b','a wide / broad range of + 复数名词或不可数名词','表示多种或广泛的事物；of 后要补全类别，本条本身不能单独构成完整论点。'),

(r'\b(?:lead|leads|leading) to\b','lead to + 名词 / 动名词','to 是介词，后接结果或 doing，不接动词原形。'),
(r'\bresult in\b','result in + 结果','in 引出结果；result from 才引出原因，二者方向不同。'),
(r'\bresult from\b','result from + 原因','from 引出原因；不要与 result in + 结果混用。'),
(r'\bcontribut\w* to\b','contribute to + 名词 / 动名词','to 是介词；表示促成或有助于某事，后可接 doing。'),
(r'\bcommitment to\b','commitment to + 名词 / 动名词','to 是介词；可写 commitment to improving，不写 to improve。'),
(r'\b(?:adapt|adapting) to\b','adapt to + 名词 / 动名词','表示适应；to 后接新环境、变化或 doing。'),
(r'\b(?:be|get|become) (?:more )?accustomed to\b','be / become accustomed to + 名词 / 动名词','表示习惯于；to 是介词，后接 doing。'),
(r'\b(?:be )?proficient at\b','be proficient at + 名词 / 动名词','表示熟练；at 后写技能或活动，不能遗漏 be 的对应形式。'),
(r'\b(?:be )?aware of\b','be aware of + 名词','of 引出所意识到的事物；如果接完整分句，可改用 be aware that。'),
(r'\b(?:be )?capable of\b','be capable of + 名词 / 动名词','of 是介词；表示有能力做某事，后可接 doing。'),
(r'\b(?:be )?able to\b','be able to + 动词原形','to 在此是不定式标记；后面用动词原形。'),
(r'\b(?:be )?likely to\b','be likely to + 动词原形','表示可能；注意根据主语选用 is 或 are。'),
(r'\b(?:be )?responsible for\b','be responsible for + 名词 / 动名词','for 引出负责的事项或行为。'),
(r'\b(?:be )?addicted\b','be addicted to + 名词 / 动名词','表示沉迷；要补充对象时用 to，后接名词或 doing。'),
(r'\b(?:be )?conducive to\b','be conducive to + 名词 / 动名词','表示有利于；to 是介词，后接名词或 doing。'),
(r'\b(?:rely|depend) on\b','rely / depend on + 对象','表示依靠或取决于；on 不可省略。'),
(r'\b(?:focus|concentrate) on\b','focus / concentrate on + 名词 / 动名词','on 引出关注对象或活动，后可接 doing。'),
(r'\b(?:suffer|suffering) from\b','suffer from + 问题 / 疾病','from 引出所遭受的问题或疾病。'),
(r'\b(?:benefit|benefiting) from\b','benefit from + 来源','from 引出受益来源；benefit someone 则是使某人受益。'),
(r'\b(?:invest|investing|investment) in\b','invest in + 对象','投资的领域、资源或事物用 in 引出。'),
(r'\b(?:participate|participation) in\b','participate in + 活动','参加活动用 in；不要直接写 participate an activity。'),
(r'\b(?:engage|engaged) in\b','engage in + 活动','表示参与或从事，活动用 in 引出。'),
(r'\b(?:deal|cope) with\b','deal / cope with + 问题','处理或应对的对象用 with 引出。'),
(r'\b(?:care|caring) for\b','care for + 对象','表示照料；care about 则强调在意，两者意思不同。'),
(r'\btake (?:better )?care of\b','take care of + 对象','of 后接被照顾的人或物；care 前可加 good 或 better。'),
(r'\b(?:learn|learning) from\b','learn from + 来源','from 后接经验、错误或可学习的人。'),
(r'\b(?:have|has) access to\b','have access to + 资源','to 是介词；access 在此是名词，不要写 access of。'),
(r'\baccess to\b','access to + 资源','名词 access 后接 to；作动词时则直接写 access + 资源。'),
(r'\b(?:be )?exposed to\b','be exposed to + 对象','to 后接接触到的事物；注意被动结构 be + exposed。'),
(r'\bexpose .+ to\b','expose + 人 + to + 事物','两个宾语位置要齐全：让谁接触什么。'),
(r'\b(?:protect|prevent) .+ from\b','protect / prevent + 对象 + from + 名词或 doing','from 后写风险或阻止发生的行为；不要漏掉前面的对象。'),
(r'\bdistinguish .+ from\b','distinguish A from B','表示区分 A 与 B，from 连接比较的另一方。'),
(r'\bprovide .+ with\b','provide + 人 + with + 事物','人先写，事物后写；另一结构是 provide + 事物 + for + 人。'),
(r'\bprovide .+ for\b','provide + 事物 + for + 对象','先说明提供什么，再用 for 写受益对象或用途。'),
(r'\b(?:enable|allow|encourage|require|motivate) .+ to\b','动词 + 对象 + to do','说明让谁做什么；to 后用动词原形，保留前面的对象。'),
(r'\b(?:enable|allow|encourage|require|motivate)\b','enable / allow / encourage / require + 人 + to do','接人的动作时用对象 + to do；若直接接名词，则表示促进、允许或要求某事。'),
(r'\bhelp\b','help + 人 + (to) do / help with + 事情','help 接动作时可省略 to；接事情可使用 with，不写 help someone doing。'),
(r'\b(?:learn|need|seek|fail|tend|attempt|choose|decide|manage) to\b','动词 + to do','to 后用动词原形；保留前面动词所表达的需要、尝试或倾向。'),
(r'\b(?:avoid|enjoy|consider)\b','avoid / enjoy / consider + 名词或 doing','如果后面表示动作，用动名词，通常不接 to do。'),
(r'\b(?:cause|lead to|result in|contribute to)\b','原因或行为 + 因果表达 + 结果','区分“导致”与“有助于”；用于论证时需要说明机制，不能仅靠搭配认定因果。'),
(r'\battitude to(?:wards)?\b','attitude to / towards + 对象','表示对某事的态度，后接名词。'),
(r'\bimpact on\b','have an impact on + 对象','影响的对象由 on 引出；impact 前可加 significant、negative 等。'),
(r'\beffect on\b','have an effect on + 对象','effect 是名词；影响对象用 on 引出。'),
(r'\bopportunit(?:y|ies) to\b','opportunity to + 动词原形','表示做某事的机会；不定式说明机会的内容。'),
(r'\b(?:ability|capacity) to\b','ability / capacity to + 动词原形','不定式说明具体做什么的能力。'),
(r'\b(?:risk|probability|likelihood) of\b','risk / probability / likelihood of + 名词或 doing','of 引出风险或概率对应的事件。'),
(r'\b(?:lack|shortage) of\b','a lack of / a shortage of + 事物','表示缺少；lack 作动词时后直接接宾语，不加 of。'),
(r'\b(?:demand|need) for\b','demand / need for + 事物','名词后用 for 引出需求对象；作动词时一般直接接宾语。'),
(r'\bsense of\b','a sense of + 抽象名词','表示某种感觉或意识，如 a sense of achievement。'),
(r'\b(?:role|part) in\b','play a role / part in + 名词或 doing','in 引出发挥作用的领域或活动。'),
(r'\b(?:right|rights) to\b','the right to + 动词原形 / 名词','to 后既可说明某项资源，也可用不定式说明有权做的事。'),
(r'\b(?:compared|comparison) (?:with|to)\b','compared with / to + 比较对象','比较时确保两边是同类对象，不把人直接和结果相比。'),
(r'\b(?:more|less|higher|lower|better|fewer) .+ than\b','比较级 + than + 比较对象','than 后补足比较基准；比较对象应在同一维度。'),
(r"\bone's\b","one's → my / their / people's 等所有格",'one\'s 是泛指占位；写自己的句子时要根据主语替换，练习目标答案仍以本条为准。'),
]
examples=[]
for e in course['expressions']:
 if e.get('unitType')=='sentence':examples.append((e['word'],e['meaning'],'本站整理整句'))
for e in base['lessons']:examples.append((e['example'],'','原有用法例句'))
for e in course['essays']:
 for p in e['paragraphs']:
  for text in re.split(r'(?<=[.!?])\s+',p['text']):
   if len(text)>20:examples.append((text,'','本站话题范文'))
def norm(s):return re.sub(r'\s+',' ',s.lower().replace('’',"'").replace('-',' ')).strip()
def example_for(e):
 if e.get('unitType')=='sentence':return dict(text=e['word'],translation=e['meaning'],source='当前完整句子')
 needle=' '+norm(e['word']).strip('.,')+' '
 for text,zh,source in examples:
  clean=' '+re.sub(r'[.,!?;:]',' ',norm(text))+' '
  clean=re.sub(r'\s+',' ',clean)
  if needle in clean:return dict(text=text,translation=zh,source=source)
 return None

def guide(e):
 word=e['word'];low=word.lower();first=low.split()[0].strip(',');notes=[];patterns=[]
 if first in ['only','negatively']:first=low.split()[1]
 exact=lex.get(low)
 if e.get('unitType')=='sentence':
  kind='sentence';pattern=word;notes.append('按完整意思组织主语、谓语和补充信息；下面的搭配拆解只用于理解，练习仍要求写出整句。')
  for marker,tip in [('because','because 引出原因从句，要保留主语和谓语。'),('although','although 引出让步，主句说明限制条件下仍成立的观点。'),('while','while 可表示对照或同时发生；根据句意判断两部分关系。'),('when','when 引出时间或条件，注意它与主句的对应关系。'),('if','if 引出条件，避免把有条件的结论写成绝对结论。'),('which','which 引出对前面事物或情况的补充说明。')]:
   if re.search(r'\b'+marker+r'\b',low):notes.append(tip)
 elif exact:
  kind=exact['kind'];pattern=exact['pattern'];notes.append(exact['note']);patterns.append(exact['collocation'])
 elif re.match(r'^(?:may|might|can|could|will|would|should|must|cannot)\b',low):
  kind='verb';pattern='主语 + '+word;notes.append('这是带情态动词的谓语部分；前面补上明确的主语。情态动词后接动词原形，不加第三人称单数 -s。')
 elif first=='be':
  kind='verb';pattern='主语 + am / is / are + '+word[3:];notes.append('be 在句中要根据主语和时态变化；情态动词后则保留 be 原形。不要把 be 短语直接当作完整句子。')
 elif low.startswith(adjectival) or low in ['environmentally friendly','eco-friendly','well-educated','reliable and dependable','unbiased and impartial']:
  kind='adjective';pattern='主语 + be + '+word;notes.append('这是形容词或形容词性表达；描述主语状态时通常需要 be，不能省略系动词。')
 elif re.match(r'^(?:in|on|at|with|without|out of)\b',low):
  kind='adverb';pattern=word;notes.append('这是补充状态、方式或条件的介词短语，需要和句子的主语、谓语配合使用。')
 elif low=='ought to be incentivized to handle their own finances':
  kind='verb';pattern='主语 + '+word;notes.append('ought to + 动词原形表示应该；to 后保留 be，再接过去分词构成被动。')
 elif low in ['violence causes psychological problems','environment-friendly technology alleviates pollution']:
  kind='sentence';pattern=word;notes.append('这里已经包含主语和谓语，是完整判断；用于作文时需结合证据限定表述范围。')
 elif first in verbs and low not in ['direct mail advertisement','work ethic','import and export','control of information','target audience','live performance','live tv broadcast','live streaming','live coverage'] and not low.startswith(('travel ','access to ','lack of ')):
  kind='verb';pattern='主语 + '+word;notes.append('以 '+word.split()[0]+' 为核心的动词表达；写句子时补足主语，并根据主语、时间调整动词形式。')
  if first in ['provide','offer']:notes.append('写清提供的事物及受益对象；provide 可用 provide something for someone 或 provide someone with something。')
  elif first in ['improve','enhance','reduce','increase','develop','promote','foster','boost','maintain','create','build']:
   notes.append(word.split()[0]+' 后直接接本条中的名词宾语，不需要额外加介词；这是动词与宾语的搭配。')
 else:
  kind='noun';pattern='名词短语：'+word
  notes.append('把本条作为名词性表达放入句子的主语或宾语位置；它本身不构成完整句子。')
  tokens=word.split()
  if len(tokens)>1 and not re.search(r'\b(?:of|to|for|in|on|with|and|or)\b',low):
   notes.append('本条的修饰部分为“'+' '.join(tokens[:-1])+'”，中心词为“'+tokens[-1]+'”；修饰部分说明中心词的类型或特征。')
 if kind=='noun' and not exact:
  head_phrase=re.split(r'\b(?:of|for|to|in|on|with|from|through)\b',low)[0].strip()
  head=(head_phrase.split() or low.split())[-1]
  mass={'education':'invest in','training':'provide','knowledge':'acquire','awareness':'raise','confidence':'build','information':'access','data':'analyse','pollution':'reduce','waste':'reduce','energy':'conserve','biodiversity':'protect','growth':'support','development':'support','cooperation':'promote','communication':'improve','understanding':'deepen','research':'conduct','aid':'provide','assistance':'provide','support':'offer','funding':'secure','health':'protect','safety':'improve','security':'enhance','access':'improve','employment':'create','unemployment':'reduce','poverty':'reduce','inequality':'address','discrimination':'combat','diversity':'preserve','freedom':'protect','innovation':'encourage','creativity':'foster','thinking':'develop','behaviour':'influence','behavior':'influence','transportation':'improve','transport':'provide','infrastructure':'invest in','tourism':'promote','investment':'attract','demand':'meet','pressure':'reduce','stress':'relieve','trust':'build','loyalty':'build','identity':'preserve','culture':'preserve','heritage':'protect','interaction':'encourage','collaboration':'encourage','advertising':'regulate','consumption':'reduce','overload':'reduce','technology':'develop','entertainment':'provide','learning':'support','isolation':'reduce','progress':'monitor','work':'find','life':'improve'}
  plural={'skills':'develop','resources':'conserve','emissions':'reduce','opportunities':'create','services':'provide','standards':'improve','conditions':'improve','rights':'protect','values':'promote','needs':'meet','risks':'reduce','costs':'reduce','problems':'address','challenges':'address','habits':'develop','methods':'use','techniques':'apply','facilities':'improve','activities':'organise','courses':'take','jobs':'create','plants':'protect','animals':'protect','species':'protect','languages':'preserve'}
  count={'school':'attend','institution':'establish','university':'attend','course':'take','programme':'develop','program':'develop','policy':'implement','system':'improve','plan':'develop','strategy':'develop','habit':'develop','skill':'develop','opportunity':'create','problem':'address','challenge':'address','risk':'reduce','barrier':'remove','gap':'narrow','degree':'earn','qualification':'obtain','agreement':'sign','project':'fund','service':'provide','facility':'build','site':'visit','destination':'visit','source':'identify','report':'write','article':'write','newspaper':'read','book':'read','film':'produce','movie':'produce','market':'enter','industry':'support','relationship':'build','community':'support','environment':'protect','habitat':'protect','language':'learn','culture':'understand','value':'recognise','role':'play','effect':'assess','impact':'assess','issue':'address','concern':'address','threat':'address','trend':'examine','sense':'develop','example':'give','factor':'examine','vehicle':'use','car':'drive','device':'use','robot':'develop','resource':'conserve','district':'visit','neighbourhood':'improve','neighborhood':'improve','form':'use','activity':'organise','event':'organise','fund':'establish','initiative':'support','rule':'follow','rulebook':'follow','tax':'levy','law':'enforce','leader':'support','citizen':'support','employee':'support','worker':'recruit','student':'teach','group':'support','organisation':'establish','organization':'establish','agency':'establish','department':'establish','union':'join','company':'establish','business':'support','factory':'build','centre':'build','center':'build','park':'visit','garden':'maintain','area':'protect','zone':'establish','space':'create','building':'preserve','product':'develop','material':'use','diet':'follow','lifestyle':'adopt','ability':'develop','capacity':'expand','disaster':'prepare for','journey':'plan','trip':'plan','tour':'take','burden':'reduce'}
  v=mass.get(head) or plural.get(head) or count.get(head)
  if v:
   phrase=word
   if head in count and not re.match(r"^(?:a|an|the|my|our|their|his|her|this|that|one's)\b",low):phrase=('an ' if low[0] in 'aeiou' else 'a ')+word
   patterns.append(v+' '+phrase)
   if head in count:notes.append('这里的中心词 '+head+' 是单数可数名词；独立使用时通常需加 a / an、the 或所有格，也可按语境改成复数。')
 if not patterns and kind!='sentence':patterns.append(word)
 for regex,p,n in rules:
  if re.search(regex,low):
   if p not in patterns:patterns.append(p)
   if n not in notes:notes.append(n)
 # Retain the full sentence; add component-level guides separately in the UI.
 if kind=='sentence' and not patterns:patterns.append('完整句子的主语 + 谓语 + 补充信息')
 result=dict(kind=kind,pattern=pattern,collocations=patterns[:5],notes=notes[:6])
 translations={
 'transport to school':'上学交通；前往学校的交通安排','school bullying':'校园欺凌','be more proficient at life skills':'更加熟练地掌握生活技能','socialise with people from a wider range of age groups':'与更广泛年龄段的人交往','save time and energy':'节省时间和精力','adjust lesson plans':'调整教学计划','replay the audio or video':'重播音频或视频','have an abundance of resources':'拥有丰富的资源','ensure learning efficiency':'确保学习效率',"answer students' questions in a timely way":'及时解答学生的问题','provide motivation for learning':'提供学习动力','rules of nature':'自然规律','boost brain activities and promote intelligence':'促进脑部活动和智力发展','become competitive in the workplace':'在职场中变得有竞争力','appreciate the different aspects of life at present':'理解或欣赏当下生活的不同方面',"imitate children's favorite characters":'模仿孩子喜欢的角色','improve problem-solving abilities and creativity':'提高解决问题的能力和创造力','teamwork and collaboration':'团队合作与协作','become addicted':'变得上瘾；沉迷','stay focused':'保持专注','distinguish the virtual from the real':'区分虚拟与现实','provide inappropriate and incorrect examples of language':'提供不恰当或错误的语言示例','lead to eyestrain':'导致眼疲劳','the improvement of medical and health care as well as the increased cure rate of diseases':'医疗保健的改善及疾病治愈率的提高','be reluctant to give birth':'不愿生育','have good manners':'举止有礼','financial skills':'理财技能','school-related expenses':'上学相关开销','quality time':'优质相处时间','physical disabilities':'身体残疾','learning disabilities':'学习障碍','be more open-minded and tolerant of different ideas':'更加开放并包容不同的想法'}
 if low in translations:result['meaning']=translations[low]
 ex=example_for(e)
 if ex:result['example']=ex
 return result
entries={e['id']:e for e in [*base['vocabulary'],*course['legacyExpressions'],*base['lessons'],*course['expressions']]}
usage={id:guide(e) for id,e in entries.items()}
assert all(u['pattern'] and u['collocations'] and u['notes'] for u in usage.values())
assert all(e['word'].lower() in lex for e in entries.values() if len(e['word'].split())==1)
result=dict(entries=usage,meta=dict(entries=len(usage),examples=sum('example' in u for u in usage.values()),lexicalNotes=len(lex)))
(D/'usage.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(result['meta'])
# Unclassified noun candidates are printed only when manually auditing the build.
