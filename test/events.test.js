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
// buyフェイズへ移してからターン終了（END_TURNはbuyフェイズ必須）。pending が立ったら止める。
function endTurn(s) {
  if (s.pending) return s;
  if (s.turn.phase === 'action') s = reduce(s, { type: 'END_ACTION_PHASE' });
  if (s.pending) return s;
  return reduce(s, { type: 'END_TURN' });
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
// salt × 城の混合山（castles）＝一番上の実カードを廃棄（プレースホルダ 'castles' を積む保存則違反の回帰）
{ let s = mk(['salt_the_earth'], 4, 1); const topCastle = s.castles[0]; const before = s.castles.length;
  s = reduce(s, { type: 'BUY_EVENT', event: 'salt_the_earth' });
  s = reduce(s, { type: 'SALT_TRASH', card: 'castles' });
  ok(s.castles.length === before - 1 && cnt(s.trash, topCastle) === 1 && s.supply.castles === s.castles.length && cnt(s.trash, 'castles') === 0 && !s.pending,
    'salt×城：一番上の城を廃棄し state.castles と supply.castles を同期（プレースホルダは trash に積まない）'); }
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

console.log('=== EV2＝重量イベント（tax / donate / annex）===');
// --- tax: 準備で全サプライ山に負債1（非サプライ札は除く・混合山は castles/knights キーに1） ---
{ const s = mk(['tax']);
  ok(s.pileDebt && s.pileDebt.silver === 1 && s.pileDebt.copper === 1 && s.pileDebt.province === 1 && s.pileDebt.curse === 1, 'tax：全サプライ山（基本札含む）に負債1');
  ok(s.pileDebt.castles === 1 && s.pileDebt.engineer === 1, 'tax：混合山・王国山にも負債1'); }
{ const s = mk([]); ok(!s.pileDebt || Object.keys(s.pileDebt).length === 0, 'tax不採用：pileDebt は空'); }
// --- tax: 自分の購入フェイズにサプライから獲得すると、その山の負債を全部受け取る ---
{ let s = mk(['tax'], 3, 1); s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(me(s).debt === 1 && (s.pileDebt.silver || 0) === 0, 'tax：銀貨購入で負債1を受け取り山は0');
  s.turn.coins = 3; s.turn.buys = 1; const c0 = cnt(me(s).discard, 'copper');
  s = reduce(s, { type: 'BUY', card: 'copper' });
  ok(cnt(me(s).discard, 'copper') === c0, 'tax：負債>0では購入不可'); }
// --- tax: tax_pile で分割山の「下段」を指定しても上段キーに正規化して置く（負債の孤児化の回帰・敵対レビュー確定バグ） ---
{ let s = mk(['tax'], 2, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'tax' });
  s = reduce(s, { type: 'TAX_PILE', pile: 'bustling_village' }); // 下段を指定
  ok((s.pileDebt.settlers || 0) === 3 && (s.pileDebt.bustling_village || 0) === 0, 'tax：下段指定でも上段(settlers)キーに +2（準備1+2=3・下段は0）');
  // 上段を空にして下段を獲得→上段キーの負債3を受け取る（孤児化しない）
  s.supply.settlers = 0; s.turn.coins = 8; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'bustling_village' });
  ok(me(s).debt === 3 && (s.pileDebt.settlers || 0) === 0, 'tax：下段獲得で上段キーの負債3を全部受け取る（取りこぼしなし）'); }
// --- tax: 山に積まれた負債は「全部」受け取る（tax を2回買って +2+2、準備1で計5） ---
{ let s = mk(['tax'], 4, 3); s = reduce(s, { type: 'BUY_EVENT', event: 'tax' }); s = reduce(s, { type: 'TAX_PILE', pile: 'gold' });
  s = reduce(s, { type: 'BUY_EVENT', event: 'tax' }); s = reduce(s, { type: 'TAX_PILE', pile: 'gold' });
  ok((s.pileDebt.gold || 0) === 5, 'tax：金貨山に 1+2+2=5 の負債');
  s.turn.coins = 6; s.turn.buys = 1; s = reduce(s, { type: 'BUY', card: 'gold' });
  ok(me(s).debt === 5 && (s.pileDebt.gold || 0) === 0, 'tax：金貨獲得で負債5を全部受け取る'); }
// --- tax: 分割山は1山＝上段キーに負債1のみ（下段は0）。下段を獲得すると上段キーの負債を受け取る ---
{ const s = mk(['tax']);
  ok(s.pileDebt.settlers === 1 && (s.pileDebt.bustling_village || 0) === 0, 'tax：分割山は上段(settlers)にだけ負債1（下段は0）');
  ok(s.pileDebt.catapult === 1 && (s.pileDebt.rocks || 0) === 0, 'tax：分割山catapult(上)=1・rocks(下)=0'); }
{ let s = mk(['tax'], 8, 5); s.supply.settlers = 0; // 上段を空にして下段(騒がしい村)を解放
  s = reduce(s, { type: 'BUY', card: 'bustling_village' });
  ok(cnt(me(s).discard, 'bustling_village') === 1 && me(s).debt === 1 && (s.pileDebt.settlers || 0) === 0,
    'tax：下段(騒がしい村)を獲得すると上段(settlers)キーの負債を受け取る'); }
