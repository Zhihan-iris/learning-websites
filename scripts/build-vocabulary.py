import json,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
rows=json.load(open(root/'data/source-entries.json'))
# PDF page numbers, section positions; retained to make every entry traceable.
scenes=[('rent','租房住宿','House & home','⌂',2,0),('travel','旅行出行','Travel & leisure','↗',4,223),('membership','会员与运动','Clubs & sports','◎',6,208),('car','汽车','On the road','◇',7,350),('bank','银行业务','Everyday banking','▤',7,600),('course','课程与校园','Campus life','▥',9,173),('assignment','作业与研究','Study & research','✎',12,225),('library','图书馆','At the library','▧',13,474),('facilities','大学设施','College facilities','⊞',14,515),('economics','经济','Economics','↗',15,0),('biology','生物','Biology','❋',16,0),('agriculture','农业','Agriculture','♧',17,0),('environment','环境','Environment','◉',18,0),('geography','地理','Geography','◈',19,200),('chemistry','化学','Chemistry','⌬',20,0)]
heads={2:[(0,'人物'),(356,'费用'),(527,'位置')],3:[(0,'住宿'),(307,'饮食'),(434,'区域'),(680,'家具')],4:[(0,'家具'),(272,'旅游安排'),(404,'旅游景点')],5:[(0,'娱乐'),(462,'活动'),(645,'交通')],6:[(0,'交通'),(265,'分区'),(449,'员工'),(575,'注册')],7:[(0,'运动'),(350,'汽车'),(652,'支付方式')],8:[(0,'开户业务'),(259,'开户'),(439,'货币')],9:[(0,'教育'),(382,'师资'),(595,'学生')],10:[(0,'课程安排'),(511,'文科学科')],11:[(0,'理科学科'),(270,'英语课程'),(407,'国家与地区')],12:[(0,'语言'),(277,'作业'),(468,'要求')],13:[(0,'方法论'),(304,'评估'),(522,'借阅')],14:[(0,'借阅'),(143,'书本情况'),(246,'设施'),(371,'流程'),(515,'大学设施')],15:[(0,'经济')],16:[(0,'生物')],17:[(0,'农业')],18:[(0,'环境')],19:[(0,'环境'),(200,'地理')],20:[(0,'化学')]}
expansions={
 'student adviser/advisor':['student adviser','student advisor'],
 'pay for contract/lease':['pay for contract','pay for lease'],
 'water/gas/electricity/ phone bill':['water bill','gas bill','electricity bill','phone bill'],
 'on a weekly/monthly/quarterly basis':['on a weekly basis','on a monthly basis','on a quarterly basis'],
 'special food/dietary requirement':['special food requirement','dietary requirement'],
 'fire gate/exit':['fire gate','fire exit'],
 'well/half/un-furnished':['well-furnished','half-furnished','unfurnished'],
 'air conditioner/conditioning':['air conditioner','air conditioning'],
 'historic(al) interest':['historic interest','historical interest'],
 'tennis/squash court':['tennis court','squash court'],
 'wheel (front, rear)':['front wheel','rear wheel'],
 'check (cheque)':['check','cheque'],
 'withdraw (withdrawal)':['withdraw','withdrawal'],
 'mature/adult students':['mature students','adult students'],
 'overseas/international students':['overseas students','international students'],
 'handout(s)':['handout','handouts'],
 'foundation/basic/elementary/ primary course':['foundation course','basic course','elementary course','primary course'],
 'secondary/intermediate course':['secondary course','intermediate course'],
 'Netherland/the Netherlands':['the Netherlands'],
 'data, statistics, figure':['data','statistics','figure'],
 'oral/written test':['oral test','written test'],
 'current/back issue':['current issue','back issue'],
 'borrowing/loan period':['borrowing period','loan period'],
 'management team/layers':['management team','management layers'],
 'mite(s)':['mite','mites'],'fin(s)':['fin','fins'],'pellet(s)':['pellet','pellets'],
 'plateau(x)':['plateau','plateaux'],
}
corrections={'four-wheel driver':('four-wheel drive','四轮驱动'),'stretchclass':('stretch class','拉伸训练课程'),'Biophysics':('Biophysics','生物物理学'),'photocopier':('photocopier','复印机'),'laser printer':('laser printer','激光打印机'),'nuclear power plants':('nuclear power plants','核电站')}
meanings={'landlord':'房东','landlady':'女房东','agent':'代理人；中介','agency':'中介机构','water bill':'水费账单','gas bill':'燃气费账单','electricity bill':'电费账单','phone bill':'电话费账单','on a weekly basis':'每周','on a monthly basis':'每月','on a quarterly basis':'每季度','well-furnished':'家具齐全的','half-furnished':'部分配备家具的','unfurnished':'未配备家具的','front wheel':'前轮','rear wheel':'后轮','tennis court':'网球场','squash court':'壁球场','rock climbing':'攀岩','cliff walks':'沿悬崖步行','current issue':'当期期刊','back issue':'过期期刊','dollar':'美元；元','pound':'英镑','euro':'欧元','oral test':'口试','written test':'笔试','Statistics':'统计学','humidity':'湿度','corporate':'公司的；企业的'}
words=[];seen={};changes=[]
for r in rows:
 scene=[s for s in scenes if (s[4],s[5]) <= (r['page'],r['y'])][-1]
 group=[h[1] for h in heads[r['page']] if h[0]<=r['y']][-1]
 raw=r['raw']; meaning=re.sub(r'(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])','',r['meaning'])
 meaning=meaning.replace('⼈','人').replace('⽣','生')
 if raw in corrections: corrected,meaning=corrections[raw];changes.append([raw,corrected,meaning]);variants=[corrected]
 else:variants=expansions.get(raw,[s.strip() for s in raw.split('/')])
 for word in variants:
  meaning2=meanings.get(word,meaning)
  key=scene[0]+'|'+word.lower()
  if key in seen:
   existing=seen[key]
   if r['page'] not in existing['sourcePages']:existing['sourcePages'].append(r['page'])
   continue
  item={'id':hashlib.sha1(key.encode()).hexdigest()[:12],'word':word,'meaning':meaning2,'scene':scene[0],'group':group,'sourcePages':[r['page']]}
  seen[key]=item;words.append(item)
(root/'data').mkdir(exist_ok=True)
json.dump({'source':'雅思听力场景词汇.pdf','sourceRows':len(rows),'scenes':[{'id':s[0],'name':s[1],'english':s[2],'icon':s[3]} for s in scenes],'words':words},open(root/'data/vocabulary.json','w'),ensure_ascii=False,indent=2)
json.dump(rows,open(root/'data/source-entries.json','w'),ensure_ascii=False,indent=2)
print(len(words),'words',len(scenes),'scenes');print(changes)
assert all(w['word'] and w['meaning'] and '/' not in w['word'] for w in words)
