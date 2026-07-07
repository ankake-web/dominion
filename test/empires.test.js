/* 帝国（Empires）ゲームロジックの検証（Node 単体実行）
   使い方: node test/empires.test.js
   対象（Batch E1）: 負債(Debt)経済の基盤＋engineer/city_quarter/royal_blacksmith/capital。
     - 負債＝購入ブロック／$1返済／gain経由の付与／capital の on-discard 負債＋残コイン即返済。
     - 「コストN以下/ちょうどN の獲得」は負債コストのカードを取れない（engineer/messenger/CPU bestGain）。
     - 敵対レビュー回帰：闇市場での負債（負債中は黒市購入不可・負債カードを買えば負債を負う）。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260708;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
const reduce = (s, a) => E.reduce(s, a);
function count(arr, id) { return (arr || []).filter((c) => c === id).length; }
const KING = ['engineer', 'city_quarter', 'royal_blacksmith', 'capital', 'village', 'smithy', 'market', 'workshop', 'moat', 'cellar'];
function mk(opts) { return E.createInitialState(['A', 'B'], KING, Object.assign({ startActive: 0 }, opts || {})); }
const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat', 'princes', 'tavern'];
function tally(s) { const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; }; Object.keys(s.supply).forEach((id) => { if (id === 'ruins' || id === 'knights') return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); }); (s.ruins || []).forEach(a); (s.knights || []).forEach(a); (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a); s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a))); return t; }
function tdiff(a, b) { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); const d = []; ks.forEach((k) => { if ((a[k] || 0) !== (b[k] || 0)) d.push(k + ':' + (a[k] || 0) + '→' + (b[k] || 0)); }); return d; }

/* ============ 負債：購入→ブロック→返済 ============ */
console.log('=== 帝国: 負債（購入→ブロック→返済） ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 3;
  const t0 = tally(s);
  s = reduce(s, { type: 'BUY', card: 'engineer' }); // $0＋負債4
  ok(s.players[0].debt === 4, '技術者購入で 負債4');
  ok(count(s.players[0].discard, 'engineer') === 1 && s.turn.coins === 8, '技術者を獲得＋$0＝コイン不変');
  const before = count(s.players[0].discard, 'copper');
  s = reduce(s, { type: 'BUY', card: 'copper' });
  ok(count(s.players[0].discard, 'copper') === before, '負債があると購入不可');
  const buysBefore = s.turn.buys;
  s = reduce(s, { type: 'REPAY_DEBT', amount: 3 });
  ok(s.players[0].debt === 1 && s.turn.coins === 5 && s.turn.buys === buysBefore, '負債3返済（購入権消費なし）');
  s = reduce(s, { type: 'REPAY_DEBT' }); // amount未指定＝可能な限り
  ok(s.players[0].debt === 0 && s.turn.coins === 4, '残り負債を全返済');
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(count(s.players[0].discard, 'silver') === 1, '負債0なら購入できる');
  s = reduce(s, { type: 'REPAY_DEBT', amount: 99 });
  ok(s.players[0].debt === 0, '負債0で返済しても無変化');
  ok(tdiff(t0, tally(s)).length === 0, '保存則：総数不変（負債はカード外）');
}
{
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 2; s.players[0].debt = 5;
  s = reduce(s, { type: 'REPAY_DEBT', amount: 5 });
  ok(s.players[0].debt === 3 && s.turn.coins === 0, 'コイン2しかなければ2しか返せない');
}
{ // 負債はターンを跨いで残る＋公開情報
  let s = mk(); s.players[0].debt = 3;
  ok(E.maskStateFor(s, 1).players[0].debt === 3, 'debt は公開情報（相手視点でも見える）');
  const fresh = s.turn; ok(fresh, 'turn exists');
}

/* ============ 技術者：獲得→自己廃棄→もう1枚 ============ */
console.log('=== 帝国: 技術者 ===');
{
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 3;
  s.players[0].hand = ['engineer']; s.players[0].deck = ['copper', 'copper'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'engineer' });
  ok(s.pending && s.pending.type === 'engineer' && s.pending.stage === 'gain1', 'engineer→gain1');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  ok(count(s.players[0].discard, 'silver') === 1 && s.pending.stage === 'maytrash', '1枚目獲得→maytrash');
  s = reduce(s, { type: 'ENGINEER_TRASH', trash: true });
  ok(count(s.players[0].inPlay, 'engineer') === 0 && count(s.trash, 'engineer') === 1 && s.pending.stage === 'gain2', '技術者を廃棄→gain2');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'village' });
  ok(count(s.players[0].discard, 'village') === 1 && !s.pending, '2枚目獲得→解消');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
}
{ // 負債コストのカードは技術者で獲得できない（city_quarter=$0だが負債8）
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 3; s.players[0].hand = ['engineer'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'engineer' });
  const cq = (s.supply.city_quarter || 0);
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'city_quarter' });
  ok(s.pending && s.pending.stage === 'gain1' && (s.supply.city_quarter || 0) === cq && s.players[0].debt === 0, '技術者は負債カードを獲得できない（拒否・負債も発生せず）');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  ok(s.pending && s.pending.stage === 'maytrash', '正当な獲得で先へ進む');
}
{ // maytrash=keep
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 3; s.players[0].hand = ['engineer'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'engineer' });
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  s = reduce(s, { type: 'ENGINEER_TRASH', trash: false });
  ok(!s.pending && count(s.players[0].inPlay, 'engineer') === 1 && count(s.trash, 'engineer') === 0, '廃棄しない＝場に残り追加獲得なし');
}
{ // 玉座×技術者：2回目は場に技術者が無く自己廃棄不発（保存則）
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 3; s.players[0].hand = ['throne_room', 'engineer'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'engineer' });
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  s = reduce(s, { type: 'ENGINEER_TRASH', trash: true });
  ok(count(s.trash, 'engineer') === 1, '1回目で技術者は廃棄された');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'village' });
  ok(s.pending && s.pending.type === 'engineer' && s.pending.stage === 'gain1', '玉座2回目→gain1');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  s = reduce(s, { type: 'ENGINEER_TRASH', trash: true }); // 場に無い→不発
  ok(!s.pending && count(s.trash, 'engineer') === 1, '技術者は1枚しか廃棄されない（幻の廃棄なし）');
  ok(tdiff(t0, tally(s)).filter((d) => !/silver|village|throne_room|engineer/.test(d)).length === 0, '保存則OK');
}

