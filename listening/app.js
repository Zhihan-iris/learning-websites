import { STORAGE_KEY, emptyProgress, loadProgress, startSession, submitAnswer, advance, checkSynonymAnswers } from './core.js?v=settings-1';
import { buildSynonymGroups, migrateSynonymProgress } from './synonyms.js?v=settings-1';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let data, progress, byId, view = 'practice', showAllMistakes = false, pageLimit = 60;
let speechToken = 0, currentSpeech, speechTimeout;
let synonymGroups = [];
const waveform = label => `<button class="wave-icon" type="button" data-action="play" aria-label="${label}">${'<span aria-hidden="true"></span>'.repeat(7)}</button>`;
const repairGoal = () => progress.session?.repairGoal || progress.settings.repairGoal;
const repetitions = count => `<div class="repair-count" aria-label="已正确默写 ${count} 遍，共 ${repairGoal()} 遍">${Array.from({ length: repairGoal() }, (_, i) => `<span class="${i < count ? 'done' : ''}">${i < count ? '✓' : i + 1}</span>`).join('')}</div>`;
const currentWord = () => byId.get(progress.session?.ids[progress.session.index]);
const active = () => progress.session && progress.session.phase !== 'complete';
const pendingIds = () => Object.keys(progress.mistakes).filter(id => !progress.mistakes[id].resolved);
const sceneName = id => data.scenes.find(s => s.id === id)?.name || '全部分类';
const currentBook = () => data.books.find(b => b.id === progress.settings.book);
const bookName = id => data.books.find(b => b.id === id)?.name || '场景词汇';
const bookWords = () => data.words.filter(w => w.book === progress.settings.book);
const bookScenes = () => data.scenes.filter(s => s.book === progress.settings.book);
const sourceLabel = w => `${bookName(w.book)} · ${w.group} · PDF 第 ${w.sourcePages.join('、')} 页`;
function answerDetails(w) {
  if (w.kind === 'synonym-group') return synonymStudyList(w);
  return `${w.ipa ? `<div class="ipa" lang="en">${escape(w.ipa)}</div>` : ''}${w.counterpart ? `<div class="paraphrase"><span>题目表达</span><strong lang="en">${escape(w.counterpart)}</strong><span>对应原文表达（结合题目语境）</span><strong lang="en">${escape(w.original)}</strong></div>` : ''}`;
}
function renderBooks() {
  $('#book-shelf').innerHTML = data.books.map((b, i) => `<button class="book-card ${b.id === progress.settings.book ? 'selected' : ''}" data-book="${b.id}" aria-pressed="${b.id === progress.settings.book}"><span class="book-top"><span>${b.tag}</span><span>0${i + 1}</span></span><span class="book-title"><span>${b.icon}</span>${b.name}</span><span class="book-bottom">${data.words.filter(w => w.book === b.id).length} 个练习<span>↗</span></span></button>`).join('');
  $('#book-description').textContent = currentBook().description + (progress.settings.book === 'numbers' ? ' 本册提供答案；练习发音为英语合成语音。' : '');
}
function selectBook(book) {
  if (book === progress.settings.book) return;
  if (active() && !confirm('切换资料库会结束当前这一组。已保存的答题和错题记录会保留，是否继续？')) return;
  stopSpeech(); progress.session = null; progress.settings.book = book; progress.settings.scene = 'all'; pageLimit = 60; $('#search').value = '';
  refresh(); setView(view);
}
function warning(message) { $('#storage-warning').textContent = message; $('#storage-warning').hidden = false; }
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
  catch { warning('浏览器未能保存进度。你仍可以继续练习，但关闭或刷新后，新增记录可能丢失。请检查浏览器的存储设置。'); }
}
function stopSpeech() {
  speechToken++; clearTimeout(speechTimeout);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('.wave-icon')?.classList.remove('speaking'); currentSpeech = null;
}
function speak(entry) {
  if (entry === undefined) {
    entry = currentWord();
    if (entry?.kind === 'synonym-group') {
      const phase = progress.session?.phase;
      entry = ['question', 'repairing'].includes(phase) ? entry.cue : `${entry.cue}. ${entry.speechText}`;
    }
  }
  if (!entry) return;
  const word = typeof entry === 'string' ? entry : (entry.speechText || entry.word);
  stopSpeech();
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    $('#audio-status').textContent = '当前浏览器不支持朗读，请换用支持语音的 Chrome、Edge 或 Safari。'; return;
  }
  const token = speechToken;
  const voices = speechSynthesis.getVoices();
  const accent = progress.settings.accent;
  const english = voices.filter(v => /^en[-_]/i.test(v.lang));
  const chosen = english.find(v => v.lang.replace('_', '-') === accent && /Google|Microsoft|Samantha|Daniel/i.test(v.name)) || english.find(v => v.lang.replace('_', '-') === accent) || english[0];
  const utterance = new SpeechSynthesisUtterance(word);
  currentSpeech = utterance; // Keep a reference until onend (some browsers otherwise stop early).
  if (chosen) utterance.voice = chosen;
  utterance.lang = chosen?.lang || accent; utterance.rate = progress.settings.rate; utterance.volume = progress.settings.volume;
  utterance.onstart = () => {
    if (token !== speechToken) return;
    clearTimeout(speechTimeout); $('.wave-icon')?.classList.add('speaking');
    $('#audio-status').textContent = chosen ? `${chosen.name} · ${chosen.lang}${chosen.lang.replace('_', '-') !== accent ? '（设备可用口音）' : ''}` : '正在朗读 · 设备默认英语语音';
  };
  utterance.onend = () => { if (token === speechToken) { $('.wave-icon')?.classList.remove('speaking'); currentSpeech = null; } };
  utterance.onerror = event => {
    if (token !== speechToken || ['canceled', 'interrupted'].includes(event.error)) return;
    clearTimeout(speechTimeout); $('.wave-icon')?.classList.remove('speaking');
    $('#audio-status').textContent = '发音未能播放。请点击重播；若仍无声音，请检查音量、网络和设备的英语语音包。';
  };
  speechTimeout = setTimeout(() => { if (token === speechToken) $('#audio-status').textContent = '还没有播放声音？请点击重播，并检查设备是否已安装英语语音。'; }, 10000);
  speechSynthesis.speak(utterance);
}
function filteredWords() { return bookWords().filter(w => progress.settings.scene === 'all' || w.scene === progress.settings.scene); }
function renderStats() {
  $('#mastered').innerHTML = `${progress.mastered.length}<small> / ${data.words.length}</small>`;
  $('#accuracy').innerHTML = `${progress.attempts ? Math.round(progress.correct / progress.attempts * 100) : '—'}<small> %</small>`;
  $('#pending').innerHTML = `${pendingIds().length}<small> 个</small>`;
  $('#mistake-badge').textContent = pendingIds().length;
}
function renderScenes() {
  $('#scenes').innerHTML = [{ id: 'all', name: '全部分类', icon: '◫' }, ...bookScenes()].map(s => `<button class="scene-button ${progress.settings.scene === s.id ? 'selected' : ''}" data-scene="${s.id}" ${active() ? 'disabled' : ''} ${progress.settings.scene === s.id ? 'aria-current="true"' : ''}><span class="scene-symbol">${s.icon}</span>${s.name}<small>${s.id === 'all' ? bookWords().length : data.words.filter(w => w.scene === s.id).length}</small></button>`).join('');
  $('#scene-total').textContent = bookScenes().length;
  $('#session-scene').innerHTML = `<option value="all">全部分类 · ${bookWords().length} 题</option>${bookScenes().map(s => `<option value="${s.id}">${s.name}</option>`).join('')}`;
  $('#session-scene').value = progress.settings.scene;
  $('#session-size').value = progress.settings.size;
  $('#shuffle').checked = progress.settings.shuffle;
  $('#accent').value = progress.settings.accent;
  $('#rate').value = progress.settings.rate;
  $('#volume').value = Math.round(progress.settings.volume * 100);
  $('#volume-value').textContent = `${Math.round(progress.settings.volume * 100)}%`;
  $('#repairGoal').value = progress.settings.repairGoal;
  for (const selector of ['#session-scene', '#session-size', '#shuffle']) $(selector).disabled = !!active();
  $('#settings-note').textContent = active() ? '本组进度已保存。完成或结束本组后，可调整练习范围。' : '完成一组，再向前一步。';
}
function focusAnswer() { if (view === 'practice') $('#answer')?.focus({ preventScroll: true }); }
function answerForm(repair = false) {
  const w = currentWord();
  const isNumber = w.book === 'numbers';
  return `<form id="answer-form" autocomplete="off"><label class="input-label" for="answer">${repair ? `第 ${progress.session.repeats + 1} / ${repairGoal()} 遍 · 根据发音和释义默写` : (isNumber ? '写下你听到的数字、字母或信息' : '写下你听到的单词或短语')}</label><div class="input-wrap"><input id="answer" class="answer-input" type="text" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" inputmode="${w.kind === 'phone' ? 'tel' : 'text'}" enterkeyhint="done" placeholder="${isNumber ? '在这里输入听到的信息…' : '在这里输入英文…'}" aria-describedby="input-error" maxlength="200"></div><p id="input-error" class="inline-error" role="status"></p><div class="submit-row"><button type="button" data-action="play" class="text-button">↻ 再听一次</button><button type="submit" class="primary">检查拼写 <kbd>Enter ↵</kbd></button></div></form>`;
}
function synonymStudyList(w) {
  return `<div class="synonym-study-list">${w.answers.map((a,i)=>`<div class="synonym-study-item"><div class="synonym-term"><strong lang="en">${escape(a.word)}</strong><button type="button" class="row-audio" data-pronounce="${escape(a.speechText)}" aria-label="朗读 ${escape(a.word)}">♪</button></div><p>${escape(a.meaning)}</p><small>${a.contexts.map(c=>`${escape(c.group)} · ${escape(c.meaning)} · PDF 第 ${c.sourcePages.join('、')} 页`).join('<br>')}</small></div>`).join('')}</div>`;
}
function synonymForm(w, repair = false) {
  return `<form id="answer-form" novalidate class="synonym-form"><p class="synonym-input-note">写出学习页中的 ${w.answers.length} 个对应表达，每格一个，顺序不限。</p>${w.answers.map((_,i)=>`<label for="${i ? 'answer-'+i : 'answer'}">对应表达 ${i+1}</label><input id="${i ? 'answer-'+i : 'answer'}" name="synonymAnswer" type="text" autocomplete="off" spellcheck="false" autocorrect="off" autocapitalize="none" maxlength="200" placeholder="${repair ? '再次默写对应表达…' : '回想刚刚学过的表达…'}" aria-describedby="input-error">`).join('')}<p id="input-error" class="inline-error" role="status"></p><div class="submit-row"><button type="button" data-action="play" class="text-button">↻ 朗读题目表达</button><button type="submit" class="primary">检查整组 <kbd>Enter ↵</kbd></button></div></form>`;
}
function renderSynonymExercise(w, s, source, exit) {
  const cue = `<div class="synonym-cue"><span>题目表达</span><strong lang="en">${escape(w.cue)}</strong><button type="button" class="text-button" data-pronounce="${escape(w.cue)}" aria-label="朗读题目表达">♪ 听题目发音</button></div>`;
  const notice = '<p class="synonym-context-note">以下是资料原题语境中的对应表达，不表示在任何语境下都能互换。</p>';
  if (s.phase === 'study') return `<div class="group-note">LEARN THE CONNECTION · 先学习这一组</div><h2>先建立联系，再默写。</h2>${cue}${synonymStudyList(w)}${notice}<button class="primary wide" data-action="advance">我记住了，隐藏答案开始默写 <kbd>Enter ↵</kbd></button>${source}${exit}`;
  if (s.phase === 'question' || s.phase === 'repairing') return `<div class="group-note">${s.phase === 'repairing' ? '每组全部写对，计入一次巩固' : 'RECALL THE CONNECTION · 回想对应表达'}</div><h2>它有哪些对应表达？</h2>${cue}${s.phase === 'repairing' ? repetitions(s.repeats) : ''}${synonymForm(w,s.phase === 'repairing')}<p class="keyboard-note">重播只读题目，不揭晓答案。${s.phase === 'repairing' ? '整组每写对一遍，会再读一遍答案。' : ''}</p>${exit}`;
  const error=['mistake','repair-error'].includes(s.phase), repaired=s.phase==='repaired';
  const checked=error?checkSynonymAnswers(s.lastAnswer || progress.mistakes[w.id]?.lastAnswer || '',w):null;
  return `<div class="feedback-tag ${error?'error':''}">${error?(s.phase==='mistake'?'有错漏 · 已加入错题本':'还有错漏 · 本次不计数'):(repaired?`✓ 已完成 ${repairGoal()} 遍整组默写`:'✓ 整组正确，听一遍加深记忆')}</div>${cue}${checked?`<div class="synonym-check"><p>已正确回忆 ${checked.matched.length} / ${w.answers.length} 个表达</p>${checked.missing.length?`<p>还需记住：<strong lang="en">${checked.missing.map(a=>escape(a.word)).join('；')}</strong></p>`:''}${checked.unexpected.length?`<p>未匹配到本组 / 重复填写：${checked.unexpected.map(escape).join('；')}</p>`:''}</div>`:''}${synonymStudyList(w)}${notice}<button class="text-button" data-pronounce="${escape(w.speechText)}">♪ 再读一遍对应表达</button>${error||repaired?repetitions(s.repeats):''}<button class="primary wide" data-action="advance">${error?'隐藏答案，'+(s.phase==='mistake'?`整组默写 ${repairGoal()} 遍`:'继续默写'):(s.index+1===s.ids.length?'查看本组结果':'学习下一组')} <kbd>Enter ↵</kbd></button>${source}${exit}`;
}
function renderExercise() {
  const s = progress.session;
  const area = $('#exercise');
  if (!s) {
    const count = Math.min(filteredWords().length, progress.settings.size || Infinity);
    $('#current-scene').textContent = `${currentBook().name} · ${sceneName(progress.settings.scene)}`;
    $('#question-count').textContent = '准备开始'; $('#progress-fill').style.width = '0%';
    area.innerHTML = `<div class="group-note">把注意力，交给耳朵</div>${waveform('开始练习并播放第一个单词')}<h2>${progress.settings.book === 'synonyms' ? '先学一组，再回想它们。' : '听见，然后写下来。'}</h2><p class="prompt">${escape(currentBook().description)}<br>${progress.settings.book === 'synonyms' ? '隐藏对应表达后逐项默写，整组写对才通过。' : `答对再听一遍，答错默写 ${progress.settings.repairGoal} 遍；每写对一遍都会朗读。`}</p><div class="idle-meta"><span>◷ ${count} 道练习</span><span>◈ ${sceneName(progress.settings.scene)}</span></div><button class="primary wide" data-action="start">开始今日练习 <kbd>Enter ↵</kbd></button><p class="keyboard-note">戴好耳机，给记忆一点专注的时间。</p>`;
    return;
  }
  const w = currentWord();
  $('#current-scene').textContent = `${s.review ? '错题复习 · ' : ''}${bookName(w.book)} · ${sceneName(w.scene)}`;
  $('#question-count').textContent = s.phase === 'complete' ? '本组完成' : `${String(s.index + 1).padStart(2, '0')} / ${String(s.ids.length).padStart(2, '0')}`;
  $('#progress-fill').style.width = `${(s.phase === 'complete' ? 1 : s.index / s.ids.length) * 100}%`;
  const source = `<div class="source-detail">${escape(sourceLabel(w))}</div>`;
  const exit = `<button class="text-button" data-action="end">结束本组</button>`;
  if (w.kind === 'synonym-group' && s.phase !== 'complete') {
    area.innerHTML = renderSynonymExercise(w, s, source, exit); return;
  }
  if (s.phase === 'complete') {
    area.innerHTML = `<div class="complete-icon">✧</div><h2>又前进了一小步。</h2><p class="prompt">本组 ${s.ids.length} 道练习已完成。每一次练习，都算数。</p><div class="session-summary"><div><strong>${s.correct}</strong><span>首次拼写正确</span></div><div><strong>${s.wrong}</strong><span>已完成错题巩固</span></div></div><button class="primary wide" data-action="new">再练一组 <kbd>Enter ↵</kbd></button><div style="margin-top:15px"><button class="text-button" data-action="mistakes">看看我的错题本 →</button><button class="text-button" data-action="choose">重新选择场景</button></div>`;
  } else if (s.phase === 'question') {
    area.innerHTML = `<div class="group-note">${escape(w.group)} · LISTEN & SPELL</div>${waveform('重播当前单词')}<h2>${w.book === 'numbers' ? '这条信息，你听清了吗？' : '这个表达，你听出来了吗？'}</h2><p class="prompt">${w.book === 'numbers' ? '电话保留前导 0；邮编不区分大小写；时间支持 24 小时制。' : w.book === 'synonyms' ? '听写原文表达，答后查看题目中的对应表达。' : '点击声波重播，输入答案后按回车。'}</p>${answerForm()}<div class="keyboard-note"><kbd>Alt</kbd> + <kbd>P</kbd> 重播发音 · 忽略大小写与首尾空格</div>${exit}`;
  } else if (s.phase === 'repairing') {
    area.innerHTML = `<div class="group-note">目标 ${repairGoal()} 遍，已完成 ${s.repeats} 遍</div>${waveform('重播正在巩固的单词')}<div class="repair-meaning">${escape(w.meaning)}</div>${repetitions(s.repeats)}${answerForm(true)}<p class="keyboard-note">只计入正确默写；中途刷新也会保留次数。</p>${exit}`;
  } else {
    const error = ['mistake', 'repair-error'].includes(s.phase);
    const repaired = s.phase === 'repaired';
    const tag = error ? (s.phase === 'mistake' ? '拼写错误 · 已加入错题本' : '还差一点 · 本次不计数') : (repaired ? `✓ 已完成 ${repairGoal()} 遍正确默写` : '✓ 拼写正确，记住它的意思');
    const label = error ? (s.phase === 'mistake' ? `开始 ${repairGoal()} 遍默写` : '隐藏拼写，继续默写') : (s.index + 1 === s.ids.length ? '查看本组结果' : '下一个单词');
    area.innerHTML = `<div class="feedback-tag ${error ? 'error' : ''}">${tag}</div><div class="answer-card ${error ? 'error' : ''}"><div class="answer-word" lang="en">${escape(w.word)}</div><div class="answer-meaning">${escape(w.meaning)}</div>${answerDetails(w)}${s.phase === 'mistake' ? `<div class="error-detail">你的拼写：${escape(progress.mistakes[w.id].lastAnswer)}</div>` : ''}<button data-action="play" class="text-button" aria-label="朗读正确单词">◖)) 听一遍正确发音</button></div>${error || repaired ? repetitions(s.repeats) : ''}<p class="prompt">${error ? '先记住正确拼写，准备好后按回车隐藏答案。' : repaired ? '认真写过的词，会慢慢成为你的词汇。' : '把声音、拼写和意思，连在一起。'}</p><button class="primary wide" data-action="advance">${label} <kbd>Enter ↵</kbd></button>${source}${exit}`;
  }
}
function setView(next) {
  stopSpeech(); view = next;
  for (const name of ['practice', 'mistakes', 'vocabulary']) $(`#${name}-view`).hidden = name !== view;
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'); });
  $('#page-name').textContent = { practice: '听音默写', mistakes: '我的错题本', vocabulary: '资料词库' }[view];
  $('#heading').innerHTML = { practice: '让听过的词，<span>真正记住。</span>', mistakes: '每个错词，<span>都是进步的起点。</span>', vocabulary: '翻开资料，<span>积累听力词汇。</span>' }[view];
  $('#subtitle').textContent = { practice: '从声音开始，在场景里积累。今天，也学会一点点。', mistakes: '错过的单词留在这里。完成设定次数后标记已巩固，记录依然保留。', vocabulary: `${currentBook().title} · ${bookWords().length} 道练习。搜索、听发音，查看资料中的释义。` }[view];
  if (view === 'practice') { renderExercise(); focusAnswer(); }
  if (view === 'mistakes') renderMistakes();
  if (view === 'vocabulary') renderVocabulary();
}
function renderMistakes() {
  $('#pending-tab').classList.toggle('selected', !showAllMistakes); $('#all-tab').classList.toggle('selected', showAllMistakes);
  const ids = Object.keys(progress.mistakes).filter(id => showAllMistakes || !progress.mistakes[id].resolved).sort((a, b) => progress.mistakes[b].count - progress.mistakes[a].count);
  $('#review-all').disabled = !ids.length;
  $('#mistake-list').innerHTML = ids.length ? `<div class="table-container"><table class="word-table"><thead><tr><th>单词 / 信息</th><th>释义与资料对照</th><th class="optional-col">记录</th><th>复习</th></tr></thead><tbody>${ids.map(id => { const w = byId.get(id), m = progress.mistakes[id]; return `<tr><td><span class="word" lang="en">${escape(w.word)}</span><div class="word-meta">${bookName(w.book)} · ${sceneName(w.scene)} · 曾写成 ${escape(m.lastAnswer)}</div></td><td>${escape(w.meaning)}<br><span class="tag ${m.resolved ? 'done' : ''}">${m.resolved ? '已巩固' : '待巩固'}</span></td><td class="optional-col">错 ${m.count} 次</td><td><button class="row-audio" data-speak="${id}" aria-label="朗读 ${escape(w.word)}">♪</button><button class="row-action" data-review="${id}">重练</button></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty-state"><span class="complete-icon">✧</span><h2>${showAllMistakes ? '还没有错词，开始探索吧。' : '暂时没有需要巩固的词。'}</h2><p>${showAllMistakes ? '拼写错误的词会自动收录在这里。' : '已巩固的词仍保存在「全部记录」中，可以随时复习。'}</p><button class="secondary" data-action="practice">返回听音默写</button></div>`;
}
function renderVocabulary() {
  const query = $('#search').value.trim().toLowerCase();
  const words = filteredWords().filter(w => w.word.toLowerCase().includes(query) || w.meaning.includes(query) || w.counterpart?.toLowerCase().includes(query) || w.original?.toLowerCase().includes(query));
  $('#vocabulary-count').textContent = `${sceneName(progress.settings.scene)} · ${words.length} 题`;
  $('#vocabulary-list').innerHTML = words.length ? `<div class="table-container"><table class="word-table"><thead><tr><th>单词 / 信息</th><th>释义与资料对照</th><th class="optional-col">场景</th><th>发音</th></tr></thead><tbody>${words.slice(0, pageLimit).map(w => `<tr><td><span class="word" lang="en">${escape(w.word)}</span><div class="word-meta">${escape(sourceLabel(w))}</div></td><td>${escape(w.meaning)}${answerDetails(w)}</td><td class="optional-col">${sceneName(w.scene)}</td><td><button class="row-audio" data-speak="${w.id}" aria-label="朗读 ${escape(w.word)}">♪</button></td></tr>`).join('')}</tbody></table></div>${words.length > pageLimit ? '<div class="pagination"><button class="secondary" data-action="more">加载更多词汇 ↓</button></div>' : ''}` : '<div class="empty-state"><h2>没有找到这个词</h2><p>试试更短的关键词，或选择其他场景。</p></div>';
}
function refresh() { renderStats(); renderBooks(); renderScenes(); renderExercise(); save(); }
function begin(ids, review = false) {
  if (active() && !confirm('结束当前这一组并开始新练习？已完成的答题和错题记录会保留，当前这一组的练习进度会结束。')) return;
  stopSpeech();
  if (!ids) {
    let words = filteredWords();
    // Start with words not yet answered correctly; keep the source order within each group.
    words = [...words.filter(w => !progress.mastered.includes(w.id)), ...words.filter(w => progress.mastered.includes(w.id))];
    if (progress.settings.shuffle) for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
    ids = words.slice(0, progress.settings.size || words.length).map(w => w.id);
  }
  startSession(progress, ids, review, byId.get(ids[0])); refresh(); setView('practice'); speak(); focusAnswer();
}
function next() { if (!advance(progress, byId.get(progress.session?.ids[progress.session.index+1]))) return; stopSpeech(); refresh(); if (['study', 'question', 'repairing'].includes(progress.session.phase)) speak(); focusAnswer(); }
function action(name) {
  if (name === 'start' || name === 'new') begin();
  if (name === 'play') progress.session ? speak() : begin();
  if (name === 'advance') next();
  if (name === 'mistakes' || name === 'practice') setView(name);
  if (name === 'choose') { progress.session = null; refresh(); $('#session-scene').focus(); }
  if (name === 'end' && confirm('结束本组练习？已经保存的答题和错题记录会保留；当前词的重写进度会结束。')) { stopSpeech(); progress.session = null; refresh(); }
  if (name === 'more') { pageLimit += 60; renderVocabulary(); }
}
async function init() {
  try {
    const responses = await Promise.all(['vocabulary.json', 'additional-books.json'].map(file => fetch(`./data/${file}?v=2`)));
    if (responses.some(r => !r.ok)) throw new Error('词库加载失败');
    const [base, extra] = await Promise.all(responses.map(r => r.json()));
    data = { books: extra.books, scenes: [...base.scenes.map(s => ({...s, book: 'scenes'})), ...extra.scenes], words: [...base.words.map(w => ({...w, book: 'scenes'})), ...extra.words] };
    synonymGroups = buildSynonymGroups(data.words);
    data.rawWords = data.words;
    data.words = [...data.words.filter(w => w.book !== 'synonyms'), ...synonymGroups];
    data.books.find(b => b.id === 'synonyms').description = '先学题目表达及其对应表达，再隐藏答案，整组默写。';
    byId = new Map(data.words.map(w => [w.id, w]));
  } catch {
    $('#exercise').innerHTML = '<div class="empty-state"><h2>词库暂时未能加载</h2><p>请检查网络后刷新。若是本地运行，请通过 HTTP 服务打开网站。</p><button class="primary" onclick="location.reload()">重新加载</button></div>'; return;
  }
  try {
    progress = loadProgress(localStorage.getItem(STORAGE_KEY), [...data.rawWords, ...synonymGroups]);
    if (migrateSynonymProgress(progress, synonymGroups)) warning('同义替换已升级为分组记忆。历史答题与错题记录已保留，当前练习从学习页继续。');
    save();
  }
  catch { progress = emptyProgress(); warning('未能读取原来的学习记录。已开始新的练习；如果浏览器禁止存储，记录将无法持久保存。'); }
  renderStats(); renderBooks(); renderScenes(); renderExercise(); focusAnswer();
  if (!('speechSynthesis' in window)) $('#audio-status').textContent = '当前浏览器不支持发音，请使用支持语音的 Chrome、Edge 或 Safari。';
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.book) selectBook(b.dataset.book);
    if (b.dataset.view) setView(b.dataset.view);
    if (b.dataset.action) action(b.dataset.action);
    if (b.dataset.scene) { progress.settings.scene = b.dataset.scene; save(); renderScenes(); if (view === 'vocabulary') renderVocabulary(); else { setView('practice'); renderExercise(); } }
    if (b.dataset.speak) speak(byId.get(b.dataset.speak));
    if (b.dataset.pronounce) speak(b.dataset.pronounce);
    if (b.dataset.review) begin([b.dataset.review], true);
  });
  $('#exercise').addEventListener('submit', event => {
    event.preventDefault();
    const w = currentWord();
    const answer = w.kind === 'synonym-group' ? [...event.target.querySelectorAll('[name=synonymAnswer]')].map(el => el.value) : $('#answer').value;
    if (!(Array.isArray(answer) ? answer.some(a => a.trim()) : answer.trim())) { $('#input-error').textContent = '先写下你的答案，再按回车。'; return; }
    const beforeRepeats = progress.session.repeats;
    progress.session.lastAnswer = Array.isArray(answer) ? answer.join('；') : answer;
    const result = submitAnswer(progress, w, answer);
    stopSpeech(); refresh();
    if (result === 'correct' || progress.session.repeats > beforeRepeats) speak(w.speechText || w.word);
    focusAnswer();
  });
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.repeat) return;
    if (event.altKey && event.code === 'KeyP') { event.preventDefault(); if (view === 'practice') speak(); return; }
    if (event.key !== 'Enter' || view !== 'practice') return;
    if (event.target.matches('input,select,textarea,button,a')) return;
    event.preventDefault();
    if (!progress.session || progress.session.phase === 'complete') begin(); else next();
  });
  // Prevent IME confirmation and held Enter from accidentally submitting/advancing.
  $('#exercise').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.isComposing || event.repeat)) event.preventDefault(); });
  for (const [selector, key, convert] of [['#session-scene', 'scene', String], ['#session-size', 'size', Number], ['#accent', 'accent', String], ['#rate', 'rate', Number]]) {
    $(selector).addEventListener('change', event => { progress.settings[key] = convert(event.target.value); save(); renderScenes(); if (['scene', 'size'].includes(key)) renderExercise(); });
  }
  $('#volume').addEventListener('input', event => { progress.settings.volume = Number(event.target.value) / 100; $('#volume-value').textContent = `${event.target.value}%`; save(); });
  $('#repairGoal').addEventListener('change', event => { progress.settings.repairGoal = Number(event.target.value); save(); if (!active()) renderExercise(); });
  $('#shuffle').addEventListener('change', event => { progress.settings.shuffle = event.target.checked; save(); });
  $('#pending-tab').onclick = () => { showAllMistakes = false; renderMistakes(); };
  $('#all-tab').onclick = () => { showAllMistakes = true; renderMistakes(); };
  $('#review-all').onclick = () => begin(showAllMistakes ? Object.keys(progress.mistakes) : pendingIds(), true);
  $('#search').addEventListener('input', () => { pageLimit = 60; renderVocabulary(); });
  window.addEventListener('pagehide', () => { stopSpeech(); save(); });
}
init();
