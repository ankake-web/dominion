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

const WS_PATH = '/ws';
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;
const LEVELS = ['easy', 'normal', 'hard'];

// タイミング（attachGameServer で上書き可能。テストでは短縮値を注入）
let CPU_STEP_MS = 850;   // CPUの一手ごとの間(ms)
let GRACE_MS = 90000;    // 切断→席解放/ルーム破棄までの猶予(ms)

// 同期を許可する操作（サーバ側ホワイトリスト）
const ALLOWED = new Set([
  'PLAY_ACTION', 'PLAY_TREASURE', 'PLAY_ALL_TREASURES', 'BUY',
  'END_ACTION_PHASE', 'END_TURN',
  'CELLAR_RESOLVE', 'MILITIA_RESOLVE', 'MOAT_REVEAL',
  'MINE_TRASH', 'MINE_GAIN', 'REMODEL_TRASH', 'REMODEL_GAIN', 'WORKSHOP_GAIN',
]);

const rooms = new Map();

/* ---------- 小物 ---------- */
function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
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
  const cpus = cpuSeats(room).map((seat, i) => ({ seat, name: 'CPU' + (i + 1), isHost: false, connected: true, isCpu: true, level: room.cpuLevel }));
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
  };
  for (const m of room.members) send(m.ws, msg);
}

/* ---------- 配信（視点別マスク） ---------- */
function broadcastState(room) {
  if (!room.state) return;
  for (const m of room.members) {
    if (!m.connected) continue;
    send(m.ws, { t: 'state', state: E.maskStateFor(room.state, m.seat) });
  }
}

/* ---------- 開始 ---------- */
function buildConfigs(room) {
  clampCpu(room);
  const total = room.members.length + room.cpuCount;
  const bySeat = {};
  for (const m of room.members) bySeat[m.seat] = { name: m.name, isCpu: false, level: 'normal' };
  const cseats = cpuSeats(room);
  cseats.forEach((seat, i) => { bySeat[seat] = { name: 'CPU' + (i + 1), isCpu: true, level: room.cpuLevel }; });
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
  room.state = E.createInitialState(configs);
  room.started = true;
  for (const m of room.members) {
    send(m.ws, { t: 'started', you: m.seat, state: E.maskStateFor(room.state, m.seat) });
  }
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
    if (!room.started || !currentIsCpu(room)) return;
    let action;
    try { action = CPU.decide(room.state); } catch { return; }
    try { room.state = E.reduce(room.state, action); } catch { return; }
    broadcastState(room);
    scheduleCpuTick(room, CPU.delayFor(action));
  }, delay);
}

/* ---------- 切断時：席を一時CPU化／復帰 ---------- */
function setSeatCpu(room, seat, isCpu) {
  if (!room.state) return;
  const p = room.state.players[seat];
  if (!p || p.isCpu === isCpu) return;
  p.isCpu = isCpu;
  if (isCpu) p.cpuLevel = room.cpuLevel;
}
function scheduleRelease(room, member) {
  if (member.graceTimer) clearTimeout(member.graceTimer);
  member.graceTimer = setTimeout(() => {
    member.graceTimer = null;
    if (member.connected) return;
    if (room.started) {
      // 開始後は席を解放しない（token で復帰可能）。全員不在になったらルーム破棄。
      if (connectedHumans(room) === 0) destroyRoom(room);
      return;
    }
    // ロビー中は席を解放
    room.members = room.members.filter((m) => m !== member);
    if (member.isHost && room.members.length && !room.members.some((m) => m.isHost)) room.members[0].isHost = true;
    if (room.members.length === 0) { destroyRoom(room); return; }
    broadcastLobby(room);
  }, room.graceMs);
}
function destroyRoom(room) {
  if (room.cpuTimer) { clearTimeout(room.cpuTimer); room.cpuTimer = null; }
  for (const m of room.members) if (m.graceTimer) { clearTimeout(m.graceTimer); m.graceTimer = null; }
  rooms.delete(room.code);
}

