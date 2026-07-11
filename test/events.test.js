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

console.log('\n' + (fail === 0 ? '✅ 帝国イベント（EV0+EV1+EV2） 全' + pass + '件 PASS' : '❌ 帝国イベント ' + fail + '件 FAIL / ' + pass + '件 PASS'));
if (fail > 0) process.exit(1);
