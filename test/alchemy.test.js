/* 錬金術（Alchemy 第二版）ゲームロジックの検証（Node 単体実行）
   使い方: node test/alchemy.test.js
   対象: ポーション経済（特殊財宝・ポーション費用購入）/ 12種の効果 / 支配（Possession）*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
let seed = 20260701;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
load('js/cards.js');
load('js/engine.js');
load('js/cpu.js');
const DOM = sandbox.window.DOM;
const E = DOM.engine;
const CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
function count(arr, id) { return arr.filter((c) => c === id).length; }
const reduce = (s, a) => E.reduce(s, a);

// 全12種＋補助カードを揃えた王国（サプライにポーション山も出る）。テストは kingdom を絞らず全部載せる。
const ALC_K = ['transmute', 'vineyard', 'herbalist', 'apothecary', 'scrying_pool', 'university',
               'alchemist', 'familiar', 'philosophers_stone', 'golem', 'apprentice', 'possession',
               'village', 'smithy', 'laboratory', 'great_hall'];
function mk(players, kingdom, startActive) {
  return E.createInitialState(players || ['A', 'B'], kingdom || ALC_K, { startActive: startActive == null ? 0 : startActive });
}
// 保留を全部CPUで消化してから手番を終える（開始時保留も消化）
function endTurn(s) {
  let g = 0;
  while (s.pending && g++ < 120) s = reduce(s, CPU.decide(s));
  if (s.turn.phase === 'action') s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  g = 0;
  while (s.pending && g++ < 120) s = reduce(s, CPU.decide(s));
  return s;
}
// 保留を全部CPUで消化（手番は終えない）
function drain(s) { let g = 0; while (s.pending && g++ < 120) s = reduce(s, CPU.decide(s)); return s; }

/* ============ ポーション経済（土台） ============ */
console.log('=== サプライ: ポーション費用カードがある王国にはポーション山(16)が出る ===');
{
  const s = mk();
  ok(s.supply.potion === 16, `ポーション山=16 (実 ${s.supply.potion})`);
  const s2 = E.createInitialState(['A', 'B'], ['village', 'smithy', 'market', 'moat', 'militia', 'mine', 'remodel', 'cellar', 'workshop', 'laboratory']);
  ok(s2.supply.potion === undefined, 'ポーション費用カードが無い王国にはポーション山は出ない');
}

console.log('=== ポーション財宝: 出すと t.potions +1（コインは増えない）===');
{
  let s = mk();
  s.players[0].hand = ['potion', 'copper'];
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'potion' });
  ok(s.turn.potions === 1 && s.turn.coins === 0, `ポーション+1・コイン0 (実 pot${s.turn.potions}/coin${s.turn.coins})`);
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.coins === 1, `銅貨で+1コイン (実 ${s.turn.coins})`);
}

console.log('=== 購入: ポーション費用カードはポーションが要る（無ければ買えない）===');
{
  let s = mk();
  s.turn.phase = 'buy';
  // ポーション無しで変成(コスト0+ポーション1)を買おうとしても不可
  const before = s.supply.transmute;
  s = reduce(s, { type: 'BUY', card: 'transmute' });
  ok(s.supply.transmute === before, 'ポーション無しでは変成を買えない（コスト0でもタダ取り不可）');
  // ポーションを出してから買えば成功
  s.players[0].hand = ['potion'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'potion' });
  s = reduce(s, { type: 'BUY', card: 'transmute' });
  ok(s.supply.transmute === before - 1 && s.turn.potions === 0, '変成を購入するとポーションを1消費');
  ok(s.players[0].discard.includes('transmute'), '購入した変成は捨て札へ');
}

