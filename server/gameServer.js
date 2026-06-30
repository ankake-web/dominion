// ============================================================
// server/gameServer.js — ドミニオン オンライン対戦サーバ（サーバ権威）
// ============================================================
//
// 役割:
//   - ルーム作成/参加（数字4桁コード）、ロビー、CPU人数/強さ設定、ホストの開始
//   - 正本ゲーム状態はサーバが保持し、共有エンジン(js/engine.js)で更新
//   - 各クライアントへ「自分視点でマスクした状態」だけ配信（他人の手札・山札は伏せる）
//   - 空席はCPUで充填し、CPUの手番はサーバ側で駆動
//   - 切断中はそのプレイヤーを一時CPU化して進行、再接続(token一致)で人間へ復帰
//
// ルール本体はクライアントと同じ js/engine.js / js/cpu.js を require して使う（二重実装しない）。

const { WebSocketServer } = require('ws');
const { randomInt, randomBytes } = require('node:crypto');

require('../js/cards.js');
require('../js/engine.js');
require('../js/cpu.js');
const DOM = global.DOM;
const E = DOM.engine;
const CPU = DOM.cpu;

// 永続化（任意）。UPSTASH_REDIS_REST_URL/TOKEN が設定されていれば対戦状態を保存し、
// サーバ再起動後に復元する。未設定なら全て no-op（メモリのみ＝従来動作）。
const store = require('./persist').createStore();

const WS_PATH = '/ws';
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;
const LEVELS = ['easy', 'normal', 'hard'];
// CPUの名前（普通の短い名前。席ごとに一定 → ロビーと対戦で同じ名前になる）
const CPU_NAMES = ['ケン', 'ユイ', 'レオ', 'ミオ', 'ソラ', 'ハル'];
function cpuName(seat) { return CPU_NAMES[seat % CPU_NAMES.length]; }

// タイミング（attachGameServer で上書き可能。テストでは短縮値を注入）
let CPU_STEP_MS = 850;        // CPUの一手ごとの間(ms)
let GRACE_MS = 60000;         // ロビー中の切断→席解放までの猶予(ms)
let STARTED_GRACE_MS = 300000; // 対戦中の切断→席を保持する猶予(ms, 5分)。この間は同じplayerIdで復帰可
let HEARTBEAT_MS = 25000;     // サーバ→クライアントの死活ping間隔(ms)
let START_ACTIVE = 'random';  // 開始プレイヤー（公式ルール: ランダム）。テストは 0 を注入して決定論化

// 同期を許可する操作（サーバ側ホワイトリスト）
// 許可するアクション種別は engine が唯一の正本（DOM.engine.PLAYER_ACTIONS）。
// ここで二重管理しない＝新カードのアクションを追加し忘れてオンラインだけ壊れる事故を防ぐ。
const ALLOWED = (E && E.PLAYER_ACTIONS) ? E.PLAYER_ACTIONS : new Set();
// 使える王国カードのセット（クライアントと同じ定義を流用。セット追加時も自動で許可される）
const KINGDOM_SETS = (DOM.CARD_SETS && DOM.CARD_SETS.map((s) => s.id)) || ['basic', 'intrigue', 'random'];

const rooms = new Map();

/* ---------- 小物 ---------- */
// 送信は必ず握りつぶす。ws.send は OPEN 判定後でも throw し得る(ERR_STREAM_DESTROYED 等)、
// JSON.stringify も理論上 throw し得る。broadcast やタイマー内で呼ばれるため、ここで止めないと
// 例外が setTimeout/forEach の外へ伝播し uncaughtException → プロセス即死になる。
function send(ws, msg) {
  try {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  } catch (e) { /* 1接続の送信失敗で全体を巻き込まない */ }
}

