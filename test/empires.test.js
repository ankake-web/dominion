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
function tally(s) { const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; }; Object.keys(s.supply).forEach((id) => { if (id === 'ruins' || id === 'knights' || id === 'castles') return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); }); (s.ruins || []).forEach(a); (s.knights || []).forEach(a); (s.castles || []).forEach(a); (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a); s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a))); s.players.forEach((p) => (p.archives || []).forEach((ar) => (ar.cards || []).forEach(a))); return t; }
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

/* ============================================================
   Batch E4（分割山5組＝10枚）
   ============================================================ */
const KING4 = ['encampment', 'patrician', 'settlers', 'catapult', 'gladiator', 'village', 'market', 'smithy', 'moat', 'cellar'];
function mk4(o, names) { return E.createInitialState(names || ['A', 'B'], KING4, Object.assign({ startActive: 0 }, o || {})); }

console.log('=== 帝国E4: 分割山（初期化・購入ガード・sauna回帰）===');
{
  let s = mk4();
  ok(s.supply.encampment === 5 && s.supply.plunder === 5 && s.supply.gladiator === 5 && s.supply.fortune === 5, '分割山：上5+下5');
  s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 3;
  s = reduce(s, { type: 'BUY', card: 'plunder' });
  ok(count(s.players[0].discard, 'plunder') === 0, '分割山：上が残る間は下(plunder)を買えない');
  s.supply.encampment = 0; s.turn.coins = 8;
  s = reduce(s, { type: 'BUY', card: 'plunder' });
  ok(count(s.players[0].discard, 'plunder') === 1, '分割山：上が尽きたら下を買える');
}
{ let s = E.createInitialState(['A', 'B'], ['sauna', 'village', 'market', 'smithy', 'moat', 'cellar', 'militia', 'workshop', 'remodel', 'mine'], { startActive: 0 });
  ok(s.supply.sauna === 5 && s.supply.avanto === 5, 'sauna/avanto：5+5（一般化しても回帰OK）'); }

console.log('=== 帝国E4: encampment/plunder ===');
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['encampment']; s.players[0].deck = ['copper', 'copper', 'estate'];
  const enc0 = s.supply.encampment; const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'encampment' });
  ok(s.players[0].hand.length === 2 && s.turn.actions === 2 && count(s.players[0].setAside, 'encampment') === 1, '陣地：+2カ+2ア＋金貨/鹵獲品なし→脇へ');
  s.turn.phase = 'buy'; s = reduce(s, { type: 'END_TURN' });
  ok(s.supply.encampment === enc0 + 1 && count(s.players[0].setAside, 'encampment') === 0 && tdiff(t0, tally(s)).length === 0, '陣地：片付けで分割山に戻る・保存則'); }
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['encampment', 'gold']; s.players[0].deck = ['copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'encampment' });
  s = reduce(s, { type: 'ENCAMPMENT_REVEAL', card: 'gold' });
  ok(count(s.players[0].inPlay, 'encampment') === 1, '陣地：金貨公開で場に残る'); }
{ let s = mk4(); s.turn.phase = 'buy'; s.players[0].hand = ['plunder'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'plunder' });
  ok(s.turn.coins === 2 && s.players[0].vpTokens === 1, '鹵獲品：+$2 +1勝利点'); }

console.log('=== 帝国E4: patrician/emporium ===');
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['patrician']; s.players[0].deck = ['copper', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'patrician' });
  ok(count(s.players[0].hand, 'gold') === 1 && s.players[0].deck.length === 0, 'パトリキ：公開した$5以上を手札へ'); }
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['patrician']; s.players[0].deck = ['gold', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'patrician' });
  ok(s.players[0].deck[0] === 'copper', 'パトリキ：$5未満は山札に残す'); }
{ let s = mk4(); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1; s.supply.patrician = 0; s.players[0].inPlay = ['village', 'village', 'village', 'village', 'village'];
  s = reduce(s, { type: 'BUY', card: 'emporium' });
  ok(s.players[0].vpTokens === 2, 'エンポリウム：獲得時 場アクション5枚で+2VP'); }

console.log('=== 帝国E4: settlers/bustling_village ===');
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['settlers']; s.players[0].deck = ['estate']; s.players[0].discard = ['copper', 'gold'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'settlers' });
  s = reduce(s, { type: 'SETTLERS_RESOLVE', take: true });
  ok(count(s.players[0].hand, 'copper') === 1, '開拓者：捨て札の銅貨を手札へ'); }
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['bustling_village']; s.players[0].deck = ['estate']; s.players[0].discard = ['settlers'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'bustling_village' });
  ok(s.turn.actions === 3, '騒がしい村：+3アクション');
  s = reduce(s, { type: 'SETTLERS_RESOLVE', take: true });
  ok(count(s.players[0].hand, 'settlers') === 1, '騒がしい村：捨て札の開拓者を手札へ'); }

