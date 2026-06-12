/* オンライン対戦 E2E（実サーバ + jsdom 2ブラウザ + 実WebSocket）
   使い方: node test/online.test.js
   - 2つの「ブラウザ」(jsdom)が実サーバへ WebSocket 接続し、
     部屋作成→参加→ロビー→開始→同期 を行う。
   - 相手の手札がクライアントに届かない(マスク)ことを確認。
*/
const http = require('node:http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { attachGameServer, WS_PATH, __reset, rooms } = require('../server/gameServer');

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUntil(pred, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (pred()) return true; await sleep(20); }
  return false;
}

function makeBrowser(port) {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="app"></div></body>',
    { url: 'http://localhost:8000/', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window;
  win.WebSocket = WebSocket; // 実WebSocketをブラウザのWebSocketとして注入
  const load = (f) => win.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
  ['js/cards.js', 'js/engine.js', 'js/cpu.js', 'js/store.js', 'js/net.js', 'js/audio.js', 'js/ui.js'].forEach(load);
  win.DOM.resolveServerUrl = () => `ws://127.0.0.1:${port}${WS_PATH}`; // 接続先をテストサーバへ
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  const doc = win.document;
  return {
    win, doc, UI: win.DOM.UI,
    $: (s) => doc.querySelector(s),
    $all: (s) => Array.from(doc.querySelectorAll(s)),
    clickText(t) {
      const el = Array.from(doc.querySelectorAll('button,.btn,.seg-btn'))
        .find((e) => e.textContent.trim() === t) || Array.from(doc.querySelectorAll('button,.btn,.seg-btn')).find((e) => e.textContent.includes(t));
      if (!el) throw new Error('要素なし: ' + t);
      el.click();
    },
    setInput(sel, v) { const el = doc.querySelector(sel); el.value = v; el.dispatchEvent(new win.Event('input')); },
  };
}

(async () => {
  const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
  attachGameServer(server, { cpuStepMs: 15, graceMs: 500 });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  try {
    console.log('=== ホストが部屋を作成 ===');
    const host = makeBrowser(port);
    host.clickText('オンラインで対戦');
    host.clickText('部屋を作る（ホスト）');
    host.clickText('部屋を作成');
    ok(await waitUntil(() => host.UI.view === 'lobby' && host.UI.roomCode), 'ホストがロビーへ');
    const code = host.UI.roomCode;
    ok(/^[0-9]{4}$/.test(code), '数字4桁コード: ' + code);
    ok(host.UI.isHost === true && host.UI.mySeat === 0, 'ホストは席0');

    console.log('=== ゲストが参加 ===');
    const guest = makeBrowser(port);
    guest.clickText('オンラインで対戦');
    guest.clickText('部屋に参加する');
    guest.setInput('.code-input', code);
    const ninputs = guest.$all('.panel input[type="text"]');
    const nameInput = ninputs[ninputs.length - 1];
    nameInput.value = 'ゲスト'; nameInput.dispatchEvent(new guest.win.Event('input'));
    guest.clickText('参加する');
    ok(await waitUntil(() => guest.UI.view === 'lobby' && guest.UI.mySeat === 1), 'ゲストがロビー・席1');
    ok(await waitUntil(() => host.UI.lobby && host.UI.lobby.players.length >= 2), 'ホストのロビーに2人表示');

    console.log('=== CPUを0にして2人で開始 ===');
    // ホストがCPU人数を0に（−ボタン）
    host.clickText('−');
    ok(await waitUntil(() => host.UI.lobby && host.UI.lobby.cpuCount === 0), 'CPU0に');
    ok(await waitUntil(() => host.UI.lobby && host.UI.lobby.canStart), '2人で開始可能');
    host.clickText('ゲーム開始');
    ok(await waitUntil(() => host.UI.view === 'game' && host.UI.store.state), 'ホストがゲーム画面');
    ok(await waitUntil(() => guest.UI.view === 'game' && guest.UI.store.state), 'ゲストがゲーム画面');

    console.log('=== マスキング（相手手札が届かない） ===');
    const hs = host.UI.store.state;
    ok(hs.players[0].hand.every((c) => c !== 'back') && hs.players[0].hand.length === 5, 'ホスト自分の手札は実物');
    ok(hs.players[1].hand.every((c) => c === 'back'), 'ホストから見て相手手札は伏せ(back)');
    const gs = guest.UI.store.state;
    ok(gs.players[1].hand.every((c) => c !== 'back'), 'ゲスト自分の手札は実物');
    ok(gs.players[0].hand.every((c) => c === 'back'), 'ゲストから見て相手手札は伏せ');

    console.log('=== 盤面描画・手番同期 ===');
    ok(host.$('.board') && host.$('.others .opp-chip'), 'ホスト盤面描画');
    ok(host.UI.store.state.turn.active === 0, 'ホスト(席0)が先手');
    // ホストがターンを終える（手札にアクションは無いので END_ACTION_PHASE → END_TURN）
    host.clickText('購入フェーズへ ▶');
    ok(await waitUntil(() => host.UI.store.state.turn.phase === 'buy'), '購入フェーズへ');
    host.clickText('ターンを終える');
    ok(await waitUntil(() => guest.UI.store.state.turn.active === 1), 'ゲストに手番交代が同期');
    ok(await waitUntil(() => host.UI.store.state.turn.active === 1), 'ホストにも反映');

    console.log('=== 切断 → 自動再接続で元の対戦に復帰 ===');
    ok(!!guest.win.localStorage.getItem('dom_online_session'), 'セッションがlocalStorageに保存されている');
    // サーバ側からゲストの接続を切る（ネット断を模擬）
    const room = [...rooms.values()][0];
    const guestMember = room.members.find((m) => m.seat === 1);
    guestMember.ws.close();
    ok(await waitUntil(() => host.UI.store.state.players[1].dc === true, 4000), 'ホストに「相手が再接続中(dc)」が伝わる');
    ok(await waitUntil(() => guest.UI.reconnecting === true, 4000), 'ゲストは再接続中になる');
    // ゲストは自動で resume して対戦画面に復帰
    ok(await waitUntil(() => guest.UI.reconnecting === false && guest.UI.view === 'game' && !!guest.UI.store.state, 9000), 'ゲストが自動再接続して復帰');
    ok(await waitUntil(() => guest.UI.mySeat === 1, 3000), '同じ席(1)に戻る');
    ok(await waitUntil(() => host.UI.store.state.players[1].dc === false, 4000), 'ホスト側の再接続中表示が消える');
    const gs2 = guest.UI.store.state;
    ok(gs2.players[1].hand.every((c) => c !== 'back') && gs2.players[0].hand.every((c) => c === 'back'), '復帰後も手札の秘匿は維持');

    console.log('=== 再接続後も操作がサーバへ届く（NetStore.dispatch が新ソケットを使う） ===');
    // 再接続後はゲスト(席1)の手番。store.dispatch がサーバに届き双方へ同期されること。
    // （旧バグ: dispatch が閉じた旧WebSocketをクロージャで掴んだまま無言で捨てていた）
    if (guest.UI.store.state.turn.phase === 'action') guest.UI.store.dispatch({ type: 'END_ACTION_PHASE' });
    ok(await waitUntil(() => guest.UI.store.state.turn.phase === 'buy', 4000), '再接続後のゲスト操作が自分に反映');
    ok(await waitUntil(() => host.UI.store.state.turn.phase === 'buy', 4000), '再接続後のゲスト操作がホストにも同期');
    guest.UI.store.dispatch({ type: 'END_TURN' });
    ok(await waitUntil(() => host.UI.store.state.turn.active === 0 && guest.UI.store.state.turn.active === 0, 4000), '再接続後にターン終了が通りホストへ手番が戻る');

  } catch (e) {
    fail++; console.log('  ✗ 例外: ' + (e.stack || e.message));
  }

  __reset();
  try { server.close(); } catch (e) { /* noop */ }
  console.log('\n========================================');
  console.log(`オンラインE2E結果: ${pass} 件成功, ${fail} 件失敗`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
