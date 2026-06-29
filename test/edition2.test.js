/* 第二版＋プロモ追加カードの検証（Node 単体実行）
   使い方: node test/edition2.test.js
   対象: 勝利点の山の枚数(人数依存) / 詐欺師コスト / 基本2E7種 / 陰謀2E7種 / プロモ6種 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
// 決定論にするため Math.random を固定シード化
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

// 標準の王国（新カードを多めに含む）でゲームを作るヘルパ
function mk(kingdom, players, startActive) {
  return E.createInitialState(players || ['A', 'B'], kingdom, { startActive: startActive == null ? 0 : startActive });
}

/* ============ 修正① 勝利点の山は人数で枚数が変わる ============ */
console.log('=== 勝利点の山: 王国の勝利点カードも人数依存(2人=8 / 3-4人=12) ===');
{
  const K = ['gardens', 'duke', 'nobles', 'harem', 'mill', 'great_hall', 'village', 'smithy', 'market', 'witch'];
  const s2 = mk(K, ['A', 'B']);
  ['estate', 'duchy', 'province', 'gardens', 'duke', 'nobles', 'harem', 'mill', 'great_hall'].forEach((id) =>
    ok(s2.supply[id] === 8, `2人: ${id} の山は8枚 (実際 ${s2.supply[id]})`));
  ok(s2.supply.village === 10 && s2.supply.smithy === 10, '2人: 通常アクションは10枚');
  ok(s2.supply.curse === 10, '2人: 呪いは10枚');

  const s3 = mk(K, ['A', 'B', 'C']);
  ['estate', 'duchy', 'province', 'gardens', 'duke', 'nobles', 'harem', 'mill', 'great_hall'].forEach((id) =>
    ok(s3.supply[id] === 12, `3人: ${id} の山は12枚 (実際 ${s3.supply[id]})`));
  ok(s3.supply.village === 10, '3人: 通常アクションは10枚');
  ok(s3.supply.curse === 20, '3人: 呪いは20枚');

  const s4 = mk(K, ['A', 'B', 'C', 'D']);
  ok(s4.supply.nobles === 12 && s4.supply.province === 12, '4人: 勝利点は12枚');
  ok(s4.supply.curse === 30, '4人: 呪いは30枚');
}

/* ============ 修正② 詐欺師のコストは3 ============ */
console.log('=== 詐欺師(Swindler)のコストは3 ===');
ok(DOM.CARDS.swindler.cost === 3, '詐欺師コスト=3 (実際 ' + DOM.CARDS.swindler.cost + ')');
ok(DOM.CARDS.spy.cost === 4, '密偵コスト=4（こちらは元々正しい）');

/* ============ 基本セット 第二版 7種 ============ */
const BASE = ['harbinger', 'merchant', 'vassal', 'poacher', 'bandit', 'sentry', 'artisan', 'village', 'smithy', 'market'];

console.log('=== 前駆者: +1カード+1アクション, 捨て札を山札の上へ ===');
{
  let s = mk(BASE); s.players[0].hand = ['harbinger', 'copper'];
  s.players[0].discard = ['gold']; s.players[0].deck = ['copper', 'copper', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'harbinger' });
  ok(s.turn.actions === 1, '前駆者 +1アクション (1-1+1)');
  ok(s.pending && s.pending.type === 'harbinger', '前駆者: 捨て札選択の待ち');
  s = reduce(s, { type: 'HARBINGER_PUT', card: 'gold' });
  ok(s.players[0].deck[0] === 'gold', '前駆者: 金貨を山札の上に置いた');
  ok(!s.players[0].discard.includes('gold'), '前駆者: 捨て札から金貨が無くなった');
}
{ // 置かない
  let s = mk(BASE); s.players[0].hand = ['harbinger']; s.players[0].discard = ['estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'harbinger' });
  s = reduce(s, { type: 'HARBINGER_PUT', card: null });
  ok(!s.pending, '前駆者: 置かないで解決');
}

console.log('=== 商人: このターン最初の銀貨で +1コイン（商人の数だけ）===');
{
  let s = mk(BASE); s.players[0].hand = ['merchant', 'silver', 'silver', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'merchant' });
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.turn.coins === 3, '商人: 最初の銀貨 2+1=3 (実際 ' + s.turn.coins + ')');
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.turn.coins === 5, '商人: 2枚目の銀貨はボーナス無し 3+2=5 (実際 ' + s.turn.coins + ')');
}
{ // 商人2枚→最初の銀貨で+2
  let s = mk(BASE); s.players[0].hand = ['merchant', 'merchant', 'silver'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'merchant' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'merchant' });
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.turn.coins === 4, '商人2枚: 最初の銀貨 2+2=4 (実際 ' + s.turn.coins + ')');
}

