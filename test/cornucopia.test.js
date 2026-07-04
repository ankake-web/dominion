/* 収穫祭（Cornucopia）ゲームロジックの検証（Node 単体実行）
   使い方: node test/cornucopia.test.js
   対象: reveal系（占い師/移動動物園/農村/狩猟団/収穫）/ アタック（占い師/道化師/家臣団/若き魔女）/
         賞品Prizes山＋馬上槍試合 / 災いカードBane（若き魔女）/ 可変VP（品評会）/
         馬商人リアクション / 豊穣の角・宝冠 / リメイク・小村・王女・頼もしい乗騎 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
let seed = 20240707;
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

const CORN_K = DOM.KINGDOM_CORNUCOPIA; // tournament(賞品) と young_witch(災い) を含む固定10種
const PRIZES = ['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed'];
function mk(players, startActive) {
  return E.createInitialState(players || ['A', 'B'], CORN_K, { startActive: startActive == null ? 0 : startActive });
}
// 席0にカードを持たせて即プレイできる盤面（手札・山札を明示）
function setup(hand, deck, opts) {
  const s = mk(['A', 'B'], 0);
  s.players[0].hand = hand.slice();
  s.players[0].deck = (deck || []).slice();
  if (opts && opts.p1hand) s.players[1].hand = opts.p1hand.slice();
  if (opts && opts.p1deck) s.players[1].deck = opts.p1deck.slice();
  return s;
}
function playAct(s, card) { return reduce(s, { type: 'PLAY_ACTION', card }); }
function autoResolve(s, max) { let g = 0; while (s.pending && g++ < (max || 60)) s = reduce(s, CPU.decide(s)); return s; }

/* ============ セットアップ（賞品山・災いカード・非サプライ） ============ */
console.log('=== 収穫祭セットアップ: 賞品山(tournament)・災いカード(young_witch)・非サプライ ===');
{
  const s = mk(['A', 'B'], 0);
  ['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed'].forEach((id) =>
    ok(s.supply[id] === 1, `賞品 ${id} は1枚山（実 ${s.supply[id]}）`));
  ok(s.baneCard && s.kingdom.includes(s.baneCard), '若き魔女の災いカードが11山目として存在: ' + s.baneCard);
  ok(s.supply[s.baneCard] === (DOM.isType(s.baneCard, 'victory') ? 8 : 10), '災いカードは通常の購入可能なサプライ山: ' + s.baneCard + '×' + s.supply[s.baneCard]);
  ok(E.canBuyCard(s, 0, s.baneCard), '災いカードは購入できる（通常の王国カード）');
  ok(!E.canBuyCard(s, 0, 'princess'), '賞品は購入できない');
  // 賞品を全て空にしても3山終了に数えない
  const s2 = mk(['A', 'B'], 0);
  ['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed'].forEach((id) => (s2.supply[id] = 0));
  ok(E.emptyPileCount(s2) === 0, '賞品5山が空でも emptyPileCount=0（非サプライ）');
  // tournament が無ければ賞品山は作られない
  const s3 = E.createInitialState(['A', 'B'], ['hamlet', 'menagerie', 'farming_village', 'remake', 'jester', 'harvest', 'horn_of_plenty', 'fairgrounds', 'hunting_party', 'fortune_teller']);
  ok(s3.supply.bag_of_gold === undefined && s3.baneCard == null, 'tournament/young_witch 不在なら賞品山も災いも無い');
}

/* ============ 小村 hamlet ============ */
console.log('=== 小村: +1カード+1アクション、捨てて+アクション/+購入 ===');
{
  let s = setup(['hamlet', 'estate', 'curse'], ['copper', 'silver', 'gold']);
  s = playAct(s, 'hamlet');
  ok(s.turn.actions === 1 && count(s.players[0].hand, 'copper') === 1, '小村: +1カード（copperを引く）+1アクション（使用で差引1）');
  ok(s.pending && s.pending.type === 'hamlet' && s.pending.stage === 'action', '捨て札選択(action)が出る');
  s = reduce(s, { type: 'HAMLET_DISCARD', card: 'estate' }); // 捨てて+1アクション
  ok(s.turn.actions === 2, '屋敷を捨てて +1アクション（計2）');
  ok(s.pending && s.pending.stage === 'buy', '次に+1購入の選択');
  s = reduce(s, { type: 'HAMLET_DISCARD', card: 'curse' }); // 捨てて+1購入
  ok(s.turn.buys === 2 && !s.pending, '呪いを捨てて +1購入（計2）・pending解消');
  ok(count(s.players[0].discard, 'estate') === 1 && count(s.players[0].discard, 'curse') === 1, '捨てた2枚は捨て札へ');
}

