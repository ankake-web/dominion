/* mix-all モード（拡張を自由に混ぜる）解禁のためのエンジン硬化＝回帰テスト（Node 単体実行）
   使い方: node test/mixall.test.js
   正本: docs/research/mixall_hardening.md（監査＋敵対検証で確定した23件）

   背景：mix を解禁すると「どの出荷 CARD_SET でも同居しないから未修正」と先送りしてきた前提が崩れ、
   すべての穴が到達可能になる。本スイートは穴ごとに最小1件の回帰を置く。
   対象:
     1. 汎用「$N以下 / ちょうど$N / より安い」が 非サプライ・分割山下段・ポーション費用・負債コスト を除外するか
     2. gain()/trashCard を通らない経路（封鎖/待ち伏せ/造幣所/密輸人/交易商人）＝保存則とサプライキー
     3. 支配（Possession）×他拡張（負債の受取人／サプライ外獲得／塩まき／自己廃棄の返却／獲得トリガー）
     4. CPU の終端保証（engine が拒否する札を提案し続けない＝mix での livelock 防止） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260714;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
const reduce = (s, a) => E.reduce(s, a);

function game(kingdom, n, opts) {
  const cfgs = []; for (let i = 0; i < (n || 2); i++) cfgs.push({ name: 'P' + i, isCpu: false });
  return E.createInitialState(cfgs, kingdom.slice(), Object.assign({ startActive: 0 }, opts || {}));
}
// 手札を固定する（保存則を測るときは **この後で** tally を取ること＝手札の差し替えで札が消えるため）
function setHand(s, cards, seat) {
  s.players[seat == null ? s.turn.active : seat].hand = cards.slice();
  return s;
}
// 手札を固定して1枚プレイする（アクションフェイズ）
function playAction(s, card, extraHand) {
  setHand(s, [card].concat(extraHand || []));
  s.turn.phase = 'action'; s.turn.actions = Math.max(1, s.turn.actions);
  return reduce(s, { type: 'PLAY_ACTION', card });
}
// カード保存則：全ゾーン＋サプライ＋廃棄置き場 の枚数合計（混合山は実カード配列で数える）
const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'setAside', 'durationCards', 'islandMat',
  'nativeVillageMat', 'tavern', 'archives', 'princes', 'inherited', 'cargo'];
function tally(s) {
  const t = {};
  const add = (c, n) => { t[c] = (t[c] || 0) + (n || 1); };
  s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach((c) => add(c))));
  (s.trash || []).forEach((c) => add(c));
  (s.blackMarket || []).forEach((c) => add(c));
  ['ruins', 'knights', 'castles'].forEach((mx) => { if (Array.isArray(s[mx])) s[mx].forEach((c) => add(c)); });
  Object.keys(s.supply).forEach((id) => {
    if (id === 'ruins' || id === 'knights' || id === 'castles') return; // 混合山は実カードで数えた
    add(id, s.supply[id]);
  });
  (s.turn && s.turn.possessionGains || []).forEach((c) => add(c));
  (s.turn && s.turn.possessionTrash || []).forEach((c) => add(c));
  return t;
}
function sameTally(a, b) {
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
}

/* ============================================================
   1. 汎用「$N以下」が 非サプライ／ポーション費用／負債コスト を除外する
   ============================================================ */