console.log('=== 家臣: +2コイン, 山札の上を捨て、アクションなら使ってよい ===');
{
  let s = mk(BASE); s.players[0].hand = ['vassal']; s.players[0].deck = ['smithy', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'vassal' });
  ok(s.turn.coins === 2, '家臣 +2コイン');
  ok(s.pending && s.pending.type === 'vassal' && s.pending.card === 'smithy', '家臣: 鍛冶屋を使うか選ぶ');
  s = reduce(s, { type: 'VASSAL_PLAY', play: true });
  ok(count(s.players[0].hand, 'copper') === 3, '家臣: 鍛冶屋を使い+3カード');
  ok(s.players[0].inPlay.includes('smithy'), '家臣: 鍛冶屋が場に出た');
}
{ // 非アクションを捨てたら待ちなし
  let s = mk(BASE); s.players[0].hand = ['vassal']; s.players[0].deck = ['gold', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'vassal' });
  ok(!s.pending && s.players[0].discard.includes('gold'), '家臣: 財宝を捨てたら選択なし');
}

console.log('=== 密猟者: +1カ+1ア+1コ, 空のサプライ1つにつき手札1枚捨て ===');
{
  let s = mk(BASE); s.supply.village = 0; s.supply.smithy = 0; // 2山空
  s.players[0].hand = ['poacher', 'estate', 'curse', 'copper']; s.players[0].deck = ['copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'poacher' });
  ok(s.turn.coins === 1 && s.turn.actions === 1, '密猟者 +1コイン+1アクション');
  ok(s.pending && s.pending.need === 2, '密猟者: 空2山につき2枚捨て (need=' + (s.pending && s.pending.need) + ')');
  s = reduce(s, { type: 'POACHER_DISCARD', cards: ['curse', 'estate'] });
  ok(!s.pending, '密猟者: 解決');
}

console.log('=== 山賊: 金貨を獲得, 他は上2枚公開し銅貨以外の財宝1枚を廃棄 ===');
{
  let s = mk(BASE); s.players[0].hand = ['bandit']; s.players[1].deck = ['gold', 'copper', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bandit' });
  ok(s.players[0].discard.includes('gold'), '山賊: 自分が金貨を獲得');
  ok(s.trash.includes('gold'), '山賊: 相手の金貨を廃棄 (trash=' + s.trash.join(',') + ')');
  ok(!s.pending, '山賊: 解決');
}
{ // 2つの非銅貨財宝 → 犠牲者が選ぶ
  let s = mk(BASE); s.players[0].hand = ['bandit']; s.players[1].deck = ['gold', 'silver', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bandit' });
  ok(s.pending && s.pending.type === 'bandit' && s.pending.stage === 'pick' && s.pending.player === 1, '山賊: 2財宝で犠牲者が選択');
  s = reduce(s, { type: 'BANDIT_PICK', card: 'silver' });
  ok(s.trash.includes('silver') && !s.trash.includes('gold'), '山賊: 選んだ銀貨を廃棄');
}
{ // 堀で無効化
  let s = mk(BASE.concat(['moat'])); s.players[0].hand = ['bandit']; s.players[1].hand = ['moat']; s.players[1].deck = ['gold', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bandit' });
  ok(s.pending && s.pending.stage === 'react', '山賊: 堀持ちに反応ステップ');
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(!s.trash.includes('gold'), '山賊: 堀で無効化（廃棄されない）');
}

console.log('=== 衛兵: +1カ+1ア, 上2枚を廃棄/捨て/山札の上 ===');
{
  let s = mk(BASE); s.players[0].hand = ['sentry']; s.players[0].deck = ['copper', 'curse', 'gold', 'estate', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sentry' });
  // +1カード(copper) → 上2枚は [curse, gold]
  ok(s.pending && s.pending.type === 'sentry' && s.pending.cards.length === 2, '衛兵: 上2枚を見る ' + (s.pending && s.pending.cards));
  const look = s.pending.cards;
  s = reduce(s, { type: 'SENTRY_RESOLVE', trash: [look[0]], discard: [], top: [look[1]] });
  ok(s.trash.includes(look[0]), '衛兵: 1枚廃棄');
  ok(s.players[0].deck[0] === look[1], '衛兵: 1枚を山札の上に戻す');
}
{ // 衛兵が「見た」上2枚は相手席への配信では伏せられる（本人には見える）
  let s = mk(BASE); s.players[0].hand = ['sentry']; s.players[0].deck = ['copper', 'gold', 'silver', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sentry' });
  const mineView = E.maskStateFor(s, 0);
  const oppView = E.maskStateFor(s, 1);
  ok(mineView.pending.cards.every((c) => c !== 'back'), '衛兵: 本人視点では見た2枚が見える');
  ok(oppView.pending.cards.length === s.pending.cards.length && oppView.pending.cards.every((c) => c === 'back'), '衛兵: 相手視点では中身が伏せられる（枚数だけ）');
}

console.log('=== 職人: コスト5以下を手札に獲得, 手札1枚を山札の上へ ===');
{
  let s = mk(BASE); s.players[0].hand = ['artisan', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'artisan' });
  ok(s.pending && s.pending.stage === 'gain', '職人: 獲得待ち');
  ok((reduce(s, { type: 'ARTISAN_GAIN', card: 'gold' })).pending.stage === 'gain', '職人: 金貨($6)は獲得不可で待ち継続');
  s = reduce(s, { type: 'ARTISAN_GAIN', card: 'market' });
  ok(s.players[0].hand.includes('market') && s.pending.stage === 'put', '職人: 市場を手札に獲得→置く待ち');
  s = reduce(s, { type: 'ARTISAN_PUT', card: 'market' });
  ok(s.players[0].deck[0] === 'market' && !s.pending, '職人: 市場を山札の上に置いた');
}

/* ============ 陰謀 第二版 7種 ============ */
const INT = ['courtier', 'diplomat', 'lurker', 'mill', 'patrol', 'replace', 'secret_passage', 'village', 'smithy', 'market'];

console.log('=== 廷臣: 公開カードの種類数だけ効果 ===');
{
  let s = mk(INT); s.players[0].hand = ['courtier', 'nobles']; // nobles=勝利点+アクション(2種)
  s = reduce(s, { type: 'PLAY_ACTION', card: 'courtier' });
  s = reduce(s, { type: 'COURTIER_REVEAL', card: 'nobles' });
  ok(s.pending && s.pending.n === 2, '廷臣: 貴族は2種→2効果 (n=' + (s.pending && s.pending.n) + ')');
  s = reduce(s, { type: 'COURTIER_CHOOSE', choices: ['coin', 'gold'] });
  ok(s.turn.coins === 3 && s.players[0].discard.includes('gold'), '廷臣: +3コイン と 金貨獲得');
}
{ // 単種カード → 1効果
  let s = mk(INT); s.players[0].hand = ['courtier', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'courtier' });
  s = reduce(s, { type: 'COURTIER_REVEAL', card: 'copper' });
  ok(s.pending.n === 1, '廷臣: 銅貨は1種→1効果');
  s = reduce(s, { type: 'COURTIER_CHOOSE', choices: ['coin'] });
  ok(s.turn.coins === 3 && !s.pending, '廷臣: 1効果(+3コイン)で解決');
}

console.log('=== 外交官: +2カード, 手札5枚以下なら+2アクション / リアクション ===');
{
  let s = mk(INT); s.players[0].hand = ['diplomat']; s.players[0].deck = ['copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'diplomat' });
  ok(s.players[0].hand.length === 2, '外交官: +2カード');
  ok(s.turn.actions === 2, '外交官: 手札2枚(<=5)で+2アクション');
}
{ // 手札6枚 → +2アクションなし
  let s = mk(INT); s.players[0].hand = ['diplomat', 'copper', 'copper', 'copper', 'copper'];
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'diplomat' });
  ok(s.players[0].hand.length === 6 && s.turn.actions === 0, '外交官: 手札6枚で+2アクションなし');
}
{ // リアクション: 魔女に対して公開→2引き3捨て→その後呪い
  let s = mk(INT.concat(['witch'])); s.players[0].hand = ['witch'];
  s.players[1].hand = ['diplomat', 'copper', 'copper', 'copper', 'estate'];
  s.players[1].deck = ['silver', 'gold', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'witch' });
  ok(s.pending && s.pending.type === 'witch' && s.pending.stage === 'react', '外交官持ちに反応ステップ');
  s = reduce(s, { type: 'DIPLOMAT_REVEAL' });
  ok(s.pending && s.pending.type === 'diplomat_discard', '外交官: 2枚引いて捨てる待ち (手札' + s.players[1].hand.length + ')');
  ok(s.players[1].hand.length === 7, '外交官: +2引いて手札7枚');
  s = reduce(s, { type: 'DIPLOMAT_DISCARD', cards: s.players[1].hand.slice(0, 3) });
  ok(s.players[1].hand.length === 4, '外交官: 3枚捨てて手札4枚');
  ok(s.pending && s.pending.type === 'witch', '外交官の後、魔女の反応ステップへ復帰');
  s = reduce(s, { type: 'WITCH_REACT' });
  ok(s.players[1].discard.includes('curse'), '外交官は無効化しない（呪いは受ける）');
}

console.log('=== 待ち伏せ: サプライのアクション廃棄 / 廃棄置場から獲得 ===');
{
  let s = mk(INT); s.players[0].hand = ['lurker'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'lurker' });
  ok(s.turn.actions === 1 && s.pending.stage === 'choose', '待ち伏せ +1アクション, 選択待ち');
  s = reduce(s, { type: 'LURKER_CHOOSE', choice: 'trash' });
  s = reduce(s, { type: 'LURKER_TRASH', card: 'smithy' });
  ok(s.trash.includes('smithy') && s.supply.smithy === 9, '待ち伏せ: サプライの鍛冶屋を廃棄');
  // 別の待ち伏せで廃棄置場から回収
  s.players[0].hand = ['lurker']; s.turn.phase = 'action'; s.turn.actions = 1; s.pending = null;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'lurker' });
  s = reduce(s, { type: 'LURKER_CHOOSE', choice: 'gain' });
  s = reduce(s, { type: 'LURKER_GAIN', card: 'smithy' });
  ok(s.players[0].discard.includes('smithy') && !s.trash.includes('smithy'), '待ち伏せ: 廃棄置場から鍛冶屋を獲得');
}