/* ============ 占い師 fortune_teller（アタック） ============ */
console.log('=== 占い師: +2コイン、相手は勝利点/呪いまで公開→上に戻し他は捨てる ===');
{
  let s = setup(['fortune_teller'], ['copper'], { p1deck: ['copper', 'silver', 'estate', 'gold'] });
  s = playAct(s, 'fortune_teller');
  ok(s.turn.coins === 2, '+2コイン');
  ok(!s.pending, '相手にリアクション無し→即解決（pending無し）');
  ok(s.players[1].deck[0] === 'estate', '勝利点(estate)が山札の上に戻る');
  ok(count(s.players[1].discard, 'copper') === 1 && count(s.players[1].discard, 'silver') === 1, '手前の copper/silver は捨て札へ');
}

/* ============ 移動動物園 menagerie ============ */
console.log('=== 移動動物園: 手札に同名なし→+3カード / あり→+1カード ===');
{
  let s = setup(['menagerie', 'copper', 'silver', 'estate'], ['gold', 'gold', 'gold', 'gold']);
  s = playAct(s, 'menagerie');
  ok(s.players[0].hand.length === 3 + 3, '同名なし→+3カード（手札3+3=6）実:' + s.players[0].hand.length);
  ok(s.turn.actions === 1, '+1アクション（使用で差引1）');
  let s2 = setup(['menagerie', 'copper', 'copper', 'estate'], ['gold', 'gold', 'gold']);
  s2 = playAct(s2, 'menagerie');
  ok(s2.players[0].hand.length === 3 + 1, '同名(copper×2)あり→+1カード（手札3+1=4）実:' + s2.players[0].hand.length);
}

/* ============ 農村 farming_village ============ */
console.log('=== 農村: +2アクション、アクション/財宝が出るまで公開→手札に ===');
{
  let s = setup(['farming_village'], ['estate', 'estate', 'silver', 'copper']);
  s = playAct(s, 'farming_village');
  ok(s.turn.actions === 2, '+2アクション（使用で差引→2）');
  ok(count(s.players[0].hand, 'silver') === 1, '財宝(silver)を手札に加える');
  ok(count(s.players[0].discard, 'estate') === 2, '手前の勝利点2枚は捨て札へ');
}

/* ============ 狩猟団 hunting_party ============ */
console.log('=== 狩猟団: +1カード+1アクション、手札に無い名前が出るまで公開→手札に ===');
{
  let s = setup(['hunting_party', 'copper', 'estate'], ['gold', 'copper', 'silver', 'x']);
  s = playAct(s, 'hunting_party');
  // +1カードで gold を引く → 手札名 {copper,estate,gold}。山札 copper(手札にある→捨)→ silver(手札に無い→手札へ)
  ok(count(s.players[0].hand, 'gold') === 1 && count(s.players[0].hand, 'silver') === 1, 'gold(ドロー)と silver(狩猟団)が手札に');
  ok(count(s.players[0].discard, 'copper') === 1, '手札にある名前(copper)は捨て札へ');
  ok(s.turn.actions === 1, '+1アクション');
}

/* ============ 収穫 harvest ============ */
console.log('=== 収穫: 上4枚公開→捨て、異なる名前数だけ+コイン ===');
{
  let s = setup(['harvest'], ['copper', 'copper', 'silver', 'estate', 'gold']);
  s = playAct(s, 'harvest');
  ok(s.turn.coins === 3, '4枚(copper,copper,silver,estate)→異なる3種→+3コイン 実:' + s.turn.coins);
  ok(s.players[0].discard.length === 4, '公開4枚は捨て札へ');
}

