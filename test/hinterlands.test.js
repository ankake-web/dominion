/* 異郷（Hinterlands）ゲームロジックの検証（Node 単体実行）
   使い方: node test/hinterlands.test.js
   対象: on-gain トリガー(埋蔵金/大使館/不正利得/遊牧民の野営地/官吏/国境の村/宿屋/スーク) /
         on-buy(値切り屋/農地/義賊) / on-discard(坑道/進路/織工) / on-trash(遊牧民) /
         可変VP(シルクロード) / コスト軽減(街道) / 愚者の黄金(価値/属州リアクション) / 交易人(獲得置換) /
         アタック(辺境伯/神託/義賊/狂戦士/魔女の小屋/大釜) / 番犬リアクション / 画策(片付け) /
         岐路/開発/よろずや/香辛料商人/地図職人/公爵夫人/車大工/CPU通し・保存則 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
let seed = 20260705;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
load('js/cards.js');
load('js/engine.js');
load('js/cpu.js');
const DOM = sandbox.window.DOM;
const E = DOM.engine;
const CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
// §0-43：坑道／進路／織工は公式どおり「してもよい」の窓になった（onGainQueue → pending）。
//   既存テストは自動発動を前提に書かれていたので、窓を「はい」で消化するヘルパを通す。
function settle(s) {
  let g = 0;
  while (s && s.pending && g++ < 20) {
    const ty = s.pending.type;
    if (ty === 'tunnel_react') s = E.reduce(s, { type: 'TUNNEL_REACT', reveal: true });
    else if (ty === 'trail_react') s = E.reduce(s, { type: 'TRAIL_REACT', play: true });
    else if (ty === 'weaver_react') s = E.reduce(s, { type: 'WEAVER_REACT', play: true });
    else break;
  }
  return s;
}
function count(arr, id) { return arr.filter((c) => c === id).length; }
const reduce = (s, a) => E.reduce(s, a);
const HK = DOM.POOLS.hinterlands.slice();
function mkK(kingdom, players, startActive) {
  return E.createInitialState(players || ['A', 'B'], kingdom, { startActive: startActive == null ? 0 : startActive });
}
// 直接盤面をセットして手番0のアクションフェイズから始める
function setup(kingdom, hand, deck, opts) {
  const s = mkK(kingdom, ['A', 'B'], 0);
  s.players[0].hand = hand.slice();
  s.players[0].deck = (deck || []).slice();
  s.players[0].discard = (opts && opts.discard) ? opts.discard.slice() : [];
  if (opts && opts.p1hand) s.players[1].hand = opts.p1hand.slice();
  if (opts && opts.p1deck) s.players[1].deck = opts.p1deck.slice();
  if (opts && opts.p1discard) s.players[1].discard = opts.p1discard.slice();
  return s;
}
function playAct(s, card) { return reduce(s, { type: 'PLAY_ACTION', card }); }
function autoResolve(s, max) { let g = 0; while (s.pending && g++ < (max || 80)) s = reduce(s, CPU.decide(s)); return s; }

/* ============ CARD_SET 昇格 ============ */
console.log('=== 異郷: CARD_SET 昇格 ===');
{
  ok(DOM.CARD_SETS.some((x) => x.id === 'hinterlands' && x.kingdom.length === 10), 'hinterlands 固定セットが10種で存在');
  ok(DOM.CARD_SETS.some((x) => x.id === 'random-hinterlands' && (x.randomFrom || []).indexOf('hinterlands') >= 0), 'random-hinterlands が存在');
  ok(DOM.KINGDOM_HINTERLANDS.every((id) => DOM.POOLS.hinterlands.includes(id)) && DOM.KINGDOM_HINTERLANDS.length === 10, '固定10種は全て異郷プール内');
  ok(HK.length === 35, '異郷プールは35種');
}

/* ============ 可変VP：シルクロード ============ */
console.log('=== シルクロード: 勝利点カード4枚毎に1点 ===');
{
  const s = mkK(['silk_road', 'oasis']);
  const p = s.players[0];
  p.deck = []; p.hand = []; p.discard = []; p.inPlay = [];
  p.deck = ['silk_road', 'silk_road', 'estate', 'estate', 'duchy', 'province', 'copper', 'copper'];
  // 勝利点カード = silk_road×2, estate×2, duchy, province = 6枚 → 6/4 = 1 → シルクロード1枚につき1点 ×2枚 = 2点
  // 固定: estate2×1 + duchy3 + province6 = 11、シルクロードの変動 = 2 → 合計 13
  ok(E.vpOf(p) === 13, 'シルクロードの可変VP = 2（勝利点6枚/4=1、×2枚）→合計13');
}

/* ============ コスト軽減：街道 ============ */
console.log('=== 街道: 場にある間 全カード -1コスト ===');
{
  let s = setup(['highway', 'oasis'], ['highway', 'copper', 'copper', 'copper', 'estate']);
  s = playAct(s, 'highway'); // +1カード +1アクション、場に highway
  ok(E.cardCost(s, 'province') === 7, '街道1枚で属州が$7');
  ok(E.cardCost(s, 'copper') === 0, '街道でも銅貨は$0未満にならない');
  ok(E.cardCost(s, 'oasis') === 2, 'オアシス($3)が街道で$2');
}

/* ============ 坑道: クリンナップ以外で捨てたとき金貨 ============ */
console.log('=== 坑道: 捨てたとき公開して金貨獲得（オアシスで捨てる）===');
{
  let s = setup(['oasis', 'tunnel'], ['oasis', 'tunnel', 'copper', 'copper', 'copper']);
  s = playAct(s, 'oasis'); // +1カード+1アクション+1コイン、手札1枚捨てる pending
  ok(s.pending && s.pending.type === 'oasis', 'オアシスの捨て札 pending');
  s = reduce(s, { type: 'OASIS_RESOLVE', card: 'tunnel' }); // 坑道を捨てる
  s = settle(s);
  ok(count(s.players[0].discard, 'gold') === 1, '坑道を捨てて金貨1枚を獲得');
  ok(count(s.players[0].discard, 'tunnel') === 1, '坑道本体は捨て札に');
}

/* ============ 愚者の黄金: 1枚目$1・2枚目$4／属州リアクション ============ */
console.log('=== 愚者の黄金: プレイ価値と属州リアクション ===');
{
  let s = setup(['fools_gold', 'oasis'], ['fools_gold', 'fools_gold']);
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'fools_gold' });
  ok(s.turn.coins === 1, '1枚目の愚者の黄金は$1');
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'fools_gold' });
  ok(s.turn.coins === 5, '2枚目の愚者の黄金は$4（合計$5）');
  // 属州リアクション：相手(0)の手番で 1 が愚者の黄金を持ち、0 が属州を獲得
  let s2 = mkK(['fools_gold', 'oasis']);
  s2.players[1].hand = ['fools_gold', 'copper'];
  s2.turn.phase = 'buy'; s2.turn.coins = 8; s2.turn.buys = 1;
  s2 = reduce(s2, { type: 'BUY', card: 'province' });
  ok(s2.pending && s2.pending.type === 'fools_gold_react' && s2.pending.player === 1, '相手が属州獲得→愚者の黄金リアクション窓');
  s2 = reduce(s2, { type: 'FOOLS_GOLD_REACT', trash: true });
  ok(count(s2.players[1].deck, 'gold') === 1 && count(s2.trash, 'fools_gold') === 1, '愚者の黄金を廃棄し金貨を山札の上に獲得');
}

