/* 拡張（陰謀）カードのエンジン単体テスト。
   使い方: node test/intrigue.test.js
   各カードの効果・選択解決・コスト軽減・公爵得点・拷問人(堀)を検証する。 */
require('../js/cards.js');
require('../js/engine.js');
const DOM = global.DOM;
const E = DOM.engine;

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
function reduce(s, a) { return E.reduce(s, a); }
function count(arr, id) { return arr.filter((c) => c === id).length; }

// 任意の手札・サプライで2人状態を作る（席0が手番、アクションフェーズ）
function setup(handP0, kingdom) {
  const s = E.createInitialState(['A', 'B'], kingdom || DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = handP0.slice();
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'estate', 'silver', 'gold'];
  s.players[0].discard = [];
  s.players[0].inPlay = [];
  return s;
}

console.log('=== 中庭: +3カード→手札1枚を山札の上へ ===');
{
  let s = setup(['courtyard', 'estate', 'duchy']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'courtyard' });
  ok(s.players[0].hand.length === 2 + 3, '中庭で手札2→+3=5: ' + s.players[0].hand.length);
  ok(s.pending && s.pending.type === 'courtyard', '山札の上に置く選択待ち');
  const topBefore = s.players[0].deck.length;
  s = reduce(s, { type: 'COURTYARD_PUT', card: 'estate' });
  ok(s.players[0].deck[0] === 'estate', '指定カードが山札の一番上に: ' + s.players[0].deck[0]);
  ok(s.players[0].deck.length === topBefore + 1, '山札+1');
  ok(s.pending === null, '解決後は選択待ち解除');
}

console.log('=== 従者: 異なる2つを選ぶ ===');
{
  let s = setup(['pawn']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'pawn' });
  const before = { actions: s.turn.actions, buys: s.turn.buys, coins: s.turn.coins, hand: s.players[0].hand.length };
  s = reduce(s, { type: 'PAWN_RESOLVE', choices: ['card', 'coin'] });
  ok(s.players[0].hand.length === before.hand + 1 && s.turn.coins === before.coins + 1, '+1カード&+1コイン');
  // 同じものを2つ/3つ/1つは拒否
  let s2 = setup(['pawn']);
  s2 = reduce(s2, { type: 'PLAY_ACTION', card: 'pawn' });
  const t0 = JSON.stringify(s2.turn);
  s2 = reduce(s2, { type: 'PAWN_RESOLVE', choices: ['card', 'card'] });
  ok(JSON.stringify(s2.turn) === t0 && s2.pending, '同じ選択2つは拒否（状態不変）');
  s2 = reduce(s2, { type: 'PAWN_RESOLVE', choices: ['action'] });
  ok(s2.pending, '1つだけは拒否');
}

console.log('=== 寂れた村: +2アクション、アクション無しなら+2カード ===');
{
  // 手札に他のアクションがある→ドローなし
  let s = setup(['shanty_town', 'village', 'copper']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'shanty_town' });
  ok(s.turn.actions === 1 - 1 + 2, '+2アクション: ' + s.turn.actions);
  ok(s.players[0].hand.length === 2, '手札にアクション(村)あり→ドロー無し: ' + s.players[0].hand.length);
  // 手札がアクション無し→+2カード
  let s2 = setup(['shanty_town', 'copper', 'estate']);
  s2 = reduce(s2, { type: 'PLAY_ACTION', card: 'shanty_town' });
  ok(s2.players[0].hand.length === 2 + 2, 'アクション無し→+2カード: ' + s2.players[0].hand.length);
}

console.log('=== 執事: +2カード / +2コイン / 2枚廃棄 ===');
{
  let s = setup(['steward', 'copper', 'estate', 'curse']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'steward' });
  let a = reduce(s, { type: 'STEWARD_RESOLVE', choice: 'coins' });
  ok(a.turn.coins === 2 && a.pending === null, '+2コイン');
  let b = reduce(s, { type: 'STEWARD_RESOLVE', choice: 'cards' });
  ok(b.players[0].hand.length === 3 + 2 && b.pending === null, '+2カード');
  let c = reduce(s, { type: 'STEWARD_RESOLVE', choice: 'trash' });
  ok(c.pending && c.pending.stage === 'trash', '廃棄ステージへ');
  c = reduce(c, { type: 'STEWARD_TRASH', cards: ['curse', 'estate'] });
  ok(count(c.trash, 'curse') === 1 && count(c.trash, 'estate') === 1, '2枚廃棄');
  ok(c.players[0].hand.length === 1 && c.pending === null, '手札から2枚減って解決');
  // 1枚だけ廃棄は拒否
  let d = reduce(s, { type: 'STEWARD_RESOLVE', choice: 'trash' });
  const dt = JSON.stringify(d.players[0].hand);
  d = reduce(d, { type: 'STEWARD_TRASH', cards: ['curse'] });
  ok(JSON.stringify(d.players[0].hand) === dt && d.pending, 'ちょうど2枚でないと拒否');
}