console.log('=== 購入: ポーション費用カードにはコイン費用も要る（賢者の石=コスト3+ポーション1）===');
{
  let s = mk();
  s.turn.phase = 'buy';
  s.players[0].hand = ['potion', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' }); // +2コイン +1ポーション
  ok(s.turn.coins === 2 && s.turn.potions === 1, `コイン2・ポーション1 (実 ${s.turn.coins}/${s.turn.potions})`);
  const before = s.supply.philosophers_stone;
  s = reduce(s, { type: 'BUY', card: 'philosophers_stone' }); // コスト3必要→2では不可
  ok(s.supply.philosophers_stone === before, 'コイン不足なら賢者の石は買えない（ポーションだけでは足りない）');
}

/* ============ 変成 ============ */
console.log('=== 変成: 種類ごとに獲得（勝利点→金貨／財宝→変成／アクション→公領）===');
{
  let s = mk();
  s.players[0].hand = ['transmute', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'transmute' });
  ok(s.pending && s.pending.type === 'transmute', '変成で廃棄選択の保留');
  s = reduce(s, { type: 'TRANSMUTE_TRASH', card: 'estate' });
  ok(s.trash.includes('estate') && s.players[0].discard.includes('gold'), '屋敷(勝利点)を廃棄→金貨を獲得');
}
{
  let s = mk();
  s.players[0].hand = ['transmute', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'transmute' });
  s = reduce(s, { type: 'TRANSMUTE_TRASH', card: 'copper' });
  ok(s.trash.includes('copper') && s.players[0].discard.includes('transmute'), '銅貨(財宝)を廃棄→変成を獲得');
}
{
  let s = mk();
  s.players[0].hand = ['transmute', 'village'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'transmute' });
  s = reduce(s, { type: 'TRANSMUTE_TRASH', card: 'village' });
  ok(s.trash.includes('village') && s.players[0].discard.includes('duchy'), '村(アクション)を廃棄→公領を獲得');
}
{
  // 多重タイプ：大広間（アクション+勝利点）→ 公領＋金貨 の両方
  let s = mk();
  s.players[0].hand = ['transmute', 'great_hall'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'transmute' });
  s = reduce(s, { type: 'TRANSMUTE_TRASH', card: 'great_hall' });
  ok(s.players[0].discard.includes('duchy') && s.players[0].discard.includes('gold'), '大広間(アクション+勝利点)→公領と金貨の両方を獲得');
}

/* ============ ブドウ園（変動VP） ============ */
console.log('=== ブドウ園: 所持アクション3枚につき1勝利点 ===');
{
  let s = mk();
  const p = s.players[0];
  p.deck = []; p.hand = []; p.discard = ['vineyard', 'village', 'smithy', 'laboratory', 'copper', 'estate']; p.inPlay = [];
  // アクション3枚(村/鍛冶屋/研究所) → floor(3/3)=1点、屋敷+1点 = 2点
  ok(E.vpOf(p) === 1 + 1, `ブドウ園1+屋敷1=2点 (実 ${E.vpOf(p)})`);
  p.discard.push('festival', 'market', 'market'); // アクション計6枚 → floor(6/3)=2点
  ok(E.vpOf(p) === 2 + 1, `アクション6枚でブドウ園2+屋敷1=3点 (実 ${E.vpOf(p)})`);
}

/* ============ 薬草商 ============ */
console.log('=== 薬草商: +1購入+1コイン / 片付けで場の財宝(銀貨)を山札の上へ ===');
{
  let s = mk();
  s.players[0].hand = ['herbalist', 'silver'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.players[0].discard = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'herbalist' });
  ok(s.turn.buys === 2 && s.turn.coins === 1, `薬草商 +1購入+1コイン (実 buy${s.turn.buys}/coin${s.turn.coins})`);
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  s = reduce(s, { type: 'END_TURN' }); // 片付けで銀貨を山札の上へ→次手番で引く
  ok(count(s.players[0].hand, 'silver') === 1, '薬草商で山札に戻した銀貨が次の手札に来た');
  ok(!s.players[0].discard.includes('silver'), '銀貨は捨て札ではなく山札へ戻された');
}

/* ============ 薬剤師 ============ */
console.log('=== 薬剤師: 上4枚の銅貨・ポーションを手札へ、残りを並べ替えて山札の上へ ===');
{
  let s = mk();
  s.players[0].hand = ['apothecary'];
  // 引く1枚(gold)＋公開4枚(copper,potion,estate,village)
  s.players[0].deck = ['gold', 'copper', 'potion', 'estate', 'village', 'silver'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'apothecary' });
  ok(s.players[0].hand.includes('gold'), '+1カード(gold)');
  ok(s.players[0].hand.includes('copper') && s.players[0].hand.includes('potion'), '銅貨とポーションを手札へ');
  ok(s.pending && s.pending.type === 'apothecary' && count(s.pending.cards, 'estate') === 1 && count(s.pending.cards, 'village') === 1, '残り(屋敷・村)を並べ替え保留');
  s = reduce(s, { type: 'APOTHECARY_RESOLVE', order: ['village', 'estate'] });
  ok(s.players[0].deck[0] === 'village' && s.players[0].deck[1] === 'estate', '指定順で山札の上に戻る（村→屋敷）');
  ok(s.turn.actions === 1, '+1アクション（1使い+1）');
}