/* ============ on-gain 自動効果 ============ */
console.log('=== on-gain: 埋蔵金/大使館/不正利得/遊牧民の野営地/官吏 ===');
{
  // 埋蔵金：獲得で銅貨2枚
  let s = mkK(['cache', 'oasis']); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'cache' });
  ok(count(s.players[0].discard, 'copper') === 2 && count(s.players[0].discard, 'cache') === 1, '埋蔵金獲得で銅貨2枚');
  // 大使館：獲得で他プレイヤーが銀貨
  let s2 = mkK(['embassy', 'oasis']); s2.turn.phase = 'buy'; s2.turn.coins = 5; s2.turn.buys = 1;
  s2 = reduce(s2, { type: 'BUY', card: 'embassy' });
  ok(count(s2.players[1].discard, 'silver') === 1, '大使館獲得で相手が銀貨1枚');
  // 不正利得：獲得で他プレイヤーが呪い（堀で防げない）
  let s3 = mkK(['ill_gotten_gains', 'oasis']); s3.turn.phase = 'buy'; s3.turn.coins = 5; s3.turn.buys = 1;
  s3 = reduce(s3, { type: 'BUY', card: 'ill_gotten_gains' });
  ok(count(s3.players[1].discard, 'curse') === 1, '不正利得獲得で相手が呪い1枚');
  // 遊牧民の野営地：獲得で山札の上
  let s4 = mkK(['nomad_camp', 'oasis']); s4.turn.phase = 'buy'; s4.turn.coins = 4; s4.turn.buys = 1;
  s4 = reduce(s4, { type: 'BUY', card: 'nomad_camp' });
  ok(s4.players[0].deck[0] === 'nomad_camp', '遊牧民の野営地は獲得で山札の上');
  // 官吏：獲得で場の財宝を山札の上（購入時は場に出た財宝で払う→場の財宝が上へ）
  let s5 = setup(['mandarin', 'oasis'], ['gold', 'gold', 'gold']); s5.turn.phase = 'buy';
  s5 = reduce(s5, { type: 'PLAY_ALL_TREASURES' }); // 金貨3枚を場に
  s5 = reduce(s5, { type: 'BUY', card: 'mandarin' });
  ok(count(s5.players[0].deck.slice(0, 3), 'gold') === 3, '官吏獲得で場の財宝(金貨3)が山札の上');
}

/* ============ 遊牧民: 獲得/廃棄で+2コイン ============ */
console.log('=== 遊牧民: 獲得・廃棄で +2コイン ===');
{
  let s = mkK(['nomads', 'develop']); s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'nomads' });
  ok(s.turn.coins === 2, '遊牧民を購入($4)→残0＋獲得で+2コイン=2'); // 4-4=0, +2 =2
  // 廃棄で+2（開発で遊牧民を廃棄）
  let s2 = setup(['nomads', 'develop'], ['develop', 'nomads', 'copper']);
  s2 = playAct(s2, 'develop');
  s2 = reduce(s2, { type: 'DEVELOP_TRASH', card: 'nomads' });
  ok(s2.turn.coins === 2, '遊牧民を廃棄で+2コイン');
}

/* ============ 開発: ちょうど+1/-1コストを山札の上へ ============ */
console.log('=== 開発: 廃棄→+1/-1コストを獲得 ===');
{
  let s = setup(['develop', 'oasis', 'margrave'], ['develop', 'oasis', 'copper']); // oasis=$3を廃棄→$4と$2
  s = playAct(s, 'develop');
  s = reduce(s, { type: 'DEVELOP_TRASH', card: 'oasis' }); // $3廃棄 → +1=$4, -1=$2
  ok(s.pending && s.pending.type === 'develop' && s.pending.stage === 'gain', '開発の獲得 pending');
  // $4 か $2 を選んで獲得（供給にある silver=$3 は対象外）。develop=$3, oasis=$3。$4=なし(margrave=$5)。$2=develop... develop=$3。
  // このキングダムで $4=なし, $2=なし の可能性。robustに autoResolve で完走することだけ確認。
  s = autoResolve(s);
  ok(!s.pending, '開発が完走（獲得先が無くても停止）');
}

/* ============ 国境の村: 獲得で安いカード ============ */
console.log('=== 国境の村: 獲得で それより安いカードを獲得 ===');
{
  let s = mkK(['border_village', 'margrave', 'oasis']); s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'border_village' }); // $6 → <$6 を獲得
  ok(s.pending && s.pending.type === 'border_village', '国境の村の獲得 pending');
  s = reduce(s, { type: 'BORDER_VILLAGE_GAIN', card: 'margrave' }); // $5
  ok(count(s.players[0].discard, 'margrave') === 1, '国境の村で$5のカードを獲得');
}

/* ============ 香辛料商人: 財宝廃棄→モード選択 ============ */
console.log('=== 香辛料商人: 財宝を廃棄→+2カード+1アクション or +2コイン+1購入 ===');
{
  let s = setup(['spice_merchant', 'oasis'], ['spice_merchant', 'copper', 'silver', 'estate', 'estate'], ['copper', 'copper', 'copper']);
  s = playAct(s, 'spice_merchant');
  s = reduce(s, { type: 'SPICE_MERCHANT_TRASH', card: 'copper' });
  ok(s.pending && s.pending.stage === 'choose', 'モード選択 pending');
  const before = s.players[0].hand.length;
  s = reduce(s, { type: 'SPICE_MERCHANT_CHOOSE', choice: 'cards' });
  ok(s.players[0].hand.length === before + 2 && s.turn.actions === 1, '+2カード +1アクション');
}

/* ============ 交易人: 廃棄→銀貨／獲得置換リアクション ============ */
console.log('=== 交易人: コストぶん銀貨／獲得を銀貨に置換 ===');
{
  let s = setup(['trader', 'oasis'], ['trader', 'estate', 'copper']);
  s = playAct(s, 'trader');
  s = reduce(s, { type: 'TRADER_TRASH', card: 'estate' }); // estate=$2 → 銀貨2枚
  ok(count(s.players[0].discard, 'silver') === 2 && count(s.trash, 'estate') === 1, '交易人：$2廃棄→銀貨2枚');
  // 獲得置換：手札に交易人を持ち、（他の獲得時対話を持たない）カードを獲得→銀貨に置換
  //   ※国境の村/宿屋等は自身の獲得時効果が優先されるため、置換対象は対話を持たない札（辺境伯）で検証。
  let s2 = setup(['trader', 'margrave'], ['trader']); s2.turn.phase = 'buy'; s2.turn.coins = 5; s2.turn.buys = 1;
  s2 = reduce(s2, { type: 'BUY', card: 'margrave' }); // 獲得→trader反応窓
  ok(s2.pending && s2.pending.type === 'trader_react', '交易人の獲得置換リアクション窓');
  s2 = reduce(s2, { type: 'TRADER_REACT', reveal: true });
  ok(count(s2.players[0].discard, 'silver') === 1 && count(s2.players[0].discard, 'margrave') === 0, '辺境伯の代わりに銀貨を獲得（本体はサプライへ戻る）');
  ok(s2.supply.margrave === 10, 'サプライの辺境伯が戻る（10）');
}

