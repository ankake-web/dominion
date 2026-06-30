/* 海辺（Seaside 第二版）ゲームロジックの検証（Node 単体実行）
   使い方: node test/seaside.test.js
   対象: 持続機構（次手番予約・持ち越し・捨て札化）/ マット / 追加ターン / 持続アタック・リアクション */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
let seed = 20240601;
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

// 標準の海辺王国でゲームを作る（10種そろえる）
const SEA_K = ['fishing_village', 'caravan', 'merchant_ship', 'wharf', 'lighthouse', 'haven', 'tide_pools', 'sailor', 'tactician', 'outpost'];
function mk(kingdom, players, startActive) {
  return E.createInitialState(players || ['A', 'B'], kingdom || SEA_K, { startActive: startActive == null ? 0 : startActive });
}
// 手番を終える（保留はCPUで消化→アクション終了→ターン終了→新手番の開始時保留もCPUで消化）
function endTurn(s) {
  let g = 0;
  while (s.pending && g++ < 80) s = reduce(s, CPU.decide(s));
  if (s.turn.phase === 'action') s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  g = 0;
  while (s.pending && g++ < 80) s = reduce(s, CPU.decide(s));
  return s;
}
// 席0が持続カードを使い、席0の次の手番開始まで進める。day1/delayed を観測しやすくする。
function playDurationAndAdvance(card, setupHand) {
  let s = mk(SEA_K, ['A', 'B'], 0);
  s.players[0].hand = (setupHand || []).concat([card]);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'silver', 'silver', 'silver']; // 引ける札を確保
  s = reduce(s, { type: 'PLAY_ACTION', card });
  const day1 = { coins: s.turn.coins, actions: s.turn.actions, buys: s.turn.buys, hand: s.players[0].hand.length, dur: s.players[0].durationCards.slice() };
  s = endTurn(s); // 席0→席1
  s = endTurn(s); // 席1→席0（ここで席0の持続が発火）
  return { s, day1 };
}

/* ============ 持続機構の土台 ============ */
console.log('=== 漁村: day1 +2アクション+1コイン / 次手番 +1アクション+1コイン / 持ち越し→消化後に捨て札 ===');
{
  const { s, day1 } = playDurationAndAdvance('fishing_village');
  // day1: 開始1アクション − 使用1 + 効果2 = 2アクション、+1コイン
  ok(day1.actions === 2 && day1.coins === 1, `漁村day1: アクション2/コイン1 (実 ${day1.actions}/${day1.coins})`);
  // 席0の新しい手番: 持続で +1アクション(計2: 基本1+持続1)+1コイン
  ok(s.turn.active === 0, '席0の手番に戻った');
  ok(s.turn.actions === 2 && s.turn.coins === 1, `漁村次手番: アクション2/コイン1 (実 ${s.turn.actions}/${s.turn.coins})`);
  ok(s.players[0].durationCards.includes('fishing_village'), '発火した手番中はまだ場にある');
  // この手番を終えると捨て札へ
  const s2 = endTurn(s);
  ok(count(s.players[0].durationCards, 'fishing_village') >= 0, '');
  ok(!s2.players[0].durationCards.includes('fishing_village'), '消化後の手番終了で漁村は場から消える');
  ok(s2.players[0].discard.includes('fishing_village') || s2.players[0].hand.includes('fishing_village') || s2.players[0].deck.includes('fishing_village'), '漁村は捨て札（以降の山）へ移動した');
}

console.log('=== 隊商: day1 +1カード+1アクション / 次手番 +1カード ===');
{
  const { s, day1 } = playDurationAndAdvance('caravan');
  // +1アクション（非終了）＝使用1相殺で実質1のまま
  ok(day1.actions === 1, `隊商day1: +1アクション（実質1のまま） (実 ${day1.actions})`);
  const handAtStart = s.players[0].hand.length;
  ok(handAtStart === 6, `隊商次手番: 基本5+持続1=6枚 (実 ${handAtStart})`);
}

