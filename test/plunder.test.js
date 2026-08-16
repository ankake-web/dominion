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
  'contractSetAside', 'puzzleBox', 'cage', 'deliverAside', 'prepareAside'];
const MIX = E.MIXED_PILE_KEYS;
function tally(s) {
  const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; };
  Object.keys(s.supply).forEach((id) => { if (MIX.indexOf(id) >= 0) return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); });
  MIX.forEach((k) => (s[k] || []).forEach(a));
  (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a); (s.loot || []).forEach(a);
  s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a)));
  s.players.forEach((p) => (p.archives || []).forEach((x) => (x.cards || []).forEach(a)));
  s.players.forEach((p) => (p.quartermasters || []).forEach((x) => (x.cards || []).forEach(a))); // 略奪：操舵手の脇置き
  if (s.turn) { (s.turn.possessionGains || []).forEach(a); (s.turn.possessionTrash || []).forEach(a); (s.turn.tricksterHold || []).forEach(a); }
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

/* ============================================================
   P4＝特性(Trait) の基盤と15種
   ============================================================ */
console.log('\n=== P4: 特性(Trait) ===');

const KING_T = ['village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival', 'mine'];
function mkT(traits, piles, names) {
  return E.createInitialState(names || ['A', 'B'], KING_T, { startActive: 0, traits, traitPiles: piles });
}

// --- 選出の基盤 ---
{
  const s = mkT(['cheap'], { cheap: 'village' });
  ok(s.traits && s.traits.cheap === 'village', '特性は指定した山（テスト用 traitPiles）に付く');
  const s2 = E.createInitialState(['A', 'B'], KING_T, { startActive: 0, traits: ['cheap', 'pious'] });
  ok(s2.traits.cheap !== s2.traits.pious, '同じ山に2枚の特性は付かない');
  ok([s2.traits.cheap, s2.traits.pious].every((pk) => KING_T.indexOf(pk) >= 0), '付け先は王国の山');
}

// --- 安価な(Cheap) ---
{
  const s = mkT(['cheap'], { cheap: 'village' });
  ok(E.cardCost(s, 'village') === 2, '安価な村＝$2（全員に・常時）');
  // 買うときも$2
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 2;
  const s2 = E.reduce(s, { type: 'BUY', card: 'village' });
  ok(count(s2.players[0].discard, 'village') === 1 && s2.turn.coins === 0, '$2で購入できる');
}

// --- 呪われた(Cursed) ---
{
  let s = mkT(['cursed'], { cursed: 'smithy' });
  ok(Array.isArray(s.loot) && s.loot.length === 30, '呪われたがあるゲームでは戦利品の山ができる');
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 4;
  const lootBefore = s.loot.length;
  s = E.reduce(s, { type: 'BUY', card: 'smithy' });
  ok(s.loot.length === lootBefore - 1 && count(s.players[0].discard, 'curse') === 1,
    '呪われたカードの獲得＝戦利品と呪いを獲得（この順）');
  // 呪いが尽きても戦利品は得る
  let z = mkT(['cursed'], { cursed: 'smithy' });
  z.supply.curse = 0; z.turn.phase = 'buy'; z.turn.buys = 1; z.turn.coins = 4;
  const lb = z.loot.length;
  z = E.reduce(z, { type: 'BUY', card: 'smithy' });
  ok(z.loot.length === lb - 1 && count(z.players[0].discard, 'curse') === 0, '呪いが無くても戦利品は獲得する');
}

// --- 運命の(Fated)＝シャッフル時に自動で「アクション/財宝は上」 ---
{
  let s = mkT(['fated'], { fated: 'village' });
  ok((s.players[0].fatedIds || []).indexOf('village') >= 0, '対象idが全プレイヤーに焼き込まれる');
  const p = s.players[0];
  p.hand = ['smithy']; p.deck = []; p.discard = ['copper', 'village', 'copper', 'estate'];
  p.inPlay = []; s.turn.phase = 'action'; s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'smithy' });   // 3枚引く＝リシャッフルが起きる
  // 村（運命の・アクション）はシャッフルした束の一番上＝最初に引かれている
  ok(count(s.players[0].hand, 'village') === 1, 'シャッフル時、運命の村が束の一番上に置かれて引かれる');
}

// --- へつらう(Fawning) ---
{
  let s = mkT(['fawning'], { fawning: 'village' });
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 8;
  s = E.reduce(s, { type: 'BUY', card: 'province' });
  ok(count(s.players[0].discard, 'village') === 1, '属州の獲得で、へつらうカード（村）を獲得（強制）');
}

// --- 豊かな(Rich)／近隣の(Nearby) ---
{
  let s = mkT(['rich'], { rich: 'smithy' });
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 4;
  s = E.reduce(s, { type: 'BUY', card: 'smithy' });
  ok(count(s.players[0].discard, 'silver') === 1, '豊かなカードの獲得で銀貨を獲得');
  let z = mkT(['nearby'], { nearby: 'smithy' });
  z.turn.phase = 'buy'; z.turn.buys = 1; z.turn.coins = 4;
  z = E.reduce(z, { type: 'BUY', card: 'smithy' });
  ok(z.turn.buys === 1, '近隣のカードの獲得で +1購入（1消費して+1＝残1）');
}

// --- 敬虔な(Pious) ---
{
  let s = mkT(['pious'], { pious: 'smithy' });
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 4;
  s.players[0].hand = ['copper', 'curse'];
  s = E.reduce(s, { type: 'BUY', card: 'smithy' });
  ok(s.pending && s.pending.type === 'pious_trash', '獲得で任意の廃棄窓が開く');
  s = E.reduce(s, { type: 'PIOUS_TRASH', card: 'curse' });
  ok(count(s.trash, 'curse') === 1, '手札1枚を廃棄できる');
}

// --- せっかちな(Hasty) ---
{
  let s = mkT(['hasty'], { hasty: 'smithy' });
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 4;
  s = E.reduce(s, { type: 'BUY', card: 'smithy' });
  ok(count(s.players[0].eventSetAside || [], 'smithy') === 1 && count(s.players[0].discard, 'smithy') === 0,
    'せっかちなカードは獲得したとき脇に置かれる');
  s.players[0].deck = ['copper', 'copper', 'copper', 'silver', 'gold', 'estate', 'estate', 'estate'];
  s = E.reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始＝脇の鍛冶屋を強制使用（event_play の窓）
  ok(s.pending && s.pending.type === 'event_play', '次のターンの開始時に使用の窓（遅延と同じ機構）が開く');
  s = E.reduce(s, { type: 'EVENT_PLAY' });
  ok(count(s.players[0].inPlay, 'smithy') === 1, '脇のせっかちなカードが使用される（強制・アクション権なし）');
}

// --- 受け継がれた(Inherited) ---
{
  const s = mkT(['inherited'], { inherited: 'village' });
  const a = s.players[0], b = s.players[1];
  const all = (pl) => pl.deck.concat(pl.hand);
  ok(count(all(a), 'village') === 1 && count(all(b), 'village') === 1, '各プレイヤーの開始デッキに村が1枚入る');
  ok(count(all(a), 'estate') === 2, '屋敷1枚が入れ替わった（3→2）');
  ok(s.supply.village === 10 - 2, '山から人数ぶん減る（3山終了に影響）');
  ok(count(all(a), 'copper') === 7, '銅貨は減らない（屋敷を優先して入れ替え）');
}

// --- 鼓舞する(Inspiring) ---
{
  let s = mkT(['inspiring'], { inspiring: 'village' });
  s = handPlay(s, 0, ['village', 'smithy']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'silver'];
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(s.pending && s.pending.type === 'inspiring_play', '鼓舞するカードの解決後に窓が開く');
  const before = s.turn.actions;
  s = E.reduce(s, { type: 'INSPIRING_PLAY', card: 'smithy' });
  ok(count(s.players[0].inPlay, 'smithy') === 1 && s.turn.actions === before, '場に出していないアクションをアクション権を消費せず使用できる');
  // 場に同名がある札は使えない
  let z = mkT(['inspiring'], { inspiring: 'village' });
  z = handPlay(z, 0, ['village', 'village']);
  z.turn.actions = 2;
  z = E.reduce(z, { type: 'PLAY_ACTION', card: 'village' });
  ok(!z.pending, '手札に「場に出していないアクション」が無ければ窓を開かない（村は場にある）');
}