/* ============ アタック: 辺境伯（+1カード→手札3枚まで捨て）============ */
console.log('=== 辺境伯: 各相手 +1カード→手札3枚まで捨て ===');
{
  let s = setup(['margrave', 'oasis'], ['margrave', 'copper', 'copper'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s.players[1].hand = ['copper', 'copper', 'copper', 'estate']; // 4枚
  s = playAct(s, 'margrave');
  ok(s.turn.buys === 2 && s.players[0].hand.length === 2 + 3, '辺境伯 +3カード +1購入');
  ok(s.pending && s.pending.type === 'margrave' && s.pending.player === 1, '相手の捨て pending（+1カード後 手札5枚→3枚へ）');
  s = autoResolve(s);
  ok(s.players[1].hand.length === 3 && !s.pending, '相手は手札3枚まで捨てた');
}

/* ============ アタック: 神託（各自の上2枚を使用者が捨て/戻す→+2カード）============ */
console.log('=== 神託: 各自の上2枚を操作→使用者+2カード ===');
{
  let s = setup(['oracle', 'oasis'], ['oracle', 'copper'], ['estate', 'estate', 'gold', 'gold']);
  s.players[1].deck = ['curse', 'curse', 'copper'];
  const h0 = s.players[0].hand.length;
  s = playAct(s, 'oracle');
  s = autoResolve(s); // 使用者=CPUが各自の上2枚を処理、最後に+2カード
  ok(!s.pending, '神託が完走');
  ok(s.players[0].hand.length >= h0 - 1 + 2, '使用者は最後に+2カード（自分の上2枚の処理後）');
}

/* ============ アタック: 義賊（相手の銀/金を奪う）============ */
console.log('=== 義賊: 相手の上2枚から銀/金を奪う・財宝なしは銅貨 ===');
{
  let s = setup(['noble_brigand', 'oasis'], ['noble_brigand', 'copper']);
  s.players[1].deck = ['gold', 'estate', 'copper'];
  s = playAct(s, 'noble_brigand'); // +1コイン＋アタック（gold1枚→使用者が奪う）
  s = autoResolve(s);
  ok(s.turn.coins === 1, '義賊 +1コイン');
  ok(count(s.players[0].discard, 'gold') === 1, '相手の金貨を廃棄して使用者が獲得');
  // 財宝を公開しなかった相手は銅貨
  let s2 = setup(['noble_brigand', 'oasis'], ['noble_brigand', 'copper']);
  s2.players[1].deck = ['estate', 'estate', 'copper'];
  s2 = playAct(s2, 'noble_brigand'); s2 = autoResolve(s2);
  ok(count(s2.players[1].discard, 'copper') >= 1, '財宝なしの相手は銅貨を獲得');
}

/* ============ アタック: 狂戦士（格下げ獲得＋相手手札削り／獲得時プレイ）============ */
console.log('=== 狂戦士: プレイ時 格下げ獲得＋手札3枚まで捨て／獲得時に場にアクションあれば使う ===');
{
  let s = setup(['berserker', 'oasis', 'margrave'], ['berserker', 'copper']);
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'estate'];
  s = playAct(s, 'berserker'); // <$5 を獲得→相手手札3枚まで
  s = autoResolve(s);
  ok(s.players[1].hand.length === 3 && !s.pending, '狂戦士：相手は手札3枚まで捨て、完走');
  // 獲得時プレイ：場にアクションがある状態で狂戦士を獲得すると使う
  let s2 = setup(['berserker', 'oasis'], ['oasis', 'copper']);
  s2 = playAct(s2, 'oasis'); // 場に oasis（アクション）
  s2 = autoResolve(s2);
  s2.turn.phase = 'buy'; s2.turn.coins = 5; s2.turn.buys = 1;
  s2 = reduce(s2, { type: 'BUY', card: 'berserker' });
  s2 = autoResolve(s2);
  ok(count(s2.players[0].inPlay, 'berserker') === 1, '獲得した狂戦士が場で使われた（獲得時プレイ）');
}

/* ============ アタック: 魔女の小屋（両方アクション捨てで呪い）============ */
console.log('=== 魔女の小屋: +4カード→2枚公開捨て、両方アクションなら相手に呪い ===');
{
  let s = setup(['witchs_hut', 'oasis', 'margrave'], ['witchs_hut'], ['oasis', 'margrave', 'copper', 'copper', 'estate']);
  s = playAct(s, 'witchs_hut'); // +4カード → 手札に oasis, margrave, copper, copper
  ok(s.pending && s.pending.type === 'witchs_hut' && s.pending.stage === 'discard', '2枚捨て pending');
  s = reduce(s, { type: 'WITCHS_HUT_DISCARD', cards: ['oasis', 'margrave'] }); // 両方アクション
  s = autoResolve(s);
  ok(count(s.players[1].discard, 'curse') === 1, '両方アクション→相手に呪い1枚');
}

/* ============ アタック: 大釜（3回目のアクション獲得で呪い）============ */
console.log('=== 大釜: このターン3回目のアクション獲得で相手に呪い ===');
{
  let s = setup(['cauldron', 'oasis'], ['cauldron']);
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'cauldron' }); // 場に大釜
  s.turn.coins = 20; s.turn.buys = 5;
  s = reduce(s, { type: 'BUY', card: 'oasis' }); // 1回目
  s = reduce(s, { type: 'BUY', card: 'oasis' }); // 2回目
  ok(count(s.players[1].discard, 'curse') === 0, '2回目までは呪いなし');
  s = reduce(s, { type: 'BUY', card: 'oasis' }); // 3回目 → 呪い配布
  s = autoResolve(s);
  ok(count(s.players[1].discard, 'curse') === 1, '3回目のアクション獲得で相手に呪い');
}

/* ============ 番犬: アタックへのリアクション ============ */
console.log('=== 番犬: 相手のアタック時に先に使う（+2〜4カード）===');
{
  let s = setup(['margrave', 'guard_dog', 'oasis'], ['margrave', 'copper']);
  s.players[1].hand = ['guard_dog', 'copper', 'copper', 'estate'];
  s.players[1].deck = ['copper', 'copper', 'copper', 'copper'];
  s = playAct(s, 'margrave'); // 相手はまず番犬の反応窓（hasReaction）
  ok(s.pending && s.pending.player === 1, '相手の反応窓');
  const beforeHand = s.players[1].hand.length;
  s = reduce(s, { type: 'GUARD_DOG_REACT' }); // 番犬を先に使う
  ok(count(s.players[1].inPlay, 'guard_dog') === 1 && s.players[1].hand.length > beforeHand - 1, '番犬をプレイして手札が増えた');
  s = autoResolve(s);
  ok(!s.pending, '番犬後もアタックが完走');
}