console.log('=== 帝国E4: catapult/rocks ===');
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['catapult', 'gold'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate']; const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'catapult' });
  s = reduce(s, { type: 'CATAPULT_TRASH', card: 'gold' });
  ok(count(s.players[1].discard, 'curse') === 1 && s.pending.type === 'discard_down', '投石機：$3以上財宝(gold)で呪い＋手札3まで捨て');
  s = reduce(s, { type: 'DISCARD_DOWN_RESOLVE', cards: ['copper', 'copper'] });
  ok(s.players[1].hand.length === 3 && tdiff(t0, tally(s)).length === 0, '投石機：手札3に・保存則'); }
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['catapult', 'gold']; s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'catapult' });
  s = reduce(s, { type: 'CATAPULT_TRASH', card: 'gold' });
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(count(s.players[1].discard, 'curse') === 0 && s.players[1].hand.length === 5, '投石機：堀で無効化'); }
{ let s = mk4(); s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1; s.supply.catapult = 0;
  s = reduce(s, { type: 'BUY', card: 'rocks' });
  ok(count(s.players[0].discard, 'rocks') === 1 && s.players[0].deck[0] === 'silver', '石：購入(獲得)で銀貨を山札の上に'); }

console.log('=== 帝国E4: gladiator/fortune ===');
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['gladiator', 'gold']; s.players[1].hand = ['copper', 'copper']; const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'gladiator' });
  s = reduce(s, { type: 'GLADIATOR_REVEAL', card: 'gold' });
  ok(s.turn.coins === 3 && s.supply.gladiator === 4 && count(s.trash, 'gladiator') === 1 && tdiff(t0, tally(s)).length === 0, '剣闘士：左隣非公開→+$1＋サプライ剣闘士廃棄・保存則'); }
{ let s = mk4(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['gladiator', 'estate']; s.players[1].hand = ['estate', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'gladiator' });
  s = reduce(s, { type: 'GLADIATOR_REVEAL', card: 'estate' });
  s = reduce(s, { type: 'GLADIATOR_MATCH', reveal: true });
  ok(s.turn.coins === 2 && s.supply.gladiator === 5, '剣闘士：左隣公開でボーナスなし'); }
{ let s = mk4(); s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1; s.players[0].hand = ['fortune', 'fortune'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'fortune' });
  ok(s.turn.coins === 6 && s.turn.buys === 2, '大金：コイン2倍(3→6)＋1購入');
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'fortune' });
  ok(s.turn.coins === 6, '大金：2枚目はコイン2倍なし'); }
{ let s = mk4(); s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1; s.supply.gladiator = 0; s.players[0].inPlay = ['gladiator', 'gladiator']; const t0 = tally(s);
  s = reduce(s, { type: 'BUY', card: 'fortune' });
  ok(count(s.players[0].discard, 'gold') === 2 && s.players[0].debt === 8 && tdiff(t0, tally(s)).length === 0, '大金：獲得時 剣闘士2枚→金貨2枚・負債8・保存則'); }