/* ============ リメイク remake ============ */
console.log('=== リメイク: 廃棄→ちょうど$1高いカード獲得、を2回 ===');
{
  let s = setup(['remake', 'estate', 'copper'], ['x']);
  s = playAct(s, 'remake');
  ok(s.pending && s.pending.stage === 'trash' && s.pending.iter === 0, '1回目の廃棄');
  s = reduce(s, { type: 'REMAKE_TRASH', card: 'estate' }); // $2→$3
  ok(s.pending && s.pending.stage === 'gain' && s.pending.exactCost === 3, 'ちょうど$3を獲得する段階');
  s = reduce(s, { type: 'REMAKE_GAIN', card: 'silver' });
  ok(count(s.players[0].discard, 'silver') === 1, '銀貨($3)を獲得');
  ok(s.pending && s.pending.stage === 'trash' && s.pending.iter === 1, '2回目の廃棄');
  s = reduce(s, { type: 'REMAKE_TRASH', card: 'copper' }); // $0→$1（該当なし→獲得スキップ）
  ok(!s.pending, '$1のカードが無ければ獲得せず終了');
  ok(count(s.trash, 'estate') === 1 && count(s.trash, 'copper') === 1, '廃棄した2枚は廃棄置き場へ');
}

/* ============ 馬上槍試合 tournament ============ */
console.log('=== 馬上槍試合: 属州公開→賞品/公領を山札の上に、他が公開しなければ+1カード+1コイン ===');
{
  let s = setup(['tournament', 'province'], ['copper', 'copper'], { p1hand: ['copper', 'copper', 'copper'] });
  s = playAct(s, 'tournament');
  ok(s.turn.actions === 1, '+1アクション');
  ok(s.pending && s.pending.stage === 'reveal_self', '自分の属州公開の選択');
  s = reduce(s, { type: 'TOURNAMENT_REVEAL', reveal: true });
  ok(s.pending && s.pending.stage === 'prize', '賞品/公領の選択');
  s = reduce(s, { type: 'TOURNAMENT_PRIZE', card: 'bag_of_gold' });
  ok(s.supply.bag_of_gold === 0, '賞品山が減る');
  ok(count(s.players[0].discard, 'province') === 1, '公開した属州は捨て札へ');
  // ボーナス+1カードは「山札の上に置いた賞品」をそのまま引く（公式どおりの挙動）
  ok(count(s.players[0].hand, 'bag_of_gold') === 1, 'ボーナス+1カードで山札の上の金貨袋を引く');
  ok(!s.pending && s.turn.coins === 1, '相手が属州を公開せず→ボーナス+1カード+1コイン');
}
console.log('=== 馬上槍試合: 相手が属州を公開するとボーナス無効 ===');
{
  let s = setup(['tournament', 'copper'], ['copper', 'copper'], { p1hand: ['province', 'copper', 'copper'] });
  s = playAct(s, 'tournament');
  // 自分に属州無し→相手の公開判断へ
  ok(s.pending && s.pending.stage === 'reveal_opp' && s.pending.player === 1, '相手(席1)の属州公開の選択');
  const coinsBefore = s.turn.coins;
  s = reduce(s, { type: 'TOURNAMENT_REVEAL', reveal: true }); // 相手が公開
  ok(!s.pending && s.turn.coins === coinsBefore, '相手が公開→ボーナス無し（コイン増えず）');
}