console.log('=== 商船: day1 +2コイン / 次手番 +2コイン ===');
{
  const { s, day1 } = playDurationAndAdvance('merchant_ship');
  ok(day1.coins === 2, `商船day1: +2コイン (実 ${day1.coins})`);
  ok(s.turn.coins === 2, `商船次手番: +2コイン (実 ${s.turn.coins})`);
}

console.log('=== 船着場: day1 +2カード+1購入 / 次手番 +2カード+1購入 ===');
{
  const { s, day1 } = playDurationAndAdvance('wharf');
  ok(day1.buys === 2, `船着場day1: +1購入 (実 ${day1.buys})`);
  ok(s.players[0].hand.length === 7 && s.turn.buys === 2, `船着場次手番: 5+2=7枚 / 購入2 (実 ${s.players[0].hand.length}/${s.turn.buys})`);
}

console.log('=== 灯台: day1 +1アクション+1コイン / 次手番 +1コイン ===');
{
  const { s, day1 } = playDurationAndAdvance('lighthouse');
  // +1アクション（非終了・実質1のまま）+1コイン
  ok(day1.actions === 1 && day1.coins === 1, `灯台day1: アクション1/コイン1 (実 ${day1.actions}/${day1.coins})`);
  ok(s.turn.coins === 1, `灯台次手番: +1コイン (実 ${s.turn.coins})`);
}

console.log('=== アストロラーベ(財宝・持続): 購入フェイズで出す→このターン+1コイン+1購入 / 次手番も ===');
{
  let s = mk(SEA_K, ['A', 'B'], 0);
  s.players[0].hand = ['astrolabe', 'copper'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'astrolabe' });
  ok(s.turn.coins === 1 && s.turn.buys === 2, `アストロラーベday1: +1コイン+1購入 (実 ${s.turn.coins}/${s.turn.buys})`);
  ok(s.players[0].inPlay.includes('astrolabe'), 'アストロラーベは場に出る');
  s = endTurn(s); s = endTurn(s);
  ok(s.turn.active === 0 && s.turn.coins === 1 && s.turn.buys === 2, `アストロラーベ次手番: +1コイン+1購入 (実 ${s.turn.coins}/${s.turn.buys})`);
}

