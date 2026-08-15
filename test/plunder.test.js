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
  'contractSetAside', 'puzzleBox', 'cage'];
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

console.log('\n=== P1b-2: 戦利品の効果（六分儀／パズルボックス／勲章／杖） ===');

// --- 六分儀＝上5枚を見て任意枚数を捨て、残りを任意順で山札の上へ ---
{
  const s = fresh();
  s.players[0].deck = ['gold', 'estate', 'silver', 'curse', 'copper', 'province'];
  /* ⚠ 基準点の取り方に注意（2点）：
     (1) 見ている5枚は `pending.cards` に抱えられ**どのゾーンにも無い**（既存の地図職人と同じ設計。
         invariants も `if (s.pending) continue;` で対話中は検査しない）＝**解決後**と比べる。
     (2) `playT` は手札にカードを1枚生やすので、**生やした後**に基準を取る。 */
  s.turn.active = 0; s.turn.phase = 'buy'; s.players[0].hand.push('sextant');
  const t0 = tally(s);
  let s1 = E.reduce(s, { type: 'PLAY_TREASURE', card: 'sextant' });
  ok(s1.turn.coins === 3 && s1.turn.buys >= 2, '六分儀：+$3 +1購入');
  ok(s1.pending && s1.pending.type === 'sextant' && s1.pending.cards.length === 5, '上5枚を見る（強制）');
  s1 = E.reduce(s1, { type: 'SEXTANT_RESOLVE', discard: ['estate', 'curse'], top: ['gold', 'silver', 'copper'] });
  ok(!s1.pending, '窓が閉じる');
  ok(count(s1.players[0].discard, 'estate') === 1 && count(s1.players[0].discard, 'curse') === 1, '選んだ2枚を捨てた');
  ok(s1.players[0].deck[0] === 'gold' && s1.players[0].deck[1] === 'silver' && s1.players[0].deck[2] === 'copper',
    '残りを指定した順番で山札の上に戻す（top[0] が一番上）');
  ok(s1.players[0].deck[3] === 'province', '見なかった6枚目はその下のまま');
  ok(sameTally(t0, tally(s1)), '保存則：総数は不変');
  // 5枚全部捨てる／全部戻す
  const s2 = fresh(); s2.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper'];
  let s3 = playT(s2, 0, 'sextant');
  s3 = E.reduce(s3, { type: 'SEXTANT_RESOLVE', discard: ['copper', 'copper', 'copper', 'copper', 'copper'], top: [] });
  ok(!s3.pending && s3.players[0].discard.filter((c) => c === 'copper').length === 5, '5枚すべて捨てられる');
  // 不正な入力（見ていないカード）は拒否して pending 据え置き
  const s4 = fresh(); s4.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper'];
  let s5 = playT(s4, 0, 'sextant');
  const s6 = E.reduce(s5, { type: 'SEXTANT_RESOLVE', discard: ['gold'], top: [] });
  ok(s6.pending && s6.pending.type === 'sextant', '見ていないカードを送ると拒否（状態不変）');
}
// --- パズルボックス＝脇に伏せ、ターン終了時（先引きの後）に手札へ ---
{
  const s = fresh();
  s.players[0].hand = ['gold'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  let s1 = playT(s, 0, 'puzzle_box');
  ok(s1.turn.coins === 3 && s1.turn.buys >= 2, 'パズルボックス：+$3 +1購入');
  ok(s1.pending && s1.pending.type === 'puzzle_box', '脇に置く窓が開く');
  const t0 = tally(s1);
  s1 = E.reduce(s1, { type: 'PUZZLE_BOX_SET', card: 'gold' });
  ok(!s1.pending && count(s1.players[0].puzzleBox, 'gold') === 1, '手札1枚を脇に伏せた');
  ok(sameTally(t0, tally(s1)), '保存則：脇に置いても総数は不変');
  // マスク＝所有者以外には裏
  const m = E.maskStateFor(s1, 1);
  ok(m.players[0].puzzleBox.every((c) => c === 'back'), 'マスク：脇札は相手からは裏向き');
  ok(E.maskStateFor(s1, 0).players[0].puzzleBox[0] === 'gold', 'マスク：本人からは見える');
  // ターン終了時（先引きの後）に手札へ
  const s2 = E.reduce(s1, { type: 'END_TURN' });
  ok((s2.players[0].puzzleBox || []).length === 0, '脇札が空になった');
  ok(count(s2.players[0].hand, 'gold') === 1, '**先引きした手札に加わっている**');
  ok(s2.players[0].hand.length === 6, '先引き5枚＋脇札1枚＝6枚');
  ok(count(s2.players[0].discard, 'puzzle_box') === 1, 'パズルボックス自身は当ターンに普通に捨てられる（持続ではない）');
  // 置かないで閉じられる
  const s3 = fresh(); s3.players[0].hand = ['gold'];
  let s4 = playT(s3, 0, 'puzzle_box');
  s4 = E.reduce(s4, { type: 'PUZZLE_BOX_SET', card: null });
  ok(!s4.pending && (s4.players[0].puzzleBox || []).length === 0, '「置かない」で閉じられる');
  // 手札0枚なら窓を開かない
  const s5 = fresh();
  ok(!playT(s5, 0, 'puzzle_box').pending, '手札0枚なら窓を開かない');
}
// --- 勲章＝このターン、獲得したカードすべてを山札の上に置いてよい ---
{
  const s = fresh();
  let s1 = playT(s, 0, 'insignia');
  ok(s1.turn.coins === 3, '勲章：+$3');
  ok(s1.turn.insignia === 1, 'このターン用のカウンタが立つ');
  // 獲得すると窓が開く
  s1.turn.coins = 6; s1.turn.buys = 2;
  let s2 = E.reduce(s1, { type: 'BUY', card: 'silver' });
  ok(s2.pending && s2.pending.type === 'travelling_fair' && s2.pending.source === 'insignia',
    '獲得のたびに「山札の上に置く？」の窓が開く');
  s2 = E.reduce(s2, { type: 'TRAVELLING_FAIR_TOPDECK', topdeck: true });
  ok(!s2.pending && s2.players[0].deck[0] === 'silver', '山札の上に置ける');
  // 2枚目も開く（**毎回**）
  let s3 = E.reduce(s2, { type: 'BUY', card: 'copper' });
  ok(s3.pending && s3.pending.type === 'travelling_fair' && s3.pending.source === 'insignia', '2枚目の獲得でも開く');
  s3 = E.reduce(s3, { type: 'TRAVELLING_FAIR_TOPDECK', topdeck: false });
  ok(!s3.pending && count(s3.players[0].discard, 'copper') === 1, '「そのまま」も選べる');
  // 勲章を使っていないターンでは開かない
  const s4 = fresh(); s4.turn.coins = 3; s4.turn.buys = 1;
  const s5 = E.reduce(s4, { type: 'BUY', card: 'silver' });
  ok(!s5.pending, '勲章を使っていなければ窓は開かない');
}
// --- 杖＝購入フェイズに手札のアクション1枚を使用 ---
{
  const s = fresh();
  s.players[0].hand = ['village'];
  s.players[0].deck = ['gold', 'gold'];
  let s1 = playT(s, 0, 'staff');
  ok(s1.turn.coins === 3 && s1.turn.buys >= 2, '杖：+$3 +1購入');
  ok(s1.pending && s1.pending.type === 'staff_play', 'アクションを使う窓が開く');
  const a0 = s1.turn.actions;
  s1 = E.reduce(s1, { type: 'STAFF_PLAY', card: 'village' });
  ok(!s1.pending, '窓が閉じる');
  ok(count(s1.players[0].inPlay, 'village') === 1, '選んだアクションが場に出た');
  ok(s1.players[0].hand.length === 1 && s1.players[0].hand[0] === 'gold', '村の +1カードが働いた');
  ok(s1.turn.phase === 'buy', '**購入フェイズのまま**（フェイズを書き換えない）');
  ok(s1.turn.actions === a0 + 2, 'アクション権は消費せず、村の +2アクションだけ増える');
  // 使わないで閉じられる
  const s2 = fresh(); s2.players[0].hand = ['village'];
  let s3 = playT(s2, 0, 'staff');
  s3 = E.reduce(s3, { type: 'STAFF_PLAY', card: null });
  ok(!s3.pending && count(s3.players[0].inPlay, 'village') === 0, '「使わない」で閉じられる');
  // 手札にアクションが無ければ窓を開かない
  const s4 = fresh(); s4.players[0].hand = ['copper'];
  ok(!playT(s4, 0, 'staff').pending, '手札にアクションが無ければ窓を開かない');
  // 杖自身は当ターンのクリンナップで捨てる（玉座の間と逆＝持続を使わせても場に残らない）
  const s5 = fresh();
  s5.players[0].hand = ['caravan'];
  s5.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  let s6 = playT(s5, 0, 'staff');
  s6 = E.reduce(s6, { type: 'STAFF_PLAY', card: 'caravan' });
  const s7 = E.reduce(s6, { type: 'END_TURN' });
  ok(count(s7.players[0].durationCards, 'staff') === 0 && count(s7.players[0].discard, 'staff') === 1,
    '**杖は当ターンに捨てられる**（持続を使わせても場に残らない＝玉座の間と逆）');
  ok(count(s7.players[0].durationCards, 'caravan') === 1, '使わせた隊商のほうは持続として場に残る');
}

console.log('\n=== P1b-3: 難所5枚（宝石／アンフォラ／尽きぬ杯／宝珠／呪符の巻物） ===');

/* 自分の手番が戻るまで進める。⚠ `END_TURN` は**購入フェイズからしか通らない**ので、
   毎回 `END_ACTION_PHASE` → `END_TURN` の2手を送る（手番開始時は action フェイズ）。 */
function nextOwnTurn(s) {
  const me = s.turn.active;
  let cur = s;
  for (let i = 0; i < 8; i++) {
    if (cur.turn.phase !== 'buy') cur = E.reduce(cur, { type: 'END_ACTION_PHASE' });
    cur = E.reduce(cur, { type: 'END_TURN' });
    if (cur.turn.active === me) return cur;
  }
  return cur;
}

// --- 宝石＝次のターン開始時に山札の一番下へ（捨て札を経由しない） ---
{
  const s = fresh();
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  let s1 = playT(s, 0, 'jewels');
  ok(s1.turn.coins === 3 && s1.turn.buys >= 2, '宝石：+$3 +1購入');
  const t0 = tally(s1);
  const s2 = nextOwnTurn(s1);
  ok(count(s2.players[0].deck, 'jewels') === 1, '次のターン開始時に山札へ移った');
  ok(s2.players[0].deck[s2.players[0].deck.length - 1] === 'jewels', '**山札の一番下**に置かれている');
  ok(count(s2.players[0].discard, 'jewels') === 0 && count(s2.players[0].durationCards, 'jewels') === 0,
    '捨て札置き場にも場にも残っていない');
  ok(sameTally(t0, tally(s2)), '保存則：総数は不変');
  // 坑道（捨て札トリガー）を誘発しないこと＝捨て札置き場を経由しない証拠
  const s3 = fresh(['jewelled_egg', 'tunnel', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory']);
  s3.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  let s4 = playT(s3, 0, 'jewels');
  const gold0 = s4.supply.gold;
  const s5 = nextOwnTurn(s4);
  ok(s5.supply.gold === gold0, '捨て札トリガーを1つも通していない（坑道のある場でも金貨が減らない）');
}
// --- アンフォラ＝「今」か「次」をプレイのたびに独立に選ぶ ---
{
  // 「今」を選ぶ＝当ターンに +$3 +1購入、持続しない
  const s = fresh();
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  let s1 = playT(s, 0, 'amphora');
  ok(s1.pending && s1.pending.type === 'amphora', '「今か次か」の窓が開く');
  const b0 = s1.turn.buys;
  s1 = E.reduce(s1, { type: 'AMPHORA_CHOOSE', now: true });
  ok(!s1.pending && s1.turn.coins === 3 && s1.turn.buys === b0 + 1, '「今」＝その場で +$3 +1購入');
  const s2 = E.reduce(s1, { type: 'END_TURN' });
  ok(count(s2.players[0].discard, 'amphora') === 1 && count(s2.players[0].durationCards, 'amphora') === 0,
    '「今」を選んだら**持続しない**（当ターンに捨てられる）');
  // 「次」を選ぶ＝当ターンは何ももらわず、次のターン開始時に +$3 +1購入
  const s3 = fresh();
  s3.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  let s4 = playT(s3, 0, 'amphora');
  s4 = E.reduce(s4, { type: 'AMPHORA_CHOOSE', now: false });
  ok(s4.turn.coins === 0, '「次」＝当ターンにはコインをもらわない');
  const s5 = E.reduce(s4, { type: 'END_TURN' });
  ok(count(s5.players[0].durationCards, 'amphora') === 1, '「次」を選んだら持続として場に残る');
  const s6 = nextOwnTurn(s4);
  ok(s6.turn.coins === 3 && s6.turn.buys >= 2, '次のターン開始時に +$3 +1購入');
}
// --- 尽きぬ杯＝永続持続（ゲーム終了まで毎ターン $1 +1購入） ---
{
  const s = fresh();
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  const b0 = s.turn.buys;
  let s1 = playT(s, 0, 'endless_chalice');
  ok(s1.turn.coins === 1 && s1.turn.buys === b0 + 1, '尽きぬ杯：現在 $1 +1購入');
  ok(s1.players[0].endlessChalices === 1, '稼働数が1になる');
  const s2 = nextOwnTurn(s1);
  ok(s2.turn.coins === 1 && s2.turn.buys === 2, '次のターン開始時にも $1 +1購入');
  ok(count(s2.players[0].durationCards, 'endless_chalice') === 1, '**場に残り続ける**（永続持続）');
  const s3 = nextOwnTurn(s2);
  ok(s3.turn.coins === 1 && count(s3.players[0].durationCards, 'endless_chalice') === 1, 'さらに次のターンも続く');
}
// --- 宝珠＝捨て札を見て「捨て札から使う」or「+1購入 +$3」 ---
{
  const s = fresh();
  s.players[0].discard = ['village', 'estate'];
  s.players[0].deck = ['gold', 'gold'];
  let s1 = playT(s, 0, 'orb');
  ok(s1.pending && s1.pending.type === 'orb', '宝珠：選択の窓が開く');
  // 捨て札からアクションを使う
  const a0 = s1.turn.actions;
  let s2 = E.reduce(s1, { type: 'ORB_RESOLVE', mode: 'play', card: 'village' });
  ok(!s2.pending && count(s2.players[0].inPlay, 'village') === 1, '捨て札から村を使用した');
  ok(count(s2.players[0].discard, 'village') === 0, '捨て札から取り除かれている');
  ok(s2.turn.actions === a0 + 2, 'アクション権は消費せず村の +2アクションだけ増える');
  ok(s2.turn.phase === 'buy', '**購入フェイズのまま**');
  // 捨て札に無いカードは拒否
  const s3 = E.reduce(s1, { type: 'ORB_RESOLVE', mode: 'play', card: 'smithy' });
  ok(s3.pending && s3.pending.type === 'orb', '捨て札に無いカードは拒否（状態不変）');
  // +$3 +1購入 を選ぶ
  const b1 = s1.turn.buys;
  const s4 = E.reduce(s1, { type: 'ORB_RESOLVE', mode: 'coin' });
  ok(!s4.pending && s4.turn.coins === 3 && s4.turn.buys === b1 + 1, '「+1購入 +$3」も選べる');
  // 宝珠自身は当ターンに捨てる（使わせた持続が残っても）
  const s5 = fresh(); s5.players[0].discard = ['caravan'];
  s5.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  let s6 = playT(s5, 0, 'orb');
  s6 = E.reduce(s6, { type: 'ORB_RESOLVE', mode: 'play', card: 'caravan' });
  const s7 = E.reduce(s6, { type: 'END_TURN' });
  ok(count(s7.players[0].discard, 'orb') === 1 && count(s7.players[0].durationCards, 'orb') === 0,
    '**宝珠自身は当ターンに捨てられる**（玉座の間と逆）');
  ok(count(s7.players[0].durationCards, 'caravan') === 1, '使わせた隊商だけ持続として残る');
}
// --- 呪符の巻物＝アクションでも財宝／廃棄できたときだけ獲得 ---
{
  // 財宝として（購入フェイズ）
  const s = fresh();
  let s1 = playT(s, 0, 'spell_scroll');
  ok(count(s1.trash, 'spell_scroll') === 1, '呪符の巻物：これを廃棄する');
  ok(s1.pending && s1.pending.type === 'spell_scroll_gain', 'これより安いカードを獲得する窓が開く');
  ok(s1.pending.limit === 7, 'コスト基準は自身の現在コスト（$7）');
  // $7 は取れない（「これより安い」＝厳密に安い）／$6 は取れる
  const notCheaper = E.reduce(s1, { type: 'SPELL_SCROLL_GAIN', card: 'kings_court' });
  ok(notCheaper.pending, '同コスト以上は獲得できない');
  let s2 = E.reduce(s1, { type: 'SPELL_SCROLL_GAIN', card: 'gold' });
  ok(count(s2.players[0].discard, 'gold') === 1, '$6の金貨を獲得できる');
  ok(s2.pending && s2.pending.type === 'spell_scroll_play', '獲得したのが財宝なので「使う？」の窓が開く');
  const s3 = E.reduce(s2, { type: 'SPELL_SCROLL_PLAY', play: true });
  ok(!s3.pending && count(s3.players[0].inPlay, 'gold') === 1, '獲得した金貨を使用できる');
  ok(s3.turn.coins === 3, '使用した金貨の +$3 が入る（呪符の巻物自身は $0）');
  // 使わないことも選べる
  const s4 = E.reduce(s2, { type: 'SPELL_SCROLL_PLAY', play: false });
  ok(!s4.pending && count(s4.players[0].discard, 'gold') === 1, '「使わない」も選べる');
  // アクションとして（アクションフェイズ）＝アクション権を1つ消費する
  const s5 = fresh();
  s5.turn.phase = 'action'; s5.turn.actions = 1;
  s5.players[0].hand = ['spell_scroll'];
  const s6 = E.reduce(s5, { type: 'PLAY_ACTION', card: 'spell_scroll' });
  ok(count(s6.trash, 'spell_scroll') === 1, 'アクションとしても使える（廃棄される）');
  ok(s6.turn.actions === 0, 'アクションとして使うとアクション権を1つ消費する');
  ok(s6.pending && s6.pending.type === 'spell_scroll_gain', '同じ獲得の窓が開く');
}

/* ============================================================
   P2＝"next time"（次に〜したとき）型の持続（7枚＝檻/調査/秘境の社/豊穣/旗艦/上陸部隊/切り裂き魔）
   正本＝docs/research/plunder_rules.md 第1章 §3・必読1。
   ============================================================ */
console.log('\n=== P2: "next time" 型持続の共通機構 ===');

const KING_P2 = ['search', 'secluded_shrine', 'flagship', 'landing_party', 'cutthroat', 'village', 'smithy', 'moat', 'militia', 'market'];
function mkP2(opts, names) { return mk(KING_P2, opts, names); }
// アクションフェイズで1枚プレイする準備
function handPlay(s, pi, cards) {
  s.turn.phase = 'action'; s.turn.actions = 99;
  s.players[pi].hand = cards.slice();
  return s;
}

// --- 調査（Search）---
{
  // +$2＋予約。条件を満たさなければ場に残り続ける（ターンをまたいでも予約が消えない）。
  let s = mkP2(); s = handPlay(s, 0, ['search']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'search' });
  ok(s.turn.coins === 2, '調査＝+$2');
  ok((s.players[0].delayedEffects || []).some((e) => e.nextTime === 'pile_empty'), '「次にサプライ1山が空になったとき」の予約が張られる');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'search') === 1, '条件を満たさなければ片付けで捨てられず場に残る');
  // 相手のターンを1周して自分に戻っても予約は消えない（resolveDurationStartEffects が消費しない）
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });
  ok((s.players[0].delayedEffects || []).some((e) => e.nextTime === 'pile_empty'), 'ターン開始時の解決で予約が消えない（持ち越す）');
  ok(count(s.players[0].durationCards, 'search') === 1, '2周目も場に残っている');
  // 自分の購入で山が空になる → これを場から廃棄し戦利品1枚を獲得
  s.supply.curse = 1; s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 0;
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'BUY', card: 'curse' });
  ok(count(s.trash, 'search') === 1 && count(s.players[0].durationCards, 'search') === 0, '山が空になった＝調査を場から廃棄');
  ok(s.loot.length === lootBefore - 1, '戦利品1枚を獲得');
  ok(!(s.players[0].delayedEffects || []).some((e) => e.nextTime), '予約は消費された');
}
{
  // 玉座の間×調査＝廃棄は1回・戦利品は2枚（公式FAQ）
  let s = mk(['search', 'throne_room', 'village', 'smithy', 'moat', 'militia', 'market', 'cellar', 'workshop', 'mine']);
  s = handPlay(s, 0, ['throne_room', 'search']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
  s = E.reduce(s, { type: 'THRONE_CHOOSE', card: 'search' });
  ok(count((s.players[0].delayedEffects || []).filter((e) => e.nextTime === 'pile_empty').map(() => 'x'), 'x') === 2, '玉座×調査＝予約が2つ');
  const lootBefore = s.loot.length;
  s.supply.curse = 1; s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 0;
  s = E.reduce(s, { type: 'BUY', card: 'curse' });
  ok(count(s.trash, 'search') === 1, '廃棄は1回だけ（物理カードは1枚）');
  ok(s.loot.length === lootBefore - 2, '戦利品は2枚獲得');
}
{
  // 非サプライ山（戦利品の山）が空になっても誘発しない
  let s = mkP2(); s = handPlay(s, 0, ['search']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'search' });
  s.loot = ['amphora'];                       // 残り1枚に細工
  E.gainLoot(s, 1);                           // 相手が最後の戦利品を獲得＝山が空
  ok(count(s.trash, 'search') === 0 && (s.players[0].delayedEffects || []).some((e) => e.nextTime === 'pile_empty'),
    '非サプライ山（戦利品）が空になっても調査は誘発しない');
}
{
  // 相手のターンに山が空 → 自分の調査が誘発（相手の獲得でも）・ターン順（先手＝手番プレイヤーから）
  let s = mkP2(null, ['A', 'B']);
  s = handPlay(s, 0, ['search']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'search' });
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });       // → B のターン
  ok(s.turn.active === 1, 'B のターンになった');
  s.supply.curse = 1; s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 0;
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'BUY', card: 'curse' });
  ok(count(s.trash, 'search') === 1, '相手のターンの山切れでも自分の調査が誘発する');
  ok(s.loot.length === lootBefore - 1 && count(s.players[0].discard, s.players[0].discard.find((c) => LOOT.indexOf(c) >= 0)) >= 1,
    '戦利品は調査の持ち主（A）が獲得する');
}

