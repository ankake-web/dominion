/* ギルド（Guilds）UI スモーク（jsdom）
   各 pending の選択モーダル・財源バッジ/使用ボタン・過払い/肉屋の数量ステッパーが描画できるかを確認。
   使い方: node test/guilds-ui.test.js */
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
  UI.coffersOpen = false; UI.amount = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const K = DOM.POOLS.guilds.slice(); // 全13種＝全ギルドカードがサプライに出る
function mk() { return E.createInitialState(['あなた', '相手'], K, { startActive: 0 }); }
function play(s, card) { return E.reduce(s, { type: 'PLAY_ACTION', card }); }
function showPend(pd, setup) {
  const s = mk();
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}

try {
  console.log('=== ギルドセット・財源バッジが描画される ===');
  ok(DOM.KINGDOM_GUILDS.length === 10 && DOM.KINGDOM_GUILDS.every((id) => DOM.CARDS[id]), 'ギルドKINGDOMは10種・全て実在');
  {
    let s = mk(); s.turn.phase = 'buy'; s.players[0].coffers = 3;
    showAs(s, 0);
    ok(!runtimeError && byText('.badge', '財源'), '盤面に財源バッジが出る');
    ok(byText('.badge .v', '3') != null || byText('.badge', '3'), '財源の数量が表示される');
  }

  console.log('=== 財源を使う: ボタン＋数量ステッパーモーダル ===');
  {
    let s = mk(); s.turn.phase = 'buy'; s.players[0].coffers = 2;
    showAs(s, 0);
    ok(byText('button', '財源を使う'), '購入フェイズに「財源を使う」ボタンが出る');
    // ステッパーモーダルを開く
    UI.coffersOpen = true; UI.amount = null; runtimeError = null; DOM.render();
    ok($('.modal') && byText('*', '財源を使う') && !runtimeError, '財源使用モーダル（ステッパー）が描画できる');
  }

  console.log('=== 過払い（overpay）モーダル：数量ステッパー ===');
  showPend({ type: 'overpay', player: 0, card: 'masterpiece', max: 3 });
  ok($('.modal') && byText('*', '過払い') && byText('*', '名品') && !runtimeError, '名品の過払いステッパー');
  showPend({ type: 'overpay', player: 0, card: 'stonemason', max: 4 });
  ok($('.modal') && byText('*', '過払い') && !runtimeError, '石工の過払いステッパー');
  showPend({ type: 'stonemason_overpay', player: 0, exact: 4, remaining: 2 });
  ok($('.modal') && byText('*', '石工') && !runtimeError, '石工過払い：アクション獲得モーダル');
  showPend({ type: 'doctor_overpay', player: 0, remaining: 2, card: 'estate' });
  ok($('.modal') && byText('*', '医者') && byText('button', '廃棄') && !runtimeError, '医者過払い：廃棄/捨て/戻すモーダル');
  showPend({ type: 'herald_overpay', player: 0, remaining: 2 }, (s) => { s.players[0].discard = ['gold', 'estate']; });
  ok($('.modal') && byText('*', '伝令官') && !runtimeError, '伝令官過払い：捨て札から山札の上へ');

  console.log('=== 各カードの pending モーダルが描画される ===');
  { let s = mk(); s.players[0].hand = ['stonemason', 'gold']; s = play(s, 'stonemason'); showAs(s, 0); ok($('.modal') && byText('*', '石工') && !runtimeError, '石工 廃棄モーダル'); }
  showPend({ type: 'stonemason', stage: 'gain', player: 0, maxCost: 6, remaining: 2 });
  ok($('.modal') && byText('*', '石工') && !runtimeError, '石工 獲得モーダル');
  { let s = mk(); s.players[0].hand = ['doctor']; s.players[0].deck = ['estate', 'copper', 'gold']; s = play(s, 'doctor'); showAs(s, 0); ok($('.modal') && byText('*', '医者') && !runtimeError, '医者 指定モーダル'); }
  showPend({ type: 'doctor', stage: 'order', player: 0, cards: ['gold', 'silver', 'copper'] });
  ok($('.modal') && byText('*', '医者') && !runtimeError, '医者 並べ替えモーダル');
  showPend({ type: 'advisor', player: 1, source: 0, cards: ['gold', 'silver', 'estate'] }, (s) => { s.players[1].hand = ['copper']; });
  ok($('.modal') && byText('*', '助言者') && byText('*', '捨てさせる') && !runtimeError, '助言者 左隣の選択モーダル');
  { let s = mk(); s.players[0].hand = ['plaza', 'copper']; s.players[0].deck = ['silver', 'gold']; s = play(s, 'plaza'); showAs(s, 0); ok($('.modal') && byText('*', '広場') && !runtimeError, '広場 財宝捨てモーダル'); }
  { let s = mk(); s.players[0].hand = ['taxman', 'copper']; s = play(s, 'taxman'); showAs(s, 0); ok($('.modal') && byText('*', '収税吏') && !runtimeError, '収税吏 財宝廃棄モーダル'); }
  showPend({ type: 'taxman', stage: 'gain', player: 0, trashedName: 'copper', maxCost: 3 });
  ok($('.modal') && byText('*', '収税吏') && !runtimeError, '収税吏 財宝獲得モーダル');
  showPend({ type: 'taxman', stage: 'react', player: 1, source: 0, victim: 1, queue: [], trashedName: 'copper' }, (s) => { s.players[1].hand = ['moat']; });
  ok($('.modal') && byText('button', '受ける') && !runtimeError, '収税吏 リアクション');
  { let s = mk(); s.players[0].hand = ['butcher', 'estate']; s = play(s, 'butcher'); showAs(s, 0); ok($('.modal') && byText('*', '肉屋') && !runtimeError, '肉屋 廃棄モーダル'); }
  showPend({ type: 'butcher', stage: 'pay', player: 0, trashedCost: 2 }, (s) => { s.players[0].coffers = 4; });
  ok($('.modal') && byText('*', '肉屋') && byText('*', '財源') && !runtimeError, '肉屋 財源支払いステッパー');
  showPend({ type: 'butcher', stage: 'gain', player: 0, maxCost: 5 });
  ok($('.modal') && byText('*', '肉屋') && !runtimeError, '肉屋 獲得モーダル');
  { let s = mk(); s.players[0].hand = ['journeyman']; s = play(s, 'journeyman'); showAs(s, 0); ok($('.modal') && byText('*', '熟練工') && !runtimeError, '熟練工 指定モーダル'); }
  showPend({ type: 'soothsayer', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; });
  ok($('.modal') && byText('button', '受ける') && !runtimeError, '予言者 リアクション');

  console.log('=== 財源を使う王国の盤面（描画エラーなし）===');
  {
    let s = mk(); s.turn.phase = 'buy'; s.players[0].coffers = 1;
    showAs(s, 0);
    ok(!runtimeError, '財源を含む盤面が描画できる');
  }

} catch (e) {
  fail++; console.log('  ✗ 例外: ' + (e && e.stack || e));
}

console.log('\n========================================');
console.log('ギルドUIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