// プロセス全体の最後の砦。各所で try/catch するが、漏れた例外でも“プロセスごと”落とさない。
// （Render では落ちると in-memory の全対戦が消えて復帰不能になるため、稼働継続を優先）
let _guardsInstalled = false;
function installProcessGuards() {
  if (_guardsInstalled) return;
  _guardsInstalled = true;
  if (typeof process !== 'undefined' && process.on) {
    process.on('uncaughtException', (err) => { try { console.error('[dominion] uncaughtException:', (err && (err.stack || err.message)) || err); } catch (e) { /* noop */ } });
    process.on('unhandledRejection', (reason) => { try { console.error('[dominion] unhandledRejection:', (reason && (reason.stack || reason.message)) || reason); } catch (e) { /* noop */ } });
  }
}
function genToken() { return randomBytes(24).toString('base64url'); }
function genCode() {
  for (let attempt = 0; attempt < 300; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += String(randomInt(10));
    if (!rooms.has(code)) return code;
  }
  throw new Error('ルームコードの空きがありません');
}
function sanitizeName(raw) { return String(raw == null ? '' : raw).trim().slice(0, 16); }

/* ---------- 座席・CPU ---------- */
function usedSeats(room) { return new Set(room.members.map((m) => m.seat)); }
function nextFreeSeat(room) {
  const used = usedSeats(room);
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return -1;
}
function cpuSeats(room) {
  const used = usedSeats(room);
  const free = [];
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) free.push(i);
  return free.slice(0, room.cpuCount);
}
function clampCpu(room) {
  const maxCpu = Math.max(0, MAX_PLAYERS - room.members.length);
  room.cpuCount = Math.min(Math.max(0, room.cpuCount), maxCpu);
}
function connectedHumans(room) { return room.members.filter((m) => m.connected).length; }

/* ---------- ロビー ---------- */
function lobbyPlayers(room) {
  const humans = [...room.members]
    .sort((a, b) => a.seat - b.seat)
    .map((m) => ({ seat: m.seat, name: m.name, isHost: m.isHost, connected: m.connected, isCpu: false }));
  const cpus = cpuSeats(room).map((seat) => ({ seat, name: cpuName(seat), isHost: false, connected: true, isCpu: true, level: room.cpuLevel }));
  return [...humans, ...cpus].sort((a, b) => a.seat - b.seat);
}
function broadcastLobby(room) {
  clampCpu(room);
  const humans = connectedHumans(room);
  const total = room.members.length + room.cpuCount;
  const msg = {
    t: 'lobby',
    code: room.code,
    players: lobbyPlayers(room),
    canStart: humans >= 1 && total >= MIN_PLAYERS && total <= MAX_PLAYERS,
    cpuCount: room.cpuCount,
    maxCpu: Math.max(0, MAX_PLAYERS - room.members.length),
    cpuLevel: room.cpuLevel,
    kingdomSet: room.kingdomSet || 'basic',
    randomOrder: room.randomOrder !== false,
  };
  for (const m of room.members) send(m.ws, msg);
  persistRoom(room);
}

/* ---------- 配信（視点別マスク） ---------- */
function broadcastState(room) {
  if (!room.state) return;
  for (const m of room.members) {
    if (!m.connected) continue;
    send(m.ws, { t: 'state', state: E.maskStateFor(room.state, m.seat) });
  }
  persistRoom(room);
}