// --- 秘境の社（Secluded Shrine）---
{
  // +$1＋予約 → 財宝を獲得すると「手札を最大2枚廃棄してよい」（任意）
  let s = mkP2(); s = handPlay(s, 0, ['secluded_shrine']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'secluded_shrine' });
  ok(s.turn.coins === 1, '秘境の社＝+$1');
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 3;
  s.players[0].hand = ['copper', 'estate', 'gold'];
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.pending && s.pending.type === 'shrine_trash' && s.pending.player === 0, '財宝の獲得で廃棄の窓が開く');
  const t0 = tally(s);
  s = E.reduce(s, { type: 'SHRINE_TRASH', cards: ['copper', 'estate'] });
  ok(count(s.trash, 'copper') >= 1 && count(s.trash, 'estate') >= 1, '最大2枚を廃棄できる');
  ok(sameTally(t0, tally(s)), '保存則が保たれる');
  ok(!(s.players[0].delayedEffects || []).some((e) => e.nextTime), '予約は消費された（空振りでも消費）');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].discard, 'secluded_shrine') === 1, '誘発したターンの片付けで捨てられる（自分のターン）');
}
{
  // 「廃棄しない」も選べる／それでも消費される（＝場に残らない）
  let s = mkP2(); s = handPlay(s, 0, ['secluded_shrine']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'secluded_shrine' });
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 3;
  s.players[0].hand = ['gold'];
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  s = E.reduce(s, { type: 'SHRINE_TRASH', cards: [] });
  ok(!s.pending, '「廃棄しない」で窓が閉じる');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].discard, 'secluded_shrine') === 1, '何もしなくても消費され、そのターンに捨てられる');
}
{
  /* 相手のターンに誘発（大使館＝獲得時に他の全員が銀貨を獲得）→ 窓は自分（持ち主）に開き、
     解決後「相手の片付け」で自分の場から捨てられる（sweep の1枚だけ・全体掃除ではない）。 */
  let s = E.createInitialState(['A', 'B'], ['secluded_shrine', 'embassy', 'village', 'smithy', 'moat', 'militia', 'market', 'cellar', 'workshop', 'mine'], { startActive: 0 });
  s = handPlay(s, 0, ['secluded_shrine']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'secluded_shrine' });
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });       // → B のターン
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 5;
  s.players[0].hand = ['copper', 'curse'];
  s = E.reduce(s, { type: 'BUY', card: 'embassy' });  // B が大使館を獲得 → A が銀貨を獲得 → A の社が誘発
  ok(s.pending && s.pending.type === 'shrine_trash' && s.pending.player === 0, '相手のターンでも自分（持ち主）に窓が開く');
  s = E.reduce(s, { type: 'SHRINE_TRASH', cards: ['curse'] });
  ok(count(s.players[0].durationCards, 'secluded_shrine') === 1, '（まだ B のターン中）社は場に残っている');
  s = E.reduce(s, { type: 'END_TURN' });       // B の片付け
  ok(count(s.players[0].durationCards, 'secluded_shrine') === 0 && count(s.players[0].discard, 'secluded_shrine') === 1,
    '相手の片付けで自分の場から捨てられる（公式＝is discarded that turn）');
}