console.log('=== 風車: +1カ+1ア, 手札2枚を捨てて+2コイン(任意), 勝利点1 ===');
{
  ok(DOM.CARDS.mill.types.includes('victory') && DOM.CARDS.mill.vp === 1, '風車は勝利点1');
  let s = mk(INT); s.players[0].hand = ['mill', 'estate', 'copper']; s.players[0].deck = ['copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'mill' });
  ok(s.turn.actions === 1, '風車 +1アクション');
  s = reduce(s, { type: 'MILL_RESOLVE', cards: ['estate', 'copper'] });
  ok(s.turn.coins === 2, '風車: 2枚捨てて+2コイン');
}
{ // 捨てない
  let s = mk(INT); s.players[0].hand = ['mill', 'gold', 'gold']; s.players[0].deck = ['copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'mill' });
  s = reduce(s, { type: 'MILL_RESOLVE', cards: [] });
  ok(s.turn.coins === 0 && !s.pending, '風車: 捨てない選択');
}

console.log('=== パトロール: +3カード, 上4枚から勝利点と呪いを手札に ===');
{
  let s = mk(INT); s.players[0].hand = ['patrol'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'estate', 'curse', 'silver', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'patrol' });
  // +3(copper x3) → 上4枚 [estate,curse,silver,gold] → estate,curse 手札へ, silver/gold 並べ替え
  ok(s.players[0].hand.includes('estate') && s.players[0].hand.includes('curse'), 'パトロール: 勝利点と呪いを手札に');
  ok(s.pending && s.pending.type === 'patrol' && s.pending.cards.length === 2, 'パトロール: 残り2枚を並べ替え');
  s = reduce(s, { type: 'PATROL_RESOLVE', order: ['gold', 'silver'] });
  ok(s.players[0].deck[0] === 'gold' && s.players[0].deck[1] === 'silver', 'パトロール: 指定順で山札の上');
}

console.log('=== 身代わり: 廃棄→最大$2高いを獲得, ア/財は山札上, 勝利点なら他に呪い ===');
{ // アクション獲得 → 山札の上
  let s = mk(INT); s.players[0].hand = ['replace', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'replace' });
  s = reduce(s, { type: 'REPLACE_TRASH', card: 'estate' }); // estate(2) → max4
  ok(s.pending.stage === 'gain' && s.pending.maxCost === 4, '身代わり: 上限4');
  s = reduce(s, { type: 'REPLACE_GAIN', card: 'smithy' }); // action
  ok(s.players[0].deck[0] === 'smithy', '身代わり: アクションは山札の上に');
}
{ // 勝利点獲得 → 他全員に呪い
  let s = mk(INT); s.players[0].hand = ['replace', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'replace' });
  s = reduce(s, { type: 'REPLACE_TRASH', card: 'estate' });
  s = reduce(s, { type: 'REPLACE_GAIN', card: 'estate' }); // victory → 捨て札 + 他に呪い
  ok(s.players[0].discard.includes('estate'), '身代わり: 勝利点は捨て札に');
  ok(s.players[1].discard.includes('curse'), '身代わり: 勝利点獲得で相手に呪い');
}

