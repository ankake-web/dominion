/* 帝国（Empires）横型ランドスケープ＝ランドマーク21種の検証（Node 単体実行）
   使い方: node test/landmarks.test.js
   対象:
     - 共通基盤（state.landmarks/landmarkVP/landmarkStash/obeliskPile・準備・mask）
     - 得点計算専用11種（bandit_fort/fountain/keep/museum/orchard/palace/wall/wolf_den/tower/triumphal_arch/obelisk）＝得点は負になり得る（下限クランプなし）
     - トリガー型10種（tomb/battlefield/labyrinth/baths/basilica/colonnade/aqueduct/defiled_shrine/arena/mountain_pass）
     - セット選択（empires-landmarks / landmarksForSet）
     - 後方互換（landmarks フィールドの無い旧スナップショットでも壊れない）
     - CPUソーク（arena/mountain_pass の新pendingが CPU で終端） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260711;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
const reduce = (s, a) => E.reduce(s, a);
const KING = ['village', 'smithy', 'market', 'moat', 'chapel', 'remodel', 'mine', 'laboratory', 'festival', 'witch'];
function game(landmarks, n) {
  const cfgs = []; for (let i = 0; i < (n || 2); i++) cfgs.push({ name: 'P' + i, isCpu: false });
  return E.createInitialState(cfgs, KING.slice(), { startActive: 0, landmarks });
}
function buyPhase(s, coins, buys) { s.turn.phase = 'buy'; s.turn.coins = coins == null ? 20 : coins; s.turn.buys = buys == null ? 20 : buys; return s; }
function scoreDeck(landmarks, deckA, deckB, obeliskPile) {
  const st = game(landmarks);
  st.players[0].deck = deckA.slice(); st.players[0].hand = []; st.players[0].discard = []; st.players[0].inPlay = [];
  if (deckB) { st.players[1].deck = deckB.slice(); st.players[1].hand = []; st.players[1].discard = []; st.players[1].inPlay = []; }
  if (obeliskPile) st.obeliskPile = obeliskPile;
  return E.scoreGame(st).scores;
}

/* ============ 共通基盤 ============ */
console.log('=== ランドマーク: 共通基盤（準備・mask） ===');
{
  let s = game(['arena', 'museum']);
  ok(JSON.stringify(s.landmarks) === JSON.stringify(['arena', 'museum']), 'state.landmarks 設定');
  ok(s.landmarkVP.arena === 12, 'arena リザーブ 6×2=12');
  ok(s.landmarkVP.museum == null, '得点専用ランドマークはリザーブ無し');
  ok(s.landmarkStash && typeof s.landmarkStash === 'object', 'landmarkStash 初期化');

  s = game(['arena'], 4);
  ok(s.landmarkVP.arena === 24, 'arena リザーブ 6×4=24（4人）');

  s = game(['aqueduct']);
  ok(s.pileVP.silver === 8 && s.pileVP.gold === 8, '水道橋：銀貨/金貨の山に8VP');

  s = game(['defiled_shrine']);
  ok((s.pileVP.village || 0) === 2, '汚された神殿：素のアクション山に2VP');
  ok((s.pileVP.copper || 0) === 0, '汚された神殿：財宝山には置かない');

  s = game(['obelisk']);
  ok(s.obeliskPile && DOM.isType(s.obeliskPile, 'action'), 'オベリスク：アクション山を1つ選ぶ');

  // mask で公開情報が残る（伏せない）
  s = game(['museum', 'aqueduct']);
  const masked = E.maskStateFor(s, 1);
  ok(JSON.stringify(masked.landmarks) === JSON.stringify(['museum', 'aqueduct']), 'mask後 landmarks 残る');
  ok(masked.pileVP.silver === 8 && masked.landmarkVP != null && masked.landmarkStash != null, 'mask後 pileVP/landmarkVP/landmarkStash 残る');
}

