/* 繁栄（Prosperity 第二版）ゲームロジックの検証（Node 単体実行）
   使い方: node test/prosperity.test.js
   対象: VPトークン / プラチナ貨・植民地 / コスト軽減 / 動的財宝 / 各カード効果 / アタック / CPU対CPU */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
let seed = 99887766;
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

const PK = DOM.KINGDOM_PROSPERITY; // 物見やぐら/記念碑/労働者の村/司教/都市/群衆/金庫室/高級市場/王の宮廷/行商人
function mk(kingdom, players) { return E.createInitialState(players || ['A', 'B'], kingdom || PK, { startActive: 0 }); }
function endTurn(s) {
  let g = 0;
  while (s.pending && g++ < 120) s = reduce(s, CPU.decide(s));
  if (s.turn.phase === 'action') s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  g = 0;
  while (s.pending && g++ < 120) s = reduce(s, CPU.decide(s));
  return s;
}
function resolveAll(s) { let g = 0; while (s.pending && g++ < 200) s = reduce(s, CPU.decide(s)); return s; }

console.log('=== プラチナ貨/植民地：繁栄が場にあると供給され、買えて、得点する ===');
{
  let s = mk();
  ok(s.supply.platinum === 12, 'プラチナ貨が12枚供給される');
  ok(s.supply.colony === 8, '植民地が8枚供給される（2人）');
  // 非繁栄ではプラチナ/植民地は供給されない
  let b = E.createInitialState(['A', 'B'], DOM.KINGDOM, { startActive: 0 });
  ok(b.supply.platinum == null && b.supply.colony == null, '非繁栄ではプラチナ/植民地は供給されない');
  // プラチナ貨は +5コイン
  s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['platinum'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'platinum' });
  ok(s.turn.coins === 5, 'プラチナ貨で +5コイン (実 ' + s.turn.coins + ')');
  // 植民地は10点
  s = mk(); s.players[0].discard.push('colony');
  ok(E.vpOf(s.players[0]) === 3 + 10, '植民地で +10勝利点');
}

console.log('=== 記念碑：+2コイン +1VPトークン（終了時に得点）===');
{
  let s = mk(); s.players[0].hand.push('monument');
  const before = E.vpOf(s.players[0]);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'monument' });
  ok(s.turn.coins === 2, '記念碑 +2コイン');
  ok(s.players[0].vpTokens === 1, '記念碑 +1VPトークン');
  ok(E.vpOf(s.players[0]) === before + 1, 'VPトークンが得点に加算される (実 ' + E.vpOf(s.players[0]) + ' / 前 ' + before + ')');
}

console.log('=== 労働者の村：+1カード+2アクション+1購入 ===');
{
  let s = mk(); s.players[0].hand = ['workers_village']; s.players[0].deck = ['copper', 'silver'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'workers_village' });
  ok(s.turn.actions === 2 && s.turn.buys === 2 && s.players[0].hand.length === 1, '労働者の村 +1カード+2アクション+1購入');
}

console.log('=== 司教：+1コイン+1VP、手札1枚を廃棄してコスト$2につき+VP ===');
{
  let s = mk(); s.players[0].hand = ['bishop', 'gold', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bishop' });
  ok(s.turn.coins === 1 && s.players[0].vpTokens === 1, '司教 +1コイン+1VP');
  ok(s.pending && s.pending.type === 'bishop' && s.pending.stage === 'trash', '司教：廃棄の選択が出る');
  s = reduce(s, { type: 'BISHOP_TRASH', card: 'gold' }); // 金貨$6 → +3VP
  ok(s.players[0].vpTokens === 1 + 3, '金貨($6)を廃棄して +3VP (実 ' + s.players[0].vpTokens + ')');
  ok(count(s.trash, 'gold') === 1, '金貨が廃棄置き場へ');
  s = resolveAll(s);
}

console.log('=== 石切場：場にある間アクションは$2安い（コスト軽減） ===');
{
  let s = mk(); s.players[0].hand = ['quarry']; s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'quarry' });
  ok(s.turn.coins === 1, '石切場 +1コイン');
  ok(E.cardCost(s, 'kings_court') === 5, '石切場で王の宮廷($7)が$5に (実 ' + E.cardCost(s, 'kings_court') + ')');
  ok(E.cardCost(s, 'gold') === 6, '石切場は財宝のコストは下げない（金貨$6）');
}

