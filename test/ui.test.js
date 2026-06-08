/* UI 統合テスト（jsdom）— 新UI（設定/遊び方/一覧/拡大/CPU/多人数）
   使い方: node test/ui.test.js
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = '<!DOCTYPE html><html><body><div id="app"></div></body></html>';
const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;

// タイマーをモック（CPU自動進行を手動でポンプするため）
const timers = [];
let timerId = 1;
win.setTimeout = (fn) => { const id = timerId++; timers.push({ id, fn }); return id; };
win.clearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
function pump(max) { let n = 0; while (timers.length && n < (max || 3000)) { timers.shift().fn(); n++; } return n; }

let runtimeError = null;
win.addEventListener('error', (e) => { runtimeError = e.error || e.message; });
function load(f) { win.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')); }
['js/cards.js', 'js/engine.js', 'js/cpu.js', 'js/store.js', 'js/net.js', 'js/audio.js', 'js/ui.js'].forEach(load);
win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

const doc = win.document;
const DOM = win.DOM;
const UI = DOM.UI;
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function byText(sel, t) { return $all(sel).find((e) => e.textContent.trim() === t); }
function clickText(sel, t) { const el = byText(sel, t); if (!el) throw new Error('要素なし: ' + sel + '=' + t); el.click(); }
function clickContains(sel, t) { const el = $all(sel).find((e) => e.textContent.includes(t)); if (!el) throw new Error('要素なし(部分): ' + sel + '=' + t); el.click(); }
function setState(s) { UI.store.state = s; DOM.render(); timers.length = 0; }
function go(v) { UI.view = v; UI.sheet = null; DOM.render(); timers.length = 0; }

try {
  console.log('=== ホームメニュー ===');
  ok($('.home h1').textContent === 'Dominion', 'タイトル');
  ok(byText('button', '対戦をはじめる'), '対戦をはじめるボタン');
  ok(byText('button', '1台で2人プレイ（クイック）'), 'クイックボタン');
  ok(byText('button', '📖 遊び方'), '遊び方ボタン');
  ok(byText('button', '🃏 カード一覧'), 'カード一覧ボタン');

  console.log('=== 遊び方画面 ===');
  clickText('button', '📖 遊び方');
  ok($('.rules'), '遊び方表示');
  ok(doc.body.textContent.includes('目的') && doc.body.textContent.includes('ターンの流れ'), 'ルール内容');
  clickText('button', '← 戻る');
  ok($('.home h1'), 'ホームへ戻る');

  console.log('=== カード一覧 → 拡大 ===');
  clickText('button', '🃏 カード一覧');
  ok($('.cardlist-grid'), 'カード一覧グリッド');
  ok($all('.cardlist-grid .card').length >= 17, '17枚以上表示: ' + $all('.cardlist-grid .card').length);
  byText('.cardlist-grid .card .cname', '村').closest('.card').click();
  ok($('.zoom-img'), '拡大画像');
  ok($('.zoom-name').textContent === '村', '拡大: カード名');
  ok($('.zoom-text').textContent.includes('アクション'), '拡大: 効果テキスト');
  clickText('.sheet .btn', 'とじる');
  clickText('button', '← 戻る');

  console.log('=== 設定画面（人数・CPU） ===');
  clickText('button', '対戦をはじめる');
  ok($('.setup'), '設定画面');
  ok(byText('.seg-btn', '3人'), '人数セグメント');
  // デフォルトは 人間 vs CPU
  ok(UI.setup.seats.length === 2 && UI.setup.seats[1].type === 'cpu', 'デフォルト: 2人目がCPU');
  clickText('button', 'この設定で開始');
  ok(UI.view === 'game' && UI.store, 'ゲーム開始');
  let st = UI.store.state;
  ok(st.players.length === 2 && st.players[1].isCpu === true, '人間vsCPU構成');
  ok(st.players[0].isCpu === false, '席0は人間');

  console.log('=== 盤面の構造（種類別サプライ・手札グループ・他プレイヤー） ===');
  st = UI.store.state;
  st.turn = { active: 0, phase: 'action', actions: 1, buys: 1, coins: 0 };
  st.players[0].hand = ['village', 'smithy', 'copper', 'copper', 'estate'];
  st.players[0].deck = ['gold', 'silver', 'copper', 'copper', 'copper'];
  setState(st);
  ok($all('.supply-section').length === 3, 'サプライ3セクション（財宝/勝利点/王国）');
  ok($('.supply-grid.big'), '王国は大きいグリッド');
  ok($('.supply-grid.small'), '財宝/勝利点は小さいグリッド');
  ok($('.hand-cards.big'), 'アクションの手札グループ');
  ok($('.hand-cards.small'), '財宝/勝利点の手札グループ');
  ok($('.others .opp-chip'), '他プレイヤー表示');
  // 重ねバッジ（銅貨×2）
  ok($all('.count-badge').some((b) => b.textContent.includes('×2')), '同カードは×2バッジ');

  console.log('=== アクション: 村をタップ→拡大→使う ===');
  byText('.hand-cards.big .card .cname', '村').closest('.card').click();
  ok($('.zoom-name').textContent === '村', '村の拡大表示');
  ok(byText('.sheet .btn', '使う'), '使うボタン');
  clickText('.sheet .btn', '使う');
  ok(UI.store.state.turn.actions === 2, '村で+2アクション: ' + UI.store.state.turn.actions);
  ok(UI.store.state.players[0].inPlay.includes('village'), '村が場に');

  console.log('=== 購入フェーズ → 銀貨購入 ===');
  clickText('.actions-bar button', '購入フェーズへ ▶');
  // 村を引いてアクションがまだ使えるので、購入フェーズ移行に確認ダイアログが出る
  ok(byText('.confirm-modal .btn', '購入フェーズへ進む'), 'アクションが使えるのに購入フェーズへ→確認が出る');
  ok(UI.store.state.turn.phase === 'action', '確認中はまだアクションフェーズ');
  byText('.confirm-modal .btn', '購入フェーズへ進む').click(); // 進む
  ok(UI.store.state.turn.phase === 'buy', '確認OKで購入フェーズへ');
  clickText('.actions-bar button', '財宝を全部出す');
  st = UI.store.state; st.turn.coins = 6; st.turn.buys = 1; setState(st);
  byText('.supply-grid .pile .pname', '銀貨').closest('.pile').click();
  ok($('.zoom-img'), 'サプライも拡大表示');
  clickContains('.sheet .btn', '購入する');
  ok(UI.store.state.players[0].discard.includes('silver'), '銀貨購入');

  console.log('=== CPUの自動進行 ===');
  // 人間(0)がターンを終える → CPU(1)が自動で1ターン進める
  timers.length = 0;
  clickText('.actions-bar button', 'ターンを終える');
  ok(UI.store.state.turn.active === 1, 'CPUの手番に');
  ok(UI._cpuTimer || timers.length > 0, 'CPUの自動処理が予約された');
  const pumped = pump(3000);
  ok(pumped > 0, 'CPUが手を進めた（' + pumped + '手）');
  ok(UI.store.state.gameOver || UI.store.state.turn.active === 0, 'CPUのターンが終わり人間に戻る/または終了');
  ok(UI.store.state.players[1].turns >= 1, 'CPUが1ターン消化');

  console.log('=== 3人ゲーム（人間1 + CPU2） ===');
  go('home');
  clickText('button', '対戦をはじめる');
  clickText('.seg-btn', '3人');
  ok(UI.setup.seats.length === 3, '3人に拡張');
  clickText('button', 'この設定で開始');
  ok(UI.store.state.players.length === 3, '3人で開始');
  ok(UI.store.state.supply.curse === 20 && UI.store.state.supply.province === 12, '3人のサプライ枚数');
  ok($all('.others .opp-chip').length === 2, '他プレイヤー2人表示');
  timers.length = 0;

  console.log('=== 工房モーダル（人間） ===');
  st = UI.store.state;
  st.turn = { active: 0, phase: 'action', actions: 1, buys: 1, coins: 0 };
  st.pending = null;
  st.players[0].isCpu = false;
  st.players[0].hand = ['workshop', 'copper', 'copper', 'copper', 'estate'];
  UI.localViewer = 0;
  setState(st);
  byText('.hand-cards.big .card .cname', '工房').closest('.card').click();
  clickText('.sheet .btn', '使う');
  ok($('.modal') && $('.modal h3').textContent.includes('工房'), '工房モーダル');
  clickContains('.modal .card', '村');
  ok(UI.store.state.players[0].discard.includes('village'), '工房で村を獲得');

  console.log('=== 民兵→相手CPUの対応も自動 ===');
  st = UI.store.state;
  st.turn = { active: 0, phase: 'action', actions: 1, buys: 1, coins: 0 };
  st.pending = null;
  st.players[0].hand = ['militia', 'copper', 'copper'];
  st.players[1].hand = ['copper', 'copper', 'silver', 'estate', 'duchy']; // CPU 5枚
  st.players[2].hand = ['gold', 'gold', 'estate', 'estate', 'copper'];    // CPU 5枚
  setState(st);
  byText('.hand-cards.big .card .cname', '民兵').closest('.card').click();
  clickText('.sheet .btn', '使う');
  ok(UI.store.state.pending && UI.store.state.pending.type === 'militia', '民兵で相手が選択待ち');
  // 相手はCPUなので自動で捨てる
  const m = pump(50);
  ok(UI.store.state.pending === null, 'CPU2人が自動で対応完了');
  ok(UI.store.state.players[1].hand.length === 3 && UI.store.state.players[2].hand.length === 3, '両CPUが3枚に');

  console.log('=== クイック2人（パスゲート維持） ===');
  go('home');
  clickText('button', '1台で2人プレイ（クイック）');
  clickText('button', 'ゲーム開始');
  ok(UI.store.state.players.length === 2 && !UI.store.state.players[1].isCpu, 'クイックは2人とも人間');
  st = UI.store.state; st.turn = { active: 0, phase: 'buy', actions: 1, buys: 1, coins: 0 };
  st.players[0].hand = []; setState(st);
  clickText('.actions-bar button', 'ターンを終える');
  ok($('.gate'), '人間→人間はパスゲート');
  clickText('.gate .btn', 'タップして手札を見る');
  ok(!$('.gate') && UI.store.state.turn.active === 1, 'ゲート解除で相手の番');

  console.log('=== 勝敗画面 ===');
  st = UI.store.state;
  st.gameOver = true;
  st.result = { scores: [{ name: 'P1', vp: 12, turns: 8 }, { name: 'P2', vp: 9, turns: 8 }], winners: [0], reason: '属州の山が尽きた' };
  setState(st);
  ok($('.result') && $('.result h1').textContent.includes('勝ち'), '勝敗画面');
  ok($all('.score-row').length === 2, '2人のスコア');
  ok(byText('.result .btn', 'もう一度（同設定）'), '再戦ボタン');

  console.log('=== ゲーム中にTOPへ戻る ===');
  go('home');
  clickText('button', '1台で2人プレイ（クイック）');
  clickText('button', 'ゲーム開始');
  ok($('.board') && $('.home-btn'), '盤面にTOPボタンがある');
  $('.home-btn').click();
  ok($('.confirm-modal'), '確認ダイアログ表示');
  clickText('.confirm-modal .btn', '戻る');
  ok(!$('.confirm-modal'), '「戻る」で閉じる・対戦継続');
  $('.home-btn').click();
  clickText('.confirm-modal .btn', 'TOPに戻る');
  ok(UI.view === 'home' && $('.home h1'), 'TOPに戻った');

  ok(runtimeError === null, '実行時エラーなし: ' + (runtimeError ? (runtimeError.stack || runtimeError) : ''));
} catch (e) {
  fail++;
  console.log('  ✗ 例外: ' + (e.stack || e.message));
}

console.log('\n========================================');
console.log(`UIテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
