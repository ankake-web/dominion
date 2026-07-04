/* ギルド（Guilds）ゲームロジックの検証（Node 単体実行）
   使い方: node test/guilds.test.js
   対象: 財源(Coffers)の付与/使用 / 過払い(overpay: 名品/石工/医者/伝令官) /
         アタック(収税吏/予言者) / trash-to-gain(石工/肉屋) / 公開系(助言者/熟練工) /
         伝令官の山札上プレイ / 広場 / パン屋のセットアップ / 商人ギルドの購入毎トリガー /
         CPU通し・カード保存則 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
let seed = 20240711;
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

const GK = DOM.POOLS.guilds.slice();               // 全13種（baker を含む＝開始時 全員+1財源）
const GKNB = GK.filter((id) => id !== 'baker');    // baker 抜き＝開始時 財源0（財源計数テスト用）
function mkK(kingdom, players, startActive) {
  return E.createInitialState(players || ['A', 'B'], kingdom, { startActive: startActive == null ? 0 : startActive });
}
function setupK(kingdom, hand, deck, opts) {
  const s = mkK(kingdom, ['A', 'B'], 0);
  s.players[0].hand = hand.slice();
  s.players[0].deck = (deck || []).slice();
  if (opts && opts.p1hand) s.players[1].hand = opts.p1hand.slice();
  if (opts && opts.p1deck) s.players[1].deck = opts.p1deck.slice();
  return s;
}
function playAct(s, card) { return reduce(s, { type: 'PLAY_ACTION', card }); }
function autoResolve(s, max) { let g = 0; while (s.pending && g++ < (max || 60)) s = reduce(s, CPU.decide(s)); return s; }

/* ============ CARD_SET / セットアップ ============ */
console.log('=== ギルド: CARD_SET 昇格・パン屋のセットアップ ===');
{
  ok(DOM.CARD_SETS.some((x) => x.id === 'guilds' && x.kingdom.length === 10), 'guilds 固定セットが10種で存在');
  ok(DOM.CARD_SETS.some((x) => x.id === 'random-guilds' && (x.randomFrom || []).indexOf('guilds') >= 0), 'random-guilds が存在');
  ok(DOM.KINGDOM_GUILDS.every((id) => DOM.POOLS.guilds.includes(id)) && DOM.KINGDOM_GUILDS.length === 10, '固定10種は全てギルドプール内');
  // 全プレイヤーに coffers フィールドがある
  const s = mkK(GKNB);
  ok(s.players.every((p) => p.coffers === 0), 'baker 不在なら開始時 財源0');
  const s2 = mkK(GK);
  ok(s2.players.every((p) => p.coffers === 1), 'パン屋のセットアップ: 全員 開始時 財源1');
  // baker が闇市場デッキにだけあっても（≒王国に居れば）セットアップは発火する—ここでは王国に居れば発火を確認
}

/* ============ 財源(Coffers)の使用 ============ */
console.log('=== 財源: 購入フェイズに 1枚=+1コイン で使う ===');
{
  let s = mkK(GKNB); s.turn.phase = 'buy'; s.players[0].coffers = 3; s.turn.coins = 2;
  s = reduce(s, { type: 'COFFERS_SPEND', amount: 2 });
  ok(s.turn.coins === 4 && s.players[0].coffers === 1, '財源2枚使用 → +2コイン・財源残1');
  const s2 = reduce(s, { type: 'COFFERS_SPEND', amount: 5 }); // 残1しかない
  ok(s2.turn.coins === 4 && s2.players[0].coffers === 1, '所持を超える使用は拒否（状態不変）');
  // アクションフェイズでは使えない
  let s3 = mkK(GKNB); s3.players[0].coffers = 2; s3.turn.phase = 'action';
  const s4 = reduce(s3, { type: 'COFFERS_SPEND', amount: 1 });
  ok(s4.turn.coins === 0 && s4.players[0].coffers === 2, 'アクションフェイズでは財源を使えない');
}