/* ============ 念視の泉 ============ */
console.log('=== 念視の泉: 相手の山札上を捨てさせ、自分はアクション以外まで公開して全て手札へ ===');
{
  let s = mk();
  s.players[0].hand = ['scrying_pool'];
  s.players[0].deck = ['village', 'smithy', 'estate', 'copper']; // 自分：村・鍛冶屋(アクション)→屋敷で止まる
  s.players[1].deck = ['gold', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'scrying_pool' });
  s = drain(s); // 各decide/reactをCPUで消化（自分＝掘る/相手＝良い札を捨て）
  ok(s.players[0].hand.includes('village') && s.players[0].hand.includes('smithy') && s.players[0].hand.includes('estate'),
    '自分はアクション以外(屋敷)が出るまで公開し全部手札へ（村・鍛冶屋・屋敷）');
  ok(s.players[1].discard.includes('gold'), '相手の山札の上(金貨)を捨てさせた');
  ok(s.turn.actions === 1, '念視の泉 +1アクション');
}
console.log('=== 念視の泉: 堀を持つ相手は免疫（山札を触られない）===');
{
  let s = mk();
  s.players[0].hand = ['scrying_pool'];
  s.players[0].deck = ['estate'];
  s.players[1].hand = ['moat'];
  s.players[1].deck = ['gold', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'scrying_pool' });
  s = drain(s);
  ok(!s.players[1].discard.includes('gold') && s.players[1].deck[0] === 'gold', '堀持ちの相手の山札は触られない');
}

/* ============ 大学 ============ */
console.log('=== 大学: +2アクション / コスト5以下のアクションを獲得 ===');
{
  let s = mk();
  s.players[0].hand = ['university'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'university' });
  ok(s.turn.actions === 2, `+2アクション（1使い+2）(実 ${s.turn.actions})`);
  ok(s.pending && s.pending.type === 'university', '獲得の保留');
  s = reduce(s, { type: 'UNIVERSITY_GAIN', card: 'laboratory' });
  ok(s.players[0].discard.includes('laboratory'), 'コスト5のアクション(研究所)を獲得');
}
{
  // 財宝は獲得できない（アクションのみ）
  let s = mk();
  s.players[0].hand = ['university'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'university' });
  const before = s.supply.gold;
  s = reduce(s, { type: 'UNIVERSITY_GAIN', card: 'gold' });
  ok(s.supply.gold === before && s.pending, '金貨(財宝)は大学で獲得できない（据え置き）');
  s = reduce(s, { type: 'UNIVERSITY_GAIN', card: null });
  ok(!s.pending, '獲得しない選択で終了');
}
{
  // ポーション費用のアクション（薬剤師=コイン2+ポーション）は大学で獲得できない（公式ルール）
  let s = mk();
  s.players[0].hand = ['university'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'university' });
  const before = s.supply.apothecary;
  s = reduce(s, { type: 'UNIVERSITY_GAIN', card: 'apothecary' });
  ok(s.supply.apothecary === before && s.pending, 'ポーション費用のアクション(薬剤師)は大学で獲得不可（据え置き）');
  s = reduce(s, { type: 'UNIVERSITY_GAIN', card: 'laboratory' });
  ok(s.players[0].discard.includes('laboratory'), 'ポーション費用なしのアクション(研究所)は獲得できる');
}

/* ============ 錬金術師 ============ */
console.log('=== 錬金術師: +2カード+1アクション / 場にポーションがあれば片付けで山札の上へ ===');
{
  let s = mk();
  s.players[0].hand = ['alchemist', 'potion'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'alchemist' });
  ok(s.turn.actions === 1 && s.players[0].hand.length === 1 + 2, '+2カード+1アクション'); // 手札potion + 2ドロー
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'potion' }); // 場にポーション
  s = reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].hand, 'alchemist') === 1 && !s.players[0].discard.includes('alchemist'), '場にポーション→錬金術師は山札の上へ（次手札に来た）');
}
{
  // ポーションが場に無ければ普通に捨て札へ（山札を十分用意し、片付けドローで捨て札を巻き込まない）
  let s = mk();
  s.players[0].hand = ['alchemist'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'alchemist' });
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].discard.includes('alchemist') || s.players[0].deck.includes('alchemist'), 'ポーション無し→錬金術師は捨て札へ（山札の上には戻さない）');
  ok(count(s.players[0].hand, 'alchemist') === 0, 'ポーション無しなら次手札に錬金術師は来ない');
}