console.log('=== 帝国E4: 敵対レビュー回帰（exact-cost強制獲得×ロック分割山下段）===');
{ // upgrade で$3廃棄→ちょうど$4がロック中のrocksのみ→強制獲得pendingを立てない（デッドロック回避）
  const K = ['catapult', 'upgrade', 'village', 'moat', 'cellar', 'market', 'festival', 'laboratory', 'woodcutter', 'chapel'];
  let s = E.createInitialState(['P0', 'P1'], K, { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 2; s.players[0].hand = ['upgrade', 'village', 'estate', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'upgrade' });
  s = reduce(s, { type: 'UPGRADE_TRASH', card: 'village' });
  ok(!(s.pending && s.pending.type === 'upgrade'), 'upgrade×rocks：$4がロック下段のみ→獲得pendingを立てない');
  let g = 0; while (s.turn.active === 0 && s.turn.phase === 'action' && g++ < 40) { s = reduce(s, CPU.decide(s)); }
  ok(g < 40, 'upgrade×rocks：CPUが膠着せず進行'); }
{ // アンロック時は通常どおり獲得できる（回帰の裏返し）
  const K = ['catapult', 'upgrade', 'village', 'moat', 'cellar', 'market', 'festival', 'laboratory', 'woodcutter', 'chapel'];
  let s = E.createInitialState(['P0', 'P1'], K, { startActive: 0 });
  s.supply.catapult = 0; s.turn.phase = 'action'; s.turn.actions = 2; s.players[0].hand = ['upgrade', 'village', 'estate', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'upgrade' });
  s = reduce(s, { type: 'UPGRADE_TRASH', card: 'village' });
  s = reduce(s, { type: 'UPGRADE_GAIN', card: 'rocks' });
  ok(count(s.players[0].discard, 'rocks') === 1, 'upgrade×rocks：上段が空(アンロック)なら$4でrocksを獲得できる'); }
{ // procession で$4アクション廃棄→ちょうど$5アクションがロックemporium/bustling_villageのみ→膠着しない
  const K = ['patrician', 'settlers', 'village', 'moat', 'cellar', 'chapel', 'procession', 'remodel', 'woodcutter', 'militia'];
  let s = E.createInitialState(['P0', 'P1'], K, { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 3; s.players[0].hand = ['procession', 'remodel', 'estate', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'procession' });
  s = reduce(s, { type: 'PROCESSION_CHOOSE', card: 'remodel' });
  let g = 0; while (s.turn.active === 0 && s.pending && s.pending.player === 0 && g++ < 40) { s = reduce(s, CPU.decide(s)); }
  ok(g < 40, 'procession×$5アクション：ロック下段のみでもCPUが膠着しない'); }

/* ============================================================
   Batch E5（城8＝混合山）
   ============================================================ */
const KING5 = ['castles', 'village', 'market', 'smithy', 'moat', 'cellar', 'workshop', 'remodel', 'militia', 'chapel'];
function mk5(o, names) { return E.createInitialState(names || ['A', 'B'], KING5, Object.assign({ startActive: 0 }, o || {})); }

console.log('=== 帝国E5: 混合山（人数別・購入順・可変VP）===');
{
  let s2 = mk5({}, ['A', 'B']);
  ok(s2.castles.length === 8 && s2.castles[0] === 'humble_castle' && s2.castles[7] === 'kings_castle', '2人：城8枚昇順');
  let s3 = mk5({}, ['A', 'B', 'C']);
  ok(s3.castles.length === 12 && count(s3.castles, 'humble_castle') === 2 && count(s3.castles, 'kings_castle') === 2 && count(s3.castles, 'crumbling_castle') === 1, '3人：城12枚（Humble/Small/Opulent/Kings×2）');
}
{ let s = mk5(); s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 2;
  s = reduce(s, { type: 'BUY', card: 'castles' });
  ok(count(s.players[0].discard, 'humble_castle') === 1 && s.castles[0] === 'crumbling_castle', '購入：一番上のhumble($3)→次はcrumbling');
  s.turn.coins = 2; s = reduce(s, { type: 'BUY', card: 'castles' });
  ok(count(s.players[0].discard, 'crumbling_castle') === 0, '購入：coins2でcrumbling($4)は買えない'); }
{ let s = mk5(); s.supply.province = 0; s.turn.phase = 'buy';
  s.players[0].deck = ['humble_castle', 'kings_castle', 'small_castle', 'estate']; s.players[0].hand = []; s.players[0].discard = []; s.players[0].inPlay = [];
  s = reduce(s, { type: 'END_TURN' });
  ok(s.gameOver && s.result.scores[0].vp === 12, '可変VP：humble3+kings6+small2+estate1=12（自身含む全城を数える）'); }

console.log('=== 帝国E5: 城のon-gain/on-trash・プレイ効果 ===');
{ let s = mk5(); s.turn.phase = 'buy'; s.turn.coins = 4; s.castles = ['crumbling_castle', 'small_castle']; s.supply.castles = 2; const t0 = tally(s);
  s = reduce(s, { type: 'BUY', card: 'castles' });
  ok(s.players[0].vpTokens === 1 && count(s.players[0].discard, 'silver') === 1 && tdiff(t0, tally(s)).length === 0, '崩れた城：獲得で+1VP+銀貨・保存則'); }
{ let s = mk5(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['chapel', 'crumbling_castle'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'chapel' }); s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['crumbling_castle'] });
  ok(count(s.trash, 'crumbling_castle') === 1 && s.players[0].vpTokens === 1 && count(s.players[0].discard, 'silver') === 1, '崩れた城：廃棄でも+1VP+銀貨'); }
{ let s = mk5(); s.turn.phase = 'buy'; s.turn.coins = 6; s.castles = ['haunted_castle', 'kings_castle']; s.supply.castles = 2;
  s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'BUY', card: 'castles' });
  ok(count(s.players[0].discard, 'gold') === 1 && s.pending && s.pending.type === 'haunted_topdeck' && s.pending.player === 1, '幽霊城：金貨＋相手手札上げ（堀無効＝非アタック）');
  s = reduce(s, { type: 'HAUNTED_TOPDECK', cards: ['copper', 'copper'] });
  ok(s.players[1].hand.length === 3, '幽霊城：相手が手札2枚を山札の上へ'); }
{ let s = mk5(); s.turn.phase = 'buy'; s.turn.coins = 8; s.castles = ['sprawling_castle', 'kings_castle']; s.supply.castles = 2; const t0 = tally(s);
  s = reduce(s, { type: 'BUY', card: 'castles' }); s = reduce(s, { type: 'SPRAWLING_CASTLE_CHOOSE', choice: 'estates' });
  ok(count(s.players[0].discard, 'estate') === 3 && tdiff(t0, tally(s)).length === 0, '広大な城：屋敷3枚獲得・保存則'); }
{ let s = mk5(); s.turn.phase = 'buy'; s.turn.coins = 9; s.castles = ['grand_castle']; s.supply.castles = 1;
  s.players[0].hand = ['estate', 'duchy', 'copper']; s.players[0].inPlay = ['humble_castle'];
  s = reduce(s, { type: 'BUY', card: 'castles' });
  ok(s.players[0].vpTokens === 3, '壮大な城：手札+場の勝利点3枚→+3VP（自身は数えない）'); }
{ let s = mk5(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['small_castle']; s.castles = ['humble_castle', 'crumbling_castle']; s.supply.castles = 2; const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'small_castle' }); s = reduce(s, { type: 'SMALL_CASTLE_RESOLVE', card: 'small_castle' });
  ok(count(s.trash, 'small_castle') === 1 && count(s.players[0].discard, 'humble_castle') === 1 && tdiff(t0, tally(s)).length === 0, '小さい城：これを廃棄→城獲得・保存則'); }
{ let s = mk5(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['opulent_castle', 'estate', 'duchy', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'opulent_castle' }); s = reduce(s, { type: 'OPULENT_CASTLE_DISCARD', cards: ['estate', 'duchy'] });
  ok(s.turn.coins === 4 && count(s.players[0].discard, 'estate') === 1 && count(s.players[0].discard, 'duchy') === 1, '華やかな城：勝利点2枚捨てて+$4（VP保持）'); }
{ let s = mk5(); s.turn.phase = 'buy'; s.players[0].hand = ['humble_castle'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'humble_castle' });
  ok(s.turn.coins === 1, '粗末な城：財宝として+$1'); }
{ let s = mk5(); const m1 = E.maskStateFor(s, 1);
  ok(Array.isArray(m1.castles) && m1.castles.length === 8, '城の山は公開（昇順・全員可視）'); }