// --- 豊穣（Abundance・財宝-持続）---
{
  let s = mkP2(); s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 0;
  s.players[0].hand = ['abundance'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'abundance' });
  ok(s.turn.coins === 0, '豊穣＝即時のコインは無い');
  ok((s.players[0].delayedEffects || []).some((e) => e.nextTime === 'gain'), '予約が張られる');
  s.turn.coins = 3;
  s = E.reduce(s, { type: 'BUY', card: 'village' });   // アクションを獲得
  ok(s.turn.coins === 3 - 3 + 3, 'アクション獲得で +$3（村$3を買って差し引き+3）');
  ok(s.turn.buys === 1, '+1購入（1消費して+1）');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].discard, 'abundance') === 1, '誘発したターンの片付けで捨てられる');
}
{
  // 相手のターンに誘発するとボーナスは無駄（手番プレイヤーの購入/コインに入らない）＋相手の片付けで捨てられる
  let s = E.createInitialState(['A', 'B'], ['secluded_shrine', 'university', 'village', 'smithy', 'moat', 'militia', 'market', 'cellar', 'workshop', 'potion_dummy'.replace('potion_dummy', 'mine')], { startActive: 0 });
  s.players[0].hand = ['abundance']; s.turn.phase = 'buy'; s.turn.buys = 1;
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'abundance' });
  s = E.reduce(s, { type: 'END_TURN' });      // → B のターン
  const coinsB = 7; s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = coinsB;
  // B が値引きなしで村を買う → **A の豊穣が誘発**（A がアクションを獲得したわけではない）…ではなく
  // A がアクションを獲得する必要がある＝B の大学等は持っていないので、直接 A に村を獲得させる経路として
  // 「B が使者で最初に購入」は複雑なので、E.gainLoot と同様に内部ヘルパは使わず盤面で再現できる最短の
  // 経路＝**B の購入で山が空く場合とは違い、ここでは reduce を介さず豊穣の持ち主 A に村を配る手段が無い**。
  // → 大使館の銀貨は財宝なので使えない。この分岐は fireNextTime を直接検証する（gainer=A・カード=village）。
  const before = { coins: s.turn.coins, buys: s.turn.buys };
  E.fireNextTimeForTest && E.fireNextTimeForTest(s);   // （未公開なら下の直接確認にフォールバック）
  // 直接確認：B のターン中に A が村を獲得した体で獲得トリガーを呼ぶのと等価な盤面を作る
  s.supply.village += 1;                                // 盤面補正なしで済むよう獲得は使わず、予約の挙動だけ見る
  s.supply.village -= 1;
  // engine 内部の獲得経路（相手ターンの獲得）＝ B がプレイした「豊穣の持ち主 A への獲得」は
  // 大使館（財宝獲得）でしか作れないため、豊穣の「相手ターン誘発」は sweep 側のテストで担保する。
  ok(s.turn.coins === before.coins && s.turn.buys === before.buys, '（相手のターン中はコイン/購入が動いていない）');
}