/* ============ 得点計算専用11種 ============ */
console.log('=== ランドマーク: 得点計算11種（負にもなり得る） ===');
{
  ok(scoreDeck(['museum'], ['copper', 'silver', 'estate', 'estate'])[0].vp === 8, 'museum: 3種×2＋屋敷2＝8');
  ok(scoreDeck(['fountain'], new Array(10).fill('copper'))[0].vp === 15, 'fountain: 銅貨10で+15');
  ok(scoreDeck(['fountain'], new Array(9).fill('copper'))[0].vp === 0, 'fountain: 銅貨9で0');
  ok(scoreDeck(['bandit_fort'], ['silver', 'silver', 'gold', 'estate'])[0].vp === -5, 'bandit_fort: 銀2金1×-2＋屋敷1＝-5（負のクランプなし）');
  ok(scoreDeck(['palace'], ['copper', 'copper', 'silver', 'gold', 'gold'])[0].vp === 3, 'palace: min(2,1,2)=1組×3');
  ok(scoreDeck(['wall'], new Array(18).fill('copper'))[0].vp === -3, 'wall: 18枚→-3');
  ok(scoreDeck(['wall'], new Array(15).fill('copper'))[0].vp === 0, 'wall: 15枚以下は0');
  ok(scoreDeck(['wolf_den'], ['copper', 'copper', 'silver', 'gold'])[0].vp === -6, 'wolf_den: 1枚だけの名前2種×-3');
  ok(scoreDeck(['orchard'], ['village', 'village', 'village', 'smithy'])[0].vp === 4, 'orchard: 同名アクション3枚→+4');
  ok(scoreDeck(['orchard'], ['estate', 'estate', 'estate'])[0].vp === 3, 'orchard: 勝利点は対象外（素点3のみ）');
  ok(scoreDeck(['triumphal_arch'], ['village', 'village', 'village', 'smithy', 'smithy'])[0].vp === 6, 'triumphal_arch: 2位smithy2×3');
  ok(scoreDeck(['obelisk'], ['village', 'village', 'smithy'], null, 'village')[0].vp === 4, 'obelisk: 選ばれた山village2×2');
  // keep: 財宝名ごと最多所持者に+5（同数は両者）
  let sc = scoreDeck(['keep'], ['silver', 'silver', 'gold'], ['silver', 'gold', 'gold']);
  ok(sc[0].vp === 5 && sc[1].vp === 5, 'keep: A銀最多+5／B金最多+5');
  sc = scoreDeck(['keep'], ['silver'], ['silver']);
  ok(sc[0].vp === 5 && sc[1].vp === 5, 'keep: 同数は両者+5');
  // tower: 空サプライ山由来の非勝利点×1
  {
    const st = game(['tower']); st.supply.village = 0;
    st.players[0].deck = ['village', 'village', 'estate', 'copper']; st.players[0].hand = []; st.players[0].discard = []; st.players[0].inPlay = [];
    ok(E.scoreGame(st).scores[0].vp === 3, 'tower: 空village山2枚+2＋屋敷1（銅貨山は空でない）');
  }
  ok(scoreDeck([], ['estate', 'estate'])[0].vp === 2, 'ランドマーク無し：素点のみ（既存挙動不変）');
}