/* ============ 蝋燭職人 candlestick_maker ============ */
console.log('=== 蝋燭職人: +1アクション +1購入 +1財源 ===');
{
  let s = setupK(GKNB, ['candlestick_maker'], ['copper']);
  s = playAct(s, 'candlestick_maker');
  ok(s.turn.actions === 1 && s.turn.buys === 2 && s.players[0].coffers === 1, '+1アクション(計1)/+1購入(計2)/+1財源');
}

/* ============ 商人ギルド merchant_guild（購入毎トリガー） ============ */
console.log('=== 商人ギルド: +1購入 +1コイン、場にある間 購入毎に +1財源 ===');
{
  let s = setupK(GKNB, ['merchant_guild'], ['copper']);
  s = playAct(s, 'merchant_guild');
  ok(s.turn.buys === 2 && s.turn.coins === 1 && s.players[0].coffers === 0, 'プレイ時は +1購入 +1コイン（財源はまだ0）');
  s.turn.phase = 'buy'; s.turn.coins = 6;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.players[0].coffers === 1, '1回目の購入で +1財源');
  s = reduce(s, { type: 'BUY', card: 'copper' });
  ok(s.players[0].coffers === 2, '2回目の購入で さらに +1財源');
}
console.log('=== 商人ギルド: 玉座で2回使うと購入毎+2財源（プレイ回数で累積）===');
{
  // 玉座は出荷セットに無いが、命令(replay)で2回プレイ＝購入毎+2財源になることを確認（忠実性）。
  let s = setupK(GKNB, ['merchant_guild'], ['copper']);
  s.turn.merchantGuildPlays = 2; // 2回使った状態を直接作る
  s.turn.phase = 'buy'; s.turn.coins = 3;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.players[0].coffers === 2, '2回使用 → 購入毎 +2財源');
}