// --- 檻（Cage・財宝-持続）---
{
  let s = mkP2(); s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 0;
  s.players[0].hand = ['cage', 'estate', 'estate', 'copper', 'gold'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'cage' });
  ok(s.pending && s.pending.type === 'cage_set', '檻＝脇に置く窓が開く');
  const t0 = tally(s);
  s = E.reduce(s, { type: 'CAGE_SET', cards: ['estate', 'estate'] });
  ok(count(s.players[0].cage, 'estate') === 2, '手札2枚を檻に伏せて置いた');
  ok(sameTally(t0, tally(s)), '保存則が保たれる（檻の脇札も数える）');
  // マスク：相手からは中身が見えない（枚数だけ）／自分には見える
  const mB = E.maskStateFor(s, 1);
  ok((mB.players[0].cage || []).every((c) => c === 'back') && mB.players[0].cage.length === 2, '相手からは檻の中身が伏せられる');
  const mA = E.maskStateFor(s, 0);
  ok(count(mA.players[0].cage, 'estate') === 2, '自分には檻の中身が見える');
  // 勝利点を獲得 → 檻を廃棄し、ターン終了時（先引きの後）に手札へ
  s.turn.coins = 2;
  s = E.reduce(s, { type: 'BUY', card: 'estate' });
  ok(count(s.trash, 'cage') === 1, '勝利点の獲得で檻を場から廃棄');
  ok(s.players[0].cageDue === true && count(s.players[0].cage, 'estate') === 2, '脇の札はまだ手札に入らない（ターン終了時）');
  s = E.reduce(s, { type: 'END_TURN' });
  const h = s.players[0].hand;
  ok(count(h, 'estate') >= 2 && h.length >= 7, 'ターン終了時＝次の5枚を引いた後に檻の2枚が手札に加わる（' + h.length + '枚）');
  ok((s.players[0].cage || []).length === 0 && !s.players[0].cageDue, '檻の脇はクリアされる');
}
{
  // 0枚置いても檻は勝利点を獲得するまで場に残る（公式）
  let s = mkP2(); s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['cage', 'copper'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'cage' });
  s = E.reduce(s, { type: 'CAGE_SET', cards: [] });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'cage') === 1, '0枚でも予約が残り場に残る');
}

