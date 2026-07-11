/* 帝国（Empires）横型イベント（買う横型）の検証（Node 単体実行）
   使い方: node test/events.test.js
   対象（EV0＝共通基盤 BUY_EVENT ＋ EV1＝簡単イベント）:
     delve/wedding/dominate/windfall/conquest/triumph/salt_the_earth/banquet/advance/ritual。
     - BUY_EVENT：購入権1消費・イベント自体は獲得しない・複数回可・負債>0では買えない・負債コストは負債を負う。
     - 新pending（salt/banquet/advance/ritual）の裁定＋CPU decidePending の終端保証（無限ループしない）。
   ※ tax/donate/annex（EV2）と CARD_SET昇格（EV3）は後続バッチ。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260711;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
const reduce = (s, a) => E.reduce(s, a);
function mk(events, coins, buys) {
  const s = E.createInitialState(['あなた', '相手'], DOM.KINGDOM_EMPIRES.slice(), { startActive: 0, events: events });
  s.turn.phase = 'buy'; s.turn.coins = coins == null ? 8 : coins; s.turn.buys = buys == null ? 1 : buys;
  return s;
}
const me = (s) => s.players[0];
const cnt = (arr, id) => arr.filter((c) => c === id).length;
// pending を CPU に解決させ、最大 lim 手で終端するか（無限ループ検知）。
function cpuResolve(s, lim) {
  let g = 0;
  while (s.pending && g++ < (lim || 30)) { const a = CPU.decide(s); if (!a) break; s = reduce(s, a); }
  return s;
}

console.log('=== EV0＝共通基盤 BUY_EVENT ===');
{ const s = mk(['delve', 'wedding']); ok(Array.isArray(s.events) && s.events.length === 2, 'state.events スロットが張られる'); }
{ ok(Array.isArray(DOM.EVENTS_EMPIRES) && DOM.EVENTS_EMPIRES.length === 13, 'DOM.EVENTS_EMPIRES が13種'); }
{ let s = mk(['delve'], 5, 1); me(s).debt = 2; const b = JSON.stringify(s.turn);
  s = reduce(s, { type: 'BUY_EVENT', event: 'delve' });
  ok(JSON.stringify(s.turn) === b && cnt(me(s).discard, 'silver') === 0, '負債>0：イベント購入拒否'); }
{ let s = mk(['delve'], 1, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'delve' });
  ok(s.turn.coins === 1 && s.turn.buys === 1, 'コイン不足：拒否'); }
{ let s = mk(['delve'], 8, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'wedding' });
  ok(s.turn.coins === 8, '非採用イベント：拒否'); }
{ let s = mk(['delve'], 8, 0); s = reduce(s, { type: 'BUY_EVENT', event: 'delve' });
  ok(cnt(me(s).discard, 'silver') === 0, '購入権0：拒否'); }
// イベントはコスト軽減を受けない（橋トークンでも $2 のまま）
{ let s = mk(['delve'], 5, 1); s.turn.costReduction = 5; s = reduce(s, { type: 'BUY_EVENT', event: 'delve' });
  ok(s.turn.coins === 3, 'イベントはコスト軽減を受けない（$5-2=$3）'); }
// 複数回購入（delve→+購入で買い直せる）
{ let s = mk(['delve'], 6, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'delve' }); s = reduce(s, { type: 'BUY_EVENT', event: 'delve' });
  ok(cnt(me(s).discard, 'silver') === 2 && s.turn.coins === 2, 'delve を1ターンに2回購入できる'); }

console.log('=== EV1＝簡単イベント ===');
{ let s = mk(['delve'], 5, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'delve' });
  ok(s.turn.coins === 3 && s.turn.buys === 1 && cnt(me(s).discard, 'silver') === 1, 'delve：+購入1・銀貨1'); }
{ let s = mk(['wedding'], 5, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'wedding' });
  ok(s.turn.coins === 1 && me(s).vpTokens === 1 && cnt(me(s).discard, 'gold') === 1 && me(s).debt === 3, 'wedding：+1VP・金貨・負債3'); }
{ let s = mk(['dominate'], 14, 1); const p0 = s.supply.province; s = reduce(s, { type: 'BUY_EVENT', event: 'dominate' });
  ok(cnt(me(s).discard, 'province') === 1 && s.supply.province === p0 - 1 && me(s).vpTokens === 9, 'dominate：属州+9VP'); }
{ let s = mk(['dominate'], 14, 1); s.supply.province = 0; s = reduce(s, { type: 'BUY_EVENT', event: 'dominate' });
  ok((me(s).vpTokens || 0) === 0, 'dominate：属州が無ければ+VPなし'); }
{ let s = mk(['windfall'], 5, 1); me(s).deck = []; me(s).discard = []; s = reduce(s, { type: 'BUY_EVENT', event: 'windfall' });
  ok(cnt(me(s).discard, 'gold') === 3, 'windfall（山札・捨て札とも空）：金貨3'); }
{ let s = mk(['windfall'], 5, 1); me(s).deck = ['copper']; me(s).discard = []; s = reduce(s, { type: 'BUY_EVENT', event: 'windfall' });
  ok(cnt(me(s).discard, 'gold') === 0, 'windfall（非空）：金貨なし'); }
{ let s = mk(['conquest'], 6, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'conquest' });
  ok(cnt(me(s).discard, 'silver') === 2 && me(s).vpTokens === 2, 'conquest：銀貨2＋今ターン獲得銀貨2でVP2'); }
{ let s = mk(['conquest'], 6, 1); reduce(s, { type: 'BUY_EVENT', event: 'conquest' }); // 事前に別途銀貨獲得済みなら加算
  s.turn.gainedThisTurn = ['silver']; s.turn.coins = 6; s = reduce(s, { type: 'BUY_EVENT', event: 'conquest' });
  ok(me(s).vpTokens === 3, 'conquest：事前の銀貨も数える（1+2=3VP）'); }
{ let s = mk(['triumph'], 0, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'triumph' });
  ok(cnt(me(s).discard, 'estate') === 1 && me(s).vpTokens === 1 && me(s).debt === 5, 'triumph：屋敷＋獲得1枚でVP1・負債5'); }

console.log('=== 新pendingの裁定＋CPU終端保証 ===');
// salt_the_earth
{ let s = mk(['salt_the_earth'], 4, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'salt_the_earth' });
  ok(me(s).vpTokens === 1 && s.pending && s.pending.type === 'salt_the_earth', 'salt：+1VP＋廃棄pending');
  const e0 = s.supply.estate; s = reduce(s, { type: 'SALT_TRASH', card: 'estate' });
  ok(s.supply.estate === e0 - 1 && cnt(s.trash, 'estate') === 1 && !s.pending, 'salt：サプライ屋敷1枚廃棄で解決'); }
{ let s = mk(['salt_the_earth'], 4, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'salt_the_earth' });
  s = cpuResolve(s); ok(!s.pending, 'salt：CPUが終端する'); }
// banquet
{ let s = mk(['banquet'], 3, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'banquet' });
  ok(cnt(me(s).discard, 'copper') === 2 && s.pending && s.pending.type === 'banquet', 'banquet：銅貨2＋獲得pending');
  s = reduce(s, { type: 'BANQUET_GAIN', card: 'silver' });
  ok(cnt(me(s).discard, 'silver') === 1 && !s.pending, 'banquet：銀貨獲得で解決'); }
{ let s = mk(['banquet'], 3, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'banquet' });
  const d0 = s.supply.duchy; s = reduce(s, { type: 'BANQUET_GAIN', card: 'duchy' });
  ok(s.pending && s.supply.duchy === d0, 'banquet：勝利点は拒否（pending維持）'); }
{ let s = mk(['banquet'], 3, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'banquet' });
  s = cpuResolve(s); ok(!s.pending, 'banquet：CPUが終端する'); }
// advance
{ let s = mk(['advance'], 0, 1); me(s).hand = ['village', 'copper'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'advance' });
  ok(s.pending && s.pending.stage === 'trash', 'advance：廃棄pending（手札にアクション有）');
  s = reduce(s, { type: 'ADVANCE_TRASH', card: 'village' });
  ok(cnt(s.trash, 'village') === 1 && s.pending && s.pending.stage === 'gain', 'advance：村を廃棄→獲得pending');
  s = reduce(s, { type: 'ADVANCE_GAIN', card: 'temple' });
  ok(cnt(me(s).discard, 'temple') === 1 && !s.pending, 'advance：$4アクション獲得で解決'); }
{ let s = mk(['advance'], 0, 1); me(s).hand = ['copper']; s = reduce(s, { type: 'BUY_EVENT', event: 'advance' });
  ok(!s.pending, 'advance：手札にアクション無ければpending立たない'); }
{ let s = mk(['advance'], 0, 1); me(s).hand = ['village', 'silver'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'advance' }); s = cpuResolve(s);
  ok(!s.pending, 'advance：CPUが終端する'); }
// ritual
{ let s = mk(['ritual'], 4, 1); me(s).hand = ['gold', 'copper']; s = reduce(s, { type: 'BUY_EVENT', event: 'ritual' });
  ok(cnt(me(s).discard, 'curse') === 1 && s.pending && s.pending.type === 'ritual', 'ritual：呪い獲得＋廃棄pending');
  s = reduce(s, { type: 'RITUAL_TRASH', card: 'gold' });
  ok(cnt(s.trash, 'gold') === 1 && me(s).vpTokens === 6 && !s.pending, 'ritual：金貨廃棄で+6VP'); }
{ let s = mk(['ritual'], 4, 1); me(s).hand = []; s = reduce(s, { type: 'BUY_EVENT', event: 'ritual' });
  ok(cnt(me(s).discard, 'curse') === 1 && !s.pending, 'ritual：手札が空なら廃棄pendingは立たない'); }
{ let s = mk(['ritual'], 4, 1); me(s).hand = ['duchy', 'estate']; s = reduce(s, { type: 'BUY_EVENT', event: 'ritual' });
  s = cpuResolve(s); ok(!s.pending, 'ritual：CPUが終端する'); }
{ let s = mk(['ritual'], 4, 1); s.supply.curse = 0; s = reduce(s, { type: 'BUY_EVENT', event: 'ritual' });
  ok(!s.pending, 'ritual：呪いが枯渇していれば何も起きない'); }

console.log('\n' + (fail === 0 ? '✅ 帝国イベント（EV0+EV1） 全' + pass + '件 PASS' : '❌ 帝国イベント ' + fail + '件 FAIL / ' + pass + '件 PASS'));
if (fail > 0) process.exit(1);