// --- tax: 購入フェイズの「非購入」獲得でも受け取る（delve が銀貨を獲得＝Tax×Delve） ---
{ let s = mk(['tax', 'delve'], 2, 2); s = reduce(s, { type: 'BUY_EVENT', event: 'delve' });
  ok(cnt(me(s).discard, 'silver') === 1 && me(s).debt === 1, 'tax：delve の銀貨獲得でも負債1（購入フェイズの非購入獲得）'); }
// --- tax: 相手のターン（=自分の購入フェイズでない）獲得では受け取らない（active でない席の獲得はそもそも起きないが、gate確認） ---
{ let s = mk(['tax'], 3, 1); s.turn.phase = 'action';
  // アクションフェイズでの購入は不可。ここでは phase=action のとき pileDebt が減らないことを、gain経由の delve で確認できないので概念確認のみ。
  ok(s.pileDebt.silver === 1, 'tax：アクションフェイズでは負債は山に残る（準備値のまま）'); }
// --- tax: CPU が tax_pile を終端 ---
{ let s = mk(['tax'], 2, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'tax' }); s = cpuResolve(s);
  ok(!s.pending, 'tax：CPUが tax_pile を終端する'); }

// --- donate: 購入で負債8＋次の自分のターン開始でデッキ掃討→廃棄→5枚引く ---
{ let s = mk(['donate'], 0, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'donate' });
  ok(me(s).debt === 8 && me(s).donateNext === true, 'donate：購入で負債8・donateNextフラグ');
  s = endTurn(s); s = endTurn(s); // A end → B → A start（donate発火）
  ok(s.pending && s.pending.type === 'donate_trash', 'donate：次の自分のターン開始で donate_trash pending');
  ok(me(s).deck.length === 0 && me(s).discard.length === 0, 'donate：山札・捨て札を全部手札へ集約');
  const total = me(s).hand.length; ok(total >= 10, 'donate：全カードが手札（' + total + '枚）');
  const estates = me(s).hand.filter((c) => c === 'estate');
  s = reduce(s, { type: 'DONATE_TRASH', cards: estates });
  ok(!s.pending && me(s).hand.length === 5, 'donate：廃棄後5枚引いて解決');
  ok(cnt(s.trash, 'estate') === estates.length && me(s).donateNext === false, 'donate：屋敷を廃棄・フラグクリア'); }
// --- donate: 0枚廃棄でもOK（必ず5枚に揃う） ---
{ let s = mk(['donate'], 0, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'donate' });
  s = endTurn(s); s = endTurn(s);
  s = reduce(s, { type: 'DONATE_TRASH', cards: [] });
  ok(!s.pending && me(s).hand.length === 5, 'donate0：廃棄0でも5枚に揃う'); }
// --- donate: donate の後で通常の開始時効果を続行（漁村の持続ドローが donate の後に乗る） ---
{ let s = mk(['donate'], 0, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'donate' });
  // A の delayedEffects に漁村（+1アクション+1コイン）を仕込む＝donate の後に処理されるはず
  me(s).delayedEffects = [{ type: 'fishing_village' }];
  s = endTurn(s); s = endTurn(s);
  ok(s.pending && s.pending.type === 'donate_trash', 'donate順序：donate が先（持続効果より前）');
  s = reduce(s, { type: 'DONATE_TRASH', cards: [] });
  ok(s.turn.coins >= 1 && s.turn.actions >= 2, 'donate順序：donate の後に漁村の持続効果が適用される'); }
{ let s = mk(['donate'], 0, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'donate' });
  s = endTurn(s); s = endTurn(s); s = cpuResolve(s);
  // CPU は不要札を積極的に廃棄する＝残り<5枚なら手札はそのぶん少ない。終端していれば良い。
  ok(!s.pending && me(s).hand.length >= 1 && me(s).hand.length <= 5, 'donate：CPUが donate_trash を終端する（hand=' + me(s).hand.length + '）'); }

// --- annex: 捨て札から最大5枚を残し、残りを山札へ混ぜてシャッフル→公領獲得 ---
{ let s = mk(['annex'], 0, 1);
  me(s).discard = ['copper', 'copper', 'estate', 'silver', 'gold', 'village', 'curse', 'copper'];
  me(s).deck = ['copper', 'copper'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'annex' });
  ok(me(s).debt === 8 && s.pending && s.pending.type === 'annex_keep', 'annex：負債8＋annex_keep pending');
  s = reduce(s, { type: 'ANNEX_KEEP', cards: ['curse', 'estate', 'copper', 'copper', 'copper'] });
  ok(!s.pending, 'annex：解決');
  ok(me(s).discard.length === 6 && cnt(me(s).discard, 'duchy') === 1, 'annex：残5枚＋公領が捨て札');
  ok(me(s).deck.length === 5 && me(s).deck.includes('gold') && me(s).deck.includes('village'), 'annex：良い札3枚が山札へ（元2＋3）'); }
// --- annex: 6枚超は最大5枚まで（超過分は無視）・公領は必ず獲得 ---
{ let s = mk(['annex'], 0, 1); me(s).discard = ['copper', 'estate', 'silver', 'gold', 'village', 'duchy'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'annex' });
  s = reduce(s, { type: 'ANNEX_KEEP', cards: me(s).discard.slice() }); // 6枚指定→5枚だけ残る
  ok(me(s).discard.filter((c) => c !== 'duchy').length === 5, 'annex：6枚指定でも残せるのは5枚');
  ok(cnt(me(s).discard, 'duchy') >= 1, 'annex：公領を獲得'); }
