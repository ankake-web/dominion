/* エンジンの動作検証（Node 単体実行）
   使い方: node test/engine.test.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ブラウザの window を擬似的に用意してファイルを読み込む
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
sandbox.window = sandbox.window || {};
vm.createContext(sandbox);
function load(f) {
  const code = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}
load('js/cards.js');
load('js/engine.js');
const DOM = sandbox.window.DOM;
const E = DOM.engine;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); }
}
function count(arr, id) { return arr.filter((c) => c === id).length; }

/* 決定論にするため Math.random を固定シードに差し替え */
let seed = 12345;
sandbox.Math.random = function () {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

console.log('=== 初期状態 ===');
let s = E.createInitialState(['A', 'B']);
ok(s.players.length === 2, '2人');
const allA = [].concat(s.players[0].deck, s.players[0].hand);
ok(allA.length === 10, '初期デッキ10枚: ' + allA.length);
ok(count(allA, 'copper') === 7, '銅貨7枚');
ok(count(allA, 'estate') === 3, '屋敷3枚');
ok(s.players[0].hand.length === 5, '手札5枚');
ok(s.supply.copper === 60 - 14, '銅貨サプライ46: ' + s.supply.copper);
ok(s.supply.silver === 40, '銀貨40');
ok(s.supply.gold === 30, '金貨30');
ok(s.supply.estate === 8, '屋敷8（2人）');
ok(s.supply.province === 8, '属州8');
ok(s.supply.curse === 10, '呪い10（2人）');
ok(s.supply.village === 10, '村10');

console.log('=== 村: +1カード +2アクション ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['village', 'copper', 'copper', 'estate', 'estate'];
s.players[0].deck = ['gold', 'silver', 'copper'];
let s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'village' });
ok(s2.turn.actions === 2, '村でアクション 1-1+2=2: ' + s2.turn.actions);
ok(s2.players[0].hand.length === 5, '村で手札 4+1=5: ' + s2.players[0].hand.length);
ok(s2.players[0].inPlay.indexOf('village') >= 0, '村が場に出ている');

console.log('=== 鍛冶屋: +3カード ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['smithy', 'copper', 'copper', 'estate', 'estate'];
s.players[0].deck = ['gold', 'silver', 'copper', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'smithy' });
ok(s2.players[0].hand.length === 7, '鍛冶屋で手札 4+3=7: ' + s2.players[0].hand.length);
ok(s2.turn.actions === 0, '鍛冶屋でアクション 1-1=0: ' + s2.turn.actions);

console.log('=== 市場: +1カード +1アクション +1購入 +1コイン ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['market', 'copper', 'copper', 'estate', 'estate'];
s.players[0].deck = ['gold'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'market' });
ok(s2.turn.actions === 1, '市場 アクション1: ' + s2.turn.actions);
ok(s2.turn.buys === 2, '市場 購入2: ' + s2.turn.buys);
ok(s2.turn.coins === 1, '市場 コイン1: ' + s2.turn.coins);
ok(s2.players[0].hand.length === 5, '市場 手札5: ' + s2.players[0].hand.length);