console.log('=== 願いの井戸: 宣言が当たれば手札に ===');
{
  let s = setup(['wishing_well']);
  s.players[0].deck = ['gold', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'wishing_well' }); // +1カード(gold引く)+1アクション, 山の上=copper
  ok(s.players[0].hand.includes('gold'), '+1カードで金貨を引いた');
  ok(s.turn.actions === 1, '+1アクション: ' + s.turn.actions);
  const handBefore = s.players[0].hand.length;
  let hit = reduce(s, { type: 'WISHING_RESOLVE', card: 'copper' }); // 当たり
  ok(hit.players[0].hand.length === handBefore + 1, '当たりで手札+1');
  let miss = reduce(s, { type: 'WISHING_RESOLVE', card: 'province' }); // はずれ
  ok(miss.players[0].hand.length === handBefore, 'はずれで手札不変');
  ok(miss.players[0].deck[0] === 'copper', 'はずれは山の上のまま');
}

console.log('=== 男爵: 屋敷を捨てて+4 / 無ければ屋敷獲得 ===');
{
  let s = setup(['baron', 'estate']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'baron' });
  ok(s.turn.buys === 2, '+1購入');
  ok(s.pending && s.pending.type === 'baron', '屋敷ありで選択待ち');
  let disc = reduce(s, { type: 'BARON_RESOLVE', discard: true });
  ok(disc.turn.coins === 4 && count(disc.players[0].discard, 'estate') === 1, '屋敷を捨てて+4コイン');
  // 屋敷なし→即屋敷を獲得
  let s2 = setup(['baron', 'copper']);
  const estSup = s2.supply.estate;
  s2 = reduce(s2, { type: 'PLAY_ACTION', card: 'baron' });
  ok(s2.pending === null && count(s2.players[0].discard, 'estate') === 1 && s2.supply.estate === estSup - 1, '屋敷なし→屋敷を獲得');
}

console.log('=== 橋: コスト軽減（購入・gain・翌ターンリセット） ===');
{
  let s = setup(['bridge', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bridge' });
  ok(s.turn.buys === 2 && s.turn.coins === 1 && s.turn.costReduction === 1, '+1購入+1コイン+コスト軽減1');
  ok(E.cardCost(s, 'province') === 7, '属州が7に: ' + E.cardCost(s, 'province'));
  // 購入フェーズで属州を7コインで買えること
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' }); // copper*7 + silver*2 = 9 (+1 from bridge = 10 coins)
  const before = s.supply.province;
  s = reduce(s, { type: 'BUY', card: 'province' });
  ok(s.supply.province === before - 1, '橋で属州を購入できた');
  ok(s.turn.coins === 10 - 7, '実コスト7を支払った: ' + s.turn.coins);
  // ターン終了で軽減リセット
  s = reduce(s, { type: 'END_TURN' });
  ok((s.turn.costReduction || 0) === 0, '翌ターンは軽減リセット');
}

console.log('=== 共謀者: アクション3回以上で+1カード+1アクション ===');
{
  // village, village, conspirator の順に使うと conspirator は3手目→ボーナス
  let s = setup(['village', 'village', 'conspirator', 'copper', 'copper']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  const handBefore = s.players[0].hand.length;
  const actBefore = s.turn.actions;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'conspirator' });
  ok(s.turn.coins === 2, '+2コイン');
  ok(s.players[0].hand.length === handBefore - 1 + 1, '3手目→+1カード（使用で-1, ボーナス+1）');
  ok(s.turn.actions === actBefore - 1 + 1, '3手目→+1アクション');
  // 1手目で使うとボーナス無し
  let s2 = setup(['conspirator', 'copper']);
  s2 = reduce(s2, { type: 'PLAY_ACTION', card: 'conspirator' });
  ok(s2.turn.coins === 2 && s2.turn.actions === 0 && s2.players[0].hand.length === 1, '1手目はボーナス無し');
}

console.log('=== 鉄工所: 種別ボーナス ===');
{
  // 財宝(銀貨)を獲得→+1コイン
  let s = setup(['ironworks']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'ironworks' });
  let t = reduce(s, { type: 'IRONWORKS_GAIN', card: 'silver' });
  ok(count(t.players[0].discard, 'silver') === 1 && t.turn.coins === 1, '財宝獲得→+1コイン');
  // アクション(中庭, コスト2)を獲得→+1アクション
  let a = reduce(s, { type: 'IRONWORKS_GAIN', card: 'courtyard' });
  ok(count(a.players[0].discard, 'courtyard') === 1 && a.turn.actions === 1, 'アクション獲得→+1アクション');
  // 勝利点(屋敷)を獲得→+1カード
  let v = reduce(s, { type: 'IRONWORKS_GAIN', card: 'estate' });
  ok(count(v.players[0].discard, 'estate') === 1 && v.players[0].hand.length === 1, '勝利点獲得→+1カード');
  // コスト5は不可
  const t0 = JSON.stringify(s.supply);
  let bad = reduce(s, { type: 'IRONWORKS_GAIN', card: 'duchy' });
  ok(JSON.stringify(bad.supply) === t0 && bad.pending, 'コスト5以上は獲得不可');
}