console.log('=== 行商人：購入フェイズ、場のアクション1枚につき$2安い ===');
{
  let s = mk(); s.turn.phase = 'buy';
  s.players[0].inPlay = ['workers_village', 'city']; // アクション2枚
  ok(E.cardCost(s, 'peddler') === 8 - 4, '行商人は場のアクション2枚で$4に (実 ' + E.cardCost(s, 'peddler') + ')');
  s.turn.phase = 'action';
  ok(E.cardCost(s, 'peddler') === 8, 'アクションフェイズでは$8のまま');
}

console.log('=== 銀行：場の財宝の枚数ぶん +コイン（自身を含む） ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['copper', 'silver', 'bank'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'copper' }); // +1
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' }); // +2
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'bank' });    // 場に3枚（銅/銀/銀行）→ +3
  ok(s.turn.coins === 1 + 2 + 3, '銀行：場の財宝3枚で +3 (合計 ' + s.turn.coins + ')');
}

console.log('=== 隠し財産：勝利点カードを獲得したとき金貨を獲得（購入でなくても） ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.players[0].inPlay = ['hoard'];
  s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'duchy' }); // 勝利点を購入
  ok(count(s.players[0].discard, 'gold') === 1, '公領購入で金貨1枚を獲得（隠し財産）');
  ok(count(s.players[0].discard, 'duchy') === 1, '公領も獲得');
}

console.log('=== 王の宮廷：アクション1枚を3回使う ===');
{
  let s = mk(); s.players[0].hand = ['kings_court', 'monument'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'kings_court' });
  ok(s.pending && s.pending.type === 'kings_court', '王の宮廷：3回使うカードを選ぶ');
  s = reduce(s, { type: 'KINGS_COURT_CHOOSE', card: 'monument' });
  s = resolveAll(s);
  ok(s.turn.coins === 6 && s.players[0].vpTokens === 3, '記念碑を3回＝+6コイン +3VP (実 ' + s.turn.coins + '/' + s.players[0].vpTokens + ')');
}

console.log('=== 都市：空山が増えると効果が伸びる ===');
{
  let s = mk(); s.players[0].hand = ['city']; s.players[0].deck = ['copper', 'silver', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'city' });
  ok(s.turn.actions === 2 && s.players[0].hand.length === 1, '空山0：+1カード+2アクション');
  // 空山を2つ作る
  s = mk(); s.supply.estate = 0; s.supply.duchy = 0;
  s.players[0].hand = ['city']; s.players[0].deck = ['copper', 'silver', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'city' });
  ok(s.players[0].hand.length === 2 && s.turn.buys === 2 && s.turn.coins === 1, '空山2：+2カード+1購入+1コイン');
}

console.log('=== 高級市場：場に銅貨があると買えない ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 2;
  s.players[0].inPlay = ['copper'];
  ok(!E.canBuyCard(s, 0, 'grand_market'), '場に銅貨があると高級市場は購入不可');
  let before = count(s.players[0].discard, 'grand_market');
  s = reduce(s, { type: 'BUY', card: 'grand_market' });
  ok(count(s.players[0].discard, 'grand_market') === before, '銅貨が場にあると高級市場は購入されない');
  s.players[0].inPlay = ['silver'];
  ok(E.canBuyCard(s, 0, 'grand_market'), '銅貨が無ければ購入可');
}

console.log('=== 造幣所：購入したとき場の財宝をすべて廃棄 ===');
{
  let s = mk(); s.supply.mint = 10; s.turn.phase = 'buy'; s.players[0].inPlay = ['copper', 'silver', 'gold'];
  s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'mint' });
  ok(count(s.players[0].inPlay, 'copper') === 0 && count(s.players[0].inPlay, 'silver') === 0 && count(s.players[0].inPlay, 'gold') === 0, '造幣所購入で場の財宝が全廃棄');
  ok(s.trash.filter((c) => DOM.isType(c, 'treasure')).length === 3, '廃棄置き場に財宝3枚');
}