console.log('=== 木こり: +1購入 +2コイン ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['woodcutter', 'copper', 'copper', 'estate', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'woodcutter' });
ok(s2.turn.buys === 2 && s2.turn.coins === 2, '木こり 購入2/コイン2');

console.log('=== 財宝を出す→購入→クリーンアップ ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['copper', 'copper', 'copper', 'estate', 'estate'];
s.players[0].deck = ['silver', 'silver', 'silver', 'silver', 'silver', 'gold'];
s2 = E.reduce(s, { type: 'END_ACTION_PHASE' });
ok(s2.turn.phase === 'buy', '購入フェーズへ');
s2 = E.reduce(s2, { type: 'PLAY_ALL_TREASURES' });
ok(s2.turn.coins === 3, '銅貨3枚で3コイン: ' + s2.turn.coins);
s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
ok(s2.turn.coins === 0, '銀貨購入でコイン0: ' + s2.turn.coins);
ok(s2.turn.buys === 0, '購入0: ' + s2.turn.buys);
ok(count(s2.players[0].discard, 'silver') === 1, '銀貨が捨て札に');
ok(s2.supply.silver === 39, '銀貨サプライ-1');
s2 = E.reduce(s2, { type: 'END_TURN' });
ok(s2.turn.active === 1, '手番がBへ: ' + s2.turn.active);
ok(s2.players[0].turns === 1, 'Aのターン数1');
ok(s2.players[0].hand.length === 5, 'Aの新しい手札5枚');
ok(s2.players[0].inPlay.length === 0, '場が空');

console.log('=== 民兵: 相手は3枚まで捨てる ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['militia', 'copper', 'copper', 'copper', 'copper'];
s.players[1].hand = ['copper', 'copper', 'silver', 'estate', 'duchy'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
ok(s2.turn.coins === 2, '民兵 +2コイン');
ok(s2.pending && s2.pending.type === 'militia' && s2.pending.player === 1, 'Bに選択待ち');
s2 = E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: ['copper', 'copper'] });
ok(s2.players[1].hand.length === 3, 'Bの手札3枚に: ' + s2.players[1].hand.length);
ok(s2.pending === null, '選択待ち解消');

console.log('=== 民兵 vs 堀: 無効化 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['militia', 'copper'];
s.players[1].hand = ['moat', 'copper', 'silver', 'estate', 'duchy'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
ok(s2.pending && s2.pending.type === 'militia', '堀持ちでも一旦選択待ち');
s2 = E.reduce(s2, { type: 'MOAT_REVEAL' });
ok(s2.players[1].hand.length === 5, '堀公開で手札そのまま5: ' + s2.players[1].hand.length);
ok(s2.pending === null, '無効化で解消');

console.log('=== 民兵: 相手が3枚以下なら何も起きない ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['militia'];
s.players[1].hand = ['copper', 'copper', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
ok(s2.pending === null, '3枚以下は選択待ちなし');

console.log('=== 鉱山: 銅貨を廃棄して銀貨を手札へ ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['mine', 'copper', 'estate', 'estate', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'mine' });
ok(s2.pending && s2.pending.stage === 'trash', '廃棄ステージ');
s2 = E.reduce(s2, { type: 'MINE_TRASH', card: 'copper' });
ok(s2.pending.stage === 'gain' && s2.pending.maxCost === 3, '獲得上限=銅貨0+3=3');
ok(s2.trash.indexOf('copper') >= 0, '銅貨が廃棄置場に');
let bad = E.reduce(s2, { type: 'MINE_GAIN', card: 'gold' });
ok(bad.pending !== null, '金貨(コスト6)は不可');
s2 = E.reduce(s2, { type: 'MINE_GAIN', card: 'silver' });
ok(count(s2.players[0].hand, 'silver') === 1, '銀貨が手札に獲得');
ok(s2.supply.silver === 39, '銀貨サプライ-1');
ok(s2.pending === null, '鉱山完了');

console.log('=== 改築: 屋敷(2)を廃棄して4以下を獲得 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['remodel', 'estate', 'copper', 'copper', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
ok(s2.pending.stage === 'trash', '改築 廃棄ステージ');
s2 = E.reduce(s2, { type: 'REMODEL_TRASH', card: 'estate' });
ok(s2.pending.maxCost === 4, '上限=屋敷2+2=4');
let bad2 = E.reduce(s2, { type: 'REMODEL_GAIN', card: 'duchy' });
ok(bad2.pending !== null, '公領(5)は不可');
s2 = E.reduce(s2, { type: 'REMODEL_GAIN', card: 'smithy' });
ok(count(s2.players[0].discard, 'smithy') === 1, '鍛冶屋(4)を獲得');
ok(s2.pending === null, '改築完了');

console.log('=== 工房: コスト4以下を獲得 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['workshop', 'copper', 'copper', 'copper', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });
ok(s2.pending.type === 'workshop', '工房 獲得待ち');
let bad3 = E.reduce(s2, { type: 'WORKSHOP_GAIN', card: 'market' });
ok(bad3.pending !== null, '市場(5)は不可');
s2 = E.reduce(s2, { type: 'WORKSHOP_GAIN', card: 'village' });
ok(count(s2.players[0].discard, 'village') === 1, '村(3)を獲得');

console.log('=== 地下貯蔵庫: 捨てて引く ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['cellar', 'estate', 'estate', 'copper', 'copper'];
s.players[0].deck = ['gold', 'silver', 'province'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'cellar' });
ok(s2.turn.actions === 1, '地下貯蔵庫 +1アクション(1-1+1)=1: ' + s2.turn.actions);
ok(s2.pending.type === 'cellar', '捨てる選択待ち');
s2 = E.reduce(s2, { type: 'CELLAR_RESOLVE', cards: ['estate', 'estate'] });
ok(count(s2.players[0].hand, 'estate') === 0, '屋敷2枚を捨てた');
ok(s2.players[0].hand.length === 4, '手札 2+2=4: ' + s2.players[0].hand.length);
ok(count(s2.players[0].discard, 'estate') === 2, '屋敷が捨て札に');

console.log('=== 堀: +2カード（アクションとして） ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['moat', 'copper', 'copper', 'estate', 'estate'];
s.players[0].deck = ['gold', 'silver', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'moat' });
ok(s2.players[0].hand.length === 6, '堀で手札 4+2=6: ' + s2.players[0].hand.length);

console.log('=== 山切れでシャッフル ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['smithy', 'copper', 'copper', 'copper', 'copper'];
s.players[0].deck = ['silver'];
s.players[0].discard = ['gold', 'province', 'duchy', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'smithy' });
ok(s2.players[0].hand.length === 7, '山切れでも+3引けた: ' + s2.players[0].hand.length);
ok(s2.players[0].deck.length + s2.players[0].discard.length === 2, '残り山+捨て=2');

console.log('=== 得点計算 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].deck = ['province', 'province', 'estate', 'curse']; // 6+6+1-1=12
s.players[0].hand = []; s.players[0].discard = []; s.players[0].inPlay = [];
s.players[1].deck = ['duchy', 'duchy', 'duchy', 'estate']; // 3+3+3+1=10
s.players[1].hand = []; s.players[1].discard = []; s.players[1].inPlay = [];
ok(E.vpOf(s.players[0]) === 12, 'Aの得点12: ' + E.vpOf(s.players[0]));
ok(E.vpOf(s.players[1]) === 10, 'Bの得点10: ' + E.vpOf(s.players[1]));

console.log('=== ゲーム終了: 属州枯渇 ===');
s = E.createInitialState(['A', 'B']);
s.supply.province = 0;
s2 = E.reduce(s, { type: 'END_ACTION_PHASE' });
s2 = E.reduce(s2, { type: 'END_TURN' });
ok(s2.gameOver === true, '属州0でゲーム終了');
ok(s2.result && s2.result.winners.length >= 1, '勝者が決まる');

console.log('=== ゲーム終了: 3山枯渇 ===');
s = E.createInitialState(['A', 'B']);
s.supply.village = 0; s.supply.smithy = 0; s.supply.estate = 0;
s2 = E.reduce(s, { type: 'END_ACTION_PHASE' });
s2 = E.reduce(s2, { type: 'END_TURN' });
ok(s2.gameOver === true, '3山枯渇でゲーム終了');

console.log('=== 同点はターン数が少ない方が勝ち ===');
s = E.createInitialState(['A', 'B']);
s.players[0].deck = ['province']; s.players[0].hand = []; s.players[0].discard = []; s.players[0].inPlay = [];
s.players[1].deck = ['province']; s.players[1].hand = []; s.players[1].discard = []; s.players[1].inPlay = [];
s.players[0].turns = 10; s.players[1].turns = 9;
const r = E.scoreGame(s);
ok(r.winners.length === 1 && r.winners[0] === 1, '同点ならターン少ないBの勝ち: ' + JSON.stringify(r.winners));

console.log('=== 獲得対象が無いときのデッドロック回避 ===');
// 工房: コスト4以下のサプライを全て0に → 選択待ちにならない
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['workshop', 'copper', 'copper', 'copper', 'copper'];
Object.keys(s.supply).forEach((k) => { if (DOM.CARDS[k].cost <= 4) s.supply[k] = 0; });
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });
ok(s2.pending === null, '工房: 獲得対象0なら選択待ちにならない');

// 鉱山: 廃棄後に獲得できる財宝が無ければ pending 解除
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['mine', 'copper', 'estate', 'estate', 'estate'];
s.supply.silver = 0; s.supply.gold = 0; s.supply.copper = 0; // 全財宝0（廃棄後コスト3以下に獲得対象なし）
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'mine' });
s2 = E.reduce(s2, { type: 'MINE_TRASH', card: 'copper' });
ok(s2.pending === null, '鉱山: 獲得対象0なら廃棄後に終了');
ok(s2.trash.includes('copper'), '鉱山: 廃棄は実行済み');

// 改築: 廃棄後に獲得できるカードが無ければ pending 解除
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['remodel', 'copper', 'copper', 'copper', 'copper'];
Object.keys(s.supply).forEach((k) => { if (DOM.CARDS[k].cost <= 2) s.supply[k] = 0; }); // 銅貨(0)廃棄→2以下なし
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
s2 = E.reduce(s2, { type: 'REMODEL_TRASH', card: 'copper' });
ok(s2.pending === null, '改築: 獲得対象0なら廃棄後に終了');

// 各 GAIN に card:null を渡すと安全に終了
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['workshop', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });
ok(s2.pending && s2.pending.type === 'workshop', '工房 pending');
s2 = E.reduce(s2, { type: 'WORKSHOP_GAIN', card: null });
ok(s2.pending === null, 'WORKSHOP_GAIN(null)で終了');

console.log('=== 民兵: 捨て足りない不正入力は拒否 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['militia'];
s.players[1].hand = ['copper', 'copper', 'silver', 'estate', 'duchy'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
let under = E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: ['copper'] }); // 1枚だけ→残4
ok(under.pending !== null, '捨て足りない(残4)は拒否され pending 継続');
let over = E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: ['copper', 'copper', 'silver'] }); // 残2
ok(over.pending !== null, '捨てすぎ(残2)も拒否');
let nothand = E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: ['province', 'province'] }); // 手札に無い
ok(nothand.pending !== null, '手札に無いカード指定は拒否');
let good = E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: ['copper', 'copper'] }); // 残3
ok(good.pending === null && good.players[1].hand.length === 3, 'ちょうど3枚は受理');