/* ---------- 永続化（再起動後の復元用） ---------- */
// 永続化する部屋スナップショット。ws/タイマーなど直列化できないものは除外。
function roomSnapshot(room) {
  return {
    code: room.code,
    started: !!room.started,
    state: room.state || null,
    cpuCount: room.cpuCount,
    cpuLevel: room.cpuLevel,
    kingdomSet: room.kingdomSet || 'basic',
    randomOrder: room.randomOrder !== false,
    members: room.members.map((m) => ({ seat: m.seat, name: m.name, isHost: m.isHost, token: m.token })),
  };
}
// 連続する状態変化を 1.2 秒に1回へ間引いて保存（Upstashのリクエスト数を抑える）。
function persistRoom(room) {
  if (!store.enabled || !room || room._destroyed) return;
  if (room._persistTimer) return;
  room._persistTimer = setTimeout(() => {
    room._persistTimer = null;
    if (!room._destroyed) store.save(room.code, roomSnapshot(room));
  }, 1200);
}
// 起動時にスナップショットから部屋を復元。全員切断状態で作り、resume(token一致)で各人が戻る。
function restoreRoom(snap) {
  if (!snap || !snap.code || rooms.has(snap.code)) return;
  if (snap.state && snap.state.gameOver) { store.del(snap.code); return; } // 終了済みは復元しない
  const room = {
    code: snap.code, members: [], started: !!snap.started, state: snap.state || null,
    cpuCount: snap.cpuCount != null ? snap.cpuCount : 1, cpuLevel: snap.cpuLevel || 'normal',
    kingdomSet: snap.kingdomSet || 'basic', randomOrder: snap.randomOrder !== false, cpuTimer: null,
    graceMs: GRACE_MS, startedGraceMs: STARTED_GRACE_MS, cpuStepMs: CPU_STEP_MS,
  };
  room.members = (snap.members || []).map((m) => ({
    ws: null, seat: m.seat, name: m.name, isHost: m.isHost, connected: false, token: m.token, graceTimer: null, expired: false,
  }));
  if (room.started && room.state) room.members.forEach((m) => setSeatDc(room, m.seat, true));
  rooms.set(room.code, room);
  // 復元直後は誰も接続していない。猶予の間に resume が来なければ掃除する。
  room.members.forEach((m) => scheduleRelease(room, m));
  return room;
}

/* ---------- 開始 ---------- */
function buildConfigs(room) {
  clampCpu(room);
  const total = room.members.length + room.cpuCount;
  const bySeat = {};
  for (const m of room.members) bySeat[m.seat] = { name: m.name, isCpu: false, level: 'normal' };
  const cseats = cpuSeats(room);
  cseats.forEach((seat) => { bySeat[seat] = { name: cpuName(seat), isCpu: true, level: room.cpuLevel }; });
  // 座席 0..total-1 を詰めて並べる（members は最小空席から割当・CPUも最小空席を埋めるので連続）
  const seats = Object.keys(bySeat).map(Number).sort((a, b) => a - b);
  // members の seat を 0..total-1 の連番へ正規化（途中退室で歯抜けがあっても詰める）
  const remap = {};
  seats.forEach((s, idx) => { remap[s] = idx; });
  room.members.forEach((m) => { m.seat = remap[m.seat]; });
  return seats.map((s) => bySeat[s]);
}
function startGame(room) {
  const configs = buildConfigs(room);
  if (configs.length < MIN_PLAYERS) return;
  // 王国カード（基本/陰謀/ランダム）。'random' はサーバ権威で1度だけ確定し全員で共有する。
  const kingdom = DOM.kingdomForSet ? DOM.kingdomForSet(room.kingdomSet || 'basic') : null;
  // 手番順: テストは START_ACTIVE に整数(0)を注入して決定論化するので最優先。
  // 本番はホストのトグル（randomOrder）に従う：ランダム＝開始席をランダム化／上から順＝席0(ホスト)固定。
  const startActive = Number.isInteger(START_ACTIVE)
    ? START_ACTIVE
    : (room.randomOrder !== false ? 'random' : 0);
  room.state = E.createInitialState(configs, kingdom, { startActive });
  room.started = true;
  for (const m of room.members) {
    send(m.ws, { t: 'started', you: m.seat, state: E.maskStateFor(room.state, m.seat) });
  }
  persistRoom(room);
  scheduleCpuTick(room, room.cpuStepMs);
}

/* ---------- サーバ側 CPU 駆動 ---------- */
function currentIsCpu(room) {
  if (!room.state || room.state.gameOver) return false;
  const actor = E.actor(room.state);
  return !!room.state.players[actor].isCpu;
}
function scheduleCpuTick(room, delay) {
  if (room.cpuTimer) { clearTimeout(room.cpuTimer); room.cpuTimer = null; }
  if (!room.started || !currentIsCpu(room)) return;
  if (connectedHumans(room) === 0) return; // 観戦者ゼロなら一時停止（再接続で再開）
  room.cpuTimer = setTimeout(() => {
    room.cpuTimer = null;
    // タイマー内の例外は uncaughtException → プロセス死になるため、全体を保護する。
    try {
      if (!room.started || !currentIsCpu(room) || room._destroyed) return;
      const action = CPU.decide(room.state);
      room.state = E.reduce(room.state, action);
      broadcastState(room);
      scheduleCpuTick(room, CPU.delayFor(action));
    } catch (e) {
      try { console.error('[dominion] CPU tick error:', (e && e.message) || e); } catch (e2) { /* noop */ }
    }
  }, delay);
}