console.log('=== 拡張：廃棄→+$3までを獲得 ===');
{
  let s = mk(); s.players[0].hand = ['expand', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'expand' });
  s = reduce(s, { type: 'EXPAND_TRASH', card: 'estate' }); // $2 → 最大$5
  ok(s.pending && s.pending.type === 'expand' && s.pending.maxCost === 5, '拡張：屋敷($2)→最大$5獲得');
  s = reduce(s, { type: 'EXPAND_GAIN', card: 'duchy' }); // $5
  ok(count(s.players[0].discard, 'duchy') === 1, '公領($5)を獲得');
}

console.log('=== 群衆（アタック）：相手は山札の上3枚のアクション/財宝を捨てる ===');
{
  let s = mk(['rabble', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.players[0].hand = ['rabble']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s.players[1].deck = ['gold', 'silver', 'estate', 'copper']; // 上3=金/銀/屋敷
  s = reduce(s, { type: 'PLAY_ACTION', card: 'rabble' });
  s = resolveAll(s);
  ok(count(s.players[1].discard, 'gold') === 1 && count(s.players[1].discard, 'silver') === 1, '相手は金貨・銀貨（財宝）を捨てる');
  ok(s.players[1].deck[0] === 'estate', '屋敷（非アクション/財宝）は山札の上に残る');
}

console.log('=== ペテン師（財宝アタック）：相手は銅貨を獲得 ===');
{
  let s = mk(['charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.turn.phase = 'buy'; s.players[0].hand = ['charlatan'];
  const before = count(s.players[1].discard, 'copper');
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'charlatan' });
  s = resolveAll(s);
  ok(s.turn.coins === 3, 'ペテン師 +3コイン');
  ok(count(s.players[1].discard, 'copper') === before + 1, '相手は銅貨1枚を獲得');
}

console.log('=== 物見やぐら（獲得時リアクション）：買ったカードを廃棄/山札上/受け取る ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['watchtower']; s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'duchy' });
  ok(s.pending && s.pending.type === 'watchtower' && s.pending.card === 'duchy', '購入時に物見やぐらの選択が出る');
  s = reduce(s, { type: 'WATCHTOWER', choice: 'topdeck' });
  ok(s.players[0].deck[0] === 'duchy', '公領を山札の上に置いた');
}

console.log('=== 金庫室：+2カード、捨てて+コイン。相手は2枚捨てて1枚引ける ===');
{
  let s = mk(); s.players[0].hand = ['vault']; s.players[0].deck = ['estate', 'estate', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'vault' });
  ok(s.players[0].hand.length === 2, '金庫室 +2カード');
  ok(s.pending && s.pending.type === 'vault' && s.pending.stage === 'discard', '金庫室：捨てる選択');
  const hand = s.players[0].hand.slice();
  s = reduce(s, { type: 'VAULT_DISCARD', cards: hand }); // 2枚捨てる
  ok(s.turn.coins === 2, '2枚捨てて +2コイン');
  s = resolveAll(s);
}

console.log('=== 投資：これを廃棄して +1コイン ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['investment'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'investment' });
  ok(count(s.trash, 'investment') === 1, '投資は使うと廃棄される');
  ok(s.pending && s.pending.type === 'investment', '投資：選択が出る');
  s = reduce(s, { type: 'INVESTMENT', choice: 'coin' });
  ok(s.turn.coins === 1, '投資 +1コイン');
}

console.log('=== 軍用金：左隣が指定、$5以下の未指定カードを獲得 ===');
{
  let s = mk(); s.players[0].hand = ['war_chest'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'war_chest' });
  ok(s.pending && s.pending.type === 'war_chest' && s.pending.stage === 'name' && s.pending.player === 1, '左隣(席1)が指定');
  s = reduce(s, { type: 'WAR_CHEST_NAME', card: 'gold' }); // 金貨を禁止
  ok(s.pending && s.pending.stage === 'gain' && s.pending.player === 0, '席0が獲得する番');
  s = reduce(s, { type: 'WAR_CHEST_GAIN', card: 'duchy' });
  ok(count(s.players[0].discard, 'duchy') === 1, '指定外の公領($5)を獲得');
}

