/* 帝国（Empires）ゲームロジックの検証（Node 単体実行）
   使い方: node test/empires.test.js
   対象（Batch E1）: 負債(Debt)経済の基盤＋engineer/city_quarter/royal_blacksmith/capital。
     - 負債＝購入ブロック／$1返済／gain経由の付与／capital の on-discard 負債＋残コイン即返済。
     - 「コストN以下/ちょうどN の獲得」は負債コストのカードを取れない（engineer/messenger/CPU bestGain）。
     - 敵対レビュー回帰：闇市場での負債（負債中は黒市購入不可・負債カードを買えば負債を負う）。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260708;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
const reduce = (s, a) => E.reduce(s, a);
function count(arr, id) { return (arr || []).filter((c) => c === id).length; }
const KING = ['engineer', 'city_quarter', 'royal_blacksmith', 'capital', 'village', 'smithy', 'market', 'workshop', 'moat', 'cellar'];
function mk(opts) { return E.createInitialState(['A', 'B'], KING, Object.assign({ startActive: 0 }, opts || {})); }
const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat', 'princes', 'tavern'];
function tally(s) { const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; }; Object.keys(s.supply).forEach((id) => { if (id === 'ruins' || id === 'knights') return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); }); (s.ruins || []).forEach(a); (s.knights || []).forEach(a); (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a); s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a))); s.players.forEach((p) => (p.archives || []).forEach((ar) => (ar.cards || []).forEach(a))); return t; }
function tdiff(a, b) { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); const d = []; ks.forEach((k) => { if ((a[k] || 0) !== (b[k] || 0)) d.push(k + ':' + (a[k] || 0) + '→' + (b[k] || 0)); }); return d; }

/* ============ 負債：購入→ブロック→返済 ============ */
console.log('=== 帝国: 負債（購入→ブロック→返済） ===');
{
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 3;
  const t0 = tally(s);
  s = reduce(s, { type: 'BUY', card: 'engineer' }); // $0＋負債4
  ok(s.players[0].debt === 4, '技術者購入で 負債4');
  ok(count(s.players[0].discard, 'engineer') === 1 && s.turn.coins === 8, '技術者を獲得＋$0＝コイン不変');
  const before = count(s.players[0].discard, 'copper');
  s = reduce(s, { type: 'BUY', card: 'copper' });
  ok(count(s.players[0].discard, 'copper') === before, '負債があると購入不可');
  const buysBefore = s.turn.buys;
  s = reduce(s, { type: 'REPAY_DEBT', amount: 3 });
  ok(s.players[0].debt === 1 && s.turn.coins === 5 && s.turn.buys === buysBefore, '負債3返済（購入権消費なし）');
  s = reduce(s, { type: 'REPAY_DEBT' }); // amount未指定＝可能な限り
  ok(s.players[0].debt === 0 && s.turn.coins === 4, '残り負債を全返済');
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(count(s.players[0].discard, 'silver') === 1, '負債0なら購入できる');
  s = reduce(s, { type: 'REPAY_DEBT', amount: 99 });
  ok(s.players[0].debt === 0, '負債0で返済しても無変化');
  ok(tdiff(t0, tally(s)).length === 0, '保存則：総数不変（負債はカード外）');
}
{
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 2; s.players[0].debt = 5;
  s = reduce(s, { type: 'REPAY_DEBT', amount: 5 });
  ok(s.players[0].debt === 3 && s.turn.coins === 0, 'コイン2しかなければ2しか返せない');
}
{ // 負債はターンを跨いで残る＋公開情報
  let s = mk(); s.players[0].debt = 3;
  ok(E.maskStateFor(s, 1).players[0].debt === 3, 'debt は公開情報（相手視点でも見える）');
  const fresh = s.turn; ok(fresh, 'turn exists');
}