/* ============ 市街 / 王室の鍛冶屋 ============ */
console.log('=== 帝国: 市街 / 王室の鍛冶屋 ===');
{
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['city_quarter', 'village', 'smithy', 'copper'];
  s.players[0].deck = ['gold', 'silver', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'city_quarter' });
  ok(s.turn.actions === 2, '+2アクション（プレイで-1消費＝1→2）');
  ok(s.players[0].hand.filter((c) => c === 'gold' || c === 'silver').length === 2, '手札のアクション2枚ぶん+2カード');
  ok(!s.pending, 'pendingなし');
}
{
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['royal_blacksmith'];
  s.players[0].deck = ['copper', 'estate', 'copper', 'silver', 'copper'];
  s.players[0].discard = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'royal_blacksmith' });
  ok(count(s.players[0].hand, 'copper') === 0 && count(s.players[0].discard, 'copper') === 3, '+5カード後 銅貨3枚を全捨て');
  ok(s.players[0].hand.length === 2 && count(s.players[0].hand, 'estate') === 1 && count(s.players[0].hand, 'silver') === 1, '手札は非銅貨2枚');
}

/* ============ 元手：+6コイン+1購入＋on-discard負債6 ============ */
console.log('=== 帝国: 元手 ===');
{ // コインを使い切る→負債6残
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 2;
  s.players[0].hand = ['capital'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'capital' });
  ok(s.turn.coins === 6 && s.turn.buys === 3, '+6コイン+1購入');
  s = reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.turn.coins === 0, 'gold購入でコイン0');
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].debt === 6, 'コイン使い切り→cleanupで負債6残');
}
{ // コインを使わない→残コイン6から即返済で負債0
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 2;
  s.players[0].hand = ['capital'];
  const t0base = tally(s);
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'capital' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].debt === 0, 'コイン残6→即返済で負債0');
  ok(tdiff(t0base, tally(s)).length === 0, '保存則OK（capitalはデッキ内に残る）');
}

/* ============ 敵対レビュー回帰：闇市場×負債 ============ */
console.log('=== 帝国: 闇市場×負債（回帰） ===');
{ // 負債カードを闇市場で買うと負債を負う（gain非経由でも付与）
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 8;
  s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['engineer', 'village'] };
  s = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'engineer' });
  ok(count(s.players[0].discard, 'engineer') === 1 && s.players[0].debt === 4, '闇市場で技術者購入→負債4を負う');
}
{ // 負債があると闇市場で購入できない
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 8; s.players[0].debt = 5;
  s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['village'] };
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'village' });
  ok(s.pending && count(s.players[0].discard, 'village') === 0 && s.turn.coins === c0, '負債があると闇市場でも購入不可（pending据え置き・コイン不変）');
  s = reduce(s, { type: 'BLACK_MARKET_SKIP' });
  ok(!s.pending, '見送りで解消');
}

/* ============ CPU ソーク：負債カード入り王国で膠着/例外/保存則違反なし ============ */
console.log('=== 帝国: CPU ソーク ===');
{
  let stuck = 0, exc = 0, consErr = 0, games = 0;
  for (let g = 0; g < 16; g++) {
    seed = 700 + g * 173;
    let s = E.createInitialState(['CPU0', 'CPU1'], KING, { startActive: 0 });
    s.players[0].cpuLevel = g % 2 ? 'hard' : 'normal'; s.players[1].cpuLevel = 'normal';
    const t0 = tally(s);
    let guard = 0;
    try { while (!s.gameOver && guard++ < 5000) { s = reduce(s, CPU.decide(s)); } }
    catch (e) { exc++; console.log('  例外:', e.message); }
    if (guard >= 5000) stuck++;
    if (tdiff(t0, tally(s)).length) { consErr++; console.log('  保存則差分:', tdiff(t0, tally(s)).join(',')); }
    games++;
  }
  ok(stuck === 0, 'CPU 膠着0（/' + games + '）');
  ok(exc === 0, 'CPU 例外0');
  ok(consErr === 0, 'CPU 保存則違反0');
}

console.log('\n' + (fail === 0 ? '✅ 帝国 全' + pass + '件 PASS' : '❌ 帝国 ' + fail + '件 FAIL / ' + pass + '件 PASS'));
if (fail > 0) process.exit(1);