/* ---------- 切断・復帰の席状態 ---------- */
function setSeatCpu(room, seat, isCpu) {
  if (!room.state) return;
  const p = room.state.players[seat];
  if (!p) return;
  if (isCpu) { p.isCpu = true; p.cpuLevel = room.cpuLevel; }
  else { p.isCpu = false; }
}
// 席を「切断中(再接続待ち)」としてマーク。dc=true の人間席は CPU が代行しない（手札を保持して待つ）。
function setSeatDc(room, seat, dc) {
  if (!room.state) return;
  const p = room.state.players[seat];
  if (p) p.dc = !!dc;
}
function scheduleRelease(room, member) {
  if (member.graceTimer) clearTimeout(member.graceTimer);
  const grace = room.started ? room.startedGraceMs : room.graceMs;
  member.graceTimer = setTimeout(() => {
    member.graceTimer = null;
    // 猶予タイマー内の例外も uncaughtException → プロセス死になるため保護する。
    try {
      if (member.connected || room._destroyed) return; // 既に復帰済み/破棄済み
      if (room.started) {
        // 猶予切れ：この席はもう戻らない扱い。CPUに引き継いで残りのプレイヤーが続行できるようにする。
        member.expired = true;
        setSeatDc(room, member.seat, false);
        setSeatCpu(room, member.seat, true);
        broadcastState(room);
        scheduleCpuTick(room, room.cpuStepMs);
        // 接続中の人間が誰もおらず、全メンバーの猶予が切れていれば部屋を破棄。
        if (connectedHumans(room) === 0 && room.members.every((m) => m.expired)) destroyRoom(room);
        return;
      }
      // ロビー中は席を解放
      room.members = room.members.filter((m) => m !== member);
      if (member.isHost && room.members.length && !room.members.some((m) => m.isHost)) room.members[0].isHost = true;
      if (room.members.length === 0) { destroyRoom(room); return; }
      broadcastLobby(room);
    } catch (e) {
      try { console.error('[dominion] grace timer error:', (e && e.message) || e); } catch (e2) { /* noop */ }
    }
  }, grace);
}
function destroyRoom(room) {
  if (room._destroyed) return;          // 冪等化：二重破棄でも無害
  room._destroyed = true;
  if (room.cpuTimer) { clearTimeout(room.cpuTimer); room.cpuTimer = null; }
  if (room._persistTimer) { clearTimeout(room._persistTimer); room._persistTimer = null; }
  store.del(room.code); // 永続化済みなら削除（ゴミを残さない）
  for (const m of room.members) {
    if (m.graceTimer) { clearTimeout(m.graceTimer); m.graceTimer = null; }
    // 破棄時点でメンバーは切断済み(ws=null)が前提。万一残っていれば閉じるだけ（リスナーは
    // 触らない＝ws内部のclients掃除/errorハンドラを巻き添えにしない）。
    if (m.ws) { try { m.ws.close(); } catch (e) { /* noop */ } m.ws = null; }
  }
  rooms.delete(room.code);
}

/* ============================================================
   接続ハンドラ
   ============================================================ */