/* ============ 技術者：獲得→自己廃棄→もう1枚 ============ */
console.log('=== 帝国: 技術者 ===');
{
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 3;
  s.players[0].hand = ['engineer']; s.players[0].deck = ['copper', 'copper'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'engineer' });
  ok(s.pending && s.pending.type === 'engineer' && s.pending.stage === 'gain1', 'engineer→gain1');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  ok(count(s.players[0].discard, 'silver') === 1 && s.pending.stage === 'maytrash', '1枚目獲得→maytrash');
  s = reduce(s, { type: 'ENGINEER_TRASH', trash: true });
  ok(count(s.players[0].inPlay, 'engineer') === 0 && count(s.trash, 'engineer') === 1 && s.pending.stage === 'gain2', '技術者を廃棄→gain2');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'village' });
  ok(count(s.players[0].discard, 'village') === 1 && !s.pending, '2枚目獲得→解消');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
}
{ // 負債コストのカードは技術者で獲得できない（city_quarter=$0だが負債8）
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 3; s.players[0].hand = ['engineer'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'engineer' });
  const cq = (s.supply.city_quarter || 0);
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'city_quarter' });
  ok(s.pending && s.pending.stage === 'gain1' && (s.supply.city_quarter || 0) === cq && s.players[0].debt === 0, '技術者は負債カードを獲得できない（拒否・負債も発生せず）');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  ok(s.pending && s.pending.stage === 'maytrash', '正当な獲得で先へ進む');
}
{ // maytrash=keep
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 3; s.players[0].hand = ['engineer'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'engineer' });
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  s = reduce(s, { type: 'ENGINEER_TRASH', trash: false });
  ok(!s.pending && count(s.players[0].inPlay, 'engineer') === 1 && count(s.trash, 'engineer') === 0, '廃棄しない＝場に残り追加獲得なし');
}
{ // 玉座×技術者：2回目は場に技術者が無く自己廃棄不発（保存則）
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 3; s.players[0].hand = ['throne_room', 'engineer'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'engineer' });
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  s = reduce(s, { type: 'ENGINEER_TRASH', trash: true });
  ok(count(s.trash, 'engineer') === 1, '1回目で技術者は廃棄された');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'village' });
  ok(s.pending && s.pending.type === 'engineer' && s.pending.stage === 'gain1', '玉座2回目→gain1');
  s = reduce(s, { type: 'ENGINEER_GAIN', card: 'silver' });
  s = reduce(s, { type: 'ENGINEER_TRASH', trash: true }); // 場に無い→不発
  ok(!s.pending && count(s.trash, 'engineer') === 1, '技術者は1枚しか廃棄されない（幻の廃棄なし）');
  ok(tdiff(t0, tally(s)).filter((d) => !/silver|village|throne_room|engineer/.test(d)).length === 0, '保存則OK');
}

/* ============ 市街 / 王室の鍛冶屋 ============ */
console.log('=== 帝国: 市街 / 王室の鍛冶屋 ===');
{
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['city_quarter', 'village', 'smithy', 'copper'];
  s.players[0].deck = ['gold', 'silver', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'city_quarter' });
  ok(s.turn.actions === 2, '+2アクション（プレイで-1消費＝1→2）');
  ok(s.players[0].hand.filter((c) => c === 'gold' || c === 'silver').length === 2, '手札のアクション2枚ぶん+2カード');
  ok(!s.pending, 'pendingなし');
}
{
  let s = mk(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['royal_blacksmith'];
  s.players[0].deck = ['copper', 'estate', 'copper', 'silver', 'copper'];
  s.players[0].discard = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'royal_blacksmith' });
  ok(count(s.players[0].hand, 'copper') === 0 && count(s.players[0].discard, 'copper') === 3, '+5カード後 銅貨3枚を全捨て');
  ok(s.players[0].hand.length === 2 && count(s.players[0].hand, 'estate') === 1 && count(s.players[0].hand, 'silver') === 1, '手札は非銅貨2枚');
}

/* ============ 元手：+6コイン+1購入＋on-discard負債6 ============ */
console.log('=== 帝国: 元手 ===');
{ // コインを使い切る→負債6残
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 2;
  s.players[0].hand = ['capital'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'capital' });
  ok(s.turn.coins === 6 && s.turn.buys === 3, '+6コイン+1購入');
  s = reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.turn.coins === 0, 'gold購入でコイン0');
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].debt === 6, 'コイン使い切り→cleanupで負債6残');
}
{ // コインを使わない→残コイン6から即返済で負債0
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 2;
  s.players[0].hand = ['capital'];
  const t0base = tally(s);
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'capital' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].debt === 0, 'コイン残6→即返済で負債0');
  ok(tdiff(t0base, tally(s)).length === 0, '保存則OK（capitalはデッキ内に残る）');
}

