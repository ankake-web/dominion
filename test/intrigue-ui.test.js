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
  // おすすめタイルを名前でクリック
  function clickTile(name) {
    const t = $all('.set-tile').find((e) => e.textContent.includes(name));
    if (!t) throw new Error('タイルが無い: ' + name);
    t.click();
  }
  console.log('=== 設定画面: 王国カードのセット選択（分類セグメント＋タイル）===');
  go('setup');
  // 上段の4分類セグメント
  ok(byText('.set-top-seg .seg-btn', '王国基本'), '分類に「王国基本」');
  ok(byText('.set-top-seg .seg-btn', '陰謀'), '分類に「陰謀」');
  ok(byText('.set-top-seg .seg-btn', 'おすすめ'), '分類に「おすすめ」');
  ok(byText('.set-top-seg .seg-btn', 'ランダム'), '分類に「ランダム」');
  // 既定は王国基本。タイルやランダムチップはまだ出ない
  ok(UI.setup.kingdomSet === 'basic', '既定は王国基本セット');
  ok(!$('.set-tile'), 'おすすめ未選択ではタイルなし');
  // 「おすすめ」を選ぶと既定のテーマ(先頭=ビッグマネー)になりタイルが並ぶ
  clickText('.set-top-seg .seg-btn', 'おすすめ');
  ok(UI.setup.kingdomSet === 'big-money', 'おすすめ選択で先頭テーマ(ビッグマネー)に');
  ok($all('.set-tile').length === 6, 'おすすめタイルが6枚');
  ok(byText('.set-tile-name', '勝利点レース（陰謀）'), 'テーマ「勝利点レース」タイルがある');
  clickTile('策謀コンボ');
  ok(UI.setup.kingdomSet === 'secret-schemes', 'タイルで策謀コンボを選択');
  ok($('.set-note') && $('.set-note').textContent.includes('拷問人'), '選択テーマの収録カードが出る');
  // 「ランダム」を選ぶと抽選元チップが出る
  clickText('.set-top-seg .seg-btn', 'ランダム');
  ok(UI.setup.kingdomSet === 'random', 'ランダム=既定は基本＋陰謀');
  ok(byText('.set-sub .seg-btn', '陰謀のみ'), '抽選元「陰謀のみ」チップがある');
  clickText('.set-sub .seg-btn', '陰謀のみ');
  ok(UI.setup.kingdomSet === 'random-intrigue', '抽選元を陰謀のみに');
  // 「陰謀」を選ぶと陰謀基本セット
  clickText('.set-top-seg .seg-btn', '陰謀');
  ok(UI.setup.kingdomSet === 'intrigue', '陰謀基本セットを選択');

  console.log('=== CPU対戦を陰謀セットで開始 ===');
  go('setup');
  clickText('.set-top-seg .seg-btn', '陰謀');
  clickText('button', 'この設定で開始');
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

  console.log('=== 公開: 相手チップにバッジ→タップで公開カード一覧 ===');
  UI.mode = 'local'; UI.localViewer = 0; UI.mySeat = null;
  let rv = E.createInitialState(['P1', 'P2'], DOM.KINGDOM, { startActive: 0 });
  rv.players[0].hand = ['bureaucrat'];
  rv.players[1].hand = ['estate', 'copper', 'copper'];
  rv = E.reduce(rv, { type: 'PLAY_ACTION', card: 'bureaucrat' });
  rv = E.reduce(rv, { type: 'BUREAUCRAT_PUT', card: 'estate' });
  setState(rv);
  // 相手(席1)のチップに公開バッジが付き、タップ可能になる
  const chip = $('.opp-chip.has-reveal');
  ok(chip, '公開した相手チップに has-reveal が付く');
  ok($('.opp-chip .reveal-badge .reveal-badge-img'), 'チップに公開カードのミニ画像バッジ');
  // タップで公開カード一覧ポップアップ
  chip.click();
  ok($('.reveal-modal'), 'チップをタップで公開一覧ポップアップ');
  ok($('.reveal-modal').textContent.includes('屋敷'), 'ポップアップに公開カード名（屋敷）');
  ok($('.reveal-modal .sheet-close'), 'ポップアップに常時見える✕がある');
  // ✕で閉じる
  $('.reveal-modal .sheet-close').click();
  ok(!$('.reveal-modal'), '✕で公開ポップアップが閉じる');

  console.log('=== カード説明: 同じ表示要求では作り直さない（スクロール保持の土台）===');
  go('setup');
  UI.sheet = { cardId: 'village' }; DOM.render();
  const host1 = doc.getElementById('sheet-host');
  const node1 = host1 && host1.querySelector('.sheet');
  ok(node1, 'カード説明が専用ホストに表示される');
  ok(node1 && !node1.textContent.includes('とじる'), '下部「とじる」は廃止（✕のみ）');
  ok(node1 && node1.querySelector('.sheet-close'), '右上✕がある');
  ok(doc.documentElement.classList.contains('modal-open'), '表示中は背面スクロールをロック(modal-open)');
  DOM.render(); // 背景の再描画（UI.sheet は同じ参照）
  const node2 = doc.getElementById('sheet-host').querySelector('.sheet');
  ok(node1 === node2, '同じ表示要求では sheet を作り直さない＝スクロール位置が保たれる');
  UI.sheet = null; DOM.render();
  ok(!doc.getElementById('sheet-host'), '閉じるとホストが撤去される');
  ok(!doc.documentElement.classList.contains('modal-open'), '閉じると背面ロック解除');

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
