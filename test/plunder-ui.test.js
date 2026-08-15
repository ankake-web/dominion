/* 略奪（Plunder）UI スモーク（jsdom）
   使い方: node test/plunder-ui.test.js
   主目的＝**人間が詰まない／見えないと困るものが見えている**こと。
   P1a＝戦利品(Loot)の山の残枚数が盤面に出ること（中身は出さない＝完全に秘密）。 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = '<!DOCTYPE html><html><body><div id="app"></div></body></html>';
const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
const timers = []; let timerId = 1;
win.setTimeout = (fn) => { const id = timerId++; timers.push({ id, fn }); return id; };
win.clearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
win.requestAnimationFrame = (fn) => { fn(); return 1; };
let runtimeError = null;
win.addEventListener('error', (e) => { runtimeError = e.error || e.message; });
function load(f) { win.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')); }
['js/cards.js', 'js/engine.js', 'js/cpu.js', 'js/store.js', 'js/net.js', 'js/audio.js', 'js/ui.js'].forEach(load);
win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

const doc = win.document;
const DOM = win.DOM;
const UI = DOM.UI;
const E = DOM.engine;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  x FAIL: ' + m); } }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.pickZoom = null; UI.sheet = null; UI.confirm = null; UI.lmZoom = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const FILLER = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'];
const LOOT = DOM.POOLS.loot;

console.log('=== P1a: 戦利品(Loot)の盤面表示 ===');
{
  // 戦利品を配る札（宝飾卵）がある王国＝山ができる
  const s = E.createInitialState(['あなた', '相手'], ['jewelled_egg'].concat(FILLER), { startActive: 0 });
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
  const txt = doc.body.textContent;
  ok(txt.indexOf('戦利品') >= 0, '盤面に「戦利品」の行が出る');
  ok(txt.indexOf('30枚') >= 0, '残枚数（30枚）が見える');
  // 中身は1枚も名前が漏れていない（山は完全に秘密）
  const leaked = LOOT.filter((id) => txt.indexOf(DOM.CARDS[id].name) >= 0);
  ok(leaked.length === 0, '山の中身のカード名が盤面に漏れていない（漏れ=' + leaked.join(',') + '）');

  // 1枚獲得すると残枚数が減り、獲得した札は公開演出に出る
  const got = E.gainLoot(s, 0);
  showAs(s, 0);
  ok(!runtimeError, '獲得後も描画で例外が出ない: ' + (runtimeError || ''));
  ok(doc.body.textContent.indexOf('29枚') >= 0, '獲得すると残枚数が29枚になる');
  ok(doc.body.textContent.indexOf(DOM.CARDS[got].name) >= 0, '獲得した戦利品の名前は見える（公開されるため）');
}
{
  // 戦利品を配る札が無い王国＝行そのものを出さない
  const s = E.createInitialState(['あなた', '相手'], ['mine'].concat(FILLER), { startActive: 0 });
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
  ok(doc.body.textContent.indexOf('戦利品') < 0, '戦利品を配る札が無ければ盤面に行を出さない');
}

console.log('\n=== P1b: 戦利品の pending にモーダルと押せる選択肢があるか（人間が詰まないこと） ===');
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function actionable() {
  if (runtimeError || !$('.modal')) return false;
  const btns = $all('.modal button').filter((b) => !b.disabled);
  const chips = $all('.modal .chip-grid .card, .modal .chip-grid .pick-supply');
  return btns.length + chips.length > 0;
}
function mkP(kingdom) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || ['jewelled_egg']).concat(FILLER).slice(0, 10), { startActive: 0 });
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.turn.phase = 'buy';
  return s;
}
// 各 pending を直接立てて、モーダルが出て押せる選択肢があるかを見る
const CASES = [
  ['prize_goat', (s) => { s.players[0].hand = ['estate']; s.pending = { type: 'prize_goat', player: 0 }; }],
  ['hammer_gain', (s) => { s.pending = { type: 'hammer_gain', player: 0 }; }],
  ['sextant', (s) => { s.pending = { type: 'sextant', player: 0, cards: ['copper', 'estate', 'silver', 'gold', 'curse'] }; }],
  ['puzzle_box', (s) => { s.players[0].hand = ['gold']; s.pending = { type: 'puzzle_box', player: 0 }; }],
  ['staff_play', (s) => { s.players[0].hand = ['village']; s.pending = { type: 'staff_play', player: 0 }; }],
  ['travelling_fair(勲章)', (s) => { s.pending = { type: 'travelling_fair', player: 0, card: 'silver', dest: 'discard', source: 'insignia' }; }],
  ['discard_down(剣)', (s) => { s.players[0].hand = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper']; s.pending = { type: 'discard_down', player: 0, source: 1, down: 4, queue: [] }; }],
  ['discard_down(剣)＋盾', (s) => { s.players[0].hand = ['shield', 'copper', 'copper', 'copper', 'copper', 'copper']; s.pending = { type: 'discard_down', player: 0, source: 1, down: 4, queue: [] }; }],
];
CASES.forEach(([name, setup]) => {
  const s = mkP(); setup(s); showAs(s, 0);
  ok(actionable(), name + '：モーダルが出て押せる選択肢がある' + (runtimeError ? '（例外: ' + runtimeError + '）' : ''));
});
// 盾のボタンが実際に出ていること
{
  const s = mkP();
  s.players[0].hand = ['shield', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.pending = { type: 'discard_down', player: 0, source: 1, down: 4, queue: [] };
  showAs(s, 0);
  ok(doc.body.textContent.indexOf('盾を公開') >= 0, '盾を持っていると「盾を公開して無効化」ボタンが出る');
}
// 勲章のラベルが「勲章」になっている（移動遊園地と取り違えない）
{
  const s = mkP();
  s.pending = { type: 'travelling_fair', player: 0, card: 'silver', dest: 'discard', source: 'insignia' };
  showAs(s, 0);
  ok(doc.body.textContent.indexOf('勲章') >= 0, '勲章の窓は「勲章」と表示される');
}
// CPU が全 pending で null を返さない（オンラインで reduce(state,null) が落ちるのを防ぐ）
{
  const CPUd = DOM.cpu;
  CASES.forEach(([name, setup]) => {
    const s = mkP(); setup(s);
    let a = null, err = null;
    try { a = CPUd.decidePending ? CPUd.decidePending(s) : CPUd.decide(s); } catch (e) { err = e.message; }
    ok(a && a.type, 'CPU：' + name + ' で有効な action を返す' + (err ? '（例外: ' + err + '）' : ''));
  });
}

console.log('\n========================================');
console.log(`略奪UIテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
