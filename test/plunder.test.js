/* 略奪（Plunder）ゲームロジックの検証（Node 単体実行）
   使い方: node test/plunder.test.js
   正本＝docs/research/plunder_rules.md（冒頭「実装前に必読」20項目＋決定 D1〜D5）。
   対象:
     P1a＝戦利品(Loot)の山の基盤
          （15種×2＝30枚を裏向きにシャッフルした1山／**サプライではない**（3山終了に数えない・購入不可・
            汎用獲得不可・闇市場デッキに入れない）／**中身も順序も完全に秘密**（廃墟と違い一番上も見えない）／
            「戦利品を獲得する」＝山の一番上を**全員に公開してから**獲得／交換で戻すときは**一番上に裏向き**／
            **戦利品はカード**なので保存則に数える）。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260815;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
function count(arr, id) { return (arr || []).filter((c) => c === id).length; }

const LOOT = DOM.POOLS.loot;
// 戦利品を配る札を1枚入れた王国（＝山ができる）と、入れない王国（＝山ができない）。
const KING_LOOT = ['jewelled_egg', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'];
const KING_NONE = ['village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival', 'mine'];
function mk(kingdom, opts, names) {
  return E.createInitialState(names || ['A', 'B'], kingdom || KING_LOOT, Object.assign({ startActive: 0 }, opts || {}));
}
// 保存則の tally（`test/invariants.test.js` と同じ集合＋戦利品の山）。
const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat',
  'princes', 'tavern', 'inherited', 'cargo', 'exile', 'eventSetAside', 'ghostSetAside', 'cryptSetAside',
  'contractSetAside'];
const MIX = E.MIXED_PILE_KEYS;
function tally(s) {
  const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; };
  Object.keys(s.supply).forEach((id) => { if (MIX.indexOf(id) >= 0) return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); });
  MIX.forEach((k) => (s[k] || []).forEach(a));
  (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a); (s.loot || []).forEach(a);
  s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a)));
  s.players.forEach((p) => (p.archives || []).forEach((x) => (x.cards || []).forEach(a)));
  if (s.turn) { (s.turn.possessionGains || []).forEach(a); (s.turn.possessionTrash || []).forEach(a); }
  return t;
}
function sameTally(x, y) {
  const ks = new Set([...Object.keys(x), ...Object.keys(y)]);
  for (const k of ks) if ((x[k] || 0) !== (y[k] || 0)) return false;
  return true;
}

console.log('=== P1a: 戦利品(Loot)の山の基盤 ===');

// --- 山の生成条件 ---
{
  const s = mk(KING_LOOT);
  ok(Array.isArray(s.loot) && s.loot.length === 30, '戦利品を配る札があれば山は30枚（実際=' + (s.loot ? s.loot.length : 'null') + '）');
  const kinds = {}; s.loot.forEach((c) => (kinds[c] = (kinds[c] || 0) + 1));
  ok(Object.keys(kinds).length === 15, '15種そろっている');
  ok(LOOT.every((id) => kinds[id] === 2), '各2枚ずつ');
  const s3 = E.createInitialState(['A', 'B', 'C'], KING_LOOT, { startActive: 0 });
  ok(s3.loot.length === 30, '枚数は人数によらず30枚（3人でも）');
  const sn = mk(KING_NONE);
  ok(sn.loot == null, '戦利品を配る札が1枚も無ければ山を作らない');
}
// イベント／特性でも山ができる（横型も走査する）
{
  const s = E.createInitialState(['A', 'B'], KING_NONE, { startActive: 0, events: ['looting'] });
  ok(Array.isArray(s.loot) && s.loot.length === 30, 'イベント（略奪行為）だけでも山ができる');
  const s2 = E.createInitialState(['A', 'B'], KING_NONE, { startActive: 0, traits: ['cursed'] });
  ok(Array.isArray(s2.loot) && s2.loot.length === 30, '特性（呪われた）だけでも山ができる');
}

// --- 非サプライの4系統除外 ---
{
  const s = mk(KING_LOOT);
  ok(LOOT.every((id) => (s.supply[id] || 0) === 0 && !Object.prototype.hasOwnProperty.call(s.supply, id)),
    '戦利品は supply に載らない（＝サプライではない）');
  ok(LOOT.every((id) => !E.canBuyCard(s, 0, id)), '戦利品は購入できない');
  ok(LOOT.every((id) => !E.gainableBase(s, id)), '戦利品は汎用獲得（gainableBase）の対象外');
  // 闇市場デッキに絶対に入れない（母集団は全プールだが NON_SUPPLY で弾く）
  const bm = E.createInitialState(['A', 'B'], ['black_market', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'jewelled_egg'], { startActive: 0 });
  ok(Array.isArray(bm.blackMarket) && bm.blackMarket.every((id) => LOOT.indexOf(id) < 0), '闇市場デッキに戦利品が入らない');
  // 3山終了に数えない
  const before = E.emptyPileCount(s);
  const s2 = JSON.parse(JSON.stringify(s)); s2.loot = [];
  ok(E.emptyPileCount(s2) === before, '戦利品の山が空でも3山終了のカウントは増えない');
}

// --- 獲得＝一番上を公開して取る ---
{
  const s = mk(KING_LOOT);
  const t0 = tally(s);
  const top = s.loot[0];
  const got = E.gainLoot(s, 0);
  ok(got === top, '獲得するのは山の一番上');
  ok(s.loot.length === 29, '山が1枚減る');
  ok(count(s.players[0].discard, top) === 1, '既定の獲得先は捨て札置き場');
  ok(s.reveals && s.reveals[0] && s.reveals[0].cards.indexOf(top) >= 0, '獲得した戦利品を全員に公開している');
  ok(sameTally(t0, tally(s)), '保存則：戦利品を獲得してもカード総数は不変');
  // 獲得先の指定
  const s2 = mk(KING_LOOT);
  const top2 = s2.loot[0];
  E.gainLoot(s2, 0, 'hand');
  ok(count(s2.players[0].hand, top2) === 1, '獲得先に hand を指定できる');
  // 山が空なら何も起きない
  const s3 = mk(KING_LOOT); s3.loot = [];
  const before = tally(s3);
  ok(E.gainLoot(s3, 0) === null, '山が空なら null を返す');
  ok(sameTally(before, tally(s3)), '山が空でも保存則は保たれる');
  // 山が無いゲーム（null）でも落ちない
  const s4 = mk(KING_NONE);
  ok(E.gainLoot(s4, 0) === null, '山が無いゲームでも null を返して落ちない');
}

// --- 交換で山へ戻すときは一番上に裏向き ---
{
  const s = mk(KING_LOOT);
  const id = LOOT[0];
  ok(E.canReturnToPile(s, id), '戦利品は「山へ戻せる」と判定される');
  const n = s.loot.length;
  ok(E.returnToPile(s, id) === true, '戦利品を山へ戻せる');
  ok(s.loot.length === n + 1 && s.loot[0] === id, '戻した戦利品は山の**一番上**に入る');
  ok(s.supply[id] === undefined, '戻してもサプライには生えない');
  const s2 = mk(KING_NONE);
  ok(E.canReturnToPile(s2, id) === false, '山が無いゲームでは戻せない');
}

// --- オンライン：山の中身も順序も完全に伏せる ---
{
  const s = mk(KING_LOOT);
  const masked = E.maskStateFor(s, 0);
  ok(masked.loot.length === 30 && masked.loot.every((c) => c === 'back'),
    'マスク：戦利品の山は**全部**裏（廃墟と違い一番上も見せない）');
  // 獲得した1枚は reveals 側で全員に見える（＝伏せたままだと「何を得たか」が分からない）
  const s2 = mk(KING_LOOT); const got = E.gainLoot(s2, 0);
  const m2 = E.maskStateFor(s2, 1);
  ok(m2.reveals && m2.reveals[0] && m2.reveals[0].cards.indexOf(got) >= 0,
    'マスク：獲得した戦利品は相手にも公開される（reveals 経由）');
  ok(m2.loot.every((c) => c === 'back'), 'マスク：獲得後も山の中身は伏せたまま');
}

console.log('\n=== P1b-1: 戦利品の効果（ダブロン金貨／船首像／賞品のヤギ／ハンマー／剣／盾） ===');

// 手札・場・山札を作って財宝を1枚出すヘルパ（購入フェイズ）
function playT(s, pi, card) {
  s.turn.active = pi; s.turn.phase = 'buy';
  s.players[pi].hand.push(card);
  return E.reduce(s, { type: 'PLAY_TREASURE', card });
}
function fresh(kingdom, names) {
  const s = mk(kingdom || KING_LOOT, {}, names || ['A', 'B']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  return s;
}

// --- ダブロン金貨＝獲得時に金貨（強制） ---
{
  const s = fresh();
  s.loot = ['doubloons'].concat(s.loot.filter((c) => c !== 'doubloons'));
  const t0 = tally(s);
  const g0 = s.supply.gold;
  E.gainLoot(s, 0);
  ok(count(s.players[0].discard, 'doubloons') === 1, 'ダブロン金貨を獲得した');
  ok(count(s.players[0].discard, 'gold') === 1 && s.supply.gold === g0 - 1, '獲得時に金貨1枚を**強制**獲得する');
  ok(sameTally(t0, tally(s)), '保存則：カード総数は不変');
  // 金貨の山が空なら何も起きない
  const s2 = fresh(); s2.loot = ['doubloons'].concat(s2.loot.filter((c) => c !== 'doubloons'));
  s2.supply.gold = 0;
  E.gainLoot(s2, 0);
  ok(count(s2.players[0].discard, 'gold') === 0, '金貨の山が空なら何も獲得しない（落ちない）');
}
// --- 船首像＝$3＋次のターン開始時 +2カード（持続） ---
{
  const s = fresh();
  const s1 = playT(s, 0, 'figurehead');
  ok(s1.turn.coins === 3, '船首像：+$3');
  ok((s1.players[0].delayedEffects || []).some((e) => e.type === 'figurehead'), '持続の予約が立つ');
  // 自分の手番が戻ってくるまで進める
  let cur = s1;
  cur.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  cur = E.reduce(cur, { type: 'END_TURN' });
  cur = E.reduce(cur, { type: 'END_ACTION_PHASE' });
  cur = E.reduce(cur, { type: 'END_TURN' });
  ok(cur.turn.active === 0, '自分の手番に戻った');
  ok(cur.players[0].hand.length === 7, '船首像：次のターン開始時 +2カード（先引き5＋2）');
}
// --- 賞品のヤギ＝$3＋1購入＋任意の廃棄 ---
{
  const s = fresh();
  s.players[0].hand = ['estate'];
  const b0 = s.turn.buys;
  let s1 = playT(s, 0, 'prize_goat');
  ok(s1.turn.coins === 3 && s1.turn.buys === b0 + 1, '賞品のヤギ：+$3 +1購入');
  ok(s1.pending && s1.pending.type === 'prize_goat', '廃棄の窓が開く');
  const t0 = tally(s1);
  s1 = E.reduce(s1, { type: 'PRIZE_GOAT_TRASH', card: 'estate' });
  ok(!s1.pending && count(s1.trash, 'estate') === 1, '選んだ1枚を廃棄して窓が閉じる');
  ok(sameTally(t0, tally(s1)), '保存則：廃棄しても総数は不変');
  // 廃棄しないで閉じられる（任意）
  const s2 = fresh(); s2.players[0].hand = ['estate'];
  let s3 = playT(s2, 0, 'prize_goat');
  s3 = E.reduce(s3, { type: 'PRIZE_GOAT_TRASH', card: null });
  ok(!s3.pending && count(s3.trash, 'estate') === 0, '「廃棄しない」で閉じられる（任意）');
  // 手札0枚なら窓を開かない
  const s4 = fresh();
  const s5 = playT(s4, 0, 'prize_goat');
  ok(!s5.pending, '手札0枚なら窓を開かない');
}
// --- ハンマー＝$3＋コスト4以下を強制獲得 ---
{
  const s = fresh();
  let s1 = playT(s, 0, 'hammer');
  ok(s1.turn.coins === 3, 'ハンマー：+$3');
  ok(s1.pending && s1.pending.type === 'hammer_gain', '獲得の窓が開く');
  // 強制＝辞退できない
  const declined = E.reduce(s1, { type: 'HAMMER_GAIN', card: null });
  ok(declined.pending && declined.pending.type === 'hammer_gain', '候補があるうちは辞退できない（強制）');
  // $5 は取れない／$4 は取れる
  const tooExpensive = E.reduce(s1, { type: 'HAMMER_GAIN', card: 'laboratory' });
  ok(tooExpensive.pending, 'コスト5は獲得できない');
  const s2 = E.reduce(s1, { type: 'HAMMER_GAIN', card: 'militia' });
  ok(!s2.pending && count(s2.players[0].discard, 'militia') === 1, 'コスト4を獲得できる');
  // 候補ゼロなら窓を開かない（＝人間が詰まない／CPUが無限ループしない）
  const s3 = fresh();
  Object.keys(s3.supply).forEach((id) => { if (E.costUpTo(s3, id, 4)) s3.supply[id] = 0; });
  const s4 = playT(s3, 0, 'hammer');
  ok(!s4.pending, '$4以下の獲得先が1つも無ければ窓を開かない');
}
// --- 剣＝アタック（手札が4枚になるまで捨てる） ---
{
  const s = fresh();
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  const s1 = playT(s, 0, 'sword');
  ok(s1.turn.coins === 3, '剣：+$3');
  ok(s1.pending && s1.pending.type === 'discard_down' && s1.pending.down === 4 && s1.pending.player === 1,
    '剣：他プレイヤーに「手札4枚まで捨てる」窓（民兵型・down=4）');
  const s2 = E.reduce(s1, { type: 'DISCARD_DOWN_RESOLVE', cards: ['copper', 'copper'] });
  ok(!s2.pending && s2.players[1].hand.length === 4, '手札が4枚になった');
  // 手札4枚以下の相手は対象外
  const s3 = fresh(); s3.players[1].hand = ['copper', 'copper', 'copper', 'copper'];
  const s4 = playT(s3, 0, 'sword');
  ok(!s4.pending, '手札4枚の相手には窓を開かない（「5枚以上なら1枚」ではない）');
}
// --- 盾＝堀と同型の免疫リアクション（手札に残る・何度でも） ---
{
  const s = fresh();
  s.players[1].hand = ['shield', 'copper', 'copper', 'copper', 'copper', 'copper'];
  const s1 = playT(s, 0, 'sword');
  ok(s1.pending && s1.pending.player === 1, '盾を持っていても窓は開く（公開するか選べる）');
  const s2 = E.reduce(s1, { type: 'SHIELD_REVEAL' });
  ok(!s2.pending, '盾を公開するとアタックが無効化される');
  ok(count(s2.players[1].hand, 'shield') === 1, '**盾は手札に残る**（堀と同じ）');
  ok(s2.players[1].hand.length === 6, '手札を1枚も捨てていない');
  // 盾は自分のターンには普通の財宝として使える
  const s3 = fresh();
  const s4 = playT(s3, 0, 'shield');
  ok(s4.turn.coins === 3, '盾：自分のターンには +$3');
  ok(s4.turn.buys >= 2, '盾：+1購入');
}

console.log(`\n略奪テスト結果: ${pass} 件成功, ${fail} 件失敗`);
if (fail > 0) process.exit(1);