/* ============ 敵対レビュー回帰：闇市場×負債 ============ */
console.log('=== 帝国: 闇市場×負債（回帰） ===');
{ // 負債カードを闇市場で買うと負債を負う（gain非経由でも付与）
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 8;
  s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['engineer', 'village'] };
  s = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'engineer' });
  ok(count(s.players[0].discard, 'engineer') === 1 && s.players[0].debt === 4, '闇市場で技術者購入→負債4を負う');
}
{ // 負債があると闇市場で購入できない
  let s = mk(); s.turn.phase = 'buy'; s.turn.coins = 8; s.players[0].debt = 5;
  s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['village'] };
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'village' });
  ok(s.pending && count(s.players[0].discard, 'village') === 0 && s.turn.coins === c0, '負債があると闇市場でも購入不可（pending据え置き・コイン不変）');
  s = reduce(s, { type: 'BLACK_MARKET_SKIP' });
  ok(!s.pending, '見送りで解消');
}

/* ============ CPU ソーク：負債カード入り王国で膠着/例外/保存則違反なし ============ */
console.log('=== 帝国: CPU ソーク ===');
{
  let stuck = 0, exc = 0, consErr = 0, games = 0;
  for (let g = 0; g < 16; g++) {
    seed = 700 + g * 173;
    let s = E.createInitialState(['CPU0', 'CPU1'], KING, { startActive: 0 });
    s.players[0].cpuLevel = g % 2 ? 'hard' : 'normal'; s.players[1].cpuLevel = 'normal';
    const t0 = tally(s);
    let guard = 0;
    try { while (!s.gameOver && guard++ < 5000) { s = reduce(s, CPU.decide(s)); } }
    catch (e) { exc++; console.log('  例外:', e.message); }
    if (guard >= 5000) stuck++;
    if (tdiff(t0, tally(s)).length) { consErr++; console.log('  保存則差分:', tdiff(t0, tally(s)).join(',')); }
    games++;
  }
  ok(stuck === 0, 'CPU 膠着0（/' + games + '）');
  ok(exc === 0, 'CPU 例外0');
  ok(consErr === 0, 'CPU 保存則違反0');
}

/* ============================================================
   Batch E2（既存VPトークン＆単独カード9枚）
   ============================================================ */
const KING2 = ['forum', 'sacrifice', 'groundskeeper', 'chariot_race', 'villa', 'charm', 'legionary', 'enchantress', 'archive', 'market'];
function mk2(opts, names) { return E.createInitialState(names || ['A', 'B'], KING2, Object.assign({ startActive: 0 }, opts || {})); }
function endTurn(s) { s.turn.phase = 'buy'; return reduce(s, { type: 'END_TURN' }); }

console.log('=== 帝国E2: 公共広場（+3カ+1ア-2捨て・獲得時+1購入）===');
{
  let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.turn.buys = 1;
  s.players[0].hand = ['forum']; s.players[0].deck = ['copper', 'estate', 'silver', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'forum' });
  ok(s.players[0].hand.length === 3 && s.turn.actions === 1 && s.pending && s.pending.type === 'forum', '公共広場：+3カ+1ア→捨てpending');
  s = reduce(s, { type: 'FORUM_DISCARD', cards: ['copper', 'estate'] });
  ok(!s.pending && s.players[0].hand.length === 1 && s.turn.buys === 1, '公共広場：2枚捨て・プレイでは+1購入なし');
}
{ let s = mk2(); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'forum' });
  ok(count(s.players[0].discard, 'forum') === 1 && s.turn.buys === 1, '公共広場：獲得時+1購入（購入-1+獲得+1=差引0）'); }

console.log('=== 帝国E2: 生贄（種別別ボーナス）===');
{
  let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['sacrifice', 'harem']; const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sacrifice' });
  s = reduce(s, { type: 'SACRIFICE_TRASH', card: 'harem' });
  ok(s.turn.coins === 2 && s.players[0].vpTokens === 2, '生贄×複数種別(harem)：+$2 かつ +2VP');
  ok(tdiff(t0, tally(s)).length === 0, '生贄：保存則');
}
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['sacrifice', 'market']; s.players[0].deck = ['copper', 'copper', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sacrifice' });
  s = reduce(s, { type: 'SACRIFICE_TRASH', card: 'market' });
  ok(s.players[0].hand.length === 2 && s.turn.actions === 2, '生贄×アクション：+2カード+2アクション'); }
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['sacrifice'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sacrifice' });
  ok(!s.pending, '生贄：空手札なら pending なし（終端）'); }

