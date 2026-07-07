/* 冒険（Adventures）UI スモーク（jsdom）
   各 pending の選択モーダルと盤面（成長山・酒場マット・トークン）がエラー無く描画できるかを確認。
   使い方: node test/adventures-ui.test.js */
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
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + m); } }
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function byText(sel, t) { return $all(sel).find((e) => e.textContent.includes(t)); }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
// page/peasant を含む広めの王国（成長山・各モーダルの獲得候補を用意）
const K = ['page', 'peasant', 'guide', 'ranger', 'amulet', 'caravan_guard', 'haunted_woods', 'artificer', 'messenger', 'raze'];
function mk(opts) { return E.createInitialState(['あなた', '相手'], K.slice(), Object.assign({ startActive: 0 }, opts || {})); }
function showPend(pd, setup) {
  const s = mk();
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}
function modalOk() { return $('.modal') && !runtimeError; }

try {
  console.log('=== 盤面（成長山・酒場マット・トークン）の描画 ===');
  {
    const s = mk(); s.turn.phase = 'buy';
    // 酒場マット・トークン・山トークンを盛る
    s.players[0].tavern = ['guide', 'distant_lands', 'copper'];
    s.players[0].journeyDown = true; s.players[0].minusCard = true; s.players[0].minusCoin = true;
    s.players[0].pileTokens = { card: 'guide', coin: 'ranger' };
    showAs(s, 0);
    ok(!runtimeError, '冒険の盤面（成長山・酒場マット・各トークン）がエラー無く描画できる');
    ok(byText('.pname', DOM.CARDS.warrior.name) != null || byText('.pname', DOM.CARDS.champion.name) != null, '成長山（ウォリアー/チャンピオン等）が盤面に出る');
    ok($('.pile-tokens') != null, '教師の山トークンのバッジが描画される');
  }

  console.log('=== 各 pending モーダルの描画 ===');
  const cases = [
    ['traveller_exchange', { type: 'traveller_exchange', player: 0, queue: ['page', 'peasant'] }, null],
    ['teacher_call token', { type: 'teacher_call', stage: 'token', player: 0 }, (s) => { s.players[0].pileTokens = { card: 'guide' }; }],
    ['teacher_call pile', { type: 'teacher_call', stage: 'pile', player: 0, token: 'action' }, null],
    ['tavern_start(teacher)', { type: 'tavern_start', player: 0 }, (s) => { s.players[0].tavern = ['teacher', 'guide']; }],
    ['raze trash', { type: 'raze', stage: 'trash', player: 0 }, (s) => { s.players[0].inPlay = ['raze']; s.players[0].hand = ['copper', 'estate']; }],
    ['raze look', { type: 'raze', stage: 'look', player: 0, cards: ['gold', 'silver'] }, null],
    ['artificer discard', { type: 'artificer', stage: 'discard', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate', 'silver']; }],
    ['artificer gain', { type: 'artificer', stage: 'gain', player: 0, exact: 2 }, null],
    ['storyteller', { type: 'storyteller', player: 0 }, (s) => { s.players[0].hand = ['copper', 'silver', 'gold', 'estate']; }],
    ['messenger_play', { type: 'messenger_play', player: 0 }, null],
    ['messenger_gain', { type: 'messenger_gain', player: 0 }, null],
    ['hero_gain', { type: 'hero_gain', player: 0 }, null],
    ['soldier discard', { type: 'soldier', stage: 'discard', player: 0, source: 1, victim: 0, queue: [] }, (s) => { s.players[0].hand = ['copper', 'estate', 'silver', 'gold']; }],
    ['fugitive_discard', { type: 'fugitive_discard', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; }],
    ['disciple_play', { type: 'disciple_play', player: 0 }, (s) => { s.players[0].hand = ['guide', 'ranger', 'copper']; }],
    ['miser', { type: 'miser', player: 0 }, (s) => { s.players[0].hand = ['copper']; s.players[0].tavern = ['copper']; }],
    ['amulet', { type: 'amulet', player: 0 }, null],
    ['tavern_start(guide)', { type: 'tavern_start', player: 0 }, (s) => { s.players[0].tavern = ['guide', 'ratcatcher', 'transmogrify']; }],
    ['transmogrify_gain', { type: 'transmogrify_gain', player: 0, maxCost: 4, pot: 0 }, null],
    ['after_action', { type: 'after_action', player: 0, card: 'artificer' }, (s) => { s.players[0].tavern = ['coin_of_the_realm', 'royal_carriage']; s.players[0].inPlay = ['artificer']; }],
    ['duplicate', { type: 'duplicate', player: 0, card: 'artificer' }, (s) => { s.players[0].tavern = ['duplicate']; }],
    ['wine_merchant', { type: 'wine_merchant', player: 0 }, (s) => { s.players[0].tavern = ['wine_merchant']; }],
  ];
  for (const [name, pd, setupFn] of cases) {
    showPend(pd, setupFn);
    ok(modalOk(), name + ' モーダルがエラー無く描画');
  }

  console.log('=== アタックのリアクション窓（堀＋冒険の反応札）===');
  const reactCases = [
    ['warrior react', { type: 'warrior', stage: 'react', player: 0, source: 1, victim: 0, queue: [], count: 1 }],
    ['soldier react', { type: 'soldier', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }],
    ['haunted_woods react', { type: 'haunted_woods', stage: 'react', player: 0, source: 1, victim: 0, queue: [], rid: 1 }],
    ['swamp_hag react', { type: 'swamp_hag', stage: 'react', player: 0, source: 1, victim: 0, queue: [], rid: 1 }],
    ['giant react', { type: 'giant', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }],
    ['relic react', { type: 'relic', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }],
    ['bridge_troll react', { type: 'bridge_troll', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }],
  ];
  for (const [name, pd] of reactCases) {
    showPend(pd, (s) => { s.players[0].hand = ['moat', 'caravan_guard', 'copper']; });
    ok(modalOk(), name + ' の受け窓がエラー無く描画');
    // 冒険のリアクション（隊商の護衛）ボタンが出る
    ok(byText('button', '隊商の護衛') != null || byText('button', '堀') != null, name + ': 反応札ボタン（隊商の護衛/堀）が出る');
  }

  console.log('=== embedded 反応窓（民兵）に隊商の護衛が出る ===');
  {
    const s = mk();
    s.pending = { type: 'militia', player: 0, source: 1, queue: [], down: 3 };
    s.players[0].hand = ['caravan_guard', 'copper', 'estate', 'silver'];
    showAs(s, 0);
    ok(byText('button', '隊商の護衛') != null && !runtimeError, '民兵の embedded 反応窓に隊商の護衛ボタンが出る');
  }
} catch (e) {
  fail++; console.log('  ✗ 例外: ' + (e && e.stack || e));
}

console.log('\n========================================');
console.log('冒険UIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