/* ============ 値切り屋: 購入毎に格下げ獲得 ============ */
console.log('=== 値切り屋: **このターン**、購入したカードのコスト未満の非勝利点を獲得（2022エラッタ）===');
{
  let s = setup(['haggler', 'oasis', 'margrave'], ['haggler']);
  s = playAct(s, 'haggler'); // +2コイン、場に値切り屋
  s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 2;
  s = reduce(s, { type: 'BUY', card: 'province' }); // $8購入→<$8の非勝利点を獲得
  ok(s.pending && s.pending.type === 'haggler', '値切り屋の獲得 pending');
  s = reduce(s, { type: 'HAGGLER_GAIN', card: 'margrave' }); // $5
  ok(count(s.players[0].discard, 'margrave') === 1, '値切り屋で$5の非勝利点を獲得');
}

/* ============ 農地: 購入時 廃棄→ちょうど+2コスト獲得 ============ */
console.log('=== 農地: 購入時 手札1枚廃棄→ちょうど$2高いカード獲得 ===');
{
  let s = setup(['farmland', 'margrave', 'oasis'], ['copper']); // 手札に copper($0)→廃棄で$2獲得可
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'farmland' });
  ok(s.pending && s.pending.type === 'farmland' && s.pending.stage === 'trash', '農地の廃棄 pending');
  s = reduce(s, { type: 'FARMLAND_TRASH', card: 'copper' }); // $0廃棄→$2獲得
  ok(s.pending && s.pending.stage === 'gain' && s.pending.exactCost === 2, 'ちょうど$2の獲得へ');
  s = reduce(s, { type: 'FARMLAND_GAIN', card: 'oasis' }); // oasis=$3? oasis=$3 なので不適。estate=$2
  s = autoResolve(s);
  ok(!s.pending, '農地が完走');
}

/* ============ 岐路: 手札の勝利点数だけ+カード、初回+3アクション ============ */
console.log('=== 岐路: 勝利点1枚につき+1カード、このターン初回なら+3アクション ===');
{
  let s = setup(['crossroads', 'oasis'], ['crossroads', 'estate', 'estate', 'copper'], ['copper', 'silver', 'gold']);
  s = playAct(s, 'crossroads');
  ok(s.players[0].hand.length === 3 + 2 && s.turn.actions === 3, '勝利点2枚→+2カード、初回+3アクション（残3）');
  // 2枚目の岐路は +アクションなし
  let s2 = setup(['crossroads', 'oasis'], ['crossroads', 'crossroads', 'estate'], ['copper', 'copper', 'copper', 'copper']);
  s2 = playAct(s2, 'crossroads'); // 初回：estate1枚→+1カード, +3アクション
  s2 = playAct(s2, 'crossroads'); // 2回目：+アクションなし
  ok(s2.turn.crossroadsPlayed === 2, '岐路2回プレイを記録');
}

/* ============ 公爵夫人: 各自の上を捨て可／公領獲得で公爵夫人 ============ */
console.log('=== 公爵夫人: +2コイン＋各自山札の上を捨て可／公領獲得で公爵夫人獲得可 ===');
{
  let s = setup(['duchess', 'oasis'], ['duchess', 'copper']);
  s = playAct(s, 'duchess');
  ok(s.turn.coins === 2, '公爵夫人 +2コイン');
  s = autoResolve(s);
  ok(!s.pending, '各自の「上を捨て」窓が完走');
  // 公領獲得→公爵夫人獲得可
  let s2 = mkK(['duchess', 'oasis']); s2.turn.phase = 'buy'; s2.turn.coins = 5; s2.turn.buys = 1;
  s2 = reduce(s2, { type: 'BUY', card: 'duchy' });
  ok(s2.pending && s2.pending.type === 'duchess_gain', '公領獲得で公爵夫人の獲得 pending');
  s2 = reduce(s2, { type: 'DUCHESS_GAIN', gain: true });
  ok(count(s2.players[0].discard, 'duchess') === 1, '公爵夫人を獲得');
}

/* ============ スーク: +7コイン-手札／獲得時 最大2枚廃棄 ============ */
console.log('=== スーク: +1購入+7コイン-手札枚数／獲得時 手札最大2枚廃棄 ===');
{
  let s = setup(['souk', 'oasis'], ['souk', 'copper', 'copper', 'estate']); // 手札 souk除き3枚
  s = playAct(s, 'souk');
  ok(s.turn.buys === 2 && s.turn.coins === Math.max(0, 7 - 3), 'スーク +1購入 +（7-手札3）コイン'); // 7-3=4
  // 獲得時 廃棄
  let s2 = setup(['souk', 'oasis'], ['copper', 'estate', 'curse']); s2.turn.phase = 'buy'; s2.turn.coins = 5; s2.turn.buys = 1;
  s2 = reduce(s2, { type: 'BUY', card: 'souk' });
  ok(s2.pending && s2.pending.type === 'souk_trash', 'スーク獲得で廃棄 pending');
  s2 = reduce(s2, { type: 'SOUK_TRASH', cards: ['curse', 'estate'] });
  ok(count(s2.trash, 'curse') === 1 && count(s2.trash, 'estate') === 1, '手札から最大2枚を廃棄');
}

/* ============ 車大工: 捨てて格下げアクション獲得 ============ */
console.log('=== 車大工: +1カード+1アクション、捨てて そのコスト以下のアクションを獲得 ===');
{
  let s = setup(['wheelwright', 'oasis', 'margrave'], ['wheelwright', 'estate', 'copper'], ['copper', 'copper']);
  s = playAct(s, 'wheelwright'); // +1c+1a
  ok(s.pending && s.pending.type === 'wheelwright' && s.pending.stage === 'discard', '捨て pending');
  s = reduce(s, { type: 'WHEELWRIGHT_DISCARD', card: 'copper' }); // $0→≤$0 のアクション... 無いかも
  s = autoResolve(s);
  ok(!s.pending, '車大工が完走');
}

/* ============ 画策: 片付けで場のアクションを山札の上へ ============ */
console.log('=== 画策: このターンのクリンナップ時 場のアクションを山札の上へ ===');
{
  let s = setup(['scheme', 'margrave', 'oasis'], ['scheme', 'margrave', 'copper', 'copper', 'copper']);
  s = playAct(s, 'scheme'); // +1c+1a、schemes=1
  s = playAct(s, 'margrave'); // 場に margrave（アタックは相手手札次第）
  s = autoResolve(s);
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' }); // 画策で場のアクションを山札の上へ pending
  ok(s.pending && s.pending.type === 'scheme_cleanup', '画策の片付け pending');
  s = reduce(s, { type: 'SCHEME_CLEANUP', cards: ['margrave'] });
  // 山札の上に置いた辺境伯は、片付け後の次の手札ドローで引かれる（＝次ターンに使える）。
  ok(count(s.players[0].hand, 'margrave') === 1, '辺境伯を山札の上に置き、次の手札に引かれた');
}