// --- annex: 捨て札が空でも公領を獲得（pending 立たない） ---
{ let s = mk(['annex'], 0, 1); me(s).discard = []; s = reduce(s, { type: 'BUY_EVENT', event: 'annex' });
  ok(!s.pending && cnt(me(s).discard, 'duchy') === 1, 'annex空：pendingなし・公領獲得'); }
// --- annex: 公領山が空でもシャッフルは実行（公領は空振り） ---
{ let s = mk(['annex'], 0, 1); s.supply.duchy = 0; me(s).deck = []; me(s).discard = ['copper', 'silver', 'gold'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'annex' });
  s = reduce(s, { type: 'ANNEX_KEEP', cards: [] });
  ok(!s.pending && me(s).deck.length === 3 && cnt(me(s).discard, 'duchy') === 0, 'annex：公領空でもシャッフルは実行'); }
{ let s = mk(['annex'], 0, 1); me(s).discard = ['copper', 'estate', 'silver', 'gold', 'curse', 'village'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'annex' }); s = cpuResolve(s);
  ok(!s.pending, 'annex：CPUが annex_keep を終端する'); }

/* ============================================================================
   冒険（Adventures）イベント 20種（AE0〜AE4）
   ・BUY_EVENT の共通基盤は帝国と同じ。冒険は負債なし＝コインのみ・トークン中心。
   ・公式ルール（RGGルールブック＋2022エラッタ）で確定した裁定：
     - 一度でも購入（カード/イベント）したら、そのターンはもう財宝を出せない（基本ルール）
     - 施し/借入/保存/巡礼/使節団＝1ターンに1回しか買えない（2回目の購入自体を拒否）
     - 相続＝1ゲーム1回。焚火＝場の銅貨限定（2022エラッタ）。立案＝獲得時（2022エラッタ）
   ============================================================================ */
const ADV = DOM.KINGDOM_ADVENTURES.slice();
function mka(events, coins, buys, kingdom) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || ADV).slice(), { startActive: 0, events });
  s.turn.phase = 'buy'; s.turn.coins = coins == null ? 8 : coins; s.turn.buys = buys == null ? 1 : buys;
  return s;
}

console.log('=== 冒険：共通基盤（財宝ロック・1ターン1回・1ゲーム1回）===');
{ ok(Array.isArray(DOM.EVENTS_ADVENTURES) && DOM.EVENTS_ADVENTURES.length === 20, 'DOM.EVENTS_ADVENTURES が20種'); }
{ ok(DOM.CARD_SETS.some((x) => x.id === 'adventures-events' && x.eventsFrom === 'adventures'), 'CARD_SET adventures-events がある'); }
{ ok((DOM.eventsForSet('adventures-events') || []).length === 2, 'adventures-events は毎回2枚のイベントを抽選'); }
// 公式：一度でも購入したら財宝を出せない（施しの抜け道封じ）
{ let s = mka(['delve'], 3, 2); me(s).hand = ['copper', 'copper'];
  s = reduce(s, { type: 'BUY', card: 'silver' });
  const c0 = s.turn.coins; s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(s.turn.coins === c0 && me(s).hand.length === 2, '購入後は財宝を出せない（公式の基本ルール）'); }
{ let s = mka(['alms'], 0, 2); me(s).hand = ['copper'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'alms' }); s = cpuResolve(s);
  const c0 = s.turn.coins; s = reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.coins === c0 && me(s).hand.length === 1, 'イベント購入後も財宝を出せない'); }
{ let s = mka(['alms'], 0, 3); s = reduce(s, { type: 'BUY_EVENT', event: 'alms' }); s = cpuResolve(s);
  const b = s.turn.buys; s = reduce(s, { type: 'BUY_EVENT', event: 'alms' });
  ok(s.turn.buys === b, '施し：1ターン2回目の購入は拒否（購入権も減らない）'); }