console.log('=== 鉱山の村: 廃棄で+2コイン（場から消える） ===');
{
  let s = setup(['mining_village', 'copper']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'mining_village' });
  ok(s.turn.actions === 1 - 1 + 2, '+2アクション');
  ok(s.players[0].hand.length === 1 + 1, '+1カード');
  let keep = reduce(s, { type: 'MINING_VILLAGE_RESOLVE', trash: false });
  ok(count(keep.players[0].inPlay, 'mining_village') === 1 && keep.turn.coins === 0, '廃棄しない→場に残る');
  let trash = reduce(s, { type: 'MINING_VILLAGE_RESOLVE', trash: true });
  ok(count(trash.players[0].inPlay, 'mining_village') === 0 && count(trash.trash, 'mining_village') === 1 && trash.turn.coins === 2, '廃棄→+2コイン・廃棄置き場へ');
}

console.log('=== 貴族: +3カード or +2アクション、得点2 ===');
{
  let s = setup(['nobles', 'copper']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'nobles' });
  let cards = reduce(s, { type: 'NOBLES_RESOLVE', choice: 'cards' });
  ok(cards.players[0].hand.length === 1 + 3, '+3カード');
  let acts = reduce(s, { type: 'NOBLES_RESOLVE', choice: 'actions' });
  ok(acts.turn.actions === 0 + 2, '+2アクション');
  // 得点2
  const p = { deck: ['nobles', 'nobles'], hand: [], discard: [], inPlay: [] };
  ok(E.vpOf(p) === 4, '貴族2枚で4点: ' + E.vpOf(p));
}

console.log('=== 公爵: 公領1枚につき1点 ===');
{
  const p = { deck: ['duke', 'duke', 'duchy', 'duchy', 'duchy'], hand: [], discard: [], inPlay: [] };
  // 公領3枚(9点) + 公爵2枚×公領3 = 6点 → 15点
  ok(E.vpOf(p) === 9 + 6, '公爵2×公領3 + 公領9点 = 15: ' + E.vpOf(p));
  const p2 = { deck: ['duke'], hand: [], discard: [], inPlay: [] };
  ok(E.vpOf(p2) === 0, '公領0なら公爵は0点');
}

console.log('=== 後宮: 財宝+2コイン、得点2 ===');
{
  let s = setup(['harem']);
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'harem' });
  ok(s.turn.coins === 2 && count(s.players[0].inPlay, 'harem') === 1, '財宝として+2コイン');
  const p = { deck: ['harem', 'harem'], hand: [], discard: [], inPlay: [] };
  ok(E.vpOf(p) === 4, '後宮2枚で4点');
}

