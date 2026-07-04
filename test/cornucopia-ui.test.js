/* 収穫祭（Cornucopia）UI スモーク（jsdom）
   各 pending の選択モーダル・賞品/災いの表示・馬商人リアクションボタンが描画できるかを確認。
   使い方: node test/cornucopia-ui.test.js */
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
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const K = DOM.KINGDOM_CORNUCOPIA; // tournament(賞品)＋young_witch(災い)を含む
function mk() { return E.createInitialState(['あなた', '相手'], K, { startActive: 0 }); }
function play(s, card) { return E.reduce(s, { type: 'PLAY_ACTION', card }); }
function pend(pd, viewer) { const s = mk(); s.pending = pd; return { s, viewer: viewer != null ? viewer : pd.player }; }
function showPend(pd, setup) {
  const s = mk();
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}

try {
  console.log('=== 収穫祭セット10種・賞品山・災いカードが揃う ===');
  ok(DOM.KINGDOM_CORNUCOPIA.length === 10 && DOM.KINGDOM_CORNUCOPIA.every((id) => DOM.CARDS[id]), '収穫祭KINGDOMは10種・全て実在');
  { const s = mk(); ok(s.supply.bag_of_gold === 1 && s.baneCard, '賞品山と災いカードが用意される'); }

  console.log('=== 一覧カタログに賞品グループが出る（描画エラーなし）===');
  { runtimeError = null; UI.view = 'cards'; DOM.render(); ok(!runtimeError, 'カード一覧が描画できる'); }

  console.log('=== 各 pending モーダルが描画される ===');
  { let s = mk(); s.players[0].hand = ['hamlet', 'estate', 'copper']; s.players[0].deck = ['copper', 'silver']; s = play(s, 'hamlet'); showAs(s, 0); ok($('.modal') && byText('*', '小村') && !runtimeError, '小村 捨て札モーダル'); }
  showPend({ type: 'fortune_teller', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; }); ok($('.modal') && byText('button', '受ける') && !runtimeError, '占い師 リアクション');
  { let s = mk(); s.players[0].hand = ['horse_traders', 'copper', 'estate', 'silver']; s = play(s, 'horse_traders'); showAs(s, 0); ok($('.modal') && byText('*', '馬商人') && !runtimeError, '馬商人 捨て札モーダル'); }
  { let s = mk(); s.players[0].hand = ['remake', 'estate', 'copper']; s = play(s, 'remake'); showAs(s, 0); ok($('.modal') && byText('*', 'リメイク') && !runtimeError, 'リメイク 廃棄モーダル'); }
  showPend({ type: 'remake', stage: 'gain', player: 0, iter: 0, exactCost: 3 }); ok($('.modal') && byText('*', 'リメイク') && !runtimeError, 'リメイク 獲得モーダル');
  { let s = mk(); s.players[0].hand = ['tournament', 'province']; s = play(s, 'tournament'); showAs(s, 0); ok($('.modal') && byText('button', '属州を公開する') && !runtimeError, '馬上槍試合 属州公開モーダル'); }
  showPend({ type: 'tournament', stage: 'prize', player: 0, source: 0 }); ok($('.modal') && (byText('button', '金貨袋') || byText('button', '賞品')) && !runtimeError, '馬上槍試合 賞品モーダル');
  showPend({ type: 'tournament', stage: 'reveal_opp', player: 1, source: 0, queue: [], revealedAny: false }, (s) => { s.players[1].hand = ['province']; }); ok($('.modal') && byText('button', '公開') && !runtimeError, '馬上槍試合 相手の公開モーダル');
  { let s = mk(); s.players[0].hand = ['young_witch', 'copper', 'copper']; s.players[0].deck = ['copper', 'silver', 'gold']; s = play(s, 'young_witch'); showAs(s, 0); ok($('.modal') && byText('*', '若き魔女') && !runtimeError, '若き魔女 手札捨てモーダル'); }
  { // 若き魔女の反応（災いカード公開ボタン）
    const s = mk(); const bane = s.baneCard;
    s.pending = { type: 'young_witch', stage: 'react', player: 1, source: 0, victim: 1, queue: [], bane };
    s.players[1].hand = [bane, 'copper'];
    showAs(s, 1);
    ok($('.modal') && byText('button', '災いカード') && !runtimeError, '若き魔女 災いカード公開ボタン');
  }
  showPend({ type: 'jester', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; }); ok($('.modal') && byText('button', '受ける') && !runtimeError, '道化師 リアクション');
  showPend({ type: 'jester', stage: 'choose', player: 0, source: 0, victim: 1, card: 'gold', queue: [] }); ok($('.modal') && byText('button', '獲得') && !runtimeError, '道化師 コピー獲得先モーダル');
  showPend({ type: 'followers', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; }); ok($('.modal') && byText('button', '受ける') && !runtimeError, '家臣団 リアクション');
  showPend({ type: 'followers', stage: 'discard', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['copper', 'silver', 'gold', 'estate', 'duchy']; }); ok($('.modal') && byText('*', '家臣団') && !runtimeError, '家臣団 手札捨てモーダル');
  { let s = mk(); s.players[0].hand = ['trusty_steed']; s = play(s, 'trusty_steed'); showAs(s, 0); ok($('.modal') && byText('*', '頼もしい乗騎') && byText('*', 'カード') && !runtimeError, '頼もしい乗騎 選択モーダル'); }
  showPend({ type: 'horn_of_plenty', player: 0, maxCost: 4 }); ok($('.modal') && byText('*', '豊穣の角') && !runtimeError, '豊穣の角 獲得モーダル');

  console.log('=== 馬商人リアクション: アタックの反応窓に「馬商人を脇に置く」ボタンが出る ===');
  {
    const s = mk();
    s.pending = { type: 'jester', stage: 'react', player: 1, source: 0, victim: 1, queue: [] };
    s.players[1].hand = ['horse_traders', 'copper'];
    showAs(s, 1);
    ok($('.modal') && byText('button', '馬商人を脇に置く') && !runtimeError, '馬商人 脇置きボタンが反応窓に出る');
  }

  console.log('=== 賞品/災いの盤面表示（描画エラーなし）===');
  {
    let s = mk(); s.turn.phase = 'buy';
    showAs(s, 0);
    ok(!runtimeError, '収穫祭サプライ・災いカードを含む盤面が描画できる');
  }

} catch (e) {
  fail++; console.log('  ✗ 例外: ' + (e && e.stack || e));
}

console.log('\n========================================');
console.log('収穫祭UIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
