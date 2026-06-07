/* オンライン同期テスト（モックFirebaseで2台のスマホを再現）
   使い方: node test/online.test.js
   実際のFirebaseは使わず、共有メモリDBで「部屋作成→参加→同期→手番ガード」を検証。
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

/* ---------- モック Firebase（2クライアントで共有する1つのDB） ---------- */
function createMockFirebase() {
  const data = {};        // path -> value
  const listeners = {};   // path -> [cb]
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const snap = (v) => ({ val: () => (v === undefined ? null : clone(v)) });
  function setPath(p, v) {
    data[p] = clone(v);
    (listeners[p] || []).forEach((cb) => cb(snap(data[p])));
  }
  function ref(p) {
    return {
      set(v) { setPath(p, v); return Promise.resolve(); },
      on(ev, cb) { (listeners[p] = listeners[p] || []).push(cb); if (data[p] !== undefined) cb(snap(data[p])); },
      off() { listeners[p] = []; },
      once() { return Promise.resolve(snap(data[p])); },
      transaction(update, onComplete) {
        const cur = data[p] === undefined ? null : clone(data[p]);
        const res = update(cur);
        if (res === undefined) { onComplete && onComplete(null, false, snap(data[p])); return; }
        setPath(p, res);
        onComplete && onComplete(null, true, snap(data[p]));
      },
    };
  }
  return { ref };
}

/* ---------- 1クライアント（1台のスマホ）を作る ---------- */
function makeClient(mockDb) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>',
    { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window;
  const load = (f) => win.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
  load('js/cards.js');
  load('js/engine.js');
  load('js/store.js');
  win.DOM.db = mockDb;          // Firebase の代わりにモックを差し込む
  load('js/ui.js');
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  const doc = win.document;
  return {
    win, doc, DOM: win.DOM, UI: win.DOM.UI,
    $: (s) => doc.querySelector(s),
    $all: (s) => Array.from(doc.querySelectorAll(s)),
    clickText(sel, text) {
      const el = this.$all(sel).find((e) => e.textContent.trim() === text);
      if (!el) throw new Error('要素なし: ' + sel + ' = ' + text);
      el.click();
    },
    setInput(el, v) { el.value = v; el.dispatchEvent(new win.Event('input')); },
  };
}

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
 try {
  const mock = createMockFirebase();
  const host = makeClient(mock);
  const guest = makeClient(mock);

  console.log('=== ホストが部屋を作る ===');
  host.clickText('button', 'オンラインで対戦（2台）');
  host.clickText('button', '部屋を作る（ホスト）');
  host.clickText('button', '部屋を作成');
  await tick(); // createRoom の set().then() を待つ
  ok(host.UI.view === 'waitGuest', 'ホストは待機画面');
  const code = host.UI.roomCode;
  ok(code && code.length === 4, '部屋コード生成: ' + code);
  ok(host.UI.mySeat === 0, 'ホストは座席0');

  console.log('=== ゲストが参加する ===');
  guest.clickText('button', 'オンラインで対戦（2台）');
  guest.clickText('button', '部屋に参加する');
  const codeInput = guest.$('.code-input');
  guest.setInput(codeInput, code);
  const nameInputs = guest.$all('.panel input[type="text"]');
  guest.setInput(nameInputs[nameInputs.length - 1], 'つま');
  guest.clickText('button', '参加する');
  await tick();

  ok(guest.UI.view === 'game', 'ゲストはゲーム画面へ');
  ok(guest.UI.mySeat === 1, 'ゲストは座席1');
  ok(host.UI.view === 'game', 'ホストも自動でゲーム画面へ（参加を検知）');
  ok(host.UI.store.state.seats[1] === 'つま', 'ホスト側に相手名が同期');
  ok(guest.UI.store.state.players[1].name === 'つま', 'ゲスト名が反映');

  console.log('=== 満員の部屋には入れない ===');
  const guest3 = makeClient(mock);
  guest3.clickText('button', 'オンラインで対戦（2台）');
  guest3.clickText('button', '部屋に参加する');
  guest3.setInput(guest3.$('.code-input'), code);
  guest3.clickText('button', '参加する');
  await tick();
  ok(guest3.UI.view !== 'game', '3人目は参加できない');

  console.log('=== 手番の同期（ホスト→ゲスト） ===');
  // ホストは座席0＝先攻。アクション→購入→ターン終了でゲストの番へ
  host.UI.store.dispatch({ type: 'END_ACTION_PHASE' });
  host.UI.store.dispatch({ type: 'END_TURN' });
  ok(host.UI.store.state.turn.active === 1, 'ホスト側: 手番がゲストへ');
  ok(guest.UI.store.state.turn.active === 1, 'ゲスト側にも手番交代が同期');
  const vAfterHost = guest.UI.store.state.version;

  console.log('=== 手番ガード（自分の番でないと書けない） ===');
  // いまはゲスト(座席1)の番。ホスト(座席0)が操作しても弾かれる
  host.UI.store.dispatch({ type: 'END_ACTION_PHASE' });
  ok(guest.UI.store.state.version === vAfterHost, 'ホストの不正操作はDBに書かれない（version不変）');
  ok(guest.UI.store.state.turn.phase === 'action', 'ゲストの番のフェーズは保持');

  console.log('=== ゲストの操作がホストに同期 ===');
  guest.UI.store.dispatch({ type: 'END_ACTION_PHASE' });
  ok(guest.UI.store.state.turn.phase === 'buy', 'ゲスト: 購入フェーズへ');
  ok(host.UI.store.state.turn.phase === 'buy', 'ホストにも同期');

  } catch (e) {
    fail++;
    console.log('  ✗ 例外: ' + (e.stack || e.message));
  }

  console.log('\n========================================');
  console.log(`オンラインテスト結果: ${pass} 件成功, ${fail} 件失敗`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