console.log('=== 司教：空手札でもデッドロックしない（廃棄を飛ばす）===');
{
  let s = mk(); s.players[0].hand = ['bishop']; s.players[0].deck = []; s.players[0].discard = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bishop' });
  // 手札が空なので bishop/trash の pending は立たない（他者廃棄へ or 終了）
  ok(!s.pending || s.pending.stage !== 'trash', '空手札では廃棄pendingが立たない（デッドロック回避）');
  s = resolveAll(s);
  ok(!s.pending, '解決後 pending なし');
  ok(s.players[0].vpTokens === 1, '司教の +1VPは入る');
}

console.log('=== ティアラ：相手の堀でも2回目のコインは取りこぼさない ===');
{
  let s = mk(['charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.turn.phase = 'buy'; s.players[0].hand = ['tiara', 'charlatan']; s.players[1].hand = ['moat'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'tiara' }); // +1購入、2回使う選択
  ok(s.pending && s.pending.type === 'tiara_play', 'ティアラ：2回使う選択');
  s = reduce(s, { type: 'TIARA_PLAY', card: 'charlatan' }); // ペテン師を2回（相手は堀）
  // 2回目は state.replay に積まれ、1回目のリアクション窓が解決してから適用される（公式：1回目が
  // 完全に解決してから2回目を使う）。反応待ちの最中はまだ$3で、解決後に$6になる＝取りこぼさない。
  ok(s.turn.coins === 3 && s.pending && s.pending.type === 'charlatan', 'ティアラ：2回目は1回目のリアクション解決後（この時点では$3）');
  s = resolveAll(s);
  ok(s.turn.coins === 6, 'ペテン師$3 ×2 ＝ +6コイン（堀でも2回目を取りこぼさない。実 ' + s.turn.coins + ')');
  ok(!s.pending, '解決後 pending なし');
}
console.log('=== ティアラ×ペテン師（3人）：1人が堀でも、堀でない相手は2回とも銅貨を受ける ===');
{
  // 回帰：旧実装は「1回目がリアクション待ちなら2回目のアタックを丸ごと飛ばす」ため、
  //   堀を持たない相手が銅貨を1枚しか受けなかった（2回目のアタックが消えていた）。
  let s = mk(['charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B', 'C']);
  s.turn.phase = 'buy'; s.players[0].hand = ['tiara', 'charlatan'];
  s.players[1].hand = ['moat', 'estate'];   // 席1＝堀持ち（免疫）
  s.players[2].hand = ['estate', 'estate']; // 席2＝リアクション無し
  const b1 = count(s.players[1].discard, 'copper'), b2 = count(s.players[2].discard, 'copper');
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'tiara' });
  s = reduce(s, { type: 'TIARA_PLAY', card: 'charlatan' });
  s = resolveAll(s);
  ok(s.turn.coins === 6, '3人でも +6コイン (実 ' + s.turn.coins + ')');
  ok(count(s.players[1].discard, 'copper') === b1, '堀持ちは銅貨0枚（2回とも免疫）');
  ok(count(s.players[2].discard, 'copper') === b2 + 2, '堀無しは銅貨2枚（2回目のアタックも発動。実 +' + (count(s.players[2].discard, 'copper') - b2) + '）');
}