console.log('=== バザー: +1カード+2アクション+1コイン（非持続） ===');
{
  let s = mk(SEA_K.concat(['bazaar']).slice(0, 10), ['A', 'B'], 0);
  // bazaar を含む王国で
  s = mk(['bazaar', 'fishing_village', 'caravan', 'merchant_ship', 'wharf', 'lighthouse', 'haven', 'tide_pools', 'sailor', 'tactician'], ['A', 'B'], 0);
  s.players[0].hand = ['bazaar'];
  s.players[0].deck = ['copper', 'silver', 'gold', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bazaar' });
  ok(s.turn.actions === 2 && s.turn.coins === 1 && s.players[0].hand.length === 1, `バザー: +1カード+2アクション+1コイン (実 hand=${s.players[0].hand.length} act=${s.turn.actions} coin=${s.turn.coins})`);
  ok(!s.players[0].durationCards.includes('bazaar'), 'バザーは持続ではない（場に持ち越さない）');
}

// カードを使い、席0の保留をCPUで解決して返す
function playAuto(s, card) {
  s = reduce(s, { type: 'PLAY_ACTION', card });
  let g = 0;
  while (s.pending && s.pending.player === s.turn.active && g++ < 60) s = reduce(s, CPU.decide(s));
  return s;
}
function fresh(hand, deck) {
  const s = mk(SEA_K, ['A', 'B'], 0);
  s.players[0].hand = hand.slice();
  s.players[0].deck = (deck || ['copper', 'silver', 'gold', 'estate', 'copper', 'silver', 'gold', 'estate', 'copper', 'silver', 'gold', 'estate']).slice();
  return s;
}

/* ============ 対話持続・ユーティリティ・マット ============ */
console.log('=== 倉庫: +3カード+1アクション→手札3枚捨て ===');
{
  let s = fresh(['warehouse', 'copper', 'estate', 'curse']);
  s = playAuto(s, 'warehouse');
  // 3他札 +3ドロー =6 → 3捨て =3
  ok(s.players[0].hand.length === 3, `倉庫: 手札3枚 (実 ${s.players[0].hand.length})`);
  ok(!s.pending, '倉庫: 解決済み');
}

console.log('=== 停泊所: 脇置き→次手番に手札へ戻る ===');
{
  let s = fresh(['haven', 'gold', 'estate']);
  s = playAuto(s, 'haven');
  ok(s.players[0].setAside.length === 1, `停泊所: 脇置き1枚 (実 ${s.players[0].setAside.length})`);
  const stashed = s.players[0].setAside[0];
  s = endTurn(s); s = endTurn(s);
  ok(s.players[0].setAside.length === 0, '停泊所: 次手番で脇置きが空に');
  ok(s.players[0].hand.includes(stashed), '停泊所: 脇置きカードが手札に戻った');
}

console.log('=== 潮だまり: +3カード / 次手番開始時に強制2枚捨て ===');
{
  let s = fresh(['tide_pools', 'copper', 'estate']);
  s = playAuto(s, 'tide_pools'); // +3カード+1アクション
  ok(s.players[0].hand.length === 5, `潮だまりday1: 2他札+3ドロー=5 (実 ${s.players[0].hand.length})`);
  s = endTurn(s); // →席1
  // 席0の手番開始時、強制2捨て pending が立つ→CPUが解決（endTurn内で消化）
  s = endTurn(s); // 席1→席0（開始時に2捨てを消化済み）
  ok(s.turn.active === 0 && !s.pending, '潮だまり: 開始時の2枚捨てを解決して手番継続');
}

console.log('=== 策士: 手札全捨て→次手番 +5カード+1購入+1アクション ===');
{
  let s = fresh(['tactician', 'estate', 'copper'], ['copper', 'copper', 'copper', 'copper', 'copper', 'estate', 'estate', 'silver', 'silver', 'silver', 'gold', 'gold']);
  s = playAuto(s, 'tactician'); // CPUは弱い手札なので全捨て
  ok(s.players[0].hand.length === 0, `策士: 手札を全捨て (実 ${s.players[0].hand.length})`);
  s = endTurn(s); s = endTurn(s);
  ok(s.turn.active === 0, '策士: 席0の手番に戻る');
  ok(s.turn.buys === 2 && s.turn.actions === 2, `策士次手番: +1購入+1アクション (実 buys=${s.turn.buys} act=${s.turn.actions})`);
  ok(s.players[0].hand.length === 10, `策士次手番: 5(通常)+5(策士)=10枚 (実 ${s.players[0].hand.length})`);
}

console.log('=== 引揚水夫: +1購入 / 手札1枚廃棄→そのコインぶん ===');
{
  let s = fresh(['salvager', 'estate', 'gold']);
  s = playAuto(s, 'salvager');
  // estate(コスト2)を廃棄→+2コイン、+1購入
  ok(s.trash.includes('estate'), '引揚水夫: estateを廃棄');
  ok(s.turn.coins === 2 && s.turn.buys === 2, `引揚水夫: +2コイン+1購入 (実 coin=${s.turn.coins} buy=${s.turn.buys})`);
}

console.log('=== 見張り: 上3枚→1廃棄/1捨て/1を山札の上 ===');
{
  let s = fresh(['lookout'], ['curse', 'estate', 'gold', 'copper', 'copper']);
  s = playAuto(s, 'lookout');
  ok(s.trash.includes('curse'), '見張り: 最も不要(呪い)を廃棄');
  ok(s.players[0].discard.includes('estate'), '見張り: 次点(屋敷)を捨て');
  ok(s.players[0].deck[0] === 'gold', '見張り: 良い札(金貨)を山札の上に残す');
}

console.log('=== 島: 自身＋手札1枚を島マットへ。VPに数える ===');
{
  let s = fresh(['island', 'province', 'copper']);
  s = playAuto(s, 'island');
  ok(s.players[0].islandMat.includes('island'), '島: 島自身がマットへ');
  ok(s.players[0].islandMat.includes('province'), '島: 勝利点(属州)をマットへ退避');
  ok(!s.players[0].inPlay.includes('island'), '島: 場には残らない');
  // VP: island=2 + province=6 = 8（マットも数える）
  ok(E.vpOf(s.players[0]) >= 8, `島マットのVPを数える (実 ${E.vpOf(s.players[0])})`);
}

console.log('=== 原住民の村: 山札の上をマットへ / マットを手札へ ===');
{
  let s = fresh(['native_village'], ['gold', 'silver', 'copper']);
  // 1回目: マット空→set（山札の上をマットへ）
  s = playAuto(s, 'native_village');
  ok(s.players[0].nativeVillageMat.length === 1, `原住民: 山札の上1枚をマットへ (実 ${s.players[0].nativeVillageMat.length})`);
  ok(s.turn.actions === 2, `原住民: +2アクション (実 ${s.turn.actions})`);
}

/* ============ アタック・追加ターン・フック・リアクション ============ */
const KA = ['cutpurse', 'sea_witch', 'corsair', 'blockade', 'monkey', 'smugglers', 'treasury', 'outpost', 'sailor', 'pirate'];
function resolveAll(s) { let g = 0; while (s.pending && g++ < 120) s = reduce(s, CPU.decide(s)); return s; }
function playFull(s, card) { s = reduce(s, { type: 'PLAY_ACTION', card }); return resolveAll(s); }
function mkA(start) { const s = mk(KA, ['A', 'B'], start == null ? 0 : start); s.players[0].deck = ['copper', 'copper', 'copper', 'silver', 'silver', 'gold', 'estate', 'estate']; return s; }

console.log('=== 巾着切り: +2コイン / 相手が銅貨1枚を捨てる ===');
{
  let s = mkA(); s.players[0].hand = ['cutpurse']; s.players[1].hand = ['copper', 'copper', 'estate'];
  s = playFull(s, 'cutpurse');
  ok(s.turn.coins === 2, `巾着切り +2コイン (実 ${s.turn.coins})`);
  ok(count(s.players[1].discard, 'copper') === 1 && count(s.players[1].hand, 'copper') === 1, '巾着切り: 相手が銅貨1枚捨て');
}

console.log('=== 海の魔女: +2カード / 相手が呪い獲得 / 次手番 +2カード後に2捨て ===');
{
  let s = mkA(); s.players[0].hand = ['sea_witch']; s.players[1].hand = ['estate'];
  s = playFull(s, 'sea_witch');
  ok(s.players[1].discard.includes('curse'), '海の魔女: 相手が呪い獲得');
  ok(s.players[0].hand.length === 2, `海の魔女day1 +2カード (実 ${s.players[0].hand.length})`);
  s = endTurn(s); s = endTurn(s);
  ok(s.turn.active === 0 && !s.pending, '海の魔女: 次手番の+2カード→2捨てを解決');
}

console.log('=== 灯台: アタック(魔女)を無効化 ===');
{
  let s = mk(['lighthouse', 'witch', 'village', 'smithy', 'market', 'cellar', 'moat', 'remodel', 'mine', 'workshop'], ['A', 'B'], 0);
  s.players[1].durationCards = ['lighthouse'];
  s.players[0].hand = ['witch']; s.players[0].deck = ['copper', 'copper'];
  s = playFull(s, 'witch');
  ok(!s.players[1].discard.includes('curse'), '灯台: 場にある間アタックを受けない（呪いを獲得しない）');
}

console.log('=== サル: 右隣の獲得ごとに +1カード ===');
{
  let s = mkA(); s.players[0].hand = ['monkey'];
  s = playFull(s, 'monkey');
  ok(s.players[0].monkeyActive, 'サル: 窓が開く');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' }); // →席1
  s = reduce(s, { type: 'END_ACTION_PHASE' }); // 席1を購入フェイズへ
  const before = s.players[0].hand.length;
  s = reduce(s, { type: 'BUY', card: 'copper' }); // 席1が獲得
  ok(s.players[0].hand.length === before + 1, `サル: 右隣の獲得で席0 +1カード (実 ${before}→${s.players[0].hand.length})`);
}

console.log('=== 密輸人: 右隣が直前手番に獲得した6コスト以下を獲得 ===');
{
  let s = mkA(); s.players[0].hand = ['smugglers']; s.players[1].lastTurnGains = ['silver', 'gold', 'province'];
  s = playFull(s, 'smugglers');
  ok(s.players[0].discard.includes('gold'), '密輸人: 右隣の獲得(金貨)を真似て獲得（属州は6超で除外）');
}

console.log('=== 宝物庫: 勝利点未獲得なら山札の上に戻り、次手番の手札に ===');
{
  let s = mkA(); s.players[0].hand = ['treasury', 'copper']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'treasury' });
  ok(s.turn.coins === 1 && s.turn.actions === 1, '宝物庫: +1カード+1アクション+1コイン');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].hand.includes('treasury'), '宝物庫: 勝利点未獲得→山札の上に戻り次の手札へ');
}