/* ============ 使い魔 ============ */
console.log('=== 使い魔: +1カード+1アクション / 他は呪いを獲得（堀で無効）===');
{
  let s = mk(['A', 'B', 'C']);
  s.players[0].hand = ['familiar'];
  s.players[0].deck = ['copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'familiar' });
  s = drain(s);
  ok(s.turn.actions === 1, '使い魔 +1アクション');
  ok(s.players[1].discard.includes('curse') && s.players[2].discard.includes('curse'), '他の2人が呪いを獲得');
}
{
  let s = mk();
  s.players[0].hand = ['familiar'];
  s.players[0].deck = ['copper', 'copper'];
  s.players[1].hand = ['moat'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'familiar' });
  s = drain(s);
  ok(!s.players[1].discard.includes('curse'), '堀を持つ相手は使い魔の呪いを受けない');
}

/* ============ 賢者の石 ============ */
console.log('=== 賢者の石: 山札+捨て札 5枚につき +1コイン ===');
{
  let s = mk();
  s.players[0].hand = ['philosophers_stone'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper']; // 7
  s.players[0].discard = ['estate', 'estate', 'estate', 'estate', 'estate']; // 5 → 合計12 → +2
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'philosophers_stone' });
  ok(s.turn.coins === 2, `山札7+捨て札5=12枚 → +2コイン (実 ${s.turn.coins})`);
}

/* ============ ゴーレム ============ */
console.log('=== ゴーレム: アクション2枚が出るまで公開→その2枚を使う（非アクションは捨てる）===');
{
  let s = mk();
  s.players[0].hand = ['golem'];
  // 村(アクション)・銅貨(非アクション)・鍛冶屋(アクション) の順。ゴーレムは村と鍛冶屋を使う。
  // 山札は多めに（村+1/鍛冶屋+3のドローで山切れ→捨て札の銅貨が巻き込まれないよう）。
  s.players[0].deck = ['village', 'copper', 'smithy', 'estate', 'estate', 'estate', 'estate', 'estate', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'golem' });
  s = drain(s); // GOLEM_ORDER をCPUで
  ok(s.players[0].discard.includes('copper') && !s.players[0].inPlay.includes('copper'), '間に公開した非アクション(銅貨)は捨てる（使わない）');
  ok(s.players[0].inPlay.includes('village') && s.players[0].inPlay.includes('smithy'), '見つけた2枚(村・鍛冶屋)は場に出て使われた');
  // 村(+2アクション)＋鍛冶屋(+3カード)が適用されている：ゴーレム自体は使用でアクション消費、村で+2
  ok(s.turn.actions === 2, `村の+2アクションが乗る (実 ${s.turn.actions})`);
}

/* ============ 徒弟 ============ */
console.log('=== 徒弟: +1アクション / 廃棄1枚のコイン費用ぶん引く（ポーション費用ありは+2）===');
{
  let s = mk();
  s.players[0].hand = ['apprentice', 'gold', 'estate'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'apprentice' });
  ok(s.turn.actions === 1, '徒弟 +1アクション');
  s = reduce(s, { type: 'APPRENTICE_TRASH', card: 'gold' }); // コスト6 → +6カード
  ok(s.trash.includes('gold'), '金貨を廃棄');
  ok(s.players[0].hand.filter((c) => c === 'copper').length === 5, `コスト6の金貨で6枚引く（山5枚=全部引く）(実 ${s.players[0].hand.filter((c) => c === 'copper').length})`);
}
{
  // ポーション費用カードを廃棄 → +2カード
  let s = mk();
  s.players[0].hand = ['apprentice', 'transmute']; // 変成=コスト0+ポーション1 → 0+2=2カード
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'apprentice' });
  s = reduce(s, { type: 'APPRENTICE_TRASH', card: 'transmute' });
  ok(s.players[0].hand.filter((c) => c === 'copper').length === 2, `ポーション費用カード廃棄で+2カード (実 ${s.players[0].hand.filter((c) => c === 'copper').length})`);
}