console.log('=== 会計士：手番開始時に手札から使える（アクション消費せず）===');
{
  let s = mk(['clerk', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.players[1].hand = ['clerk', 'copper', 'copper', 'copper', 'copper']; // 席1の手番開始時の手札に会計士
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' }); // 席0終了→席1開始：resolveDurationStartEffects(1) で clerk_start
  ok(s.pending && s.pending.type === 'clerk_start' && s.pending.player === 1, '手番開始時に会計士のリアクションが出る');
  const actBefore = s.turn.actions;
  s = reduce(s, { type: 'CLERK_START', play: true });
  ok(s.players[1].inPlay.includes('clerk') && s.turn.coins === 2, '会計士を使った（+2コイン）');
  ok(s.turn.actions === actBefore, 'アクションを消費しない (実 ' + s.turn.actions + '/' + actBefore + ')');
  s = resolveAll(s);
}

console.log('=== ティアラ×ペテン師：2回使うと相手は銅貨2枚を獲得（堀無し・2回目のアタックも発動）===');
{
  let s = mk(['charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.turn.phase = 'buy'; s.players[0].hand = ['tiara', 'charlatan']; s.players[1].hand = ['estate', 'estate']; // 席1はリアクション無し
  const before = count(s.players[1].discard, 'copper');
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'tiara' });
  s = reduce(s, { type: 'TIARA_PLAY', card: 'charlatan' });
  s = resolveAll(s);
  ok(s.turn.coins === 6, 'ペテン師$3×2＝+6コイン (実 ' + s.turn.coins + ')');
  ok(count(s.players[1].discard, 'copper') === before + 2, 'ティアラ×ペテン師：相手は銅貨2枚を獲得（実 +' + (count(s.players[1].discard, 'copper') - before) + '）');
}

console.log('=== 会計士：手番開始時に2枚とも使える（1枚目のアタックで選択が出ても2枚目が消えない）===');
{
  let s = mk(['clerk', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.players[1].hand = ['clerk', 'clerk', 'copper', 'copper', 'copper']; // 席1の手番開始手札に会計士2枚
  // 席0は開始手札5枚（銅貨/屋敷・リアクション無し）＝会計士のアタックで山札上置きの選択が出る
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' }); // →席1開始：clerk_start ×2 が startQueue に積まれる
  ok(s.pending && s.pending.type === 'clerk_start' && s.pending.player === 1, '1枚目の会計士リアクションが出る');
  s = resolveAll(s); // CPUが1枚目(+アタック)→2枚目(+アタック)を順に解決
  ok(count(s.players[1].inPlay, 'clerk') === 2, '会計士2枚とも場に出た（2枚目がstartQueueに取り残されない。実 ' + count(s.players[1].inPlay, 'clerk') + '枚）');
  ok(s.turn.coins === 4, '会計士2枚ぶんの +4コイン（実 ' + s.turn.coins + '）');
}

console.log('=== 水晶玉：山札上のペテン師を「使う」とアタックも発動する（特殊効果を取りこぼさない）===');
{
  let s = mk(['crystal_ball', 'charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler'], ['A', 'B']);
  s.turn.phase = 'buy'; s.players[0].hand = ['crystal_ball']; s.players[0].deck = ['charlatan', 'copper', 'copper'];
  s.players[1].hand = ['estate', 'estate']; // リアクション無し
  const before = count(s.players[1].discard, 'copper');
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crystal_ball' });
  ok(s.pending && s.pending.type === 'crystal_ball' && s.pending.card === 'charlatan', '水晶玉：山札上（ペテン師）を見る');
  s = reduce(s, { type: 'CRYSTAL_BALL', choice: 'play' });
  s = resolveAll(s);
  ok(s.players[0].inPlay.includes('charlatan'), '水晶玉：ペテン師を場に出して使った');
  ok(count(s.players[1].discard, 'copper') === before + 1, '水晶玉で使ったペテン師のアタックで相手が銅貨獲得（実 +' + (count(s.players[1].discard, 'copper') - before) + '）');
}

console.log('=== CPU対CPU：繁栄フル王国で無限ループ無く終局（複数シード）===');
{
  let okAll = true, ended = 0;
  for (let sd = 0; sd < 12; sd++) {
    const pool = DOM.POOLS.prosperity.slice();
    let ss = sd * 13 + 1; const k = pool.slice();
    for (let i = k.length - 1; i > 0; i--) { ss = (ss * 1103515245 + 12345) & 0x7fffffff; const j = ss % (i + 1); [k[i], k[j]] = [k[j], k[i]]; }
    let s = mk(k.slice(0, 10), [{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'normal' }]);
    let g = 0;
    while (!s.gameOver && g++ < 5000) s = reduce(s, CPU.decide(s));
    if (!s.gameOver) okAll = false; else ended++;
  }
  ok(okAll, 'CPU対CPU 12戦すべて終局 (終局 ' + ended + '/12)');
}

console.log('\n繁栄テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
process.exit(fail ? 1 : 0);