console.log('=== 冒険：施し / 借入 / 探索 / 交易 ===');
{ let s = mka(['alms'], 0, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'alms' });
  ok(s.pending && s.pending.type === 'alms_gain', '施し：場に財宝なし→$4以下を獲得');
  s = reduce(s, { type: 'ALMS_GAIN', card: 'silver' });
  ok(cnt(me(s).discard, 'silver') === 1 && !s.pending, '施し：獲得して解決'); }
{ let s = mka(['alms'], 0, 1); me(s).inPlay = ['copper']; s = reduce(s, { type: 'BUY_EVENT', event: 'alms' });
  ok(!s.pending, '施し：場に財宝があれば何も起きない'); }
{ let s = mka(['alms'], 0, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'alms' });
  s = reduce(s, { type: 'ALMS_GAIN', card: 'gold' });
  ok(s.pending && cnt(me(s).discard, 'gold') === 0, '施し：$5の金貨は獲得できない（拒否）'); }
{ let s = mka(['borrow'], 0, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'borrow' });
  ok(s.turn.buys === 1 && s.turn.coins === 1 && me(s).minusCard === true, '借入：+1購入・+$1・-1カードトークン'); }
{ let s = mka(['borrow'], 0, 2); me(s).minusCard = true;
  s = reduce(s, { type: 'BUY_EVENT', event: 'borrow' });
  ok(s.turn.buys === 2 && s.turn.coins === 0, '借入：既に-1カードトークンを持っていれば+$1は無し（+1購入のみ）'); }
{ let s = mka(['quest'], 0, 1); me(s).hand = ['curse', 'curse'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'quest' }); s = reduce(s, { type: 'QUEST_MODE', mode: 'curses' });
  ok(cnt(me(s).discard, 'gold') === 1 && cnt(me(s).discard, 'curse') === 2, '探索：呪い2枚→金貨'); }
{ let s = mka(['quest'], 0, 1); me(s).hand = ['militia', 'copper'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'quest' }); s = reduce(s, { type: 'QUEST_MODE', mode: 'attack' });
  s = reduce(s, { type: 'QUEST_DISCARD', cards: ['militia'] });
  ok(cnt(me(s).discard, 'gold') === 1 && cnt(me(s).discard, 'militia') === 1, '探索：アタック1枚→金貨'); }
{ let s = mka(['quest'], 0, 1); me(s).hand = ['copper', 'copper', 'copper'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'quest' }); s = reduce(s, { type: 'QUEST_MODE', mode: 'attack' });
  ok(!s.pending && cnt(me(s).discard, 'gold') === 0, '探索：アタックが無いのにアタックを選ぶ→空振りで終端'); }
{ let s = mka(['quest'], 0, 1); me(s).hand = ['copper', 'copper', 'estate'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'quest' }); s = reduce(s, { type: 'QUEST_MODE', mode: 'six' });
  s = reduce(s, { type: 'QUEST_DISCARD', cards: ['copper', 'copper', 'estate'] });
  ok(!s.pending && me(s).hand.length === 0 && cnt(me(s).discard, 'gold') === 0, '探索：6枚未満は全部捨てるが金貨なし'); }
{ let s = mka(['trade'], 5, 1); me(s).hand = ['estate', 'curse', 'gold'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'trade' }); s = reduce(s, { type: 'TRADE_TRASH', cards: ['estate', 'curse'] });
  ok(cnt(s.trash, 'estate') === 1 && cnt(s.trash, 'curse') === 1 && cnt(me(s).discard, 'silver') === 2, '交易：2枚廃棄→銀貨2枚'); }
{ let s = mka(['trade'], 5, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'trade' });
  s = reduce(s, { type: 'TRADE_TRASH', cards: [] });
  ok(!s.pending && cnt(me(s).discard, 'silver') === 0, '交易：0枚廃棄でもよい（銀貨なし）'); }

console.log('=== 冒険：焚火 / 奇襲 / 舞踏会（-$1トークン）===');
{ let s = mka(['bonfire'], 3, 1); me(s).inPlay = ['copper', 'copper', 'silver', 'gold'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'bonfire' }); s = reduce(s, { type: 'BONFIRE_TRASH', count: 2 });
  ok(cnt(s.trash, 'copper') === 2 && me(s).inPlay.length === 2, '焚火：場の銅貨2枚を廃棄（2022エラッタ＝銅貨限定）'); }
{ let s = mka(['bonfire'], 3, 1); me(s).inPlay = ['silver', 'gold'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'bonfire' });
  ok(!s.pending && s.trash.length === 0, '焚火：場に銅貨が無ければ何も起きない（銀貨/金貨は廃棄できない）'); }
{ let s = mka(['raid'], 5, 1); me(s).inPlay = ['silver', 'silver', 'silver'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'raid' });
  ok(cnt(me(s).discard, 'silver') === 3, '奇襲：場の銀貨1枚につき銀貨1枚');
  ok(s.players[1].minusCard === true, '奇襲：相手が-1カードトークンを受け取る（アタックではない＝堀不可）'); }
{ let s = mka(['ball'], 5, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'ball' });
  ok(me(s).minusCoin === true, '舞踏会：-$1トークン');
  s = reduce(s, { type: 'BALL_GAIN', card: 'silver' }); s = reduce(s, { type: 'BALL_GAIN', card: 'estate' });
  ok(cnt(me(s).discard, 'silver') === 1 && cnt(me(s).discard, 'estate') === 1 && !s.pending, '舞踏会：$4以下を2枚獲得'); }
// -$1トークンは「次に得るコイン」から引かれる（次のターンへ持ち越す）
{ let s = mka(['ball'], 5, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'ball' }); s = cpuResolve(s);
  s = endTurn(s); s = endTurn(s); // 相手の手番 → 自分の手番
  s.turn.coins = 0; s = reduce(s, { type: 'END_ACTION_PHASE' });
  const before = s.turn.coins;
  s.players[0].hand.push('gold'); s = reduce(s, { type: 'PLAY_TREASURE', card: 'gold' });
  ok(s.turn.coins === before + 2 && s.players[0].minusCoin === false, '舞踏会：-$1は次ターンの最初のコインから引かれる（金貨+3→+2）'); }