console.log('=== 帝国E2: 庭師（勝利点獲得毎VP・場の枚数ぶん）===');
{ let s = mk2(); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1; s.players[0].inPlay = ['groundskeeper', 'groundskeeper'];
  s = reduce(s, { type: 'BUY', card: 'market' });
  ok((s.players[0].vpTokens || 0) === 0, '庭師：非勝利点獲得ではVP無し');
  s.turn.buys = 1; s.turn.coins = 5; s = reduce(s, { type: 'BUY', card: 'estate' });
  ok(s.players[0].vpTokens === 2, '庭師×2：勝利点獲得で +2VP'); }

console.log('=== 帝国E2: 戦車競走（厳密に高い時だけ・引分/空は無し）===');
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['chariot_race']; s.players[0].deck = ['gold']; s.players[1].deck = ['copper'];
  const t0 = tally(s); s = reduce(s, { type: 'PLAY_ACTION', card: 'chariot_race' });
  ok(count(s.players[0].hand, 'gold') === 1 && s.turn.coins === 1 && s.players[0].vpTokens === 1, '戦車競走：勝ち→+$1+VP・自分の札は手札へ');
  ok(count(s.players[1].deck, 'copper') === 1 && tdiff(t0, tally(s)).length === 0, '戦車競走：左隣は公開のみ・保存則'); }
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['chariot_race']; s.players[0].deck = ['gold']; s.players[1].deck = []; s.players[1].discard = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'chariot_race' });
  ok(s.turn.coins === 0 && (s.players[0].vpTokens || 0) === 0, '戦車競走：左隣が公開できない→ボーナス無し'); }

console.log('=== 帝国E2: ヴィラ（購入でアクションフェイズ復帰）===');
{ let s = mk2(); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1; s.turn.actions = 0; const t0 = tally(s);
  s = reduce(s, { type: 'BUY', card: 'villa' });
  ok(s.turn.phase === 'action' && count(s.players[0].hand, 'villa') === 1 && s.turn.actions === 1, 'ヴィラ：購入で手札+1ア・アクションフェイズ復帰');
  ok(s.turn.coins === 1 && tdiff(t0, tally(s)).length === 0, 'ヴィラ：残コイン保持・保存則'); }

console.log('=== 帝国E2: 御守り（モードB＝同コスト別名・負債一致）===');
{ // city_quarter(cost0 d8)獲得→同コスト royal_blacksmith は可・copper($0)は不可
  const K = ['charm', 'city_quarter', 'royal_blacksmith', 'engineer', 'market', 'moat', 'village', 'smithy', 'cellar', 'festival'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 3; s.players[0].hand = ['charm'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'charm' });
  s = reduce(s, { type: 'CHARM_MODE', mode: 'gain' });
  s = reduce(s, { type: 'BUY', card: 'city_quarter' });
  ok(s.pending && s.pending.type === 'charm_gain' && s.pending.coin === 0 && s.pending.debt === 8, '御守り：city_quarter獲得でcharm_gain(coin0 d8)');
  const cop = count(s.players[0].discard, 'copper'); s = reduce(s, { type: 'CHARM_GAIN', card: 'copper' });
  ok(count(s.players[0].discard, 'copper') === cop && s.pending, '御守り：$0(copper)は負債不一致で獲得不可（pending維持）');
  s = reduce(s, { type: 'CHARM_GAIN', card: 'royal_blacksmith' });
  ok(count(s.players[0].discard, 'royal_blacksmith') === 1 && s.players[0].debt === 16, '御守り：同コスト(d8)別名を獲得（負債16）'); }

console.log('=== 帝国E2: 軍団兵（金貨公開→手札2に減+1引・堀免疫）===');
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['legionary', 'gold'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate']; s.players[1].deck = ['silver', 'gold']; const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'legionary' });
  ok(s.turn.coins === 3, '軍団兵：+$3');
  s = reduce(s, { type: 'LEGIONARY_REVEAL', reveal: true });
  s = reduce(s, { type: 'DISCARD_DOWN_RESOLVE', cards: ['copper', 'copper', 'copper'] });
  ok(s.players[1].hand.length === 3 && count(s.players[0].hand, 'gold') === 1, '軍団兵：相手5→2捨て→1引く=3・金貨は手札に残る');
  ok(tdiff(t0, tally(s)).length === 0, '軍団兵：保存則'); }
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['legionary', 'gold'];
  s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'legionary' }); s = reduce(s, { type: 'LEGIONARY_REVEAL', reveal: true });
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(!s.pending && s.players[1].hand.length === 5, '軍団兵：堀で捨ても引きも無し'); }

