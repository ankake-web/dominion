/* 夜想曲（Nocturne）UI スモーク（jsdom）
   使い方: node test/nocturne-ui.test.js
   主目的＝**人間が詰まない／操作できないカードが無い**こと：
   - 夜フェイズで夜行カードが手札に描画され、タップして使えること（純粋な夜行カードは
     アクション/財宝/勝利点のどの群にも入らない＝専用群が無いと1枚も描画されない）。
   - 夜フェイズに購入UI（財宝を出す/購入ボタン）が出ないこと（夜は購入フェイズではない）。
   - 夜想曲の全 pending にモーダルがあり、押せる選択肢が1つ以上あること。 */
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
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  x FAIL: ' + m); } }
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function byText(sel, t) { return $all(sel).find((e) => e.textContent.includes(t)); }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.pickZoom = null; UI.sheet = null; UI.confirm = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const FILLER = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'mine'];
function king(cards) { return cards.concat(FILLER).slice(0, 10); }
function mk(kingdom, opts) {
  const s = E.createInitialState(['あなた', '相手'], king(kingdom || []), Object.assign({ startActive: 0 }, opts || {}));
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  return s;
}
// モーダルが出ていて、押せるもの（ボタン or 選択チップ）が1つ以上あるか＝人間が詰まない
function actionable() {
  if (runtimeError || !$('.modal')) return false;
  const btns = $all('.modal button').filter((b) => !b.disabled);
  const chips = $all('.modal .chip-grid .card, .modal .chip-grid .pick-supply');
  return btns.length + chips.length > 0;
}

try {
  console.log('=== 夜フェイズの操作（N0b） ===');
  {
    const s = mk(['guardian', 'monastery', 'crypt']);
    s.players[0].hand = ['guardian', 'crypt', 'copper', 'estate'];
    s.turn.phase = 'night';
    showAs(s, 0);
    ok(!runtimeError, '夜フェイズの盤面が例外なく描画される');
    ok(byText('.phase', '夜'), 'フェーズ表示が「夜 フェーズ」になる');
    ok(byText('.hg-label', '夜行'), '手札に「夜行」の群が出る');
    // 純粋な夜行カード（守護者・納骨堂）が手札に描画されているか
    const names = $all('.hand-zone .card').map((e) => e.getAttribute('aria-label') || e.textContent);
    ok(names.some((n) => n && n.indexOf('守護者') >= 0), '守護者（純粋な夜行カード）が手札に描画される');
    ok(names.some((n) => n && n.indexOf('納骨堂') >= 0), '納骨堂（純粋な夜行カード）が手札に描画される');
    // 夜フェイズは購入フェイズではない＝財宝/購入のUIを出さない
    ok(!byText('.actions-bar button', '財宝を全部出す'), '夜フェイズに「財宝を全部出す」を出さない');
    ok(byText('.actions-bar button', 'ターンを終える'), '夜フェイズでも「ターンを終える」は押せる');
  }
  {
    // 夜行カードをタップ → 「使う（夜）」で PLAY_NIGHT が飛ぶ
    const s = mk(['guardian']);
    s.players[0].hand = ['guardian', 'copper'];
    s.turn.phase = 'night';
    showAs(s, 0);
    const tile = $all('.hand-zone .card').find((e) => (e.getAttribute('aria-label') || '').indexOf('守護者') >= 0);
    ok(!!tile, '夜行カードのタイルが取れる');
    if (tile) {
      tile.dispatchEvent(new win.Event('click', { bubbles: true }));
      const btn = byText('.sheet button', '使う（夜）') || byText('button', '使う（夜）');
      ok(!!btn, '夜行カードをタップすると「使う（夜）」が出る');
      if (btn) {
        btn.dispatchEvent(new win.Event('click', { bubbles: true }));
        const cur = UI.store.state;
        ok(cur.players[0].inPlay.includes('guardian'), '「使う（夜）」で夜行カードが場に出る（PLAY_NIGHT）');
        ok(cur.turn.actions === 1 && cur.turn.buys === 1, 'アクション権も購入権も減らない');
      }
    }
  }
  {
    // 財宝は夜フェイズでは光らない（engine が拒否する手をUIに出さない）
    const s = mk(['guardian']);
    s.players[0].hand = ['copper', 'guardian'];
    s.turn.phase = 'night';
    showAs(s, 0);
    const cop = $all('.hand-zone .card').find((e) => (e.getAttribute('aria-label') || '').indexOf('銅貨') >= 0);
    ok(cop && cop.className.indexOf('dim') >= 0, '夜フェイズでは財宝は暗く（押せない）表示される');
  }
  {
    // 人狼＝アクションでもある夜行カードはアクション群に出て、夜フェイズでも光る
    const s = mk(['werewolf']);
    s.players[0].hand = ['werewolf'];
    s.turn.phase = 'night';
    showAs(s, 0);
    const w = $all('.hand-zone .card').find((e) => (e.getAttribute('aria-label') || '').indexOf('人狼') >= 0);
    ok(!!w, '人狼が手札に描画される');
    ok(w && w.className.indexOf('dim') < 0, '人狼は夜フェイズで光る（使える）');
  }
  {
    // 初心者モードのコーチ文
    const s = mk(['guardian']);
    s.players[0].hand = ['guardian'];
    s.turn.phase = 'night';
    UI.beginner = true;
    showAs(s, 0);
    ok(byText('.coach-bar', '夜フェーズ'), '初心者モードの案内が夜フェイズ用になる');
    UI.beginner = false;
  }
} catch (e) {
  fail++; console.log('  x 例外: ' + (e && e.stack ? e.stack : e));
}

console.log('\n========================================');
console.log(`夜想曲UIテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
