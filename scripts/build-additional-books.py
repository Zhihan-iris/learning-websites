"""Build practice entries from the three PDFs' extracted tables (stdlib only)."""
import json,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
raw=json.loads((root/'data/additional-source-entries.json').read_text())
books=[
 {'id':'scenes','name':'场景词汇','title':'雅思听力场景词汇','tag':'CONTEXT','icon':'◈','description':'15 个生活与学术场景，听音记词。'},
 {'id':'synonyms','name':'同义替换','title':'剑10–剑20听力同义替换词','tag':'PARAPHRASE','icon':'⇄','description':'听写原文表达，答后对照题目表达与释义。'},
 {'id':'numbers','name':'数字与信息','title':'数字练习答案','tag':'NUMBERS','icon':'#','description':'电话、邮编、地址、人名、日期与时间。'},
 {'id':'gapfill','name':'填空考点词','title':'雅思听力填空考点词','tag':'GAP FILL','icon':'✎','description':'高频填空词汇，附资料音标与常用义。'}]
words=[];scenes=[]
def uid(key):return hashlib.sha1(key.encode()).hexdigest()[:12]
for n in range(10,21):scenes.append({'id':f'syn-{n}','name':f'剑桥 {n}','english':f'Cambridge {n}','icon':'⇄','book':'synonyms'})
for row in raw['synonyms']:
 variants=re.split(r'\s*[=/]\s*',row['original'])
 if row['original']=='work out the average/standard deviation':variants=['work out the average','work out the standard deviation']
 for i,v in enumerate(variants):
  word=re.sub(r'\bsth\.', 'something',re.sub(r'\bsb\.', 'somebody',v)).strip()
  words.append({'id':uid('syn|'+json.dumps(row,ensure_ascii=False)+f'|{i}'),'word':word,'speechText':re.sub(r'\.{2,}','; ',word),'meaning':row['meaning'],'scene':f"syn-{row['book']}",'book':'synonyms','kind':'synonym','group':f"剑{row['book']} · {row['reference']} · 第{row['question']}题",'sourcePages':[row['page']],'counterpart':row['prompt'],'original':row['original']})
letters=[('A–D','abcd'),('E–H','efgh'),('I–L','ijkl'),('M–P','mnop'),('Q–T','qrst'),('U–Z','uvwxyz')]
for i,(label,_) in enumerate(letters):scenes.append({'id':f'gap-{i}','name':f'{label} 填空词','english':'Gap-fill vocabulary','icon':'✎','book':'gapfill'})
seen={}
for row in raw['gapfill']:
 word=row['word'];answers=[word]
 if word=='driving license/licence':answers=['driving license','driving licence']
 elif '/' in word:answers=word.split('/')
 elif word=='zoom (lens)':answers=['zoom lens','zoom']
 word=answers[0];key=word.lower()
 if key in seen:
  old=seen[key];old['sourcePages'].append(row['page'])
  if row['meaning'] not in old['meaning']:old['meaning']+='；'+row['meaning']
  continue
 idx=next(i for i,(_,chars) in enumerate(letters) if word[0].lower() in chars)
 item={'id':uid('gap|'+key),'word':word,'acceptedAnswers':answers,'meaning':row['meaning'],'ipa':row['ipa'],'book':'gapfill','scene':f'gap-{idx}','group':letters[idx][0]+' · 填空考点词','sourcePages':[row['page']]}
 seen[key]=item;words.append(item)
labels={**{f'phone{i}':f'电话号码 · Level {i}' for i in range(1,7)},'postcode':'邮编','address':'地址','name':'人名拼写','date':'日期','time':'时间'}
for k,label in labels.items():scenes.append({'id':'num-'+k,'name':label,'english':'Information dictation','icon':'#','book':'numbers'})
digits=['zero','one','two','three','four','five','six','seven','eight','nine']
small=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
def number(n):return small[n] if n<20 else ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'][n//10]+(' '+small[n%10] if n%10 else '')
ordinals=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth','twenty first','twenty second','twenty third','twenty fourth','twenty fifth','twenty sixth','twenty seventh','twenty eighth','twenty ninth','thirtieth','thirty first']
months=['January','February','March','April','May','June','July','August','September','October','November','December']
def spell(s):return ', '.join(digits[int(c)] if c.isdigit() else c.upper() for c in s if c.isalnum())
def speak_time(s):
 h,m,period=re.fullmatch(r'(\d+)\.(\d+)\s*(am|pm)',s.strip(),re.I).groups()
 return number(int(h))+(' '+number(int(m)) if int(m) else '')+' '+('A M' if period.lower()=='am' else 'P M')
for row in raw['numbers']:
 k=row['category'];word=row['answer'];kind='phone' if k.startswith('phone') else k
 item={'id':uid(f"num|{k}|{row['question']}"),'word':word,'scene':'num-'+k,'book':'numbers','kind':kind,'group':f"{labels[k]} · 第 {row['question']} 题",'sourcePages':[row['page']]}
 if kind=='phone':item.update(speechText=spell(word),meaning='电话号码 · 逐位输入，保留开头的 0')
 elif kind=='postcode':item.update(speechText=spell(word),meaning='邮编 · 字母和数字组合，注意 O 与 0')
 elif kind=='name':item.update(speechText=spell(word),meaning='人名 · 根据字母拼读写出姓名')
 elif kind=='address':item.update(speechText=re.sub(r'\bno\.?\s*','number ',word,flags=re.I),meaning='地址 · 门牌号 + 街道名称')
 elif kind=='date':
  match=re.fullmatch(r'(\d+)(?:st|nd|rd|th) (\w+)',word);day=int(match[1]);month=match[2];mi=months.index(month)+1
  item.update(speechText=f'the {ordinals[day]} of {month}',meaning=f'日期 · {mi} 月 {day} 日',acceptedAnswers=[word,f'{day} {month}',f'{month} {day}',f'{month} {match[1]}'+word[len(match[1]):word.index(' ')],f'{day} {month[:3]}',f'{month[:3]} {day}',f'{day}/{mi}',f'{day:02}/{mi:02}'])
 else:
  item.update(speechText=' to '.join(speak_time(t) for t in word.split('-')),meaning='时间 · 可用 am/pm 或 24 小时制，范围用连字符连接')
 words.append(item)
assert len({w['id'] for w in words})==len(words)
json.dump({'books':books,'scenes':scenes,'words':words,'sourceRows':{k:len(v) for k,v in raw.items()}},open(root/'data/additional-books.json','w'),ensure_ascii=False,indent=2)
print('Original records', {k:len(v) for k,v in raw.items()})
print('Practice entries', {b['id']:sum(w['book']==b['id'] for w in words) for b in books if b['id']!='scenes'})
