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

console.log('=== 獲得は強制（公式）: 獲得可能なら null 辞退を拒否、枯渇時のみ受理 ===');
// 工房: サプライに獲得対象がある限り「獲得しない」は通らない
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['workshop', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });
ok(s2.pending && s2.pending.type === 'workshop', '工房 pending');
let refuse = E.reduce(s2, { type: 'WORKSHOP_GAIN', card: null });
ok(refuse.pending !== null, '工房: 獲得対象がある間は null 辞退を拒否');
// pending 後にサプライが枯渇した（防御的経路）場合のみ null を受理
let drained = JSON.parse(JSON.stringify(s2));
Object.keys(drained.supply).forEach((k) => { if (DOM.CARDS[k].cost <= 4) drained.supply[k] = 0; });
drained = E.reduce(drained, { type: 'WORKSHOP_GAIN', card: null });
ok(drained.pending === null, '工房: 枯渇時のみ null で安全に終了');
// 鉱山・改築も同様に獲得辞退を拒否
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['mine', 'copper', 'estate', 'estate', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'mine' });
s2 = E.reduce(s2, { type: 'MINE_TRASH', card: 'copper' });
ok(E.reduce(s2, { type: 'MINE_GAIN', card: null }).pending !== null, '鉱山: 銀貨が獲得できるのに null 辞退は拒否');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['remodel', 'estate', 'copper', 'copper', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
s2 = E.reduce(s2, { type: 'REMODEL_TRASH', card: 'estate' });
ok(E.reduce(s2, { type: 'REMODEL_GAIN', card: null }).pending !== null, '改築: 獲得対象があるのに null 辞退は拒否');

console.log('=== 不正入力ガード: 未知ID・非配列でも throw せず状態不変 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
s2 = E.reduce(s, { type: 'END_ACTION_PHASE' });
let g1 = E.reduce(s2, { type: 'BUY', card: 'hackcard' });
ok(g1.supply.copper === s2.supply.copper && g1.turn.buys === 1, 'BUY: 未知IDは状態不変');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['workshop', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });
ok(E.reduce(s2, { type: 'WORKSHOP_GAIN', card: 'hackcard' }).pending !== null, 'WORKSHOP_GAIN: 未知IDは拒否');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['remodel', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
s2 = E.reduce(s2, { type: 'REMODEL_TRASH', card: 'estate' });
ok(E.reduce(s2, { type: 'REMODEL_GAIN', card: 'hackcard' }).pending !== null, 'REMODEL_GAIN: 未知IDは拒否');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['cellar', 'estate', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'cellar' });
let gc = E.reduce(s2, { type: 'CELLAR_RESOLVE', cards: {} }); // 非配列
ok(gc.pending === null && gc.players[0].hand.length === 2, 'CELLAR_RESOLVE: 非配列は0枚扱いで安全に終了');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['militia'];
s.players[1].hand = ['copper', 'copper', 'silver', 'estate', 'duchy'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
ok(E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: 'copper' }).pending !== null, 'MILITIA_RESOLVE: 非配列は拒否され pending 継続');

console.log('=== BUY のガード: 在庫0・購入権0・コイン不足 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = [];
s2 = E.reduce(s, { type: 'END_ACTION_PHASE' });
s2.turn.coins = 10;
s2.supply.silver = 0;
ok(E.reduce(s2, { type: 'BUY', card: 'silver' }).supply.silver === 0, '在庫0は購入不可（マイナスにならない）');
s2.supply.silver = 5; s2.turn.buys = 0;
let gb = E.reduce(s2, { type: 'BUY', card: 'silver' });
ok(gb.supply.silver === 5 && gb.turn.coins === 10, '購入権0は不可');
s2.turn.buys = 1; s2.turn.coins = 2;
ok(E.reduce(s2, { type: 'BUY', card: 'silver' }).supply.silver === 5, 'コイン不足は不可');

console.log('=== 山札も捨て札も空: 引けるだけ引いて止まる（無限ループしない） ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['smithy', 'copper'];
s.players[0].deck = ['gold']; s.players[0].discard = [];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'smithy' });
ok(s2.players[0].hand.length === 2, '完全枯渇: 3枚中1枚だけ引いて手札2: ' + s2.players[0].hand.length);
ok(s2.players[0].deck.length === 0 && s2.players[0].discard.length === 0, '山・捨てとも空のまま');

