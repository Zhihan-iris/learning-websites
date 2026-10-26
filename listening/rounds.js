// A round snapshots its scope once. Mastery and mistake history remain cumulative.
export function roundCandidates(words, progress, {book, scenes = [], mode = 'all'}) {
  const selected = new Set(scenes);
  return words.filter(w => (w.book || 'scenes') === book && (!selected.size || selected.has(w.scene)) &&
    (mode === 'all' || (progress.mistakes[w.id] && (mode === 'mistakes' || !progress.mistakes[w.id].resolved))));
}
export function createRound(progress, words, options, random = Math.random) {
  const ids = roundCandidates(words, progress, options).map(w => w.id);
  if (!ids.length) return null;
  if (options.shuffle) for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  progress.rounds ||= {};
  const round = {number:(progress.rounds[options.book]?.number || 0) + 1, mode:options.mode, scenes:[...options.scenes], shuffle:options.shuffle === true, ids, cursor:0};
  progress.rounds[options.book] = round;
  progress.session = null;
  return round;
}
export function nextRoundIds(round, size) { return round ? round.ids.slice(round.cursor, size ? round.cursor + size : undefined) : []; }
export function completeRoundEntry(progress, session) {
  const round = progress.rounds?.[session.roundBook];
  if (round && round.number === session.roundNumber && round.ids[round.cursor] === session.ids[session.index]) round.cursor++;
}
export function restoreRounds(raw, words) {
  const result = {}, byId = new Map(words.map(w => [w.id,w]));
  for (const book of ['scenes','synonyms','numbers','gapfill']) {
    const r = raw?.[book];
    if (!r || !Number.isSafeInteger(r.number) || r.number < 1 || !['all','mistakes','pending'].includes(r.mode) || !Array.isArray(r.ids) || !r.ids.length || new Set(r.ids).size !== r.ids.length || !r.ids.every(id => byId.has(id) && (byId.get(id).book || 'scenes') === book) || !Number.isSafeInteger(r.cursor) || r.cursor < 0 || r.cursor > r.ids.length) continue;
    const scenes = new Set(words.filter(w => (w.book || 'scenes') === book).map(w => w.scene));
    result[book] = {number:r.number, mode:r.mode, scenes:Array.isArray(r.scenes)?[...new Set(r.scenes.filter(s => scenes.has(s)))]:[],shuffle:r.shuffle===true,ids:[...r.ids],cursor:r.cursor};
  }
  return result;
}