console.log('=== 拷問人: 各相手が2枚捨てる or 呪い、堀で無効化 ===');
{
  // 3人で全員対象
  let s = E.createInitialState(['A', 'B', 'C'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['torturer'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s.players[2].hand = ['moat', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'torturer' });
  ok(s.players[0].hand.length === 3, '使用者は+3カード');
  ok(s.pending && s.pending.type === 'torturer' && s.pending.player === 1, '最初の対象は席1');
  // 席1: 2枚捨てる
  s = reduce(s, { type: 'TORTURER_RESOLVE', choice: 'discard', cards: ['copper', 'copper'] });
  ok(s.players[1].hand.length === 3 && s.players[1].discard.length === 2, '席1が2枚捨てた');
  ok(s.pending && s.pending.player === 2, '次は席2');
  // 席2: 堀で無効化
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(s.players[2].hand.length === 5, '席2は堀で無効化（手札そのまま）');
  ok(s.pending === null, '全対象を処理して解決');
  // 呪いを受け取る選択
  let s2 = E.createInitialState(['A', 'B'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s2.players[0].hand = ['torturer'];
  s2.players[1].hand = ['gold', 'gold', 'gold', 'gold', 'gold'];
  s2 = reduce(s2, { type: 'PLAY_ACTION', card: 'torturer' });
  const curseSup = s2.supply.curse;
  s2 = reduce(s2, { type: 'TORTURER_RESOLVE', choice: 'curse' });
  ok(s2.players[1].hand.filter((c) => c === 'curse').length === 1 && s2.supply.curse === curseSup - 1, '呪いを手札に獲得');
}

console.log('=== 大広間: +1カード +1アクション・勝利点1 ===');
{
  let s = setup(['great_hall', 'copper']);
  const h0 = s.players[0].hand.length, a0 = s.turn.actions;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'great_hall' });
  ok(s.players[0].hand.length === h0, '大広間: 場へ1枚+1ドローで手札数据え置き: ' + s.players[0].hand.length);
  ok(s.turn.actions === a0, '大広間: アクション据え置き(消費1/付与1): ' + s.turn.actions);
  ok(count(s.players[0].inPlay, 'great_hall') === 1, '大広間が場に出ている');
  ok(s.pending === null, '選択待ちなし');
  const p = { deck: ['great_hall', 'great_hall', 'great_hall'], hand: [], discard: [], inPlay: [] };
  ok(E.vpOf(p) === 3, '大広間3枚で3点: ' + E.vpOf(p));
}

console.log('=== 銅細工師: このターン銅貨が+1コイン ===');
{
  let s = setup(['coppersmith', 'copper', 'copper']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'coppersmith' });
  ok(s.turn.copperBonus === 1, '銅細工師でcopperBonus=1: ' + s.turn.copperBonus);
  ok(s.turn.actions === 0, 'ターミナル: アクション消費: ' + s.turn.actions);
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(s.turn.coins === 4, '銅貨2枚が各2コイン=4: ' + s.turn.coins);
}
{
  // 二重掛け: アクションを確保して銅細工師を2回 → copperBonus=2、銅貨1枚=3コイン
  let s = setup(['coppersmith', 'coppersmith', 'copper']);
  s.turn.actions = 2;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'coppersmith' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'coppersmith' });
  ok(s.turn.copperBonus === 2, '銅細工師2回でcopperBonus=2: ' + s.turn.copperBonus);
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(s.turn.coins === 3, '銅貨1枚が3コイン: ' + s.turn.coins);
}
{
  // 銀貨など他財宝はボーナス対象外（copperBonus は銅貨だけ）
  let s = setup(['coppersmith', 'silver']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'coppersmith' });
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(s.turn.coins === 2, '銀貨は+2のまま（ボーナス対象外）: ' + s.turn.coins);
}
{
  // 次の手番ではボーナスがリセットされる
  let s = setup(['coppersmith']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'coppersmith' });
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok((s.turn.copperBonus || 0) === 0, '次の手番では copperBonus が0に戻る: ' + s.turn.copperBonus);
}

console.log('=== 交易場: 手札2枚廃棄→銀貨を手札に ===');
{
  let s = setup(['trading_post', 'estate', 'copper', 'silver']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'trading_post' });
  ok(s.pending && s.pending.type === 'trading_post', '交易場で廃棄選択待ち');
  const trashBefore = s.trash.length;
  s = reduce(s, { type: 'TRADING_POST_RESOLVE', cards: ['estate', 'copper'] });
  ok(s.trash.length === trashBefore + 2, '2枚が廃棄置き場へ');
  ok(count(s.players[0].hand, 'silver') === 2, '銀貨が手札に加わる(元1枚+獲得1枚): ' + count(s.players[0].hand, 'silver'));
  ok(s.pending === null, '解決後は選択待ち解除');
}
{
  // 手札1枚だけ → 1枚廃棄するが銀貨は得られない
  let s = setup(['trading_post', 'copper']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'trading_post' });
  const silSup = s.supply.silver;
  s = reduce(s, { type: 'TRADING_POST_RESOLVE', cards: ['copper'] });
  ok(count(s.players[0].hand, 'silver') === 0 && s.supply.silver === silSup, '1枚廃棄では銀貨を得ない');
  ok(s.pending === null, '解決完了');
}

