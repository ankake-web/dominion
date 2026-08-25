/* 繁栄（Prosperity 第二版）ゲームロジックの検証（Node 単体実行）
   使い方: node test/prosperity.test.js
   対象: VPトークン / 白金貨・植民地 / コスト軽減 / 動的財宝 / 各カード効果 / アタック / CPU対CPU */
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

const PK = DOM.KINGDOM_PROSPERITY; // 望楼/記念碑/労働者の村/司教/都市/大衆/保管庫/大市場/宮廷/行商人
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

console.log('=== 白金貨/植民地：繁栄が場にあると供給され、買えて、得点する ===');
{
  let s = mk();
  ok(s.supply.platinum === 12, '白金貨が12枚供給される');
  ok(s.supply.colony === 8, '植民地が8枚供給される（2人）');
  // 非繁栄ではプラチナ/植民地は供給されない
  let b = E.createInitialState(['A', 'B'], DOM.KINGDOM, { startActive: 0 });
  ok(b.supply.platinum == null && b.supply.colony == null, '非繁栄ではプラチナ/植民地は供給されない');
  // 白金貨は +5コイン
  s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['platinum'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'platinum' });
  ok(s.turn.coins === 5, '白金貨で +5コイン (実 ' + s.turn.coins + ')');
  // 植民地は10点
  s = mk(); s.players[0].discard.push('colony');
  ok(E.vpOf(s.players[0]) === 3 + 10, '植民地で +10勝利点');
}

console.log('=== 植民地の山が尽きたらゲーム終了（属州と並ぶ独立の終了条件）===');
{
  // 3山終了でも属州枯れでもない盤面で、植民地だけが尽きた状態を作る。
  let s = mk();
  s.supply.colony = 1;
  ok(!E.isGameOver(s), '植民地が残っていれば終了しない');
  s.supply.colony = 0;
  ok(s.supply.province > 0, '前提：属州は残っている');
  ok(E.emptyPileCount(s) < 3, '前提：空の山は3未満（3山終了ではない）');
  ok(E.isGameOver(s), '植民地が尽きたら終了する');
  ok(E.scoreGame(s).reason === '植民地の山が尽きた', '終了理由が「植民地の山が尽きた」（実 ' + E.scoreGame(s).reason + '）');
  // 実プレイ経路：最後の1枚を購入 → そのターンの終了時に終局する
  s = mk(); s.supply.colony = 1; s.turn.phase = 'buy'; s.turn.coins = 11;
  s = reduce(s, { type: 'BUY', card: 'colony' });
  ok(s.supply.colony === 0, '前提：植民地を購入して山が尽きる');
  s = endTurn(s);
  ok(s.gameOver, '植民地の最後の1枚を買ったターンの終了時にゲームが終わる');
  ok(s.result && s.result.reason === '植民地の山が尽きた', '結果画面の理由も植民地');
  // 終了後に「全員のデッキ」を見せるための内訳（相手の山札はマスクで復元できないので result に載せる）
  const dc0 = s.result.scores[0].deckCards;
  ok(dc0 && dc0.copper === 7 && dc0.estate === 3 && dc0.colony === 1,
    'result に全員のデッキ内訳（deckCards）が載る（実 ' + JSON.stringify(dc0) + '）');
  ok(Object.keys(dc0).reduce((n, k) => n + dc0[k], 0) === s.result.scores[0].deckSize, 'deckCards の合計＝deckSize');
  // 植民地を使わないゲーム（colony キーが無い）は影響を受けない＝誤終了しない
  let b = E.createInitialState(['A', 'B'], DOM.KINGDOM, { startActive: 0 });
  ok(b.supply.colony == null && !E.isGameOver(b), '植民地を使わないゲームは誤って終了しない');
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
  ok(E.cardCost(s, 'kings_court') === 5, '石切場で宮廷($7)が$5に (実 ' + E.cardCost(s, 'kings_court') + ')');
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

console.log('=== 隠し財産：**購入した**勝利点にだけ金貨が付く（2022エラッタ＝「このターン」型）===');
/* 公式（第2版 June 2022・印刷済み）＝`$2 / This turn, when you gain a Victory card, if you bought it, gain a Gold.`
   公式FAQ＝`not when you gain a Victory card other ways (such as via War Chest)`。
   2026-08-25 まで「場にある間・どの獲得でも」だったので、工房/密輸人/軍用金で勝利点を取っただけで金貨が付いていた。 */
{
  let s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['hoard'];
  s.turn.buys = 1;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'hoard' });
  s.turn.coins = 5;
  s = reduce(s, { type: 'BUY', card: 'duchy' }); // 勝利点を**購入**
  ok(count(s.players[0].discard, 'gold') === 1, '公領を購入すると金貨1枚（実 ' + count(s.players[0].discard, 'gold') + '）');
  ok(count(s.players[0].discard, 'duchy') === 1, '公領も獲得');
  // 「このターン」型＝場を離れても効く（偽造通貨で廃棄しても、そのターンの購入には付く）
  ok((s.turn.hoardPlays || 0) === 1, '使用回数で数えている（場の枚数ではない）');
}
{
  // 購入でない獲得（工房）では金貨が付かない
  let s = mk(['workshop', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.turn.phase = 'buy'; s.players[0].hand = ['hoard'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'hoard' });
  const g0 = count(s.players[0].discard, 'gold');
  s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['workshop'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });
  s = reduce(s, { type: 'WORKSHOP_GAIN', card: 'estate' });   // 勝利点を**獲得**（購入ではない）
  ok(count(s.players[0].discard, 'estate') === 1, '工房で屋敷を獲得した');
  ok(count(s.players[0].discard, 'gold') === g0, '購入でない獲得では金貨が付かない（実 +' + (count(s.players[0].discard, 'gold') - g0) + '）');
}