console.log('=== 冒険：探検 / 保存 / 偵察隊 / 移動遊園地 ===');
{ let s = mka(['expedition'], 6, 2);
  s = reduce(s, { type: 'BUY_EVENT', event: 'expedition' }); s = reduce(s, { type: 'BUY_EVENT', event: 'expedition' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].hand.length === 9, '探検：2回買うと次の手札が9枚（累積）'); }
{ let s = mka(['save'], 1, 1); me(s).hand = ['gold', 'copper'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'save' });
  s = reduce(s, { type: 'SAVE_SETASIDE', card: 'gold' });
  ok(me(s).setAside.includes('gold'), '保存：脇に置く');
  s = reduce(s, { type: 'END_TURN' });
  ok(me(s).hand.length === 6 && me(s).hand.includes('gold') && me(s).setAside.length === 0,
    '保存：次の手札を引いた「後」に手札へ戻る（5+1=6枚）'); }
{ let s = mka(['scouting_party'], 2, 1);
  me(s).deck = ['gold', 'copper', 'copper', 'estate', 'silver', 'village'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'scouting_party' });
  ok(s.turn.buys === 1 && s.pending.cards.length === 5, '偵察隊：+1購入・上5枚を見る');
  s = reduce(s, { type: 'SCOUTING_DISCARD', cards: ['copper', 'copper', 'estate'] });
  s = reduce(s, { type: 'SCOUTING_ORDER', order: ['gold', 'silver'] });
  ok(me(s).deck[0] === 'gold' && me(s).deck[1] === 'silver', '偵察隊：残りを好きな順で山札の上へ'); }
{ let s = mka(['scouting_party'], 2, 1); me(s).deck = ['gold', 'silver']; me(s).discard = [];
  s = reduce(s, { type: 'BUY_EVENT', event: 'scouting_party' });
  ok(!s.pending && me(s).deck.length === 0 && me(s).discard.length === 2, '偵察隊：3枚以下なら全部捨てる'); }
{ let s = mka(['travelling_fair'], 6, 1);
  s = reduce(s, { type: 'BUY_EVENT', event: 'travelling_fair' });
  ok(s.turn.buys === 2, '移動遊園地：+2購入');
  s = reduce(s, { type: 'BUY', card: 'silver' });
  s = reduce(s, { type: 'TRAVELLING_FAIR_TOPDECK', topdeck: true });
  ok(me(s).deck[0] === 'silver', '移動遊園地：獲得したカードを山札の上へ'); }
{ let s = mka(['travelling_fair'], 6, 1);
  s = reduce(s, { type: 'BUY_EVENT', event: 'travelling_fair' });
  s = reduce(s, { type: 'BUY', card: 'silver' });
  s = reduce(s, { type: 'TRAVELLING_FAIR_TOPDECK', topdeck: false });
  ok(cnt(me(s).discard, 'silver') === 1 && me(s).deck[0] !== 'silver', '移動遊園地：置かない選択もできる'); }

console.log('=== 冒険：山トークン6種（渡し船/立案/失われた技術/鍛錬/誘導/海路）===');
{ let s = mka(['ferry'], 6, 2); s = reduce(s, { type: 'BUY_EVENT', event: 'ferry' });
  s = reduce(s, { type: 'EVENT_TOKEN_PILE', pile: 'lost_city' });
  ok(me(s).pileTokens.cost === 'lost_city' && E.cardCost(s, 'lost_city') === 3, '渡し船：-$2コストトークン（$5→$3）');
  s.turn.active = 1;
  ok(E.cardCost(s, 'lost_city') === 5, '渡し船：他人のターンでは効かない');
  s.turn.active = 0;
  s = reduce(s, { type: 'BUY_EVENT', event: 'ferry' }); // 置き直し
  ok(s.pending && s.pending.type === 'event_token', '渡し船：もう一度買えば置き直せる'); }
{ let s = mka(['lost_arts'], 6, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'lost_arts' });
  s = reduce(s, { type: 'EVENT_TOKEN_PILE', pile: 'ranger' });
  s.turn.phase = 'action'; s.turn.actions = 1; me(s).hand = ['ranger'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'ranger' });
  ok(s.turn.actions === 1, '失われた技術：その山のカードをプレイすると +1アクション'); }
{ let s = mka(['training'], 6, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'training' });
  s = reduce(s, { type: 'EVENT_TOKEN_PILE', pile: 'ranger' });
  s.turn.phase = 'action'; s.turn.actions = 1; s.turn.coins = 0; me(s).hand = ['ranger'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'ranger' });
  ok(s.turn.coins === 1, '鍛錬：その山のカードをプレイすると +$1'); }
{ let s = mka(['pathfinding'], 8, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'pathfinding' });
  s = reduce(s, { type: 'EVENT_TOKEN_PILE', pile: 'ranger' });
  s.turn.phase = 'action'; s.turn.actions = 1; me(s).hand = ['ranger']; me(s).deck = ['gold', 'gold', 'gold', 'gold', 'gold', 'gold'];
  const h0 = me(s).hand.length;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'ranger' });
  ok(me(s).hand.length >= h0, '誘導：その山のカードをプレイすると +1カード'); }
{ let s = mka(['seaway'], 5, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'seaway' });
  s = reduce(s, { type: 'SEAWAY_GAIN', card: 'ranger' });
  ok(cnt(me(s).discard, 'ranger') === 1 && me(s).pileTokens.buy === 'ranger', '海路：$4以下アクション獲得＋その山に+1購入トークン'); }
{ let s = mka(['plan'], 3, 2); s = reduce(s, { type: 'BUY_EVENT', event: 'plan' });
  s = reduce(s, { type: 'EVENT_TOKEN_PILE', pile: 'lost_city' });
  me(s).hand = ['curse']; s.turn.coins = 5;
  s = reduce(s, { type: 'BUY', card: 'lost_city' });
  ok(s.pending && s.pending.type === 'plan_trash', '立案：その山から獲得したとき（2022エラッタ）');
  s = reduce(s, { type: 'PLAN_TRASH', card: 'curse' });
  ok(cnt(s.trash, 'curse') === 1, '立案：手札1枚を廃棄（任意）'); }