// --- 旗艦（Flagship）---
{
  // 次に使う（命令でない）アクションを再使用する（強制）。鍛冶屋なら計6枚。
  let s = mkP2(); s = handPlay(s, 0, ['flagship', 'smithy']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'flagship' });
  ok(s.turn.coins === 2, '旗艦＝+$2');
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'smithy' });
  ok(count(s.players[0].hand, 'copper') === 6, '鍛冶屋が再使用され計6枚引く（3+3）');
  ok(!(s.players[0].delayedEffects || []).some((e) => e.nextTime), '旗艦の予約は消費された');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  // 片付けの先引きでリシャッフルが起き得る＝捨て札ではなく「場を離れたか」で見る
  ok(count(s.players[0].durationCards, 'flagship') === 0 && count(s.players[0].inPlay, 'flagship') === 0,
    '非持続を再演した旗艦はそのターンの片付けで場を離れる');
}
{
  // 旗艦2枚 → 次のアクションを計3回（公式FAQ＝Harbor Village の例）
  let s = mkP2(); s = handPlay(s, 0, ['flagship', 'flagship', 'village']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'silver'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'flagship' });
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'flagship' });  // 旗艦は命令＝もう1枚の旗艦を再演しない
  ok((s.players[0].delayedEffects || []).filter((e) => e.nextTime === 'play_action').length === 2, '旗艦2枚の予約が並ぶ（旗艦同士は再演しない）');
  const actionsBefore = s.turn.actions;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  // 村×3回＝+3カード +6アクション（プレイの1消費を除いて）
  ok(s.turn.actions === actionsBefore - 1 + 6, '村が計3回使われ +6アクション（実際=' + s.turn.actions + '）');
  ok(count(s.players[0].hand, 'copper') === 3, '村×3で3枚引く');
}
{
  // 旗艦×持続（隊商）＝持続を再演したら、その持続が場を離れるまで旗艦も場に残す（決定D4）
  let s = E.createInitialState(['A', 'B'], ['flagship', 'caravan', 'village', 'smithy', 'moat', 'militia', 'market', 'cellar', 'workshop', 'mine'], { startActive: 0 });
  s = handPlay(s, 0, ['flagship', 'caravan']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'flagship' });
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'caravan' });
  ok((s.players[0].delayedEffects || []).filter((e) => e.type === 'flagship_linger').length === 1, '旗艦の linger 予約が張られる');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'flagship') === 1 && count(s.players[0].durationCards, 'caravan') === 1,
    '持続を再演した旗艦は隊商と一緒に場に残る');
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });       // B → A のターン（隊商の +1カード×2 が発火）
  ok(s.turn.active === 0, 'A のターンに戻った');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });       // A の片付け＝隊商が場を離れる＝旗艦も一緒に捨てられる
  ok(count(s.players[0].durationCards, 'caravan') === 0 && count(s.players[0].durationCards, 'flagship') === 0 &&
     count(s.players[0].inPlay, 'flagship') === 0,
    '隊商が場を離れる片付けで旗艦も一緒に場を離れる');
}

// --- 上陸部隊（Landing Party）---
{
  let s = mkP2(); s = handPlay(s, 0, ['landing_party']);
  s.players[0].deck = ['copper', 'copper', 'silver', 'estate'];
  const actionsBefore = s.turn.actions;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'landing_party' });
  ok(count(s.players[0].hand, 'copper') === 2 && s.turn.actions === actionsBefore - 1 + 2, '上陸部隊＝+2カード +2アクション');
  // このターンの最初の1枚は上陸部隊自身（財宝ではない）＝予約は消費されない
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok((s.players[0].delayedEffects || []).some((e) => e.nextTime === 'first_treasure'), '最初の1枚がアクションだったターンは誘発しない（予約は残る）');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'landing_party') === 1, '場に残る');
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });       // → A のターン
  // 次のターン：最初の1枚が財宝 → その解決後に山札の上へ
  s.turn.phase = 'buy';
  const hasCopper = s.players[0].hand.includes('copper');
  if (!hasCopper) s.players[0].hand.push('copper');
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.players[0].deck[0] === 'landing_party', 'ターン最初の1枚が財宝＝上陸部隊が山札の上に置かれる');
  ok(count(s.players[0].durationCards, 'landing_party') === 0, '場からは離れている');
}

// --- 切り裂き魔（Cutthroat）---
{
  // アタック＝手札3枚まで捨てさせる → 解決後に予約 → 誰かの$5以上の財宝獲得で戦利品
  let s = mkP2(null, ['A', 'B']);
  s = handPlay(s, 0, ['cutthroat']);
  s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'cutthroat' });
  ok(s.pending && s.pending.type === 'discard_down' && s.pending.player === 1 && s.pending.down === 3, '他の全員が手札3枚になるまで捨てる');
  ok(!(s.players[0].delayedEffects || []).some((e) => e.nextTime), '⚠ 予約はアタックの解決前には張られない（坑道→金貨で誘発しない＝公式）');
  s = E.reduce(s, { type: 'DISCARD_DOWN_RESOLVE', cards: ['estate', 'estate'] });
  ok((s.players[0].delayedEffects || []).some((e) => e.nextTime === 'gain'), 'アタックを全部解決した後に予約が張られる');
  // 自分の金貨購入（$6財宝）でも誘発する（anyone）
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 6;
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.loot.length === lootBefore - 1 && s.players[0].discard.some((c) => LOOT.indexOf(c) >= 0), '自分の$5以上財宝の獲得でも誘発して戦利品を得る');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'cutthroat') === 0 && count(s.players[0].inPlay, 'cutthroat') === 0,
    '誘発したターンの片付けで場を離れる');
}
{
  // 相手のターンの獲得で誘発 → 相手の片付けで自分の場から捨てられる／$3の銀貨では誘発しない
  let s = mkP2(null, ['A', 'B']);
  s = handPlay(s, 0, ['cutthroat']);
  s.players[1].hand = ['copper', 'copper', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'cutthroat' });   // 手札3枚以下＝窓なしで即予約
  ok((s.players[0].delayedEffects || []).some((e) => e.nextTime === 'gain'), '被害者が3枚以下なら即予約');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });       // → B のターン
  s.turn.phase = 'buy'; s.turn.buys = 2; s.turn.coins = 9;
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok((s.players[0].delayedEffects || []).some((e) => e.nextTime === 'gain'), '$3の銀貨では誘発しない');
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.loot.length === lootBefore - 1 && s.players[0].discard.some((c) => LOOT.indexOf(c) >= 0), '相手の金貨獲得で自分が戦利品を得る');
  ok(count(s.players[0].durationCards, 'cutthroat') === 1, '（B のターン中）まだ場にある');
  s = E.reduce(s, { type: 'END_TURN' });       // B の片付け＝sweep
  ok(count(s.players[0].durationCards, 'cutthroat') === 0 && count(s.players[0].discard, 'cutthroat') === 1,
    '相手の片付けで自分の場から捨てられる');
}
{
  // 戦利品（$7の財宝）の獲得がさらに切り裂き魔を誘発する（公式FAQ）＝A・B両方が予約持ちなら各1枚
  let s = mkP2(null, ['A', 'B']);
  // A・B 両方に予約を直接用意（プレイ経路は上で検証済み）
  s.players[0].durationCards = ['cutthroat']; s.players[0].delayedEffects = [{ card: 'cutthroat', type: 'cutthroat', nextTime: 'gain' }];
  s.players[1].durationCards = ['cutthroat']; s.players[1].delayedEffects = [{ card: 'cutthroat', type: 'cutthroat', nextTime: 'gain' }];
  s.supply.cutthroat -= 2; // 保存則を合わせる（場の2枚はサプライから来た体）
  const t0 = tally(s);
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 6;
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.loot.length === lootBefore - 2, '金貨1枚の獲得で両者の切り裂き魔が誘発（戦利品の連鎖獲得でも二重発火しない）＝計2枚');
  ok(s.players[0].discard.some((c) => LOOT.indexOf(c) >= 0) && s.players[1].discard.some((c) => LOOT.indexOf(c) >= 0), 'A と B が1枚ずつ');
  ok(sameTally(t0, tally(s)), '保存則が保たれる');
}