console.log('=== 帝国E2: 女魔術師（最初のアクション置換・堀免疫・+2持続）===');
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].enchanted = true;
  s.players[0].hand = ['militia']; s.players[0].deck = ['copper']; s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
  ok(s.turn.coins === 0 && s.players[1].hand.length === 5 && !s.pending && s.players[0].hand.length === 1 && s.turn.actions === 1 && !s.players[0].enchanted,
    '女魔術師：民兵が+1カ+1アに置換されアタックしない（1回で消費）'); }
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['enchantress']; s.players[1].hand = ['moat', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'enchantress' });
  ok(s.pending && s.pending.type === 'enchantress' && s.pending.stage === 'react', '女魔術師：堀持ちに反応窓');
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(s.players[1].enchanted !== true, '女魔術師：堀公開で enchanted されない'); }
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['enchantress'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper']; s.players[1].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'enchantress' }); s = endTurn(s); s = endTurn(s);
  ok(s.turn.active === 0 && s.players[0].hand.length === 7, '女魔術師：戻り手番で +2カード（5+2=7）'); }

console.log('=== 帝国E2: 資料庫（3手番持続・玉座で2脇・マスク）===');
{ let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['archive'];
  s.players[0].deck = ['gold', 'silver', 'copper', 'estate', 'estate', 'estate', 'estate', 'estate']; s.players[1].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper']; const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'archive' });
  ok(s.players[0].archives.length === 1 && s.players[0].archives[0].cards.length === 3 && s.pending.type === 'archive_pick', '資料庫：脇3枚→pick');
  s = reduce(s, { type: 'ARCHIVE_PICK', card: 'gold' });
  ok(count(s.players[0].hand, 'gold') === 1 && s.players[0].archives[0].cards.length === 2, '資料庫：1枚目手札・残り2');
  s = endTurn(s); ok(count(s.players[0].durationCards, 'archive') === 1, '資料庫：脇が残る間 場に持続');
  s = endTurn(s); s = reduce(s, { type: 'ARCHIVE_PICK', card: 'silver' });
  s = endTurn(s); s = endTurn(s); s = reduce(s, { type: 'ARCHIVE_PICK', card: 'copper' });
  ok(s.players[0].archives.length === 0, '資料庫：3枚取り切ったら脇除去');
  s = endTurn(s); ok(count(s.players[0].durationCards || [], 'archive') === 0, '資料庫：脇が尽きたら持続から外れる');
  ok(tdiff(t0, tally(s)).length === 0, '資料庫：保存則（全サイクル）'); }
{ // マスク：相手には脇の中身が伏せられる
  let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['archive']; s.players[0].deck = ['gold', 'silver', 'copper', 'estate', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'archive' });
  const m1 = E.maskStateFor(s, 1);
  ok(m1.players[0].archives[0].cards.every((c) => c === 'back') && m1.players[0].archives[0].cards.length === 3, '資料庫：相手視点は中身back・枚数は見える'); }

console.log('=== 帝国E2: 敵対レビュー回帰 ===');
{ // 生贄×玉座：手札が生贄だけになっても CPU は card:null を返さない（engine拒否×CPU再提案の無限ループ回避）
  let s = mk2(); s.turn.phase = 'action'; s.turn.actions = 2;
  s.players[0].hand = ['sacrifice', 'sacrifice']; s.players[0].deck = ['gold', 'gold', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sacrifice' }); // pending sacrifice、手札=['sacrifice']
  const act = CPU.decide(s);
  ok(act.type === 'SACRIFICE_TRASH' && act.card != null, '生贄：手札が生贄だけでもCPUは非nullを返す');
  s = reduce(s, act);
  ok(!(s.pending && s.pending.type === 'sacrifice'), '生贄：pending が閉じて進行する');
}
{ // 玉座×生贄のフルシナリオを CPU 駆動で回して膠着しないこと
  const K = ['throne_room', 'sacrifice', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'remodel'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.players[0].hand = ['throne_room', 'sacrifice', 'sacrifice', 'estate']; s.players[0].deck = ['gold', 'gold', 'gold', 'gold', 'gold'];
  s.turn.phase = 'action'; s.turn.actions = 2; s.turn.buys = 1; s.turn.coins = 0;
  let guard = 0; while (s.turn.active === 0 && s.turn.phase === 'action' && guard++ < 60) { const a = CPU.decide(s); s = reduce(s, a); }
  ok(guard < 60, '玉座×生贄：CPUが膠着せず進行（60手以内にアクションフェイズを抜ける）');
}
{ // 闇市場でヴィラを獲得→手札+1アクション+アクションフェイズ復帰（on-gain発動）
  let s = mk2(); s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.actions = 0;
  s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['villa'] };
  s = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'villa' });
  ok(count(s.players[0].hand, 'villa') === 1 && s.turn.phase === 'action' && s.turn.actions === 1, '闇市場×ヴィラ：手札+1ア+アクションフェイズ復帰');
}
{ // 闇市場で公共広場を獲得→+1購入（on-gain発動）
  let s = mk2(); s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1;
  s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['forum'] };
  s = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'forum' });
  ok(count(s.players[0].discard, 'forum') === 1 && s.turn.buys === 2, '闇市場×公共広場：獲得時+1購入');
}

