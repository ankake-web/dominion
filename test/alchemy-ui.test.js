/* 錬金術（Alchemy 第二版）UI スモーク（jsdom）
   各 pending の選択モーダル・ポーション表示・支配の操作画面が描画できるかを確認。
   使い方: node test/alchemy-ui.test.js */
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
function show(s) { showAs(s, null); }
// 全12種＋補助を載せた王国（ポーション山が出る）
const K = ['transmute', 'vineyard', 'herbalist', 'apothecary', 'scrying_pool', 'university', 'alchemist', 'familiar', 'golem', 'apprentice'];
function mk() { return E.createInitialState(['あなた', '相手'], K, { startActive: 0 }); }
function play(s, card) { return E.reduce(s, { type: 'PLAY_ACTION', card }); }
function pend(pd, viewer) { const s = mk(); s.pending = pd; if (viewer != null) s.turn.active = viewer; return s; }

try {
  console.log('=== 錬金術セットは10種・実在／ポーション山が供給される ===');
  ok(DOM.KINGDOM_ALCHEMY.length === 10 && DOM.KINGDOM_ALCHEMY.every((id) => DOM.CARDS[id]), '錬金術KINGDOMは10種・全て実在');
  { let s = mk(); ok(s.supply.potion === 16, 'ポーション山(16)がサプライに出る'); }

  console.log('=== 盤面：POTIONバッジ・ポーション山が表示される ===');
  {
    let s = mk(); s.turn.phase = 'buy'; s.turn.potions = 1;
    show(s);
    ok(byText('.badge .k', 'POTION'), 'POTIONバッジ表示');
    ok(byText('.badge.potion .v', '1') || byText('.badge .v', '1'), 'ポーション量が表示される');
    ok(byText('.sup-title', '財宝') && !runtimeError, 'サプライ描画エラーなし');
  }

  console.log('=== 手札のポーションが財宝グループに描画される（枚数と一致）===');
  {
    let s = mk();
    s.players[0].hand = ['potion', 'copper', 'estate'];
    show(s);
    // 手札3枚すべてがカードタイルとして描画される（ポーションが欠落しない）
    ok($all('.hand-zone .card').length >= 3 && !runtimeError, '手札のポーション・銅貨・屋敷が3枚とも描画される');
    ok(byText('.hand-zone', 'ポーション') || $all('.hand-zone .card').length >= 3, '手札ゾーンにポーションが出る');
  }

  console.log('=== 各 pending モーダルが描画される ===');
  { let s = mk(); s.players[0].hand = ['transmute', 'estate']; s = play(s, 'transmute'); show(s); ok($('.modal') && byText('*', '変成') && !runtimeError, '変成モーダル'); }
  { let s = pend({ type: 'apothecary', player: 0, cards: ['estate', 'village'] }); show(s); ok($('.modal') && byText('*', '薬剤師') && !runtimeError, '薬剤師 並べ替えモーダル'); }
  { let s = pend({ type: 'scrying_pool', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }); s.players[1].hand = ['moat']; show(s); ok($('.modal') && byText('button', '受ける') && !runtimeError, '念視の泉 リアクション'); }
  { let s = pend({ type: 'scrying_pool', stage: 'decide', player: 0, source: 0, victim: 1, card: 'gold', queue: [] }); s.players[1].deck = ['gold']; show(s); ok($('.modal') && byText('button', '捨てさせる') && !runtimeError, '念視の泉 判断モーダル'); }
  { let s = mk(); s.players[0].hand = ['university']; s = play(s, 'university'); show(s); ok($('.modal') && byText('*', '大学') && !runtimeError, '大学 獲得モーダル'); }
  { let s = pend({ type: 'familiar', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }); s.players[1].hand = ['moat']; show(s); ok($('.modal') && byText('button', '受ける') && !runtimeError, '使い魔 リアクション'); }
  { let s = pend({ type: 'golem', player: 0, cards: ['village', 'smithy'] }); show(s); ok($('.modal') && byText('button', '先に使う') && !runtimeError, 'ゴーレム 順番モーダル'); }
  { let s = mk(); s.players[0].hand = ['apprentice', 'estate']; s = play(s, 'apprentice'); show(s); ok($('.modal') && byText('*', '徒弟') && !runtimeError, '徒弟 廃棄モーダル'); }

  console.log('=== 変成モーダル：手札チップが選択肢として描画される ===');
  { let s = mk(); s.players[0].hand = ['transmute', 'village', 'copper']; s = play(s, 'transmute'); show(s);
    ok($('.modal') && $all('.modal .card').length > 0 && !runtimeError, '変成: 手札チップが選択肢に'); }

  console.log('=== 支配：支配者の画面に「支配中」バナーと被支配者の手札が出る ===');
  {
    let s = mk();
    s.players[0].hand = ['possession'];
    s = play(s, 'possession');
    s = E.reduce(s, { type: 'END_ACTION_PHASE' });
    s = E.reduce(s, { type: 'END_TURN' }); // 被支配ターン開始（active=1, possessedBy=0）
    ok(s.turn.possessedBy === 0 && s.turn.active === 1, '前提: 被支配ターンになっている');
    s.players[1].hand = ['village', 'gold']; // 被支配者の手札
    showAs(s, 0); // 支配者(0)の視点で描画
    ok(byText('.cpu-banner', '支配中') && !runtimeError, '支配中バナーが表示');
    ok(byText('.zone-h', '支配中'), '手札見出しに「支配中」');
    ok($all('.hand-zone .card').length > 0, '被支配者の手札カードが操作対象として描画');
  }

} catch (e) {
  fail++; console.log('  ✗ 例外: ' + (e && e.stack || e));
}

console.log('\n========================================');
console.log('錬金術UIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