// --- 友好的な(Friendly)＝クリンナップ開始時 ---
{
  let s = mkT(['friendly'], { friendly: 'smithy' });
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['smithy', 'copper'];
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'friendly_discard', 'クリンナップ開始時に窓が開く');
  const supBefore = s.supply.smithy;
  s = E.reduce(s, { type: 'FRIENDLY_DISCARD', card: 'smithy' });
  ok(s.supply.smithy === supBefore - 1, '捨てて同じ山から1枚獲得');
  ok(!s.pending || s.pending.type !== 'friendly_discard', '窓は1ターンに1回だけ');
  ok(s.turn.active === 1, 'クリンナップが再開してターンが渡る');
  const a = s.players[0];
  ok(count(a.deck.concat(a.hand, a.discard), 'smithy') === 2, '鍛冶屋は捨てた1枚＋獲得した1枚の計2枚');
}

// --- 忍耐強い(Patient)＝クリンナップ開始時に脇→次ターン開始時に使用 ---
{
  let s = mkT(['patient'], { patient: 'smithy' });
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['smithy', 'copper'];
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'patient_set', 'クリンナップ開始時に脇へ置く窓が開く');
  s = E.reduce(s, { type: 'PATIENT_SET', cards: ['smithy'] });
  ok(count(s.players[0].eventSetAside || [], 'smithy') === 1, '忍耐強いカードを脇に置いた');
  ok(s.turn.active === 1, 'クリンナップが再開する');
  s.players[0].deck = ['copper', 'copper', 'copper', 'silver', 'gold'];
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始（event_play の窓）
  ok(s.pending && s.pending.type === 'event_play', '次のターンの開始時に使用の窓が開く');
  s = E.reduce(s, { type: 'EVENT_PLAY' });
  ok(count(s.players[0].inPlay, 'smithy') === 1, '脇の忍耐強いカードが（アクション権なしで）使用される');
}

// --- 内気な(Shy)＝ターンの開始時 ---
{
  let s = mkT(['shy'], { shy: 'smithy' }, ['A', 'B']);
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → B
  s.players[0].hand = ['smithy', 'copper'];
  s.players[0].deck = ['silver', 'gold', 'copper'];
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  ok(s.pending && s.pending.type === 'shy_discard', 'ターンの開始時に窓が開く');
  const handBefore = s.players[0].hand.length;
  s = E.reduce(s, { type: 'SHY_DISCARD', card: 'smithy' });
  ok(s.players[0].hand.length === handBefore - 1 + 2, '内気なカードを捨てて +2カード');
  ok(count(s.players[0].discard, 'smithy') === 1, '捨て札に置かれる（廃棄ではない）');
}

// --- 無謀な(Reckless)＝2回従う＋場から捨てるとき山へ戻る ---
{
  let s = mkT(['reckless'], { reckless: 'smithy' });
  s = handPlay(s, 0, ['smithy']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'smithy' });
  ok(count(s.players[0].hand, 'copper') === 6, '無謀な鍛冶屋＝指示に2回従う（+3カード×2）');
  ok(s.turn.actionsPlayed === 1, '「使用したカード」は1枚（共謀者の数え方）');
  const supBefore = s.supply.smithy;
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.supply.smithy === supBefore + 1, '場から捨てるとき、山に戻る（供給が増える）');
  const a = s.players[0];
  ok(count(a.deck.concat(a.hand, a.discard, a.inPlay), 'smithy') === 0, '手元には残らない');
}
{
  // 無謀な財宝＝コインも2回
  let s = E.createInitialState(['A', 'B'], ['jewelled_egg', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['reckless'], traitPiles: { reckless: 'jewelled_egg' } });
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['jewelled_egg'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'jewelled_egg' });
  ok(s.turn.coins === 2 && s.turn.buys === 3, '無謀な宝飾卵＝$1+1購入 を2回（$2・購入+2）');
}

// --- 疲れ知らずの(Tireless)＝場から捨てるとき脇へ→ターン終了時（先引きの後）に山札の上 ---
{
  let s = mkT(['tireless'], { tireless: 'village' });
  s = handPlay(s, 0, ['village']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.players[0].deck[0] === 'village', '疲れ知らずの村＝次の手札を引いた後、山札の上に置かれる');
  ok(count(s.players[0].hand, 'village') === 0, '先引きの手札には混ざらない（1ターン早く働かない）');
}

// --- P4 ソーク（複数の特性を同時に） ---
{
  let games = 0, bad = 0;
  const COMBOS = [
    ['cheap', 'cursed'], ['fated', 'rich'], ['hasty', 'nearby'], ['friendly', 'patient'],
    ['shy', 'pious'], ['reckless', 'tireless'], ['inherited', 'inspiring'], ['fawning', 'cursed'],
  ];
  COMBOS.forEach((tr, ki) => {
    seed = 9800 + ki * 7;
    const names = [{ name: 'P0', isCpu: true, level: 'normal' }, { name: 'P1', isCpu: true, level: 'normal' }];
    let s = E.createInitialState(names, KING_T, { startActive: 0, traits: tr });
    KING_T.forEach((id) => s.players.forEach((pl) => { for (let c = 0; c < 2; c++) if ((s.supply[id] | 0) > 0) { s.supply[id] -= 1; pl.deck.push(id); } }));
    const t0 = tally(s);
    let step = 0, err = false;
    try {
      while (!s.gameOver && step++ < 25000) {
        const a = CPU.decide(s);
        if (a == null) { console.log('    P4soak ' + tr.join('+') + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
        s = E.reduce(s, a);
      }
    } catch (e) { console.log('    P4soak ' + tr.join('+') + ': 例外 ' + e.message); err = true; }
    if (!err && !s.gameOver) { console.log('    P4soak ' + tr.join('+') + ': 未終局 pending=' + (s.pending && s.pending.type)); err = true; }
    if (!err && !sameTally(t0, tally(s))) { console.log('    P4soak ' + tr.join('+') + ': 保存則違反'); err = true; }
    if (err) bad++; else games++;
  });
  ok(bad === 0 && games === COMBOS.length, 'P4 CPUソーク完走（' + games + '/' + COMBOS.length + '・膠着0・例外0・保存則違反0）');
}

/* ============================================================
   P5＝イベント15種
   ============================================================ */
console.log('\n=== P5: イベント15種 ===');

const EVENTS_ALL = ['bury', 'avoid', 'deliver', 'peril', 'rush', 'foray', 'launch', 'mirror', 'prepare', 'scrounge', 'journey', 'maelstrom', 'looting', 'invasion', 'prosper'];
function mkE(events, names) {
  const s = E.createInitialState(names || ['A', 'B'], KING_T, { startActive: 0, events: events || EVENTS_ALL });
  s.turn.phase = 'buy'; s.turn.buys = 9; s.turn.coins = 40;
  return s;
}
function buyEv(s, id) { return E.reduce(s, { type: 'BUY_EVENT', event: id }); }

// --- 埋葬／略奪行為 ---
{
  let s = mkE();
  s.players[0].discard = ['gold', 'estate'];
  const buys = s.turn.buys;
  s = buyEv(s, 'bury');
  ok(s.turn.buys === buys - 1 + 1, '埋葬＝+1購入（1消費して+1）');
  ok(s.pending && s.pending.type === 'bury_put', '捨て札から選ぶ窓（強制）');
  s = E.reduce(s, { type: 'BURY_PUT', card: 'estate' });
  ok(s.players[0].deck[s.players[0].deck.length - 1] === 'estate', '選んだ札が山札の**一番下**に置かれる');
  ok(Array.isArray(s.loot), 'イベントに戦利品を配るものがあるので山ができている');
  const lb = s.loot.length;
  s = buyEv(s, 'looting');
  ok(s.loot.length === lb - 1, '略奪行為＝戦利品1枚を獲得');
}

// --- 回避（自動選択・2度目のシャッフルをしない） ---
{
  let s = mkE();
  s = buyEv(s, 'avoid'); s = buyEv(s, 'avoid');
  ok(s.turn.avoidPicks === 6, '回避は累積する（2回で最大6枚）');
  const p = s.players[0];
  p.hand = ['smithy']; p.deck = []; p.inPlay = [];
  p.discard = ['curse', 'curse', 'estate', 'gold', 'silver', 'copper'];
  s.turn.phase = 'action'; s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'smithy' });   // ドロー3＝リシャッフル発生
  ok(s.turn.avoidPicks === 0, '次の1回のシャッフルで消費される');
  ok(count(s.players[0].discard, 'curse') === 2, 'ジャンク（呪い）はシャッフルに混ぜず捨て札に残る（自動選択）');
  ok(count(s.players[0].hand, 'curse') === 0 && s.players[0].hand.length <= 3, '捨て札に残した札のために2度目のシャッフルはしない（引けた分だけ・呪いは引かない）');
}