console.log('=== 完全同点（VP・ターン数同一）は共同勝利 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].deck = ['province']; s.players[0].hand = []; s.players[0].discard = []; s.players[0].inPlay = [];
s.players[1].deck = ['province']; s.players[1].hand = []; s.players[1].discard = []; s.players[1].inPlay = [];
s.players[0].turns = 10; s.players[1].turns = 10;
const rTie = E.scoreGame(s);
ok(rTie.winners.length === 2, '完全同点は winners が2人: ' + JSON.stringify(rTie.winners));

console.log('=== 開始プレイヤーの指定（startActive） ===');
s = E.createInitialState(['A', 'B'], null, { startActive: 1 });
ok(s.turn.active === 1, 'startActive:1 で席1から開始');
ok(s.log[0].includes('B'), '開始ログも席1の名前: ' + s.log[0]);
s = E.createInitialState(['A', 'B', 'C'], null, { startActive: 'random' });
ok(s.turn.active >= 0 && s.turn.active < 3, "startActive:'random' は範囲内: " + s.turn.active);
s = E.createInitialState(['A', 'B'], null, { startActive: 99 });
ok(s.turn.active === 0, '範囲外は席0に丸める');
s = E.createInitialState(['A', 'B']);
ok(s.turn.active === 0, '省略時は従来通り席0');

console.log('=== マスキング: 相手の捨て札も伏せる（自分のは見える） ===');
s = E.createInitialState(['A', 'B']);
s.players[0].discard = ['gold', 'province'];
s.players[1].discard = ['silver', 'duchy', 'curse'];
s.players[1].inPlay = ['village'];
let masked = E.maskStateFor(s, 0);
ok(masked.players[0].discard.join(',') === 'gold,province', '自分の捨て札は実物');
ok(masked.players[1].discard.length === 3 && masked.players[1].discard.every((c) => c === 'back'), '相手の捨て札は枚数のみ(back)');
ok(masked.players[1].inPlay.join(',') === 'village', '場(inPlay)は公開のまま');
ok(masked.players[1].hand.every((c) => c === 'back') && masked.players[1].deck.every((c) => c === 'back'), '手札・山札も伏せたまま');

console.log('=== 得点内訳（vpCards）が結果に含まれる ===');
s = E.createInitialState(['A', 'B']);
s.players[0].deck = ['province', 'province', 'estate', 'curse'];
s.players[0].hand = []; s.players[0].discard = []; s.players[0].inPlay = [];
const rBd = E.scoreGame(s);
ok(rBd.scores[0].vpCards.province === 2 && rBd.scores[0].vpCards.estate === 1 && rBd.scores[0].vpCards.curse === 1,
  '内訳 属州2・屋敷1・呪い1: ' + JSON.stringify(rBd.scores[0].vpCards));

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

console.log('=== 研究所: +2カード +1アクション ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['laboratory', 'copper'];
s.players[0].deck = ['gold', 'silver', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'laboratory' });
ok(s2.players[0].hand.length === 1 + 2, '研究所で手札 1→+2: ' + s2.players[0].hand.length);
ok(s2.turn.actions === 1, '研究所でアクション 1-1+1=1: ' + s2.turn.actions);

console.log('=== 祝祭: +2アクション +1購入 +2コイン ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['festival', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'festival' });
ok(s2.turn.actions === 2, '祝祭でアクション 1-1+2=2: ' + s2.turn.actions);
ok(s2.turn.buys === 2, '祝祭で購入 1+1=2: ' + s2.turn.buys);
ok(s2.turn.coins === 2, '祝祭でコイン +2: ' + s2.turn.coins);

console.log('=== 金貸し: 銅貨を廃棄して+3 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['moneylender', 'copper', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'moneylender' });
ok(s2.pending && s2.pending.type === 'moneylender', '金貸し: 選択待ち');
s2 = E.reduce(s2, { type: 'MONEYLENDER_RESOLVE', trash: true });
ok(s2.turn.coins === 3 && count(s2.trash, 'copper') === 1, '銅貨を廃棄して+3コイン');
// 銅貨なしなら何も起きない
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['moneylender', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'moneylender' });
ok(s2.pending === null && s2.turn.coins === 0, '銅貨が無ければ選択待ちにならない');

console.log('=== 宰相: +2コイン・山札を捨て札にできる ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['chancellor'];
s.players[0].deck = ['gold', 'silver', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'chancellor' });
ok(s2.turn.coins === 2, '宰相 +2コイン');
s2 = E.reduce(s2, { type: 'CHANCELLOR_RESOLVE', discardDeck: true });
ok(s2.players[0].deck.length === 0 && s2.players[0].discard.length === 3, '山札が捨て札へ');

console.log('=== 礼拝堂: 最大4枚廃棄 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['chapel', 'estate', 'estate', 'curse', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
s2 = E.reduce(s2, { type: 'CHAPEL_RESOLVE', cards: ['estate', 'estate', 'curse'] });
ok(count(s2.trash, 'estate') === 2 && count(s2.trash, 'curse') === 1, '3枚廃棄');
ok(s2.players[0].hand.indexOf('copper') >= 0, '残した銅貨は手札に');
// 5枚指定しても4枚まで
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['chapel', 'estate', 'estate', 'estate', 'estate', 'estate'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
s2 = E.reduce(s2, { type: 'CHAPEL_RESOLVE', cards: ['estate', 'estate', 'estate', 'estate', 'estate'] });
ok(count(s2.trash, 'estate') === 4, '5枚指定でも4枚まで廃棄: ' + count(s2.trash, 'estate'));

console.log('=== 庭園: デッキ10枚につき1勝利点 ===');
{
  const mk = (n) => { const deck = ['gardens']; for (let i = 0; i < n - 1; i++) deck.push('copper'); return { deck, hand: [], discard: [], inPlay: [] }; };
  ok(E.vpOf(mk(10)) === 1, '10枚で1点: ' + E.vpOf(mk(10)));
  ok(E.vpOf(mk(25)) === 2, '25枚で2点(端数切捨て): ' + E.vpOf(mk(25)));
  ok(E.vpOf(mk(9)) === 0, '9枚で0点');
  const two = { deck: ['gardens', 'gardens'].concat(Array(18).fill('copper')), hand: [], discard: [], inPlay: [] };
  ok(E.vpOf(two) === 4, '庭園2枚×20枚デッキ=各2点で4点: ' + E.vpOf(two));
}

console.log('=== 魔女: +2カード、他は呪いを獲得 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['witch'];
s.players[0].deck = ['copper', 'copper', 'gold'];
s.players[1].hand = ['estate', 'copper'];
const curseBefore = s.supply.curse;
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'witch' });
ok(s2.players[0].hand.length === 0 + 2, '魔女 +2カード');
ok(count(s2.players[1].discard, 'curse') === 1 && s2.supply.curse === curseBefore - 1, '相手が呪いを獲得');
ok(s2.pending === null, '解決完了');
// 堀で無効化
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['witch'];
s.players[0].deck = ['copper', 'copper'];
s.players[1].hand = ['moat'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'witch' });
ok(s2.pending && s2.pending.type === 'witch' && s2.pending.stage === 'react', '堀持ちは反応待ち');
s2 = E.reduce(s2, { type: 'MOAT_REVEAL' });
ok(count(s2.players[1].discard, 'curse') === 0 && s2.pending === null, '堀で呪いを無効化');

console.log('=== 役人: 銀貨を山札の上に、他は勝利点を山札の上に ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['bureaucrat'];
s.players[0].deck = ['copper'];
s.players[1].hand = ['estate', 'duchy', 'copper'];
const silBefore = s.supply.silver;
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'bureaucrat' });
ok(s2.players[0].deck[0] === 'silver' && s2.supply.silver === silBefore - 1, '銀貨を山札の上に獲得');
ok(s2.pending && s2.pending.type === 'bureaucrat' && s2.pending.stage === 'put' && s2.pending.player === 1, '相手が勝利点を置く選択待ち');
s2 = E.reduce(s2, { type: 'BUREAUCRAT_PUT', card: 'estate' });
ok(s2.players[1].deck[0] === 'estate' && s2.players[1].hand.indexOf('estate') < 0, '勝利点(屋敷)が山札の上へ');
ok(s2.pending === null, '解決完了');
// 勝利点なしなら手札公開のみ（pending無し）
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['bureaucrat'];
s.players[0].deck = ['copper'];
s.players[1].hand = ['copper', 'silver'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'bureaucrat' });
ok(s2.pending === null, '相手に勝利点が無ければ pending 無しで終了');

