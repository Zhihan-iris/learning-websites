export const STORAGE_KEY = 'scene-listening-v1';

export function normalize(text) {
  return String(text).normalize('NFKC').trim().toLowerCase()
    .replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ');
}

// Spelling variants only; paraphrase-group matching checks the taught expressions separately.
const variants = [
  ['check', 'cheque'], ['student adviser', 'student advisor'],
  ['neighbour', 'neighbor'], ['neighbourhood', 'neighborhood'],
  ['city centre', 'city center'], ['fitness centre', 'fitness center'],
  ['computer centre', 'computer center'], ['student health centre', 'student health center'],
  ['insurance centre', 'insurance center'], ['child care centre', 'child care center'],
  ['counseling centre', 'counselling centre', 'counseling center', 'counselling center'],
  ['counselor', 'counsellor'], ['theatre', 'theater'], ['lecture theater', 'lecture theatre'],
  ['drama theater', 'drama theatre'], ['organisation', 'organization'],
  ['catalogue', 'catalog'], ['plough', 'plow'], ['dietician', 'dietitian'],
  ["driver's license", "driver's licence"], ['driving license', 'driving licence'],
  ['favorable terms', 'favourable terms'], ['en-suite', 'en suite'],
  ['eye-sight', 'eyesight'], ['kick-boxing', 'kickboxing'],
];
function canonicalTime(text) {
  const parts = normalize(text).replace(/\b([ap])\.?m\.?/g, '$1m').replace(/\s+to\s+/g, '-').split('-');
  if (parts.length > 2) return null;
  const times = parts.map(part => {
    const m = part.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
    if (!m) return null;
    let hour = Number(m[1]); const minute = Number(m[2] || 0);
    if (minute > 59 || (m[3] ? hour < 1 || hour > 12 : hour > 23)) return null;
    if (m[3]) hour = hour % 12 + (m[3] === 'pm' ? 12 : 0);
    return hour * 60 + minute;
  });
  return times.includes(null) ? null : times.join('-');
}
function canonicalAnswer(answer, kind) {
  let value = normalize(answer);
  if (kind === 'phone') return /^[\d\s()-]+$/.test(value) ? value.replace(/[\s()-]/g, '') : null;
  if (kind === 'postcode') return value.replace(/\s/g, '');
  if (kind === 'time') return canonicalTime(value);
  if (kind === 'address') return value.replace(/^no\.?\s*/, '').replace(/[.,]/g, '')
    .replace(/\b(rd|st|ave|ln)\b/g, s => ({rd:'road',st:'street',ave:'avenue',ln:'lane'}[s]));
  if (kind === 'date') return value.replace(/,/g, '').replace(/^0*(\d+)[/-]0*(\d+)$/, '$1/$2');
  if (kind === 'synonym') return value.replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
  return value;
}
export function checkSynonymAnswers(answer, entry) {
  const inputs = Array.isArray(answer) ? answer : String(answer).split(/\n|[;；]/);
  const used = new Set(), unexpected = [];
  for (const raw of inputs) {
    if (!normalize(raw)) continue;
    const index = entry.answers.findIndex((a, i) => !used.has(i) && isCorrect(raw, { ...a, kind: 'synonym' }));
    if (index < 0) unexpected.push(String(raw)); else used.add(index);
  }
  return { ok: used.size === entry.answers.length && !unexpected.length, matched: [...used], missing: entry.answers.filter((_, i) => !used.has(i)), unexpected };
}
export function isCorrect(answer, entry) {
  if (entry?.kind === 'synonym-group') return checkSynonymAnswers(answer, entry).ok;
  const item = typeof entry === 'string' ? { word: entry } : entry;
  const a = canonicalAnswer(answer, item.kind);
  if (a === null) return false;
  return [item.word, ...(item.acceptedAnswers || [])].some(word => {
    const w = canonicalAnswer(word, item.kind);
    return a === w || variants.some(group => group.includes(w) && group.includes(a));
  });
}
export function emptyProgress() {
  return { version: 1, attempts: 0, correct: 0, mastered: [], mistakes: {}, session: null, settings: { book: 'scenes', scene: 'all', size: 20, accent: 'en-GB', rate: 0.85, shuffle: false } };
}
export function loadProgress(raw, words) {
  const fresh = emptyProgress();
  if (!raw) return fresh;
  const data = JSON.parse(raw);
  if (!data || data.version !== 1) return fresh;
  const ids = new Set(words.map(w => w.id));
  const number = n => Number.isSafeInteger(n) && n >= 0;
  for (const key of ['attempts', 'correct']) if (number(data[key])) fresh[key] = data[key];
  fresh.correct = Math.min(fresh.correct, fresh.attempts);
  fresh.mastered = Array.isArray(data.mastered) ? [...new Set(data.mastered.filter(id => ids.has(id)))] : [];
  if (data.mistakes && typeof data.mistakes === 'object') {
    for (const [id, m] of Object.entries(data.mistakes)) if (ids.has(id) && m && number(m.count) && m.count > 0) {
      fresh.mistakes[id] = { count: m.count, lastAnswer: typeof m.lastAnswer === 'string' ? m.lastAnswer.slice(0, 200) : '', resolved: m.resolved === true };
    }
  }
  const s = data.settings;
  if (s && typeof s === 'object') {
    if (['scenes', 'synonyms', 'numbers', 'gapfill'].includes(s.book)) fresh.settings.book = s.book;
    if (s.scene === 'all' || words.some(w => w.scene === s.scene)) fresh.settings.scene = s.scene;
    if (fresh.settings.scene !== 'all' && !words.some(w => w.scene === fresh.settings.scene && (w.book || 'scenes') === fresh.settings.book)) fresh.settings.scene = 'all';
    if ([10, 20, 50, 0].includes(s.size)) fresh.settings.size = s.size;
    if (['en-GB', 'en-US'].includes(s.accent)) fresh.settings.accent = s.accent;
    if ([0.65, 0.85, 1].includes(s.rate)) fresh.settings.rate = s.rate;
    fresh.settings.shuffle = s.shuffle === true;
  }
  const session = data.session;
  if (session && Array.isArray(session.ids) && session.ids.length && session.ids.every(id => ids.has(id)) &&
      number(session.index) && session.index < session.ids.length && number(session.repeats) && session.repeats <= 5 &&
      number(session.correct) && number(session.wrong) &&
      ['study', 'question', 'correct', 'mistake', 'repairing', 'repair-error', 'repaired', 'complete'].includes(session.phase)) {
    fresh.session = { ids: session.ids, index: session.index, repeats: session.repeats, phase: session.phase,
      correct: session.correct, wrong: session.wrong, review: session.review === true, lastAnswer: typeof session.lastAnswer === 'string' ? session.lastAnswer.slice(0,2000) : '' };
  }
  return fresh;
}
export function startSession(progress, ids, review = false, firstEntry = null) {
  if (!ids.length) return;
  progress.session = { ids: [...ids], index: 0, repeats: 0, phase: firstEntry?.kind === 'synonym-group' ? 'study' : 'question', correct: 0, wrong: 0, review };
}
export function submitAnswer(progress, word, answer) {
  const s = progress.session;
  if (!s || !['question', 'repairing'].includes(s.phase) || !(Array.isArray(answer) ? answer.some(a => normalize(a)) : normalize(answer))) return 'ignored';
  const ok = isCorrect(answer, word);
  if (s.phase === 'repairing') {
    if (!ok) { s.phase = 'repair-error'; return 'repair-error'; }
    s.repeats++;
    if (s.repeats === 5) {
      s.phase = 'repaired';
      if (progress.mistakes[word.id]) progress.mistakes[word.id].resolved = true;
    }
    return s.phase;
  }
  progress.attempts++;
  if (ok) {
    progress.correct++; s.correct++; s.phase = 'correct';
    if (!progress.mastered.includes(word.id)) progress.mastered.push(word.id);
    if (progress.mistakes[word.id]) progress.mistakes[word.id].resolved = true;
  } else {
    s.wrong++; s.phase = 'mistake'; s.repeats = 0;
    progress.mastered = progress.mastered.filter(id => id !== word.id);
    const old = progress.mistakes[word.id];
    progress.mistakes[word.id] = { count: (old?.count || 0) + 1, lastAnswer: Array.isArray(answer) ? answer.join('；') : answer, resolved: false };
  }
  return s.phase;
}
export function advance(progress, nextEntry = null) {
  const s = progress.session;
  if (!s) return false;
  if (s.phase === 'study') { s.phase = 'question'; return true; }
  if (['mistake', 'repair-error'].includes(s.phase)) { s.phase = 'repairing'; return true; }
  if (!['correct', 'repaired'].includes(s.phase)) return false;
  if (s.index + 1 === s.ids.length) s.phase = 'complete';
  else { s.index++; s.repeats = 0; s.phase = nextEntry?.kind === 'synonym-group' ? 'study' : 'question'; }
  return true;
}