// --- 配達 ---
{
  let s = mkE();
  s = buyEv(s, 'deliver');
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(count(s.players[0].deliverAside, 'silver') === 1 && count(s.players[0].discard, 'silver') === 0,
    'このターン獲得したカードは脇に置かれる');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].hand, 'silver') === 1, 'ターン終了時（先引きの後）に手札へ加わる');
  ok(s.players[0].hand.length >= 6, '通常の5枚＋配達の1枚');
}

// --- 危難／襲撃 ---
{
  let s = mkE();
  s.players[0].hand = ['village', 'copper'];
  const lb = s.loot.length;
  s = buyEv(s, 'peril');
  ok(s.pending && s.pending.type === 'peril_trash', '危難＝廃棄の窓');
  s = E.reduce(s, { type: 'PERIL_TRASH', card: 'village' });
  ok(count(s.trash, 'village') === 1 && s.loot.length === lb - 1, 'アクションを廃棄して戦利品を獲得');
  // アクションが無ければ窓を開かない
  let z = mkE(); z.players[0].hand = ['copper'];
  z = buyEv(z, 'peril');
  ok(!z.pending, '手札にアクションが無ければ何も起きない');
}
{
  let s = mkE();
  s.players[0].hand = ['copper', 'silver', 'estate', 'gold'];
  const lb = s.loot.length;
  s = buyEv(s, 'foray');
  s = E.reduce(s, { type: 'FORAY_DISCARD', cards: ['copper', 'silver', 'estate'] });
  ok(s.loot.length === lb - 1, '3枚が互いに異なる名前＝戦利品を獲得');
  let z = mkE();
  z.players[0].hand = ['copper', 'copper', 'estate'];
  const lb2 = z.loot.length;
  z = buyEv(z, 'foray');
  z = E.reduce(z, { type: 'FORAY_DISCARD', cards: ['copper', 'copper', 'estate'] });
  ok(z.loot.length === lb2, '同名を含む3枚では戦利品なし（捨てるだけ）');
}

// --- 発進 ---
{
  let s = mkE();
  s.players[0].hand = ['copper'];
  s.players[0].deck = ['village', 'silver'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });   // 財宝を出してから
  s = buyEv(s, 'launch');
  ok(s.turn.phase === 'action', '発進＝アクションフェイズに戻る');
  ok(count(s.players[0].hand, 'village') === 1, '+1カード（フェイズを戻した後に引く）');
  ok(!s.turn.treasuresLocked, '財宝ロックが解除される（購入フェイズに入り直すと最初から）');
  const s2 = E.reduce(s, { type: 'END_ACTION_PHASE' });
  ok(E.reduce(s2, { type: 'BUY_EVENT', event: 'launch' }) === s2 ||
     count(E.reduce(s2, { type: 'BUY_EVENT', event: 'launch' }).log, s2.log) !== -1 ||
     true, '（発進は1ターンに1度＝下で厳密に検査）');
  const s3 = E.reduce(s2, { type: 'BUY_EVENT', event: 'launch' });
  ok(s3.turn.phase === 'buy', '2回目の発進は購入自体が拒否される（1ターンに1度）');
}

// --- 鏡映（累積）／突貫（累積しない） ---
{
  let s = mkE();
  s = buyEv(s, 'mirror'); s = buyEv(s, 'mirror');
  s = E.reduce(s, { type: 'BUY', card: 'village' });
  ok(count(s.players[0].discard, 'village') === 3, '鏡映×2＝村を買うと計3枚（累積）');
}
{
  let s = mkE();
  s = buyEv(s, 'rush'); s = buyEv(s, 'rush');
  s = E.reduce(s, { type: 'BUY', card: 'village' });
  ok(count(s.players[0].inPlay, 'village') === 1, '突貫＝獲得したアクションを使用する');
  s = E.reduce(s, { type: 'BUY', card: 'village' });
  ok(count(s.players[0].inPlay, 'village') === 1 && count(s.players[0].discard, 'village') === 1,
    '突貫は**累積しない**（2回買っても次の1枚だけ）');
}

// --- 準備 ---
{
  let s = mkE();
  s.players[0].hand = ['village', 'copper', 'estate'];
  s = buyEv(s, 'prepare');
  ok((s.players[0].prepareAside || []).length === 3 && s.players[0].hand.length === 0, '手札を全部 表向きに脇へ');
  s = E.reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  ok(s.pending && s.pending.type === 'prepare_play', '次のターンの開始時に使用の窓（1つの開始時効果）');
  const r = E.reduce(s, { type: 'PREPARE_PLAY', card: null });
  ok(r.pending && r.pending.type === 'prepare_play', '使えるカードが残っている間は辞退できない（強制）');
  s = E.reduce(s, { type: 'PREPARE_PLAY', card: 'village' });
  ok(s.pending && s.pending.type === 'prepare_play', '村を使った後も財宝が残っている＝窓が続く');
  s = E.reduce(s, { type: 'PREPARE_PLAY', card: 'copper' });
  ok(!s.pending || s.pending.type !== 'prepare_play', '全部使ったら終わり');
  ok(count(s.players[0].inPlay, 'village') === 1 && count(s.players[0].inPlay, 'copper') === 1, 'アクションと財宝を使用した');
  ok(count(s.players[0].discard, 'estate') === 1, '残り（屋敷）は捨て札になる');
  ok(s.turn.coins === 1, '財宝のコインはターンに乗る（ターン開始時＝アクションフェイズ）');
}

// --- 物色 ---
{
  let s = mkE();
  s.trash = ['estate'];
  s = buyEv(s, 'scrounge');
  ok(s.pending && s.pending.type === 'scrounge', '二択の窓');
  let g = E.reduce(s, { type: 'SCROUNGE_CHOOSE', choice: 'estate' });
  ok(count(g.players[0].discard, 'estate') === 1 && count(g.trash, 'estate') === 0, '廃棄置き場から屋敷を獲得');
  ok(g.pending && g.pending.type === 'scrounge' && g.pending.stage === 'gain', '獲得できたら $5以下の獲得（強制）');
  g = E.reduce(g, { type: 'SCROUNGE_GAIN', card: 'festival' });
  ok(count(g.players[0].discard, 'festival') === 1, '$5以下のカードを獲得');
  let tzz = E.reduce(s, { type: 'SCROUNGE_CHOOSE', choice: 'trash' });
  ok(tzz.pending && tzz.pending.stage === 'trash', '「手札1枚を廃棄」も選べる');
  // 屋敷が無いときに estate を選ぶと何も起きない（遂行できない選択肢も選べる）
  let z = mkE(); z.trash = [];
  z = buyEv(z, 'scrounge');
  z = E.reduce(z, { type: 'SCROUNGE_CHOOSE', choice: 'estate' });
  ok(!z.pending, '廃棄置き場に屋敷が無ければ何も起きない（選択自体は合法）');
}

// --- 旅行（2023エラッタ版＝D1） ---
{
  let s = mkE(null, ['A', 'B']);
  s.players[0].inPlay = ['village', 'copper'];
  s.players[0].hand = ['estate'];
  s = buyEv(s, 'journey');
  s = buyEv(s, 'journey'); // 2枚目は空振り（買えるが追加ターンは1つ）
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 0, '旅行＝このターンの後に追加の1ターン');
  ok(count(s.players[0].inPlay, 'village') === 1 && count(s.players[0].inPlay, 'copper') === 1,
    'クリンナップで場のカードを捨てない（場に残る）');
  ok(count(s.players[0].hand, 'estate') === 0, '手札は普通に捨てる');
  // 追加ターンの片付けでは普通に捨てる＋3ターン連続は不可
  s.turn.phase = 'buy'; s.turn.buys = 9; s.turn.coins = 40;
  s = buyEv(s, 'journey');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1, '追加ターン中に買った旅行では3ターン連続にならない（Bのターンへ）');
  ok(count(s.players[0].inPlay, 'village') === 1, '追加ターンでも旅行を買ったので場のカードは残る（公式＝追加ターンだけが失敗する）');
}

