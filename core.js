export const STORAGE_KEY = 'scene-listening-v1';

export function normalize(text) {
  return String(text).normalize('NFKC').trim().toLowerCase()
    .replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ');
}

// Spelling variants only. Synonyms are separate listening prompts.
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
export function isCorrect(answer, word) {
  const a = normalize(answer), w = normalize(word);
  return a === w || variants.some(group => group.includes(w) && group.includes(a));
}
export function emptyProgress() {
  return { version: 1, attempts: 0, correct: 0, mastered: [], mistakes: {}, session: null, settings: { scene: 'all', size: 20, accent: 'en-GB', rate: 0.85, shuffle: false } };
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
    if (s.scene === 'all' || words.some(w => w.scene === s.scene)) fresh.settings.scene = s.scene;
    if ([10, 20, 50, 0].includes(s.size)) fresh.settings.size = s.size;
    if (['en-GB', 'en-US'].includes(s.accent)) fresh.settings.accent = s.accent;
    if ([0.65, 0.85, 1].includes(s.rate)) fresh.settings.rate = s.rate;
    fresh.settings.shuffle = s.shuffle === true;
  }
  const session = data.session;
  if (session && Array.isArray(session.ids) && session.ids.length && session.ids.every(id => ids.has(id)) &&
      number(session.index) && session.index < session.ids.length && number(session.repeats) && session.repeats <= 5 &&
      number(session.correct) && number(session.wrong) &&
      ['question', 'correct', 'mistake', 'repairing', 'repair-error', 'repaired', 'complete'].includes(session.phase)) {
    fresh.session = { ids: session.ids, index: session.index, repeats: session.repeats, phase: session.phase,
      correct: session.correct, wrong: session.wrong, review: session.review === true };
  }
  return fresh;
}
export function startSession(progress, ids, review = false) {
  if (!ids.length) return;
  progress.session = { ids: [...ids], index: 0, repeats: 0, phase: 'question', correct: 0, wrong: 0, review };
}
export function submitAnswer(progress, word, answer) {
  const s = progress.session;
  if (!s || !['question', 'repairing'].includes(s.phase) || !normalize(answer)) return 'ignored';
  const ok = isCorrect(answer, word.word);
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
    progress.mistakes[word.id] = { count: (old?.count || 0) + 1, lastAnswer: answer, resolved: false };
  }
  return s.phase;
}
export function advance(progress) {
  const s = progress.session;
  if (!s) return false;
  if (['mistake', 'repair-error'].includes(s.phase)) { s.phase = 'repairing'; return true; }
  if (!['correct', 'repaired'].includes(s.phase)) return false;
  if (s.index + 1 === s.ids.length) s.phase = 'complete';
  else { s.index++; s.repeats = 0; s.phase = 'question'; }
  return true;
}