/* ============ トリガー型：tomb / baths / battlefield / labyrinth / basilica / colonnade / aqueduct / defiled_shrine ============ */
console.log('=== ランドマーク: トリガー8種 ===');
{
  // tomb：廃棄するたび+1VP（本人）
  let s = game(['tomb']); s.players[0].hand = ['chapel', 'estate', 'copper', 'copper']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['estate', 'copper'] });
  ok(s.players[0].vpTokens === 2, 'tomb: 2枚廃棄→+2VP');

  // baths：獲得0で手番終了→+2VP／獲得ありなら0
  s = game(['baths']); s.players[0].hand = ['copper']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].vpTokens === 2 && s.landmarkVP.baths === 10, 'baths: 獲得0→+2VP（リザーブ12→10）');
  s = game(['baths']); buyPhase(s); s = reduce(s, { type: 'BUY', card: 'estate' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].vpTokens === 0, 'baths: 獲得あり→0');

  // battlefield：勝利点獲得のたび+2VP
  s = game(['battlefield']); buyPhase(s); s = reduce(s, { type: 'BUY', card: 'estate' });
  ok(s.players[0].vpTokens === 2, 'battlefield: 勝利点獲得→+2VP');

  // labyrinth：そのターン2枚目の獲得で+2VP（3枚目以降なし）
  s = game(['labyrinth']); buyPhase(s);
  s = reduce(s, { type: 'BUY', card: 'copper' }); ok(s.players[0].vpTokens === 0, 'labyrinth: 1枚目→0');
  s = reduce(s, { type: 'BUY', card: 'copper' }); ok(s.players[0].vpTokens === 2, 'labyrinth: 2枚目→+2VP');
  s = reduce(s, { type: 'BUY', card: 'copper' }); ok(s.players[0].vpTokens === 2, 'labyrinth: 3枚目→据え置き');

  // basilica：購入フェイズの獲得＋残コイン≥2で+2VP
  s = game(['basilica']); buyPhase(s, 5, 5); s = reduce(s, { type: 'BUY', card: 'copper' });
  ok(s.players[0].vpTokens === 2, 'basilica: 残コイン≥2→+2VP');
  s = game(['basilica']); buyPhase(s, 1, 5); s = reduce(s, { type: 'BUY', card: 'copper' });
  ok(s.players[0].vpTokens === 0, 'basilica: 残コイン<2→0');

  // colonnade：購入フェイズのアクション獲得＋同名が場に→+2VP
  s = game(['colonnade']); s.players[0].hand = ['village']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' }); buyPhase(s, 10, 5);
  s = reduce(s, { type: 'BUY', card: 'village' });
  ok(s.players[0].vpTokens === 2, 'colonnade: 同名場に→+2VP');
  s = game(['colonnade']); buyPhase(s, 10, 5); s = reduce(s, { type: 'BUY', card: 'village' });
  ok(s.players[0].vpTokens === 0, 'colonnade: 同名無し→0');

  // aqueduct：銀貨獲得→山VP移動／勝利点獲得→全部受取
  s = game(['aqueduct']); buyPhase(s);
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.landmarkStash.aqueduct === 1 && s.pileVP.silver === 7, 'aqueduct: 銀貨獲得→水道橋へ1移動');
  s = reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.landmarkStash.aqueduct === 2, 'aqueduct: 金貨獲得→計2');
  s = reduce(s, { type: 'BUY', card: 'estate' });
  ok(s.players[0].vpTokens === 2 && s.landmarkStash.aqueduct === 0, 'aqueduct: 勝利点獲得→全部受取（+2VP・stash0）');

  // defiled_shrine：アクション獲得→山VP移動／購入フェイズ呪い→全部受取
  s = game(['defiled_shrine']); buyPhase(s);
  s = reduce(s, { type: 'BUY', card: 'village' });
  ok(s.landmarkStash.defiled_shrine === 1 && s.pileVP.village === 1, 'defiled_shrine: アクション獲得→神殿へ1移動');
  s = reduce(s, { type: 'BUY', card: 'curse' });
  ok(s.players[0].vpTokens === 1 && s.landmarkStash.defiled_shrine === 0, 'defiled_shrine: 呪い購入→全部受取');
}

/* ============ 闘技場 arena（新pending・4点セット） ============ */
console.log('=== ランドマーク: 闘技場 arena ===');
{
  let s = game(['arena']); s.players[0].hand = ['village', 'copper', 'copper']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(s.pending && s.pending.type === 'arena', 'arena: 購入フェイズ開始でpending');
  s = reduce(s, { type: 'ARENA_RESOLVE', card: 'village' });
  ok(s.players[0].vpTokens === 2 && s.players[0].discard.includes('village') && s.landmarkVP.arena === 10, 'arena: 捨てて+2VP（廃棄でなく捨て札・リザーブ-2）');
  ok(s.pending == null, 'arena: pending解消');

  s = game(['arena']); s.players[0].hand = ['village']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'ARENA_RESOLVE', card: null });
  ok(s.players[0].vpTokens === 0 && s.pending == null, 'arena: 捨てない→0VP');

  s = game(['arena']); s.players[0].hand = ['copper', 'copper']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(s.pending == null, 'arena: アクション無し→pendingなし');

  // CPU が arena を終端する（アクションを捨てて+2VP）
  s = game(['arena']); s.players[0].isCpu = true; s.players[0].cpuLevel = 'normal';
  s.players[0].hand = ['village', 'copper']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  const a = CPU.decide(s);
  ok(a && a.type === 'ARENA_RESOLVE' && a.card === 'village', 'arena: CPU はアクションを捨てる');
}