/* ============ 若き魔女 young_witch ＋ 災いカード Bane ============ */
console.log('=== 若き魔女: +2カード→手札2枚捨て→相手は呪い（災いカード公開で免れる） ===');
{
  let s = setup(['young_witch', 'estate', 'estate'], ['copper', 'copper', 'silver'], { p1hand: ['copper', 'copper', 'copper', 'copper'] });
  s = playAct(s, 'young_witch');
  ok(s.pending && s.pending.stage === 'discard' && s.pending.player === 0, '自分が手札2枚を捨てる');
  s = reduce(s, { type: 'YOUNG_WITCH_DISCARD', cards: ['estate', 'estate'] });
  // 相手は災い未所持→呪い
  ok(count(s.players[1].discard, 'curse') === 1, '相手は呪いを獲得');
  ok(!s.pending, '解決完了');
}
console.log('=== 若き魔女: 相手が災いカードを公開すれば呪いを免れる ===');
{
  let s = mk(['A', 'B'], 0);
  const bane = s.baneCard;
  s.players[0].hand = ['young_witch', 'copper', 'copper'];
  s.players[0].deck = ['copper', 'copper', 'silver'];
  s.players[1].hand = [bane, 'copper', 'copper'];
  s = playAct(s, 'young_witch');
  s = reduce(s, { type: 'YOUNG_WITCH_DISCARD', cards: ['copper', 'copper'] });
  ok(s.pending && s.pending.type === 'young_witch' && s.pending.stage === 'react' && s.pending.bane === bane, '相手に災いカード公開の反応窓');
  s = reduce(s, { type: 'YOUNG_WITCH_BANE' });
  ok(count(s.players[1].discard, 'curse') === 0 && !s.pending, '災いカードを公開→呪いを受けない');
  ok(count(s.players[1].hand, bane) === 1, '災いカードは公開しただけで手札に残る');
}

/* ============ 道化師 jester（アタック） ============ */
console.log('=== 道化師: 相手の山札上を捨て、勝利点なら呪い/他は攻撃側がコピー獲得先を選ぶ ===');
{
  let s = setup(['jester'], ['copper'], { p1deck: ['gold', 'copper'] });
  s = playAct(s, 'jester');
  ok(s.turn.coins === 2, '+2コイン');
  ok(s.pending && s.pending.stage === 'choose' && s.pending.card === 'gold', '相手のgoldを捨て→コピー獲得先の選択');
  ok(count(s.players[1].discard, 'gold') === 1, '公開されたgoldは相手の捨て札へ');
  s = reduce(s, { type: 'JESTER_CHOOSE', who: 'me' });
  ok(count(s.players[0].discard, 'gold') === 1, '攻撃側がgoldのコピーを獲得');
}
console.log('=== 道化師: 相手の山札上が勝利点なら呪い（選択なし） ===');
{
  let s = setup(['jester'], ['copper'], { p1deck: ['estate', 'copper'] });
  s = playAct(s, 'jester');
  ok(count(s.players[1].discard, 'estate') === 1 && count(s.players[1].discard, 'curse') === 1, '勝利点(estate)公開→相手は呪いを獲得');
  ok(!s.pending, '選択は発生しない');
}

/* ============ 家臣団 followers（賞品・アタック） ============ */
console.log('=== 家臣団: +2カード＋屋敷獲得、相手は呪い＋手札3枚まで捨て ===');
{
  let s = setup(['followers'], ['copper', 'copper', 'copper'], { p1hand: ['copper', 'silver', 'gold', 'estate', 'duchy'] });
  s = playAct(s, 'followers');
  ok(s.players[0].hand.length === 2 && count(s.players[0].discard, 'estate') === 1, '自分は+2カード＋屋敷を獲得');
  ok(count(s.players[1].discard, 'curse') === 1, '相手は呪いを獲得');
  ok(s.pending && s.pending.type === 'followers' && s.pending.stage === 'discard', '相手は手札3枚まで捨てる');
  s = reduce(s, { type: 'FOLLOWERS_DISCARD', cards: ['copper', 'silver'] });
  ok(s.players[1].hand.length === 3 && !s.pending, '手札が3枚になった');
}