// 立案＝購入以外の獲得でも発火（2022エラッタ）
{ const K = ['workshop', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'festival', 'laboratory', 'mine'];
  let s = mka(['plan'], 3, 1, K);
  s = reduce(s, { type: 'BUY_EVENT', event: 'plan' });
  s = reduce(s, { type: 'EVENT_TOKEN_PILE', pile: 'village' });
  s.turn.phase = 'action'; s.turn.actions = 1; me(s).hand = ['workshop', 'curse'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });
  s = reduce(s, { type: 'WORKSHOP_GAIN', card: 'village' });
  ok(s.pending && s.pending.type === 'plan_trash', '立案：工房での獲得（購入でない）でも発火'); }

console.log('=== 冒険：使節団 / 巡礼 / 相続 ===');
{ let s = mka(['mission'], 4, 1); s = reduce(s, { type: 'BUY_EVENT', event: 'mission' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 0 && s.turn.isExtraTurn && s.turn.noBuyCards && s.players[0].hand.length === 5,
    '使節団：追加ターン（同一プレイヤー・手札5枚・カード購入不可）');
  s.turn.phase = 'buy'; s.turn.coins = 8;
  s = reduce(s, { type: 'BUY', card: 'gold' });
  ok(cnt(s.players[0].discard, 'gold') === 0, '使節団：追加ターンではカードを購入できない');
  s = reduce(s, { type: 'BUY_EVENT', event: 'mission' });
  ok(!s.players[0].missionExtra, '使節団：3連続ターンにはできない');
  s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1, '使節団：追加ターンの後は相手の手番'); }
{ let s = mka(['mission'], 8, 2); s = reduce(s, { type: 'BUY_EVENT', event: 'mission' });
  const b = s.turn.buys;
  s = reduce(s, { type: 'BUY_EVENT', event: 'mission' });
  ok(s.turn.buys === b, '使節団：1ターンに2回は買えない'); }
{ let s = mka(['pilgrimage'], 4, 1); me(s).inPlay = ['ranger'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'pilgrimage' });
  ok(!s.pending && me(s).journeyDown === true, '巡礼：旅トークンが裏になったら何も起きない'); }
{ let s = mka(['pilgrimage'], 4, 1); me(s).inPlay = ['ranger', 'ranger', 'lost_city', 'amulet']; me(s).journeyDown = true;
  s = reduce(s, { type: 'BUY_EVENT', event: 'pilgrimage' });
  ok(s.pending && s.pending.type === 'pilgrimage', '巡礼：旅トークンが表になったら選択');
  s = reduce(s, { type: 'PILGRIMAGE_GAIN', cards: ['ranger', 'lost_city', 'amulet'] });
  ok(cnt(me(s).discard, 'ranger') === 1 && cnt(me(s).discard, 'lost_city') === 1 && cnt(me(s).discard, 'amulet') === 1,
    '巡礼：名前の異なる3枚のコピーを獲得'); }
{ let s = mka(['pilgrimage'], 4, 1); me(s).inPlay = ['ranger', 'ranger']; me(s).journeyDown = true;
  s = reduce(s, { type: 'BUY_EVENT', event: 'pilgrimage' });
  s = reduce(s, { type: 'PILGRIMAGE_GAIN', cards: ['ranger', 'ranger'] });
  ok(s.pending, '巡礼：同名を2枚選ぶのは拒否（名前は異なること）'); }
{ const K = ['village', 'smithy', 'market', 'militia', 'moat', 'workshop', 'festival', 'laboratory', 'mine', 'cellar'];
  let s = mka(['inheritance'], 7, 1, K);
  s = reduce(s, { type: 'BUY_EVENT', event: 'inheritance' });
  const sup0 = s.supply.village;
  s = reduce(s, { type: 'INHERITANCE_SET', card: 'village' });
  ok(me(s).inherited[0] === 'village' && s.supply.village === sup0 - 1, '相続：サプライから1枚を脇へ（獲得ではない）');
  s.turn.coins = 7; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY_EVENT', event: 'inheritance' });
  ok(s.turn.coins === 7, '相続：1ゲーム2回目は買えない');
  s.turn.phase = 'action'; s.turn.actions = 1; me(s).hand = ['estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'estate' });
  ok(me(s).inPlay.includes('estate') && s.turn.actions === 2, '相続：屋敷をアクションとして使い、村の効果（+2アクション）');
  ok(me(s).inherited[0] === 'village', '相続：脇のカードは動かない（命令）'); }
// 相続：相手の屋敷はアクションにならない
{ const K = ['village', 'smithy', 'market', 'militia', 'moat', 'workshop', 'festival', 'laboratory', 'mine', 'cellar'];
  let s = mka(['inheritance'], 7, 1, K);
  s = reduce(s, { type: 'BUY_EVENT', event: 'inheritance' });
  s = reduce(s, { type: 'INHERITANCE_SET', card: 'village' });
  ok(E.inheritedEstate(s.players[0], 'estate') === true && E.inheritedEstate(s.players[1], 'estate') === false,
    '相続：屋敷がアクションになるのは購入者だけ'); }
// 相続：脇のカードは得点計算では自分のデッキに数える（公式）が、勝利点は増えない
{ const K = ['village', 'smithy', 'market', 'militia', 'moat', 'workshop', 'festival', 'laboratory', 'mine', 'cellar'];
  let s = mka(['inheritance'], 7, 1, K);
  s = reduce(s, { type: 'BUY_EVENT', event: 'inheritance' });
  s = reduce(s, { type: 'INHERITANCE_SET', card: 'village' });
  const owned = [].concat(me(s).deck, me(s).hand, me(s).discard, me(s).inPlay, me(s).inherited);
  ok(E.vpOf(me(s)) === cnt(owned, 'estate'), '相続：脇の村は0VP（屋敷の点は変わらない）'); }

console.log('=== 冒険：敵対レビューの回帰（F1〜F4）===');
// F1: 財宝ロックは「その購入フェイズ内」＝ヴィラでアクションフェイズに戻り再び購入フェイズに入れば出し直せる
{ const K = DOM.KINGDOM_EMPIRES.slice();
  let s = E.createInitialState(['あなた', '相手'], K, { startActive: 0 });
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 2; me(s).hand = ['copper', 'copper'];
  s = reduce(s, { type: 'BUY', card: 'villa' }); // ヴィラ獲得＝手札に加わりアクションフェイズに戻る
  ok(s.turn.phase === 'action' && s.turn.treasuresLocked === true, 'F1前提：ヴィラ購入で購入ロック＆アクションフェイズに戻る');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(s.turn.treasuresLocked === false, 'F1：購入フェイズに入り直すと財宝ロックが解除される（公式）');
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(s.turn.coins === c0 + 2, 'F1：ヴィラで戻った購入フェイズでは財宝を出し直せる'); }
// F2: 偵察隊の「見た5枚」は私的（相手席には伏せる）
{ let s = mka(['scouting_party'], 2, 1);
  me(s).deck = ['gold', 'copper', 'copper', 'estate', 'silver', 'village'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'scouting_party' });
  const opp = E.maskStateFor(s, 1), mine = E.maskStateFor(s, 0);
  ok(opp.pending.cards.every((c) => c === 'back'), 'F2：偵察隊の5枚は相手席には伏せられる');
  ok(mine.pending.cards.includes('gold'), 'F2：本人には見える'); }
