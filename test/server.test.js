/* オンライン対戦サーバ統合テスト（実 ws クライアントで検証）
   使い方: node test/server.test.js
*/
const http = require('node:http');
const WebSocket = require('ws');
const { attachGameServer, WS_PATH, isOriginAllowed, __reset } = require('../server/gameServer');

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkClient(url) {
  const ws = new WebSocket(url);
  const inbox = [];
  let cursor = 0;
  const waiters = [];
  ws.on('message', (d) => {
    inbox.push(JSON.parse(String(d)));
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i]()) waiters.splice(i, 1);
  });
  return {
    ws,
    send: (m) => ws.send(JSON.stringify(m)),
    open: () => new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); }),
    waitFor(pred, ms = 2000) {
      return new Promise((res, rej) => {
        const t = setTimeout(() => { const i = waiters.indexOf(check); if (i >= 0) waiters.splice(i, 1); rej(new Error('timeout')); }, ms);
        const check = () => {
          for (let i = cursor; i < inbox.length; i++) {
            if (pred(inbox[i])) { cursor = i + 1; clearTimeout(t); res(inbox[i]); return true; }
          }
          return false;
        };
        if (!check()) waiters.push(check);
      });
    },
    close: () => ws.close(),
  };
}

(async () => {
  const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
  attachGameServer(server, { cpuStepMs: 15, graceMs: 300 });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const URL = `ws://127.0.0.1:${port}${WS_PATH}`;

  try {
    console.log('=== Origin 許可判定 ===');
    ok(isOriginAllowed('https://x.github.io', ['https://x.github.io']) === true, '許可リストに一致');
    ok(isOriginAllowed('https://evil.com', ['https://x.github.io']) === false, '許可外は拒否');
    ok(isOriginAllowed(undefined, ['https://x.github.io']) === true, '非ブラウザ(Originなし)は素通し');
    ok(isOriginAllowed('https://evil.com', []) === true, '未設定(空)は全許可=ローカル開発');

    console.log('=== 2人(人間) 作成→参加→開始→同期 ===');
    const c0 = mkClient(URL); await c0.open();
    c0.send({ t: 'create', name: 'ホスト' });
    const joined0 = await c0.waitFor((m) => m.t === 'joined');
    ok(joined0.code && joined0.code.length === 4 && /^[0-9]{4}$/.test(joined0.code), '4桁数字コード: ' + joined0.code);
    ok(joined0.you === 0 && joined0.isHost && joined0.token, 'ホストは席0・token付与');
    const code = joined0.code;

    const c1 = mkClient(URL); await c1.open();
    c1.send({ t: 'join', code, name: 'ゲスト' });
    const joined1 = await c1.waitFor((m) => m.t === 'joined');
    ok(joined1.you === 1 && !joined1.isHost, 'ゲストは席1');

    // 2人対戦にするため CPU 0 に
    c0.send({ t: 'setCpu', count: 0 });
    const lobby = await c0.waitFor((m) => m.t === 'lobby' && m.cpuCount === 0);
    ok(lobby.players.length === 2 && lobby.canStart, 'ロビー: 2人で開始可');

    c0.send({ t: 'start' });
    const started0 = await c0.waitFor((m) => m.t === 'started');
    const started1 = await c1.waitFor((m) => m.t === 'started');
    ok(started0.you === 0 && started1.you === 1, '各自に自分の席を通知');

    console.log('=== マスキング（相手の手札が伏せられる） ===');
    const s0 = started0.state;
    ok(s0.players[0].hand.every((c) => c !== 'back') && s0.players[0].hand.length === 5, '自分の手札は見える(5枚)');
    ok(s0.players[1].hand.every((c) => c === 'back') && s0.players[1].hand.length === 5, '相手の手札は伏せ(back)・枚数は5');
    ok(s0.players[1].deck.every((c) => c === 'back'), '相手の山札も伏せ');
    ok(s0.you === 0, 'state.you=自席');

    console.log('=== 手番の同期と手番ガード ===');
    // 席0(active)がターンを終える
    c0.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
    await c1.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy');
    c0.send({ t: 'action', action: { type: 'END_TURN' } });
    const afterEnd = await c1.waitFor((m) => m.t === 'state' && m.state.turn.active === 1);
    ok(afterEnd.state.turn.active === 1, '手番が席1へ同期');
    // 席0が他人の番に操作 → 拒否
    c0.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
    const err = await c0.waitFor((m) => m.t === 'error');
    ok(/操作できる場面/.test(err.message), '非手番の操作は拒否');

    c0.close(); c1.close();
    await sleep(50);

    console.log('=== 1人+CPU: サーバ側でCPUが自動進行 ===');
    const h = mkClient(URL); await h.open();
    h.send({ t: 'create', name: 'プレイヤー' });
    const hj = await h.waitFor((m) => m.t === 'joined');
    // 既定 cpuCount=1 のまま開始 → 2人(1人間+1CPU)
    h.send({ t: 'setConfig', cpuLevel: 'hard' });
    await h.waitFor((m) => m.t === 'lobby' && m.cpuLevel === 'hard');
    h.send({ t: 'start' });
    const hStarted = await h.waitFor((m) => m.t === 'started');
    ok(hStarted.state.players.length === 2 && hStarted.state.players[1].isCpu, '1人+CPUで開始');
    // 人間がターンを終える → CPUが自動で1ターン進めて人間に戻る
    h.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
    await h.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy');
    h.send({ t: 'action', action: { type: 'END_TURN' } });
    // CPUのターンが進んで再び席0(人間)に戻るのを待つ
    const back = await h.waitFor((m) => m.t === 'state' && m.state.turn.active === 0 && m.state.players[1].turns >= 1, 4000);
    ok(back.state.players[1].turns >= 1, 'CPUが自動で1ターン消化して人間に戻る');
    h.close();
    await sleep(50);

    console.log('=== 切断→CPU代行→再接続で復帰 ===');
    const a = mkClient(URL); await a.open();
    a.send({ t: 'create', name: 'A' });
    const aj = await a.waitFor((m) => m.t === 'joined');
    const code2 = aj.code;
    const b = mkClient(URL); await b.open();
    b.send({ t: 'join', code: code2, name: 'B' });
    const bj = await b.waitFor((m) => m.t === 'joined');
    a.send({ t: 'setCpu', count: 0 });
    await a.waitFor((m) => m.t === 'lobby' && m.cpuCount === 0);
    a.send({ t: 'start' });
    await a.waitFor((m) => m.t === 'started');
    await b.waitFor((m) => m.t === 'started');
    // B が切断 → サーバは席1をCPU化して進行継続
    b.close();
    await sleep(80);
    // A がターンを終える → 席1(CPU代行)が自動で進み、A に戻ってくる
    a.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
    await a.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy');
    a.send({ t: 'action', action: { type: 'END_TURN' } });
    const cont = await a.waitFor((m) => m.t === 'state' && m.state.players[1].isCpu === true, 3000);
    ok(cont.state.players[1].isCpu === true, '切断中は席1がCPU代行');
    // B が token で再接続 → 人間へ復帰
    const b2 = mkClient(URL); await b2.open();
    b2.send({ t: 'resume', code: code2, you: bj.you, token: bj.token });
    const reStarted = await b2.waitFor((m) => m.t === 'started', 3000);
    ok(reStarted.you === 1, '再接続で席1へ復帰');
    const human = await a.waitFor((m) => m.t === 'state' && m.state.players[1].isCpu === false, 3000);
    ok(human.state.players[1].isCpu === false, '再接続で席1が人間へ戻る');
    a.close(); b2.close();

  } catch (e) {
    fail++; console.log('  ✗ 例外: ' + (e.stack || e.message));
  }

  __reset();
  try { server.close(); } catch (e) { /* noop */ }
  console.log('\n========================================');
  console.log(`サーバテスト結果: ${pass} 件成功, ${fail} 件失敗`);
  console.log('========================================');
  process.exit(fail ? 1 : 0); // 開いている接続を待たず即終了

})();