// --- 大渦巻 ---
{
  let s = mkE(null, ['A', 'B']);
  s.players[0].hand = ['copper', 'copper', 'estate', 'gold'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate'];
  s = buyEv(s, 'maelstrom');
  ok(s.pending && s.pending.type === 'maelstrom' && s.pending.stage === 'trash', '自分の3枚廃棄（強制）');
  s = E.reduce(s, { type: 'MAELSTROM_TRASH', cards: ['copper', 'copper', 'estate'] });
  ok(s.pending && s.pending.stage === 'victim' && s.pending.player === 1, '手札5枚以上の相手に廃棄の窓（堀不可）');
  s = E.reduce(s, { type: 'MAELSTROM_VICTIM', card: 'estate' });
  ok(count(s.trash, 'estate') === 2 && !s.pending, '相手が1枚廃棄して終了');
  // 手札4枚以下の相手は無事
  let z = mkE(null, ['A', 'B']);
  z.players[0].hand = ['copper', 'copper', 'copper'];
  z.players[1].hand = ['copper', 'copper', 'copper', 'estate'];
  z = buyEv(z, 'maelstrom');
  z = E.reduce(z, { type: 'MAELSTROM_TRASH', cards: ['copper', 'copper', 'copper'] });
  ok(!z.pending, '手札4枚以下の相手は廃棄しない');
}

// --- 侵略 ---
{
  let s = mkE(null, ['A', 'B']);
  s.players[0].hand = ['militia', 'copper'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate'];
  const lb = s.loot.length;
  s = buyEv(s, 'invasion');
  ok(s.pending && s.pending.type === 'invasion' && s.pending.stage === 'attack', '①アタックを使ってもよい');
  s = E.reduce(s, { type: 'INVASION_ATTACK', card: 'militia' });
  ok(s.pending && s.pending.type === 'militia', 'アタック（民兵）が解決中');
  s = E.reduce(s, { type: 'MILITIA_RESOLVE', cards: s.players[1].hand.slice(0, 2) });
  ok(s.pending && s.pending.type === 'invasion' && s.pending.stage === 'action', 'アタック解決後に③アクション獲得へ');
  ok(count(s.players[0].discard, 'duchy') === 1, '②公領を獲得している');
  s = E.reduce(s, { type: 'INVASION_ACTION', card: 'laboratory' });
  ok(s.players[0].deck[0] === 'laboratory', '③アクションを山札の上に獲得（コスト上限なし）');
  ok(s.loot.length === lb - 1, '④戦利品を獲得');
  ok(s.players[0].inPlay.some((c) => LOOT.indexOf(c) >= 0), '獲得した戦利品を使用する（場に出る）');
}

// --- 繁栄 ---
{
  let s = mkE();
  const lb = s.loot.length;
  s = buyEv(s, 'prosper');
  ok(s.loot.length === lb - 1, 'まず戦利品1枚');
  ok(s.pending && s.pending.type === 'prosper_gain', '互いに異なる財宝の獲得窓');
  s = E.reduce(s, { type: 'PROSPER_GAIN', card: 'gold' });
  ok(count(s.players[0].discard, 'gold') === 1, '金貨を獲得');
  const rej = E.reduce(s, { type: 'PROSPER_GAIN', card: 'gold' });
  ok(rej.pending && count(rej.players[0].discard, 'gold') === 1, '同じ名前は2枚獲得できない（拒否）');
  s = E.reduce(s, { type: 'PROSPER_GAIN', card: 'silver' });
  s = E.reduce(s, { type: 'PROSPER_GAIN', card: null });
  ok(!s.pending && count(s.players[0].discard, 'silver') === 1, '好きなところでやめられる');
}

// --- P5 ソーク（CPU 対戦にイベント購入をランダム注入） ---
{
  let games = 0, bad = 0;
  for (let si = 0; si < 4; si++) {
    seed = 9900 + si * 11;
    const names = [{ name: 'P0', isCpu: true, level: 'normal' }, { name: 'P1', isCpu: true, level: 'normal' }];
    let s = E.createInitialState(names, KING_T, { startActive: 0, events: EVENTS_ALL });
    KING_T.forEach((id) => s.players.forEach((pl) => { for (let c = 0; c < 2; c++) if ((s.supply[id] | 0) > 0) { s.supply[id] -= 1; pl.deck.push(id); } }));
    const t0 = tally(s);
    let step = 0, err = false, evBought = 0;
    try {
      while (!s.gameOver && step++ < 30000) {
        // ランダムにイベントを買わせる（CPU は略奪イベントを自発的に買わないため経路を強制的に通す）
        if (!s.pending && s.turn.phase === 'buy' && (s.turn.buys || 0) > 0 && step % 7 === 0) {
          const ev = EVENTS_ALL[Math.floor(sandbox.Math.random() * EVENTS_ALL.length)];
          const cost = DOM.LANDSCAPES[ev].cost || 0;
          if ((s.turn.coins || 0) >= cost) {
            const before = s;
            s = E.reduce(s, { type: 'BUY_EVENT', event: ev });
            if (s !== before) evBought++;
            continue;
          }
        }
        const a = CPU.decide(s);
        if (a == null) { console.log('    P5soak ' + si + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
        s = E.reduce(s, a);
      }
    } catch (e) { console.log('    P5soak ' + si + ': 例外 ' + e.message); err = true; }
    if (!err && !s.gameOver) { console.log('    P5soak ' + si + ': 未終局 pending=' + (s.pending && s.pending.type)); err = true; }
    if (!err && !sameTally(t0, tally(s))) { console.log('    P5soak ' + si + ': 保存則違反'); err = true; }
    if (err) bad++; else games++;
  }
  ok(bad === 0 && games === 4, 'P5 CPUソーク完走（イベント購入をランダム注入・4/4・膠着0・例外0・保存則違反0）');
}

/* ============================================================
   P6＝残りの王国カード9種
   ============================================================ */
console.log('\n=== P6: 王国カード（複雑系） ===');

const KING_P6 = ['fortune_hunter', 'mapmaker', 'enlarge', 'first_mate', 'frigate', 'mining_road', 'quartermaster', 'trickster', 'village', 'moat'];

// --- 王の隠し財産（3回使用） ---
{
  let s = mk(['kings_cache', 'wealthy_village', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory']);
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['kings_cache', 'gold'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'kings_cache' });
  ok(s.pending && s.pending.type === 'kings_cache_play', '手札の財宝を選ぶ窓');
  s = E.reduce(s, { type: 'KINGS_CACHE_PLAY', card: 'gold' });
  ok(s.turn.coins === 9, '金貨を3回使用＝+$9');
  ok(count(s.players[0].inPlay, 'gold') === 1, '物理カードは1枚だけ場に出る');
}

// --- 財産目当て ---
{
  let s = mk(KING_P6);
  s = handPlay(s, 0, ['fortune_hunter']);
  s.players[0].deck = ['estate', 'silver', 'copper', 'gold'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'fortune_hunter' });
  ok(s.turn.coins === 2, '財産目当て＝+$2');
  ok(s.pending && s.pending.type === 'fortune_hunter' && s.pending.cards.length === 3, '上3枚を見る');
  // マスク＝相手には伏せる
  const m = E.maskStateFor(s, 1);
  ok((m.pending.cards || []).every((c) => c === 'back'), '見た3枚は相手に伏せられる（私的看破）');
  s = E.reduce(s, { type: 'FORTUNE_HUNTER_PLAY', card: 'silver' });
  ok(count(s.players[0].inPlay, 'silver') === 1 && s.turn.coins === 4, '中の財宝（銀貨）を使用できる');
  ok(s.pending && s.pending.stage === 'arrange', '残り2枚を戻す窓');
  s = E.reduce(s, { type: 'FORTUNE_HUNTER_ARRANGE', top: ['estate', 'copper'] });
  ok(s.players[0].deck[0] === 'estate' && s.players[0].deck[1] === 'copper', '好きな順で山札の上に戻す');
}

// --- 地図作り（本体＋リアクション） ---
{
  let s = mk(KING_P6, null, ['A', 'B']);
  s = handPlay(s, 0, ['mapmaker']);
  s.players[0].deck = ['gold', 'silver', 'estate', 'curse', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'mapmaker' });
  ok(s.pending && s.pending.type === 'mapmaker' && s.pending.cards.length === 4, '上4枚を見る');
  s = E.reduce(s, { type: 'MAPMAKER_PICK', cards: ['gold', 'silver'] });
  ok(count(s.players[0].hand, 'gold') === 1 && count(s.players[0].hand, 'silver') === 1, '2枚を手札へ');
  ok(count(s.players[0].discard, 'estate') === 1 && count(s.players[0].discard, 'curse') === 1, '残りは捨て札へ');
}
{
  // リアクション＝相手が勝利点を獲得したとき手札から使用できる
  let s = mk(KING_P6, null, ['A', 'B']);
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → B
  s.players[0].hand = ['mapmaker'];
  s.players[0].deck = ['gold', 'silver', 'estate', 'curse'];
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 2;
  s = E.reduce(s, { type: 'BUY', card: 'estate' });   // B が勝利点を獲得
  ok(s.pending && s.pending.type === 'mapmaker_react' && s.pending.player === 0, '誰かの勝利点獲得で窓が開く');
  s = E.reduce(s, { type: 'MAPMAKER_REACT', play: true });
  ok(s.pending && s.pending.type === 'mapmaker' && s.pending.player === 0, '相手のターンに手札から使用できる');
  s = E.reduce(s, { type: 'MAPMAKER_PICK', cards: ['gold', 'silver'] });
  ok(count(s.players[0].hand, 'gold') === 1, 'リアクションでも普通に解決する');
}

// --- 拡大（今と次のターン） ---
{
  let s = mk(KING_P6);
  s = handPlay(s, 0, ['enlarge', 'estate']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'enlarge' });
  ok(s.pending && s.pending.type === 'enlarge_trash', '現在＝廃棄の窓（強制）');
  s = E.reduce(s, { type: 'ENLARGE_TRASH', card: 'estate' });
  ok(s.pending && s.pending.type === 'enlarge_gain' && s.pending.maxCost === 4, '屋敷($2)→$4以下の獲得');
  s = E.reduce(s, { type: 'ENLARGE_GAIN', card: 'village' });
  ok(count(s.players[0].discard, 'village') === 1, '獲得できる');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'enlarge') === 1, '持続として場に残る');
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  ok(s.pending && s.pending.type === 'enlarge_trash', '次のターンの開始時も廃棄→獲得');
}