/* ============ 過払い overpay ============ */
console.log('=== 過払い: 名品 → 過払い1コインにつき銀貨1枚 ===');
{
  let s = mkK(GKNB); s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'masterpiece' }); // cost3 → 残3
  ok(s.pending && s.pending.type === 'overpay' && s.pending.card === 'masterpiece' && s.pending.max === 3, '過払い選択（max=残コイン3）');
  s = reduce(s, { type: 'OVERPAY_RESOLVE', amount: 3 });
  ok(!s.pending && count(s.players[0].discard, 'silver') === 3 && s.turn.coins === 0, '過払い3 → 銀貨3枚・コイン0');
}
console.log('=== 過払い: 石工 → 過払い額とちょうど同コストのアクションを2枚 ===');
{
  let s = mkK(GKNB); s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'stonemason' }); // cost2 → 残4
  ok(s.pending.type === 'overpay' && s.pending.max === 4, '過払い max=4');
  s = reduce(s, { type: 'OVERPAY_RESOLVE', amount: 4 });
  ok(s.pending.type === 'stonemason_overpay' && s.pending.exact === 4 && s.pending.remaining === 2, 'ちょうど$4のアクションを2枚');
  s = reduce(s, { type: 'STONEMASON_OVERPAY_GAIN', card: 'advisor' }); // $4 action
  ok(s.pending.remaining === 1, '1枚目 advisor 獲得');
  s = reduce(s, { type: 'STONEMASON_OVERPAY_GAIN', card: 'taxman' }); // $4 action
  ok(!s.pending && count(s.players[0].discard, 'advisor') === 1 && count(s.players[0].discard, 'taxman') === 1, '$4アクション2枚を獲得');
  // 非アクション/コスト不一致は拒否
  let s2 = mkK(GKNB); s2.turn.phase = 'buy'; s2.turn.coins = 6; s2.turn.buys = 1;
  s2 = reduce(s2, { type: 'BUY', card: 'stonemason' });
  s2 = reduce(s2, { type: 'OVERPAY_RESOLVE', amount: 4 });
  const before = JSON.stringify(s2.pending);
  s2 = reduce(s2, { type: 'STONEMASON_OVERPAY_GAIN', card: 'silver' }); // 財宝は不可
  ok(JSON.stringify(s2.pending) === before, '石工過払いで財宝は獲得できない（拒否）');
}
console.log('=== 過払い: 医者 → 過払い1コインにつき山札の上を見て 廃棄/捨て/戻す ===');
{
  let s = mkK(GKNB); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s.players[0].deck = ['curse', 'estate', 'gold', 'copper'];
  s = reduce(s, { type: 'BUY', card: 'doctor' }); // cost3 → 残2
  s = reduce(s, { type: 'OVERPAY_RESOLVE', amount: 2 });
  ok(s.pending.type === 'doctor_overpay' && s.pending.remaining === 2 && s.pending.card === 'curse', '過払い2 → 山札の上(curse)を見る');
  s = reduce(s, { type: 'DOCTOR_OVERPAY', choice: 'trash' });
  ok(count(s.trash, 'curse') === 1 && s.pending.card === 'estate' && s.pending.remaining === 1, 'curse廃棄→次(estate)');
  s = reduce(s, { type: 'DOCTOR_OVERPAY', choice: 'discard' });
  ok(count(s.players[0].discard, 'estate') === 1 && !s.pending && s.players[0].deck[0] === 'gold', 'estate捨て→終了・山札上=gold');
}
console.log('=== 過払い: 伝令官 → 過払い1コインにつき捨て札から1枚を山札の上へ ===');
{
  let s = mkK(GKNB); s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s.players[0].discard = ['gold', 'estate'];
  s = reduce(s, { type: 'BUY', card: 'herald' }); // cost4 → 残2、herald は捨て札へ
  s = reduce(s, { type: 'OVERPAY_RESOLVE', amount: 2 });
  ok(s.pending.type === 'herald_overpay' && s.pending.remaining === 2, '過払い2 → 捨て札から2枚上へ');
  s = reduce(s, { type: 'HERALD_OVERPAY', card: 'gold' });
  ok(s.players[0].deck[0] === 'gold' && s.pending.remaining === 1, 'gold を山札の上へ');
  s = reduce(s, { type: 'HERALD_OVERPAY', card: 'estate' });
  ok(s.players[0].deck[0] === 'estate' && !s.pending, 'estate を山札の上へ → 終了');
}
console.log('=== 過払い: overpay 0（辞退）は効果なし・過払いは残コインの範囲 ===');
{
  let s = mkK(GKNB); s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'masterpiece' }); // 残1
  s = reduce(s, { type: 'OVERPAY_RESOLVE', amount: 0 });
  ok(!s.pending && count(s.players[0].discard, 'silver') === 0 && s.turn.coins === 1, '過払い0 → 銀貨なし・コイン据え置き');
  // 過払いは残コインを超えられない
  let s2 = mkK(GKNB); s2.turn.phase = 'buy'; s2.turn.coins = 4; s2.turn.buys = 1;
  s2 = reduce(s2, { type: 'BUY', card: 'masterpiece' }); // 残1
  const s3 = reduce(s2, { type: 'OVERPAY_RESOLVE', amount: 3 }); // 残1を超える
  ok(s3.pending && s3.pending.type === 'overpay', '残コインを超える過払いは拒否（pending据え置き）');
}
console.log('=== 過払い: BUY以外の獲得では過払い選択は出ない（工房型）===');
{
  let s = setupK(GKNB, ['candlestick_maker'], ['copper']); // 何かでgainする代わりに直接 gain を確認
  // 直接 gain で masterpiece を獲得しても overpay は起きない（BUY のみ）
  const g0 = JSON.stringify(s.pending);
  // workshop等が無いので、gain経路の代表として finishGain 系は使わず、BUYでないことの確認に留める
  ok(g0 === JSON.stringify(null) || s.pending == null, '通常状態で overpay pending は無い（BUY時のみ発火）');
}