/* ============ 支配（Possession） ============ */
// 支配を使い、支配者(0)の手番を終えて被支配ターン(1を0が操作)を開始した状態を返す。
function startPossessedTurn() {
  let s = mk(['A', 'B'], ALC_K, 0);
  s.players[0].hand = ['possession'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'possession' });
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  return s;
}
console.log('=== 支配: 追加ターンの予約と手番順（支配者→被支配ターン→被支配者の通常ターン）===');
{
  let s = mk(['A', 'B'], ALC_K, 0);
  s.players[0].hand = ['possession'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'possession' });
  ok(s.extraTurns && s.extraTurns.length === 1 && s.extraTurns[0].seat === 1 && s.extraTurns[0].possessedBy === 0, '支配で追加ターンが予約（被支配=B, 操作=A）');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1 && s.turn.possessedBy === 0, '被支配ターン開始: active=B, possessedBy=A');
  ok(E.actor(s) === 0, '操作者は支配者(A)');
  // 被支配ターンを終える → B自身の通常ターン
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1 && s.turn.possessedBy == null, '被支配ターンの次は B 自身の通常ターン');
  ok(E.actor(s) === 1, '通常ターンの操作者は B 自身');
  // B の通常ターンを終える → A に戻る
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 0, '回り順が崩れず A に戻る');
}
console.log('=== 支配: 被支配者の獲得カードは支配者が受け取る ===');
{
  let s = startPossessedTurn();
  s.turn.phase = 'buy';
  s.players[1].hand = ['gold'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'gold' });
  const supBefore = s.supply.silver;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.supply.silver === supBefore - 1, 'サプライからは減る（購入は成立）');
  ok((s.turn.possessionGains || []).includes('silver'), '被支配者の獲得は脇に置かれる');
  ok(!s.players[1].discard.includes('silver'), '被支配者(B)は獲得カードを受け取らない');
  s = reduce(s, { type: 'END_TURN' }); // 精算
  ok(s.players[0].discard.includes('silver'), '精算で支配者(A)が獲得した銀貨を受け取る');
}
console.log('=== 支配: 被支配者の廃棄カードは本人に戻る（永久廃棄しない）===');
{
  let s = startPossessedTurn();
  // 被支配ターンのアクションフェーズで変成をプレイし、属州を廃棄させる
  s.players[1].hand = ['transmute', 'province'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'transmute' });
  s = reduce(s, { type: 'TRANSMUTE_TRASH', card: 'province' });
  ok(!s.trash.includes('province'), '支配下で廃棄した被支配者のカードは廃棄置き場に入らない');
  ok((s.turn.possessionTrash || []).includes('province'), '廃棄カードは脇（返却待ち）へ');
  ok((s.turn.possessionGains || []).includes('gold'), '変成で得た金貨は支配者へ（獲得リダイレクト）');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' }); // 精算
  ok(s.players[1].discard.includes('province'), '精算で被支配者(B)に属州が戻る');
  ok(s.players[0].discard.includes('gold'), '支配者(A)は変成の金貨を受け取る');
}
console.log('=== 支配: CPU支配者が被支配ターンを操作しても無限ループせず終わる ===');
{
  let s = startPossessedTurn();
  s.players[0].isCpu = true; s.players[0].cpuLevel = 'normal'; // 支配者A=CPU
  s.players[1].isCpu = true; s.players[1].cpuLevel = 'normal';
  // 被支配ターンをCPUで最後まで進める（actor=Aが操作）
  let g = 0;
  while (s.turn.possessedBy != null && g++ < 200) s = reduce(s, CPU.decide(s));
  ok(g < 200, `被支配ターンがCPU操作で終了した（${g}手）`);
  ok(s.turn.active === 1 && s.turn.possessedBy == null, '被支配ターン後はBの通常ターン');
}
console.log('=== 支配: 3人でも回り順が崩れない（A支配→左隣Bの被支配→B通常→C→A）===');
{
  let s = mk(['A', 'B', 'C'], ALC_K, 0);
  s.players[0].hand = ['possession'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'possession' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1 && s.turn.possessedBy === 0, '被支配ターン=B(操作A)');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1 && s.turn.possessedBy == null, '次はB自身の通常ターン');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 2, '次はC');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 0, '一巡してAに戻る');
}