/* ============ よろずや: 銀貨獲得＋上を捨て可＋5枚まで＋非財宝廃棄可 ============ */
console.log('=== よろずや: 銀貨→上を捨て→5枚まで→非財宝1枚廃棄 ===');
{
  let s = setup(['jack_of_all_trades', 'oasis'], ['jack_of_all_trades'], ['curse', 'copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'jack_of_all_trades');
  ok(count(s.players[0].discard, 'silver') === 1 || count(s.players[0].deck, 'silver') === 1 || count(s.players[0].hand, 'silver') === 1, '銀貨を獲得');
  s = autoResolve(s);
  ok(!s.pending, 'よろずやが完走');
  ok(s.players[0].hand.length >= 4, '手札5枚まで引いた（初手のジャック除き）');
}

/* ============ 宿屋: 獲得時 捨て札のアクションを山札に混ぜる ============ */
console.log('=== 宿屋: 獲得時 捨て札のアクションを山札に混ぜてシャッフル ===');
{
  let s = mkK(['inn', 'margrave', 'oasis']); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s.players[0].discard = ['margrave', 'oasis', 'copper'];
  s = reduce(s, { type: 'BUY', card: 'inn' });
  ok(s.pending && s.pending.type === 'inn_gain', '宿屋獲得のシャッフル pending');
  s = reduce(s, { type: 'INN_GAIN', cards: ['margrave', 'oasis'] });
  ok(count(s.players[0].discard, 'margrave') === 0 && count(s.players[0].deck, 'margrave') === 1, '捨て札のアクションが山札へ');
}

/* ============ 地図職人: 上4枚を捨て/戻す ============ */
console.log('=== 地図職人: +1c+1a、上4枚を捨て/山札の上へ ===');
{
  // +1カードで先頭(curse)を引く → 上4枚 = gold,estate,silver,copper が公開対象。
  let s = setup(['cartographer', 'oasis'], ['cartographer'], ['curse', 'gold', 'estate', 'silver', 'copper']);
  s = playAct(s, 'cartographer');
  ok(s.pending && s.pending.type === 'cartographer', '地図職人 pending');
  ok(count(s.players[0].hand, 'curse') === 1, '+1カードで先頭のcurseを引いた');
  s = reduce(s, { type: 'CARTOGRAPHER_RESOLVE', discard: ['estate'], top: ['gold', 'silver', 'copper'] });
  ok(count(s.players[0].discard, 'estate') === 1 && s.players[0].deck[0] === 'gold', '不要札を捨て、良い札を山札の上へ');
}

/* ============ 回帰: 神託の自分対象で坑道捨て→交易人で攻撃キューが潰れない ============ */
console.log('=== 回帰: 神託 自分対象＋坑道＋交易人（攻撃キュー保護）===');
{
  // p0 の山札上2枚に tunnel。手札に trader。oracle をプレイ→自分対象で tunnel を捨てる→金貨獲得。
  // 修正前は tunnel の金貨獲得で trader_react が立ち、残りの被害者＋使用者の+2カードが消えていた。
  let s = setup(['oracle', 'tunnel', 'trader'], ['oracle', 'trader'], ['tunnel', 'estate', 'copper', 'copper', 'copper', 'copper']);
  s.players[1].deck = ['copper', 'copper', 'copper'];
  s = playAct(s, 'oracle');
  ok(s.pending && s.pending.type === 'oracle' && s.pending.stage === 'decide' && s.pending.victim === 0, '神託：まず自分の上2枚を決定');
  s = reduce(s, { type: 'ORACLE_DECIDE', discard: true }); // tunnel+estate を捨てる
  /* §0-43：坑道の窓は onGainQueue に積まれ、**攻撃が全部片付いてから**開く（＝攻撃キューを壊さない）。
     ここで pending が神託のままであること自体がその保証。 */
  ok(s.pending == null || s.pending.type === 'oracle', '獲得置換(trader_react)は立たず 神託が継続する');
  ok(s.players[0].hand.includes('trader'), '交易人は手札に残る（抑止された）');
  s = autoResolve(s);
  s = settle(s);
  ok(count(s.players[0].discard, 'gold') === 1, '坑道で金貨を獲得（攻撃の解決後に窓が開く）');
  ok(!s.pending, '神託が完走（攻撃キューが潰れない）');
}

/* ============ 回帰: 値切り屋 呪いしか獲得先が無くてもCPUが完走 ============ */
console.log('=== 回帰: 値切り屋 呪いのみの獲得局面でCPUがループしない ===');
{
  let s = mkK(['haggler', 'margrave', 'oasis']);
  s.turn.phase = 'buy';
  s.turn.hagglerPlays = 1;   // 2022エラッタ＝「このターン」型（場の枚数ではなく使用回数）
  s.supply.copper = 0; // 銅貨枯渇＝コスト1以下の非勝利点は呪いだけ
  s.turn.coins = 2; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'estate' }); // maxCost=1 → 値切り屋の獲得 pending
  ok(s.pending && s.pending.type === 'haggler', '値切り屋の獲得 pending（呪いのみ）');
  let g = 0; while (s.pending && g++ < 30) s = reduce(s, CPU.decide(s));
  ok(!s.pending && g < 30, '値切り屋：呪いしか無くてもCPUが完走（無限ループしない）');
}

/* ============ CPU 通し＋保存則 ============ */
console.log('=== 異郷: CPU通し（stuck/例外なし・保存則）===');
{
  const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat'];
  function tally(s) { const t = {}; const add = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; }; Object.keys(s.supply).forEach((id) => { for (let i = 0; i < s.supply[id]; i++) add(id); }); (s.trash || []).forEach(add); s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(add))); if (s.turn) { (s.turn.possessionGains || []).forEach(add); (s.turn.possessionTrash || []).forEach(add); } return t; }
  function diff(a, b) { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); const d = []; ks.forEach((k) => { if ((a[k] || 0) !== (b[k] || 0)) d.push(k); }); return d; }
  let allOk = true, finished = 0, N = 24;
  for (let g = 0; g < N; g++) {
    seed = 700 + g * 11;
    const kingdom = DOM.kingdomForSet(g % 2 ? 'random-hinterlands' : 'hinterlands');
    const np = 2 + (g % 3);
    let s = mkK(kingdom, Array.from({ length: np }, (_, i) => ({ name: 'C' + i, isCpu: true, level: ['hard', 'normal', 'easy'][i % 3] })), 0);
    const init = tally(s);
    let step = 0;
    while (!s.gameOver && step++ < 12000) {
      s = reduce(s, CPU.decide(s));
      if (!s.pending) { const d = diff(init, tally(s)); if (d.length) { allOk = false; console.log('  保存則違反 g' + g + ': ' + d.join(',')); break; } }
    }
    if (s.gameOver) finished++;
    else { allOk = false; console.log('  未終局 g' + g + ' step=' + step); }
  }
  ok(allOk && finished === N, '異郷CPU ' + N + '戦 すべて保存則を満たし終局（finished=' + finished + '）');
}