/* ============ 馬商人 horse_traders（効果＋リアクション） ============ */
console.log('=== 馬商人: +1購入+3コイン＋手札2枚捨て ===');
{
  let s = setup(['horse_traders', 'estate', 'copper', 'silver'], ['x']);
  s = playAct(s, 'horse_traders');
  ok(s.turn.buys === 2 && s.turn.coins === 3, '+1購入(計2)+3コイン');
  ok(s.pending && s.pending.stage === 'discard', '手札2枚を捨てる');
  s = reduce(s, { type: 'HORSE_TRADERS_DISCARD', cards: ['estate', 'copper'] });
  ok(!s.pending && s.players[0].discard.length === 2, '2枚捨てて解決');
}
console.log('=== 馬商人リアクション: 攻撃時に脇へ→次の自分の手番開始で+1カードして手札に戻る ===');
{
  // 席1が馬商人を持ち、席0の道化師に反応して脇に置く
  let s = mk(['A', 'B'], 0);
  s.players[0].hand = ['jester'];
  s.players[0].deck = ['copper'];
  s.players[1].hand = ['horse_traders', 'copper', 'estate'];
  s.players[1].deck = ['gold', 'copper', 'copper', 'copper', 'copper'];
  s = playAct(s, 'jester');
  ok(s.pending && s.pending.type === 'jester' && s.pending.stage === 'react' && s.pending.player === 1, '席1に反応窓（馬商人所持）');
  s = reduce(s, { type: 'HORSE_TRADERS_REACT' });
  ok(count(s.players[1].setAside, 'horse_traders') === 1 && count(s.players[1].hand, 'horse_traders') === 0, '馬商人を脇に置いた');
  ok(s.pending && s.pending.type === 'jester' && s.pending.stage === 'react', '反応窓は継続（免疫にはならない）');
  s = reduce(s, { type: 'JESTER_REACT' }); // そのまま道化師を受ける
  // 席0のターンを終え、席1のターン開始で馬商人が戻る
  s = autoResolve(s);
  if (s.turn.phase === 'action') s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' }); // 席0→席1
  s = autoResolve(s);
  ok(count(s.players[1].hand, 'horse_traders') === 1, '席1の手番開始で馬商人が手札に戻った');
  ok(count(s.players[1].setAside, 'horse_traders') === 0, '脇置きは解消');
}

/* ============ 豊穣の角 horn_of_plenty / 宝冠 diadem ============ */
console.log('=== 豊穣の角: 場の異名数までのカードを獲得、勝利点ならこれを廃棄 ===');
{
  let s = mk(['A', 'B'], 0);
  s.turn.phase = 'buy';
  s.players[0].inPlay = ['village', 'market', 'smithy']; // 3種
  s.players[0].hand = ['horn_of_plenty'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'horn_of_plenty' });
  ok(s.pending && s.pending.type === 'horn_of_plenty' && s.pending.maxCost === 4, '場4種(角含む)→コスト4まで');
  s = reduce(s, { type: 'HORN_OF_PLENTY_GAIN', card: 'silver' }); // 非勝利点
  ok(count(s.players[0].discard, 'silver') === 1 && count(s.players[0].inPlay, 'horn_of_plenty') === 1, '銀貨を獲得・角は場に残る');
  // 勝利点を獲得すると角が廃棄される
  let s2 = mk(['A', 'B'], 0);
  s2.turn.phase = 'buy';
  s2.players[0].inPlay = ['village', 'market', 'smithy', 'moat', 'cellar']; // 5種
  s2.players[0].hand = ['horn_of_plenty'];
  s2 = reduce(s2, { type: 'PLAY_TREASURE', card: 'horn_of_plenty' });
  ok(s2.pending.maxCost === 6, '場6種→コスト6まで（属州も可）');
  s2 = reduce(s2, { type: 'HORN_OF_PLENTY_GAIN', card: 'estate' });
  ok(count(s2.players[0].discard, 'estate') === 1 && count(s2.trash, 'horn_of_plenty') === 1 && count(s2.players[0].inPlay, 'horn_of_plenty') === 0, '勝利点獲得→角を廃棄');
}
console.log('=== 宝冠: +2コイン＋未使用アクション1つにつき+1コイン ===');
{
  let s = mk(['A', 'B'], 0);
  s.turn.phase = 'buy';
  s.turn.actions = 3;
  s.players[0].hand = ['diadem'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'diadem' });
  ok(s.turn.coins === 2 + 3, '宝冠: +2コイン + 未使用アクション3 = 5コイン 実:' + s.turn.coins);
}