console.log('=== 3〜4人: サプライ枚数 ===');
s = E.createInitialState(['A', 'B', 'C']);
ok(s.players.length === 3, '3人');
ok(s.supply.estate === 12 && s.supply.province === 12 && s.supply.duchy === 12, '3人は勝利点各12');
ok(s.supply.curse === 20, '3人は呪い20');
ok(s.supply.copper === 60 - 21, '3人は銅貨39: ' + s.supply.copper);
ok(s.supply.village === 10, '王国は常に10');
s = E.createInitialState(['A', 'B', 'C', 'D']);
ok(s.players.length === 4, '4人');
ok(s.supply.province === 12, '4人も勝利点12');
ok(s.supply.curse === 30, '4人は呪い30');
ok(s.supply.copper === 60 - 28, '4人は銅貨32: ' + s.supply.copper);

console.log('=== CPU設定の保持 ===');
s = E.createInitialState([{ name: 'わたし', isCpu: false }, { name: 'CPU強', isCpu: true, level: 'hard' }]);
ok(s.players[0].isCpu === false && s.players[1].isCpu === true, 'isCpu保持');
ok(s.players[1].cpuLevel === 'hard', 'CPUレベル保持');
ok(s.players[0].name === 'わたし' && s.players[1].name === 'CPU強', '名前保持');