console.log('=== 議事堂: +4カード+1購入、他は1枚引く ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['council_room'];
s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'gold'];
s.players[1].deck = ['silver', 'silver'];
const b1hand = s.players[1].hand.length;
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'council_room' });
ok(s2.players[0].hand.length === 0 + 4, '議事堂 +4カード');
ok(s2.turn.buys === 2, '議事堂 +1購入');
ok(s2.players[1].hand.length === b1hand + 1, '相手は1枚引く');

console.log('=== 祝宴: 自身を廃棄→コスト5以下を獲得 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['feast'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'feast' });
ok(count(s2.trash, 'feast') === 1 && s2.players[0].inPlay.indexOf('feast') < 0, '祝宴が廃棄された');
ok(s2.pending && s2.pending.type === 'feast', 'コスト5以下の獲得待ち');
s2 = E.reduce(s2, { type: 'FEAST_GAIN', card: 'duchy' }); // 公領=コスト5
ok(count(s2.players[0].discard, 'duchy') === 1 && s2.pending === null, 'コスト5(公領)を獲得');

console.log('=== 冒険者: 財宝2枚を引くまで公開 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['adventurer'];
s.players[0].deck = ['estate', 'copper', 'duchy', 'silver', 'gold']; // 上から: estate,copper(財1),duchy,silver(財2)
s.players[0].discard = [];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'adventurer' });
ok(count(s2.players[0].hand, 'copper') === 1 && count(s2.players[0].hand, 'silver') === 1, '財宝2枚(銅貨・銀貨)を手札に');
ok(count(s2.players[0].discard, 'estate') === 1 && count(s2.players[0].discard, 'duchy') === 1, '間の非財宝は捨て札へ');
ok(s2.players[0].deck[0] === 'gold', '2枚見つけたら止まる(金貨は山札に残る)');
// 財宝が1枚しかなくてもクラッシュしない
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['adventurer'];
s.players[0].deck = ['estate', 'copper']; s.players[0].discard = [];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'adventurer' });
ok(count(s2.players[0].hand, 'copper') === 1, '財宝が尽きても安全に終了');