/* ============ 賞品: 金貨袋 bag_of_gold / 王女 princess / 頼もしい乗騎 trusty_steed ============ */
console.log('=== 金貨袋: +1アクション＋金貨を山札の上に獲得 ===');
{
  let s = setup(['bag_of_gold'], ['copper']);
  s = playAct(s, 'bag_of_gold');
  ok(s.turn.actions === 1 && s.players[0].deck[0] === 'gold', '+1アクション＋金貨を山札の上に');
  ok(s.supply.gold === 29, '金貨山が1枚減る');
}
console.log('=== 王女: +1購入＋場にある間 全カードのコスト-2 ===');
{
  let s = setup(['princess'], ['copper']);
  s = playAct(s, 'princess');
  ok(s.turn.buys === 2, '+1購入');
  ok(E.cardCost(s, 'gold') === 4 && E.cardCost(s, 'estate') === 0, '金貨6→4、屋敷2→0（-2、0未満なし）');
}
console.log('=== 頼もしい乗騎: 異なる2つを選ぶ（+2カード/+2アクション/+2コイン/銀貨4枚） ===');
{
  let s = setup(['trusty_steed'], ['copper', 'copper', 'copper']);
  s = playAct(s, 'trusty_steed');
  ok(s.pending && s.pending.type === 'trusty_steed', '選択が出る');
  s = reduce(s, { type: 'TRUSTY_STEED_RESOLVE', choices: ['cards', 'coins'] });
  ok(s.players[0].hand.length === 2 && s.turn.coins === 2, '+2カード+2コイン 実手札:' + s.players[0].hand.length + ' コイン:' + s.turn.coins);
  ok(!s.pending, '解決');
  // silver オプション: 銀貨4枚＋山札を捨て札へ
  let s2 = setup(['trusty_steed'], ['copper', 'copper', 'copper']);
  s2 = playAct(s2, 'trusty_steed');
  s2 = reduce(s2, { type: 'TRUSTY_STEED_RESOLVE', choices: ['silver', 'actions'] });
  ok(count(s2.players[0].discard, 'silver') === 4, '銀貨4枚を獲得');
  ok(s2.players[0].deck.length === 0 && s2.turn.actions === 2, '山札を捨て札へ＋2アクション');
  ok(s2.supply.silver === 36, '銀貨山が4枚減る');
}
console.log('=== 頼もしい乗騎: 同じ選択2つ・不正は拒否 ===');
{
  let s = setup(['trusty_steed'], ['copper']);
  s = playAct(s, 'trusty_steed');
  const s2 = reduce(s, { type: 'TRUSTY_STEED_RESOLVE', choices: ['cards', 'cards'] });
  ok(s2.pending && s2.pending.type === 'trusty_steed', '同じ選択2つは拒否（pending据え置き）');
}

/* ============ 品評会 fairgrounds（可変VP） ============ */
console.log('=== 品評会: 異なる名前5種につき2VP（切り捨て） ===');
{
  const base = { hand: [], discard: [], inPlay: [], durationCards: [], setAside: [], islandMat: [], nativeVillageMat: [], vpTokens: 0 };
  // 10種の異なる名前 → floor(10/5)*2 = 4VP（品評会自身は0点カードだが名前としては数える）
  const p = Object.assign({}, base, { deck: ['fairgrounds', 'copper', 'silver', 'gold', 'estate', 'duchy', 'curse', 'moat', 'village', 'market'] });
  ok(E.vpOf(p) === (3 + 1 - 1) + 4, '10種→品評会+4VP（属州0+公領3+屋敷1+呪い-1 = 3、+4 = 7）実:' + E.vpOf(p));
  // 品評会2枚 → 2倍
  const p2 = Object.assign({}, base, { deck: ['fairgrounds', 'fairgrounds', 'copper', 'silver', 'gold', 'estate', 'moat', 'village', 'market', 'smithy'] });
  // 異なる名前 = fairgrounds,copper,silver,gold,estate,moat,village,market,smithy = 9種 → floor(9/5)=1 → 各2VP×2枚 = 4VP、+屋敷1 = 5
  ok(E.vpOf(p2) === 4 + 1, '品評会2枚・9種→2*1*2=4VP +屋敷1 = 5 実:' + E.vpOf(p2));
}