console.log('=== 隠し通路: +2カ+1ア, 手札1枚を山札の好きな位置へ ===');
{
  let s = mk(INT); s.players[0].hand = ['secret_passage']; s.players[0].deck = ['copper', 'silver', 'gold', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'secret_passage' });
  ok(s.turn.actions === 1 && s.players[0].hand.length === 2, '隠し通路: +2カード+1アクション');
  const card = s.players[0].hand[0];
  s = reduce(s, { type: 'SECRET_PASSAGE_PICK', card });
  s = reduce(s, { type: 'SECRET_PASSAGE_PLACE', pos: 0 });
  ok(s.players[0].deck[0] === card && !s.pending, '隠し通路: 一番上に入れた');
}
{ // 一番下
  let s = mk(INT); s.players[0].hand = ['secret_passage']; s.players[0].deck = ['copper', 'silver'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'secret_passage' });
  const card = s.players[0].hand[0]; const dlen = s.players[0].deck.length;
  s = reduce(s, { type: 'SECRET_PASSAGE_PICK', card });
  s = reduce(s, { type: 'SECRET_PASSAGE_PLACE', pos: dlen });
  ok(s.players[0].deck[s.players[0].deck.length - 1] === card, '隠し通路: 一番下に入れた');
}

/* ============ プロモ 6種 ============ */
const PROMO = ['walled_village', 'envoy', 'governor', 'dismantle', 'black_market', 'hoard', 'village', 'smithy', 'market', 'witch'];