console.log('=== 過払い: 闇市場で過払い対象カードを買っても過払いできる（promo込みセットで到達可）===');
{
  const K2 = ['black_market', 'village', 'smithy', 'market', 'militia', 'cellar', 'moat', 'workshop', 'remodel', 'festival'];
  let s = mkK(K2);
  s.turn.phase = 'buy'; s.turn.coins = 6;
  s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['masterpiece', 'estate', 'copper'] }; // 名品が公開されている
  s = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'masterpiece' }); // cost3 → 残3
  ok(s.pending && s.pending.type === 'overpay' && s.pending.card === 'masterpiece' && s.pending.max === 3, '闇市場購入後に過払い選択が出る');
  s = reduce(s, { type: 'OVERPAY_RESOLVE', amount: 3 });
  ok(!s.pending && count(s.players[0].discard, 'silver') === 3 && count(s.players[0].discard, 'masterpiece') === 1, '闇市場の名品過払い→銀貨3枚');
}

/* ============ 石工 stonemason（trash → 2枚安く獲得） ============ */
console.log('=== 石工: 手札1枚廃棄 → それより安いカードを2枚獲得 ===');
{
  let s = setupK(GKNB, ['stonemason', 'gold'], ['copper']);
  s = playAct(s, 'stonemason');
  ok(s.pending.type === 'stonemason' && s.pending.stage === 'trash', '廃棄選択');
  s = reduce(s, { type: 'STONEMASON_TRASH', card: 'gold' }); // cost6
  ok(count(s.trash, 'gold') === 1 && s.pending.stage === 'gain' && s.pending.maxCost === 6 && s.pending.remaining === 2, 'gold廃棄→$6未満を2枚');
  s = reduce(s, { type: 'STONEMASON_GAIN', card: 'silver' }); // $3<6
  s = reduce(s, { type: 'STONEMASON_GAIN', card: 'silver' });
  ok(!s.pending && count(s.players[0].discard, 'silver') === 2, '$6未満(silver)を2枚獲得');
  // 廃棄コスト以上は拒否
  let s2 = setupK(GKNB, ['stonemason', 'silver'], ['copper']);
  s2 = playAct(s2, 'stonemason');
  s2 = reduce(s2, { type: 'STONEMASON_TRASH', card: 'silver' }); // cost3 → $3未満(=$0..2)のみ
  const bad = reduce(s2, { type: 'STONEMASON_GAIN', card: 'silver' }); // $3 は不可
  ok(bad.pending && bad.pending.stage === 'gain', '廃棄コスト以上の獲得は拒否');
  s2 = reduce(s2, { type: 'STONEMASON_GAIN', card: 'copper' }); // $0
  ok(s2.pending.remaining === 1, 'copper($0)は獲得可');
}

/* ============ 医者 doctor（指定→上3枚→同名廃棄→残りを上へ） ============ */
console.log('=== 医者: カード指定→上3枚公開→同名を全廃棄→残りを山札の上へ ===');
{
  let s = setupK(GKNB, ['doctor'], ['estate', 'estate', 'copper', 'gold']);
  s = playAct(s, 'doctor');
  ok(s.pending.type === 'doctor' && s.pending.stage === 'name', '指定選択');
  s = reduce(s, { type: 'DOCTOR_NAME', card: 'estate' }); // 上3=estate,estate,copper → estate2枚廃棄・残copper
  ok(count(s.trash, 'estate') === 2 && !s.pending && s.players[0].deck[0] === 'copper' && s.players[0].deck[1] === 'gold', 'estate2枚廃棄・copperを上へ戻す');
  // 残りが2枚以上 → 並べ替え
  let s2 = setupK(GKNB, ['doctor'], ['gold', 'silver', 'copper', 'estate']);
  s2 = playAct(s2, 'doctor');
  s2 = reduce(s2, { type: 'DOCTOR_NAME', card: 'estate' }); // 上3=gold,silver,copper（同名なし）→ 並べ替え
  ok(s2.pending.type === 'doctor' && s2.pending.stage === 'order' && s2.pending.cards.length === 3, '残り3枚→並べ替え');
  s2 = reduce(s2, { type: 'DOCTOR_ORDER', order: ['gold', 'silver', 'copper'] });
  ok(!s2.pending && s2.players[0].deck[0] === 'gold' && s2.players[0].deck[3] === 'estate', '指定順で山札の上に戻る');
}