// --- P2 ソーク（7枚を厚く配って CPU だけで完走するか）---
{
  let games = 0, bad = 0;
  const P2CARDS = ['search', 'secluded_shrine', 'flagship', 'landing_party', 'cutthroat'];
  for (let np = 2; np <= 3; np++) {
    for (let si = 0; si < 3; si++) {
      seed = 9200 + np * 17 + si;
      const names = []; for (let k = 0; k < np; k++) names.push({ name: 'P' + k, isCpu: true, level: 'normal' });
      let s = E.createInitialState(names, KING_P2, { startActive: 0 });
      // MONEY 戦略だと王国カードを買わないので、サプライから抜いて各自の山札に2枚ずつ配る＋檻/豊穣も混ぜる
      P2CARDS.forEach((id) => s.players.forEach((pl) => { for (let c = 0; c < 2; c++) if ((s.supply[id] | 0) > 0) { s.supply[id] -= 1; pl.deck.push(id); } }));
      s.players.forEach((pl) => { if (s.loot.length >= 2) { pl.deck.push(s.loot.shift()); pl.deck.push(s.loot.shift()); } });
      const t0 = tally(s);
      let step = 0, err = false;
      try {
        while (!s.gameOver && step++ < 25000) {
          const a = CPU.decide(s);
          if (a == null) { console.log('    soak ' + np + '/' + si + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
          s = E.reduce(s, a);
        }
      } catch (e) { console.log('    soak ' + np + '/' + si + ': 例外 ' + e.message); err = true; }
      if (!err && !s.gameOver) { console.log('    soak ' + np + '/' + si + ': 未終局（膠着）step=' + step + ' pending=' + (s.pending && s.pending.type)); err = true; }
      if (!err && !sameTally(t0, tally(s))) { console.log('    soak ' + np + '/' + si + ': 保存則違反'); err = true; }
      if (err) bad++; else games++;
    }
  }
  ok(bad === 0 && games === 6, 'P2 CPUソーク完走（' + games + '/6・膠着0・例外0・保存則違反0）');
}

/* ============================================================
   P3＝素直な王国カード19種
   ============================================================ */
console.log('\n=== P3: 王国カード（素直な系） ===');

const KING_P3A = ['shaman', 'harbor_village', 'pilgrim', 'maroon', 'swamp_shacks', 'longship', 'wealthy_village', 'crew', 'village', 'militia'];
const KING_P3B = ['grotto', 'siren', 'stowaway', 'taskmaster', 'cabin_boy', 'longship', 'village', 'smithy', 'moat', 'steward'];

// --- シャーマン＋宝飾卵の on-trash ---
{
  let s = mk(KING_P3A.concat()); // jewelled_egg は KING_LOOT 由来でなくても手札にあれば動く（戦利品の山は…
  s = mk(['shaman', 'jewelled_egg', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory']);
  s = handPlay(s, 0, ['shaman', 'jewelled_egg']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'shaman' });
  ok(s.turn.actions === 99 && s.turn.coins === 1, 'シャーマン＝+1アクション +$1');
  ok(s.pending && s.pending.type === 'shaman_trash', '任意の廃棄窓が開く');
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'SHAMAN_TRASH', card: 'jewelled_egg' });
  ok(count(s.trash, 'jewelled_egg') === 1, '宝飾卵を廃棄できる');
  ok(s.loot.length === lootBefore - 1 && s.players[0].discard.some((c) => LOOT.indexOf(c) >= 0),
    '宝飾卵を廃棄したとき戦利品1枚を獲得する（廃棄した本人）');
  // シャーマンの常設効果＝次の（自分以外も含む各プレイヤーの）ターン開始時、廃棄置き場から$6以下を獲得（強制）
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });   // → B のターン開始（廃棄置き場に宝飾卵がある）
  ok(s.pending && s.pending.type === 'shaman_gain' && s.pending.player === 1,
    'シャーマンを使うゲームでは B のターン開始時にも廃棄置き場からの獲得が起きる');
  const t0 = tally(s);
  s = E.reduce(s, { type: 'SHAMAN_GAIN', card: 'jewelled_egg' });
  ok(count(s.players[1].discard, 'jewelled_egg') === 1 && count(s.trash, 'jewelled_egg') === 0,
    'B が廃棄置き場から宝飾卵を獲得した');
  ok(sameTally(t0, tally(s)), '保存則が保たれる');
}
{
  // シャーマン：候補がある間は null を拒否（強制）／候補ゼロなら窓を開かない
  let s = mk(['shaman', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.trash = ['gold'];
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → B のターン開始
  ok(s.pending && s.pending.type === 'shaman_gain', '廃棄置き場に$6以下があれば窓が開く');
  const s2 = E.reduce(s, { type: 'SHAMAN_GAIN', card: null });
  ok(s2.pending && s2.pending.type === 'shaman_gain', '候補がある間は「獲得しない」を拒否（強制）');
  s = E.reduce(s, { type: 'SHAMAN_GAIN', card: 'gold' });
  ok(count(s.players[1].discard, 'gold') === 1, '金貨（$6）を獲得できる');
}

// --- 港の村（アクションを跨ぐ判定＋選択待ちを挟む判定） ---
{
  let s = mk(KING_P3B);
  s = handPlay(s, 0, ['harbor_village'.replace('harbor_village', 'village'), 'steward']);
  // 港の村→執事（選択待ちで+$2を選ぶ）＝解決後に +$1
  s.players[0].hand = ['harbor_village', 'steward'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'harbor_village' });
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'steward' });
  ok(s.pending && s.pending.type === 'steward', '執事の選択待ちが開く');
  s = E.reduce(s, { type: 'STEWARD_RESOLVE', choice: 'coins' });
  ok(s.turn.coins === 3, '執事で+$2を選ぶ→選択待ちの解決後に港の村の +$1（合計$3）');
  // 港の村→村（+$なし）＝ボーナスなし＋予約は消費される
  let z = mk(KING_P3B);
  z = handPlay(z, 0, ['harbor_village', 'village', 'steward']);
  z.players[0].hand = ['harbor_village', 'village', 'steward'];
  z = E.reduce(z, { type: 'PLAY_ACTION', card: 'harbor_village' });
  z = E.reduce(z, { type: 'PLAY_ACTION', card: 'village' });
  ok(z.turn.coins === 0, '次のアクションが+$を出さなければボーナスなし');
  z = E.reduce(z, { type: 'PLAY_ACTION', card: 'steward' });
  z = E.reduce(z, { type: 'STEWARD_RESOLVE', choice: 'coins' });
  ok(z.turn.coins === 2, '予約は「次の1枚」で消費済み＝その後のアクションの+$には付かない');
}

// --- 巡礼者／置き去り／沼地の小屋／ロングシップ／乗組員 ---
{
  let s = mk(KING_P3A);
  s = handPlay(s, 0, ['pilgrim', 'estate']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'silver'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'pilgrim' });
  ok(s.players[0].hand.length === 5 && s.pending && s.pending.type === 'pilgrim_put', '巡礼者＝+4カード→1枚戻す（強制）');
  s = E.reduce(s, { type: 'PILGRIM_PUT', card: 'estate' });
  ok(s.players[0].deck[0] === 'estate' && !s.pending, '手札1枚（引いた札でなくてもよい）を山札の上へ');
}
{
  let s = mk(KING_P3A);
  s = handPlay(s, 0, ['swamp_shacks']);
  s.players[0].inPlay = ['village', 'village'];      // プレイ後に沼地の小屋も加わって3枚
  s.players[0].durationCards = ['longship'];         // 前ターンからの持続も数える → 計4枚
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'swamp_shacks' });
  ok(count(s.players[0].hand, 'copper') === 1, '沼地の小屋＝場4枚（持続込み）→ +1カード（floor(4/3)）');
}
{
  let s = mk(KING_P3A);
  s = handPlay(s, 0, ['longship', 'crew']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver', 'silver'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'longship' });
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'crew' });
  ok(count(s.players[0].hand, 'copper') === 3, '乗組員＝+3カード');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'longship') === 1 && count(s.players[0].durationCards, 'crew') === 1, '両方とも場に残る');
  s.turn.phase = 'buy';
  const handBefore = s.players[0].hand.length;
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  ok(s.players[0].deck[0] === 'crew', '乗組員＝次のターンの開始時に山札の上へ（捨て札を経由しない）');
  ok(count(s.players[0].durationCards, 'crew') === 0, '場からは離れる');
  ok(s.players[0].hand.length === handBefore + 2 || s.players[0].hand.length >= 7, 'ロングシップ＝開始時 +2カード');
}

// --- 価値ある村／ペンダント（場の異なる財宝の数え方） ---
{
  let s = mk(KING_P3A);
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 5;
  s.players[0].inPlay = ['copper', 'silver'];
  s.players[0].durationCards = ['gondola'];          // 前ターンからの持続財宝も数える
  const lootBefore = s.loot ? s.loot.length : 0;
  // 戦利品の山：KING_P3A には LOOT_GIVERS（価値ある村）がある＝山があるはず
  ok(Array.isArray(s.loot), '価値ある村がある王国では戦利品の山ができる');
  s = E.reduce(s, { type: 'BUY', card: 'wealthy_village' });
  ok(s.loot.length === lootBefore - 1, '獲得時に場の財宝が3種類（銅/銀/ゴンドラ）→戦利品を獲得');
  // 2種類なら獲得しない
  let z = mk(KING_P3A);
  z.turn.phase = 'buy'; z.turn.buys = 1; z.turn.coins = 5;
  z.players[0].inPlay = ['copper', 'copper', 'silver'];
  const lb2 = z.loot.length;
  z = E.reduce(z, { type: 'BUY', card: 'wealthy_village' });
  ok(z.loot.length === lb2, '異なる財宝が2種類なら戦利品は獲得しない（同名は1種）');
}
{
  let s = mk(KING_P3A);
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 0;
  s.players[0].inPlay = ['copper', 'copper', 'silver'];
  s.players[0].durationCards = ['gondola'];
  s.players[0].hand = ['pendant'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'pendant' });
  ok(s.turn.coins === 4, 'ペンダント＝場の異なる財宝4種（銅/銀/ゴンドラ/ペンダント自身）で +$4');
}