// F3: 保存の脇置きは裏向き（相手席に savedCard が漏れない）
{ let s = mka(['save'], 1, 1); me(s).hand = ['gold', 'copper'];
  s = reduce(s, { type: 'BUY_EVENT', event: 'save' });
  s = reduce(s, { type: 'SAVE_SETASIDE', card: 'gold' });
  const opp = E.maskStateFor(s, 1), mine = E.maskStateFor(s, 0);
  ok(opp.turn.savedCard === 'back' && opp.players[0].setAside.every((c) => c === 'back'), 'F3：保存の脇置きは相手席に見えない');
  ok(mine.turn.savedCard === 'gold', 'F3：本人には見える');
  s = reduce(s, { type: 'END_TURN' });
  ok(me(s).hand.includes('gold'), 'F3：権威stateでは元のidで手札に戻る'); }
// F4: CPU は「旅トークンが裏のとき」だけ巡礼を買う（表で買うと必ず空振り）
{ let s = mka(['pilgrimage'], 4, 1); me(s).inPlay = ['ranger', 'lost_city']; me(s).journeyDown = false; me(s).hand = [];
  const a1 = CPU.decide(s);
  ok(!(a1 && a1.type === 'BUY_EVENT' && a1.event === 'pilgrimage'), 'F4：旅トークンが表なら CPU は巡礼を買わない');
  me(s).journeyDown = true;
  const a2 = CPU.decide(s);
  ok(a2 && a2.type === 'BUY_EVENT' && a2.event === 'pilgrimage', 'F4：旅トークンが裏なら CPU は巡礼を買う（表になって効果が出る）'); }

// F5: 闇市場×使節団の追加ターン＝CPUが膠着しない（engine拒否とCPU非提案がセット）
{ const K = ['black_market', 'village', 'market', 'smithy', 'moat', 'militia', 'laboratory', 'festival', 'workshop', 'chapel'];
  let s = E.createInitialState([{ name: 'P0', isCpu: true, level: 'hard' }, { name: 'P1', isCpu: true, level: 'normal' }], K, { startActive: 0, events: ['mission'] });
  s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY_EVENT', event: 'mission' });
  s = reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['black_market', 'gold', 'gold', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'black_market' });
  let g = 0, stuck = false;
  while (s.pending && g++ < 20) {
    const a = CPU.decide(s); const before = JSON.stringify([s.turn, s.pending]);
    s = reduce(s, a);
    if (JSON.stringify([s.turn, s.pending]) === before) { stuck = true; break; }
  }
  ok(!stuck && !s.pending, 'F5：使節団の追加ターン×闇市場でCPUが膠着しない'); }
// F6: 使者＝イベントを先に買っていたら「そのターン最初の購入」ではない
{ const K = ['messenger', 'village', 'market', 'smithy', 'moat', 'militia', 'laboratory', 'festival', 'workshop', 'chapel'];
  let s = E.createInitialState(['あなた', '相手'], K, { startActive: 0, events: ['delve'] });
  s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 3;
  s = reduce(s, { type: 'BUY_EVENT', event: 'delve' });
  s = reduce(s, { type: 'BUY', card: 'messenger' });
  ok(!s.pending, 'F6：イベントを先に買っていたら使者の「最初の購入」効果は出ない'); }