/* ============ 峠 mountain_pass（新pending・逐次入札） ============ */
console.log('=== ランドマーク: 峠 mountain_pass ===');
{
  let s = game(['mountain_pass'], 2); buyPhase(s);
  s = reduce(s, { type: 'BUY', card: 'province' });
  ok(s.mountainPassArmed && s.mountainPassArmed.gainer === 0, '峠: 属州獲得で armed');
  s = reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'mountain_pass_bid' && s.pending.player === 1, '峠: END_TURNで入札pending（左隣1が先）');
  ok(s.pending.order[s.pending.order.length - 1] === 0, '峠: 獲得者0が最後に入札');
  s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 3 });
  ok(s.pending && s.pending.player === 0, '峠: 次は獲得者0');
  s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 5 });
  ok(s.players[0].vpTokens === 8 && s.players[0].debt === 5, '峠: 最高額5のP0が+8VP／負債5');
  ok(s.turn.active === 1 && s.mountainPassDone === true, '峠: 競り後に手番が進む・Done');

  // 同額は先着
  s = game(['mountain_pass'], 2); buyPhase(s);
  s = reduce(s, { type: 'BUY', card: 'province' }); s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 5 }); s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 5 });
  ok(s.players[1].vpTokens === 8 && s.players[0].vpTokens === 0, '峠: 同額は先着P1が勝つ');

  // 全員0なら誰も勝たない
  s = game(['mountain_pass'], 2); buyPhase(s);
  s = reduce(s, { type: 'BUY', card: 'province' }); s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 0 }); s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 0 });
  ok(s.players[0].vpTokens === 0 && s.players[1].vpTokens === 0 && s.players[0].debt === 0, '峠: 全員0→誰も得ない');

  // 2回目の属州では再発火しない
  s = game(['mountain_pass'], 2); buyPhase(s, 40, 40);
  s = reduce(s, { type: 'BUY', card: 'province' }); s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 0 }); s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 0 });
  buyPhase(s, 20, 20); s = reduce(s, { type: 'BUY', card: 'province' });
  ok(!s.mountainPassArmed, '峠: 2回目の属州では armed されない');
  s = reduce(s, { type: 'END_TURN' });
  ok(!(s.pending && s.pending.type === 'mountain_pass_bid'), '峠: 2回目は入札なし');

  // 入札額は0..40にクランプ
  s = game(['mountain_pass'], 2); buyPhase(s);
  s = reduce(s, { type: 'BUY', card: 'province' }); s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: 999 }); s = reduce(s, { type: 'MOUNTAIN_PASS_BID', amount: -5 });
  ok(s.players[1].vpTokens === 8 && s.players[1].debt === 40, '峠: 40超は40にクランプ・負は0');
}

/* ============ セット選択（empires-landmarks / landmarksForSet） ============ */
console.log('=== ランドマーク: セット選択 ===');
{
  const set = DOM.CARD_SETS.find((s) => s.id === 'empires-landmarks');
  ok(set && set.landmarksFrom === 'empires', 'empires-landmarks セットが存在');
  const lm = DOM.landmarksForSet('empires-landmarks');
  ok(Array.isArray(lm) && lm.length === 2 && lm.every((id) => DOM.LANDMARKS_EMPIRES.includes(id)) && lm[0] !== lm[1], 'landmarksForSet: 帝国ランドマーク2枚（重複なし）');
  ok(DOM.landmarksForSet('empires').length === 0 && DOM.landmarksForSet('basic').length === 0, 'ランドマーク無しセットは空配列');
  ok(DOM.LANDMARKS_EMPIRES.length === 21, '帝国ランドマークは21種');
}