console.log('=== 宮廷：アクション1枚を3回使う ===');
{
  let s = mk(); s.players[0].hand = ['kings_court', 'monument'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'kings_court' });
  ok(s.pending && s.pending.type === 'kings_court', '宮廷：3回使うカードを選ぶ');
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

console.log('=== 大市場：場に銅貨があると買えない ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 2;
  s.players[0].inPlay = ['copper'];
  ok(!E.canBuyCard(s, 0, 'grand_market'), '場に銅貨があると大市場は購入不可');
  let before = count(s.players[0].discard, 'grand_market');
  s = reduce(s, { type: 'BUY', card: 'grand_market' });
  ok(count(s.players[0].discard, 'grand_market') === before, '銅貨が場にあると大市場は購入されない');
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

console.log('=== 大衆（アタック）：相手は山札の上3枚のアクション/財宝を捨てる ===');
{
  let s = mk(['rabble', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.players[0].hand = ['rabble']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s.players[1].deck = ['gold', 'silver', 'estate', 'copper']; // 上3=金/銀/屋敷
  s = reduce(s, { type: 'PLAY_ACTION', card: 'rabble' });
  s = resolveAll(s);
  ok(count(s.players[1].discard, 'gold') === 1 && count(s.players[1].discard, 'silver') === 1, '相手は金貨・銀貨（財宝）を捨てる');
  ok(s.players[1].deck[0] === 'estate', '屋敷（非アクション/財宝）は山札の上に残る');
}

console.log('=== 山師（アクション-アタック）：+3コイン／相手は呪いを獲得／呪いは $1 の財宝でもある ===');
/* 2026-08-25：ここは長く「財宝-アタックで銅貨を配る」という**別のカード**として実装されていた。
   公式（第2版 2022年6月・過去版なし）＝`+$3 / Each other player gains a Curse.
   <hr> In games using this, Curse is also a Treasure worth $1.` */
{
  let s = mk(['charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.players[0].hand = ['charlatan']; s.turn.actions = 1;
  const before = count(s.players[1].discard, 'curse');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'charlatan' });
  s = resolveAll(s);
  ok(s.turn.coins === 3, '山師 +3コイン');
  ok(count(s.players[1].discard, 'curse') === before + 1, '相手は**呪い**1枚を獲得（銅貨ではない）');
  ok(s.charlatanRule === true, '山師が王国にあると常設ルールが立つ');
  ok(E.isTreasureFor(s, 'curse') === true, '呪いは財宝として扱われる');
  // 呪いを財宝として出すと $1 になる
  let u = mk(['charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  u.turn.phase = 'buy'; u.players[0].hand = ['curse'];
  u = reduce(u, { type: 'PLAY_TREASURE', card: 'curse' });
  ok(u.turn.coins === 1, '呪いを財宝として出すと +$1（実 ' + u.turn.coins + '）');
  // 山師が王国に無ければ呪いは財宝ではない
  const v = mk(['monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower', 'mint'], ['A', 'B']);
  ok(!v.charlatanRule && E.isTreasureFor(v, 'curse') === false, '山師が無いゲームでは呪いは財宝ではない');
}

console.log('=== 王の宮廷×山師：1回目のリアクション窓の後も2回目・3回目のアタックが飛ばない ===');
/* 回帰（§0-15）：「1回目が反応待ちなら以降の再演を丸ごと飛ばす」実装だと、堀を持たない相手が呪いを1枚しか受けない。 */
{
  let s = mk(['charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B', 'C']);
  s.players[0].hand = ['kings_court', 'charlatan']; s.turn.actions = 1;
  s.players[1].hand = ['moat', 'estate'];    // 席1＝堀持ち（免疫）
  s.players[2].hand = ['estate', 'estate'];  // 席2＝リアクション無し
  const b1 = count(s.players[1].discard, 'curse'), b2 = count(s.players[2].discard, 'curse');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'kings_court' });
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'charlatan' });
  s = resolveAll(s);
  ok(s.turn.coins === 9, '山師$3 ×3 ＝ +9コイン（実 ' + s.turn.coins + '）');
  ok(count(s.players[1].discard, 'curse') === b1, '堀の席は呪いを1枚も受けない');
  ok(count(s.players[2].discard, 'curse') === b2 + 3, '堀無しの席は3回とも呪いを受ける（実 +' + (count(s.players[2].discard, 'curse') - b2) + '）');
}

console.log('=== 望楼（獲得時リアクション）：買ったカードを廃棄/山札上/受け取る ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['watchtower']; s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'duchy' });
  ok(s.pending && s.pending.type === 'watchtower' && s.pending.card === 'duchy', '購入時に望楼の選択が出る');
  s = reduce(s, { type: 'WATCHTOWER', choice: 'topdeck' });
  ok(s.players[0].deck[0] === 'duchy', '公領を山札の上に置いた');
}

console.log('=== 保管庫：+2カード、捨てて+コイン。相手は2枚捨てて1枚引ける ===');
{
  let s = mk(); s.players[0].hand = ['vault']; s.players[0].deck = ['estate', 'estate', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'vault' });
  ok(s.players[0].hand.length === 2, '保管庫 +2カード');
  ok(s.pending && s.pending.type === 'vault' && s.pending.stage === 'discard', '保管庫：捨てる選択');
  const hand = s.players[0].hand.slice();
  s = reduce(s, { type: 'VAULT_DISCARD', cards: hand }); // 2枚捨てる
  ok(s.turn.coins === 2, '2枚捨てて +2コイン');
  s = resolveAll(s);
}