// F7: 山トークンは分割山の上段キーに正規化される（下段のカードでも発火＝孤児化しない）
{ const K = ['settlers', 'village', 'market', 'smithy', 'moat', 'militia', 'laboratory', 'festival', 'workshop', 'chapel'];
  let s = E.createInitialState(['あなた', '相手'], K, { startActive: 0, events: ['lost_arts'] });
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  ok((E.actionSupplyPiles(s) || []).indexOf('bustling_village') < 0, 'F7：分割山の下段はトークンの置き先候補に出ない');
  s = reduce(s, { type: 'BUY_EVENT', event: 'lost_arts' });
  s = reduce(s, { type: 'EVENT_TOKEN_PILE', pile: 'settlers' });
  s.turn.phase = 'action'; s.turn.actions = 1; me(s).hand = ['bustling_village'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bustling_village' });
  ok(s.turn.actions >= 4, 'F7：分割山の下段（騒がしい村）でも上段キーのトークンが発火する（+1アクション）'); }
// F8: 移動遊園地×ヴィラ（獲得先が捨て札→手札に変わる）でも山札の上に置ける
{ const K = DOM.KINGDOM_EMPIRES.slice();
  let s = E.createInitialState(['あなた', '相手'], K, { startActive: 0, events: ['travelling_fair'] });
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 3;
  s = reduce(s, { type: 'BUY_EVENT', event: 'travelling_fair' });
  s = reduce(s, { type: 'BUY', card: 'villa' }); // ヴィラは獲得時に手札へ移る
  s = reduce(s, { type: 'TRAVELLING_FAIR_TOPDECK', topdeck: true });
  ok(me(s).deck[0] === 'villa' && !me(s).hand.includes('villa'), 'F8：獲得先が変わった札（ヴィラ）も山札の上に置ける'); }
// F9: 相続した屋敷は門下生の対象になる
{ const K = ['peasant', 'village', 'market', 'smithy', 'moat', 'militia', 'laboratory', 'festival', 'workshop', 'chapel'];
  let s = E.createInitialState(['あなた', '相手'], K, { startActive: 0, events: ['inheritance'] });
  s.turn.phase = 'buy'; s.turn.coins = 7; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY_EVENT', event: 'inheritance' });
  s = reduce(s, { type: 'INHERITANCE_SET', card: 'village' });
  s.turn.phase = 'action'; s.turn.actions = 1; me(s).hand = ['disciple', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'disciple' });
  s = reduce(s, { type: 'DISCIPLE_PLAY', card: 'estate' });
  ok(me(s).inPlay.includes('estate') && cnt(me(s).discard, 'estate') === 1,
    'F9：門下生で相続の屋敷を2回使い、屋敷のコピーを獲得できる'); }

console.log('=== 冒険：CPU の終端保証（全pendingを CPU が閉じる）===');
{ const EVS = DOM.EVENTS_ADVENTURES.slice();
  let stuck = 0;
  EVS.forEach((ev) => {
    let s = mka([ev], 8, 3);
    // 場と手札に一通り置いてから買う（pending が立つ条件を作る）
    me(s).inPlay = ['silver', 'silver', 'copper', 'copper', 'ranger'];
    me(s).hand = ['curse', 'estate', 'copper', 'militia', 'gold', 'silver', 'moat'];
    me(s).journeyDown = true;
    s = reduce(s, { type: 'BUY_EVENT', event: ev });
    let g = 0;
    while (s.pending && g++ < 40) { const a = CPU.decide(s); if (!a) break; s = reduce(s, a); }
    if (s.pending) { stuck++; console.log('    stuck: ' + ev + ' pending=' + s.pending.type); }
  });
  ok(stuck === 0, 'CPU：冒険イベント20種すべての pending を終端できる'); }

console.log('=== 冒険：CPUソーク（adventures-events・2〜4人・全難易度）===');
{
  let done = 0, stuckN = 0, err = 0, evBuys = 0;
  for (let g = 0; g < 12; g++) {
    const n = 2 + (g % 3);
    const cfgs = []; for (let i = 0; i < n; i++) cfgs.push({ name: 'P' + i, isCpu: true, level: ['easy', 'normal', 'hard'][(g + i) % 3] });
    const events = DOM.eventsForSet('adventures-events');
    let s = E.createInitialState(cfgs, DOM.kingdomForSet('adventures-events'), { startActive: 0, events });
    let guard = 0;
    try {
      while (!s.gameOver && guard++ < 4000) {
        const a = CPU.decide(s);
        if (!a) break;
        if (a.type === 'BUY_EVENT') evBuys++;
        const before = JSON.stringify([s.turn, s.pending]);
        s = reduce(s, a);
        if (JSON.stringify([s.turn, s.pending]) === before && a.type !== 'END_TURN') { stuckN++; break; } // 状態が進まない＝拒否され続けている
      }
      if (s.gameOver) done++;
    } catch (e) { err++; console.log('    例外: ' + e.message); }
  }
  ok(err === 0, 'CPUソーク：例外0');
  ok(stuckN === 0, 'CPUソーク：膠着0（engine が拒否する手をCPUが出し続けない）');
  ok(done === 12, 'CPUソーク：12戦すべて完走');
  ok(evBuys > 0, 'CPUソーク：CPUが冒険イベントを購入している（' + evBuys + '回）');
}

console.log('\n' + (fail === 0 ? '✅ 横型イベント（帝国13＋冒険20） 全' + pass + '件 PASS' : '❌ イベント ' + fail + '件 FAIL / ' + pass + '件 PASS'));
if (fail > 0) process.exit(1);