console.log('=== 前哨地: 手札3枚の追加ターン（連鎖しない）===');
{
  let s = mkA(); s.players[0].hand = ['outpost']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'outpost' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 0 && s.turn.isExtraTurn, '前哨地: 同じプレイヤーの追加ターン');
  ok(s.players[0].hand.length === 3, `前哨地: 追加ターンの手札3枚 (実 ${s.players[0].hand.length})`);
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1, '前哨地: 追加ターン後は相手へ（連鎖しない）');
}

console.log('=== 私掠船: 相手のターン最初の銀貨/金貨を廃棄（コインは入る）===');
{
  let s = mkA(); s.players[0].hand = ['corsair'];
  s = playFull(s, 'corsair');
  ok(s.turn.coins === 2, '私掠船 +2コイン');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' }); // →席1
  s = reduce(s, { type: 'END_ACTION_PHASE' }); // 席1を購入フェイズへ
  s.players[1].hand = ['silver', 'copper'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.trash.includes('silver'), '私掠船: 相手の最初の銀貨を廃棄');
  ok(s.turn.coins === 2, '私掠船: 廃棄してもコインは入る（銀貨+2）');
}

console.log('=== 封鎖: 4コスト以下を脇に置き次手番手札へ / 相手が同名獲得で呪い ===');
{
  let s = mkA(); s.players[0].hand = ['blockade'];
  s = playFull(s, 'blockade');
  ok(s.players[0].setAside.length === 1, '封鎖: 1枚を脇に置く');
  const gained = s.players[0].setAside[0];
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' }); // →席1
  s = reduce(s, { type: 'END_ACTION_PHASE' }); // 席1を購入フェイズへ
  const before = count(s.players[1].discard, 'curse');
  s.turn.coins = 6;
  s = reduce(s, { type: 'BUY', card: gained });
  ok(count(s.players[1].discard, 'curse') > before, `封鎖: 相手が同名(${gained})獲得で呪い`);
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' }); // →席0
  ok(s.players[0].hand.includes(gained), '封鎖: 脇置きが次手番に手札へ');
}