console.log('=== 出資：手札1枚を廃棄 → 二択（+$1／これを廃棄して手札の異名財宝ぶん +VP）===');
/* 2026-08-25：ここは「使った瞬間に無条件で自分を廃棄／手札の**財宝**を廃棄／**場**の財宝の種類数で +VP」
   という別物だった。公式＝`Trash a card from your hand. Choose one: +$1; or trash this to reveal your
   hand for +1 VP per differently named Treasure there.` */
{
  // ①+$1 側＝出資自身は廃棄されない（場に残る）
  let s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['investment', 'estate', 'copper'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'investment' });
  ok(s.pending && s.pending.type === 'investment' && s.pending.stage === 'trash', '出資：まず手札から1枚を廃棄する窓');
  ok(count(s.trash, 'investment') === 0, '使っただけでは出資は廃棄されない');
  s = reduce(s, { type: 'INVESTMENT_TRASH', card: 'estate' });   // **財宝でなくてもよい**
  ok(count(s.trash, 'estate') === 1, '手札の任意の1枚（屋敷）を廃棄できる');
  ok(s.pending && s.pending.type === 'investment' && !s.pending.stage, '廃棄の後に二択');
  s = reduce(s, { type: 'INVESTMENT', choice: 'coin' });
  ok(s.turn.coins === 1 && count(s.trash, 'investment') === 0, '+$1 を選ぶと出資は場に残る');

  // ②VP 側＝出資を廃棄し、**手札**の異なる名前の財宝の数だけ +VP
  let u = mk(); u.turn.phase = 'buy';
  u.players[0].hand = ['investment', 'copper', 'copper', 'silver', 'gold', 'estate'];
  u.players[0].inPlay = ['bank', 'bank'];   // **場**の財宝を数えないことの回帰（旧実装はここを数えていた）
  const vp0 = u.players[0].vpTokens || 0;
  u = reduce(u, { type: 'PLAY_TREASURE', card: 'investment' });
  u = reduce(u, { type: 'INVESTMENT_TRASH', card: 'estate' });
  u = reduce(u, { type: 'INVESTMENT', choice: 'vp' });
  ok(count(u.trash, 'investment') === 1, 'VP 側を選ぶと出資を廃棄する');
  ok((u.players[0].vpTokens || 0) === vp0 + 3, '手札の異名財宝は 銅貨/銀貨/金貨＝3種 → +3VP（実 +' + ((u.players[0].vpTokens || 0) - vp0) + '）');

  // ③手札が出資1枚だけ（＝出したら手札0枚）なら廃棄せず二択へ＝詰まない
  let w = mk(); w.turn.phase = 'buy'; w.players[0].hand = ['investment'];
  w = reduce(w, { type: 'PLAY_TREASURE', card: 'investment' });
  ok(w.pending && w.pending.type === 'investment' && !w.pending.stage, '手札が無ければ廃棄をとばして二択');
}