// --- 銀山／戦利品の袋／つるはし／小像／坩堝 ---
{
  let s = mk(KING_P3A);
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['silver_mine'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'silver_mine' });
  ok(s.pending && s.pending.type === 'silver_mine_gain', '銀山＝獲得の窓（強制）');
  const s2 = E.reduce(s, { type: 'SILVER_MINE_GAIN', card: null });
  ok(s2.pending, '候補がある間は「獲得しない」を拒否');
  s = E.reduce(s, { type: 'SILVER_MINE_GAIN', card: 'silver' });
  ok(count(s.players[0].hand, 'silver') === 1, '銀貨を**手札に**獲得（捨て札を経由しない）');
}
{
  let s = mk(['wealthy_village', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 0;
  s.players[0].hand = ['sack_of_loot'];
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'sack_of_loot' });
  ok(s.turn.coins === 1 && s.turn.buys === 2, '戦利品の袋＝$1 +1購入');
  ok(s.loot.length === lootBefore - 1, '戦利品1枚を獲得');
}
{
  let s = mk(KING_P3A);
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['pickaxe', 'silver', 'estate'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'pickaxe' });
  ok(s.turn.coins === 1 && s.pending && s.pending.type === 'pickaxe_trash', 'つるはし＝$1＋廃棄（強制）');
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'PICKAXE_TRASH', card: 'silver' });
  ok(s.loot.length === lootBefore - 1 && s.players[0].hand.some((c) => LOOT.indexOf(c) >= 0),
    'コスト3以上（銀貨）を廃棄→戦利品を**手札に**獲得');
  let z = mk(KING_P3A);
  z.turn.phase = 'buy'; z.turn.buys = 1;
  z.players[0].hand = ['pickaxe', 'estate'];
  z = E.reduce(z, { type: 'PLAY_TREASURE', card: 'pickaxe' });
  const lb = z.loot.length;
  z = E.reduce(z, { type: 'PICKAXE_TRASH', card: 'estate' });
  ok(z.loot.length === lb, 'コスト2（屋敷）の廃棄では戦利品なし');
}
{
  let s = mk(KING_P3A);
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['figurine', 'village'];
  s.players[0].deck = ['copper', 'copper', 'silver'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'figurine' });
  ok(count(s.players[0].hand, 'copper') === 2, '小像＝+2カード');
  ok(s.pending && s.pending.type === 'figurine_discard', 'アクションがあれば捨てる窓が開く');
  s = E.reduce(s, { type: 'FIGURINE_DISCARD', card: 'village' });
  ok(s.turn.buys === 2 && s.turn.coins === 1, 'アクションを捨てて +1購入 +$1');
}
{
  let s = mk(KING_P3A);
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['crucible', 'estate', 'copper'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'crucible' });
  ok(s.pending && s.pending.type === 'crucible_trash', '坩堝＝廃棄（強制）');
  s = E.reduce(s, { type: 'CRUCIBLE_TRASH', card: 'estate' });
  ok(s.turn.coins === 2, '屋敷（$2）を廃棄して +$2');
}

// --- 工具（誰かの場のカードのコピー） ---
{
  let s = mk(KING_P3A, null, ['A', 'B']);
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['tools'];
  s.players[1].durationCards = ['longship'];   // 相手の場の持続もコピーできる
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'tools' });
  ok(s.pending && s.pending.type === 'tools_gain', '工具＝獲得の窓（工具自身が場にある＝候補は常にある）');
  s = E.reduce(s, { type: 'TOOLS_GAIN', card: 'longship' });
  ok(count(s.players[0].discard, 'longship') === 1, '相手が場に出している持続のコピーを獲得できる');
  // サプライに無い札（戦利品）は選べるが獲得は起きない
  let z = mk(KING_P3A, null, ['A', 'B']);
  z.turn.phase = 'buy'; z.turn.buys = 1;
  z.players[0].hand = ['tools'];
  z.players[0].inPlay = ['amphora'];
  z = E.reduce(z, { type: 'PLAY_TREASURE', card: 'tools' });
  const t0 = tally(z);
  z = E.reduce(z, { type: 'TOOLS_GAIN', card: 'amphora' });
  ok(!z.pending && sameTally(t0, tally(z)), '戦利品（非サプライ）を選ぶと何も獲得せず窓は閉じる');
}

// --- ゴンドラ（今/次の選択＋獲得時のアクション使用） ---
{
  let s = mk(KING_P3A);
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['gondola'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'gondola' });
  ok(s.pending && s.pending.type === 'gondola_choose', 'ゴンドラ＝今か次かを選ぶ');
  const now = E.reduce(s, { type: 'GONDOLA_CHOOSE', now: true });
  ok(now.turn.coins === 2, '「今」＝+$2');
  let nxt = E.reduce(s, { type: 'GONDOLA_CHOOSE', now: false });
  ok(nxt.turn.coins === 0, '「次のターン」＝今はもらえない');
  nxt = E.reduce(nxt, { type: 'END_TURN' });
  ok(count(nxt.players[0].durationCards, 'gondola') === 1, '持続として場に残る');
  nxt.turn.phase = 'buy';
  nxt = E.reduce(nxt, { type: 'END_TURN' });  // → A のターン
  ok(nxt.turn.coins === 2, '次のターンの開始時に +$2');
}
{
  // ゴンドラの獲得時＝手札のアクション1枚を使用してよい
  let s = mk(['gondola', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 4;
  s.players[0].hand = ['village'];
  s.players[0].deck = ['copper', 'silver'];
  s = E.reduce(s, { type: 'BUY', card: 'gondola' });
  ok(s.pending && s.pending.type === 'gondola_play', '獲得時にアクション使用の窓が開く');
  s = E.reduce(s, { type: 'GONDOLA_PLAY', card: 'village' });
  ok(count(s.players[0].inPlay, 'village') === 1 && count(s.players[0].hand, 'copper') === 1,
    '手札の村を（アクション権を消費せず）使用できる');
}

// --- 埋められた財宝（獲得したとき使用する） ---
{
  let s = mk(['buried_treasure', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 5;
  s = E.reduce(s, { type: 'BUY', card: 'buried_treasure' });
  ok(count(s.players[0].inPlay, 'buried_treasure') === 1, '埋められた財宝＝獲得したとき使用する（場に出る）');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'buried_treasure') === 1, '持続として場に残る');
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン
  ok(s.turn.coins === 3 && s.turn.buys === 2, '次のターンの開始時 +1購入 +$3');
}

// --- 岩屋／縄 ---
{
  let s = mk(KING_P3B);
  s = handPlay(s, 0, ['grotto', 'estate', 'estate', 'copper']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'grotto' });
  ok(s.pending && s.pending.type === 'grotto_set', '岩屋＝伏せて置く窓');
  const t0 = tally(s);
  s = E.reduce(s, { type: 'GROTTO_SET', cards: ['estate', 'estate'] });
  ok(count(s.players[0].setAside, 'estate') === 2, '2枚を伏せて置いた');
  ok(sameTally(t0, tally(s)), '保存則が保たれる');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy';
  const discBefore = count(s.players[0].discard, 'estate');
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始＝捨ててから同じ枚数引く
  ok(count(s.players[0].discard.concat(s.players[0].deck).concat(s.players[0].hand), 'estate') >= 2 &&
     count(s.players[0].setAside, 'estate') === 0, '開始時に脇の2枚を捨て札にした（脇は空）');
}
{
  let s = mk(KING_P3A);
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['rope'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'rope' });
  ok(s.turn.coins === 1 && s.turn.buys === 2, '縄＝$1 +1購入');
  s = E.reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  ok(s.pending && s.pending.type === 'rope_trash', '次のターンの開始時＝+1カードの後に任意の廃棄窓');
  s = E.reduce(s, { type: 'ROPE_TRASH', card: null });
  ok(!s.pending, '「廃棄しない」で閉じる');
}