function handleConnection(ws) {
  let room = null;
  let me = null;
  let badJoins = 0;

  // ★最重要: 各WebSocketに 'error' リスナーを必ず付ける。
  // ws(EventEmitter)は 'error' をリスナー無しで emit すると throw → プロセス即死。
  // 本番では ECONNRESET / NATタイムアウト等で頻繁に 'error' が飛ぶため、ここで握らないと落ちる。
  ws.on('error', (err) => { try { console.error('[dominion] ws error:', (err && err.code) || (err && err.message) || err); } catch (e) { /* noop */ } });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(String(data)); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    // メッセージ処理全体を保護。switch内のどこで throw しても、emitの外へ出さない（=プロセス死を防ぐ）。
    try {
      // キープアライブ：クライアントのpingに即pongを返す（NAT/Renderのアイドル切断防止＆死活確認）
      if (msg.t === 'ping') { ws.isAlive = true; send(ws, { t: 'pong' }); return; }
      if (msg.t === 'pong') { ws.isAlive = true; return; }

      switch (msg.t) {
      case 'create': {
        if (room) return;
        let code;
        try { code = genCode(); } catch { send(ws, { t: 'error', message: 'ルームを作成できませんでした' }); return; }
        room = {
          code, members: [], started: false, state: null,
          cpuCount: 1, cpuLevel: 'normal', kingdomSet: 'basic', randomOrder: true, cpuTimer: null,
          graceMs: GRACE_MS, startedGraceMs: STARTED_GRACE_MS, cpuStepMs: CPU_STEP_MS,
        };
        rooms.set(code, room);
        me = { ws, seat: 0, name: sanitizeName(msg.name) || 'ホスト', isHost: true, connected: true, token: genToken(), graceTimer: null, expired: false };
        room.members.push(me);
        send(ws, { t: 'joined', code, you: me.seat, isHost: true, token: me.token, started: false });
        broadcastLobby(room);
        break;
      }
      case 'join': {
        if (room) return;
        const target = rooms.get(String(msg.code || '').trim());
        if (!target) {
          if (++badJoins >= 12) { send(ws, { t: 'error', message: '試行が多すぎます。入り直してください', fatal: true }); try { ws.close(); } catch (e) { /* noop */ } return; }
          send(ws, { t: 'error', message: 'ルームが見つかりません' }); return;
        }
        badJoins = 0;
        if (target.started) { send(ws, { t: 'error', message: 'このルームは開始済みです' }); return; }
        const seat = nextFreeSeat(target);
        if (seat < 0) { send(ws, { t: 'error', message: 'ルームが満員です（最大4人）' }); return; }
        room = target;
        me = { ws, seat, name: sanitizeName(msg.name) || ('プレイヤー' + (seat + 1)), isHost: false, connected: true, token: genToken(), graceTimer: null, expired: false };
        room.members.push(me);
        send(ws, { t: 'joined', code: room.code, you: me.seat, isHost: false, token: me.token, started: false });
        broadcastLobby(room);
        break;
      }
      case 'resume': {
        if (room) return;
        const target = rooms.get(String(msg.code || '').trim());
        // 部屋がもう無い（サーバ再起動など）→ 復帰不能を明示（ROOM_GONE）
        if (!target) { send(ws, { t: 'error', message: 'この対戦はもう存在しません', fatal: true, reason: 'ROOM_GONE' }); return; }
        const member = target.members.find((m) => m.seat === msg.you && m.token === msg.token);
        if (!member) { send(ws, { t: 'error', message: 'この対戦に復帰できませんでした', fatal: true, reason: 'ROOM_GONE' }); return; }
        // 旧接続を片付ける。先に member.ws を外して旧wsのcloseハンドラを無効化する
        // （close側の me.ws!==ws チェックで早期returnする）。旧wsは close すれば ws ライブラリが
        // 内部リスナーで wss.clients から除去し、参照が切れて GC される（リスナーは手動除去しない
        // ＝ライブラリ内部のclients掃除リスナーを巻き添えにしないため）。
        if (member.ws && member.ws !== ws) {
          const oldWs = member.ws;
          member.ws = null;
          try { oldWs.close(); } catch (e) { /* noop */ }
        }
        if (member.graceTimer) { clearTimeout(member.graceTimer); member.graceTimer = null; }
        member.ws = ws; member.connected = true; member.expired = false;
        room = target; me = member;
        send(ws, { t: 'joined', code: target.code, you: member.seat, isHost: member.isHost, token: member.token, started: target.started });
        if (target.started && target.state) {
          setSeatDc(target, member.seat, false);   // 切断中マーク解除
          setSeatCpu(target, member.seat, false);  // CPU代行していたら人間へ戻す
          send(ws, { t: 'started', you: member.seat, state: E.maskStateFor(target.state, member.seat) });
          broadcastState(target);                  // 他メンバーへも「復帰」を反映（再接続中…表示が消える）
          scheduleCpuTick(target, target.cpuStepMs);
        } else {
          broadcastLobby(target);
        }
        break;
      }
      case 'rename': {
        if (!room || !me || room.started) return;
        me.name = sanitizeName(msg.name) || me.name;
        broadcastLobby(room);
        break;
      }
      case 'setCpu': {
        if (!room || !me || !me.isHost || room.started) return;
        room.cpuCount = Number.isFinite(msg.count) ? Math.floor(msg.count) : room.cpuCount;
        broadcastLobby(room);
        break;
      }
      case 'setConfig': {
        if (!room || !me || !me.isHost || room.started) return;
        if (LEVELS.includes(msg.cpuLevel)) room.cpuLevel = msg.cpuLevel;
        if (KINGDOM_SETS.includes(msg.kingdomSet)) room.kingdomSet = msg.kingdomSet;
        if (typeof msg.randomOrder === 'boolean') room.randomOrder = msg.randomOrder;
        broadcastLobby(room);
        break;
      }
      case 'start': {
        if (!room || !me || !me.isHost || room.started) return;
        clampCpu(room);
        const total = room.members.length + room.cpuCount;
        if (connectedHumans(room) < 1 || total < MIN_PLAYERS || total > MAX_PLAYERS) {
          send(ws, { t: 'error', message: '人間1人以上・合計2〜4人で開始できます' }); return;
        }
        startGame(room);
        break;
      }
      case 'rematch': {
        // 終局後、同じ部屋・同じメンバーで再戦（ホストのみ）。部屋コードの共有し直しが不要になる。
        if (!room || !me || !me.isHost || !room.started || !room.state || !room.state.gameOver) return;
        // 切断中（結果画面から退出済み等）のメンバーは外し、席は buildConfigs が詰め直す
        for (const m of room.members.slice()) {
          if (!m.connected) {
            if (m.graceTimer) { clearTimeout(m.graceTimer); m.graceTimer = null; }
            room.members.splice(room.members.indexOf(m), 1);
          }
        }
        clampCpu(room);
        // 相手が抜けて1人になっていたら CPU を補充して対戦を成立させる
        if (room.members.length + room.cpuCount < MIN_PLAYERS) {
          room.cpuCount = Math.min(MAX_PLAYERS - room.members.length, MIN_PLAYERS - room.members.length);
        }
        startGame(room);
        break;
      }
      case 'action': {
        if (!room || !me || !room.started || !room.state) return;
        if (room.state.gameOver) { send(ws, { t: 'error', message: 'この対戦は終了しました' }); return; }
        const action = msg.action;
        if (!action || typeof action !== 'object' || !ALLOWED.has(action.type)) { send(ws, { t: 'error', message: 'この操作は対応していません' }); return; }
        if (E.actor(room.state) !== me.seat) { send(ws, { t: 'error', message: 'あなたの操作できる場面ではありません' }); return; }
        try { room.state = E.reduce(room.state, action); } catch { send(ws, { t: 'error', message: '無効な操作です' }); return; }
        broadcastState(room);
        scheduleCpuTick(room, room.cpuStepMs);
        break;
      }
      }
    } catch (e) {
      try { console.error('[dominion] message handler error:', (e && e.message) || e); } catch (e2) { /* noop */ }
    }
  });

  ws.on('close', () => {
    if (!room || !me) return;
    if (me.ws !== ws) return; // 既に別接続へ置き換わっている
    me.connected = false; me.ws = null;
    if (!room.started) {
      broadcastLobby(room);
      scheduleRelease(room, me);
    } else {
      // 対戦中：席を「切断中(再接続待ち)」にする。猶予の間はCPU代行せず手札を保持して待つ。
      // 相手には dc=true が配信され「再接続中…」が表示される。
      setSeatDc(room, me.seat, true);
      if (connectedHumans(room) === 0) {
        if (room.cpuTimer) { clearTimeout(room.cpuTimer); room.cpuTimer = null; }
      } else {
        broadcastState(room);
        // dc席はCPU化しないので、その席の手番なら進行は止まり「再接続中…」のまま待機する。
      }
      scheduleRelease(room, me);
    }
  });
}