console.log('=== 軍用金：左隣が指定、$5以下の未指定カードを獲得 ===');
{
  let s = mk(); s.players[0].hand = ['war_chest'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });               // 財宝は購入フェイズに出す
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'war_chest' });   // 2026-08-25: 公式は**財宝**
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

console.log('=== ティアラ：相手の堀でも2回目のコインは取りこぼさない（財宝アタック＝遺物）===');
{
  let s = mk(['relic', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.turn.phase = 'buy'; s.players[0].hand = ['tiara', 'relic']; s.players[1].hand = ['moat'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'tiara' }); // +1購入、2回使う選択
  ok(s.pending && s.pending.type === 'tiara_play', 'ティアラ：2回使う選択');
  s = reduce(s, { type: 'TIARA_PLAY', card: 'relic' }); // 遺物を2回（相手は堀）
  // 2回目は state.replay に積まれ、1回目のリアクション窓が解決してから適用される（公式：1回目が
  // 完全に解決してから2回目を使う）。反応待ちの最中はまだ$3で、解決後に$6になる＝取りこぼさない。
  ok(s.turn.coins === 2 && s.pending && s.pending.type === 'relic', 'ティアラ：2回目は1回目のリアクション解決後（この時点では$2）');
  s = resolveAll(s);
  ok(s.turn.coins === 4, '遺物$2 ×2 ＝ +4コイン（堀でも2回目を取りこぼさない。実 ' + s.turn.coins + ')');
  ok(!s.pending, '解決後 pending なし');
}
console.log('=== ティアラ×遺物（3人）：1人が堀でも、堀でない相手はアタックを受ける ===');
{
  // 回帰：旧実装は「1回目がリアクション待ちなら2回目のアタックを丸ごと飛ばす」ため、
  //   堀を持たない相手が2回目のアタックを受けなかった（＋2回目のコインも消えていた）。
  let s = mk(['relic', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B', 'C']);
  s.turn.phase = 'buy'; s.players[0].hand = ['tiara', 'relic'];
  s.players[1].hand = ['moat', 'estate'];   // 席1＝堀持ち（免疫）
  s.players[2].hand = ['estate', 'estate']; // 席2＝リアクション無し
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'tiara' });
  s = reduce(s, { type: 'TIARA_PLAY', card: 'relic' });
  s = resolveAll(s);
  ok(s.turn.coins === 4, '3人でも +4コイン (実 ' + s.turn.coins + ')');
  ok(!s.players[1].minusCard, '堀持ちは -1カードトークンを受けない（2回とも免疫）');
  ok(s.players[2].minusCard === true, '堀無しはアタックを受ける（2回目も発動）');
}

console.log('=== 書記：手番開始時に手札から使える（アクション消費せず）===');
{
  let s = mk(['clerk', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.players[1].hand = ['clerk', 'copper', 'copper', 'copper', 'copper']; // 席1の手番開始時の手札に書記
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' }); // 席0終了→席1開始：resolveDurationStartEffects(1) で clerk_start
  ok(s.pending && s.pending.type === 'clerk_start' && s.pending.player === 1, '手番開始時に書記のリアクションが出る');
  const actBefore = s.turn.actions;
  s = reduce(s, { type: 'CLERK_START', play: true });
  ok(s.players[1].inPlay.includes('clerk') && s.turn.coins === 2, '書記を使った（+2コイン）');
  ok(s.turn.actions === actBefore, 'アクションを消費しない (実 ' + s.turn.actions + '/' + actBefore + ')');
  s = resolveAll(s);
}

console.log('=== ティアラ×遺物：2回使っても +コインを取りこぼさない（堀無し）===');
{
  let s = mk(['relic', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.turn.phase = 'buy'; s.players[0].hand = ['tiara', 'relic']; s.players[1].hand = ['estate', 'estate']; // 席1はリアクション無し
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'tiara' });
  s = reduce(s, { type: 'TIARA_PLAY', card: 'relic' });
  s = resolveAll(s);
  ok(s.turn.coins === 4, '遺物$2×2＝+4コイン (実 ' + s.turn.coins + ')');
  ok(s.players[1].minusCard === true, 'ティアラ×遺物：相手はアタックを受ける');
}

console.log('=== 書記：手番開始時に2枚とも使える（1枚目のアタックで選択が出ても2枚目が消えない）===');
{
  let s = mk(['clerk', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler', 'watchtower'], ['A', 'B']);
  s.players[1].hand = ['clerk', 'clerk', 'copper', 'copper', 'copper']; // 席1の手番開始手札に書記2枚
  // 席0は開始手札5枚（銅貨/屋敷・リアクション無し）＝書記のアタックで山札上置きの選択が出る
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' }); // →席1開始：clerk_start ×2 が startQueue に積まれる
  ok(s.pending && s.pending.type === 'clerk_start' && s.pending.player === 1, '1枚目の書記リアクションが出る');
  s = resolveAll(s); // CPUが1枚目(+アタック)→2枚目(+アタック)を順に解決
  ok(count(s.players[1].inPlay, 'clerk') === 2, '書記2枚とも場に出た（2枚目がstartQueueに取り残されない。実 ' + count(s.players[1].inPlay, 'clerk') + '枚）');
  ok(s.turn.coins === 4, '書記2枚ぶんの +4コイン（実 ' + s.turn.coins + '）');
}

console.log('=== 水晶球：山札上の山師を「使う」とアタックも発動する（特殊効果を取りこぼさない）===');
{
  let s = mk(['crystal_ball', 'charlatan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'kings_court', 'peddler'], ['A', 'B']);
  s.turn.phase = 'buy'; s.players[0].hand = ['crystal_ball']; s.players[0].deck = ['charlatan', 'copper', 'copper'];
  s.players[1].hand = ['estate', 'estate']; // リアクション無し
  const beforeC = count(s.players[1].discard, 'curse');
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crystal_ball' });
  ok(s.pending && s.pending.type === 'crystal_ball' && s.pending.card === 'charlatan', '水晶球：山札上（山師）を見る');
  s = reduce(s, { type: 'CRYSTAL_BALL', choice: 'play' });
  s = resolveAll(s);
  ok(s.players[0].inPlay.includes('charlatan'), '水晶球：山師を場に出して使った');
  ok(count(s.players[1].discard, 'curse') === beforeC + 1, '水晶球で使った山師のアタックで相手が呪いを獲得（実 +' + (count(s.players[1].discard, 'curse') - beforeC) + '）');
}

console.log('=== 「財宝を全部出す」：ティアラ/冠/偽造通貨（財宝を2回使う札）を最初に出す ===');
{
  // ティアラを後回しにすると手札に財宝が残らず「2回使う」が空振りするので、必ず先頭で出す。
  let s = mk(); s.turn.phase = 'buy';
  s.players[0].hand = ['copper', 'gold', 'tiara', 'silver'];
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(!!s.pending && s.pending.type === 'tiara_play', 'ティアラの選択が最初に開く（実 ' + (s.pending && s.pending.type) + '）');
  ok(s.players[0].inPlay.length === 1 && s.players[0].inPlay[0] === 'tiara', 'この時点で場はティアラだけ');
  ok(count(s.players[0].hand, 'gold') === 1, '金貨はまだ手札にある＝2回使う対象に選べる');
  // 中断した残りの財宝は、選択を解決したら自動で出し切る（ボタンを押し直させない）
  s = reduce(s, { type: 'TIARA_PLAY', card: 'gold' });
  ok(!s.pending, '選択の解決後に選択待ちが残らない');
  ok(s.players[0].hand.length === 0, '残りの財宝も自動で出し切る（実 手札' + s.players[0].hand.length + '枚）');
  ok(s.turn.coins === 9, 'コイン9＝ティアラ0＋金貨2回6＋銅貨1＋銀貨2（実 ' + s.turn.coins + '）');
  // 回帰：中断中に手札へ入ってきた財宝は自動再開で出さない（押した時点の残りだけを出し切る）
  //   ＝これを守らないと、獲得した銅貨が勝手に場に出て大市場が買えなくなる／資本主義でアタックが無断発動する。
  s = mk(); s.turn.phase = 'buy';
  s.players[0].hand = ['tiara', 'copper', 'silver'];
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(!!s.pending, '前提：ティアラで中断している');
  s.players[0].hand.push('gold'); // 中断中に獲得された財宝（収税吏/彫刻家などを模擬）
  s = reduce(s, { type: 'TIARA_PLAY', card: 'copper' });
  ok(!s.pending, '前提：解決して自動再開が走る');
  ok(s.players[0].hand.length === 1 && s.players[0].hand[0] === 'gold', '中断中に手札へ入った財宝は出さない（実 ' + JSON.stringify(s.players[0].hand) + '）');
  ok(!s.players[0].inPlay.includes('gold'), '金貨は場にも出ていない');
  ok(s.players[0].inPlay.includes('silver'), '押した時点で手札にあった残り（銀貨）は出し切る');
  // ティアラが無ければ従来どおり一度に全部出る
  s = mk(); s.turn.phase = 'buy'; s.players[0].hand = ['copper', 'gold', 'silver'];
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(!s.pending && s.turn.coins === 6, 'ティアラ無しは一度に全部出る（実 ' + s.turn.coins + '）');
  // 偽造通貨（暗黒時代）も同じ理由で最初に出す
  s = E.createInitialState(['A', 'B'], DOM.KINGDOM_DARKAGES, { startActive: 0 });
  s.turn.phase = 'buy'; s.players[0].hand = ['copper', 'counterfeit', 'gold'];
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(!!s.pending && String(s.pending.type).indexOf('counterfeit') === 0, '偽造通貨の選択が最初に開く（実 ' + (s.pending && s.pending.type) + '）');
  ok(s.players[0].hand.includes('gold'), '偽造通貨：金貨はまだ手札にある');
  // 冠（帝国）も購入フェイズでは「手札の財宝1枚を2回」＝最初に出す
  s = E.createInitialState(['A', 'B'], DOM.KINGDOM_EMPIRES, { startActive: 0 });
  s.turn.phase = 'buy'; s.players[0].hand = ['copper', 'crown', 'gold'];
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(!!s.pending, '冠の選択が最初に開く（実 ' + (s.pending && s.pending.type) + '）');
  ok(s.players[0].hand.includes('gold'), '冠：金貨はまだ手札にある');
  // ティアラ/冠/偽造通貨が同居する王国で CPU が止まらない
  let done = 0;
  const pool = ['tiara', 'counterfeit', 'crown', 'merchant', 'monument', 'city', 'peddler', 'vault', 'grand_market', 'bank'];
  for (let k = 0; k < 6; k++) {
    let g = E.createInitialState([{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'normal' }], pool, { startActive: 0 });
    let n = 0;
    while (!g.gameOver && n++ < 6000) g = reduce(g, CPU.decide(g));
    if (g.gameOver) done++;
  }
  ok(done === 6, 'ティアラ/冠/偽造通貨 同居の王国で 6戦とも終局（実 ' + done + '/6）');
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

// ==========================================================================
// §0-43 望楼＝相手の手番の獲得にも反応できる（公式FAQ＝ジャンク配りへの防御）
// ==========================================================================
{
  /* Official FAQ 逐語＝`You may reveal Watchtower whether you gained the card due to buying it,
     or gained it some other way, such as with Expand or Charlatan.`／2010年版FAQ＝
     `When you gain a card, even on someone elses turn, you may reveal Watchtower from your hand`。 */
  const KW = ['charlatan', 'watchtower', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'peddler', 'moat'];
  let s = mk(KW);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['charlatan']; s.players[1].hand = ['watchtower'];
  s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'charlatan' });
  ok(s.pending && s.pending.type === 'watchtower' && s.pending.player === 1, '望楼：相手の山師で得た呪いに反応できる');
  s = reduce(s, { type: 'WATCHTOWER', choice: 'trash' });
  ok((s.trash || []).indexOf('curse') >= 0, '望楼：呪いを廃棄できた');
  ok(s.players[1].discard.indexOf('curse') < 0, '望楼：呪いが捨て札に残っていない');
  ok(s.players[1].hand.indexOf('watchtower') >= 0, '望楼：公開しても手札に残る');

  let w = mk(['witch', 'watchtower', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'peddler', 'village']);
  w.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  w.players[0].hand = ['witch']; w.players[1].hand = ['watchtower'];
  w.turn.phase = 'action'; w.turn.actions = 1;
  w = reduce(w, { type: 'PLAY_ACTION', card: 'witch' });
  ok(w.pending && w.pending.type === 'watchtower' && w.pending.player === 1, '望楼：相手の魔女でも反応できる');

  let y = E.createInitialState(['A', 'B', 'C'], ['witch', 'watchtower', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'peddler', 'village'], { startActive: 0 });
  y.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  y.players[0].hand = ['witch']; y.players[1].hand = ['watchtower']; y.players[2].hand = ['watchtower'];
  y.turn.phase = 'action'; y.turn.actions = 1;
  y = reduce(y, { type: 'PLAY_ACTION', card: 'witch' });
  const seats = [];
  let gw = 0;
  while (y.pending && y.pending.type === 'watchtower' && gw++ < 5) { seats.push(y.pending.player); y = reduce(y, { type: 'WATCHTOWER', choice: 'trash' }); }
  ok(seats.length === 2 && seats.indexOf(1) >= 0 && seats.indexOf(2) >= 0, '望楼：3人戦で望楼を持つ2人とも窓が開く');

  let z = mk(KW);
  z.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  z.players[0].hand = ['watchtower'];
  z.turn.phase = 'buy'; z.turn.coins = 5; z.turn.buys = 1;
  z = reduce(z, { type: 'BUY', card: 'duchy' });
  ok(z.pending && z.pending.type === 'watchtower' && z.pending.player === 0, '望楼：自分の購入では即座に窓が開く（退行なし）');
}

{
  // 望楼：キュー消化時の再検査（望楼が手札から消えている／獲得した札が既に動かされている＝lose track）
  const KW2 = ['charlatan', 'watchtower', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'peddler', 'moat'];
  let q = mk(KW2);
  q.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  q.players[0].hand = []; q.players[1].hand = [];
  q.players[1].discard = ['curse'];
  q.onGainQueue = [{ type: 'watchtower', player: 1, card: 'curse', dest: 'discard' }];
  q.turn.phase = 'action'; q.turn.actions = 1;
  q = reduce(q, { type: 'END_ACTION_PHASE' });
  ok(!(q.pending && q.pending.type === 'watchtower'), '望楼：手札に望楼が無ければキュー消化で窓を開かない');
  let q2 = mk(KW2);
  q2.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  q2.players[1].hand = ['watchtower']; q2.players[1].discard = [];
  q2.onGainQueue = [{ type: 'watchtower', player: 1, card: 'curse', dest: 'discard' }];
  q2.turn.phase = 'action'; q2.turn.actions = 1;
  q2 = reduce(q2, { type: 'END_ACTION_PHASE' });
  ok(!(q2.pending && q2.pending.type === 'watchtower'), '望楼：獲得した札が既に動かされていたら窓を開かない');
}

// ==========================================================================
// §0-43 敵対レビュー②＝繁栄（保管庫/大衆の捨て札トリガー・行商人の「場」）
// ==========================================================================
{
  // 保管庫（自分）＝捨てたカードは本物の捨て札＝坑道が誘発する
  let s = mk(['vault', 'tunnel', 'monument', 'workers_village', 'city', 'bishop', 'peddler', 'grand_market', 'moat', 'village']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['vault', 'tunnel', 'estate'];
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'vault' });
  s = reduce(s, { type: 'VAULT_DISCARD', cards: ['tunnel'] });
  ok(s.players[0].discard.indexOf('gold') >= 0, '保管庫：自分の捨て札で坑道が誘発する（金貨を獲得）');

  // 保管庫（相手）＝手札1枚でも捨てられる（公式FAQ）。引けるのは2枚捨てたときだけ。
  let v = mk(['vault', 'tunnel', 'monument', 'workers_village', 'city', 'bishop', 'peddler', 'grand_market', 'moat', 'village']);
  v.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  v.players[0].hand = ['vault']; v.players[0].deck = ['copper', 'copper', 'copper'];
  v.players[1].hand = ['tunnel']; v.players[1].deck = ['silver', 'silver'];
  v.turn.actions = 1;
  v = reduce(v, { type: 'PLAY_ACTION', card: 'vault' });
  v = reduce(v, { type: 'VAULT_DISCARD', cards: [] });
  ok(v.pending && v.pending.type === 'vault' && v.pending.stage === 'other' && v.pending.player === 1, '保管庫：手札1枚の相手にも窓が開く');
  v = reduce(v, { type: 'VAULT_OTHER', cards: ['tunnel'] });
  ok(v.players[1].discard.indexOf('gold') >= 0, '保管庫：1枚だけ捨てられて坑道が誘発する');
  ok(v.players[1].hand.length === 0, '保管庫：1枚しか捨てていないのでカードは引けない（公式）');
}
{
  // 大衆＝山札から捨てさせたアクション/財宝も本物の捨て札（進路が誘発する）
  let s = mk(['rabble', 'trail', 'monument', 'workers_village', 'city', 'bishop', 'peddler', 'grand_market', 'moat', 'village']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['rabble']; s.players[0].deck = ['copper', 'copper', 'copper'];
  s.players[1].deck = ['trail', 'estate', 'estate', 'copper'];
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'rabble' });
  let g = 0;
  while (s.pending && g++ < 6) {
    if (s.pending.type === 'trail_react') { s = reduce(s, { type: 'TRAIL_REACT', play: true }); break; }
    s = reduce(s, { type: 'RABBLE_REACT' });
  }
  ok(s.players[1].inPlay.indexOf('trail') >= 0, '大衆：山札から捨てさせた進路が誘発する（捨て札トリガー）');
}
{
  // 行商人＝「場」＝inPlay＋durationCards（前ターンから残る持続アクションも数える）
  let s = mk(['peddler', 'caravan', 'monument', 'workers_village', 'city', 'bishop', 'vault', 'grand_market', 'moat', 'village']);
  s.players[0].inPlay = []; s.players[0].durationCards = ['caravan'];
  s.turn.phase = 'buy';
  ok(E.cardCost(s, 'peddler') === 6, '行商人：持続アクションが場にあれば $6（実際 $' + E.cardCost(s, 'peddler') + '）');
}

console.log('\n繁栄テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
process.exit(fail ? 1 : 0);
