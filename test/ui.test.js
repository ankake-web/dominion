/* UI 統合テスト（jsdom で実DOMを描画してクリック操作を検証）
   使い方: node test/ui.test.js
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = '<!DOCTYPE html><html><body><div id="app"></div></body></html>';
const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;

// 例外を捕捉
let runtimeError = null;
win.addEventListener('error', (e) => { runtimeError = e.error || e.message; });

function load(f) {
  const code = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  win.eval(code);
}
['firebase-config.js', 'js/cards.js', 'js/engine.js', 'js/store.js', 'js/ui.js'].forEach(load);
// jsdom(outside-only)では DOMContentLoaded が自動発火しないため明示的に発火
win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

const doc = win.document;
const DOM = win.DOM;
const UI = DOM.UI;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ FAIL: ' + msg); } }
function $(sel) { return doc.querySelector(sel); }
function $all(sel) { return Array.from(doc.querySelectorAll(sel)); }
function byText(sel, text) { return $all(sel).find((e) => e.textContent.trim() === text); }
function clickText(sel, text) {
  const el = byText(sel, text);
  if (!el) throw new Error('要素が見つからない: ' + sel + ' = "' + text + '"');
  el.click();
}
function clickChip(name) {
  // チップは「コスト＋名前(＋残数)」なので部分一致で探す
  const el = $all('.modal .chip').find((c) => c.textContent.includes(name));
  if (!el) throw new Error('チップが見つからない: ' + name);
  el.click();
}
function setState(s) { UI.store.state = s; DOM.render(); }

try {
  console.log('=== ホーム画面 ===');
  ok($('.home h1') && $('.home h1').textContent === 'Dominion', 'タイトル表示');
  ok(byText('button', '1台で2人プレイ'), 'ローカル開始ボタン');

  console.log('=== ローカル設定 → 開始 ===');
  clickText('button', '1台で2人プレイ');
  ok(byText('button', 'ゲーム開始'), '設定画面へ');
  clickText('button', 'ゲーム開始');
  ok(UI.view === 'game' && UI.store, 'ゲーム開始');
  ok($('.supply-grid'), 'サプライ表示');
  ok($('.hand-row'), '手札表示');
  ok($('.topbar'), '上部バー');

  console.log('=== アクション: 村をタップ→使う ===');
  let st = UI.store.state;
  st.players[0].hand = ['village', 'smithy', 'copper', 'copper', 'estate'];
  st.players[0].deck = ['gold', 'silver', 'copper', 'copper', 'copper'];
  st.turn = { active: 0, phase: 'action', actions: 1, buys: 1, coins: 0 };
  setState(st);
  ok(byText('.card .cname', '村'), '村が手札に表示');
  byText('.card .cname', '村').closest('.card').click();
  ok($('.sheet'), 'カード詳細シートが開く');
  ok(byText('.sheet .btn', '使う'), '「使う」ボタン');
  clickText('.sheet .btn', '使う');
  ok(UI.store.state.turn.actions === 2, '村で +2アクション(=2): ' + UI.store.state.turn.actions);
  ok(UI.store.state.players[0].inPlay.includes('village'), '村が場に出た');
  ok(!$('.sheet'), 'シートが閉じた');

  console.log('=== アクションフェーズ終了 → 購入 ===');
  clickText('.actions-bar button', '購入フェーズへ ▶');
  ok(UI.store.state.turn.phase === 'buy', '購入フェーズへ');
  ok(byText('.actions-bar button', '財宝を全部出す'), '財宝ボタン');
  clickText('.actions-bar button', '財宝を全部出す');
  ok(UI.store.state.turn.coins >= 2, '財宝でコイン: ' + UI.store.state.turn.coins);

  console.log('=== 購入: 銀貨を買う ===');
  st = UI.store.state; st.turn.coins = 6; st.turn.buys = 1; setState(st);
  byText('.pile .pname', '銀貨').closest('.pile').click();
  ok($('.sheet'), '購入シート表示');
  const buyBtn = $all('.sheet .btn').find((b) => b.textContent.includes('購入する'));
  ok(buyBtn, '購入ボタン表示');
  buyBtn.click();
  ok(UI.store.state.players[0].discard.includes('silver'), '銀貨を購入');

  console.log('=== ターン終了 → パスゲート ===');
  clickText('.actions-bar button', 'ターンを終える');
  ok($('.gate'), '相手へ渡すパスゲート表示');
  ok(byText('.gate h2', UI.store.state.players[1].name + ' さんの番です') || $('.gate h2'), 'パスゲート見出し');
  clickText('.gate .btn', 'タップして手札を見る');
  ok(!$('.gate'), 'ゲート解除');
  ok(UI.store.state.turn.active === 1, '手番がプレイヤー2');

  console.log('=== 工房モーダル ===');
  st = UI.store.state;
  st.turn = { active: 1, phase: 'action', actions: 1, buys: 1, coins: 0 };
  st.players[1].hand = ['workshop', 'copper', 'copper', 'copper', 'estate'];
  setState(st);
  byText('.card .cname', '工房').closest('.card').click();
  clickText('.sheet .btn', '使う');
  ok($('.modal'), '工房の獲得モーダル表示');
  ok($('.modal h3').textContent.includes('工房'), 'モーダル見出し');
  clickChip('村');
  ok(UI.store.state.players[1].discard.includes('village'), '工房で村を獲得');
  ok(!$('.modal'), 'モーダル解除');

  console.log('=== 地下貯蔵庫モーダル（複数選択） ===');
  st = UI.store.state;
  st.turn = { active: 1, phase: 'action', actions: 1, buys: 1, coins: 0 };
  st.players[1].hand = ['cellar', 'estate', 'estate', 'copper', 'copper'];
  st.players[1].deck = ['gold', 'silver', 'province', 'duchy'];
  setState(st);
  byText('.card .cname', '地下貯蔵庫').closest('.card').click();
  clickText('.sheet .btn', '使う');
  ok($('.modal h3').textContent.includes('地下貯蔵庫'), '地下貯蔵庫モーダル');
  // 屋敷2枚を選択
  const chips = $all('.modal .chip').filter((c) => c.textContent.includes('屋敷'));
  chips.forEach((c) => c.click());
  const confirmBtn = $all('.modal .btn').find((b) => b.textContent.includes('捨てる'));
  ok(confirmBtn, '確定ボタン');
  confirmBtn.click();
  ok(UI.store.state.players[1].discard.filter((c) => c === 'estate').length === 2, '屋敷2枚を捨てた');
  ok(!$('.modal'), 'モーダル解除');

  console.log('=== 鉱山モーダル（2段階） ===');
  st = UI.store.state;
  st.turn = { active: 1, phase: 'action', actions: 1, buys: 1, coins: 0 };
  st.players[1].hand = ['mine', 'copper', 'estate', 'estate', 'estate'];
  setState(st);
  byText('.card .cname', '鉱山').closest('.card').click();
  clickText('.sheet .btn', '使う');
  ok($('.modal h3').textContent.includes('廃棄'), '鉱山 廃棄ステージ');
  clickChip('銅貨');
  ok($('.modal h3').textContent.includes('獲得'), '鉱山 獲得ステージ');
  clickChip('銀貨');
  ok(UI.store.state.players[1].hand.includes('silver'), '鉱山で銀貨を手札に');

  console.log('=== 改築モーダル（2段階） ===');
  st = UI.store.state;
  st.turn = { active: 1, phase: 'action', actions: 1, buys: 1, coins: 0 };
  st.players[1].hand = ['remodel', 'estate', 'copper', 'copper', 'copper'];
  setState(st);
  byText('.card .cname', '改築').closest('.card').click();
  clickText('.sheet .btn', '使う');
  ok($('.modal h3').textContent.includes('廃棄'), '改築 廃棄ステージ');
  clickChip('屋敷');
  ok($('.modal h3').textContent.includes('獲得'), '改築 獲得ステージ');
  // コスト4以下を獲得（鍛冶屋）
  const smithyChip = $all('.modal .chip').find((c) => c.textContent.includes('鍛冶屋'));
  ok(smithyChip, '鍛冶屋が選べる');
  smithyChip.click();
  ok(UI.store.state.players[1].discard.includes('smithy'), '改築で鍛冶屋を獲得');

  console.log('=== 民兵モーダル＋堀 ===');
  // プレイヤー1の番にして民兵をプレイ、相手(2)が5枚＋堀
  st = UI.store.state;
  st.turn = { active: 0, phase: 'action', actions: 1, buys: 1, coins: 0 };
  st.pending = null;
  st.players[0].hand = ['militia', 'copper', 'copper'];
  st.players[1].hand = ['moat', 'copper', 'silver', 'estate', 'duchy'];
  UI.localViewer = 0;
  setState(st);
  byText('.card .cname', '民兵').closest('.card').click();
  clickText('.sheet .btn', '使う');
  // 相手の選択待ち → パスゲート（actor=1）
  ok($('.gate'), '民兵で相手へパスゲート');
  clickText('.gate .btn', 'タップして手札を見る');
  ok($('.modal h3').textContent.includes('民兵'), '民兵モーダル');
  ok($all('.modal .btn').some((b) => b.textContent.includes('堀')), '堀の無効化ボタン表示');
  clickText('.modal .btn', '🛡 堀を公開して無効化');
  ok(UI.store.state.pending === null, '堀で無効化、選択待ち解消');
  ok(UI.store.state.players[1].hand.length === 5, '手札そのまま5枚');

  console.log('=== 勝敗画面 ===');
  st = UI.store.state;
  st.gameOver = true;
  st.result = { scores: [{ name: 'プレイヤー1', vp: 12, turns: 8 }, { name: 'プレイヤー2', vp: 9, turns: 8 }], winners: [0], reason: '属州の山が尽きた' };
  setState(st);
  ok($('.result'), '勝敗画面表示');
  ok($('.result h1').textContent.includes('勝ち'), '勝者表示');
  ok($all('.score-row').length === 2, '2人のスコア行');
  ok(byText('.result .btn', 'もう一度遊ぶ'), '再戦ボタン');
  clickText('.result .btn', 'もう一度遊ぶ');
  ok(!UI.store.state.gameOver, '再戦で新ゲーム');

  ok(runtimeError === null, '実行時エラーなし: ' + (runtimeError ? (runtimeError.stack || runtimeError) : ''));
} catch (e) {
  fail++;
  console.log('  ✗ 例外: ' + (e.stack || e.message));
}

console.log('\n========================================');
console.log(`UIテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