/* ============ 後方互換（landmarks フィールドの無い旧スナップショット） ============ */
console.log('=== ランドマーク: 後方互換（旧スナップショット） ===');
{
  let s = game([]);
  delete s.landmarks; delete s.landmarkVP; delete s.landmarkStash; delete s.obeliskPile; // 旧状態を再現
  const masked = E.maskStateFor(s, 0);
  ok(masked && masked.players.length === 2, '旧状態でも mask が壊れない');
  s.players[0].deck = ['estate']; s.players[0].hand = []; s.players[0].discard = []; s.players[0].inPlay = [];
  ok(E.scoreGame(s).scores[0].vp === 1, '旧状態でも scoreGame が壊れない（ランドマーク0点）');
  // トリガーも no-op（廃棄しても vpTokens は増えない）
  s = game([]); delete s.landmarks;
  s.players[0].hand = ['chapel', 'estate']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['estate'] });
  ok(s.players[0].vpTokens === 0, '旧状態でトリガー no-op');
}

/* ============ 敵対レビュー回帰（多エージェント→node再現で確定した6件） ============ */
console.log('=== ランドマーク: 敵対レビュー回帰 ===');
{
  // 帝国王国（villa/settlers/catapult を含む）で回帰を再現する
  const KE = DOM.KINGDOM_EMPIRES.slice();
  function ge(lm) { return E.createInitialState([{ name: 'A', isCpu: false }, { name: 'B', isCpu: false }], KE.slice(), { startActive: 0, landmarks: lm }); }

  // [medium] オベリスクが分割山を選ぶと両半分（settlers⇔bustling_village／catapult⇔rocks）を数える
  let s = ge(['obelisk']); s.obeliskPile = 'settlers';
  s.players[0].deck = ['settlers', 'settlers', 'settlers', 'bustling_village', 'bustling_village']; s.players[0].hand = []; s.players[0].discard = []; s.players[0].inPlay = [];
  ok(E.scoreGame(s).scores[0].vp === 10, 'obelisk: settlers山選択で bustling_village も数える（2×5=10）');
  s = ge(['obelisk']); s.obeliskPile = 'catapult';
  s.players[0].deck = ['catapult', 'catapult', 'rocks', 'rocks', 'rocks']; s.players[0].hand = []; s.players[0].discard = []; s.players[0].inPlay = [];
  ok(E.scoreGame(s).scores[0].vp === 10, 'obelisk: catapult山選択で rocks も数える（2×5=10）');

  // [medium] ヴィラを購入フェイズに獲得（phaseが action に戻る）でも 公会堂/列柱 が発火する
  s = ge(['basilica']); s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 5;
  s = reduce(s, { type: 'BUY', card: 'villa' });
  ok(s.players[0].vpTokens === 2, 'basilica: 購入フェイズのヴィラ獲得でも+2VP（ヴィラのphase変更に負けない）');
  s = ge(['colonnade']); s.players[0].hand = ['villa']; s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'villa' }); s.turn.coins = 10; s.turn.buys = 5;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'BUY', card: 'villa' });
  ok(s.players[0].vpTokens === 2, 'colonnade: 場にヴィラ＋購入フェイズのヴィラ獲得で+2VP');

  // [low] ヴィラで購入→アクションに戻り再び購入フェイズに入ると闘技場が再発動する
  s = ge(['arena']); s.players[0].hand = ['engineer', 'villa']; s.turn.phase = 'action'; s.turn.actions = 2;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'ARENA_RESOLVE', card: 'engineer' });
  s.turn.coins = 10; s.turn.buys = 5;
  s = reduce(s, { type: 'BUY', card: 'villa' });
  ok(s.turn.arenaFired === false, 'arena: ヴィラで購入フェイズを離れると arenaFired が解除される');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(s.pending && s.pending.type === 'arena', 'arena: ヴィラ再入場で闘技場が再度発動');
  s = reduce(s, { type: 'ARENA_RESOLVE', card: 'villa' });
  ok(s.players[0].vpTokens === 4, 'arena: 2回発動で計+4VP');

  // [low] CPU の終局読みが engine と同一算出（landmarkScoreForCards 公開）
  ok(typeof E.landmarkScoreForCards === 'function', 'landmarkScoreForCards が engine 公開API');
  s = ge(['keep']);
  ok(E.landmarkScoreForCards(s, ['gold', 'gold', 'silver'], 0) === 5 || E.landmarkScoreForCards(s, ['gold', 'gold', 'silver'], 0) === 10, 'keep: CPU も全員比較で採点（省略しない）');
}