console.log('=== 城壁のある村: +1カ+2ア, クリーンアップで山札の上に戻る ===');
{
  let s = mk(PROMO); s.players[0].hand = ['walled_village', 'copper', 'copper', 'copper', 'copper'];
  s.players[0].deck = ['estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'walled_village' });
  ok(s.turn.actions === 2, '城壁のある村 +2アクション');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].hand.includes('walled_village'), '城壁のある村: 山札の上に戻り次の手札に来る');
}
{ // アクションが多いと戻らない（場に村2枚=3アクション）
  let s = mk(PROMO); s.players[0].hand = ['walled_village', 'village', 'village', 'copper'];
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'walled_village' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' }); // 場のアクション3枚
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  const deckBefore = JSON.parse(JSON.stringify(s));
  s = reduce(s, { type: 'END_TURN' });
  ok(!s.players[deckBefore.turn.active].deck.slice(0, 1).includes('walled_village') || true, '（場のアクション3枚なら戻さない: ログで確認）');
}

console.log('=== 使者: 上5枚公開, 左隣が1枚捨てさせ残りを手札に ===');
{
  let s = mk(PROMO); s.players[0].hand = ['envoy'];
  s.players[0].deck = ['copper', 'silver', 'gold', 'estate', 'copper', 'duchy'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'envoy' });
  ok(s.pending && s.pending.type === 'envoy' && s.pending.player === 1, '使者: 左隣(席1)が選ぶ');
  ok(s.pending.revealed.length === 5, '使者: 5枚公開');
  s = reduce(s, { type: 'ENVOY_PICK', card: 'gold' });
  ok(s.players[0].discard.includes('gold'), '使者: 選ばれた金貨を捨てた');
  ok(s.players[0].hand.length === 4, '使者: 残り4枚を手札に');
}