console.log('\n========================================');
/* === 坑道(Tunnel)の捨て札トリガーは「手札を捨てさせる」全経路で誘発する ===
   ⚠ 以前は 民兵(MILITIA_RESOLVE)／軍団兵ほか(DISCARD_DOWN_RESOLVE)／公共広場(FORUM_DISCARD) が
      `triggerOnDiscard` を呼んでおらず、坑道を捨てても金貨が出なかった（辺境伯だけ呼んでいた＝非対称）。
      **出荷済みの `promo-pack` は民兵と闇市場を両方含み、闇市場デッキに坑道が入る＝今日到達できた。** */
{
  let s = E.createInitialState(['A', 'B'],
    ['militia', 'tunnel', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['militia']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s.players[1].hand = ['tunnel', 'copper', 'copper', 'copper', 'estate'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
  s = E.reduce(s, { type: 'MILITIA_RESOLVE', cards: ['tunnel', 'copper'] });
  s = settle(s);
  ok(s.players[1].discard.filter((c) => c === 'gold').length === 1,
    '民兵で坑道を捨てさせたら被害者は金貨を獲得する');
}
{
  let s = E.createInitialState(['A', 'B'],
    ['forum', 'tunnel', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['forum', 'tunnel', 'copper'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'forum' });
  const h = s.players[0].hand.slice();
  s = E.reduce(s, { type: 'FORUM_DISCARD', cards: ['tunnel', h.filter((c) => c !== 'tunnel')[0]] });
  s = settle(s);
  ok(s.players[0].discard.filter((c) => c === 'gold').length === 1,
    '公共広場で坑道を捨てたら金貨を獲得する（自分の捨て札＝対話も出る経路）');
}
{
  let s = E.createInitialState(['A', 'B'],
    ['legionary', 'tunnel', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['legionary', 'gold']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s.players[1].hand = ['tunnel', 'copper', 'copper', 'copper', 'estate'];
  s.players[1].deck = ['silver', 'silver', 'silver'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'legionary' });
  let g = 0;
  while (s.pending && g++ < 12) {
    const pd = s.pending;
    if (pd.type === 'legionary_reveal') s = E.reduce(s, { type: 'LEGIONARY_REVEAL', reveal: true });
    else if (pd.type === 'discard_down' && pd.stage === 'react') s = E.reduce(s, { type: 'LINGER_REACT' });
    else if (pd.type === 'discard_down') s = E.reduce(s, { type: 'DISCARD_DOWN_RESOLVE', cards: ['tunnel', 'copper', 'copper'] });
    else if (pd.type === 'tunnel_react') s = E.reduce(s, { type: 'TUNNEL_REACT', reveal: true });
    else break;
  }
  ok(s.players[1].discard.filter((c) => c === 'gold').length + s.players[1].hand.filter((c) => c === 'gold').length >= 1,
    '軍団兵（discard_down）で坑道を捨てさせても金貨を獲得する');
}

console.log('=== 2026-08-25: カード文の全数監査で確定した [medium]（異郷）===');
{
  /* 街道＝2022年第2版エラッタで「場にある間」→**「このターン」**型。場を離れても軽減が続く。 */
  let s = mkK(['highway', 'haggler', 'oasis']);
  s.players[0].hand = ['highway']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'highway' });
  ok(E.cardCost(s, 'province') === 7, '街道：属州が $7（実 ' + E.cardCost(s, 'province') + '）');
  s.players[0].inPlay = [];            // 場から消しても「このターン」なので効き続ける
  ok(E.cardCost(s, 'province') === 7, '街道：場を離れても このターン は $7 のまま（実 ' + E.cardCost(s, 'province') + '）');
}
{
  /* 値切り屋＝同じく「このターン」型。 */
  let s = mkK(['haggler', 'highway', 'oasis']);
  s.players[0].hand = ['haggler']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'haggler' });
  ok((s.turn.hagglerPlays || 0) === 1, '値切り屋：使用回数で数える');
  s.players[0].inPlay = [];
  s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'duchy' });
  ok(s.pending && s.pending.type === 'haggler', '値切り屋：場を離れても このターン の購入で発動する');
}
{
  /* 農地＝2022年第2版エラッタで「購入したとき」→**「獲得したとき」**（工房などで獲得しても働く）。 */
  // 農地は $6 なので改築（$4 を廃棄して最大 $6 を獲得）で「購入でない獲得」を作る
  let s = mkK(['remodel', 'farmland', 'oasis']);   // 農地を王国に入れる
  s.players[0].hand = ['remodel', 'militia', 'copper']; s.turn.actions = 1;   // 農地の窓は手札が要る
  s = reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
  s = reduce(s, { type: 'REMODEL_TRASH', card: 'militia' });
  s = reduce(s, { type: 'REMODEL_GAIN', card: 'farmland' });
  ok(s.pending && s.pending.type === 'farmland' && s.pending.stage === 'trash',
     '農地：**購入でない獲得**でも廃棄→格上げの窓が開く');
}
{
  /* 進路＝`When you gain, trash, or discard this, other than in Clean-up, you may play it.`
     2026-08-25 まで捨て札の経路しか配線されていなかった。 */
  let s = mkK(['trail', 'haggler', 'oasis']);
  s.players[0].hand = []; s.players[0].deck = ['copper', 'copper', 'copper'];
  s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'trail' });
  s = settle(s);
  ok(s.players[0].inPlay.includes('trail'), '進路：**獲得**したときに使える');
  // 廃棄したときも使える
  let u = mkK(['trail', 'chapel', 'oasis']);
  u.players[0].hand = ['chapel', 'trail']; u.turn.actions = 1;
  u.players[0].deck = ['copper', 'copper', 'copper'];
  u = reduce(u, { type: 'PLAY_ACTION', card: 'chapel' });
  u = reduce(u, { type: 'CHAPEL_RESOLVE', cards: ['trail'] });
  u = settle(u);
  ok(u.players[0].inPlay.includes('trail'), '進路：**廃棄**されたときに使える（廃棄置き場から場へ）');
  ok(!u.trash.includes('trail'), '進路：使ったので廃棄置き場には残らない');
}