/* ============================================================
   接続ハンドラ
   ============================================================ */
function handleConnection(ws) {
  let room = null;
  let me = null;
  let badJoins = 0;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(String(data)); } catch { return; }

    switch (msg.t) {
      case 'create': {
        if (room) return;
        let code;
        try { code = genCode(); } catch { send(ws, { t: 'error', message: 'ルームを作成できませんでした' }); return; }
        room = {
          code, members: [], started: false, state: null,
          cpuCount: 1, cpuLevel: 'normal', cpuTimer: null,
          graceMs: GRACE_MS, cpuStepMs: CPU_STEP_MS,
        };
        rooms.set(code, room);
        me = { ws, seat: 0, name: sanitizeName(msg.name) || 'ホスト', isHost: true, connected: true, token: genToken(), graceTimer: null };
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
        me = { ws, seat, name: sanitizeName(msg.name) || ('プレイヤー' + (seat + 1)), isHost: false, connected: true, token: genToken(), graceTimer: null };
        room.members.push(me);
        send(ws, { t: 'joined', code: room.code, you: me.seat, isHost: false, token: me.token, started: false });
        broadcastLobby(room);
        break;
      }
      case 'resume': {
        if (room) return;
        const target = rooms.get(String(msg.code || '').trim());
        if (!target) { send(ws, { t: 'error', message: '接続が切れました。入り直してください', fatal: true }); return; }
        const member = target.members.find((m) => m.seat === msg.you && m.token === msg.token);
        if (!member) { send(ws, { t: 'error', message: '接続が切れました。入り直してください', fatal: true }); return; }
        if (member.ws && member.ws !== ws) { try { member.ws.close(); } catch (e) { /* noop */ } }
        if (member.graceTimer) { clearTimeout(member.graceTimer); member.graceTimer = null; }
        member.ws = ws; member.connected = true;
        room = target; me = member;
        send(ws, { t: 'joined', code: target.code, you: member.seat, isHost: member.isHost, token: member.token, started: target.started });
        if (target.started && target.state) {
          setSeatCpu(target, member.seat, false); // 本人復帰→人間へ
          send(ws, { t: 'started', you: member.seat, state: E.maskStateFor(target.state, member.seat) });
          broadcastState(target);                  // 他メンバーへも「人間へ復帰」を反映
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
      case 'action': {
        if (!room || !me || !room.started || !room.state) return;
        const action = msg.action;
        if (!action || !ALLOWED.has(action.type)) { send(ws, { t: 'error', message: 'この操作は対応していません' }); return; }
        if (E.actor(room.state) !== me.seat) { send(ws, { t: 'error', message: 'あなたの操作できる場面ではありません' }); return; }
        try { room.state = E.reduce(room.state, action); } catch { send(ws, { t: 'error', message: '無効な操作です' }); return; }
        broadcastState(room);
        scheduleCpuTick(room, room.cpuStepMs);
        break;
      }
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
      setSeatCpu(room, me.seat, true); // 切断中はCPUが代行
      if (connectedHumans(room) === 0) {
        if (room.cpuTimer) { clearTimeout(room.cpuTimer); room.cpuTimer = null; }
      } else {
        broadcastState(room);
        scheduleCpuTick(room, room.cpuStepMs);
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
  const allowedOrigins = opts.allowedOrigins;
  if (opts.graceMs != null) GRACE_MS = opts.graceMs;
  if (opts.cpuStepMs != null) CPU_STEP_MS = opts.cpuStepMs;
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    let pathname = '/';
    try { pathname = new URL(req.url || '/', 'http://localhost').pathname; } catch (e) { /* noop */ }
    if (pathname !== WS_PATH) return;
    if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws));
  });
  return wss;
}

module.exports = { attachGameServer, WS_PATH, isOriginAllowed, rooms, __reset: () => { for (const r of rooms.values()) destroyRoom(r); rooms.clear(); } };