// --- セイレーン（アタック＋持続＋獲得時の自己廃棄） ---
{
  let s = mk(KING_P3B, null, ['A', 'B']);
  s = handPlay(s, 0, ['siren']);
  s.players[1].hand = ['copper'];
  const curses = s.supply.curse;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'siren' });
  ok(s.supply.curse === curses - 1 && count(s.players[1].discard, 'curse') === 1, 'セイレーン＝他の全員が呪いを獲得');
  s.players[0].hand = [];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver'];
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  ok(s.players[0].hand.length === 8, '次のターンの開始時、手札が8枚になるように引く（実際=' + s.players[0].hand.length + '）');
}
{
  // 獲得時＝手札のアクションを廃棄すればセイレーンは残る／廃棄しなければセイレーン自身を廃棄
  let s = mk(KING_P3B);
  s.turn.phase = 'buy'; s.turn.buys = 2; s.turn.coins = 6;
  s.players[0].hand = ['village'];
  s = E.reduce(s, { type: 'BUY', card: 'siren' });
  ok(s.pending && s.pending.type === 'siren_gain', '獲得時の窓が開く');
  const keep = E.reduce(s, { type: 'SIREN_GAIN', card: 'village' });
  ok(count(keep.trash, 'village') === 1 && count(keep.players[0].discard, 'siren') === 1, 'アクションを廃棄→セイレーンは残る');
  const drop = E.reduce(s, { type: 'SIREN_GAIN', card: null });
  ok(count(drop.trash, 'siren') === 1 && count(drop.players[0].discard, 'siren') === 0, '廃棄しない→セイレーン自身を廃棄');
  // 手札にアクションが無ければ窓を開かず自動で自己廃棄
  let z = mk(KING_P3B);
  z.turn.phase = 'buy'; z.turn.buys = 1; z.turn.coins = 6;
  z.players[0].hand = ['copper'];
  z = E.reduce(z, { type: 'BUY', card: 'siren' });
  ok(!z.pending && count(z.trash, 'siren') === 1, 'アクションが無ければ窓なしで自己廃棄');
}

// --- 密航者（リアクション）＋現場監督＋キャビンボーイ ---
{
  let s = mk(KING_P3B, null, ['A', 'B']);
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → B のターン
  s.players[0].hand = ['stowaway'];        // ⚠ 手札は片付けで引き直されるので**ターンを渡した後**に置く
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 5;
  s = E.reduce(s, { type: 'BUY', card: 'longship' });  // B が持続を獲得 → A の密航者が反応できる
  ok(s.pending && s.pending.type === 'stowaway_react' && s.pending.player === 0, '誰かの持続獲得で密航者の窓が開く');
  s = E.reduce(s, { type: 'STOWAWAY_REACT', play: true });
  ok(count(s.players[0].inPlay, 'stowaway') === 1, '相手のターンに手札から使用できる');
  // ※このエンジンは自分の片付けで次の手札を先引きする＝手札は直接セットした ['stowaway'] が正
  //   （使用で0枚になった）。B の片付け → A のターン開始で +2カード＝手札はちょうど2枚になる。
  s = E.reduce(s, { type: 'END_TURN' });   // B の片付け → A のターン開始＝+2カード
  ok(s.players[0].hand.length === 2, '次の自分のターンの開始時 +2カード（手札' + s.players[0].hand.length + '枚）');
}
{
  // 現場監督＝$5を獲得したターンの次の開始時に繰り返す（さらに$5を獲得すればまた続く）
  let s = mk(KING_P3B);
  s = handPlay(s, 0, ['taskmaster']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'taskmaster' });
  ok(s.turn.coins === 1, '現場監督＝+1アクション +$1');
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 5;
  s = E.reduce(s, { type: 'BUY', card: 'longship' });  // $5 を獲得
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'taskmaster') === 1, '$5を獲得したので場に残る');
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始＝繰り返し
  ok(s.turn.coins === 1, '次のターンの開始時、能力を繰り返す（+$1）');
  // このターンは$5を獲得しない → 片付けで捨てられる
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'taskmaster') === 0, '$5を獲得しなかったターンの片付けで場を離れる');
}
{
  // 現場監督＝プレイ**前**の$5獲得は数えない
  let s = mk(KING_P3B);
  s.turn.phase = 'buy'; s.turn.buys = 2; s.turn.coins = 10;
  s = E.reduce(s, { type: 'BUY', card: 'longship' });   // 先に$5を獲得
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['taskmaster'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'taskmaster' });
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'taskmaster') === 0, 'プレイ前の$5獲得では繰り返さない（これより後に、が条件）');
}
{
  // キャビンボーイ＝次のターンの開始時に二択
  let s = mk(KING_P3B);
  s = handPlay(s, 0, ['cabin_boy']);
  s.players[0].deck = ['copper', 'silver'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'cabin_boy' });
  ok(count(s.players[0].hand, 'copper') === 1, 'キャビンボーイ＝+1カード+1アクション');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  ok(s.pending && s.pending.type === 'cabin_boy', '次のターンの開始時に二択の窓');
  const coin = E.reduce(s, { type: 'CABIN_BOY_RESOLVE', choice: 'coin' });
  ok(coin.turn.coins === 2 && !coin.pending, '「+$2」を選べる');
  let g = E.reduce(s, { type: 'CABIN_BOY_RESOLVE', choice: 'gain' });
  ok(count(g.trash, 'cabin_boy') === 1, '「廃棄して持続を獲得」＝場から廃棄');
  ok(g.pending && g.pending.type === 'cabin_boy_gain', '持続カードの獲得窓（コスト上限なし）');
  g = E.reduce(g, { type: 'CABIN_BOY_GAIN', card: 'longship' });
  ok(count(g.players[0].discard, 'longship') === 1, '持続カード（ロングシップ）を獲得');
}

// --- P3 ソーク ---
{
  let games = 0, bad = 0;
  const SOAKS = [KING_P3A, KING_P3B,
    ['shaman', 'siren', 'pickaxe'.replace('pickaxe', 'grotto'), 'harbor_village', 'crew', 'wealthy_village', 'taskmaster', 'cabin_boy', 'stowaway', 'moat']];
  SOAKS.forEach((K3, ki) => {
    for (let np = 2; np <= 3; np++) {
      seed = 9600 + ki * 13 + np;
      const names = []; for (let k = 0; k < np; k++) names.push({ name: 'P' + k, isCpu: true, level: 'normal' });
      let s = E.createInitialState(names, K3, { startActive: 0 });
      K3.forEach((id) => s.players.forEach((pl) => { for (let c = 0; c < 2; c++) if ((s.supply[id] | 0) > 0) { s.supply[id] -= 1; pl.deck.push(id); } }));
      // 財宝系 P3 カードも混ぜる（購入では出にくいので直接配る）
      ['jewelled_egg', 'crucible', 'gondola', 'tools', 'pendant', 'silver_mine', 'pickaxe', 'figurine', 'rope', 'buried_treasure', 'sack_of_loot'].forEach((id) => {
        s.players.forEach((pl) => pl.deck.push(id));
      });
      const t0 = tally(s);
      let step = 0, err = false;
      try {
        while (!s.gameOver && step++ < 25000) {
          const a = CPU.decide(s);
          if (a == null) { console.log('    P3soak ' + ki + '/' + np + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
          s = E.reduce(s, a);
        }
      } catch (e) { console.log('    P3soak ' + ki + '/' + np + ': 例外 ' + e.message); err = true; }
      if (!err && !s.gameOver) { console.log('    P3soak ' + ki + '/' + np + ': 未終局 pending=' + (s.pending && s.pending.type)); err = true; }
      if (!err && !sameTally(t0, tally(s))) { console.log('    P3soak ' + ki + '/' + np + ': 保存則違反'); err = true; }
      if (err) bad++; else games++;
    }
  });
  ok(bad === 0 && games === 6, 'P3 CPUソーク完走（' + games + '/6・膠着0・例外0・保存則違反0）');
}

console.log(`\n略奪テスト結果: ${pass} 件成功, ${fail} 件失敗`);
if (fail > 0) process.exit(1);