console.log('=== 改良: 廃棄→ちょうど+1コストを獲得 ===');
{
  let s = setup(['upgrade', 'estate']); // 屋敷(コスト2)を廃棄→コスト3を獲得
  const h0 = s.players[0].hand.length;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'upgrade' });
  ok(s.turn.actions === 1, '改良: +1アクション(消費1/付与1で据え置き): ' + s.turn.actions);
  ok(s.players[0].hand.length === h0, '改良: +1カードで手札数据え置き(場へ1/ドロー1)');
  ok(s.pending && s.pending.stage === 'trash', '廃棄ステージ');
  s = reduce(s, { type: 'UPGRADE_TRASH', card: 'estate' });
  ok(s.pending && s.pending.stage === 'gain' && s.pending.exactCost === 3, 'ちょうど3コスト獲得ステージ: ' + (s.pending && s.pending.exactCost));
  s = reduce(s, { type: 'UPGRADE_GAIN', card: 'silver' });
  ok(count(s.players[0].discard, 'silver') === 1, '銀貨(コスト3)を獲得: ' + count(s.players[0].discard, 'silver'));
  ok(s.pending === null, '解決完了');
}
{
  // 廃棄候補があっても、ちょうど+1コストのカードが供給に無ければ獲得なしで終了
  let s = setup(['upgrade', 'province']); // 属州(8)を廃棄→コスト9は存在しない
  s = reduce(s, { type: 'PLAY_ACTION', card: 'upgrade' });
  s = reduce(s, { type: 'UPGRADE_TRASH', card: 'province' });
  ok(s.pending === null, 'コスト9が無いので獲得ステージに入らず終了');
}
{
  // 改良の獲得は強制（候補があるのに card:null は無視＝state不変でループ防止の前提）
  let s = setup(['upgrade', 'estate']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'upgrade' });
  s = reduce(s, { type: 'UPGRADE_TRASH', card: 'estate' });
  const snap = JSON.stringify(s);
  const s2 = reduce(s, { type: 'UPGRADE_GAIN', card: null });
  ok(JSON.stringify(s2) === snap, '候補ありで card:null は無効(state不変)');
}

console.log('=== 斥候: 上4枚公開→勝利点を手札・残りを並べ替えて山札上 ===');
{
  let s = setup(['scout']);
  s.players[0].deck = ['estate', 'copper', 'duchy', 'silver', 'gold']; // 上4: estate,copper,duchy,silver
  s = reduce(s, { type: 'PLAY_ACTION', card: 'scout' });
  ok(s.turn.actions === 1, '斥候: +1アクション(据え置き): ' + s.turn.actions);
  ok(count(s.players[0].hand, 'estate') === 1 && count(s.players[0].hand, 'duchy') === 1, '勝利点2枚(屋敷/公領)が手札へ');
  ok(s.pending && s.pending.type === 'scout' && s.pending.cards.length === 2, '非勝利点2枚(copper,silver)の並べ替え待ち');
  s = reduce(s, { type: 'SCOUT_RESOLVE', order: ['silver', 'copper'] });
  ok(s.players[0].deck[0] === 'silver' && s.players[0].deck[1] === 'copper', '指定順で山札の上に戻る: ' + s.players[0].deck.slice(0, 2).join(','));
  ok(s.players[0].deck[2] === 'gold', '残りの山札はそのまま下に');
  ok(s.pending === null, '解決完了');
}
{
  // 非勝利点が1枚以下なら並べ替え不要・即終了
  let s = setup(['scout']);
  s.players[0].deck = ['estate', 'duchy', 'province', 'silver']; // 勝利点3+財宝1
  s = reduce(s, { type: 'PLAY_ACTION', card: 'scout' });
  ok(s.pending === null, '非勝利点1枚なら選択待ちなし');
  ok(s.players[0].deck[0] === 'silver', '残り1枚は山札の上へ');
}
{
  // 山切れ時は捨て札をシャッフルして公開（クラッシュしない）
  let s = setup(['scout']);
  s.players[0].deck = ['estate'];
  s.players[0].discard = ['copper', 'copper', 'silver'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'scout' });
  ok(s.turn.actions === 1 && count(s.players[0].hand, 'estate') === 1, '山切れでもreshuffleして公開できる');
}