console.log('=== 民兵: 3人で全員が対象（キュー処理） ===');
s = E.createInitialState(['A', 'B', 'C']);
s.players[0].hand = ['militia'];
s.players[1].hand = ['copper', 'copper', 'silver', 'estate', 'duchy'];
s.players[2].hand = ['gold', 'gold', 'estate', 'estate', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
ok(s2.pending && s2.pending.player === 1, '最初はB(席1)が対象');
ok(s2.pending.queue && s2.pending.queue[0] === 2, 'C(席2)がキューに');
s2 = E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: ['copper', 'copper'] });
ok(s2.pending && s2.pending.player === 2, '次はC(席2)が対象');
ok(s2.players[1].hand.length === 3, 'Bは3枚に');
s2 = E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: ['estate', 'estate'] });
ok(s2.pending === null, '全員処理で選択待ち解除');
ok(s2.players[2].hand.length === 3, 'Cも3枚に');

console.log('=== 民兵3人: 1人だけ3枚以下ならスキップ ===');
s = E.createInitialState(['A', 'B', 'C']);
s.players[0].hand = ['militia'];
s.players[1].hand = ['copper', 'copper', 'estate']; // 3枚以下→対象外
s.players[2].hand = ['gold', 'gold', 'estate', 'estate', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
ok(s2.pending && s2.pending.player === 2, '3枚以下のBは飛ばしてCが対象');
ok(!s2.pending.queue || s2.pending.queue.length === 0, 'キューは空');

console.log('=== 4人: 手番が一周する ===');
s = E.createInitialState(['A', 'B', 'C', 'D']);
for (let turn = 0; turn < 4; turn++) {
  s = E.reduce(s, { type: 'END_ACTION_PHASE' });
  s = E.reduce(s, { type: 'END_TURN' });
}
ok(s.turn.active === 0, '4人で一周して席0に戻る: ' + s.turn.active);
ok(s.players.every((p) => p.turns === 1), '全員1ターンずつ');

console.log('\n========================================');
console.log(`結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