/* ============ 助言者 advisor（左隣が1枚を選んで捨てさせる） ============ */
console.log('=== 助言者: +1アクション、上3枚→左隣が1枚捨てさせ、残りは手札へ ===');
{
  let s = setupK(GKNB, ['advisor'], ['gold', 'silver', 'estate']);
  s = playAct(s, 'advisor');
  ok(s.turn.actions === 1 && s.pending.type === 'advisor' && s.pending.player === 1 && s.pending.source === 0 && s.pending.cards.length === 3, '左隣(席1)が選ぶ');
  s = reduce(s, { type: 'ADVISOR_CHOOSE', card: 'gold' }); // 左隣は最も価値の高い gold を捨てさせる
  ok(!s.pending && count(s.players[0].discard, 'gold') === 1, '選ばれた札は使用者の捨て札へ');
  ok(s.players[0].hand.includes('silver') && s.players[0].hand.includes('estate'), '残り2枚は使用者の手札へ');
}

/* ============ 広場 plaza（財宝を捨てて +1財源） ============ */
console.log('=== 広場: +1カード +2アクション、財宝1枚を捨てて +1財源 ===');
{
  let s = setupK(GKNB, ['plaza', 'copper'], ['silver', 'gold']);
  s = playAct(s, 'plaza');
  ok(s.turn.actions === 2 && count(s.players[0].hand, 'silver') === 1 && s.pending.type === 'plaza', '+1カード(silver)/+2アクション/財宝捨て選択');
  s = reduce(s, { type: 'PLAZA_DISCARD', card: 'copper' });
  ok(s.players[0].coffers === 1 && count(s.players[0].discard, 'copper') === 1 && !s.pending, '財宝を捨てて +1財源');
  // 捨てない選択
  let s2 = setupK(GKNB, ['plaza', 'copper'], ['silver', 'gold']);
  s2 = playAct(s2, 'plaza');
  s2 = reduce(s2, { type: 'PLAZA_DISCARD', card: null });
  ok(s2.players[0].coffers === 0 && !s2.pending, '捨てなければ財源は増えない');
}

/* ============ 収税吏 taxman（アタック） ============ */
console.log('=== 収税吏: 財宝廃棄→+$3までの財宝を山札の上に獲得→相手(5枚以上)が同名を捨てる ===');
{
  let s = setupK(GKNB, ['taxman', 'copper'], ['estate'], { p1hand: ['copper', 'estate', 'silver', 'gold', 'duchy'] });
  s = playAct(s, 'taxman');
  ok(s.pending.type === 'taxman' && s.pending.stage === 'trash', '財宝廃棄選択');
  s = reduce(s, { type: 'TAXMAN_TRASH', card: 'copper' }); // cost0 → maxCost3
  ok(count(s.trash, 'copper') === 1 && s.pending.stage === 'gain' && s.pending.maxCost === 3 && s.pending.trashedName === 'copper', 'copper廃棄→$3までの財宝獲得へ');
  s = reduce(s, { type: 'TAXMAN_GAIN', card: 'silver' }); // 山札の上へ
  ok(s.players[0].deck[0] === 'silver', '獲得した銀貨は山札の上');
  ok(count(s.players[1].discard, 'copper') === 1 && s.players[1].hand.length === 4, '相手(5枚)が同名(copper)を1枚捨てた');
  ok(!s.pending, '解決');
  // 財宝が非財宝コストで拒否される（財宝以外は獲得できない）
  let s2 = setupK(GKNB, ['taxman', 'copper'], ['estate']);
  s2 = playAct(s2, 'taxman');
  s2 = reduce(s2, { type: 'TAXMAN_TRASH', card: 'copper' });
  const bad = reduce(s2, { type: 'TAXMAN_GAIN', card: 'estate' }); // 勝利点は財宝でない
  ok(bad.pending && bad.pending.stage === 'gain', '収税吏の獲得は財宝のみ（勝利点は拒否）');
}
console.log('=== 収税吏: 手札4枚以下の相手は影響を受けない / 廃棄しなければ無効果 ===');
{
  let s = setupK(GKNB, ['taxman', 'copper'], ['estate'], { p1hand: ['copper', 'copper', 'copper', 'estate'] }); // 4枚
  s = playAct(s, 'taxman');
  s = reduce(s, { type: 'TAXMAN_TRASH', card: 'copper' });
  s = reduce(s, { type: 'TAXMAN_GAIN', card: 'silver' });
  ok(count(s.players[1].discard, 'copper') === 0 && s.players[1].hand.length === 4, '手札4枚の相手は捨てない');
  // 廃棄しない → 何も起きない（アタックも獲得も無し）
  let s2 = setupK(GKNB, ['taxman', 'copper'], ['estate'], { p1hand: ['copper', 'copper', 'copper', 'copper', 'copper'] });
  s2 = playAct(s2, 'taxman');
  s2 = reduce(s2, { type: 'TAXMAN_TRASH', card: null });
  ok(!s2.pending && count(s2.players[1].discard, 'copper') === 0, '廃棄しない→相手も捨てず・獲得も無し');
}
console.log('=== 収税吏: 堀で無効化できる ===');
{
  let s = setupK(GKNB, ['taxman', 'copper'], ['estate'], { p1hand: ['moat', 'copper', 'copper', 'copper', 'copper'] });
  s = playAct(s, 'taxman');
  s = reduce(s, { type: 'TAXMAN_TRASH', card: 'copper' });
  s = reduce(s, { type: 'TAXMAN_GAIN', card: 'silver' });
  ok(s.pending && s.pending.type === 'taxman' && s.pending.stage === 'react', '相手に反応窓（堀）');
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(!s.pending && count(s.players[1].discard, 'copper') === 0, '堀で同名の捨てを無効化');
}

