/* 冒険 CPU-shipping soak: adventures / random-adventures を 2/3/4人・全難易度で走らせ、
   真のデッドロック（pendingの完全JSONが連続不変）・例外・保存則・未終局 を検出する。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Object.create(Math), JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 12345;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat', 'princes', 'tavern'];
function tally(s) {
  const t = {}; const add = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; };
  Object.keys(s.supply).forEach((id) => { if (id === 'ruins' || id === 'knights') return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) add(id); });
  (s.ruins || []).forEach(add); (s.knights || []).forEach(add);
  (s.trash || []).forEach(add); (s.blackMarket || []).forEach(add);
  s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(add)));
  if (s.turn) { (s.turn.possessionGains || []).forEach(add); (s.turn.possessionTrash || []).forEach(add); }
  return t;
}
function diffTally(a, b) { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); const d = []; ks.forEach((k) => { if ((a[k] || 0) !== (b[k] || 0)) d.push(k + ':' + (a[k] || 0) + '→' + (b[k] || 0)); }); return d; }

function pendKey(s) {
  // 真のデッドロック検出：pending の完全JSON＋active/phase＋手札枚数の署名（多段pendingは変化するので偽陽性にならない）。
  return JSON.stringify(s.pending) + '|' + (s.turn ? s.turn.active + ':' + s.turn.phase + ':' + s.turn.actions + ':' + s.turn.buys + ':' + s.turn.coins : '') + '|' + s.players.map((p) => (p.hand || []).length + ',' + (p.deck || []).length + ',' + (p.discard || []).length).join(';');
}

function runGame(kingdom, players, opts) {
  let s;
  try { s = E.createInitialState(players, kingdom, opts || { startActive: 0 }); }
  catch (e) { return { ok: false, why: 'createInitialState throw: ' + e.message }; }
  const init = tally(s);
  const n = s.players.length;
  let step = 0, stuck = 0, lastKey = null;
  while (!s.gameOver && step++ < 20000) {
    let act;
    try { act = CPU.decide(s); } catch (e) { return { ok: false, why: 'decide throw step' + step + ': ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n') + '\n  pending=' + JSON.stringify(s.pending) }; }
    if (act == null) return { ok: false, why: 'decide returned null step' + step + ' pending=' + JSON.stringify(s.pending) };
    try { s = E.reduce(s, act); } catch (e) { return { ok: false, why: 'reduce throw step' + step + ' act=' + JSON.stringify(act) + ': ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n') }; }
    const key = pendKey(s);
    if (key === lastKey) { stuck++; if (stuck > 40) return { ok: false, why: 'DEADLOCK step' + step + ' act=' + JSON.stringify(act) + ' pending=' + JSON.stringify(s.pending) }; }
    else { stuck = 0; lastKey = key; }
    if (s.pending) continue;
    const d = diffTally(init, tally(s));
    if (d.length) return { ok: false, why: '保存則 step' + step + ': ' + d.join(' ') };
    if (Object.values(s.supply).some((v) => v < 0)) return { ok: false, why: 'supply負 step' + step };
  }
  return { ok: !!s.gameOver, why: s.gameOver ? '' : '未終局(step>' + step + ')' };
}

const levels = ['easy', 'normal', 'hard'];
function mkPlayers(n, off) { return Array.from({ length: n }, (_, i) => ({ name: 'C' + i, isCpu: true, level: levels[(off + i) % 3] })); }

let games = 0, fails = 0;
for (const setId of ['adventures', 'random-adventures']) {
  for (let sd = 0; sd < 120; sd++) {
    const k = DOM.kingdomForSet(setId);
    if (!k) { console.log('no kingdom for ' + setId); continue; }
    const np = 2 + (sd % 3);
    const r = runGame(k, mkPlayers(np, sd), { startActive: 0 });
    games++;
    if (!r.ok) { fails++; console.log('FAIL ' + setId + ' sd' + sd + ' np' + np + ' k=[' + k.join(',') + ']\n  ' + r.why); if (fails > 25) { console.log('...too many fails, abort'); process.exit(1); } }
  }
}
console.log('DONE games=' + games + ' fails=' + fails);