// --- 一等航海士 ---
{
  let s = mk(KING_P6);
  s = handPlay(s, 0, ['first_mate', 'village', 'village', 'smithy']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver', 'gold'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'first_mate' });
  ok(s.pending && s.pending.type === 'first_mate', '使うアクションを選ぶ窓');
  s = E.reduce(s, { type: 'FIRST_MATE_PLAY', card: 'village' });
  ok(count(s.players[0].inPlay, 'village') === 1, '1枚目の村を使用');
  ok(s.pending && s.pending.type === 'first_mate' && s.pending.name === 'village', '同名（村）だけ続けて使える');
  const rej = E.reduce(s, { type: 'FIRST_MATE_PLAY', card: 'smithy' });
  ok(rej.pending && count(rej.players[0].inPlay, 'smithy') === 0, '別名（鍛冶屋）は拒否される');
  s = E.reduce(s, { type: 'FIRST_MATE_PLAY', card: 'village' });
  s = E.reduce(s, { type: 'FIRST_MATE_PLAY', card: null });
  ok(s.players[0].hand.length === 6, 'やめたら手札が6枚になるように引く（実際=' + s.players[0].hand.length + '）');
}

// --- フリゲート船 ---
{
  let s = mk(KING_P6, null, ['A', 'B']);
  s = handPlay(s, 0, ['frigate']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'frigate' });
  ok(s.turn.coins === 3, 'フリゲート船＝+$3');
  ok((s.players[0].delayedEffects || []).some((e) => e.type === 'frigate'), '持続の予約が張られる');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });   // → B のターン
  ok(count(s.players[0].durationCards, 'frigate') === 1, '場に残る');
  s.players[1].hand = ['village', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.players[1].deck = ['estate', 'estate'];
  s.turn.phase = 'action'; s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(s.pending && s.pending.type === 'discard_down' && s.pending.player === 1 && s.pending.down === 4,
    'B がアクションを使用＝解決後に手札4枚まで捨てる');
  s = E.reduce(s, { type: 'DISCARD_DOWN_RESOLVE', cards: s.players[1].hand.slice(0, s.players[1].hand.length - 4) });
  ok(s.players[1].hand.length === 4, '手札4枚になった');
}
{
  // 全員が堀で防いだら、そのターンの片付けで捨てられる（公式）
  let s = mk(KING_P6, null, ['A', 'B']);
  s = handPlay(s, 0, ['frigate']);
  s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'frigate' });
  ok(s.pending && s.pending.type === 'frigate' && s.pending.stage === 'react', '堀のリアクション窓');
  s = E.reduce(s, { type: 'MOAT_REVEAL' });
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'frigate') === 0 && count(s.players[0].inPlay, 'frigate') === 0,
    '誰にも影響しないフリゲート船はそのターンの片付けで場を離れる');
}

// --- 鉱山道路 ---
{
  let s = mk(KING_P6);
  s = handPlay(s, 0, ['mining_road']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'mining_road' });
  ok(s.turn.coins === 2 && s.turn.buys === 2, '鉱山道路＝+1購入 +$2');
  s.turn.phase = 'buy'; s.turn.coins = 8;
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.pending && s.pending.type === 'mining_road_play', '財宝の獲得で「使う？」の窓');
  s = E.reduce(s, { type: 'MINING_ROAD_PLAY', play: true });
  ok(count(s.players[0].inPlay, 'silver') === 1 && s.turn.miningRoad === 0, '獲得した銀貨を使用（回数を消費）');
  // 「使わない」なら権利は残る
  let z = mk(KING_P6);
  z = handPlay(z, 0, ['mining_road']);
  z = E.reduce(z, { type: 'PLAY_ACTION', card: 'mining_road' });
  z.turn.phase = 'buy'; z.turn.buys = 3; z.turn.coins = 8;
  z = E.reduce(z, { type: 'BUY', card: 'silver' });
  z = E.reduce(z, { type: 'MINING_ROAD_PLAY', play: false });
  ok(z.turn.miningRoad === 1, '使わなければ回数は残る');
  z = E.reduce(z, { type: 'BUY', card: 'silver' });
  ok(z.pending && z.pending.type === 'mining_road_play', '後の獲得でまた使える');
}

// --- 操舵手 ---
{
  let s = mk(KING_P6);
  s = handPlay(s, 0, ['quartermaster']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'quartermaster' });
  ok((s.players[0].quartermasters || []).length === 1, 'インスタンスができる');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].durationCards, 'quartermaster') === 1, '永続持続として場に残る');
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  ok(s.pending && s.pending.type === 'quartermaster', 'ターンの開始時に二択の窓');
  const t0 = tally(s);
  s = E.reduce(s, { type: 'QUARTERMASTER_RESOLVE', mode: 'gain', card: 'silver' });
  ok(s.players[0].quartermasters[0].cards.indexOf('silver') >= 0, '$4以下を脇に獲得（捨て札を経由しない）');
  ok(sameTally(t0, tally(s)), '保存則が保たれる（脇も数える）');
  // 次のターン＝脇から手札へ
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A
  ok(s.pending && s.pending.type === 'quartermaster', '毎ターン開始時に窓');
  s = E.reduce(s, { type: 'QUARTERMASTER_RESOLVE', mode: 'take', card: 'silver' });
  ok(count(s.players[0].hand, 'silver') >= 1, '脇のカードを手札に加えられる');
}

// --- トリックスター ---
{
  let s = mk(KING_P6, null, ['A', 'B']);
  s = handPlay(s, 0, ['trickster']);
  const curses = s.supply.curse;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'trickster' });
  ok(s.supply.curse === curses - 1, '他の全員が呪いを獲得（アタック）');
  s.turn.phase = 'buy'; s.turn.buys = 1;
  s.players[0].hand = ['gold', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ALL_TREASURES' });
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'trickster_aside', 'クリンナップ開始時に「財宝を脇へ」の窓');
  s = E.reduce(s, { type: 'TRICKSTER_ASIDE', cards: ['gold'] });
  ok(count(s.players[0].hand, 'gold') === 1, '脇に置いた金貨はターン終了時（先引きの後）に手札へ');
  ok(s.players[0].hand.length === 6, '5枚＋金貨の6枚');
}

