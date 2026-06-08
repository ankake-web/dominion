/* オンライン対戦サーバ 耐久/堅牢性テスト
   使い方: node test/stress.test.js
   目的: 切断→再接続の連打・不正メッセージ・ソケットerror注入でも
         サーバープロセスが落ちず、タイマー/接続が増殖しないことを確認する。 */
const http = require('node:http');
const WebSocket = require('ws');
const { attachGameServer, WS_PATH, __reset, rooms } = require('../server/gameServer');

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkClient(url) {
  const ws = new WebSocket(url);
  const inbox = [];
  let cursor = 0;
  const waiters = [];
  ws.on('error', () => { /* テスト側でも error を握り、未処理にしない */ });
  ws.on('message', (d) => {
    let m; try { m = JSON.parse(String(d)); } catch { return; }
    inbox.push(m);
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i]()) waiters.splice(i, 1);
  });
  return {
    ws,
    send: (m) => { try { ws.send(JSON.stringify(m)); } catch { /* noop */ } },
    sendRaw: (s) => { try { ws.send(s); } catch { /* noop */ } },
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
    close: () => { try { ws.close(); } catch { /* noop */ } },
  };
}

(async () => {
  // attachGameServer がプロセスガードを設置することを確認するため、設置前の数を控える
  const baseUE = process.listenerCount('uncaughtException');
  const baseUR = process.listenerCount('unhandledRejection');

  const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
  const wss = attachGameServer(server, { cpuStepMs: 10, graceMs: 200, startedGraceMs: 400, heartbeatMs: 100000 });
  await new Promise((r) => server.listen(0, r));

  // テスト中に万一の未処理例外/Rejectionが出たら検出して失敗にする（サーバが握れていない印）
  let uncaught = null;
  const onUncaught = (e) => { uncaught = e; };
  process.on('uncaughtException', onUncaught);
  process.on('unhandledRejection', onUncaught);
  const port = server.address().port;
  const URL = `ws://127.0.0.1:${port}${WS_PATH}`;

  // 2人(人間)の対戦を作るヘルパ
  async function start2p() {
    const a = mkClient(URL); await a.open();
    a.send({ t: 'create', name: 'A' });
    const aj = await a.waitFor((m) => m.t === 'joined');
    const b = mkClient(URL); await b.open();
    b.send({ t: 'join', code: aj.code, name: 'B' });
    const bj = await b.waitFor((m) => m.t === 'joined');
    a.send({ t: 'setCpu', count: 0 });
    await a.waitFor((m) => m.t === 'lobby' && m.cpuCount === 0);
    a.send({ t: 'start' });
    await a.waitFor((m) => m.t === 'started');
    await b.waitFor((m) => m.t === 'started');
    return { a, b, code: aj.code, aj, bj };
  }

  try {
    console.log('=== 堅牢化の前提: ハンドラが付いている ===');
    ok(process.listenerCount('uncaughtException') > baseUE, 'attachGameServer が uncaughtException ハンドラを設置');
    ok(process.listenerCount('unhandledRejection') > baseUR, 'attachGameServer が unhandledRejection ハンドラを設置');

    const probe = mkClient(URL); await probe.open();
    probe.send({ t: 'ping' });
    await probe.waitFor((m) => m.t === 'pong', 1000);
    // サーバ側 ws に 'error' リスナーが付いているか（abrupt切断で落ちない要）
    let serverWsHasError = true;
    wss.clients.forEach((c) => { if (c.listenerCount('error') < 1) serverWsHasError = false; });
    ok(wss.clients.size >= 1 && serverWsHasError, '各サーバWebSocketに error リスナーがある');
    probe.close();
    await sleep(30);

    console.log('=== ソケットに error を注入してもプロセスが落ちない ===');
    const g = await start2p();
    // サーバ側の ws を取得して error を emit（abrupt切断/ECONNRESET相当）
    const room0 = [...rooms.values()][0];
    let injected = 0;
    room0.members.forEach((m) => { if (m.ws) { try { m.ws.emit('error', new Error('injected ECONNRESET')); injected++; } catch { /* ハンドラ未設定なら例外 */ } } });
    ok(injected === room0.members.length, 'error 注入が例外なく完了（全wsにerrorハンドラ）');
    await sleep(50);
    // まだサーバは生きている
    const probe2 = mkClient(URL); await probe2.open();
    probe2.send({ t: 'ping' });
    ok(await probe2.waitFor((m) => m.t === 'pong', 1000).then(() => true).catch(() => false), 'error注入後もサーバは応答する');
    probe2.close();
    try { g.a.close(); g.b.close(); } catch { /* noop */ }
    await sleep(50);

    console.log('=== 切断→再接続を多数回くり返す（タイマー/接続が増殖しない） ===');
    const s = await start2p();
    const beforeClients = wss.clients.size;
    for (let i = 0; i < 30; i++) {
      // ゲストをサーバ側から切る（ネット断模擬）
      const room = [...rooms.values()][0];
      const gm = room.members.find((m) => m.seat === 1);
      if (gm && gm.ws) { try { gm.ws.close(); } catch { /* noop */ } }
      await sleep(15);
      // token で再接続
      const b2 = mkClient(URL); await b2.open();
      b2.send({ t: 'resume', code: s.code, you: s.bj.you, token: s.bj.token });
      await b2.waitFor((m) => m.t === 'started', 2000);
      s.b = b2;
    }
    const room1 = [...rooms.values()][0];
    ok(rooms.size === 1, '部屋は1つのまま（増殖しない）: ' + rooms.size);
    ok(room1.members.length === 2, 'メンバーは2人のまま: ' + room1.members.length);
    // graceTimer は最新の接続では張られていない（接続中）。cpuTimer は高々1つの参照。
    const guest = room1.members.find((m) => m.seat === 1);
    ok(guest && guest.connected, '再接続後ゲストは connected');
    ok(!guest.graceTimer, '接続中ゲストに graceTimer が残っていない');
    // サーバ側の生存ソケット数が異常に増えていない（切断分は片付く）
    await sleep(150);
    ok(wss.clients.size <= beforeClients + 2, '生存ソケットが増殖しない: ' + wss.clients.size + ' (基準 ' + beforeClients + ')');
    try { s.a.close(); s.b.close(); } catch { /* noop */ }
    await sleep(50);

    console.log('=== 不正/想定外メッセージで落ちない ===');
    const j = mkClient(URL); await j.open();
    j.sendRaw('this is not json {');                 // 壊れたJSON
    j.send({ t: 'action', action: { type: 'EVIL' } }); // 部屋前のaction
    j.send({ t: 'resume', code: '9999', you: 0, token: 'x' }); // 存在しない部屋へresume
    j.send({ t: 'join', code: null });                 // 不正code
    j.send({ t: 'setCpu', count: 'NaN' });             // 不正count
    j.send({ t: 'create', name: 'X'.repeat(9999) });   // 巨大name
    const cj = await j.waitFor((m) => m.t === 'joined', 1500).catch(() => null);
    ok(cj && cj.code, '巨大name等でも create は成立し落ちない');
    // resume 連打（同一ソケット）・二重resume
    j.send({ t: 'resume', code: cj.code, you: 0, token: cj.token });
    j.send({ t: 'resume', code: cj.code, you: 0, token: cj.token });
    await sleep(50);
    j.send({ t: 'ping' });
    ok(await j.waitFor((m) => m.t === 'pong', 1000).then(() => true).catch(() => false), '不正メッセージ後もサーバ応答');
    j.close();
    await sleep(50);

    console.log('=== 二重接続: 同一席へ複数wsがresume競合しても落ちない ===');
    const t2 = await start2p();
    const room2 = [...rooms.values()][0];
    const gm2 = room2.members.find((m) => m.seat === 1);
    if (gm2 && gm2.ws) { try { gm2.ws.close(); } catch { /* noop */ } }
    await sleep(15);
    const r1 = mkClient(URL); await r1.open();
    const r2 = mkClient(URL); await r2.open();
    r1.send({ t: 'resume', code: t2.code, you: t2.bj.you, token: t2.bj.token });
    r2.send({ t: 'resume', code: t2.code, you: t2.bj.you, token: t2.bj.token });
    const okR = await r2.waitFor((m) => m.t === 'started', 2000).then(() => true).catch(() => false);
    ok(okR, '競合resumeでも少なくとも片方は復帰');
    ok([...rooms.values()][0].members.length === 2, '競合resumeで席が増えない');
    try { t2.a.close(); r1.close(); r2.close(); } catch { /* noop */ }
    await sleep(50);

    console.log('=== 最終: サーバは健在で新規対戦も可能 ===');
    const fin = await start2p();
    ok(fin && fin.code, '一連の試験後も新規に対戦を開始できる');
    try { fin.a.close(); fin.b.close(); } catch { /* noop */ }
    await sleep(50);

    ok(uncaught === null, '試験中に未処理例外/Rejectionが起きていない: ' + (uncaught ? (uncaught.stack || uncaught) : ''));

  } catch (e) {
    fail++; console.log('  ✗ 例外: ' + (e.stack || e.message));
  }

  process.off('uncaughtException', onUncaught);
  process.off('unhandledRejection', onUncaught);
  __reset();
  try { server.close(); } catch { /* noop */ }
  console.log('\n========================================');
  console.log(`耐久テスト結果: ${pass} 件成功, ${fail} 件失敗`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