console.log('=== 帝国E5: 敵対レビュー回帰（gainer経由の城on-gain＝onGainQueue）===');
{ // remodel($6廃棄→$8獲得)で広大な城→公領/屋敷が発火（finishGainのpending中でも取りこぼさない）
  const K = ['castles', 'remodel', 'village', 'market', 'smithy', 'moat', 'cellar', 'militia', 'chapel', 'workshop'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 3; s.castles = ['sprawling_castle', 'grand_castle', 'kings_castle']; s.supply.castles = 3;
  s.players[0].hand = ['remodel', 'gold', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
  s = reduce(s, { type: 'REMODEL_TRASH', card: 'gold' });
  s = reduce(s, { type: 'REMODEL_GAIN', card: 'castles' });
  ok(count(s.players[0].discard, 'sprawling_castle') === 1 && s.pending && s.pending.type === 'sprawling_castle', 'remodel経由でも広大な城の選択が発火（onGainQueue）');
  s = reduce(s, { type: 'SPRAWLING_CASTLE_CHOOSE', choice: 'estates' });
  ok(count(s.players[0].discard, 'estate') === 3, 'remodel経由：屋敷3枚を獲得'); }
{ // remodel($4廃棄→$6獲得)で幽霊城→金貨＋相手手札上げが発火
  const K = ['castles', 'remodel', 'village', 'market', 'smithy', 'moat', 'cellar', 'militia', 'chapel', 'workshop'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 3; s.castles = ['haunted_castle', 'grand_castle', 'kings_castle']; s.supply.castles = 3;
  s.players[0].hand = ['remodel', 'smithy', 'copper', 'copper', 'copper']; s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
  s = reduce(s, { type: 'REMODEL_TRASH', card: 'smithy' });
  s = reduce(s, { type: 'REMODEL_GAIN', card: 'castles' });
  ok(count(s.players[0].discard, 'gold') === 1 && s.pending && s.pending.type === 'haunted_topdeck', 'remodel経由でも幽霊城の金貨＋相手手札上げが発火'); }

/* ============================================================
   Batch E6（命令＝overlord/crown）
   ============================================================ */
const KING6 = ['overlord', 'crown', 'workshop', 'village', 'market', 'fishing_village', 'militia', 'moat', 'smithy', 'cellar'];
function mk6(o, names) { return E.createInitialState(names || ['A', 'B'], KING6, Object.assign({ startActive: 0 }, o || {})); }

console.log('=== 帝国E6: 大君主（サプライの$5以下・非命令・非持続を使う）===');
{ // 候補列挙：非命令・非持続・コスト5以下（大君主自身は命令なので除外・漁村は持続なので除外）
  let s = mk6();
  const cands = E.overlordTargets(s);
  ok(cands.includes('village') && cands.includes('market') && cands.includes('workshop') && cands.includes('militia') && cands.includes('moat') && cands.includes('smithy') && cands.includes('cellar'), '対象：非命令・非持続の$5以下アクションを列挙');
  ok(!cands.includes('overlord'), '対象から大君主自身（命令）を除外');
  ok(!cands.includes('fishing_village'), '対象から漁村（持続）を除外');
}
{ // crownはコスト5・非命令・非持続なので overlordTargets に含まれるべき
  let s = mk6();
  ok(E.overlordTargets(s).includes('crown'), '冠（cost5・非命令）は大君主の対象に含まれる');
}
{ // プレイ→pending→サプライに残したまま使用（村：+1カ+1ア×2倍のうち大君主分は消費しない）
  let s = mk6(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['overlord']; s.players[0].deck = ['copper', 'copper'];
  const supBefore = s.supply.village;
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'overlord' });
  ok(s.pending && s.pending.type === 'overlord', '大君主プレイ→pending');
  s = reduce(s, { type: 'OVERLORD_PLAY', card: 'village' });
  ok(!s.pending && s.supply.village === supBefore && count(s.players[0].discard, 'village') === 0 && count(s.players[0].inPlay, 'village') === 0, '村はサプライに残ったまま（獲得も場移動もしない）');
  ok(s.players[0].hand.length === 1 && s.turn.actions === 2, '村の効果（+1カード+2アクション）は適用される');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK（village はサプライに残る＝カード移動なし）');
}
{ // 無効な対象（持続/命令）は拒否される
  let s = mk6(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['overlord'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'overlord' });
  s = reduce(s, { type: 'OVERLORD_PLAY', card: 'fishing_village' });
  ok(s.pending && s.pending.type === 'overlord', '漁村（持続）は拒否・pending維持');
  s = reduce(s, { type: 'OVERLORD_PLAY', card: 'overlord' });
  ok(s.pending && s.pending.type === 'overlord', '大君主自身（命令）は拒否・pending維持');
  s = reduce(s, { type: 'OVERLORD_PLAY', card: null });
  ok(s.pending && s.pending.type === 'overlord', '対象があるうちは辞退できない（公式＝mayではない）');
}
{ // 分割山ロック中の下段は対象にならない（陣地/鹵獲品を王国に含む別キングダムで検証）
  const K = ['overlord', 'encampment', 'village', 'market', 'smithy', 'moat', 'cellar', 'militia', 'workshop', 'chapel'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  ok(!E.overlordTargets(s).includes('plunder'), '分割山の下段（鹵獲品）は上段が残る間は対象にならない（分割山ロック）');
}
{ // 大君主で獲得系（工房）を使う→サプライ外の対話が正しく解決する
  let s = mk6(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['overlord'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'overlord' });
  s = reduce(s, { type: 'OVERLORD_PLAY', card: 'workshop' });
  ok(s.pending && s.pending.type === 'workshop', '工房を大君主で使う→獲得pendingが立つ');
  s = reduce(s, { type: 'WORKSHOP_GAIN', card: 'silver' });
  ok(!s.pending && count(s.players[0].discard, 'silver') === 1 && s.supply.workshop > 0, '工房は場に出ないままサプライに残り、獲得は正常に機能');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
}
{ // 王国に対象がなければ pending を立てない（船長/はみだし者と同型。9枚すべて持続＝非対象）
  const K = ['overlord', 'fishing_village', 'lighthouse', 'wharf', 'caravan', 'merchant_ship', 'tactician', 'outpost', 'haven', 'sea_witch'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['overlord'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'overlord' });
  ok(!s.pending, '対象（非持続アクション）が皆無なら pending を立てず終わる');
}

console.log('=== 帝国E6: 冠（現在フェイズで対象が変わる玉座）===');
{ // アクションフェイズ：手札のアクションを2回使う
  let s = mk6(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['crown', 'village']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'crown' });
  ok(s.pending && s.pending.type === 'crown' && s.pending.mode === 'action', '冠（アクションフェイズ）→mode=action');
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'village' });
  ok(!s.pending, '村を選択→即時解決（1回目その場・2回目はreplay経由で自動継続）');
  ok(count(s.players[0].inPlay, 'village') === 1 && count(s.players[0].inPlay, 'crown') === 1, '村は場に1枚（2回目は同じ物理カードを再使用）');
  // 村は+1カード+2アクション。2回使うので+2カード+4アクション。冠自身の-1アクション込みで 1-1+2+2=4。
  ok(s.players[0].hand.length === 2 && s.turn.actions === 4, '村を2回使った効果（+2カード＋合計+4アクション）');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
}
{ // 辞退できる（してよい＝may）
  let s = mk6(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['crown', 'village'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'crown' });
  s = reduce(s, { type: 'CROWN_CHOOSE', card: null });
  ok(!s.pending && s.players[0].hand.includes('village') && count(s.players[0].inPlay, 'village') === 0, '辞退すると村は手札に残ったまま');
}
{ // 購入フェイズ：手札の財宝を2回使う
  let s = mk6(); s.turn.phase = 'buy'; s.turn.coins = 0;
  s.players[0].hand = ['crown', 'gold'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  ok(s.pending && s.pending.type === 'crown' && s.pending.mode === 'treasure', '冠（購入フェイズ）→mode=treasure');
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'gold' });
  ok(!s.pending && s.turn.coins === 6 && count(s.players[0].inPlay, 'gold') === 1, '金貨を2回使う＝+$6（移動は1回だけ）');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
}
{ // 購入フェイズ：財宝が手札になければ pending を立てない
  let s = mk6(); s.turn.phase = 'buy'; s.turn.coins = 0; s.players[0].hand = ['crown'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  ok(!s.pending && s.turn.coins === 0, '財宝が無ければ pending 無しで終わる（冠自身は coin無し）');
}
{ // アクションフェイズ：手札にアクションが無ければ pending を立てない
  let s = mk6(); s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['crown'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'crown' });
  ok(!s.pending, 'アクションが手札に無ければ pending 無しで終わる');
}
{ // 玉座×冠：ネストした選択が正しく連鎖し、カードの複製/消失が起きない
  //   玉座の「冠を2回使う」の2回目は、1回目の冠が村を消費した後（手札が空）に評価されるため
  //   対象なしで不発になる（玉座×玉座のネストと同型の既存挙動）＝村は計2回（冠1回ぶん）使われる。
  let s = mk6(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['throne_room', 'crown', 'village']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'crown' });
  ok(s.pending && s.pending.type === 'crown' && s.pending.mode === 'action', '玉座で冠を使う→1回目の冠がmode=action pendingを立てる');
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'village' });
  ok(!s.pending, '村を選択→残りは自動解決（玉座の2回目の冠は対象なしで不発）');
  ok(count(s.players[0].inPlay, 'village') === 1 && count(s.players[0].inPlay, 'crown') === 1 && count(s.players[0].inPlay, 'throne_room') === 1, '村・冠・玉座ともに場に1枚（複製なし）');
  ok(s.turn.actions === 4, '村2回ぶんの+アクション（1-1+2+2=4）');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK（玉座×冠のネストでもカード消失なし）');
}