console.log('=== 海賊(財宝・持続): 出すと次手番に6コスト以下の財宝を手札に獲得 ===');
{
  let s = mkA(); s.players[0].hand = ['pirate', 'copper'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'pirate' });
  ok(s.players[0].inPlay.includes('pirate'), '海賊: 場に出る');
  s = endTurn(s); s = endTurn(s);
  ok(s.turn.active === 0 && !s.pending, '海賊: 次手番の財宝獲得を解決');
  ok(s.players[0].hand.includes('gold'), '海賊: 6コスト以下の財宝(金貨)を手札に獲得');
}

console.log('=== 船乗り: +1アクション / 次手番 +2コイン ===');
{
  let s = mkA(); s.players[0].hand = ['sailor', 'estate'];
  s = playFull(s, 'sailor');
  ok(s.turn.actions === 1, '船乗りday1: +1アクション（実質1のまま）');
  s = endTurn(s); s = endTurn(s);
  ok(s.turn.active === 0 && s.turn.coins === 2, `船乗り次手番: +2コイン (実 ${s.turn.coins})`);
}

console.log('=== 船乗り: 獲得した持続カードを即プレイできる（このターン1度）===');
{
  let s = mk(SEA_K, ['A', 'B'], 0);
  s.players[0].hand = ['sailor'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'silver', 'silver', 'gold', 'estate', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sailor' });
  ok((s.turn.sailorPlays | 0) === 1, '船乗り: 即プレイ権を1得る');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.turn.coins = 10; s.turn.buys = 2; // 隊商($4)＋船着場($5)を買えるように
  const handBefore = s.players[0].hand.length;
  s = reduce(s, { type: 'BUY', card: 'caravan' });
  ok(s.pending && s.pending.type === 'sailor_play_gain' && s.pending.card === 'caravan', '隊商を買うと「使う?」が出る');
  s = reduce(s, { type: 'SAILOR_PLAY_GAIN', play: true });
  ok(!s.pending, '解決後は pending なし');
  ok(s.players[0].inPlay.includes('caravan'), '隊商が即プレイで場に出る');
  ok(count(s.players[0].discard, 'caravan') === 0, '隊商は捨て札に残らない');
  ok(s.players[0].hand.length === handBefore + 1, '隊商の +1カードが入る');
  ok((s.turn.sailorPlays | 0) === 0, '即プレイ権は使い切る（このターン1度）');
  s = reduce(s, { type: 'BUY', card: 'wharf' });
  ok(!s.pending, '2枚目の持続を買っても確認は出ない（1度きり）');
  s = endTurn(s); s = endTurn(s); // 席0→席1→席0（即プレイした隊商と船乗りの持続が発火）
  ok(s.turn.active === 0 && s.turn.coins === 2, `次手番: 船乗りの +2コイン (実 ${s.turn.coins})`);
  ok(s.players[0].durationCards.includes('caravan'), '即プレイした隊商が持続として持ち越す');
}

console.log('=== 船乗り: 即プレイを断れる / 持続でないカードでは出ない ===');
{
  let s = mk(SEA_K, ['A', 'B'], 0);
  s.players[0].hand = ['sailor'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'silver', 'silver', 'gold', 'estate', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sailor' });
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.turn.coins = 10; s.turn.buys = 2;
  // 持続でない銀貨を買っても確認は出ない
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(!s.pending, '財宝（非持続）では確認が出ない');
  ok((s.turn.sailorPlays | 0) === 1, '非持続では即プレイ権を消費しない');
  // 持続を買って「使わない」を選ぶ
  s = reduce(s, { type: 'BUY', card: 'caravan' });
  ok(s.pending && s.pending.type === 'sailor_play_gain', '持続では確認が出る');
  s = reduce(s, { type: 'SAILOR_PLAY_GAIN', play: false });
  ok(!s.pending, '「使わない」で解決');
  ok(count(s.players[0].discard, 'caravan') === 1, '使わない場合は捨て札に残る');
  ok(!s.players[0].inPlay.includes('caravan'), '使わない場合は場に出ない');
}

console.log('=== CPU対CPU: 海辺の王国で最後まで止まらず終局する ===');
{
  const K = ['lighthouse', 'fishing_village', 'wharf', 'merchant_ship', 'sea_witch', 'corsair', 'blockade', 'island', 'native_village', 'tactician'];
  let s = E.createInitialState([{ name: 'C1', isCpu: true, level: 'normal' }, { name: 'C2', isCpu: true, level: 'normal' }], K, { startActive: 0 });
  let guard = 0;
  while (!s.gameOver && guard++ < 4000) s = reduce(s, CPU.decide(s));
  ok(s.gameOver, `CPU対CPル: 海辺王国で終局した (手数 ${guard})`);
  ok(Object.values(s.supply).every((n) => n >= 0), 'CPU対CPU: 在庫が負にならない');
}

console.log('\n========================================');
console.log('海辺テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