console.log('=== 書庫: 手札7枚まで引く（アクションは脇に置ける）===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['library', 'copper']; // 開始1枚（library除く）
s.players[0].deck = ['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'copper']; // 非アクションのみ
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'library' });
ok(s2.players[0].hand.length === 7 && s2.pending === null, '非アクションのみなら一気に7枚: ' + s2.players[0].hand.length);
// アクションを引いたら選択待ち→脇に置く
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['library'];
s.players[0].deck = ['copper', 'village', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'library' });
ok(s2.pending && s2.pending.type === 'library' && s2.pending.card === 'village', 'アクション(村)を引いて選択待ち');
s2 = E.reduce(s2, { type: 'LIBRARY_RESOLVE', setAside: true });
ok(s2.players[0].hand.length === 7 && s2.players[0].hand.indexOf('village') < 0, '村を脇に置き、引き直して7枚');
ok(s2.players[0].discard.indexOf('village') >= 0, '脇に置いた村は捨て札へ');

console.log('=== 密偵: 全員の山札の上を捨/戻し ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['spy'];
s.players[0].deck = ['gold', 'estate', 'copper']; // +1ドローでgold、その後上はestate
s.players[1].deck = ['curse', 'silver'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'spy' });
ok(s2.turn.actions === 1 && s2.players[0].hand.length === 1, '密偵 +1カード+1アクション');
ok(s2.pending && s2.pending.type === 'spy' && s2.pending.stage === 'decide' && s2.pending.victim === 0, 'まず自分の山札の上を判断');
s2 = E.reduce(s2, { type: 'SPY_DECIDE', discard: false }); // 自分のはそのまま
ok(s2.pending && s2.pending.victim === 1 && s2.pending.card === 'curse', '次に相手(席1)の上=呪い');
s2 = E.reduce(s2, { type: 'SPY_DECIDE', discard: true }); // 相手の呪いを捨てさせる…のは相手に得だが動作確認
ok(s2.players[1].discard.indexOf('curse') >= 0 && s2.pending === null, '相手の山札の上を捨てさせ解決完了');