console.log('=== 帝国E6: 敵対レビュー回帰① 冠の2回目は「効果を丸ごと」もう一度適用する ===');
// 旧実装は2回目を treasureReplayCoins（コイン再計算＋3件の特例）で済ませており、
// 御守りの2回目の二択・元手/大金の+1購入・鹵獲品の+1VP・愚者の黄金の動的$4 などを取りこぼしていた。
const KING6T = ['crown', 'charm', 'capital', 'plunder', 'encampment', 'fortune', 'gladiator', 'village', 'market', 'smithy'];
function mk6t(o, names) { return E.createInitialState(names || ['A', 'B'], KING6T, Object.assign({ startActive: 0 }, o || {})); }
{ // 御守り：2回目の二択がちゃんと再度出る（両方 coins を選べば +2購入 +4コイン）
  let s = mk6t(); s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 1;
  s.players[0].hand = ['crown', 'charm'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'charm' });
  ok(s.pending && s.pending.type === 'charm_mode', '冠×御守り：1回目の二択が出る');
  s = reduce(s, { type: 'CHARM_MODE', mode: 'coins' });
  ok(s.pending && s.pending.type === 'charm_mode', '冠×御守り：2回目の二択も出る（取りこぼさない）');
  s = reduce(s, { type: 'CHARM_MODE', mode: 'coins' });
  ok(!s.pending && s.turn.coins === 4 && s.turn.buys === 3, '冠×御守り：二択を2回とも適用（+4コイン +2購入）');
}
{ // 元手：+6コイン+1購入 を2回ぶん
  let s = mk6t(); s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 1;
  s.players[0].hand = ['crown', 'capital'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'capital' });
  ok(!s.pending && s.turn.coins === 12 && s.turn.buys === 3, '冠×元手：+12コイン・+2購入（2回目の+1購入を落とさない）');
}
{ // 鹵獲品：+2コイン+1VP を2回ぶん
  let s = mk6t(); s.turn.phase = 'buy'; s.turn.coins = 0;
  s.players[0].hand = ['crown', 'plunder']; s.players[0].vpTokens = 0;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'plunder' });
  ok(!s.pending && s.turn.coins === 4 && s.players[0].vpTokens === 2, '冠×鹵獲品：+4コイン・+2勝利点（2回目のVPを落とさない）');
}
{ // 大金：+1購入は毎回・コイン2倍はこのターン最初の1回だけ（公式）
  let s = mk6t(); s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s.players[0].hand = ['crown', 'fortune'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'fortune' });
  ok(!s.pending && s.turn.coins === 6 && s.turn.buys === 3, '冠×大金：コイン2倍は1回だけ・+1購入は2回ぶん');
}
{ // 愚者の黄金：2回目は$4（動的コイン）
  const K = ['crown', 'fools_gold', 'village', 'market', 'smithy', 'moat', 'cellar', 'militia', 'workshop', 'chapel'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.turn.phase = 'buy'; s.turn.coins = 0; s.players[0].hand = ['crown', 'fools_gold'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'fools_gold' });
  ok(!s.pending && s.turn.coins === 5, '冠×愚者の黄金：1回目$1＋2回目$4＝$5（動的コイン）');
}
{ // 保存則：冠の2回目で対象カードが複製されない
  let s = mk6t(); s.turn.phase = 'buy'; s.players[0].hand = ['crown', 'plunder'];
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'plunder' });
  ok(count(s.players[0].inPlay, 'plunder') === 1 && tdiff(t0, tally(s)).length === 0, '冠の2回目でカードは複製されない（場に1枚・保存則OK）');
}

