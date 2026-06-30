/* 繁栄（Prosperity 第二版）UI スモーク（jsdom）
   各 pending の選択モーダルが描画でき、盤面にプラチナ貨/植民地/VPトークンが出るかを確認。
   使い方: node test/prosperity-ui.test.js */
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
const K = DOM.KINGDOM_PROSPERITY;
function mk() { return E.createInitialState(['あなた', '相手'], K, { startActive: 0 }); }
function pend(pd, viewer) { const s = mk(); s.pending = pd; if (viewer != null) s.turn.active = viewer; return s; }

try {
  console.log('=== 繁栄セットは10種・実在 ===');
  ok(K.length === 10 && K.every((id) => DOM.CARDS[id]), '繁栄KINGDOMは10種・全て実在');

  console.log('=== 盤面：プラチナ貨/植民地の山・VPトークンが表示される ===');
  {
    let s = mk();
    s.players[0].vpTokens = 7;
    show(s);
    ok($('[data-pile="platinum"]') && !runtimeError, '盤面にプラチナ貨の山');
    ok($('[data-pile="colony"]'), '盤面に植民地の山');
    ok(byText('.mat-label', '勝利点トークン') && byText('.mat-label', '7'), 'VPトークン 7点 が表示される');
  }

  console.log('=== 各 pending の選択モーダルが描画できる ===');
  { let s = pend({ type: 'bishop', stage: 'trash', player: 0 }); s.players[0].hand = ['gold', 'estate']; show(s); ok($('.modal') && byText('*', '司教') && !runtimeError, '司教 廃棄モーダル'); }
  { let s = pend({ type: 'bishop', stage: 'other', player: 0 }); s.players[0].hand = ['estate', 'copper']; show(s); ok($('.modal') && byText('button', '廃棄しない') && !runtimeError, '司教 他者廃棄モーダル'); }
  { let s = pend({ type: 'vault', stage: 'discard', player: 0 }); s.players[0].hand = ['estate', 'copper', 'gold']; show(s); ok($('.modal') && byText('*', '金庫室') && !runtimeError, '金庫室 捨てモーダル'); }
  { let s = pend({ type: 'vault', stage: 'other', player: 0 }); s.players[0].hand = ['estate', 'copper']; show(s); ok($('.modal') && byText('button', '捨てない') && !runtimeError, '金庫室 他者モーダル'); }
  { let s = pend({ type: 'mint', player: 0 }); s.players[0].hand = ['gold', 'estate']; show(s); ok($('.modal') && byText('button', '公開しない') && !runtimeError, '造幣所モーダル'); }
  { let s = pend({ type: 'expand', stage: 'trash', player: 0 }); s.players[0].hand = ['estate']; show(s); ok($('.modal') && byText('*', '拡張') && !runtimeError, '拡張 廃棄モーダル'); }
  { let s = pend({ type: 'expand', stage: 'gain', player: 0, maxCost: 5 }); show(s); ok($('.modal') && !runtimeError, '拡張 獲得モーダル'); }
  { let s = pend({ type: 'forge', stage: 'trash', player: 0 }); s.players[0].hand = ['estate', 'copper']; show(s); ok($('.modal') && byText('*', '溶鉱炉') && !runtimeError, '溶鉱炉 廃棄モーダル'); }
  { let s = pend({ type: 'forge', stage: 'gain', player: 0, exact: 4 }); show(s); ok($('.modal') && !runtimeError, '溶鉱炉 獲得モーダル'); }
  { let s = pend({ type: 'kings_court', player: 0 }); s.players[0].hand = ['monument', 'copper']; show(s); ok($('.modal') && byText('*', '王の宮廷') && !runtimeError, '王の宮廷モーダル'); }
  { let s = pend({ type: 'war_chest', stage: 'name', player: 1, source: 0 }); show(s); ok($('.modal') && byText('*', '軍用金') && !runtimeError, '軍用金 指定モーダル'); }
  { let s = pend({ type: 'war_chest', stage: 'gain', player: 0, source: 0 }); show(s); ok($('.modal') && !runtimeError, '軍用金 獲得モーダル'); }
  { let s = pend({ type: 'watchtower', player: 0, card: 'duchy', dest: 'discard' }); show(s); ok($('.modal') && byText('button', '山札の上に置く') && byText('button', '廃棄する') && !runtimeError, '物見やぐらモーダル'); }
  { let s = pend({ type: 'tiara_topdeck', player: 0, card: 'gold', dest: 'discard' }); show(s); ok($('.modal') && byText('button', '山札の上に置く') && !runtimeError, 'ティアラ 山札上モーダル'); }
  { let s = pend({ type: 'tiara_play', player: 0 }); s.players[0].hand = ['gold', 'silver']; show(s); ok($('.modal') && byText('button', '使わない') && !runtimeError, 'ティアラ 2回使うモーダル'); }
  { let s = pend({ type: 'anvil', stage: 'discard', player: 0 }); s.players[0].hand = ['copper', 'estate']; show(s); ok($('.modal') && byText('button', '捨てない') && !runtimeError, '金床 捨てモーダル'); }
  { let s = pend({ type: 'anvil', stage: 'gain', player: 0 }); show(s); ok($('.modal') && !runtimeError, '金床 獲得モーダル'); }
  { let s = pend({ type: 'investment', player: 0 }); s.players[0].hand = ['gold']; show(s); ok($('.modal') && byText('button', '+1 コイン') && !runtimeError, '投資 選択モーダル'); }
  { let s = pend({ type: 'investment', stage: 'trash', player: 0 }); s.players[0].hand = ['gold', 'silver']; show(s); ok($('.modal') && byText('*', '投資') && !runtimeError, '投資 廃棄モーダル'); }
  { let s = pend({ type: 'crystal_ball', player: 0, card: 'monument' }); show(s); ok($('.modal') && byText('button', '使う') && byText('button', '廃棄する') && !runtimeError, '水晶玉モーダル'); }
  { let s = pend({ type: 'charlatan', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }); s.players[1].hand = ['moat']; show(s); ok($('.modal') && byText('button', '受ける') && !runtimeError, 'ペテン師リアクション'); }
  { let s = pend({ type: 'rabble', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }); s.players[1].hand = ['moat']; show(s); ok($('.modal') && byText('button', '受ける') && !runtimeError, '群衆リアクション'); }
  { let s = pend({ type: 'clerk', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }); s.players[1].hand = ['moat']; show(s); ok($('.modal') && byText('button', '受ける') && !runtimeError, '会計士リアクション'); }
  { let s = pend({ type: 'clerk', stage: 'topdeck', player: 1, source: 0, victim: 1, queue: [] }); s.players[1].hand = ['copper', 'estate', 'gold', 'silver', 'duchy']; show(s); ok($('.modal') && byText('*', '会計士') && !runtimeError, '会計士 山札上モーダル'); }

  console.log('=== カード一覧に繁栄が出る ===');
  { UI.view = 'cardList'; DOM.render(); ok(byText('.section-h', '繁栄') && byText('.cardlist-grid .cname', '王の宮廷'), 'カード一覧に繁栄グループ＋王の宮廷'); }
} catch (e) {
  fail++; console.log('  ✗ 例外: ' + (e && e.stack || e));
}
console.log('\n繁栄UIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
process.exit(fail ? 1 : 0);
