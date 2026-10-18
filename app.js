import { STORAGE_KEY, emptyProgress, loadProgress, startSession, submitAnswer, advance } from './core.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let data, progress, byId, view = 'practice', showAllMistakes = false, pageLimit = 60;
let speechToken = 0, currentSpeech, speechTimeout;
const waveform = label => `<button class="wave-icon" type="button" data-action="play" aria-label="${label}">${'<span aria-hidden="true"></span>'.repeat(7)}</button>`;
const repetitions = count => `<div class="repair-count" aria-label="已正确默写 ${count} 遍，共 5 遍">${Array.from({ length: 5 }, (_, i) => `<span class="${i < count ? 'done' : ''}">${i < count ? '✓' : i + 1}</span>`).join('')}</div>`;
const currentWord = () => byId.get(progress.session?.ids[progress.session.index]);
const active = () => progress.session && progress.session.phase !== 'complete';
const pendingIds = () => Object.keys(progress.mistakes).filter(id => !progress.mistakes[id].resolved);
const sceneName = id => data.scenes.find(s => s.id === id)?.name || '全部场景';
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
function speak(word = currentWord()?.word) {
  if (!word) return;
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
  utterance.lang = chosen?.lang || accent; utterance.rate = progress.settings.rate;
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
function filteredWords() { return data.words.filter(w => progress.settings.scene === 'all' || w.scene === progress.settings.scene); }
function renderStats() {
  $('#mastered').innerHTML = `${progress.mastered.length}<small> / ${data.words.length}</small>`;
  $('#accuracy').innerHTML = `${progress.attempts ? Math.round(progress.correct / progress.attempts * 100) : '—'}<small> %</small>`;
  $('#pending').innerHTML = `${pendingIds().length}<small> 个</small>`;
  $('#mistake-badge').textContent = pendingIds().length;
}
function renderScenes() {
  $('#scenes').innerHTML = [{ id: 'all', name: '全部场景', icon: '◫' }, ...data.scenes].map(s => `<button class="scene-button ${progress.settings.scene === s.id ? 'selected' : ''}" data-scene="${s.id}" ${active() ? 'disabled' : ''} ${progress.settings.scene === s.id ? 'aria-current="true"' : ''}><span class="scene-symbol">${s.icon}</span>${s.name}<small>${s.id === 'all' ? data.words.length : data.words.filter(w => w.scene === s.id).length}</small></button>`).join('');
  $('#session-scene').value = progress.settings.scene;
  $('#session-size').value = progress.settings.size;
  $('#shuffle').checked = progress.settings.shuffle;
  $('#accent').value = progress.settings.accent;
  $('#rate').value = progress.settings.rate;
  for (const selector of ['#session-scene', '#session-size', '#shuffle']) $(selector).disabled = !!active();
  $('#settings-note').textContent = active() ? '本组进度已保存。完成或结束本组后，可调整练习范围。' : '完成一组，再向前一步。';
}
function focusAnswer() { requestAnimationFrame(() => { if (view === 'practice') $('#answer')?.focus({ preventScroll: true }); }); }
function answerForm(repair = false) {
  return `<form id="answer-form" autocomplete="off"><label class="input-label" for="answer">${repair ? `第 ${progress.session.repeats + 1} / 5 遍 · 根据发音和释义默写` : '写下你听到的单词或短语'}</label><div class="input-wrap"><input id="answer" class="answer-input" type="text" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" inputmode="text" enterkeyhint="done" placeholder="在这里输入英文…" aria-describedby="input-error" maxlength="200"></div><p id="input-error" class="inline-error" role="status"></p><div class="submit-row"><button type="button" data-action="play" class="text-button">↻ 再听一次</button><button type="submit" class="primary">检查拼写 <kbd>Enter ↵</kbd></button></div></form>`;
}
function renderExercise() {
  const s = progress.session;
  const area = $('#exercise');
  if (!s) {
    const count = Math.min(filteredWords().length, progress.settings.size || Infinity);
    $('#current-scene').textContent = sceneName(progress.settings.scene);
    $('#question-count').textContent = '准备开始'; $('#progress-fill').style.width = '0%';
    area.innerHTML = `<div class="group-note">把注意力，交给耳朵</div>${waveform('开始练习并播放第一个单词')}<h2>听见，然后写下来。</h2><p class="prompt">先听发音，再试着拼写。<br>答对揭晓释义，错词会陪你多练 5 遍。</p><div class="idle-meta"><span>◷ ${count} 个词</span><span>◈ ${sceneName(progress.settings.scene)}</span></div><button class="primary wide" data-action="start">开始今日练习 <kbd>Enter ↵</kbd></button><p class="keyboard-note">戴好耳机，给记忆一点专注的时间。</p>`;
    return;
  }
  const w = currentWord();
  $('#current-scene').textContent = `${s.review ? '错词复习 · ' : ''}${sceneName(w.scene)}`;
  $('#question-count').textContent = s.phase === 'complete' ? '本组完成' : `${String(s.index + 1).padStart(2, '0')} / ${String(s.ids.length).padStart(2, '0')}`;
  $('#progress-fill').style.width = `${(s.phase === 'complete' ? 1 : s.index / s.ids.length) * 100}%`;
  const source = `<div class="source-detail">${escape(w.group)} · PDF 第 ${w.sourcePages.join('、')} 页</div>`;
  const exit = `<button class="text-button" data-action="end">结束本组</button>`;
  if (s.phase === 'complete') {
    area.innerHTML = `<div class="complete-icon">✧</div><h2>又前进了一小步。</h2><p class="prompt">本组 ${s.ids.length} 个词已完成。每一次练习，都算数。</p><div class="session-summary"><div><strong>${s.correct}</strong><span>首次拼写正确</span></div><div><strong>${s.wrong}</strong><span>已完成 5 遍巩固</span></div></div><button class="primary wide" data-action="new">再练一组 <kbd>Enter ↵</kbd></button><div style="margin-top:15px"><button class="text-button" data-action="mistakes">看看我的错题本 →</button><button class="text-button" data-action="choose">重新选择场景</button></div>`;
  } else if (s.phase === 'question') {
    area.innerHTML = `<div class="group-note">${escape(w.group)} · LISTEN & SPELL</div>${waveform('重播当前单词')}<h2>这个词，你听出来了吗？</h2><p class="prompt">点击声波重播，输入答案后按回车。</p>${answerForm()}<div class="keyboard-note"><kbd>Alt</kbd> + <kbd>P</kbd> 重播发音 · 忽略大小写与首尾空格</div>${exit}`;
  } else if (s.phase === 'repairing') {
    area.innerHTML = `<div class="group-note">再写对 5 遍，让记忆更牢一点</div>${waveform('重播正在巩固的单词')}<div class="repair-meaning">${escape(w.meaning)}</div>${repetitions(s.repeats)}${answerForm(true)}<p class="keyboard-note">只计入正确默写；中途刷新也会保留次数。</p>${exit}`;
  } else {
    const error = ['mistake', 'repair-error'].includes(s.phase);
    const repaired = s.phase === 'repaired';
    const tag = error ? (s.phase === 'mistake' ? '拼写错误 · 已加入错题本' : '还差一点 · 本次不计入 5 遍') : (repaired ? '✓ 已完成 5 遍正确默写' : '✓ 拼写正确，记住它的意思');
    const label = error ? (s.phase === 'mistake' ? '开始 5 遍默写' : '隐藏拼写，继续默写') : (s.index + 1 === s.ids.length ? '查看本组结果' : '下一个单词');
    area.innerHTML = `<div class="feedback-tag ${error ? 'error' : ''}">${tag}</div><div class="answer-card ${error ? 'error' : ''}"><div class="answer-word" lang="en">${escape(w.word)}</div><div class="answer-meaning">${escape(w.meaning)}</div>${s.phase === 'mistake' ? `<div class="error-detail">你的拼写：${escape(progress.mistakes[w.id].lastAnswer)}</div>` : ''}<button data-action="play" class="text-button" aria-label="朗读正确单词">◖)) 听一遍正确发音</button></div>${error || repaired ? repetitions(s.repeats) : ''}<p class="prompt">${error ? '先记住正确拼写，准备好后按回车隐藏答案。' : repaired ? '认真写过的词，会慢慢成为你的词汇。' : '把声音、拼写和意思，连在一起。'}</p><button class="primary wide" data-action="advance">${label} <kbd>Enter ↵</kbd></button>${source}${exit}`;
  }
}
function setView(next) {
  stopSpeech(); view = next;
  for (const name of ['practice', 'mistakes', 'vocabulary']) $(`#${name}-view`).hidden = name !== view;
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'); });
  $('#page-name').textContent = { practice: '听音默写', mistakes: '我的错题本', vocabulary: '场景词库' }[view];
  $('#heading').innerHTML = { practice: '让听过的词，<span>真正记住。</span>', mistakes: '每个错词，<span>都是进步的起点。</span>', vocabulary: '一个场景，<span>一份词汇地图。</span>' }[view];
  $('#subtitle').textContent = { practice: '从声音开始，在场景里积累。今天，也学会一点点。', mistakes: '错过的单词留在这里。练过 5 遍后标记已巩固，记录依然保留。', vocabulary: `15 个场景，${data.words.length} 个单词与短语。找到它，听一听，再记住它。` }[view];
  if (view === 'practice') { renderExercise(); focusAnswer(); }
  if (view === 'mistakes') renderMistakes();
  if (view === 'vocabulary') renderVocabulary();
}
function renderMistakes() {
  $('#pending-tab').classList.toggle('selected', !showAllMistakes); $('#all-tab').classList.toggle('selected', showAllMistakes);
  const ids = Object.keys(progress.mistakes).filter(id => showAllMistakes || !progress.mistakes[id].resolved).sort((a, b) => progress.mistakes[b].count - progress.mistakes[a].count);
  $('#review-all').disabled = !ids.length;
  $('#mistake-list').innerHTML = ids.length ? `<div class="table-container"><table class="word-table"><thead><tr><th>单词 / 短语</th><th>中文释义</th><th class="optional-col">记录</th><th>复习</th></tr></thead><tbody>${ids.map(id => { const w = byId.get(id), m = progress.mistakes[id]; return `<tr><td><span class="word" lang="en">${escape(w.word)}</span><div class="word-meta">${sceneName(w.scene)} · 曾写成 ${escape(m.lastAnswer)}</div></td><td>${escape(w.meaning)}<br><span class="tag ${m.resolved ? 'done' : ''}">${m.resolved ? '已巩固' : '待巩固'}</span></td><td class="optional-col">错 ${m.count} 次</td><td><button class="row-audio" data-speak="${id}" aria-label="朗读 ${escape(w.word)}">♪</button><button class="row-action" data-review="${id}">重练</button></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty-state"><span class="complete-icon">✧</span><h2>${showAllMistakes ? '还没有错词，开始探索吧。' : '暂时没有需要巩固的词。'}</h2><p>${showAllMistakes ? '拼写错误的词会自动收录在这里。' : '已巩固的词仍保存在「全部记录」中，可以随时复习。'}</p><button class="secondary" data-action="practice">返回听音默写</button></div>`;
}
function renderVocabulary() {
  const query = $('#search').value.trim().toLowerCase();
  const words = filteredWords().filter(w => w.word.toLowerCase().includes(query) || w.meaning.includes(query));
  $('#vocabulary-count').textContent = `${sceneName(progress.settings.scene)} · ${words.length} 词`;
  $('#vocabulary-list').innerHTML = words.length ? `<div class="table-container"><table class="word-table"><thead><tr><th>单词 / 短语</th><th>中文释义</th><th class="optional-col">场景</th><th>发音</th></tr></thead><tbody>${words.slice(0, pageLimit).map(w => `<tr><td><span class="word" lang="en">${escape(w.word)}</span><div class="word-meta">${escape(w.group)} · PDF 第 ${w.sourcePages.join('、')} 页</div></td><td>${escape(w.meaning)}</td><td class="optional-col">${sceneName(w.scene)}</td><td><button class="row-audio" data-speak="${w.id}" aria-label="朗读 ${escape(w.word)}">♪</button></td></tr>`).join('')}</tbody></table></div>${words.length > pageLimit ? '<div class="pagination"><button class="secondary" data-action="more">加载更多词汇 ↓</button></div>' : ''}` : '<div class="empty-state"><h2>没有找到这个词</h2><p>试试更短的关键词，或选择其他场景。</p></div>';
}
function refresh() { renderStats(); renderScenes(); renderExercise(); save(); }
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
  startSession(progress, ids, review); refresh(); setView('practice'); speak(); focusAnswer();
}
function next() { if (!advance(progress)) return; stopSpeech(); refresh(); if (['question', 'repairing'].includes(progress.session.phase)) speak(); focusAnswer(); }
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
    const response = await fetch('./data/vocabulary.json');
    if (!response.ok) throw new Error('词库加载失败');
    data = await response.json(); byId = new Map(data.words.map(w => [w.id, w]));
  } catch {
    $('#exercise').innerHTML = '<div class="empty-state"><h2>词库暂时未能加载</h2><p>请检查网络后刷新。若是本地运行，请通过 HTTP 服务打开网站。</p><button class="primary" onclick="location.reload()">重新加载</button></div>'; return;
  }
  try { progress = loadProgress(localStorage.getItem(STORAGE_KEY), data.words); }
  catch { progress = emptyProgress(); warning('未能读取原来的学习记录。已开始新的练习；如果浏览器禁止存储，记录将无法持久保存。'); }
  $('#session-scene').innerHTML = `<option value="all">全部场景 · ${data.words.length} 词</option>${data.scenes.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}`;
  renderStats(); renderScenes(); renderExercise(); focusAnswer();
  if (!('speechSynthesis' in window)) $('#audio-status').textContent = '当前浏览器不支持发音，请使用支持语音的 Chrome、Edge 或 Safari。';
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.view) setView(b.dataset.view);
    if (b.dataset.action) action(b.dataset.action);
    if (b.dataset.scene) { progress.settings.scene = b.dataset.scene; save(); renderScenes(); if (view === 'vocabulary') renderVocabulary(); else { setView('practice'); renderExercise(); } }
    if (b.dataset.speak) speak(byId.get(b.dataset.speak)?.word);
    if (b.dataset.review) begin([b.dataset.review], true);
  });
  $('#exercise').addEventListener('submit', event => {
    event.preventDefault();
    const answer = $('#answer').value;
    if (!answer.trim()) { $('#input-error').textContent = '先写下你的答案，再按回车。'; return; }
    submitAnswer(progress, currentWord(), answer); stopSpeech(); refresh(); focusAnswer();
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
  $('#shuffle').addEventListener('change', event => { progress.settings.shuffle = event.target.checked; save(); });
  $('#pending-tab').onclick = () => { showAllMistakes = false; renderMistakes(); };
  $('#all-tab').onclick = () => { showAllMistakes = true; renderMistakes(); };
  $('#review-all').onclick = () => begin(showAllMistakes ? Object.keys(progress.mistakes) : pendingIds(), true);
  $('#search').addEventListener('input', () => { pageLimit = 60; renderVocabulary(); });
  window.addEventListener('pagehide', () => { stopSpeech(); save(); });
}
init();