console.log('=== 泥棒: 財宝を廃棄→獲得 ===');
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['thief'];
s.players[1].deck = ['gold', 'estate', 'copper']; // 上2: gold(財), estate
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'thief' });
ok(s2.pending && s2.pending.type === 'thief' && s2.pending.stage === 'pick', '財宝を選ぶ待ち');
ok(s2.pending.treasures.indexOf('gold') >= 0, '公開された金貨が候補');
s2 = E.reduce(s2, { type: 'THIEF_PICK', card: 'gold' });
ok(count(s2.trash, 'gold') === 1 || s2.pending.trashed === 'gold', '金貨を廃棄');
ok(s2.players[1].discard.indexOf('estate') >= 0, '残り(屋敷)は相手の捨て札へ');
s2 = E.reduce(s2, { type: 'THIEF_GAIN', take: true });
ok(count(s2.players[0].discard, 'gold') === 1 && s2.pending === null, '廃棄した金貨を獲得して解決完了');
// 堀で無効化
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['thief'];
s.players[1].hand = ['moat'];
s.players[1].deck = ['gold', 'silver'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'thief' });
s2 = E.reduce(s2, { type: 'MOAT_REVEAL' });
ok(s2.trash.length === 0 && s2.pending === null, '泥棒を堀で無効化');

console.log('=== 玉座の間: アクションを2回使う ===');
// 非対話カード（鍛冶屋=+3カード）を2回 → +6カード
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['throne_room', 'smithy'];
s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
ok(s2.pending && s2.pending.type === 'throne', '2回使うカードの選択待ち');
s2 = E.reduce(s2, { type: 'THRONE_CHOOSE', card: 'smithy' });
ok(s2.players[0].hand.length === 6 && s2.pending === null, '鍛冶屋を2回で+6カード: ' + s2.players[0].hand.length);
ok(count(s2.players[0].inPlay, 'smithy') === 1, '鍛冶屋は場に1枚(2回使用)');

// 玉座+市場（非ターミナル+α）を2回 → +2カード,+2アクション,+2購入,+2コイン
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['throne_room', 'market'];
s.players[0].deck = ['copper', 'copper', 'silver'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
s2 = E.reduce(s2, { type: 'THRONE_CHOOSE', card: 'market' });
ok(s2.turn.buys === 1 + 2 && s2.turn.coins === 2 && s2.turn.actions === 2, '市場2回: +2購入+2コイン+2アクション: buys=' + s2.turn.buys);

// 玉座+民兵（対話カード）: 1回目のコインは即時、2回目は1回目の解決後に発火（リプレイ）
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['throne_room', 'militia'];
s.players[0].deck = ['copper', 'copper'];
s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'estate']; // 5枚
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
s2 = E.reduce(s2, { type: 'THRONE_CHOOSE', card: 'militia' });
ok(s2.turn.coins === 2, '1回目の民兵で+2コイン（この時点では2回目は未発火）: ' + s2.turn.coins);
ok(s2.pending && s2.pending.type === 'militia' && s2.pending.player === 1, '1回目の民兵で相手に選択待ち');
s2 = E.reduce(s2, { type: 'MILITIA_RESOLVE', cards: ['copper', 'copper'] }); // 5→3、解決後に2回目発火
ok(s2.turn.coins === 4, '2回目の民兵が発火して合計+4コイン: ' + s2.turn.coins);
ok(s2.pending === null, '相手は既に3枚なので2回目は捨て直し無し→終了');
ok(s2.players[1].hand.length === 3, '相手は3枚（1回目で捨て、2回目は対象外）: ' + s2.players[1].hand.length);