console.log('=== 帝国E6: 敵対レビュー回帰② 冠のモードは「その時点のフェイズ」で決まる ===');
{ // 語り部（冒険）で アクションフェイズ中に冠を財宝として出す→アクションモードになる（公式）
  const K = ['crown', 'storyteller', 'village', 'market', 'smithy', 'moat', 'cellar', 'militia', 'workshop', 'chapel'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['storyteller', 'crown', 'village']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'storyteller' });
  ok(s.pending && s.pending.type === 'storyteller', '語り部：財宝を選ぶ');
  s = reduce(s, { type: 'STORYTELLER_PLAY', cards: ['crown'] });
  ok(s.pending && s.pending.type === 'crown' && s.pending.mode === 'action', '語り部で出した冠はアクションフェイズ＝アクションモード（公式）');
}
{ // 購入フェイズなら財宝モード
  let s = mk6(); s.turn.phase = 'buy'; s.players[0].hand = ['crown', 'gold'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  ok(s.pending && s.pending.mode === 'treasure', '購入フェイズ＝財宝モード');
}

console.log('=== 帝国E6: 敵対レビュー回帰③ 命令の再演は「1回目に選んだカード」を使う ===');
{ // 冠（アクションモード）で大君主を2回使う→2回目は選び直せず同じカード
  let s = mk6(); s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['crown', 'overlord']; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'crown' });
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'overlord' });
  ok(s.pending && s.pending.type === 'overlord', '冠×大君主：1回目の対象選択が出る');
  const actBefore = s.turn.actions;
  s = reduce(s, { type: 'OVERLORD_PLAY', card: 'village' });
  ok(!s.pending, '2回目は選択待ちを開かない（＝選び直せない・公式ルーリング）');
  ok(s.turn.actions === actBefore + 4, '村を2回使った（+2アクション×2）');
  ok(s.players[0].hand.length === 2, '村を2回使った（+1カード×2）');
  ok(s.supply.village === 10 && count(s.players[0].inPlay, 'village') === 0, '村はサプライに残ったまま');
}
{ // 玉座×大君主も同様（再演では同じカード）
  const K = ['overlord', 'throne_room', 'village', 'market', 'smithy', 'moat', 'cellar', 'militia', 'workshop', 'chapel'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['throne_room', 'overlord'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'overlord' });
  s = reduce(s, { type: 'OVERLORD_PLAY', card: 'smithy' });
  ok(!s.pending, '玉座×大君主：2回目は選び直せない');
  ok(s.players[0].hand.length === 6, '鍛冶屋を2回使った（+3カード×2＝手札6枚）');
}
{ // ゴーレム（別カードの新しいプレイ）は再演ではない＝毎回選び直せる
  const K = ['overlord', 'golem', 'village', 'market', 'smithy', 'moat', 'cellar', 'militia', 'workshop', 'chapel'];
  let s = E.createInitialState(['A', 'B'], K, { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.turn.commandAs = { overlord: 'village' }; // 以前の大君主のプレイで記憶が残っている状況
  s.players[0].hand = ['overlord']; s.players[0].deck = ['copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'overlord' });
  ok(s.pending && s.pending.type === 'overlord', '通常プレイ（非再演）は記憶を使わず選択待ちを開く');
}

console.log('=== 帝国E6: CPU decidePending（終端保証）===');
{
  let s = mk6(); s.turn.phase = 'action'; s.players[0].hand = ['overlord'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'overlord' });
  const a = CPU.decide(s);
  ok(a && a.type === 'OVERLORD_PLAY' && a.card != null, 'CPU：大君主の対象がある限り必ず非nullを返す');
}
{
  let s = mk6(); s.turn.phase = 'action'; s.players[0].hand = ['crown', 'smithy'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'crown' });
  const a = CPU.decide(s);
  ok(a && a.type === 'CROWN_CHOOSE' && a.card === 'smithy', 'CPU：冠（action）は最良のアクションを選ぶ');
}
{
  let s = mk6(); s.turn.phase = 'buy'; s.players[0].hand = ['crown', 'silver', 'copper'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'crown' });
  const a = CPU.decide(s);
  ok(a && a.type === 'CROWN_CHOOSE' && a.card === 'silver', 'CPU：冠（treasure）は最もコインの高い財宝を選ぶ');
}