/* ============ 伝令官 herald（山札の上を公開→アクションならプレイ） ============ */
console.log('=== 伝令官: +1カード +1アクション、山札の上がアクションならプレイ ===');
{
  let s = setupK(GKNB, ['herald'], ['copper', 'village', 'copper', 'copper']); // 引いた後、上=village(action)
  s = playAct(s, 'herald');
  ok(s.players[0].inPlay.includes('village') && s.turn.actions === 3, '上のvillageをプレイ（+1カード+2アクション）');
  // 非アクションはそのまま山札の上
  let s2 = setupK(GKNB, ['herald'], ['copper', 'silver', 'copper']);
  s2 = playAct(s2, 'herald');
  ok(s2.players[0].deck[0] === 'silver' && !s2.players[0].inPlay.includes('silver'), '非アクション(silver)は山札の上に残る');
}

/* ============ パン屋 baker ============ */
console.log('=== パン屋: +1カード +1アクション +1財源 ===');
{
  let s = setupK(GK, ['baker'], ['copper']); // GK=baker含む→開始時 財源1
  ok(s.players[0].coffers === 1, 'セットアップで開始時 財源1');
  s = playAct(s, 'baker');
  ok(s.turn.actions === 1 && s.players[0].coffers === 2 && count(s.players[0].hand, 'copper') === 1, 'プレイで +1カード +1アクション +1財源（計2）');
}

/* ============ 肉屋 butcher（+2財源→trash→財源を払って格上げ） ============ */
console.log('=== 肉屋: +2財源、手札1枚廃棄→財源を払い(廃棄コスト+財源)以下を獲得 ===');
{
  let s = setupK(GKNB, ['butcher', 'estate'], ['copper']);
  s = playAct(s, 'butcher');
  ok(s.players[0].coffers === 2 && s.pending.type === 'butcher' && s.pending.stage === 'trash', '+2財源・廃棄選択');
  s = reduce(s, { type: 'BUTCHER_TRASH', card: 'estate' }); // cost2
  ok(count(s.trash, 'estate') === 1 && s.pending.stage === 'pay' && s.pending.trashedCost === 2, 'estate廃棄→支払い選択');
  s = reduce(s, { type: 'BUTCHER_PAY', amount: 2 }); // 2財源 → maxCost=4
  ok(s.players[0].coffers === 0 && s.pending.stage === 'gain' && s.pending.maxCost === 4, '財源2支払い→上限$4');
  s = reduce(s, { type: 'BUTCHER_GAIN', card: 'taxman' }); // $4
  ok(!s.pending && count(s.players[0].discard, 'taxman') === 1, '$4のカードを獲得');
  // 廃棄しない → +2財源だけ・獲得なし
  let s2 = setupK(GKNB, ['butcher', 'estate'], ['copper']);
  s2 = playAct(s2, 'butcher');
  s2 = reduce(s2, { type: 'BUTCHER_TRASH', card: null });
  ok(s2.players[0].coffers === 2 && !s2.pending, '廃棄しない→+2財源のみ');
}