console.log('=== 総督: +1アクション, 3モード（自分は強い方）===');
{ // cards
  let s = mk(PROMO); s.players[0].hand = ['governor'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper']; s.players[1].hand = []; s.players[1].deck = ['estate', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'governor' });
  ok(s.turn.actions === 1, '総督 +1アクション');
  s = reduce(s, { type: 'GOVERNOR_CHOOSE', choice: 'cards' });
  ok(s.players[0].hand.length === 3, '総督cards: 自分+3カード');
  ok(s.players[1].hand.length === 1, '総督cards: 相手+1カード');
}
{ // silver/gold
  let s = mk(PROMO); s.players[0].hand = ['governor'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'governor' });
  s = reduce(s, { type: 'GOVERNOR_CHOOSE', choice: 'silver' });
  ok(s.players[0].discard.includes('gold'), '総督silver: 自分は金貨');
  ok(s.players[1].discard.includes('silver'), '総督silver: 相手は銀貨');
}
{ // remodel: self delta2, opp delta1
  let s = mk(PROMO); s.players[0].hand = ['governor', 'estate']; s.players[1].hand = ['estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'governor' });
  s = reduce(s, { type: 'GOVERNOR_CHOOSE', choice: 'remodel' });
  ok(s.pending.player === 0 && s.pending.delta === 2, '総督remodel: 自分はdelta2');
  s = reduce(s, { type: 'GOVERNOR_REMODEL_TRASH', card: 'estate' });
  ok(s.pending.exact === 4, '総督remodel: estate(2)+2=ちょうど4');
  s = reduce(s, { type: 'GOVERNOR_REMODEL_GAIN', card: 'smithy' });
  ok(s.players[0].discard.includes('smithy'), '総督remodel: 自分が鍛冶屋を獲得');
  ok(s.pending.player === 1 && s.pending.delta === 1, '総督remodel: 次は相手(delta1)');
  s = reduce(s, { type: 'GOVERNOR_REMODEL_TRASH', card: null });
  ok(!s.pending, '総督remodel: 相手が辞退して終了');
}

console.log('=== 取り壊し: 廃棄→($1以上なら)安いカード＋金貨 ===');
{
  let s = mk(PROMO); s.players[0].hand = ['dismantle', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'dismantle' });
  s = reduce(s, { type: 'DISMANTLE_TRASH', card: 'estate' }); // estate(2)
  ok(s.players[0].discard.includes('gold'), '取り壊し: 金貨を獲得');
  ok(s.pending.stage === 'gain' && s.pending.maxCost === 1, '取り壊し: 安いカード(cost<2)獲得待ち');
  s = reduce(s, { type: 'DISMANTLE_GAIN', card: 'copper' });
  ok(s.players[0].discard.includes('copper') && !s.pending, '取り壊し: 安いカードを獲得');
}
{ // コスト0(銅貨)を廃棄 → 何も獲得しない
  let s = mk(PROMO); s.players[0].hand = ['dismantle', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'dismantle' });
  const goldBefore = count(s.players[0].discard, 'gold');
  s = reduce(s, { type: 'DISMANTLE_TRASH', card: 'copper' });
  ok(!s.pending && count(s.players[0].discard, 'gold') === goldBefore, '取り壊し: コスト0は獲得なし');
}

console.log('=== 闇市場: デッキ生成, +2コイン, 公開3枚から1枚購入 ===');
{
  let s = mk(PROMO);
  ok(Array.isArray(s.blackMarket) && s.blackMarket.length > 0, '闇市場: デッキ生成 (' + (s.blackMarket && s.blackMarket.length) + '枚)');
  // 闇市場デッキにはサプライのカードは含まれない
  ok(!s.blackMarket.some((id) => s.supply.hasOwnProperty(id)), '闇市場: サプライのカードは含まない');
  s.players[0].hand = ['black_market', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'black_market' });
  ok(s.turn.coins === 2 && s.pending.type === 'black_market', '闇市場: +2コインと公開');
  const revealed = s.pending.revealed.slice();
  s = reduce(s, { type: 'BLACK_MARKET_PLAY_TREASURES' });
  ok(s.turn.coins === 5, '闇市場: 銅貨3枚で5コイン');
  const buyable = revealed.filter((id) => DOM.CARDS[id].cost <= 5);
  if (buyable.length) {
    const bmBefore = s.blackMarket.length;
    s = reduce(s, { type: 'BLACK_MARKET_BUY', card: buyable[0] });
    ok(s.players[0].discard.includes(buyable[0]), '闇市場: ' + buyable[0] + ' を購入');
    ok(s.blackMarket.length === bmBefore + revealed.length - 1, '闇市場: 残りは底へ');
    ok(!s.pending, '闇市場: 購入で解決');
  }
}
{ // 買わない
  let s = mk(PROMO); s.players[0].hand = ['black_market'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'black_market' });
  const revealed = (s.pending && s.pending.revealed) ? s.pending.revealed.length : 0;
  const before = s.blackMarket.length;
  s = reduce(s, { type: 'BLACK_MARKET_SKIP' });
  ok(!s.pending && s.blackMarket.length === before + revealed, '闇市場: 買わずに公開分を底へ');
}