// ==========================================================================
// §0-43 農地＝「農地でないカード」を獲得する（公式FAQ）
// ==========================================================================
{
  /* 公式FAQ 逐語＝`you gain a card from the Supply costing exactly [$2] more than the trashed card,
     but not another copy of Farmland.` 除外が無いと $4 を廃棄して農地($6)を取り、その農地の獲得時が
     また開いて手札がある限り連鎖する（1回の購入で何枚でも積める）。 */
  let s = mkK(['farmland', 'smithy', 'village', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['smithy', 'smithy', 'smithy'];
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  const before = s.supply.farmland;
  s = reduce(s, { type: 'BUY', card: 'farmland' });
  ok(s.pending && s.pending.type === 'farmland' && s.pending.stage === 'trash', '農地：購入で廃棄の窓が開く');
  s = reduce(s, { type: 'FARMLAND_TRASH', card: 'smithy' });
  ok(s.pending && s.pending.stage === 'gain' && s.pending.exactCost === 6, '農地：ちょうど$6の獲得へ');
  const rej = reduce(s, { type: 'FARMLAND_GAIN', card: 'farmland' });
  ok(JSON.stringify(rej) === JSON.stringify(s), '農地：獲得先に農地は選べない（engine が拒否）');
  s = reduce(s, { type: 'FARMLAND_GAIN', card: 'gold' });
  ok(before - s.supply.farmland === 1, '農地：山は1枚しか減らない（連鎖しない）');
  ok(s.players[0].discard.includes('gold'), '農地：金貨を獲得できる');
  let c = mkK(['farmland', 'smithy', 'village', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  c.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  c.players[0].hand = ['smithy'];
  c.turn.phase = 'buy'; c.turn.coins = 6; c.turn.buys = 1;
  c = reduce(c, { type: 'BUY', card: 'farmland' });
  c = reduce(c, { type: 'FARMLAND_TRASH', card: 'smithy' });
  const mv = DOM.cpu.decide(c);
  ok(!mv || mv.card !== 'farmland', 'CPU：農地の獲得先に農地を返さない（engine拒否×CPU提案の livelock 防止）');
}

// ==========================================================================
// §0-43 よろずや＝「手札が5枚になるまで引く」は drawUpTo（-1カードトークンで止まらない）
// ==========================================================================
{
  let s = mkK(['jack_of_all_trades', 'oasis', 'village', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['jack_of_all_trades'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'estate'];
  s.players[0].minusCard = true;
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'jack_of_all_trades' });
  let g = 0;
  while (s.pending && g++ < 6) {
    if (s.pending.type === 'jack' && s.pending.stage === 'look') s = reduce(s, { type: 'JACK_LOOK', discard: false });
    else if (s.pending.type === 'jack') s = reduce(s, { type: 'JACK_TRASH', card: null });
    else break;
  }
  ok(s.players[0].hand.length === 5, 'よろずや：-1カードトークンを持っていても手札5枚になる（実際 ' + s.players[0].hand.length + '枚）');
}

{
  // 農地：ちょうど$2高いカードが「農地しか無い」局面では窓を開かない（ゲート側の除外＝これが無いと詰む）
  let s = mkK(['farmland', 'smithy', 'village', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['smithy'];
  s.supply.gold = 0;
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'farmland' });
  s = reduce(s, { type: 'FARMLAND_TRASH', card: 'smithy' });
  ok(s.pending == null, '農地：候補が農地だけなら獲得の窓を開かない（人間が詰まない／CPUが回らない）');
}

// ==========================================================================
// §0-43 敵対レビュー②＝異郷（進路/織工/義賊/不正利得/大使館/行商人系）
// ==========================================================================
console.log('=== §0-43: 進路・織工の「してもよい」／義賊・不正利得の配り順 ===');
{
  // 進路＝`you **may** play it.` 廃棄で必ず場に戻ると、進路を廃棄してデッキを圧縮できない（公式FAQ）
  let s = mkK(['trail', 'chapel', 'weaver', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['chapel', 'trail']; s.players[0].deck = ['copper', 'copper']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['trail'] });
  ok(s.pending && s.pending.type === 'trail_react' && s.pending.from === 'trash', '進路：廃棄で「使いますか」の窓が開く');
  const no = reduce(s, { type: 'TRAIL_REACT', play: false });
  ok(no.trash.indexOf('trail') >= 0 && no.players[0].inPlay.indexOf('trail') < 0, '進路：使わなければ廃棄置き場に残る（デッキ圧縮ができる）');
  const ye = reduce(s, { type: 'TRAIL_REACT', play: true });
  ok(ye.players[0].inPlay.indexOf('trail') >= 0 && ye.trash.indexOf('trail') < 0, '進路：使えば場に戻る');
}
{
  // 織工＝`you **may** play it.` 相手のアタックで捨てさせられても任意で、二択も出る（公式FAQ＝1枚ずつ解決）
  const K = ['trail', 'weaver', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory'];
  let w = mkK(K);
  w.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  w.players[0].hand = ['militia']; w.players[0].deck = ['copper', 'copper', 'copper'];
  w.players[1].hand = ['weaver', 'weaver', 'copper', 'copper', 'estate'];
  w.turn.actions = 1;
  w = reduce(w, { type: 'PLAY_ACTION', card: 'militia' });
  w = reduce(w, { type: 'MILITIA_RESOLVE', cards: ['weaver', 'weaver'] });
  ok(w.pending && w.pending.type === 'weaver_react' && w.pending.player === 1, '織工：相手のアタックで捨てても「使いますか」の窓が開く');
  const sb = w.supply.silver;
  let d = reduce(w, { type: 'WEAVER_REACT', play: false });
  let g0 = 0;
  while (d.pending && d.pending.type === 'weaver_react' && g0++ < 4) d = reduce(d, { type: 'WEAVER_REACT', play: false });
  ok(d.supply.silver === sb, '織工：断れば銀貨は1枚も湧かない（望まないデッキ汚染／銀貨の枯渇が起きない）');
  let y = reduce(w, { type: 'WEAVER_REACT', play: true });
  ok(y.pending && y.pending.type === 'weaver' && y.pending.player === 1, '織工：使うと二択（銀貨2枚 / $4以下1枚）が相手のターンでも出る');
  y = reduce(y, { type: 'WEAVER_MODE', mode: 'silver' });
  ok(y.players[1].discard.filter((c) => c === 'silver').length === 2, '織工：銀貨2枚を獲得');
  ok(y.pending && y.pending.type === 'weaver_react', '織工：2枚目は別の窓として続けて開く（1枚ずつ解決）');
}
{
  // 義賊＝「財宝を1枚も公開しなかった」＝銅貨も財宝（公式FAQ `did not reveal a Treasure at all`）
  let s = mkK(['noble_brigand', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'militia']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['noble_brigand']; s.players[0].deck = ['copper'];
  s.players[1].deck = ['copper', 'copper', 'estate'];
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'noble_brigand' });
  let g = 0;
  while (s.pending && g++ < 8) { const b = s.pending; s = reduce(s, { type: 'NOBLE_BRIGAND_PICK', card: null }); if (s.pending === b) break; }
  ok(s.players[1].discard.filter((c) => c === 'copper').length === 2, '義賊：銅貨2枚を公開した相手は銅貨を獲得しない（公開したのは全部捨て札に戻るだけ）');
}
{
  // 不正利得＝呪いが足りないときは獲得者の左隣からターン順（席0からではない）
  let s = E.createInitialState(['A', 'B', 'C'], ['ill_gotten_gains', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'militia'], { startActive: 1 });
  s.supply.curse = 1;
  s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'ill_gotten_gains' });
  ok(s.players[2].discard.indexOf('curse') >= 0 && s.players[0].discard.indexOf('curse') < 0,
    '不正利得：最後の呪いは獲得者(P1)の左隣(P2)へ（席0からではない）');
}

{
  // 進路＝**捨て札**の経路でも任意（オアシスで捨てても「使わない」を選べる）
  let s = mkK(['trail', 'oasis', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['oasis', 'trail', 'copper']; s.players[0].deck = ['copper', 'copper', 'copper'];
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'oasis' });
  s = reduce(s, { type: 'OASIS_RESOLVE', card: 'trail' });
  ok(s.pending && s.pending.type === 'trail_react' && s.pending.from === 'discard', '進路：捨て札の経路でも窓が開く');
  const no = reduce(s, { type: 'TRAIL_REACT', play: false });
  ok(no.players[0].discard.indexOf('trail') >= 0 && no.players[0].inPlay.indexOf('trail') < 0, '進路：捨て札でも使わずに済ませられる');
}

// ==========================================================================
// §0-43 敵対レビュー③＝異郷（スーク／公爵夫人／大釜）
// ==========================================================================
console.log('=== §0-43: スーク・公爵夫人・大釜 ===');
{
  /* スーク＝`+1 Buy / +[$7] / –[$1] per card in your hand (you can't go below [$0]).`
     Official FAQ＝`You can't go below [$0] **but might end up with less [$] than you started with**.` */
  let s = mkK(['souk', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'militia']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['souk'].concat(new Array(8).fill('copper')); // 使用後の手札8枚
  s.turn.actions = 1; s.turn.coins = 5;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'souk' });
  ok(s.turn.coins === 4, 'スーク：所持$5・手札8枚 → $4（5+7-8。持っていたコインが減る）実際 $' + s.turn.coins);
  let z = mkK(['souk', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'militia']);
  z.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  z.players[0].hand = ['souk'].concat(new Array(9).fill('copper'));
  z.turn.actions = 1; z.turn.coins = 0;
  z = reduce(z, { type: 'PLAY_ACTION', card: 'souk' });
  ok(z.turn.coins === 0, 'スーク：$0未満にはならない（実際 $' + z.turn.coins + '）');
}
{
  /* 公爵夫人＝`each player **secretly looks at the top card of their deck**`／
     2011年版FAQ＝`Any player with no cards in his deck **shuffles his discard pile first**`
     ＝山札が空なら**見る前に**シャッフルし、見た札を pending に載せる（載せないと中身を見ずに決めさせられる）。 */
  let s = mkK(['duchess', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'militia']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['duchess'];
  s.players[0].deck = []; s.players[0].discard = ['gold', 'estate', 'copper'];
  s.players[1].deck = ['copper'];
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'duchess' });
  ok(s.pending && s.pending.type === 'duchess_look' && s.pending.card, '公爵夫人：見た札が pending に載る（UI がカード名を出せる）');
  ok(s.players[0].deck.length > 0, '公爵夫人：見る前にシャッフルしている');
  const seen = s.pending.card;
  ok(s.players[0].deck[0] === seen, '公爵夫人：pending の札が実際の山札の一番上');
  // 相手席にはマスクされる
  const m = E.maskStateFor(s, 1);
  ok(m.pending && m.pending.card === 'back', '公爵夫人：相手席には見た札を伏せる（オンラインで漏れない）');
}
{
  /* 大釜＝`The **third time you gain an Action** this turn, each other player gains a Curse.`
     獲得の経路を問わない＝別の獲得 pending の解決中（国境の村など）でも発動しなければならない。 */
  let s = mkK(['cauldron', 'border_village', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'], ['A', 'B']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.turn.phase = 'buy'; s.turn.cauldronPlays = 1;
  s.turn.buys = 5; s.turn.coins = 20;
  s = reduce(s, { type: 'BUY', card: 'village' });            // 1
  s = reduce(s, { type: 'BUY', card: 'border_village' });     // 2 → 獲得時に安いカードを1枚（= 3枚目）
  ok(s.pending && s.pending.type === 'border_village', '国境の村の獲得pending が開く');
  s = reduce(s, { type: 'BORDER_VILLAGE_GAIN', card: 'village' }); // 3枚目のアクション獲得
  let g = 0;
  while (s.pending && s.pending.type !== 'cauldron' && g++ < 5) s = reduce(s, { type: 'CAULDRON_REACT' });
  ok(s.players[1].discard.indexOf('curse') >= 0 || (s.pending && s.pending.type === 'cauldron'),
    '大釜：獲得pending の解決中でもアタックが発動する（黙って消えない）');
}

// ==========================================================================
// §0-43 敵対レビュー④＝異郷（岐路／開発／神託の順番／宿屋／交易人）
// ==========================================================================
console.log('=== §0-43: 岐路・開発・神託・宿屋・交易人 ===');
{
  /* 岐路＝`If this is the **first time you played a Crossroads** this turn, +3 Actions.`
     公式＝`If your first Crossroads is either enchanted or **played as a Way**, the second one
     will **not** give +Actions.` ＝印は applyEffect の中ではなく使用の入口で立てる。 */
  let s = mkK(['crossroads', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'militia'],
    ['A', 'B'], 0);
  s.ways = ['way_of_the_ox'];
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['crossroads', 'crossroads', 'estate'];
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s.turn.actions = 5;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'crossroads', way: 'way_of_the_ox' }); // 習性で使う
  const a1 = s.turn.actions;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'crossroads' }); // 2枚目（普通に使う）
  ok(s.turn.actions - a1 <= 0, '岐路：1枚目を習性で使ったら2枚目は +3アクションを出さない（差 ' + (s.turn.actions - a1) + '）');
}
{
  /* 開発＝`**What matters is the cost of each card at the time you're gaining cards**, not at the time you
     play Develop.` 行人(wayfarer)は「このターンに獲得された直前のカード」のコストになる＝
     1枚目の獲得でコストが動いたら2枚目の基準も動く。 */
  let s = mkK(['develop', 'wayfarer', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['develop', 'wayfarer'];
  s.players[0].deck = ['copper', 'copper'];
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'develop' });
  s = reduce(s, { type: 'DEVELOP_TRASH', card: 'wayfarer' });
  ok(s.pending && s.pending.stage === 'gain' && s.pending.trashedId === 'wayfarer', '開発：廃棄した札のidを持ち回す（コストを測り直せる）');
}
{
  // 神託＝戻す順番は**持ち主**が決める（カード文にも書いてある）
  let s = mkK(['oracle', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'militia']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['oracle']; s.players[0].deck = ['copper', 'copper', 'copper'];
  s.players[1].deck = ['gold', 'estate', 'copper'];
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'oracle' });
  let g = 0; let sawOrder = false;
  while (s.pending && g++ < 8) {
    if (s.pending.type === 'oracle' && s.pending.stage === 'decide') {
      if (s.pending.victim === 0) s = reduce(s, { type: 'ORACLE_DECIDE', discard: true });
      else s = reduce(s, { type: 'ORACLE_DECIDE', discard: false });
    } else if (s.pending.type === 'oracle' && s.pending.stage === 'order') {
      sawOrder = true;
      ok(s.pending.player === 1, '神託：戻す順番の窓は**持ち主**に開く（使用者ではない）');
      s = reduce(s, { type: 'ORACLE_ORDER', order: ['estate', 'gold'] });
      ok(s.players[1].deck[0] === 'estate', '神託：持ち主が選んだ順で戻る');
      break;
    } else break;
  }
  ok(sawOrder, '神託：戻すことを選んだら順番の窓が必ず開く');
}
/* 宿屋＝`If you don't reveal any Actions from your discard pile, you still shuffle your deck.`
   engine の窓の条件から「捨て札にアクションがあるか」を外した（公式どおり常に開く）。
   ⚠ 回帰テストは置いていない＝**実プレイでは到達しない**ため。宿屋を捨て札以外（手札/山札）に獲得する
   経路（職人/工匠）は、その gainer 自身の pending が立っているので `triggerOnGain` の
   「1獲得につき対話は1つ」ゲート（§6 の既存簡略化）に先に当たって窓が開かない。
   宿屋を捨て札に獲得する場合は宿屋自身がアクションなので旧条件でも常に真だった。 */
{
  // 交易人＝銀貨を獲得したときも窓を開く（公式＝銀貨↔銀貨の交換ができる）
  let s = mkK(['trader', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'militia']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['trader'];
  s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.pending && s.pending.type === 'trader_react', '交易人：銀貨の獲得でも窓が開く（公式＝銀貨↔銀貨の交換）');
}

console.log('異郷テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