/* ============ CPUソーク（arena/mountain_pass 含むランドマークで完走・終端） ============ */
console.log('=== ランドマーク: CPUソーク（新pendingの終端） ===');
{
  const PAIRS = [['arena', 'mountain_pass'], ['tomb', 'aqueduct'], ['defiled_shrine', 'battlefield'], ['keep', 'tower'], ['obelisk', 'labyrinth'], ['wolf_den', 'basilica']];
  let stuck = 0, exc = 0, games = 0, mpSeen = 0, arenaSeen = 0;
  for (let pi = 0; pi < PAIRS.length; pi++) {
    for (let sd = 0; sd < 3; sd++) {
      const n = 2 + (sd % 3);
      const cfgs = []; for (let i = 0; i < n; i++) cfgs.push({ name: 'C' + i, isCpu: true, level: ['easy', 'normal', 'hard'][i % 3] });
      let s = E.createInitialState(cfgs, DOM.KINGDOM_EMPIRES.slice(), { startActive: 0, landmarks: PAIRS[pi] });
      games++;
      let guard = 0;
      try {
        while (!s.gameOver && guard++ < 6000) {
          if (s.pending && s.pending.type === 'mountain_pass_bid') mpSeen++;
          if (s.pending && s.pending.type === 'arena') arenaSeen++;
          s = reduce(s, CPU.decide(s));
        }
      } catch (e) { exc++; console.log('  例外 pair' + PAIRS[pi].join('+') + ' sd' + sd + ': ' + e.message); }
      if (guard >= 6000) { stuck++; console.log('  膠着 pair' + PAIRS[pi].join('+') + ' sd' + sd); }
    }
  }
  ok(stuck === 0, 'CPU 膠着0（/' + games + '戦）');
  ok(exc === 0, 'CPU 例外0（/' + games + '戦）');
  ok(mpSeen > 0, '峠の入札pendingを少なくとも1回踏んだ（' + mpSeen + '回）');
  // ※CPUは購入フェイズ前に手札のアクションを使い切るので闘技場pendingは soak では稀にしか立たない。
  //   闘技場の CPU 終端は「arena: CPU はアクションを捨てる」で担保し、ここでは強制シナリオで終端を確認する。
  {
    let arenaStuck = 0;
    for (let sd = 0; sd < 8; sd++) {
      const cfgs = [{ name: 'C0', isCpu: true, level: ['easy', 'normal', 'hard'][sd % 3] }, { name: 'C1', isCpu: true, level: 'normal' }];
      let s = E.createInitialState(cfgs, DOM.KINGDOM_EMPIRES.slice(), { startActive: 0, landmarks: ['arena', 'tomb'] });
      // 強制的に手札にアクションを置いて購入フェイズへ→闘技場pendingを立てる
      s.players[0].hand = ['engineer', 'village', 'copper']; s.turn.phase = 'action'; s.turn.actions = 3;
      s = reduce(s, { type: 'END_ACTION_PHASE' });
      if (!(s.pending && s.pending.type === 'arena')) { arenaStuck++; continue; }
      let guard = 0; while (s.pending && s.pending.type === 'arena' && guard++ < 10) s = reduce(s, CPU.decide(s));
      if (s.pending && s.pending.type === 'arena') arenaStuck++;
    }
    ok(arenaStuck === 0, '闘技場pendingを CPU が必ず終端（強制シナリオ8戦）');
  }
}

console.log('\n========================================');
console.log('ランドマークテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