console.log('=== 役人: 銀貨切れでも誤った獲得ログを出さない（監査修正）===');
s = E.createInitialState(['A', 'B']);
s.supply.silver = 0;
s.players[0].hand = ['bureaucrat'];
s.players[0].deck = ['copper'];
s.players[1].hand = ['copper', 'silver']; // 勝利点なし
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'bureaucrat' });
ok(s2.players[0].deck[0] === 'copper', '銀貨切れなら山札の上は変わらない');
ok(!s2.log.some((l) => l.includes('銀貨を山札の上に獲得')), '銀貨切れ時に誤った獲得ログを出さない');

console.log('=== 公開(reveal)チャネル: 席ごとに保持し全員に見せる ===');
// 役人: 相手(席1)が勝利点を山札の上に置く → reveals[1] にそのカードが入り、相手視点でもマスクされず見える
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['bureaucrat'];
s.players[1].hand = ['estate', 'copper', 'copper'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'bureaucrat' });
s2 = E.reduce(s2, { type: 'BUREAUCRAT_PUT', card: 'estate' });
ok(s2.reveals && s2.reveals[1] && s2.reveals[1].cards[0] === 'estate', '役人: 公開した勝利点が reveals[席1] に入る');
ok(s2.revealLatest === 1, 'revealLatest が公開した席を指す');
const maskedFoe = E.maskStateFor(s2, 0); // 公開した本人(席1)以外＝席0視点
ok(maskedFoe.reveals && maskedFoe.reveals[1] && maskedFoe.reveals[1].cards[0] === 'estate', '役人: 公開は相手視点でもマスクされない（公開情報）');
ok(maskedFoe.players[1].hand.every((c) => c === 'back'), '役人: 一方で相手の手札自体は伏せたまま');
// 複数の相手が公開 → 各席に残る（最後の1人で上書きされない）: 3人で密偵
let sp = E.createInitialState(['A', 'B', 'C'], ['spy', 'village', 'market', 'smithy', 'militia', 'moat', 'cellar', 'mine', 'remodel', 'workshop'], { startActive: 0 });
sp.players[0].hand = ['spy']; sp.players[0].deck = ['gold', 'copper'];
sp.players[1].deck = ['silver', 'copper']; sp.players[2].deck = ['estate', 'copper'];
sp = E.reduce(sp, { type: 'PLAY_ACTION', card: 'spy' });
// 各席の公開を順に解決（自分→相手2人）。decideは「そのまま」を選ぶ。
let guard = 0;
while (sp.pending && sp.pending.type === 'spy' && guard++ < 10) sp = E.reduce(sp, { type: 'SPY_DECIDE', discard: false });
ok(sp.reveals && sp.reveals[1] && sp.reveals[2], '密偵: 席1と席2の公開が両方残る（最後の人で上書きされない）');
// 役人: 勝利点を持たない → 手札全体を公開
s = E.createInitialState(['A', 'B']);
s.players[0].hand = ['bureaucrat'];
s.players[1].hand = ['copper', 'silver', 'smithy'];
s2 = E.reduce(s, { type: 'PLAY_ACTION', card: 'bureaucrat' });
ok(s2.reveals && s2.reveals[1] && s2.reveals[1].cards.length === 3, '役人: 勝利点なしなら手札全体を公開');
// 手番を跨ぐと reveals は消える
s2.turn.phase = 'buy';
s2 = E.reduce(s2, { type: 'END_TURN' });
ok(!s2.reveals || Object.keys(s2.reveals).length === 0, 'reveals は手番を跨ぐとクリアされる');

console.log('\n========================================');
console.log(`結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
