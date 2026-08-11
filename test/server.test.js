/* オンライン対戦サーバ統合テスト（実 ws クライアントで検証）
   使い方: node test/server.test.js
*/
const http = require('node:http');
const WebSocket = require('ws');
const { attachGameServer, WS_PATH, isOriginAllowed, __reset, rooms } = require('../server/gameServer');

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
  // startActive: 0 を注入して決定論化（本番は公式ルール通りランダム開始）
  attachGameServer(server, { cpuStepMs: 15, graceMs: 300, startedGraceMs: 500, heartbeatMs: 100000, startActive: 0 });
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

    console.log('=== ping / pong キープアライブ ===');
    const pc = mkClient(URL); await pc.open();
    pc.send({ t: 'ping' });
    const pong = await pc.waitFor((m) => m.t === 'pong', 1000);
    ok(pong && pong.t === 'pong', 'ping に pong が返る');
    pc.close();
    await sleep(30);

    console.log('=== 切断中は「再接続中(dc)」・席と手札を保持、token再接続で完全復元 ===');
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
    const bStarted = await b.waitFor((m) => m.t === 'started');
    const bHand0 = bStarted.state.players[1].hand.slice(); // B の手札を控える
    // B が切断 → A は dc=true / isCpu=false を受信（CPUに即置換しない）
    b.close();
    const dcState = await a.waitFor((m) => m.t === 'state' && m.state.players[1].dc === true, 2000);
    ok(dcState.state.players[1].dc === true && dcState.state.players[1].isCpu === false, '(a) 切断中は dc=true・CPU化しない（手札保持）');
    ok(a.ws.readyState === 1, '(c) 相手(A)の接続は維持される（落ちない）');
    // B が token で素早く再接続（猶予内）→ 同じ席・同じ手札・盤面が戻る
    const b2 = mkClient(URL); await b2.open();
    b2.send({ t: 'resume', code: code2, you: bj.you, token: bj.token });
    const reStarted = await b2.waitFor((m) => m.t === 'started', 2000);
    ok(reStarted.you === 1, '(a) 同じ席(1)へ復帰');
    ok(JSON.stringify(reStarted.state.players[1].hand) === JSON.stringify(bHand0), '(b) 同じ手札が復元される');
    ok(!!reStarted.state.supply && !!reStarted.state.turn, '(b) 盤面（サプライ・手番）も復元される');
    const cleared = await a.waitFor((m) => m.t === 'state' && m.state.players[1].dc === false, 2000);
    ok(cleared.state.players[1].dc === false, 'A 側の「再接続中」表示が消える');
    a.close(); b2.close();
    await sleep(50);

    console.log('=== 猶予切れ → CPUが引き継いで進行継続 ===');
    const a3 = mkClient(URL); await a3.open();
    a3.send({ t: 'create', name: 'A3' });
    const a3j = await a3.waitFor((m) => m.t === 'joined');
    const b3 = mkClient(URL); await b3.open();
    b3.send({ t: 'join', code: a3j.code, name: 'B3' });
    const b3j = await b3.waitFor((m) => m.t === 'joined');
    a3.send({ t: 'setCpu', count: 0 });
    await a3.waitFor((m) => m.t === 'lobby' && m.cpuCount === 0);
    a3.send({ t: 'start' });
    await a3.waitFor((m) => m.t === 'started');
    await b3.waitFor((m) => m.t === 'started');
    b3.close();
    // startedGraceMs(500ms) を過ぎると席1がCPUに引き継がれ、A3 に配信される
    const cpuTaken = await a3.waitFor((m) => m.t === 'state' && m.state.players[1].isCpu === true, 3000);
    ok(cpuTaken.state.players[1].isCpu === true && cpuTaken.state.players[1].dc === false, '猶予切れで席1がCPUに引き継がれる');

    console.log('=== 猶予切れCPU化のあとでも本人は token で人間に復帰できる ===');
    // 「電池切れ/お風呂で5分以上離脱 → 戻ったら自分の席が返ってくる」の生命線
    const b3r = mkClient(URL); await b3r.open();
    b3r.send({ t: 'resume', code: a3j.code, you: b3j.you, token: b3j.token });
    const b3Back = await b3r.waitFor((m) => m.t === 'started', 2000);
    ok(b3Back.you === 1, '猶予切れ後も同じ席(1)へ復帰');
    ok(b3Back.state.players[1].isCpu === false && b3Back.state.players[1].dc === false, 'CPU代行から人間に戻る');
    a3.close(); b3r.close();
    await sleep(50);

    console.log('=== 不正token: 実在部屋への resume は拒否され席を乗っ取れない ===');
    const h1 = mkClient(URL); await h1.open();
    h1.send({ t: 'create', name: 'H1' });
    const h1j = await h1.waitFor((m) => m.t === 'joined');
    const g1 = mkClient(URL); await g1.open();
    g1.send({ t: 'join', code: h1j.code, name: 'G1' });
    await g1.waitFor((m) => m.t === 'joined');
    h1.send({ t: 'setCpu', count: 0 });
    await h1.waitFor((m) => m.t === 'lobby' && m.cpuCount === 0);
    h1.send({ t: 'start' });
    await h1.waitFor((m) => m.t === 'started');
    await g1.waitFor((m) => m.t === 'started');
    const hacker = mkClient(URL); await hacker.open();
    hacker.send({ t: 'resume', code: h1j.code, you: 1, token: 'wrong-token' });
    const herr = await hacker.waitFor((m) => m.t === 'error', 2000);
    ok(herr.fatal === true, '不正tokenは fatal エラーで拒否（手札は配信されない）');
    ok(g1.ws.readyState === 1, '正規ゲストの接続は乗っ取られず無傷');
    // 正規ゲストには引き続き state が届く（ホストが操作 → 同期）
    h1.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
    const g1Sync = await g1.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy', 2000);
    ok(!!g1Sync, '不正resume試行後も正規ゲストへ同期が続く');
    hacker.close();

    console.log('=== 1手もどす（オンライン・他の人間全員の承認制）===');
    {
      // 直前で h1 が END_ACTION_PHASE を送っている＝履歴の一番上は席0の手
      const hState = await h1.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy', 2000);
      ok(hState.canUndo === true, '自分の手のあとは canUndo=true が届く');
      ok(g1Sync.canUndo === false, '相手には canUndo=false（勝手に巻き戻せない）');
      // 自分の手番でない席は頼めない
      g1.send({ t: 'undo' });
      const gerr = await g1.waitFor((m) => m.t === 'error', 2000);
      ok(/もどせません/.test(gerr.message), '操作できる場面でない席の要求は拒否される');
      // ホストが要求 → ゲストが許可 → 巻き戻る
      h1.send({ t: 'undo' });
      const ask = await g1.waitFor((m) => m.t === 'undoAsk', 2000);
      ok(ask.from === 0 && ask.name === 'H1', '相手に「1手もどしたい」が届く');
      await h1.waitFor((m) => m.t === 'undoPending', 2000);
      ok(rooms.get(h1j.code).state.turn.phase === 'buy', '承認を待っている間は巻き戻さない');
      g1.send({ t: 'undoVote', ok: true });
      const back = await h1.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'action', 2000);
      ok(!!back, '承認されると巻き戻った状態が配信される（購入フェイズ→アクションフェイズ）');
      ok(back.canUndo === false, '巻き戻したら履歴を消費して canUndo=false');
      const done = await h1.waitFor((m) => m.t === 'undoDone', 2000);
      ok(done.by === 0, 'undoDone が届く');
      ok(rooms.get(h1j.code).state.players[0].hand.length === 5, '巻き戻し後も手札は壊れない');
      // もう一度手を進めて、今度は断られるケース
      h1.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
      await h1.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy', 2000);
      h1.send({ t: 'undo' });
      await g1.waitFor((m) => m.t === 'undoAsk', 2000);
      g1.send({ t: 'undoVote', ok: false });
      const denied = await h1.waitFor((m) => m.t === 'undoDenied', 2000);
      ok(denied.reason === 'rejected', '断られたら undoDenied（rejected）');
      ok(rooms.get(h1j.code).state.turn.phase === 'buy', '断られたら局面は動かない');
      // 履歴はサーバのメモリだけが持ち、永続化スナップショットには載せない（Upstash肥大を防ぐ）
      const rm = rooms.get(h1j.code);
      ok(rm.history && rm.history.length >= 1, 'サーバは巻き戻し地点を保持している');
      const snapOf = require('../server/gameServer').roomSnapshot;
      ok(Object.keys(snapOf(rm)).indexOf('history') < 0, '永続化スナップショットに履歴は含めない');
      // 回帰：engine が状態不変で拒否する操作は巻き戻し地点にしない（押しても何も戻らない undo を作らない）
      const before = rm.history.length;
      h1.send({ t: 'action', action: { type: 'BUY', card: 'province' } }); // コイン不足＝engine が state 不変で拒否
      await sleep(120);
      ok(rooms.get(h1j.code).history.length === before, '無効な操作は巻き戻し地点を積まない（実 ' + rooms.get(h1j.code).history.length + '/' + before + '）');
      // 買い物（カードの購入）だけは相手の同意なしで戻せる（乱数を消費せず・情報も増えず・終局もしないため）
      {
        // 購入できる局面を作る：手番を席0のアクションフェイズに戻し、コインを持たせる
        const rm3 = rooms.get(h1j.code);
        rm3.state.turn.phase = 'buy'; rm3.state.turn.coins = 3; rm3.state.turn.buys = 1;
        const silverBefore = rm3.state.supply.silver;
        const discardBefore = rm3.state.players[0].discard.length;
        h1.send({ t: 'action', action: { type: 'BUY', card: 'silver' } });
        const bought = await h1.waitFor((m) => m.t === 'state' && m.state.supply.silver === silverBefore - 1, 2000);
        ok(!!bought, '前提：銀貨を購入できた');
        ok(bought.undoFree === true, '購入の直後は undoFree=true（同意なしで戻せると配信される）');
        // ゲスト（相手）は接続中だが、承認を聞かれずに巻き戻るはず
        h1.send({ t: 'undo' });
        const undone = await h1.waitFor((m) => m.t === 'state' && m.state.supply.silver === silverBefore, 2000);
        ok(!!undone, '同意なしで購入が巻き戻る（銀貨が山に戻る）');
        ok(rooms.get(h1j.code).state.players[0].discard.length === discardBefore, '捨て札も元に戻る');
        const done2 = await h1.waitFor((m) => m.t === 'undoDone', 2000);
        ok(done2.free === true, 'undoDone に free=true が付く');
        ok(!rooms.get(h1j.code).undoReq, '承認待ちは発生していない');
      }
      // 対照【重要】：購入でも「相手に触る」ものは同意なしにしない。
      //   不正利得＝獲得すると他の各プレイヤーが呪いを獲得する＝相手の捨て札が動くので承認制へ落ちる。
      //   （カード名を列挙せず「相手の状態が1ビットも変わっていない」ことを証明する方式なので、
      //    新しいカードが増えても自動的に守られる。）
      {
        const rm5 = rooms.get(h1j.code);
        rm5.state.turn.phase = 'buy'; rm5.state.turn.coins = 5; rm5.state.turn.buys = 1;
        rm5.state.supply.ill_gotten_gains = 5;
        const curseBefore = rm5.state.supply.curse;
        h1.send({ t: 'action', action: { type: 'BUY', card: 'ill_gotten_gains' } });
        const igg = await h1.waitFor((m) => m.t === 'state' && m.state.supply.ill_gotten_gains === 4, 2000);
        ok(rooms.get(h1j.code).state.supply.curse === curseBefore - 1, '前提：不正利得の購入で相手が呪いを獲得した');
        ok(igg.undoFree === false, '相手に影響する購入は undoFree=false（同意なしにはしない）');
        h1.send({ t: 'undo' });
        const ask3 = await g1.waitFor((m) => m.t === 'undoAsk', 2000);
        ok(!!ask3, '相手に影響する購入はきちんと承認を求める');
        g1.send({ t: 'undoVote', ok: true });
        await h1.waitFor((m) => m.t === 'undoDone', 2000);
        ok(rooms.get(h1j.code).state.supply.curse === curseBefore, '承認後は呪いも元に戻る');
      }
      // 対照：購入以外（フェイズ移行）は同意なしにはならず、従来どおり承認制になる
      {
        const rm4 = rooms.get(h1j.code);
        rm4.state.turn.phase = 'action';
        h1.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
        const s2 = await h1.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy', 2000);
        ok(s2.undoFree === false, '購入以外は undoFree=false');
        h1.send({ t: 'undo' });
        const ask2 = await g1.waitFor((m) => m.t === 'undoAsk', 2000);
        ok(!!ask2, '購入以外はこれまでどおり相手に承認を求める');
        g1.send({ t: 'undoVote', ok: true });
        await h1.waitFor((m) => m.t === 'undoDone', 2000);
      }

      // 回帰【high】：相手が「猶予内の切断」中は、承認を取りようがないので undo を受理しない
      //   （ここを接続中判定にすると、相手のバックグラウンド落ち中に承認ゼロで何手でも巻き戻せてしまう）
      //   ※ h1/g1 の部屋は後続テストで使うので、専用の部屋を立てて検証する。
      const u0 = mkClient(URL); await u0.open();
      u0.send({ t: 'create', name: 'U0' });
      const u0j = await u0.waitFor((m) => m.t === 'joined');
      const u1 = mkClient(URL); await u1.open();
      u1.send({ t: 'join', code: u0j.code, name: 'U1' });
      await u1.waitFor((m) => m.t === 'joined');
      u0.send({ t: 'setCpu', count: 0 });
      await u0.waitFor((m) => m.t === 'lobby' && m.cpuCount === 0);
      u0.send({ t: 'start' });
      await u0.waitFor((m) => m.t === 'started');
      await u1.waitFor((m) => m.t === 'started');
      u0.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
      const uSync = await u0.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy', 2000);
      ok(uSync.canUndo === true, '前提：自分の手のあとは1手もどせる');
      u1.close(); // 相手がバックグラウンド落ち（猶予内の切断）
      await u0.waitFor((m) => m.t === 'state' && m.state.players[1].dc === true, 2000);
      const rm2 = rooms.get(u0j.code);
      ok(rm2.members.find((m) => m.seat === 1).expired === false, '前提：切断中でも席はまだ人間のもの（猶予内）');
      const phaseBefore = rm2.state.turn.phase;
      u0.send({ t: 'undo' });
      const waitErr = await u0.waitFor((m) => m.t === 'error', 2000);
      ok(/再接続を待っています/.test(waitErr.message), '切断中の相手がいる間は1手もどせない（承認バイパス防止）');
      ok(rooms.get(u0j.code).state.turn.phase === phaseBefore, '局面は動かない（承認ゼロの巻き戻しが起きない）');
      // 猶予が切れて席がCPUに引き継がれたら（expired）、承認は不要になる＝従来どおり即実行できる
      await sleep(700); // startedGraceMs=500 を超えて待つ
      ok(rooms.get(u0j.code).members.find((m) => m.seat === 1).expired === true, '前提：猶予切れで席がCPUに引き継がれる');
      u0.send({ t: 'undo' });
      const uBack = await u0.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'action', 3000);
      ok(!!uBack, '猶予切れ後は承認不要で巻き戻せる');
      ok((rooms.get(u0j.code).state.log || []).some((l) => /1手もどした/.test(l)), '巻き戻した事実がログに残る（復帰した人が後から確認できる）');
      u0.close();
      await sleep(50);
    }

    console.log('=== 再戦（rematch）: 終局後にホストが同メンバーで新対戦を開始 ===');
    // ゲーム終了状態を直接作る（フルプレイは別テストで担保済み）
    const room1 = rooms.get(h1j.code);
    room1.state.gameOver = true;
    // 非ホストの rematch は無視される
    g1.send({ t: 'rematch' });
    await sleep(80);
    ok(rooms.get(h1j.code).state.gameOver === true, '非ホストの rematch は無視');
    // ホストの rematch で新しい盤面が両者に配られる
    h1.send({ t: 'rematch' });
    const r0 = await h1.waitFor((m) => m.t === 'started', 2000);
    const r1 = await g1.waitFor((m) => m.t === 'started', 2000);
    ok(!r0.state.gameOver && !r1.state.gameOver, '再戦: 新しい対戦が開始される');
    ok(r0.you === 0 && r1.you === 1, '再戦: 同じ席のまま');
    ok(r0.state.players[0].hand.length === 5 && r0.state.players[0].hand.every((c) => c !== 'back'), '再戦: 新しい手札が配られる');
    ok(r1.state.players[0].hand.every((c) => c === 'back'), '再戦: マスキングも維持');

    console.log('=== 再戦: 相手が退出済みなら CPU を補充して成立させる ===');
    rooms.get(h1j.code).state.gameOver = true;
    g1.close();
    await sleep(60); // close が connected=false になるのを待つ
    h1.send({ t: 'rematch' });
    const rSolo = await h1.waitFor((m) => m.t === 'started', 2000);
    ok(rSolo.state.players.length === 2 && rSolo.state.players[1].isCpu === true, '退出者を外しCPU補充で再戦成立');
    h1.close();
    await sleep(50);

    console.log('=== 全員切断 → 猶予切れで部屋が破棄される（リーク防止） ===');
    const x1 = mkClient(URL); await x1.open();
    x1.send({ t: 'create', name: 'X1' });
    const x1j = await x1.waitFor((m) => m.t === 'joined');
    const x2 = mkClient(URL); await x2.open();
    x2.send({ t: 'join', code: x1j.code, name: 'X2' });
    await x2.waitFor((m) => m.t === 'joined');
    x1.send({ t: 'setCpu', count: 0 });
    await x1.waitFor((m) => m.t === 'lobby' && m.cpuCount === 0);
    x1.send({ t: 'start' });
    await x1.waitFor((m) => m.t === 'started');
    await x2.waitFor((m) => m.t === 'started');
    x1.close(); x2.close();
    ok(await (async () => { // startedGraceMs(500ms)+α で部屋が消える
      for (let i = 0; i < 40; i++) { if (!rooms.has(x1j.code)) return true; await sleep(50); }
      return false;
    })(), '全員の猶予切れで部屋が rooms から破棄される');

    console.log('=== 未開始ロビーの空室は猶予を待たず即破棄（作成→即切断のコード占有DoS対策）===');
    const q1 = mkClient(URL); await q1.open();
    q1.send({ t: 'create', name: 'Q1' });
    const q1j = await q1.waitFor((m) => m.t === 'joined');
    ok(rooms.has(q1j.code), '作成直後は部屋がある');
    q1.close();
    // 作成者のみの未開始ロビーは猶予(graceMs=300ms)を待たず即破棄される＝150ms未満で消えることを確認。
    ok(await (async () => { for (let i = 0; i < 10; i++) { if (!rooms.has(q1j.code)) return true; await sleep(15); } return false; })(),
      '作成者のみのロビーは切断で（猶予を待たず）即破棄される');

    console.log('=== 人間ゼロの間は CPU が一時停止し、復帰で再開する ===');
    const y1 = mkClient(URL); await y1.open();
    y1.send({ t: 'create', name: 'Y1' }); // 既定 cpuCount=1 → 1人間+1CPU
    const y1j = await y1.waitFor((m) => m.t === 'joined');
    y1.send({ t: 'start' });
    await y1.waitFor((m) => m.t === 'started');
    // 人間がターンを終えてCPUの手番にした直後に切断
    y1.send({ t: 'action', action: { type: 'END_ACTION_PHASE' } });
    await y1.waitFor((m) => m.t === 'state' && m.state.turn.phase === 'buy');
    y1.send({ t: 'action', action: { type: 'END_TURN' } });
    y1.close();
    await sleep(200); // 切断反映後・猶予(500ms)内
    const yRoom = rooms.get(y1j.code);
    ok(yRoom && yRoom.cpuTimer === null, '観戦者ゼロで cpuTimer が止まる（CPU空回しなし）');
    ok(yRoom && yRoom.state.turn.active === 1, 'CPUは手番の途中で凍結している');
    // 本人が復帰するとCPUが再開し、1ターン消化して人間に手番が戻る
    const y2 = mkClient(URL); await y2.open();
    y2.send({ t: 'resume', code: y1j.code, you: 0, token: y1j.token });
    await y2.waitFor((m) => m.t === 'started', 2000);
    const yBack = await y2.waitFor((m) => m.t === 'state' && m.state.turn.active === 0 && m.state.players[1].turns >= 1, 6000);
    ok(!!yBack, '復帰でCPUが再開し手番が人間に戻る');
    y2.close();

    console.log('=== 永続化: スナップショット→サーバ再起動相当→resume で対戦復元 ===');
    const { roomSnapshot, restoreRoom } = require('../server/gameServer');
    const z1 = mkClient(URL); await z1.open();
    z1.send({ t: 'create', name: 'Zico' }); // 1人間+1CPU
    const z1j = await z1.waitFor((m) => m.t === 'joined');
    z1.send({ t: 'start' });
    await z1.waitFor((m) => m.t === 'started');
    const snap = roomSnapshot(rooms.get(z1j.code)); // この時点の対戦状態を保存（=Redis相当）
    ok(snap && snap.started && snap.state && snap.members.some((m) => m.token === z1j.token), 'スナップショットに状態とtokenが含まれる');
    z1.close();
    // サーバ再起動を模す: 全部屋を破棄してから、保存スナップショットだけで復元
    __reset();
    ok(!rooms.has(z1j.code), '再起動相当で一旦部屋が消える');
    restoreRoom(snap);
    ok(rooms.has(z1j.code), 'スナップショットから部屋が復元される');
    // 復元後に元プレイヤーが resume → 対戦状態が戻る
    const z2 = mkClient(URL); await z2.open();
    z2.send({ t: 'resume', code: z1j.code, you: 0, token: z1j.token });
    const zBack = await z2.waitFor((m) => m.t === 'started' && m.state, 3000);
    ok(!!zBack, '復元した部屋へ resume で復帰できる（再起動後も対戦継続）');
    ok(zBack && zBack.state.players.length === snap.state.players.length, '復元された対戦の人数が一致');
    z2.close();

    console.log('=== 永続化: 未開始ロビーの復元は即破棄されない（DoS即破棄は復元に適用しない）===');
    const w1 = mkClient(URL); await w1.open();
    w1.send({ t: 'create', name: 'W1' });
    const w1j = await w1.waitFor((m) => m.t === 'joined');
    const lobbySnap = roomSnapshot(rooms.get(w1j.code)); // 未開始ロビーのスナップショット
    ok(lobbySnap && !lobbySnap.started && lobbySnap.state == null, 'ロビー(未開始・state無し)のスナップショット');
    w1.close();
    __reset();
    restoreRoom(lobbySnap);
    ok(rooms.has(w1j.code), '未開始ロビーは復元直後に即破棄されない（resume 猶予を残す）');

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