/* ---------- Origin 許可判定 ---------- */
function isOriginAllowed(origin, allowlist) {
  if (!allowlist || allowlist.length === 0) return true; // 未設定=ローカル開発（全許可）
  if (!origin) return true;                              // 非ブラウザ（テスト/CLI）
  if (allowlist.includes('*')) return true;
  return allowlist.includes(origin);
}

/* ---------- HTTPサーバに WebSocket を相乗りさせる ---------- */
function attachGameServer(httpServer, opts = {}) {
  installProcessGuards(); // プロセス全体の最後の砦（index.js 経由でもテスト経由でも有効に）
  // 起動時: 永続化済みの対戦を復元（有効時のみ。失敗してもサーバ起動は妨げない）。
  if (store.enabled && !opts.skipRestore) {
    store.loadAll().then((snaps) => {
      let n = 0; (snaps || []).forEach((s) => { try { if (restoreRoom(s)) n++; } catch (e) { /* skip */ } });
      if (n) { try { console.log('[dominion] 永続化から ' + n + ' 部屋を復元'); } catch (e) { /* noop */ } }
    }).catch(() => { /* noop */ });
  }
  const allowedOrigins = opts.allowedOrigins;
  if (opts.graceMs != null) GRACE_MS = opts.graceMs;
  if (opts.startedGraceMs != null) STARTED_GRACE_MS = opts.startedGraceMs;
  if (opts.cpuStepMs != null) CPU_STEP_MS = opts.cpuStepMs;
  if (opts.startActive != null) START_ACTIVE = opts.startActive;
  const heartbeatMs = opts.heartbeatMs != null ? opts.heartbeatMs : HEARTBEAT_MS;
  // maxPayload: 巨大ペイロードでheap爆発→プロセス死を防ぐ（正規メッセージは数KB）。
  const maxPayload = opts.maxPayload != null ? opts.maxPayload : 64 * 1024;
  const wss = new WebSocketServer({ noServer: true, maxPayload });
  wss.on('error', (err) => { try { console.error('[dominion] wss error:', (err && err.message) || err); } catch (e) { /* noop */ } });
  httpServer.on('upgrade', (req, socket, head) => {
    // upgrade中のrawソケットにも 'error' を付けておく（ハンドシェイク中のリセットで落とさない）。
    socket.on('error', (err) => { try { console.error('[dominion] upgrade socket error:', (err && err.code) || err); } catch (e) { /* noop */ } });
    let pathname = '/';
    try { pathname = new URL(req.url || '/', 'http://localhost').pathname; } catch (e) { /* noop */ }
    if (pathname !== WS_PATH) { try { socket.destroy(); } catch (e) { /* noop */ } return; }
    if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
      try { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); } catch (e) { /* noop */ } return;
    }
    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        handleConnection(ws);
      });
    } catch (e) { try { socket.destroy(); } catch (e2) { /* noop */ } }
  });

  // 死活監視：応答の無い（半開き）ソケットを検出して切断扱いにする。
  // WebSocketプロトコルのping/pongを送り、前回からpongが無ければ terminate する。
  const hb = setInterval(() => {
    wss.clients.forEach((ws) => {
      try {
        if (ws.isAlive === false) { ws.terminate(); return; }
        ws.isAlive = false;
        ws.ping();
      } catch (e) { /* noop */ }
    });
  }, heartbeatMs);
  if (hb.unref) hb.unref();
  const stopHb = () => clearInterval(hb);
  wss.on('close', stopHb);
  httpServer.on('close', stopHb); // noServer では wss 'close' が発火しないため、httpの閉鎖でも確実に止める
  return wss;
}

// 診断用: 永続化が有効か・部屋数を返す（/status で公開）
function status() { return { persist: !!store.enabled, rooms: rooms.size }; }

module.exports = { attachGameServer, installProcessGuards, WS_PATH, isOriginAllowed, rooms, roomSnapshot, restoreRoom, status, __reset: () => { for (const r of rooms.values()) destroyRoom(r); rooms.clear(); } };