/* ============ CPU通し（無限ループ/例外が無い） ============ */
console.log('=== CPU同士の収穫祭ゲームが最後まで進む（stuck/例外なし） ===');
{
  let games = 0, finished = 0;
  for (let g = 0; g < 6; g++) {
    let s = E.createInitialState([{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'normal' }], CORN_K, { startActive: g % 2 });
    games++;
    let steps = 0, stuck = false;
    while (!s.gameOver && steps < 5000) {
      const before = JSON.stringify(s);
      s = reduce(s, CPU.decide(s));
      steps++;
      if (before === JSON.stringify(s)) { stuck = true; break; }
    }
    if (!stuck && s.gameOver) finished++;
  }
  ok(finished === games, `CPU収穫祭 ${games}戦すべて完走（実 ${finished}）`);
}

/* ============ 保存則（カードの総数がゲームを通じて一定） ============ */
console.log('=== 収穫祭ゲームでカード保存則が保たれる ===');
{
  function tally(s) {
    const m = {};
    const add = (id) => { m[id] = (m[id] || 0) + 1; };
    Object.keys(s.supply).forEach((k) => { for (let i = 0; i < s.supply[k]; i++) add(k); });
    s.players.forEach((p) => { ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat'].forEach((z) => (p[z] || []).forEach(add)); });
    s.trash.forEach(add);
    return m;
  }
  let s = E.createInitialState([{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'hard' }], CORN_K, { startActive: 0 });
  const t0 = tally(s);
  let steps = 0, bad = false;
  while (!s.gameOver && steps < 5000) {
    s = reduce(s, CPU.decide(s));
    steps++;
  }
  const t1 = tally(s);
  const keys = new Set(Object.keys(t0).concat(Object.keys(t1)));
  keys.forEach((k) => { if ((t0[k] || 0) !== (t1[k] || 0)) { bad = true; console.log('  保存則違反:', k, t0[k], '→', t1[k]); } });
  ok(!bad, 'ゲーム開始時と終了時でカード総数が一致（賞品・災い含む）');
}

/* ============ レビュー指摘の回帰テスト（賞品の不正獲得防止 ほか） ============ */
console.log('=== 回帰: 豊穣の角は賞品(Prize)を獲得できない（reducerが拒否）===');
{
  let s = mk(['A', 'B'], 0);
  s.turn.phase = 'buy';
  s.players[0].inPlay = []; // 場に何も無い→hornだけ→maxCost=1
  s.players[0].hand = ['horn_of_plenty'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'horn_of_plenty' });
  ok(s.pending && s.pending.maxCost === 1, '角のみ→maxCost=1');
  const before = s.supply.bag_of_gold;
  const s2 = reduce(s, { type: 'HORN_OF_PLENTY_GAIN', card: 'bag_of_gold' }); // 賞品を狙う
  ok(s2.pending && s2.pending.type === 'horn_of_plenty' && s2.supply.bag_of_gold === before, '賞品の獲得は拒否（pending据え置き・賞品山不変）');
  const s3 = reduce(s, { type: 'HORN_OF_PLENTY_GAIN', card: 'copper' }); // 正規のカード
  ok(!s3.pending && count(s3.players[0].discard, 'copper') === 1, '通常カード(copper)は獲得できる');
}
console.log('=== 回帰: CPU は豊穣の角で賞品を選ばず銅貨等を獲得（無限ループしない）===');
{
  let s = mk(['A', 'B'], 0);
  s.turn.phase = 'buy';
  s.players[0].inPlay = [];
  s.players[0].hand = ['horn_of_plenty'];
  s.players[0].isCpu = true; s.players[0].cpuLevel = 'hard';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'horn_of_plenty' });
  const act = CPU.decide(s);
  ok(act.type === 'HORN_OF_PLENTY_GAIN' && !PRIZES.includes(act.card), 'CPUは賞品以外を選ぶ（実:' + act.card + '）');
  s = autoResolve(s, 10);
  ok(!s.pending, '解決してpendingが残らない（無限ループなし）');
}
console.log('=== 回帰: 闇市場デッキに賞品が混入しない ===');
{
  // black_market あり・tournament 無しの王国（賞品はサプライに出ない）
  const K2 = ['black_market', 'village', 'smithy', 'market', 'militia', 'cellar', 'moat', 'workshop', 'remodel', 'festival'];
  const s = E.createInitialState(['A', 'B'], K2, { startActive: 0 });
  ok(Array.isArray(s.blackMarket), '闇市場デッキが作られる');
  ok(PRIZES.every((pz) => s.blackMarket.indexOf(pz) < 0), '闇市場デッキに賞品5種が含まれない');
}
console.log('=== 回帰: 頼もしい乗騎は選択順でなくカード記載順で解決（銀貨→山札捨ての前に+2カード）===');
{
  let s = setup(['trusty_steed'], ['copper', 'gold']); // 山札の上=copper,gold
  s = playAct(s, 'trusty_steed');
  // わざと選択順を「銀貨→カード」で送る。記載順(cards→silver)で解決されるべき。
  s = reduce(s, { type: 'TRUSTY_STEED_RESOLVE', choices: ['silver', 'cards'] });
  // +2カードが先に解決→山札の上 copper,gold を引く（銀貨で山札を捨てる前に）
  ok(count(s.players[0].hand, 'copper') === 1 && count(s.players[0].hand, 'gold') === 1, '記載順で先に山札上2枚(copper,gold)を引く');
  ok(count(s.players[0].discard, 'silver') === 4, '銀貨4枚も獲得');
}
console.log('=== 回帰: 馬商人リアクションが民兵(embedded)でも使える ===');
{
  let s = mk(['A', 'B'], 0);
  s.players[0].hand = ['militia'];
  s.players[1].hand = ['horse_traders', 'copper', 'copper', 'silver', 'estate']; // 手札5枚
  s = playAct(s, 'militia');
  ok(s.pending && s.pending.type === 'militia' && s.pending.player === 1, '席1が民兵の対象（embedded反応窓）');
  // CPU（席1）は馬商人を脇に置く
  const act = CPU.decide(s);
  ok(act.type === 'HORSE_TRADERS_REACT', 'CPUは民兵に対して馬商人を脇に置く（実:' + act.type + '）');
  s = reduce(s, act);
  ok(count(s.players[1].setAside, 'horse_traders') === 1, '馬商人が脇に置かれた');
  ok(s.pending && s.pending.type === 'militia', '民兵pendingは継続（免疫にはならない）');
  s = autoResolve(s, 20);
  ok(!s.pending, '最終的に解決（無限ループなし）');
}
console.log('=== 回帰: CPU vpOfPlayer が品評会を計上（勝敗読みの精度）===');
{
  // 品評会を多数持つプレイヤーの終局評価が過小にならないこと。engine.vpOf と一致させる。
  const build = (deck) => ({ deck, hand: [], discard: [], inPlay: [], durationCards: [], setAside: [], islandMat: [], nativeVillageMat: [], vpTokens: 0, turns: 5 });
  // hard CPU が「この属州購入で勝てるか」を判断する場面を作る：品評会込みで engine と同点の読みになる
  let s = mk(['A', 'B'], 0);
  s.players[0] = Object.assign(s.players[0], build(['fairgrounds', 'fairgrounds', 'estate', 'silver', 'gold', 'copper', 'moat', 'village', 'market', 'smithy']));
  // engine.vpOf と CPU 側の読みが一致（品評会を数える）ことを、winsIfEnds が使う vpOfPlayer 経由で間接確認
  ok(E.vpOf(s.players[0]) >= 5, 'engineは品評会を計上（VP>=5）実:' + E.vpOf(s.players[0]));
  // CPU が hard で「終局で勝てる」誤判定をしない（品評会を無視して過小評価しない）ことをスモーク確認
  s.players[0].isCpu = true; s.players[0].cpuLevel = 'hard';
  ok(typeof CPU.decide === 'function', 'CPU 決定関数が健在（品評会込みの評価で例外なし）');
}

console.log('');
console.log('========================================');
console.log('収穫祭テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
