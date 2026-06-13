/* 拡張UIのスモークテスト（jsdom）— セット選択・選択モーダル・獲得演出。
   使い方: node test/intrigue-ui.test.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = '<!DOCTYPE html><html><body><div id="app"></div></body></html>';
const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
const timers = [];
let timerId = 1;
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
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function byText(sel, t) { return $all(sel).find((e) => e.textContent.trim() === t); }
function clickText(sel, t) { const el = byText(sel, t); if (!el) throw new Error('要素なし: ' + sel + '=' + t); el.click(); }
function go(v) { UI.view = v; UI.sheet = null; DOM.render(); timers.length = 0; }
function setState(s) { UI.store.state = s; DOM.render(); timers.length = 0; }

try {
  console.log('=== 設定画面: 王国カードのセット選択 ===');
  go('setup');
  ok(byText('.seg-btn', '陰謀(拡張)'), 'セット切替に「陰謀(拡張)」がある');
  ok(byText('.seg-btn', 'ランダム10種'), '「ランダム10種」がある');
  clickText('.seg-btn', '陰謀(拡張)');
  ok(UI.setup.kingdomSet === 'intrigue', '陰謀セットを選択');

  console.log('=== クイック2人を陰謀セットで開始 ===');
  go('localSetup');
  clickText('.seg-btn', '陰謀(拡張)');
  clickText('button', 'ゲーム開始');
  ok(UI.view === 'game' && UI.store && UI.store.state, 'ゲーム開始');
  const kingdom = UI.store.state.kingdom;
  ok(kingdom.includes('nobles') && kingdom.includes('bridge'), '陰謀の王国カードが場に: ' + kingdom.join(','));

  console.log('=== 執事モーダル: 選択肢が出て解決できる ===');
  let s = E.createInitialState(['P1', 'P2'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['steward', 'copper', 'estate'];
  UI.mode = 'local'; UI.localViewer = 0; UI.mySeat = null;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'steward' });
  setState(s);
  ok($('.modal') && $('.modal h3').textContent.includes('執事'), '執事モーダル表示');
  ok(byText('.modal .btn', '+2 コイン'), '選択肢ボタンがある');
  clickText('.modal .btn', '+2 コイン');
  ok(UI.store.state.turn.coins === 2 && UI.store.state.pending === null, '+2コインで解決');

  console.log('=== 従者モーダル: 異なる2つを選んで決定 ===');
  let s2 = E.createInitialState(['P1', 'P2'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s2.players[0].hand = ['pawn'];
  s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'pawn' });
  setState(s2);
  ok($all('.choose-tile').length === 4, '4つの選択タイル');
  $all('.choose-tile')[0].click(); // +1カード
  $all('.choose-tile')[1].click(); // +1アクション
  const confirm = byText('.modal .btn', '決定');
  ok(confirm && !confirm.disabled, '2つ選ぶと決定が押せる');
  confirm.click();
  ok(UI.store.state.pending === null, '従者が解決');

  console.log('=== 拷問人モーダル: 対象が選択肢を持つ ===');
  let s3 = E.createInitialState(['P1', 'P2'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s3.players[0].hand = ['torturer'];
  s3.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s3 = E.reduce(s3, { type: 'PLAY_ACTION', card: 'torturer' });
  // 対象は席1。ローカルでは席1視点に切替（パスゲート相当）
  UI.localViewer = 1;
  setState(s3);
  ok($('.modal') && doc.body.textContent.includes('拷問人'), '拷問人モーダル（対象側）');
  ok(byText('.modal .btn', '☠️ 呪いを手札に受け取る'), '呪いを受け取る選択肢');

  console.log('=== 獲得演出: 大きいカード要素が生成される ===');
  UI.localViewer = 0;
  let g1 = E.createInitialState(['P1', 'P2'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  setState(g1);                         // スナップショット確定
  let g2 = JSON.parse(JSON.stringify(g1));
  g2.supply.silver -= 1;                // 銀貨を1枚獲得した想定
  g2.players[0].discard.push('silver');
  setState(g2);
  const fx = $('#dom-fx .gain-fx');
  ok(fx, '獲得演出のカード要素(.gain-fx)が生成される');
  ok(fx && fx.querySelector('.gain-note') && fx.querySelector('.gain-note').textContent.includes('獲得'), '「○○ を獲得！」表示');

  console.log('=== カード一覧に拡張カードが載る ===');
  go('cardList');
  ok(doc.body.textContent.includes('陰謀・拡張'), 'カード一覧に拡張グループ');
  ok($all('.cardlist-grid .card').length >= 30, '基本＋拡張で30枚以上: ' + $all('.cardlist-grid .card').length);

  ok(!runtimeError, '実行時エラーが出ていない: ' + (runtimeError && (runtimeError.stack || runtimeError)));
} catch (e) {
  fail++;
  console.log('  ✗ 例外: ' + (e && (e.stack || e.message)));
}

console.log('\n========================================');
console.log('拡張UIテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