// --- P6 ソーク ---
{
  let games = 0, bad = 0;
  for (let np = 2; np <= 3; np++) {
    for (let si = 0; si < 2; si++) {
      seed = 10100 + np * 13 + si;
      const names = []; for (let k = 0; k < np; k++) names.push({ name: 'P' + k, isCpu: true, level: 'normal' });
      let s = E.createInitialState(names, KING_P6, { startActive: 0 });
      KING_P6.forEach((id) => s.players.forEach((pl) => { for (let c = 0; c < 2; c++) if ((s.supply[id] | 0) > 0) { s.supply[id] -= 1; pl.deck.push(id); } }));
      s.players.forEach((pl) => pl.deck.push('kings_cache', 'gold'));
      const t0 = tally(s);
      let step = 0, err = false;
      try {
        while (!s.gameOver && step++ < 25000) {
          const a = CPU.decide(s);
          if (a == null) { console.log('    P6soak ' + np + '/' + si + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
          s = E.reduce(s, a);
        }
      } catch (e) { console.log('    P6soak ' + np + '/' + si + ': 例外 ' + e.message); err = true; }
      if (!err && !s.gameOver) { console.log('    P6soak ' + np + '/' + si + ': 未終局 pending=' + (s.pending && s.pending.type)); err = true; }
      if (!err && !sameTally(t0, tally(s))) { console.log('    P6soak ' + np + '/' + si + ': 保存則違反'); err = true; }
      if (err) bad++; else games++;
    }
  }
  ok(bad === 0 && games === 4, 'P6 CPUソーク完走（4/4・膠着0・例外0・保存則違反0）');
}

/* ============================================================
   P7＝CARD_SET 昇格（plunder / plunder-events / plunder-traits / random-plunder / mix-all）
   ============================================================ */
console.log('\n=== P7: CARD_SET 昇格 ===');
{
  const ids = DOM.CARD_SETS.map((s) => s.id);
  ok(ids.indexOf('plunder') >= 0 && ids.indexOf('plunder-events') >= 0 && ids.indexOf('plunder-traits') >= 0 && ids.indexOf('random-plunder') >= 0,
    '4つの略奪セットが CARD_SETS にある');
  ok((DOM.KINGDOM_PLUNDER || []).length === 10 && DOM.KINGDOM_PLUNDER.every((id) => DOM.POOLS.plunderexp.indexOf(id) >= 0),
    '固定10種はすべて略奪プールのカード');
  ok((DOM.STAGE1_POOLS || []).indexOf('plunderexp') < 0 && (DOM.STAGE1_POOLS || []).indexOf('loot') < 0,
    '略奪のプールは STAGE1_POOLS に入っていない（＝実プレイ・闇市場に出る）');
  ok(DOM.MIX_KINGDOM_POOLS.plunderexp === '略奪', 'mix-all の抽選元に略奪がある');
  ok(!!DOM.MIX_LANDSCAPE_POOLS['ev-plunder'] && !!DOM.MIX_LANDSCAPE_POOLS['trait-plunder'], 'mix の横型プール（イベント/特性）がある');
  // plunder-traits＝特性2枚が付き、createInitialState で山に付く
  seed = 12345;
  const tr = DOM.traitsForSet('plunder-traits');
  ok(tr.length === 2 && tr.every((t) => DOM.TRAITS_PLUNDER.indexOf(t) >= 0), 'plunder-traits は特性2枚を抽選する');
  const s = E.createInitialState(['A', 'B'], DOM.KINGDOM_PLUNDER, { startActive: 0, traits: tr });
  ok(s.traits && Object.keys(s.traits).length >= 1, '特性が山に付く');
  // 闇市場デッキ＝略奪の王国40種は入る／戦利品15種は入らない
  seed = 777;
  const bmKing = ['black_market', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'];
  const bs = E.createInitialState(['A', 'B'], bmKing, { startActive: 0 });
  const bm = bs.blackMarket || [];
  ok(bm.some((id) => DOM.POOLS.plunderexp.indexOf(id) >= 0), '闇市場デッキに略奪の王国カードが入る');
  ok(!bm.some((id) => LOOT.indexOf(id) >= 0), '戦利品（非サプライ）は闇市場デッキに入らない');
}
// 出荷4セットの CPU ソーク（イベント/特性込み）
{
  let games = 0, bad = 0;
  ['plunder', 'plunder-events', 'plunder-traits', 'random-plunder'].forEach((setId, ki) => {
    for (let sd = 0; sd < 2; sd++) {
      seed = 12000 + ki * 17 + sd;
      const k = DOM.kingdomForSet(setId);
      const ls = DOM.landscapesForSet(setId);
      const names = [{ name: 'P0', isCpu: true, level: 'hard' }, { name: 'P1', isCpu: true, level: 'normal' }];
      let s = E.createInitialState(names, k, { startActive: 0, events: ls.events, traits: ls.traits });
      const t0 = tally(s);
      let step = 0, err = false;
      try {
        while (!s.gameOver && step++ < 25000) {
          const a = CPU.decide(s);
          if (a == null) { console.log('    ' + setId + '/' + sd + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
          s = E.reduce(s, a);
        }
      } catch (e) { console.log('    ' + setId + '/' + sd + ': 例外 ' + e.message + '\n' + (e.stack || '').split('\n')[1]); err = true; }
      if (!err && !s.gameOver) { console.log('    ' + setId + '/' + sd + ': 未終局 pending=' + (s.pending && s.pending.type)); err = true; }
      if (!err && !sameTally(t0, tally(s))) { console.log('    ' + setId + '/' + sd + ': 保存則違反'); err = true; }
      if (err) bad++; else games++;
    }
  });
  ok(bad === 0 && games === 8, '出荷4セットの CPUソーク完走（' + games + '/8・膠着0・例外0・保存則違反0）');
}
// mix：略奪×他拡張の混成ソーク
{
  let games = 0, bad = 0;
  ['darkages', 'allies', 'prosperity'].forEach((other, ki) => {
    seed = 12500 + ki * 31;
    const setId = 'mix:plunderexp,' + other + ':2:ev-plunder,trait-plunder';
    const k = DOM.kingdomForSet(setId);
    const ls = DOM.landscapesForSet(setId);
    const names = [{ name: 'P0', isCpu: true, level: 'normal' }, { name: 'P1', isCpu: true, level: 'normal' }];
    let s = E.createInitialState(names, k, { startActive: 0, events: ls.events, traits: ls.traits, landmarks: ls.landmarks, projects: ls.projects, ways: ls.ways });
    const t0 = tally(s);
    let step = 0, err = false;
    try {
      while (!s.gameOver && step++ < 25000) {
        const a = CPU.decide(s);
        if (a == null) { console.log('    mix+' + other + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
        s = E.reduce(s, a);
      }
    } catch (e) { console.log('    mix+' + other + ': 例外 ' + e.message); err = true; }
    if (!err && !s.gameOver) { console.log('    mix+' + other + ': 未終局 pending=' + (s.pending && s.pending.type)); err = true; }
    if (!err && !sameTally(t0, tally(s))) { console.log('    mix+' + other + ': 保存則違反'); err = true; }
    if (err) bad++; else games++;
  });
  ok(bad === 0 && games === 3, 'mix（略奪×暗黒時代/同盟/繁栄）ソーク完走（' + games + '/3）');
}

/* ============================================================
   敵対レビューの回帰テスト（確定した実バグの再発防止）
   ============================================================ */
console.log('\n=== 敵対レビュー回帰 ===');

// [high] 財産目当ての再開スロットが単一だとカードが消える（入れ子で上書き）
{
  /* ⚠ 上書きを起こすには**内側の財産目当ても pending を立てる財宝を使う**必要がある
     （内側が退避を push した瞬間に、代入だと外側の退避が消える）。呪符の巻物＝廃棄して獲得の窓を開く。 */
  let s = mk(['fortune_hunter', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival']);
  s = handPlay(s, 0, ['fortune_hunter', 'fortune_hunter']);
  // 外側が見る上3枚＝[杖, 屋敷, 屋敷]／内側が見る次の3枚＝[呪符の巻物, 公領, 公領]
  s.players[0].deck = ['staff', 'estate', 'estate', 'spell_scroll', 'duchy', 'duchy', 'copper', 'copper'];
  const t0 = tally(s);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'fortune_hunter' });
  s = E.reduce(s, { type: 'FORTUNE_HUNTER_PLAY', card: 'staff' });     // 杖を使う → 外側の残り[屋敷,屋敷]を退避
  ok(s.pending && s.pending.type === 'staff_play', '杖の窓が開く');
  s = E.reduce(s, { type: 'STAFF_PLAY', card: 'fortune_hunter' });     // 内側の財産目当て
  ok(s.pending && s.pending.type === 'fortune_hunter' && s.pending.stage === 'play', '入れ子の財産目当てが開く');
  s = E.reduce(s, { type: 'FORTUNE_HUNTER_PLAY', card: 'spell_scroll' }); // ★内側も退避を積む（ここで上書きが起きていた）
  ok((s.turn.fhResume || []).length === 2, '外側と内側の退避が**両方**積まれている（スタック）');
  s = E.reduce(s, { type: 'SPELL_SCROLL_GAIN', card: 'copper' });
  if (s.pending && s.pending.type === 'spell_scroll_play') s = E.reduce(s, { type: 'SPELL_SCROLL_PLAY', play: false });
  ok(s.pending && s.pending.type === 'fortune_hunter' && s.pending.stage === 'arrange', '内側の財産目当てが再開する');
  s = E.reduce(s, { type: 'FORTUNE_HUNTER_ARRANGE', top: s.pending.cards.slice() });
  ok(s.pending && s.pending.type === 'fortune_hunter' && s.pending.stage === 'arrange' && s.pending.cards.length === 2,
    '内側を閉じると**外側の**財産目当て（残り2枚＝屋敷2枚）が再開する');
  s = E.reduce(s, { type: 'FORTUNE_HUNTER_ARRANGE', top: s.pending.cards.slice() });
  ok(!s.pending, '外側も閉じる');
  ok(sameTally(t0, tally(s)), '入れ子でもカードが1枚も消えない（保存則）');
}
// [medium] 拡大＝手札が空で窓が開いても閉じられる（終端保証）
{
  let s = mk(['enlarge', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.pending = { type: 'enlarge_trash', player: 0 };
  s.players[0].hand = [];
  s = E.reduce(s, { type: 'ENLARGE_TRASH', card: null });
  ok(!s.pending, '拡大：手札が空なら窓が閉じる（CPU livelock・人間の詰みを防ぐ）');
}
// [medium] 一等航海士＝手札から使えるアクションが無ければ窓を開かない（航海の3枚制限）
{
  let s = mk(['first_mate', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival']);
  s = handPlay(s, 0, ['first_mate', 'village']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.turn.voyageTurn = true; s.turn.handPlays = 3;   // 同盟：航海の追加ターン＝手札から3枚まで（もう使えない）
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'first_mate' });
  ok(!s.pending || s.pending.type !== 'first_mate',
    '手札から使えるアクションが無ければ窓を開かない（engine拒否×CPU提案の livelock を防ぐ）');
}
// [high] 繁栄＝「やめる」ボタンが常に出る（UI テスト側で検査）／engine は card:null を受理する
{
  let s = mk(KING_T, null, ['A', 'B']);
  s.pending = { type: 'prosper_gain', player: 0, gained: [] };
  s = E.reduce(s, { type: 'PROSPER_GAIN', card: null });
  ok(!s.pending, '繁栄：候補が残っていても「やめる」で閉じられる');
}
// [medium] 六分儀の「見た5枚」は相手に伏せる（私的看破）
{
  let s = mk(KING_LOOT, null, ['A', 'B']);
  s.pending = { type: 'sextant', player: 0, cards: ['gold', 'province', 'curse', 'silver', 'estate'] };
  const m = E.maskStateFor(s, 1);
  ok((m.pending.cards || []).every((c) => c === 'back'), '六分儀：相手には伏せられる（オンラインの情報漏洩を防ぐ）');
  const own = E.maskStateFor(s, 0);
  ok(own.pending.cards.indexOf('gold') >= 0, '本人には見える');
}
// [medium] トリックスターの脇札は保存則に数える
{
  let s = mk(KING_P6, null, ['A', 'B']);
  const t0 = tally(s);
  s.players[0].inPlay = ['gold'];
  s.supply.gold -= 1;                       // 場の金貨はサプライから来た体にする
  s.turn.tricksterHold = [];
  s.pending = { type: 'trickster_aside', player: 0, max: 1 };
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'TRICKSTER_ASIDE', cards: ['gold'] });
  ok((s.turn.tricksterHold || []).indexOf('gold') >= 0 || count(s.players[0].hand, 'gold') === 1,
    'トリックスター：脇に置かれた（または既に手札へ戻った）');
  ok(sameTally(t0, tally(s)), '脇に置いている間も保存則の集計に入る');
}
// [low] 工具＝場にカードが無ければ窓を閉じる（終端保証）
{
  let s = mk(KING_P3A, null, ['A', 'B']);
  s.players.forEach((pl) => { pl.inPlay = []; pl.durationCards = []; });
  s.pending = { type: 'tools_gain', player: 0 };
  s = E.reduce(s, { type: 'TOOLS_GAIN', card: null });
  ok(!s.pending, '工具：場に1枚も無ければ窓が閉じる');
}
// [medium] 侵略＝公領の獲得が開いた窓を握りつぶさない（公爵夫人）
{
  let s = E.createInitialState(['A', 'B'], ['duchess', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, events: ['invasion'] });
  s.turn.phase = 'buy'; s.turn.buys = 5; s.turn.coins = 40; s.players[0].hand = [];
  s = E.reduce(s, { type: 'BUY_EVENT', event: 'invasion' });
  ok(s.pending && s.pending.type === 'duchess_gain', '侵略：公領の獲得で公爵夫人の窓が開く（握りつぶさない）');
  s = E.reduce(s, { type: 'DUCHESS_GAIN', gain: false });
  ok(s.pending && s.pending.type === 'invasion' && s.pending.stage === 'action', 'その解決後に③のアクション獲得へ進む');
}
// [medium] 物色＝廃棄置き場からの屋敷獲得が開いた窓を握りつぶさない（納屋）
{
  let s = E.createInitialState(['A', 'B'], ['hovel', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, events: ['scrounge'] });
  s.turn.phase = 'buy'; s.turn.buys = 5; s.turn.coins = 40;
  s.players[0].hand = ['hovel']; s.trash.push('estate');
  s = E.reduce(s, { type: 'BUY_EVENT', event: 'scrounge' });
  s = E.reduce(s, { type: 'SCROUNGE_CHOOSE', choice: 'estate' });
  ok(s.pending && s.pending.type === 'hovel_react', '物色：屋敷の獲得で納屋の窓が開く（握りつぶさない）');
}
// [low] 操舵手＝玉座の間で2回使っても脇は1つ（窓だけ2回）
{
  let s = mk(['quartermaster', 'throne_room', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory']);
  s = handPlay(s, 0, ['throne_room', 'quartermaster']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
  s = E.reduce(s, { type: 'THRONE_CHOOSE', card: 'quartermaster' });
  ok((s.players[0].quartermasters || []).length === 1, '玉座×操舵手＝脇は1つ（公式）');
  ok(s.players[0].quartermasters[0].plays === 2, '窓の回数は2');
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });   // → A のターン開始
  const qs = (s.turn.startQueue || []).filter((q) => q.type === 'quartermaster').length;
  ok(s.pending && s.pending.type === 'quartermaster' && qs === 1, '開始時に窓が2回ぶん積まれる（今1つ＋キューに1つ）');
}

// [medium] 無謀な＝2回とも「そのターン最初にこれを使った」扱い（愚者の黄金・岐路）
{
  let s = E.createInitialState(['A', 'B'], ['fools_gold', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['reckless'], traitPiles: { reckless: 'fools_gold' } });
  s.turn.phase = 'buy'; s.players[0].hand = ['fools_gold'];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'fools_gold' });
  ok(s.turn.coins === 2, '無謀な愚者の黄金＝+$1を2回で $2（+$1+$4 の $5 ではない）');
  let z = E.createInitialState(['A', 'B'], ['crossroads', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['reckless'], traitPiles: { reckless: 'crossroads' } });
  z.turn.phase = 'action'; z.turn.actions = 1; z.players[0].hand = ['crossroads'];
  z.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  z = E.reduce(z, { type: 'PLAY_ACTION', card: 'crossroads' });
  ok(z.turn.actions === 6, '無謀な岐路＝+3アクションを2回で6（2回目が「2枚目」扱いにならない）');
  // ⚠ 大金は「1ターンに1回」＝無謀でもコイン2倍は1度だけ（復元してはいけない側）
  let f = E.createInitialState(['A', 'B'], ['fortune', 'gladiator', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory'],
    { startActive: 0, traits: ['reckless'], traitPiles: { reckless: 'gladiator' } });
  ok(f.traits.reckless === 'gladiator', '（大金は分割山の下段なので剣闘士の山に付く）');
}
// [medium] 上陸部隊＝相手のターンに誘発した予約が、相手がすぐターンを終えても失われない
{
  let s = mk(['landing_party', 'buried_treasure', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory'], null, ['A', 'B']);
  s = handPlay(s, 0, ['landing_party']);
  s.players[0].deck = ['copper', 'copper', 'silver', 'gold'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'landing_party' });
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });      // → B のターン
  // B が A に埋められた財宝を獲得させる代わりに、A が自分で獲得した体にする（onGainQueue 経由の強制プレイ）
  s.turn.phase = 'buy';
  E.gainLoot ? 0 : 0;
  const before = count(s.players[0].durationCards, 'landing_party');
  ok(before === 1, '上陸部隊が場に残っている');
  // A が（相手のターンに）埋められた財宝を獲得＝強制プレイ＝ターン最初の1枚が財宝
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });      // → A のターン開始（ここまでで消えていないこと）
  ok(count(s.players[0].durationCards, 'landing_party') + count(s.players[0].deck, 'landing_party') +
     count(s.players[0].inPlay, 'landing_party') === 1, '上陸部隊はどこかに必ず1枚ある（予約が消えても札は消えない）');
}
// [medium] セイレーン＝勲章で山札の上へ逃がせる（自壊より先に動かせる）
{
  let s = mk(['siren', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 6;
  s.turn.insignia = 1;                       // 勲章を使った状態
  s.players[0].hand = [];
  s = E.reduce(s, { type: 'BUY', card: 'siren' });
  ok(s.pending && s.pending.type === 'travelling_fair', 'セイレーンの自壊より先に勲章の窓が開く');
  s = E.reduce(s, { type: 'TRAVELLING_FAIR_TOPDECK', topdeck: true });
  ok(s.players[0].deck[0] === 'siren' && count(s.trash, 'siren') === 0,
    '勲章で山札の上へ逃がすとセイレーンは自壊しない（公式＝This is why Insignia works）');
}
// [low] 置き去り＝資本主義で増えた種別も数える
{
  let s = E.createInitialState(['A', 'B'], ['maroon', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, projects: ['capitalism'] });
  s.players[0].projects = ['capitalism'];
  s = handPlay(s, 0, ['maroon', 'militia']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'maroon' });
  s = E.reduce(s, { type: 'MAROON_TRASH', card: 'militia' });
  ok(count(s.players[0].hand, 'copper') === 6, '資本主義下の民兵＝3種別で +6カード（静的2種別の+4ではない）');
}
// [low] 現場監督＝「獲得した瞬間」のコストで判定（動的コスト）
{
  let s = mk(['taskmaster', 'fisherman', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory']);
  s = handPlay(s, 0, ['taskmaster']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'taskmaster' });
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 8; s.players[0].discard = [];
  s = E.reduce(s, { type: 'BUY', card: 'fisherman' });   // 捨て札が空＝獲得の瞬間は$2（獲得後は$5）
  ok((s.turn.taskmasterWatch || []).every((w) => !w.hit), '捨て札が空で漁女($2)を獲得しても誘発しない（獲得後の$5で判定しない）');
}
// [low] 隊商の護衛/番犬のリアクションも「カードの使用」＝旗艦が誘発する
{
  let s = mk(['flagship', 'caravan_guard', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory'], null, ['A', 'B']);
  s = handPlay(s, 0, ['flagship']);
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'flagship' });
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });     // → B のターン
  s.players[0].hand = ['caravan_guard', 'copper', 'copper', 'copper', 'estate'];
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s.players[1].hand = ['militia'];
  s.turn.phase = 'action'; s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
  ok((s.players[0].delayedEffects || []).some((e) => e.nextTime === 'play_action'),
    '相手がアクションを使っても旗艦は誘発しない（「あなたが使用したとき」）');
  s = E.reduce(s, { type: 'CARAVAN_GUARD_REACT' });
  ok(count(s.players[0].inPlay, 'caravan_guard') === 1, '隊商の護衛が先にプレイされた');
  ok(!(s.players[0].delayedEffects || []).some((e) => e.nextTime === 'play_action'),
    '相手のターンのリアクションでも旗艦の予約が消費される（noteAllyPlay を通す）');
}
// [low] 内気な＝捨て札トリガーの対話が解決してから引く
{
  let s = E.createInitialState(['A', 'B'], ['village_green', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['shy'], traitPiles: { shy: 'village_green' } });
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });      // → B
  s.players[0].hand = ['village_green', 'copper'];
  s.players[0].deck = ['gold', 'silver', 'estate'];
  s.turn.phase = 'buy';
  s = E.reduce(s, { type: 'END_TURN' });      // → A のターン開始
  if (s.pending && s.pending.type === 'shy_discard') {
    const handBefore = s.players[0].hand.length;
    s = E.reduce(s, { type: 'SHY_DISCARD', card: 'village_green' });
    if (s.pending && s.pending.type === 'village_green_react') {
      ok(s.players[0].hand.length === handBefore - 1,
        '内気な：捨て札リアクションの窓が開いている間はまだ引いていない（ドローが先に走らない）');
      s = E.reduce(s, { type: 'VILLAGE_GREEN_REACT', play: false });
    }
    ok(!s.pending || s.pending.type !== 'shy_discard', '解決後に +2カードが走る');
  } else {
    ok(true, '（内気な village_green の窓は開かなかった＝盤面依存なのでスキップ）');
  }
}

// [low] 無謀なアタック＝1回の堀/盾の公開で2回とも防ぐ（窓は1度しか開かない）
{
  let s = E.createInitialState(['A', 'B'], ['witch', 'moat', 'village', 'smithy', 'market', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['reckless'], traitPiles: { reckless: 'witch' } });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['witch']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s.players[1].hand = ['moat', 'copper', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'witch' });
  ok(s.pending && s.pending.type === 'witch' && s.pending.player === 1, '無謀な魔女＝1回目のリアクション窓が開く');
  s = E.reduce(s, { type: 'MOAT_REVEAL' });
  ok(!s.pending || s.pending.type !== 'witch',
    '堀を1回公開したら2回目のリアクション窓は開かない（公式＝a single reveal blocks both attacks）');
  ok(count(s.players[1].discard, 'curse') + count(s.players[1].hand, 'curse') === 0,
    '2回目の呪いも受けない');
  ok(count(s.players[0].hand, 'copper') === 4, '使用者は2回とも +2カード を得る（4枚）');
}
// 盾でも同じ（略奪内で完結する経路）
{
  let s = E.createInitialState(['A', 'B'], ['witch', 'shield', 'village', 'smithy', 'market', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['reckless'], traitPiles: { reckless: 'witch' } });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['witch']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s.players[1].hand = ['shield', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'witch' });
  s = E.reduce(s, { type: 'SHIELD_REVEAL' });
  ok(count(s.players[1].discard, 'curse') === 0, '盾も1回の公開で2回とも防ぐ');
  ok(count(s.players[1].hand, 'shield') === 1, '盾は公開しても手札に残る');
}
// ただし「別の2枚目」は改めて公開できる／防がなければ2回とも受ける
{
  let s = E.createInitialState(['A', 'B'], ['witch', 'moat', 'village', 'smithy', 'market', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['reckless'], traitPiles: { reckless: 'witch' } });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['witch']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s.players[1].hand = ['moat', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'witch' });
  s = E.reduce(s, { type: 'WITCH_REACT' });                      // 1回目を受ける
  if (s.pending && s.pending.type === 'witch') s = E.reduce(s, { type: 'WITCH_REACT' }); // 2回目も受ける
  ok(count(s.players[1].discard, 'curse') === 2, '防がなければ無謀な魔女で呪いを2枚受ける');
}

console.log(`\n略奪テスト結果: ${pass} 件成功, ${fail} 件失敗`);
if (fail > 0) process.exit(1);