/* ============================================================
   Batch E3（集合＝サプライ山上のVPトークン：temple/farmers_market/wild_hunt）
   ============================================================ */
const KING3 = ['temple', 'farmers_market', 'wild_hunt', 'village', 'market', 'moat', 'smithy', 'cellar', 'workshop', 'militia'];
function mk3(o, names) { return E.createInitialState(names || ['A', 'B'], KING3, Object.assign({ startActive: 0 }, o || {})); }

console.log('=== 帝国E3: 神殿（+1VP・名前異なる1-3廃棄・山にVP・獲得時全取得）===');
{
  let s = mk3(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['temple', 'copper', 'estate', 'copper'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'temple' });
  ok(s.players[0].vpTokens === 1 && s.pending.type === 'temple_trash', '神殿：+1VP＋廃棄pending');
  ok(reduce(s, { type: 'TEMPLE_TRASH', cards: ['copper', 'copper'] }).pending, '神殿：同名2枚は拒否');
  ok(reduce(s, { type: 'TEMPLE_TRASH', cards: [] }).pending, '神殿：0枚は拒否（強制1枚）');
  s = reduce(s, { type: 'TEMPLE_TRASH', cards: ['copper', 'estate'] });
  ok(count(s.trash, 'copper') === 1 && count(s.trash, 'estate') === 1 && s.pileVP.temple === 1, '神殿：名前異なる2枚廃棄→山にVP1');
  ok(tdiff(t0, tally(s)).length === 0, '神殿：保存則');
}
{ let s = mk3(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['temple'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'temple' });
  ok(!s.pending && s.players[0].vpTokens === 1 && s.pileVP.temple === 1, '神殿：空手札でも+1VP・山にVP'); }
{ let s = mk3(); s.turn.phase = 'buy'; s.turn.coins = 4; s.pileVP.temple = 3;
  s = reduce(s, { type: 'BUY', card: 'temple' });
  ok(s.players[0].vpTokens === 3 && s.pileVP.temple === 0, '神殿：購入（獲得時）で山上VP3を全取得'); }

console.log('=== 帝国E3: 農家の市場（+1購入・累積・4以上で全取得廃棄）===');
{ let s = mk3(); s.turn.phase = 'action'; s.turn.actions = 1; s.turn.buys = 1; s.players[0].hand = ['farmers_market'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'farmers_market' });
  ok(s.pileVP.farmers_market === 1 && s.turn.coins === 1 && s.turn.buys === 2, '農家の市場：pile0→1・+$1・+1購入'); }
{ let s = mk3(); s.turn.phase = 'action'; s.turn.actions = 1; s.turn.buys = 1; s.pileVP.farmers_market = 3; s.players[0].hand = ['farmers_market'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'farmers_market' });
  ok(s.pileVP.farmers_market === 4 && s.turn.coins === 4, '農家の市場：pile3→4・+$4'); }
{ let s = mk3(); s.turn.phase = 'action'; s.turn.actions = 1; s.turn.buys = 1; s.pileVP.farmers_market = 4; s.players[0].hand = ['farmers_market'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'farmers_market' });
  ok(s.players[0].vpTokens === 4 && s.pileVP.farmers_market === 0 && count(s.trash, 'farmers_market') === 1, '農家の市場：4以上で山VP4全取得＋これを廃棄');
  ok(s.turn.coins === 0 && tdiff(t0, tally(s)).length === 0, '農家の市場：取得時コインなし・保存則'); }

