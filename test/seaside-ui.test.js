/* 海辺（Seaside 第二版）UI スモーク（jsdom）
   各 pending の選択モーダルが描画でき、盤面に持続カード/マットが表示されるかを確認。
   使い方: node test/seaside-ui.test.js */
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
function show(s) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null;
  UI.localViewer = s.pending ? s.pending.player : (s.turn ? s.turn.active : 0);
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const K = DOM.KINGDOM_SEASIDE;
function mk() { return E.createInitialState(['あなた', '相手'], K, { startActive: 0 }); }
function play(s, card) { return E.reduce(s, { type: 'PLAY_ACTION', card }); }
// pending を直接立てて描画（開始時キュー系のモーダル確認用）
function pend(pd, viewer) { const s = mk(); s.pending = pd; if (viewer != null) s.turn.active = viewer; return s; }

try {
  console.log('=== 海辺セットは10種・実在 ===');
  ok(K.length === 10 && K.every((id) => DOM.CARDS[id]), '海辺KINGDOMは10種・全て実在');

  console.log('=== 盤面：持続カードと島/原住民マットが表示される ===');
  {
    let s = mk();
    s.players[0].durationCards = ['wharf', 'fishing_village'];
    s.players[0].islandMat = ['island', 'province'];
    s.players[0].nativeVillageMat = ['gold', 'silver'];
    show(s);
    ok(byText('.chip-card', 'wharf'.length ? '船着場' : '') || byText('.play-area .chip-card', '船着場'), '盤面に持続カード（船着場）が⏳付きで表示');
    ok(byText('.mat-label', '島マット'), '島マット表示');
    ok(byText('.mat-label', '原住民の村マット'), '原住民の村マット表示');
    ok(!runtimeError, '盤面描画でエラーなし');
  }

  console.log('=== 各 pending モーダルが描画される ===');
  { let s = mk(); s.players[0].hand = ['warehouse', 'copper', 'estate']; s.players[0].deck = ['copper', 'silver', 'gold']; s = play(s, 'warehouse'); show(s); ok($('.modal') && !runtimeError, '倉庫モーダル'); }
  { let s = mk(); s.players[0].hand = ['haven', 'gold']; s.players[0].deck = ['copper', 'copper']; s = play(s, 'haven'); show(s); ok($('.modal') && byText('*', '停泊所') && !runtimeError, '停泊所モーダル'); }
  { let s = mk(); s.players[0].hand = ['tactician', 'estate']; s = play(s, 'tactician'); show(s); ok($('.modal') && byText('button', '全て捨てる') && !runtimeError, '策士モーダル'); }
  { let s = mk(); s.players[0].hand = ['salvager', 'estate']; s = play(s, 'salvager'); show(s); ok($('.modal') && !runtimeError, '引揚水夫モーダル'); }
  { let s = mk(); s.players[0].hand = ['lookout']; s.players[0].deck = ['curse', 'estate', 'gold']; s = play(s, 'lookout'); show(s); ok($('.modal') && !runtimeError, '見張りモーダル'); }
  { let s = mk(); s.players[0].hand = ['island', 'province']; s = play(s, 'island'); show(s); ok($('.modal') && byText('*', '島マット') && !runtimeError, '島モーダル'); }
  { let s = mk(); s.players[0].hand = ['native_village']; s.players[0].deck = ['gold']; s = play(s, 'native_village'); show(s); ok($('.modal') && byText('button', 'マットに置く') && !runtimeError, '原住民の村モーダル'); }
  { let s = pend({ type: 'tide_pools_discard', player: 0 }); s.players[0].hand = ['copper', 'estate', 'gold']; show(s); ok($('.modal') && !runtimeError, '潮だまり捨てモーダル'); }
  { let s = pend({ type: 'cutpurse', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }); s.players[1].hand = ['moat', 'copper']; show(s); ok($('.modal') && byText('button', '受ける') && !runtimeError, '巾着切りリアクション'); }
  { let s = pend({ type: 'sea_witch', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }); s.players[1].hand = ['moat']; show(s); ok($('.modal') && byText('button', '受ける') && !runtimeError, '海の魔女リアクション'); }
  { let s = pend({ type: 'sea_witch_discard', player: 0 }); s.players[0].hand = ['copper', 'estate', 'gold']; show(s); ok($('.modal') && !runtimeError, '海の魔女2捨てモーダル'); }
  { let s = pend({ type: 'smugglers', player: 0, candidates: ['silver', 'gold'] }); show(s); ok($('.modal') && byText('button', '獲得') && !runtimeError, '密輸人モーダル'); }
  { let s = pend({ type: 'blockade', stage: 'gain', player: 0 }); show(s); ok($('.modal') && !runtimeError, '封鎖獲得モーダル'); }
  { let s = pend({ type: 'sailor_trash', player: 0 }); s.players[0].hand = ['copper', 'estate']; show(s); ok($('.modal') && byText('button', '廃棄しない') && !runtimeError, '船乗り廃棄モーダル'); }
  { let s = pend({ type: 'sailor_play_gain', player: 0, card: 'caravan', dest: 'discard' }); show(s); ok($('.modal') && byText('button', '使う') && byText('button', '使わない') && !runtimeError, '船乗り即プレイ確認モーダル'); }
  { let s = pend({ type: 'pirate_gain', player: 0 }); show(s); ok($('.modal') && !runtimeError, '海賊獲得モーダル'); }

  console.log('=== 島モーダル：選択チップが描画される ===');
  { let s = mk(); s.players[0].hand = ['island', 'province', 'copper']; s = play(s, 'island'); show(s);
    ok($('.modal') && $all('.modal .card').length > 0 && !runtimeError, '島: 手札チップが選択肢として描画'); }

} catch (e) {
  fail++; console.log('  ✗ 例外: ' + (e && e.stack || e));
}

console.log('\n========================================');
console.log('海辺UIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