console.log('=== 帝国E6: CPU ソーク（大君主/冠入り王国）===');
{
  let stuck = 0, exc = 0, consErr = 0, games = 0;
  const soakKings6 = [KING6,
    ['overlord', 'crown', 'encampment', 'castles', 'temple', 'sacrifice', 'villa', 'legionary', 'forum', 'groundskeeper'],
    ['overlord', 'crown', 'throne_room', 'king_court', 'witch', 'village', 'market', 'smithy', 'moat', 'militia'].map((c) => c === 'king_court' ? 'kings_court' : c),
  ];
  for (let g = 0; g < 24; g++) {
    seed = 700 + g * 233;
    const K = soakKings6[g % soakKings6.length];
    const names = (g % 3 === 0) ? ['C0', 'C1', 'C2'] : ['C0', 'C1'];
    let s = E.createInitialState(names, K, { startActive: 0 });
    s.players.forEach((p) => { p.cpuLevel = (g % 2 ? 'hard' : 'normal'); });
    const t0 = tally(s);
    let guard = 0;
    try { while (!s.gameOver && guard++ < 6000) { s = reduce(s, CPU.decide(s)); } }
    catch (e) { exc++; console.log('  例外:', e.message, e.stack ? e.stack.split('\n')[1] : ''); }
    if (guard >= 6000) { stuck++; console.log('  膠着 seed', seed, 'K', K.join(',')); }
    if (tdiff(t0, tally(s)).length) { consErr++; console.log('  保存則差分:', tdiff(t0, tally(s)).join(',')); }
    games++;
  }
  ok(stuck === 0, 'E6 CPU 膠着0（/' + games + '）');
  ok(exc === 0, 'E6 CPU 例外0');
  ok(consErr === 0, 'E6 CPU 保存則違反0');
}

/* ============ E2 CPU ソーク：E2カード入り王国で膠着/例外/保存則なし ============ */
console.log('=== 帝国E2: CPU ソーク ===');
{
  let stuck = 0, exc = 0, consErr = 0, games = 0;
  const soakKings = [KING2, KING3, KING4, KING5,
    ['forum', 'legionary', 'enchantress', 'archive', 'villa', 'sacrifice', 'charm', 'gold', 'silver', 'market'],
    ['engineer', 'city_quarter', 'royal_blacksmith', 'capital', 'forum', 'sacrifice', 'groundskeeper', 'villa', 'legionary', 'archive'],
    ['temple', 'farmers_market', 'wild_hunt', 'sacrifice', 'villa', 'legionary', 'archive', 'groundskeeper', 'chariot_race', 'forum'],
    ['encampment', 'gladiator', 'catapult', 'settlers', 'patrician', 'sacrifice', 'temple', 'legionary', 'villa', 'forum'],
    ['castles', 'gladiator', 'catapult', 'temple', 'sacrifice', 'villa', 'legionary', 'forum', 'groundskeeper', 'market']];
  for (let g = 0; g < 42; g++) {
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