console.log('=== 帝国E3: ワイルドハント（二択）===');
{ let s = mk3(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['wild_hunt']; s.players[0].deck = ['copper', 'copper', 'copper', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'wild_hunt' });
  s = reduce(s, { type: 'WILD_HUNT_RESOLVE', choice: 'cards' });
  ok(s.players[0].hand.length === 3 && s.pileVP.wild_hunt === 1, 'ワイルドハント：+3カード・山にVP1'); }
{ let s = mk3(); s.turn.phase = 'action'; s.turn.actions = 1; s.pileVP.wild_hunt = 5; s.players[0].hand = ['wild_hunt']; const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'wild_hunt' });
  s = reduce(s, { type: 'WILD_HUNT_RESOLVE', choice: 'estate' });
  ok(count(s.players[0].discard, 'estate') === 1 && s.players[0].vpTokens === 5 && s.pileVP.wild_hunt === 0, 'ワイルドハント：屋敷獲得＋山VP5全取得');
  ok(tdiff(t0, tally(s)).length === 0, 'ワイルドハント：保存則'); }
{ let s = mk3(); s.turn.phase = 'action'; s.turn.actions = 1; s.pileVP.wild_hunt = 5; s.supply.estate = 0; s.players[0].hand = ['wild_hunt'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'wild_hunt' });
  s = reduce(s, { type: 'WILD_HUNT_RESOLVE', choice: 'estate' });
  ok((s.players[0].vpTokens || 0) === 0 && s.pileVP.wild_hunt === 5 && !s.pending, 'ワイルドハント：屋敷空なら獲得もVPも無し'); }
{ let s = mk3(); s.pileVP.temple = 3; s.pileVP.wild_hunt = 2;
  const m1 = E.maskStateFor(s, 1);
  ok(m1.pileVP.temple === 3 && m1.pileVP.wild_hunt === 2, '集合：山上VPは相手視点でも見える（公開）'); }

/* ============ E2 CPU ソーク：E2カード入り王国で膠着/例外/保存則なし ============ */
console.log('=== 帝国E2: CPU ソーク ===');
{
  let stuck = 0, exc = 0, consErr = 0, games = 0;
  const soakKings = [KING2, KING3,
    ['forum', 'legionary', 'enchantress', 'archive', 'villa', 'sacrifice', 'charm', 'gold', 'silver', 'market'],
    ['engineer', 'city_quarter', 'royal_blacksmith', 'capital', 'forum', 'sacrifice', 'groundskeeper', 'villa', 'legionary', 'archive'],
    ['temple', 'farmers_market', 'wild_hunt', 'sacrifice', 'villa', 'legionary', 'archive', 'groundskeeper', 'chariot_race', 'forum']];
  for (let g = 0; g < 30; g++) {
    seed = 900 + g * 211;
    const K = soakKings[g % soakKings.length];
    const names = (g % 3 === 0) ? ['C0', 'C1', 'C2'] : ['C0', 'C1'];
    let s = E.createInitialState(names, K, { startActive: 0 });
    s.players.forEach((p, i) => { p.cpuLevel = (g % 2 ? 'hard' : 'normal'); });
    const t0 = tally(s);
    let guard = 0;
    try { while (!s.gameOver && guard++ < 6000) { s = reduce(s, CPU.decide(s)); } }
    catch (e) { exc++; console.log('  例外:', e.message, e.stack ? e.stack.split('\n')[1] : ''); }
    if (guard >= 6000) { stuck++; console.log('  膠着 seed', seed, 'K', K.join(',')); }
    if (tdiff(t0, tally(s)).length) { consErr++; console.log('  保存則差分:', tdiff(t0, tally(s)).join(',')); }
    games++;
  }
  ok(stuck === 0, 'E2 CPU 膠着0（/' + games + '）');
  ok(exc === 0, 'E2 CPU 例外0');
  ok(consErr === 0, 'E2 CPU 保存則違反0');
}

console.log('\n' + (fail === 0 ? '✅ 帝国 全' + pass + '件 PASS' : '❌ 帝国 ' + fail + '件 FAIL / ' + pass + '件 PASS'));
if (fail > 0) process.exit(1);