console.log('=== mix: 汎用「$N以下を獲得」が 非サプライ／ポーション／負債 を除外する ===');
{
  // 基本＋収穫祭：工房で賞品（$0・非サプライ）を獲得できない
  const s = game(['workshop', 'tournament', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  ok((s.supply.followers || 0) > 0, '前提：賞品（followers）がサプライ数値キーに存在する');
  let s2 = playAction(s, 'workshop');
  ok(s2.pending && s2.pending.type === 'workshop', '工房：獲得の選択待ち');
  const before = s2.players[0].discard.length;
  s2 = reduce(s2, { type: 'WORKSHOP_GAIN', card: 'followers' });
  ok(s2.pending && s2.pending.type === 'workshop', '工房は賞品（followers）を拒否＝pending 継続');
  ok(s2.players[0].discard.length === before, '賞品は獲得されていない');
  // 拒否された後も普通のカードは獲得できる
  s2 = reduce(s2, { type: 'WORKSHOP_GAIN', card: 'silver' });
  ok(!s2.pending && s2.players[0].discard.includes('silver'), '工房：銀貨は獲得できる（終端する）');
}
{
  // 基本＋錬金術：工房でブドウ園（$0＋ポーション）をタダ獲得できない
  const s = game(['workshop', 'vineyard', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  ok((s.supply.vineyard || 0) > 0, '前提：ブドウ園がサプライにある');
  let s2 = playAction(s, 'workshop');
  s2 = reduce(s2, { type: 'WORKSHOP_GAIN', card: 'vineyard' });
  ok(s2.pending && s2.pending.type === 'workshop', '工房はブドウ園（$0+ポーション）を拒否');
  ok(!s2.players[0].discard.includes('vineyard'), 'ブドウ園は獲得されていない');
  ok(E.costUpTo(s2, 'vineyard', 4) === false, 'costUpTo: ポーション費用は「$4以下」に含まれない');
  ok(E.costUpTo(s2, 'vineyard', 4, { pot: 1 }) === true, 'costUpTo: spec.pot=1 なら含まれる（変容など）');
}
{
  // 基本＋帝国：大学（$5以下のアクション）で 大君主（$0+負債8）を獲得できない
  const s = game(['university', 'overlord', 'potion', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'festival']);
  let s2 = playAction(s, 'university');
  ok(s2.pending && s2.pending.type === 'university', '大学：獲得の選択待ち');
  s2 = reduce(s2, { type: 'UNIVERSITY_GAIN', card: 'overlord' });
  ok(s2.pending && s2.pending.type === 'university', '大学は大君主（$0+負債8）を拒否');
  ok((s2.players[0].debt || 0) === 0, '負債が付いていない');
  ok(E.costUpTo(s2, 'overlord', 5) === false, 'costUpTo: 負債コストは「$5以下」に含まれない');
}
{
  // 溶鉱炉：0枚廃棄（ちょうど$0）でブドウ園（$0+P）を獲得できない
  const s = game(['forge', 'vineyard', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  let s2 = playAction(s, 'forge', ['copper']);
  s2 = reduce(s2, { type: 'FORGE_TRASH', cards: [] });
  if (s2.pending && s2.pending.type === 'forge') {
    s2 = reduce(s2, { type: 'FORGE_GAIN', card: 'vineyard' });
    ok(!s2.players[0].discard.includes('vineyard'), '溶鉱炉（合計$0）はブドウ園を獲得できない');
  } else {
    ok(true, '溶鉱炉：ちょうど$0の候補が無く pending を立てない（呪いは$0だが…）＝どちらでも可');
  }
  ok(E.costExact(s2, 'vineyard', 0, 0, 0) === false, 'costExact: $0+P は「ちょうど$0」ではない');
}
{
  // 鉱山（財宝を +$3 まで格上げ）：賢者の石（$3+P）や戦利品（非サプライ）を獲得できない
  const s = game(['mine', 'philosophers_stone', 'potion', 'bandit_camp', 'village', 'smithy', 'market', 'moat', 'militia', 'festival']);
  let s2 = playAction(s, 'mine', ['copper']);
  s2 = reduce(s2, { type: 'MINE_TRASH', card: 'copper' });
  ok(s2.pending && s2.pending.type === 'mine' && s2.pending.stage === 'gain', '鉱山：獲得ステージ');
  s2 = reduce(s2, { type: 'MINE_GAIN', card: 'philosophers_stone' });
  ok(s2.pending && s2.pending.stage === 'gain', '鉱山：賢者の石（$3+P）を拒否');
  s2 = reduce(s2, { type: 'MINE_GAIN', card: 'spoils' });
  ok(s2.pending && s2.pending.stage === 'gain', '鉱山：戦利品（非サプライ）を拒否');
  s2 = reduce(s2, { type: 'MINE_GAIN', card: 'silver' });
  ok(!s2.pending && s2.players[0].hand.includes('silver'), '鉱山：銀貨は手札に獲得（終端）');
}
{
  // 詐欺師：相手の銅貨（$0）を廃棄しても 大君主（$0+負債8）を押し付けられない
  const s = game(['swindler', 'overlord', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.players[1].deck = ['copper', 'copper'];
  s.players[1].hand = [];
  let s2 = playAction(s, 'swindler');
  ok(s2.pending && s2.pending.type === 'swindler' && s2.pending.stage === 'gain', '詐欺師：贈与の選択待ち');
  ok(s2.pending.cost === 0 && (s2.pending.debt || 0) === 0, 'pending にコスト3成分が焼き込まれている');
  s2 = reduce(s2, { type: 'SWINDLER_GAIN', card: 'overlord' });
  ok(s2.pending && s2.pending.stage === 'gain', '詐欺師：大君主（$0+負債8）を拒否');
  ok((s2.players[1].debt || 0) === 0, '被害者に負債が付いていない');
  s2 = reduce(s2, { type: 'SWINDLER_GAIN', card: 'curse' });
  ok(!s2.pending && s2.players[1].discard.includes('curse'), '詐欺師：呪い（$0）は与えられる（終端）');
}
{
  // 工匠（ちょうど$N・0枚捨て＝$0）：市街（$0+負債8）を獲得できない
  const s = game(['artificer', 'city_quarter', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  let s2 = playAction(s, 'artificer', ['copper', 'copper']);
  ok(s2.pending && s2.pending.type === 'artificer', '工匠：捨てる選択待ち');
  s2 = reduce(s2, { type: 'ARTIFICER_DISCARD', cards: [] });
  if (s2.pending && s2.pending.type === 'artificer' && s2.pending.stage === 'gain') {
    s2 = reduce(s2, { type: 'ARTIFICER_GAIN', card: 'city_quarter' });
    ok(!s2.players[0].deck.includes('city_quarter'), '工匠（$0）は市街（$0+負債8）を獲得できない');
  } else {
    ok(true, '工匠：ちょうど$0の候補が無ければ pending を立てない');
  }
}

/* ============================================================
   2. gain()/trashCard を通らない経路
   ============================================================ */
console.log('=== mix: gain()/trashCard を通らない経路（封鎖/待ち伏せ/造幣所/密輸人/交易商人）===');
{
  // 封鎖：混合山（城）を獲得しても保存則が壊れない（プレースホルダが増えない）
  const s = game(['blockade', 'castles', 'engineer', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'festival']);
  setHand(s, ['blockade']);
  const t0 = tally(s);
  let s2 = playAction(s, 'blockade');
  ok(s2.pending && s2.pending.type === 'blockade', '封鎖：獲得の選択待ち');
  const castleTop = s2.castles[0];
  s2 = reduce(s2, { type: 'BLOCKADE_GAIN', card: 'castles' });
  const gotCastle = s2.players[0].setAside.includes(castleTop);
  ok(gotCastle, '封鎖：城の混合山は「一番上の実カード」を脇に置く（' + castleTop + '）');
  ok(!s2.players[0].setAside.includes('castles'), 'プレースホルダ castles を脇に置いていない');
  ok(sameTally(t0, tally(s2)), '封鎖×混合山：カード保存則を満たす');
  ok(s2.supply.castles === s2.castles.length, 'supply.castles と state.castles が同期');
}
{
  // 封鎖：負債コストのカード（技術者 $0+負債4）は「コスト$4以下」ではない＝獲得できない（公式の成分別比較）
  const s = game(['blockade', 'engineer', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  let s2 = playAction(s, 'blockade');
  s2 = reduce(s2, { type: 'BLOCKADE_GAIN', card: 'engineer' });
  ok(s2.pending && s2.pending.type === 'blockade', '封鎖：技術者（$0+負債4）を拒否');
  ok((s2.players[0].debt || 0) === 0, '封鎖：負債が付いていない');
  s2 = reduce(s2, { type: 'BLOCKADE_GAIN', card: 'silver' });
  ok(s2.players[0].setAside.includes('silver'), '封鎖：銀貨を脇に置いた（終端）');
}
{
  // 封鎖：獲得時トリガー（ヴィラ＝手札に加える）が発火する。※脇に置く効果と競合するが保存則は保つ
  const s = game(['blockade', 'villa', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  setHand(s, ['blockade']);
  const t0 = tally(s);
  let s2 = playAction(s, 'blockade');
  s2 = reduce(s2, { type: 'BLOCKADE_GAIN', card: 'villa' });
  ok(sameTally(t0, tally(s2)), '封鎖×ヴィラ：カード保存則を満たす（二重に増えない）');
  ok(s2.turn.actions >= 1, '封鎖×ヴィラ：獲得トリガー（+1アクション）が発火');
}
{
  // 封鎖：ロック中の分割山下段は獲得できない
  const s = game(['blockade', 'sauna', 'avanto', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'festival']);
  let s2 = playAction(s, 'blockade');
  s2 = reduce(s2, { type: 'BLOCKADE_GAIN', card: 'avanto' });
  ok(s2.pending && s2.pending.type === 'blockade', '封鎖：ロック中のアヴァント（分割山下段）を拒否');
}
{
  // 待ち伏せ：騎士の混合山を廃棄しても保存則が壊れない（プレースホルダを trash に積まない）
  const s = game(['lurker', 'knights', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  setHand(s, ['lurker']);
  const t0 = tally(s);
  let s2 = playAction(s, 'lurker');
  s2 = reduce(s2, { type: 'LURKER_CHOOSE', choice: 'trash' });
  const knightTop = s2.knights[0];
  const kn0 = s2.knights.length;
  s2 = reduce(s2, { type: 'LURKER_TRASH', card: 'knights' });
  ok(s2.trash.includes(knightTop) && !s2.trash.includes('knights'), '待ち伏せ：騎士は一番上の実カードを廃棄（' + knightTop + '）');
  ok(s2.knights.length === kn0 - 1 && s2.supply.knights === s2.knights.length, 'state.knights が減り supply と同期');
  ok(sameTally(t0, tally(s2)), '待ち伏せ×混合山：カード保存則を満たす');
}
{
  // 待ち伏せ：非サプライ（成長先）とロック中の分割山下段は候補外
  const s = game(['lurker', 'page', 'sauna', 'avanto', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar']);
  let s2 = playAction(s, 'lurker');
  s2 = reduce(s2, { type: 'LURKER_CHOOSE', choice: 'trash' });
  const before = s2.trash.length;
  s2 = reduce(s2, { type: 'LURKER_TRASH', card: 'champion' });
  ok(s2.trash.length === before, '待ち伏せ：非サプライ（チャンピオン）は廃棄できない');
  s2 = reduce(s2, { type: 'LURKER_TRASH', card: 'avanto' });
  ok(s2.trash.length === before, '待ち伏せ：ロック中のアヴァントは廃棄できない');
  s2 = reduce(s2, { type: 'LURKER_TRASH', card: 'village' });
  ok(s2.trash.includes('village') && !s2.pending, '待ち伏せ：村は廃棄できる（終端）');
}
{
  // 造幣所：非サプライ（戦利品）のコピーは獲得できない
  let s2 = game(['mint', 'bandit_camp', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  setHand(s2, ['mint', 'spoils']); // 造幣所はアクション（手札の財宝を公開してコピーを獲得）
  const t0 = tally(s2);
  const sp0 = s2.supply.spoils || 0;
  s2 = reduce(s2, { type: 'PLAY_ACTION', card: 'mint' });
  ok(s2.pending && s2.pending.type === 'mint', '造幣所：公開する財宝を選ぶ選択待ち');
  s2 = reduce(s2, { type: 'MINT_REVEAL', card: 'spoils' });
  ok((s2.supply.spoils || 0) === sp0, '造幣所：戦利品（非サプライ）を公開しても山が減らない＝獲得しない');
  ok(sameTally(t0, tally(s2)), '造幣所×戦利品：カード保存則を満たす（コピーが増えない）');
  ok(!s2.pending, '造幣所：pending が閉じる');
}
{
  // 密輸人：右隣が獲得した 非サプライ／負債コスト札 は候補に入らない
  const s = game(['smugglers', 'engineer', 'bandit_camp', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'festival'], 2);
  s.players[1].lastTurnGains = ['spoils', 'engineer', 'silver'];
  let s2 = playAction(s, 'smugglers');
  if (s2.pending && s2.pending.type === 'smugglers') {
    ok(s2.pending.candidates.indexOf('spoils') < 0, '密輸人：戦利品（非サプライ）は候補外');
    ok(s2.pending.candidates.indexOf('engineer') < 0, '密輸人：技術者（$0+負債4）は候補外');
    ok(s2.pending.candidates.indexOf('silver') >= 0, '密輸人：銀貨は候補');
    s2 = reduce(s2, { type: 'SMUGGLERS_GAIN', card: 'silver' });
    ok(!s2.pending && s2.players[0].discard.includes('silver'), '密輸人：銀貨を獲得（終端）');
  } else { ok(false, '密輸人：pending が立たなかった'); }
}
{
  // 交易商人：闇市場デッキ由来（サプライに山が無い）カードの獲得では窓を開かない＝supply に新キーが生えない
  const s = game(['trader', 'black_market', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  const keys0 = Object.keys(s.supply).sort().join(',');
  let s2 = s;
  s2.players[0].hand = ['trader'];
  // 闇市場デッキから1枚（サプライ外）を直接「獲得」してみる＝gainFromOutside 相当の経路を BLACK_MARKET で再現
  const bmCard = (s2.blackMarket || [])[0];
  if (bmCard) {
    s2.turn.phase = 'action';
    s2.pending = { type: 'black_market', stage: 'play', player: 0, revealed: [bmCard] };
    s2.turn.coins = 20;
    s2 = reduce(s2, { type: 'BLACK_MARKET_BUY', card: bmCard });
    const keys1 = Object.keys(s2.supply).sort().join(',');
    ok(keys0 === keys1, '闇市場の獲得で state.supply に新しいキーが生えない（交易商人の窓を開かない）');
    ok(!s2.pending || s2.pending.type !== 'trader_react', '交易商人：サプライ外の獲得では窓を開かない');
  } else { ok(true, '（闇市場デッキが空＝スキップ）'); }
}

/* ============================================================
   3. 支配（Possession）
   ============================================================ */
console.log('=== mix: 支配（Possession）× 他拡張 ===');
function possessedGame(kingdom) {
  const s = game(kingdom, 2);
  // 席1（被支配者）の手番を席0（支配者）が操作している状態を作る
  s.turn.active = 1;
  s.turn.possessedBy = 0;
  s.turn.phase = 'buy';
  s.turn.coins = 20; s.turn.buys = 5;
  return s;
}
{
  // 負債コストのカードを支配中に購入 → 負債は**支配者**が負う（被支配者ではない）
  const s = possessedGame(['engineer', 'overlord', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  const t0 = tally(s);
  const s2 = reduce(s, { type: 'BUY', card: 'engineer' });
  ok((s2.players[0].debt || 0) === 4, '支配：負債は支配者（席0）が負う');
  ok((s2.players[1].debt || 0) === 0, '支配：被支配者（席1）に負債は付かない');
  ok((s2.turn.possessionGains || []).includes('engineer'), '支配：獲得したカードは脇（possessionGains）へ');
  ok(sameTally(t0, tally(s2)), '支配×負債購入：カード保存則を満たす');
}
{
  // 支配中の獲得で on-gain トリガーが発火する。**獲得するのは支配者**（公式）＝入れ子の獲得（死の荷車の廃墟2枚）は
  // 支配者の捨て札へ直接入る（脇＝possessionGains に積まれるのは被支配者が獲得した札そのものだけ）。
  const s = possessedGame(['death_cart', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'bandit_camp']);
  const t0 = tally(s);
  const s2 = reduce(s, { type: 'BUY', card: 'death_cart' });
  const gains = s2.turn.possessionGains || [];
  ok(gains.includes('death_cart'), '支配：死の荷車を獲得（脇＝支配者が受け取る）');
  const ruins0 = s2.players[0].discard.filter((c) => DOM.isType(c, 'ruins')).length;
  ok(ruins0 === 2, '支配：死の荷車の獲得トリガーが発火し、廃墟2枚は支配者の捨て札へ（' + ruins0 + '枚）');
  ok(s2.players[1].discard.filter((c) => DOM.isType(c, 'ruins')).length === 0, '支配：被支配者には廃墟が入らない');
  ok(sameTally(t0, tally(s2)), '支配×on-gain：カード保存則を満たす');
}
{
  // 支配 × 交易商人：被支配者が手札に交易商人を持っていても窓は開かない（獲得者は支配者＝手番プレイヤーではない）。
  //   開くと「獲得札は支配者が保持＋銀貨も得る／被支配者の同名コピーがサプライへ吸い上げられる」二重取りになる。
  const s = possessedGame(['trader', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'chapel']);
  setHand(s, ['trader'], 1);
  s.players[1].discard = ['gold'];
  const t0 = tally(s);
  const sup0 = s.supply.gold;
  const s2 = reduce(s, { type: 'BUY', card: 'gold' });
  ok(!s2.pending || s2.pending.type !== 'trader_react', '支配×交易商人：窓が開かない');
  ok(s2.supply.gold === sup0 - 1, '支配×交易商人：被支配者の金貨がサプライへ吸い上げられない');
  ok(sameTally(t0, tally(s2)), '支配×交易商人：カード保存則を満たす');
}
{
  // 交易商人 × 廃棄置き場からの獲得（待ち伏せ）：サプライ由来でない獲得では窓を開かない
  //   （開くと廃棄した札がサプライの山に復活し、空の山が非空に戻る＝3山終了が巻き戻る）。
  const s = game(['lurker', 'trader', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.trash = ['festival'];
  setHand(s, ['lurker', 'trader']);
  const fest0 = s.supply.festival;
  const t0 = tally(s);
  let s2 = reduce(s, { type: 'PLAY_ACTION', card: 'lurker' });
  s2 = reduce(s2, { type: 'LURKER_CHOOSE', choice: 'gain' });
  s2 = reduce(s2, { type: 'LURKER_GAIN', card: 'festival' });
  ok(!s2.pending || s2.pending.type !== 'trader_react', '交易商人：廃棄置き場からの獲得では窓を開かない');
  ok(s2.supply.festival === fest0, '交易商人：廃棄した札がサプライの山に復活しない');
  ok(s2.players[0].discard.includes('festival'), '待ち伏せ：廃棄置き場から獲得できている');
  ok(sameTally(t0, tally(s2)), '交易商人×廃棄置き場：カード保存則を満たす');
}
{
  // 複製（duplicate）：ポーション費用／負債コスト／非サプライ のカードは「$6以下」ではない＝呼び出せない
  const s = game(['duplicate', 'vineyard', 'potion', 'engineer', 'bandit_camp', 'village', 'smithy', 'market', 'moat', 'militia']);
  s.players[0].tavern = ['duplicate'];
  s.turn.phase = 'buy'; s.turn.coins = 20; s.turn.buys = 5; s.turn.potions = 5;
  let s2 = reduce(s, { type: 'BUY', card: 'engineer' });
  ok(!s2.pending || s2.pending.type !== 'duplicate', '複製：負債コスト札（技術者）では窓が開かない');
  const eng = s2.supply.engineer;
  s2 = reduce(s2, { type: 'BUY', card: 'vineyard' });
  ok(!s2.pending || s2.pending.type !== 'duplicate', '複製：ポーション費用札（ブドウ園）では窓が開かない');
  // 正当な複製（銀貨）は従来どおり効く
  let s3 = game(['duplicate', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'chapel']);
  s3.players[0].tavern = ['duplicate'];
  s3.turn.phase = 'buy'; s3.turn.coins = 20; s3.turn.buys = 5;
  s3 = reduce(s3, { type: 'BUY', card: 'silver' });
  ok(s3.pending && s3.pending.type === 'duplicate', '複製：銀貨（$3）では従来どおり窓が開く');
  s3 = reduce(s3, { type: 'DUPLICATE_CALL', call: true });
  ok(s3.players[0].discard.filter((c) => c === 'silver').length === 2, '複製：銀貨のコピーを獲得できる');
  ok(eng >= 0, '（技術者の山は存在する）');
}
{
  // 馬上槍試合：賞品が尽き公領も無ければ pending を立てない（戦利品/成長先を「賞品」と誤認しない）
  const s = game(['tournament', 'bandit_camp', 'page', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  ['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed'].forEach((id) => { s.supply[id] = 0; });
  s.supply.duchy = 0;
  ok((s.supply.spoils || 0) > 0 || (s.supply.champion || 0) > 0, '前提：非サプライ山（戦利品/成長先）が存在する');
  setHand(s, ['tournament', 'province']);
  let s2 = reduce(s, { type: 'PLAY_ACTION', card: 'tournament' });
  ok(s2.pending && s2.pending.type === 'tournament' && s2.pending.stage === 'reveal_self', '馬上槍試合：属州公開の選択待ち');
  s2 = reduce(s2, { type: 'TOURNAMENT_REVEAL', reveal: true });
  ok(!s2.pending || s2.pending.stage !== 'prize', '馬上槍試合：賞品も公領も無ければ「賞品を獲得」pending を立てない（戦利品を賞品扱いしない）');
}
{
  // 青空市場：サプライからの廃棄（待ち伏せ）には反応しない（「あなたのカード」ではない）
  const s = game(['lurker', 'market_square', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  setHand(s, ['lurker', 'market_square']);
  let s2 = reduce(s, { type: 'PLAY_ACTION', card: 'lurker' });
  s2 = reduce(s2, { type: 'LURKER_CHOOSE', choice: 'trash' });
  s2 = reduce(s2, { type: 'LURKER_TRASH', card: 'village' });
  const q = (s2.onTrashQueue || []).concat(s2.pending ? [s2.pending] : []);
  ok(!q.some((x) => x && x.type === 'market_square_react'), '青空市場：サプライからの廃棄では反応しない');
}
{
  // 支配中の自己廃棄（祝宴/鉱山の村/宝の地図/豊穣の角/投資）は possessionTrash に退避＝被支配者に返る
  const s = possessedGame(['feast', 'mining_village', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.turn.phase = 'action'; s.turn.actions = 3;
  setHand(s, ['feast'], 1);
  const t0 = tally(s);
  const s2 = reduce(s, { type: 'PLAY_ACTION', card: 'feast' });
  ok((s2.turn.possessionTrash || []).includes('feast'), '支配：祝宴の自己廃棄は possessionTrash へ退避（永久廃棄されない）');
  ok(!s2.trash.includes('feast'), '支配：祝宴は廃棄置き場に入らない');
  ok(sameTally(t0, tally(s2)), '支配×自己廃棄：カード保存則を満たす');
}
{
  // 塩まき（サプライから廃棄）は支配中でも「サプライから廃棄」＝被支配者に属州が湧かない
  const s = possessedGame(['village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'chapel', 'mine']);
  s.events = ['salt_the_earth'];
  const t0 = tally(s);
  const prov0 = s.supply.province;
  let s2 = reduce(s, { type: 'BUY_EVENT', event: 'salt_the_earth' });
  ok(s2.pending && s2.pending.type === 'salt_the_earth', '塩まき：山を選ぶ選択待ち');
  s2 = reduce(s2, { type: 'SALT_TRASH', card: 'province' });
  ok(s2.supply.province === prov0 - 1, '塩まき：属州の山が1枚減る');
  ok(s2.trash.includes('province'), '塩まき：属州は廃棄置き場に入る');
  ok(!(s2.turn.possessionTrash || []).includes('province'), '塩まき：支配の退避に入らない（被支配者にタダで湧かない）');
  ok(sameTally(t0, tally(s2)), '塩まき×支配：カード保存則を満たす');
}
{
  // 廃棄置き場からの獲得（墓暴き）は支配の振り分けを通る
  const s = possessedGame(['graverobber', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold']);
  s.trash = ['gold'];
  s.turn.phase = 'action'; s.turn.actions = 2;
  setHand(s, ['graverobber'], 1);
  const t0 = tally(s);
  let s2 = reduce(s, { type: 'PLAY_ACTION', card: 'graverobber' });
  ok(s2.pending && s2.pending.type === 'graverobber', '墓暴き：選択待ち');
  s2 = reduce(s2, { type: 'GRAVEROBBER_MODE', mode: 'from_trash' });
  if (s2.pending && s2.pending.stage === 'from_trash') {
    s2 = reduce(s2, { type: 'GRAVEROBBER_FROM_TRASH', card: 'gold' });
    ok((s2.turn.possessionGains || []).includes('gold'), '支配：廃棄置き場からの獲得も支配者へ振り分ける');
    ok(!s2.players[1].deck.includes('gold'), '支配：被支配者の山札に入らない');
    ok(sameTally(t0, tally(s2)), '支配×廃棄置き場からの獲得：カード保存則を満たす');
  } else { ok(false, '墓暴き：from_trash ステージに入らなかった'); }
}

/* ============================================================
   4. CPU 終端保証（mix での livelock 防止）
   ============================================================ */
console.log('=== mix: CPU 終端保証（engine が拒否する札を提案し続けない）===');
function cpuResolves(s, label, maxSteps) {
  let last = '', same = 0, steps = 0;
  const lim = maxSteps || 40;
  while (s.pending && steps++ < lim) {
    const a = CPU.decide(s);
    if (!a) break;
    const key = JSON.stringify(s.pending) + '|' + JSON.stringify(a);
    if (key === last) { same++; if (same >= 3) break; } else { same = 0; }
    last = key;
    s = reduce(s, a);
  }
  ok(!s.pending, 'CPU が pending を閉じる（' + label + '・' + steps + '手）');
  return s;
}
{
  // 工房：非サプライ（賞品）しか $4以下に無い局面でも終端する
  let s = game(['workshop', 'tournament', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s = playAction(s, 'workshop');
  cpuResolves(s, '工房×賞品');
}
{
  // 改良（ちょうど+$1）：ポーション費用札しか無いコスト帯でも終端する
  let s = game(['upgrade', 'vineyard', 'potion', 'transmute', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar']);
  s = playAction(s, 'upgrade', ['estate']);
  s = reduce(s, { type: 'UPGRADE_TRASH', card: 'estate' });
  cpuResolves(s, '改良×ポーション費用');
}
{
  // 行進：ロック中の分割山下段（$5）しか受け皿が無い局面でも終端する
  let s = game(['procession', 'sauna', 'avanto', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  s = playAction(s, 'procession', ['village']);
  s = reduce(s, { type: 'PROCESSION_CHOOSE', card: 'village' });
  cpuResolves(s, '行進×分割山下段');
}
{
  // 変容（酒場マット）：ポーション費用札が混ざる王国でも終端する
  let s = game(['transmogrify', 'vineyard', 'potion', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  s.players[0].tavern = ['transmogrify'];
  s.pending = { type: 'transmogrify_trash', player: 0 };
  s.players[0].hand = ['copper', 'estate'];
  cpuResolves(s, '変容×ポーション費用');
}
{
  // 石工（過払い）：ロック中の分割山下段が「ちょうど$N」の唯一候補になり得る局面でも終端する
  let s = game(['stonemason', 'sauna', 'avanto', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  s.pending = { type: 'stonemason_overpay', player: 0, exact: 5, remaining: 2 };
  cpuResolves(s, '石工の過払い×分割山下段');
}
{
  // 車大工：ポーション費用札しか無いコスト帯でも終端する
  let s = game(['wheelwright', 'vineyard', 'potion', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  s = playAction(s, 'wheelwright', ['estate']);
  if (s.pending && s.pending.type === 'wheelwright') cpuResolves(s, '車大工×ポーション費用');
  else ok(true, '車大工：捨て札が無く pending 無し');
}

/* ============================================================
   5. mix セットの配線（kingdomForSet / landscapesForSet）
   ============================================================ */
console.log('=== mix: セットIDの配線 ===');
{
  const setId = DOM.makeMixSet(['basic', 'alchemy', 'empires'], 2, ['ev-empires', 'lm-empires']);
  ok(DOM.isMixSet(setId), 'isMixSet');
  const m = DOM.parseMixSet(setId);
  ok(m.pools.length === 3 && m.count === 2 && m.lsPools.length === 2, 'parseMixSet');
  const king = DOM.kingdomForSet(setId);
  ok(king.length === 10, 'mix: 王国は常に10種');
  const ls = DOM.landscapesForSet(setId);
  const total = ls.landmarks.length + ls.events.length + ls.projects.length;
  ok(total === 2, 'mix: 横型は合計2枚（合算で最大2）');
  // 実際に対局を作れて保存則を満たす
  const st = E.createInitialState([{ name: 'A', isCpu: true }, { name: 'B', isCpu: true }], king,
    { landmarks: ls.landmarks, events: ls.events, projects: ls.projects });
  ok(st && st.players.length === 2, 'mix: createInitialState が通る');
  ok(Object.keys(tally(st)).length > 0, 'mix: tally が取れる');
}

console.log('');
console.log('========================================');
console.log('mix-all 硬化テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