console.log('=== 支配: 連鎖支配は「元の支配者」が操作し続ける（3人）===');
{
  // A(0)が支配→B(1)の被支配ターンに、A操作でBに支配をプレイさせC(2)を狙う。
  let s = mk(['A', 'B', 'C'], ALC_K, 0);
  s.players[0].hand = ['possession'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'possession' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' }); // B の被支配ターン（A操作）
  ok(s.turn.active === 1 && s.turn.possessedBy === 0, '前提: B被支配ターン(A操作)');
  s.players[1].hand = ['possession']; // A操作でBに支配をプレイさせる
  s = reduce(s, { type: 'PLAY_ACTION', card: 'possession' });
  const et = s.extraTurns[s.extraTurns.length - 1];
  ok(et.seat === 2 && et.possessedBy === 0, '連鎖支配の追加ターンは C・操作は元の支配者 A（Bではない）');
  // Cの被支配ターンへ。獲得はAの捨て札へ、actorはA。
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 2 && s.turn.possessedBy === 0, 'C被支配ターンの操作者は A');
  ok(E.actor(s) === 0, 'actor は A（B ではない）');
  s.turn.phase = 'buy'; s.players[2].hand = ['gold'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'gold' });
  s = reduce(s, { type: 'BUY', card: 'silver' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].discard.includes('silver'), '連鎖支配でCが獲得した銀貨は元の支配者Aへ（Bではない）');
  ok(!s.players[1].discard.includes('silver'), '中間の被支配者Bは受け取らない');
}

/* ============ CPU: 錬金術王国を最後まで詰まらず進める ============ */
console.log('=== CPU同士: 錬金術セットで最後まで進行し、決着する（無限ループ・詰みが無い）===');
{
  // 出荷セット（固定10＝支配込み／ランダム）を全難易度・2〜4人で複数回。詰み無しを検証。
  let allDone = true, total = 0;
  for (let g = 0; g < 24; g++) {
    const k = DOM.kingdomForSet(g % 2 ? 'random-alchemy' : 'alchemy'); // 支配を含む固定セットも回す
    const n = 2 + (g % 3);
    const players = Array.from({ length: n }, (_, i) => ({ name: 'C' + i, isCpu: true, level: ['easy', 'normal', 'hard'][i % 3] }));
    let s = E.createInitialState(players, k, { startActive: 0 });
    let step = 0;
    while (!s.gameOver && step++ < 8000) s = reduce(s, CPU.decide(s));
    if (!s.gameOver) { allDone = false; console.log('    STUCK g' + g + ' k=' + k.join(',')); }
    total += step;
  }
  ok(allDone, 'CPU同士24戦（固定/ランダム×2-4人×全難易度）が全て決着した（無限ループ・詰み無し）');
}
console.log('=== CPU購入: ポーション未所持なら、勝ち筋でもポーション費用カードは選ばない（無限ループ防止）===');
{
  // 空きパイル2・勝勢の hard CPU に、勝って終わるが「ポーション費用」の薬剤師しか無い局面を作る。
  let s = mk(['A', 'B'], ['apothecary', 'village', 'smithy', 'market', 'laboratory', 'festival', 'moat', 'cellar', 'workshop', 'militia'], 0);
  s.players[0].cpuLevel = 'hard'; s.players[0].isCpu = true;
  s.players[0].deck = ['province', 'province', 'province']; // Aが大量リード（勝勢）
  s.supply.estate = 0; s.supply.curse = 0; // 空きパイル2
  s.supply.apothecary = 1; // 買うと3つ目→終了だが、ポーション費用
  s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.potions = 0; s.turn.buys = 1;
  const a = CPU.decide(s);
  ok(a.type !== 'BUY' || a.card !== 'apothecary', 'ポーション0なら薬剤師（勝ち筋でも）を買おうとしない（実 ' + JSON.stringify(a) + '）');
  // 実際に適用しても局面が前進する（no-opの無限ループにならない）
  const s2 = reduce(s, a);
  ok(s2 !== s && (s2.turn.phase !== 'buy' || s2.supply.apothecary === 1), 'CPUの手で局面が前進する（no-op連発でない）');
}

console.log('\n========================================');
console.log('錬金術テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