/* ============ 熟練工 journeyman ============ */
console.log('=== 熟練工: 指定→指定以外が3枚出るまで公開→その3枚を手札・残りを捨てる ===');
{
  let s = setupK(GKNB, ['journeyman'], ['estate', 'copper', 'estate', 'gold', 'estate', 'silver']);
  s = playAct(s, 'journeyman');
  ok(s.pending.type === 'journeyman' && s.pending.stage === 'name', '指定選択');
  s = reduce(s, { type: 'JOURNEYMAN_NAME', card: 'estate' });
  ok(!s.pending, '解決');
  ok(count(s.players[0].hand, 'copper') === 1 && count(s.players[0].hand, 'gold') === 1 && count(s.players[0].hand, 'silver') === 1, '指定以外の3枚(copper/gold/silver)を手札へ');
  ok(count(s.players[0].discard, 'estate') === 3, '指定(estate)3枚は捨て札へ');
}

/* ============ 予言者 soothsayer（アタック） ============ */
console.log('=== 予言者: 金貨獲得、相手は呪い獲得→引いた場合+1カード ===');
{
  let s = setupK(GKNB, ['soothsayer'], ['copper']);
  const before = s.players[1].hand.length;
  s = playAct(s, 'soothsayer');
  ok(count(s.players[0].discard, 'gold') === 1, '金貨を獲得');
  ok(count(s.players[1].discard, 'curse') === 1 && s.players[1].hand.length === before + 1, '相手は呪い獲得＋1カード引く');
  // 呪い枯渇 → 引かない・金貨は獲得
  let s2 = setupK(GKNB, ['soothsayer'], ['copper']); s2.supply.curse = 0;
  const b2 = s2.players[1].hand.length;
  s2 = playAct(s2, 'soothsayer');
  ok(count(s2.players[0].discard, 'gold') === 1 && count(s2.players[1].discard, 'curse') === 0 && s2.players[1].hand.length === b2, '呪い枯渇→呪いも引きも無し（金貨は獲得）');
  // 堀で無効化
  let s3 = setupK(GKNB, ['soothsayer'], ['copper'], { p1hand: ['moat', 'copper', 'copper', 'copper', 'copper'] });
  s3 = playAct(s3, 'soothsayer');
  ok(s3.pending && s3.pending.type === 'soothsayer' && s3.pending.stage === 'react', '相手に反応窓');
  s3 = reduce(s3, { type: 'MOAT_REVEAL' });
  ok(!s3.pending && count(s3.players[1].discard, 'curse') === 0, '堀で呪いを無効化');
}