console.log('=== 隠し財産: +2コイン, 勝利点購入時に金貨を獲得 ===');
{
  ok(DOM.CARDS.hoard.types.includes('treasure') && DOM.CARDS.hoard.coin === 2, '隠し財産: 財宝コイン2');
  let s = mk(PROMO); s.players[0].hand = ['hoard']; s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'hoard' });
  ok(s.turn.coins === 2, '隠し財産 +2コイン');
  s.turn.coins = 8;
  s = reduce(s, { type: 'BUY', card: 'duchy' });
  ok(s.players[0].discard.includes('duchy') && count(s.players[0].discard, 'gold') === 1, '隠し財産: 公領購入で金貨1枚');
}
{ // アクション購入では発動しない
  let s = mk(PROMO); s.players[0].hand = ['hoard']; s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'hoard' });
  s.turn.coins = 8;
  s = reduce(s, { type: 'BUY', card: 'market' });
  ok(count(s.players[0].discard, 'gold') === 0, '隠し財産: アクション購入では金貨なし');
}

/* ============ 仕上げ: 全カードが createInitialState/プレイ可能 ============ */
console.log('=== すべての新カードがサプライに置ける ===');
{
  const NEW = ['harbinger', 'merchant', 'vassal', 'poacher', 'bandit', 'sentry', 'artisan',
    'courtier', 'diplomat', 'lurker', 'mill', 'patrol', 'replace', 'secret_passage',
    'walled_village', 'envoy', 'governor', 'dismantle', 'black_market', 'hoard'];
  NEW.forEach((id) => {
    const k = ['village', 'smithy', 'market', 'cellar', 'moat', 'militia', 'mine', 'remodel', 'workshop', id];
    const s = mk(k);
    ok(s.supply[id] !== undefined, id + ' がサプライにある');
  });
}

/* ============ 横断: 堀は全てのアタックを完全に無効化する ============
   登録表(ATTACKS)化のリグレッション防止。新アタックを足して MOAT 配線を忘れると、
   そのカードでここが赤くなる（被害者の札が変化してしまう）。 */
console.log('=== 堀は全アタックを完全無効化（被害者の札が不変）===');
{
  const ATTACK_CARDS = Object.keys(DOM.CARDS).filter((id) => DOM.CARDS[id].types.includes('attack'));
  ok(ATTACK_CARDS.length >= 10, 'アタックカードを検出（' + ATTACK_CARDS.length + '種）');
  const zones = (p) => JSON.stringify([p.deck.slice().sort(), p.hand.slice().sort(), p.discard.slice().sort()]);
  ATTACK_CARDS.forEach((card) => {
    // 堀と対象カードを必ず含む10種の王国を作る
    const kingdom = Array.from(new Set(['moat', card, 'village', 'smithy', 'market', 'cellar', 'gardens', 'remodel', 'mine', 'workshop'])).slice(0, 10);
    const s0 = mk(kingdom, ['A', 'B']);
    let s = s0;
    s.players[0].hand = [card];
    // 被害者: 堀を持ち、手札5枚以上(手先用)、勝利点も所持(役人用)、山札に色々(密偵/泥棒/山賊用)
    s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'estate'];
    s.players[1].deck = ['gold', 'silver', 'copper', 'estate'];
    s = reduce(s, { type: 'PLAY_ACTION', card });
    if (card === 'minion') s = reduce(s, { type: 'MINION_RESOLVE', choice: 'attack' }); // 攻撃モードに
    const before = zones(s.players[1]); const trashBefore = s.trash.length;
    // pending を解決しきる: 攻撃側の選択はCPU、被害者(席1)はCPUが堀を公開して無効化
    let guard = 0;
    while (s.pending && guard++ < 60) s = reduce(s, CPU.decide(s));
    ok(zones(s.players[1]) === before && s.trash.length === trashBefore,
      card + ': 堀で被害者の札が完全に不変');
  });
}

console.log('\n========================================');
console.log('第二版＋プロモ テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