console.log('=== 貢物: 左隣の上2枚公開→異名ごとにボーナス ===');
{
  let s = setup(['tribute']);
  s.players[1].deck = ['silver', 'village', 'estate']; // 上2: silver(財宝), village(アクション)
  const a0 = s.turn.actions, c0 = s.turn.coins;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'tribute' });
  ok(s.turn.coins === c0 + 2, '財宝1種で+2コイン: ' + s.turn.coins);
  ok(s.turn.actions === a0 - 1 + 2, 'アクション1種で+2アクション(消費1含む): ' + s.turn.actions);
  ok(count(s.players[1].discard, 'silver') === 1 && count(s.players[1].discard, 'village') === 1, '公開2枚は左隣の捨て札へ');
}
{
  // 同名2枚は1回ぶんだけ
  let s = setup(['tribute']);
  s.players[1].deck = ['gold', 'gold'];
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'tribute' });
  ok(s.turn.coins === c0 + 2, '同名(金貨2枚)は+2コイン1回ぶんのみ: ' + s.turn.coins);
}
{
  // 勝利点でも+2カード（多重タイプ：大広間=アクション+勝利点なら両方）
  let s = setup(['tribute']);
  s.players[1].deck = ['great_hall', 'duchy']; // great_hall=アクション+勝利点, duchy=勝利点
  const h0 = s.players[0].hand.length, a0 = s.turn.actions;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'tribute' });
  // great_hall: +2アクション & +2カード、duchy: +2カード → 合計 +2アクション, +4カード
  ok(s.turn.actions === a0 - 1 + 2, '大広間のアクション分で+2アクション: ' + s.turn.actions);
  ok(s.players[0].hand.length === (h0 - 1) + 4, '勝利点2種で+4カード(手札-1は貢物プレイ分): ' + s.players[0].hand.length);
}
{
  // 左隣の山札が空でもクラッシュしない（公開0枚→ボーナスなし）
  let s = setup(['tribute']);
  s.players[1].deck = []; s.players[1].discard = [];
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'tribute' });
  ok(s.turn.coins === c0 && s.pending === null, '左隣デッキ空でも安全に終了');
}