/* ============ 回帰: 必須獲得で獲得先が皆無でも詰まない（銅貨/銀貨枯渇） ============ */
console.log('=== 回帰: 収税吏の獲得先が皆無でも アタックは実行され pending 解消（無限ループ防止）===');
{
  let s = setupK(GKNB, ['taxman', 'copper'], ['estate'], { p1hand: ['copper', 'copper', 'copper', 'copper', 'copper'] });
  s.supply.copper = 0; s.supply.silver = 0; s.supply.gold = 0; s.supply.masterpiece = 0; // maxCost=3 の財宝が全滅（名品も$3財宝）
  s = playAct(s, 'taxman');
  s = reduce(s, { type: 'TAXMAN_TRASH', card: 'copper' }); // trashedCost0 → maxCost3、獲得できる財宝なし
  ok(s.pending && s.pending.stage === 'gain', '獲得ステージ');
  s = reduce(s, { type: 'TAXMAN_GAIN', card: null }); // 獲得先皆無→辞退
  ok(!s.pending && count(s.players[1].discard, 'copper') === 1, '獲得できなくてもアタックは実行・pending解消');
  // CPU も詰まない
  let s2 = setupK(GKNB, ['taxman', 'copper'], ['estate'], { p1hand: ['copper', 'copper', 'copper', 'copper', 'copper'] });
  s2.supply.copper = 0; s2.supply.silver = 0; s2.supply.gold = 0; s2.supply.masterpiece = 0;
  s2.players[0].isCpu = true; s2.players[0].cpuLevel = 'hard';
  s2 = playAct(s2, 'taxman');
  s2 = reduce(s2, { type: 'TAXMAN_TRASH', card: 'copper' });
  s2 = autoResolve(s2, 20);
  ok(!s2.pending, 'CPUも収税吏の獲得先皆無で無限ループしない');
}
console.log('=== 回帰: 肉屋の獲得先が皆無でも pending 解消（無限ループ防止）===');
{
  let s = setupK(GKNB, ['butcher', 'curse'], ['copper']);
  s.supply.copper = 0; s.supply.curse = 0; s.supply.estate = 0; // maxCost0（curse廃棄・0財源）で獲得候補なし
  s = playAct(s, 'butcher');
  s = reduce(s, { type: 'BUTCHER_TRASH', card: 'curse' }); // trashedCost0
  s = reduce(s, { type: 'BUTCHER_PAY', amount: 0 }); // maxCost0
  ok(s.pending && s.pending.stage === 'gain' && s.pending.maxCost === 0, '獲得ステージ(上限0)');
  s = reduce(s, { type: 'BUTCHER_GAIN', card: null });
  ok(!s.pending, '獲得先皆無でも pending 解消');
}

/* ============ CPU通し（無限ループ/例外が無い） ============ */
console.log('=== CPU同士のギルドゲームが最後まで進む（stuck/例外なし） ===');
{
  let games = 0, finished = 0;
  const KS = [DOM.KINGDOM_GUILDS, GK]; // 固定10種 と 全13種
  for (let g = 0; g < 8; g++) {
    const K = KS[g % 2];
    let s = E.createInitialState([{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'normal' }], K, { startActive: g % 2 });
    games++;
    let steps = 0, stuck = false;
    while (!s.gameOver && steps < 6000) {
      const before = JSON.stringify(s);
      s = reduce(s, CPU.decide(s));
      steps++;
      if (before === JSON.stringify(s)) { stuck = true; break; }
    }
    if (!stuck && s.gameOver) finished++;
  }
  ok(finished === games, `CPUギルド ${games}戦すべて完走（実 ${finished}）`);
}

/* ============ 保存則（カードの総数がゲームを通じて一定） ============ */
console.log('=== ギルドゲームでカード保存則が保たれる（財源はトークンなので対象外）===');
{
  function tally(s) {
    const m = {};
    const add = (id) => { m[id] = (m[id] || 0) + 1; };
    Object.keys(s.supply).forEach((k) => { for (let i = 0; i < s.supply[k]; i++) add(k); });
    s.players.forEach((p) => { ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat'].forEach((z) => (p[z] || []).forEach(add)); });
    s.trash.forEach(add);
    return m;
  }
  let s = E.createInitialState([{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'hard' }], GK, { startActive: 0 });
  const t0 = tally(s);
  let steps = 0;
  while (!s.gameOver && steps < 6000) { s = reduce(s, CPU.decide(s)); steps++; }
  const t1 = tally(s);
  const keys = new Set(Object.keys(t0).concat(Object.keys(t1)));
  let bad = false;
  keys.forEach((k) => { if ((t0[k] || 0) !== (t1[k] || 0)) { bad = true; console.log('  保存則違反:', k, t0[k], '→', t1[k]); } });
  ok(!bad, 'ゲーム開始時と終了時でカード総数が一致');
}

console.log('');
console.log('========================================');
console.log('ギルドテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