console.log('=== 詐欺師: 山札の上を廃棄→攻撃側が同コストを与える ===');
{
  let s = setup(['swindler']);
  s.players[1].hand = ['copper', 'copper']; // 堀なし
  s.players[1].deck = ['silver', 'estate', 'copper']; // 上=銀貨(コスト3)
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'swindler' });
  ok(s.turn.coins === c0 + 2, '詐欺師: +2コイン: ' + s.turn.coins);
  ok(count(s.trash, 'silver') === 1, '犠牲者の山札の上(銀貨)が廃棄された');
  ok(s.pending && s.pending.stage === 'gain' && s.pending.player === 0 && s.pending.cost === 3, '攻撃側がコスト3の付与を選ぶ待ち');
  s = reduce(s, { type: 'SWINDLER_GAIN', card: 'silver' });
  ok(count(s.players[1].discard, 'silver') === 1, '犠牲者がコスト3のカードを獲得');
  ok(s.pending === null, '解決完了(2人戦)');
}
{
  // 堀で無効化
  let s = setup(['swindler']);
  s.players[1].hand = ['moat', 'copper'];
  s.players[1].deck = ['gold', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'swindler' });
  ok(s.pending && s.pending.stage === 'react' && s.pending.player === 1, '堀持ちは反応待ち');
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(s.players[1].deck[0] === 'gold' && s.pending === null, '堀で無効化、山札の上は無傷');
}
{
  // 犠牲者の山札が空 → 廃棄できず終了
  let s = setup(['swindler']);
  s.players[1].hand = ['copper'];
  s.players[1].deck = []; s.players[1].discard = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'swindler' });
  ok(s.pending === null, '犠牲者の山札空なら廃棄なしで終了');
}
{
  // 3人戦: stage を保持して2人目へ進む（advanceAttack ではデッドロックする経路）
  let s = E.createInitialState(['A', 'B', 'C'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['swindler'];
  s.players[1].hand = ['estate']; s.players[1].deck = ['copper', 'silver'];   // 上=copper(0)
  s.players[2].hand = ['estate']; s.players[2].deck = ['estate', 'gold'];     // 上=estate(2)
  s = reduce(s, { type: 'PLAY_ACTION', card: 'swindler' });
  ok(s.pending && s.pending.victim === 1 && s.pending.stage === 'gain' && s.pending.cost === 0, '1人目: copper(0)廃棄→コスト0付与待ち');
  s = reduce(s, { type: 'SWINDLER_GAIN', card: 'copper' });
  ok(s.pending && s.pending.victim === 2 && s.pending.stage === 'gain' && s.pending.cost === 2, '2人目へ stage 保持で進む(デッドロックなし)');
  s = reduce(s, { type: 'SWINDLER_GAIN', card: 'estate' });
  ok(s.pending === null, '全犠牲者解決で終了(3人戦)');
  ok(count(s.trash, 'copper') === 1 && count(s.trash, 'estate') === 1, '両者の山札の上が廃棄された');
}

console.log('=== 破壊工作員: $3以上を廃棄→任意で格下げ獲得 ===');
{
  let s = setup(['saboteur']);
  s.players[1].hand = ['copper']; // 堀なし
  s.players[1].deck = ['copper', 'estate', 'gold', 'silver']; // copper(0),estate(2)を捨て、gold(6)を廃棄
  s = reduce(s, { type: 'PLAY_ACTION', card: 'saboteur' });
  ok(count(s.trash, 'gold') === 1, '$3以上(金貨)が廃棄された');
  ok(count(s.players[1].discard, 'copper') === 1 && count(s.players[1].discard, 'estate') === 1, '$3未満の公開札は捨て札へ');
  ok(s.pending && s.pending.stage === 'gain' && s.pending.player === 1 && s.pending.maxCost === 4, '犠牲者がコスト4以下を任意獲得(6-2): ' + (s.pending && s.pending.maxCost));
  s = reduce(s, { type: 'SABOTEUR_GAIN', card: null }); // 獲得しない
  ok(s.pending === null, '獲得辞退で終了');
}
{
  // 獲得する場合
  let s = setup(['saboteur']);
  s.players[1].hand = ['copper'];
  s.players[1].deck = ['silver']; // silver(3)を廃棄→maxCost 1
  s = reduce(s, { type: 'PLAY_ACTION', card: 'saboteur' });
  ok(s.pending && s.pending.maxCost === 1, '銀貨(3)廃棄→上限1: ' + (s.pending && s.pending.maxCost));
  s = reduce(s, { type: 'SABOTEUR_GAIN', card: 'estate' }); // estate cost2 > 1 → 無効
  ok(count(s.players[1].discard, 'estate') === 0, '上限超のカードは獲得できない(estate)');
  s = reduce(s, { type: 'SABOTEUR_GAIN', card: 'copper' }); // copper cost0 ≤1 → OK
  ok(count(s.players[1].discard, 'copper') === 1 && s.pending === null, 'コスト上限内(銅貨)を獲得して終了');
}
{
  // $3以上が無い → 全部捨てて廃棄なし
  let s = setup(['saboteur']);
  s.players[1].hand = ['copper'];
  s.players[1].deck = ['copper', 'estate']; s.players[1].discard = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'saboteur' });
  ok(s.trash.length === 0 && s.pending === null, '$3以上が無ければ廃棄なしで終了');
  ok(count(s.players[1].discard, 'copper') === 1 && count(s.players[1].discard, 'estate') === 1, '公開札は全て捨て札へ');
}
{
  // 堀で無効化
  let s = setup(['saboteur']);
  s.players[1].hand = ['moat'];
  s.players[1].deck = ['gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'saboteur' });
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(count(s.trash, 'gold') === 0 && s.pending === null, '堀で無効化、廃棄されない');
}
{
  // 3人戦: 2人とも処理して終了（stage保持の確認）
  let s = E.createInitialState(['A', 'B', 'C'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['saboteur'];
  s.players[1].hand = ['copper']; s.players[1].deck = ['gold'];
  s.players[2].hand = ['copper']; s.players[2].deck = ['silver'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'saboteur' });
  ok(s.pending && s.pending.victim === 1, '1人目の獲得待ち');
  s = reduce(s, { type: 'SABOTEUR_GAIN', card: null });
  ok(s.pending && s.pending.victim === 2, '2人目へ進む(デッドロックなし)');
  s = reduce(s, { type: 'SABOTEUR_GAIN', card: null });
  ok(s.pending === null && count(s.trash, 'gold') === 1 && count(s.trash, 'silver') === 1, '両者$3以上を廃棄して終了');
}

console.log('=== 手先: +1アクション、+2コイン か 全員引き直し ===');
{
  // +2コインを選ぶ
  let s = setup(['minion', 'copper']);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'minion' });
  ok(s.turn.actions === 1, '手先: +1アクション(据え置き): ' + s.turn.actions);
  ok(s.pending && s.pending.type === 'minion' && s.pending.stage === 'choose', '攻撃側の選択待ち');
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'MINION_RESOLVE', choice: 'coins' });
  ok(s.turn.coins === c0 + 2 && s.pending === null, '+2コインで終了');
}
{
  // アタック: 自分は手札捨てて4引く、手札5枚以上の相手も引き直し
  let s = E.createInitialState(['A', 'B'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['minion', 'estate', 'estate'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'silver', 'gold'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'estate']; // 5枚
  s.players[1].deck = ['silver', 'silver', 'silver', 'silver', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'minion' });
  s = reduce(s, { type: 'MINION_RESOLVE', choice: 'attack' });
  ok(s.players[0].hand.length === 4, '自分は手札を捨てて4枚引く: ' + s.players[0].hand.length);
  ok(s.players[1].hand.length === 4, '手札5枚の相手も4枚に引き直し: ' + s.players[1].hand.length);
  ok(s.pending === null, '解決完了');
}
{
  // 手札4枚以下の相手は引き直さない
  let s = E.createInitialState(['A', 'B'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['minion'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s.players[1].hand = ['copper', 'copper', 'copper']; // 3枚
  s.players[1].deck = ['silver', 'silver'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'minion' });
  s = reduce(s, { type: 'MINION_RESOLVE', choice: 'attack' });
  ok(s.players[1].hand.length === 3, '手札3枚の相手は引き直さない: ' + s.players[1].hand.length);
}
{
  // 堀で無効化（相手は引き直さない）
  let s = E.createInitialState(['A', 'B'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['minion'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper']; // 5枚・堀
  s.players[1].deck = ['silver', 'silver', 'silver', 'silver'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'minion' });
  s = reduce(s, { type: 'MINION_RESOLVE', choice: 'attack' });
  ok(s.pending && s.pending.type === 'minion_attack' && s.pending.player === 1, '相手の反応待ち');
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(s.players[1].hand.length === 5 && s.pending === null, '堀で無効化、引き直さない');
}

console.log('=== 仮面舞踏会: +2カード→全員左隣へ1枚→任意で廃棄 ===');
{
  // 2人戦: 互いに1枚渡す（左隣=相手）
  let s = E.createInitialState(['A', 'B'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['masquerade', 'gold'];
  s.players[0].deck = ['silver', 'silver', 'copper'];
  s.players[1].hand = ['curse', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'masquerade' });
  ok(s.players[0].hand.length === 1 + 2, '使用者: +2カード(masqueradeは場へ): ' + s.players[0].hand.length);
  ok(s.pending && s.pending.type === 'masquerade' && s.pending.stage === 'pass', 'パスの選択待ち');
  ok(s.pending.player === 0, '使用者(席0)から渡す');
  s = reduce(s, { type: 'MASQUERADE_PASS', card: 'gold' });   // 席0が金貨を渡す
  ok(s.pending.player === 1, '次は席1');
  s = reduce(s, { type: 'MASQUERADE_PASS', card: 'curse' });  // 席1が呪いを渡す
  ok(s.pending && s.pending.stage === 'trash' && s.pending.player === 0, 'パス後、使用者の廃棄(任意)待ち');
  ok(count(s.players[1].hand, 'gold') === 1, '席1は席0から金貨を受け取った');
  ok(count(s.players[0].hand, 'curse') === 1, '席0は席1から呪いを受け取った');
  s = reduce(s, { type: 'MASQUERADE_TRASH', card: 'curse' }); // 受け取った呪いを廃棄
  ok(count(s.trash, 'curse') === 1 && count(s.players[0].hand, 'curse') === 0, '受け取った呪いを廃棄');
  ok(s.pending === null, '解決完了');
}
{
  // 廃棄しない選択
  let s = E.createInitialState(['A', 'B'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['masquerade', 'copper'];
  s.players[0].deck = ['silver', 'silver'];
  s.players[1].hand = ['estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'masquerade' });
  s = reduce(s, { type: 'MASQUERADE_PASS', card: 'copper' });
  s = reduce(s, { type: 'MASQUERADE_PASS', card: 'estate' });
  const trashN = s.trash.length;
  s = reduce(s, { type: 'MASQUERADE_TRASH', card: null });
  ok(s.trash.length === trashN && s.pending === null, '廃棄しないで終了');
}
{
  // 3人戦: 左隣(idx+1)へ循環して渡る
  let s = E.createInitialState(['A', 'B', 'C'], DOM.KINGDOM_INTRIGUE, { startActive: 0 });
  s.players[0].hand = ['masquerade', 'gold'];
  s.players[0].deck = ['copper', 'copper', 'silver'];
  s.players[1].hand = ['estate'];
  s.players[2].hand = ['curse'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'masquerade' });
  s = reduce(s, { type: 'MASQUERADE_PASS', card: 'gold' });   // 0→1
  s = reduce(s, { type: 'MASQUERADE_PASS', card: 'estate' }); // 1→2
  s = reduce(s, { type: 'MASQUERADE_PASS', card: 'curse' });  // 2→0
  ok(count(s.players[1].hand, 'gold') === 1, '席1は席0の金貨を受領');
  ok(count(s.players[2].hand, 'estate') === 1, '席2は席1の屋敷を受領');
  ok(count(s.players[0].hand, 'curse') === 1, '席0は席2の呪いを受領(循環)');
  s = reduce(s, { type: 'MASQUERADE_TRASH', card: null });
  ok(s.pending === null, '3人戦も解決完了');
}

console.log('\n========================================');
console.log('拡張テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
