/* 不変条件（プロパティベース）テスト — node test/invariants.test.js
   CPU対CPUを決定論シードで多数走らせ、安定点(pending null)ごとに次を検証する:
   1) カード保存則：各カードidの総数（supply＋trash＋全プレイヤー全ゾーン＋blackMarket＋支配一時）が
      開始時から不変（＝複製も消失も起きない。あらゆる状態破壊バグを検知する最強の不変条件）
   2) supply が負にならない  3) 実stateに 'back'（マスク用の伏せ札id）が現れない  4) vpTokens が負にならない
   敵対的キングダム（玉座/王の宮廷＋持続/アタック/獲得/リアクション、闇市場＋「使ったとき」pending財宝）と
   全プール混成ランダムで、玉座連鎖・闇市場・持続などの相互作用を重点的に突く。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Object.create(Math), JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260701;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + m); } }

const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat',
  'princes', // 新プロモ：王子の脇に置いたカード（公開ゾーン。王子本体は inPlay/durationCards に残る）
  'tavern', // 冒険：酒場マット（Reserve カード・守銭奴の銅貨。公開ゾーン）
  'inherited']; // 冒険：相続で脇に置いたカード（サプライから抜いて脇に置く＝物理カードなので保存則に数える）
function tally(s) {
  const t = {}; const add = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; };
  Object.keys(s.supply).forEach((id) => {
    if (id === 'ruins' || id === 'knights' || id === 'castles') return; // 混合山は実カードを state.ruins/knights/castles で数える（下）
    const n = s.supply[id] | 0; for (let i = 0; i < n; i++) add(id);
  });
  (s.ruins || []).forEach(add); (s.knights || []).forEach(add); (s.castles || []).forEach(add); // 混合山の中身（廃墟/騎士/城）
  (s.trash || []).forEach(add); (s.blackMarket || []).forEach(add);
  s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(add)));
  s.players.forEach((p) => (p.archives || []).forEach((a) => (a.cards || []).forEach(add))); // 帝国：資料庫の脇置き（{id,cards}）
  if (s.turn) { (s.turn.possessionGains || []).forEach(add); (s.turn.possessionTrash || []).forEach(add); }
  return t;
}
function diffTally(a, b) { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); const d = []; ks.forEach((k) => { if ((a[k] || 0) !== (b[k] || 0)) d.push(k + ':' + (a[k] || 0) + '→' + (b[k] || 0)); }); return d; }
function hasBack(s) { return s.players.some((p) => ZONES.some((z) => (p[z] || []).some((c) => c === 'back'))) || s.players.some((p) => (p.archives || []).some((a) => (a.cards || []).some((c) => c === 'back'))) || (s.trash || []).some((c) => c === 'back'); }

// 1ゲームを最後まで進め、安定点ごとに全不変条件を検査。違反があれば false と詳細を返す。
function runGame(kingdom, players, landmarks, events) {
  let s = E.createInitialState(players, kingdom, { startActive: 0, landmarks: landmarks || [], events: events || [] });
  const init = tally(s);
  const n = s.players.length;
  let step = 0;
  while (!s.gameOver && step++ < 20000) {
    s = E.reduce(s, CPU.decide(s));
    // 毎ステップ：負リソース・手番/フェーズの妥当性（対話中でも成り立つべき不変条件）
    const t = s.turn;
    if (t) {
      if (t.coins < 0 || t.buys < 0 || t.actions < 0 || (t.potions || 0) < 0) return { okp: false, why: '負リソース step' + step + ' coins/buys/actions/pot=' + [t.coins, t.buys, t.actions, t.potions || 0].join('/') };
      if (!(t.active >= 0 && t.active < n) || (t.phase !== 'action' && t.phase !== 'buy')) return { okp: false, why: '手番/フェーズ不正 step' + step + ' active=' + t.active + ' phase=' + t.phase };
    }
    if (s.pending) continue;
    const d = diffTally(init, tally(s));
    if (d.length) return { okp: false, why: '保存則 step' + step + ': ' + d.join(' ') };
    if (Object.values(s.supply).some((v) => v < 0)) return { okp: false, why: 'supply負 step' + step };
    if (hasBack(s)) return { okp: false, why: 'back混入 step' + step };
    if (s.players.some((p) => (p.vpTokens || 0) < 0)) return { okp: false, why: 'vpTokens負 step' + step };
    if (s.players.some((p) => (p.debt || 0) < 0)) return { okp: false, why: 'debt負 step' + step }; // 帝国：負債は非負
    // 性能：ログは上限で刈られ状態が肥大しない（毎reduceのclone がO(n^2)化するのを防ぐ不変条件）。
    if ((s.log || []).length > 250) return { okp: false, why: 'log肥大 step' + step + ' len=' + s.log.length };
  }
  if (s.gameOver) {
    const r = s.result;
    if (!r || !Array.isArray(r.winners) || r.winners.length < 1 || !Array.isArray(r.scores) || r.scores.length !== n) return { okp: false, why: '終局結果不正: ' + JSON.stringify(r && { w: r.winners })  };
  }
  return { okp: !!s.gameOver, why: s.gameOver ? '' : '未終局(step上限)' };
}

const ALLIDS = [].concat.apply([], Object.values(DOM.POOLS)).filter((id, i, a) => a.indexOf(id) === i);
function randK() { const pool = ALLIDS.slice(), k = []; while (k.length < 10 && pool.length) { const i = Math.floor(sandbox.Math.random() * pool.length); k.push(pool.splice(i, 1)[0]); } return k; }
function mkPlayers(n, off) { return Array.from({ length: n }, (_, i) => ({ name: 'C' + i, isCpu: true, level: ['easy', 'normal', 'hard'][(off + i) % 3] })); }

// A) 敵対的キングダム（玉座/王の宮廷の複製連鎖、闇市場＋pending財宝、持続・アタック混在）
console.log('=== カード保存則: 敵対的キングダム（玉座/王の宮廷・闇市場・持続・アタック） ===');
const ADVERSARIAL = [
  ['throne_room', 'kings_court', 'wharf', 'witch', 'blockade', 'sea_witch', 'bishop', 'expand', 'watchtower', 'market'],
  ['kings_court', 'throne_room', 'pirate', 'corsair', 'charlatan', 'rabble', 'mint', 'forge', 'monkey', 'sailor'],
  ['black_market', 'investment', 'anvil', 'charlatan', 'crystal_ball', 'tiara', 'throne_room', 'witch', 'village', 'market'], // 闇市場＋「使ったとき」pending財宝＝保存則の要注意ケース
  ['throne_room', 'university', 'apprentice', 'golem', 'familiar', 'scrying_pool', 'transmute', 'herbalist', 'apothecary', 'vineyard'],
  ['throne_room', 'kings_court', 'treasure_map', 'feast', 'mining_village', 'wharf', 'market', 'remodel', 'mine', 'chapel'], // 玉座/王の宮廷×宝の地図/祝宴/鉱山の村（自己廃棄カードの複製＝保存則の要注意ケース）
  ['throne_room', 'kings_court', 'procession', 'ratcatcher', 'guide', 'transmogrify', 'royal_carriage', 'distant_lands', 'wine_merchant', 'duplicate'], // 冒険：玉座/王の宮廷/行進×Reserve（酒場マットへ移す自己移動＝マット複製の要注意ケース）
  ['page', 'peasant', 'throne_room', 'kings_court', 'witch', 'moat', 'militia', 'market', 'village', 'smithy'], // 冒険：トラベラー（成長先の非サプライ山・交換窓・champion永続/免疫・warrior/soldierアタック・玉座/王の宮廷×トラベラー）
  ['page', 'peasant', 'upgrade', 'remake', 'forge', 'swindler', 'witch', 'village', 'market', 'moat'], // 冒険：成長先(非サプライ)×ちょうどコスト獲得(改良/リメイク/溶鉱炉)・詐欺師の贈与＝NON_SUPPLY除外漏れのデッドロック/不正獲得の回帰防止
  ['caravan_guard', 'haunted_woods', 'swamp_hag', 'throne_room', 'kings_court', 'witch', 'moat', 'militia', 'market', 'village'], // 冒険：相手の購入フック持続(呪いの森/沼の妖婆)＋隊商の護衛リアクション＋玉座/王の宮廷×これらの持続アタック
  ['raze', 'artificer', 'storyteller', 'messenger', 'relic', 'throne_room', 'kings_court', 'moat', 'witch', 'market'], // 冒険：複雑系（倒壊/工匠/語り部×遺物の財宝アタック中断→再開/使者の配布）＋玉座/王の宮廷×倒壊/語り部
  ['crown', 'charm', 'capital', 'plunder', 'encampment', 'fortune', 'gladiator', 'castles', 'overlord', 'village'], // 帝国：冠の「財宝を2回使う」×選択待ちを立てる財宝(御守り)・+購入/VPを持つ財宝(元手/大金/鹵獲品)＋負債＋分割山＋城の混合山
  ['crown', 'overlord', 'throne_room', 'kings_court', 'village', 'market', 'smithy', 'moat', 'militia', 'workshop'], // 帝国：命令(大君主)の再演は選び直さない×玉座/王の宮廷/冠のネスト
  ['tiara', 'crystal_ball', 'anvil', 'investment', 'charlatan', 'bank', 'collection', 'monument', 'village', 'market'], // 繁栄：ティアラの2回目が pending 財宝(水晶玉/金床/投資/ペテン師)の選択・アタックを取りこぼさない
  ['counterfeit', 'bandit_camp', 'marauder', 'band_of_misfits', 'procession', 'village', 'market', 'smithy', 'moat', 'militia'], // 暗黒時代：偽造通貨の2回プレイ→廃棄（戦利品の自己移動＝lose track）＋命令(はみだし者)×行進の再演
  // E8：命令（大君主/はみだし者）× 自己移動札（祝宴/鉱山の村/宝の地図/島/倒壊/陣地/農家の市場）＝自己移動は失敗し命令カードも動かない
  ['overlord', 'band_of_misfits', 'feast', 'mining_village', 'treasure_map', 'island', 'raze', 'encampment', 'farmers_market', 'throne_room'],
  // E8：命令（船長/王子）× 自己移動札＋Reserve（酒場マットへの自己移動）＋玉座/王の宮廷のネスト
  ['captain', 'prince', 'mining_village', 'ratcatcher', 'guide', 'duplicate', 'death_cart', 'raze', 'throne_room', 'kings_court'],
];
{
  let allOk = true;
  for (let a = 0; a < ADVERSARIAL.length; a++) {
    for (let sd = 0; sd < 6; sd++) {
      const r = runGame(ADVERSARIAL[a], mkPlayers(2 + (sd % 3), sd));
      if (!r.okp) { allOk = false; console.log('    ADV' + a + ' sd' + sd + ': ' + r.why + ' k=' + ADVERSARIAL[a].join(',')); }
    }
  }
  ok(allOk, '敵対的キングダム 24戦すべて保存則・不変条件を満たし終局');
}

// B) 全プール混成ランダム
console.log('=== カード保存則: 全プール混成ランダム王国 ===');
{
  let allOk = true, ran = 0;
  for (let g = 0; g < 60; g++) {
    const r = runGame(randK(), mkPlayers(2 + (g % 3), g)); ran++;
    if (!r.okp) { allOk = false; console.log('    MIX' + g + ': ' + r.why); }
  }
  ok(allOk, '全プール混成ランダム ' + ran + '戦すべて保存則・不変条件を満たし終局');
}

// C) 出荷セット（各セットを実際に組んで検証）
console.log('=== カード保存則: 出荷セット（固定/ランダム各種） ===');
{
  const sets = ['basic', 'intrigue', 'seaside', 'alchemy', 'prosperity', 'cornucopia', 'guilds', 'hinterlands', 'darkages', 'adventures', 'adventures-events', 'empires', 'empires-landmarks', 'empires-events', 'promo2-pack', 'random', 'random-promo', 'random-seaside', 'random-alchemy', 'random-prosperity', 'random-cornucopia', 'random-guilds', 'random-hinterlands', 'random-darkages', 'random-adventures', 'random-empires'];
  let allOk = true;
  for (const setId of sets) {
    for (let sd = 0; sd < 3; sd++) {
      const k = DOM.kingdomForSet ? DOM.kingdomForSet(setId) : null;
      if (!k) continue;
      const lm = DOM.landmarksForSet ? DOM.landmarksForSet(setId) : []; // 帝国：empires-landmarks は横型ランドマーク2枚付き
      const ev = DOM.eventsForSet ? DOM.eventsForSet(setId) : [];       // 帝国：empires-events は横型イベント2枚付き
      const r = runGame(k, mkPlayers(2 + (sd % 3), sd), lm, ev);
      if (!r.okp) { allOk = false; console.log('    ' + setId + ' sd' + sd + ' [' + lm.join(',') + '][' + ev.join(',') + ']: ' + r.why); }
    }
  }
  ok(allOk, '出荷セット各種すべて保存則・不変条件を満たし終局');
}

// E) 帝国：横型ランドスケープ（ランドマーク）。得点/獲得トリガーを変えるが VPトークンは非カード＝保存則に無関係。
//    全21種を（ペアで）少なくとも1回ずつ通し、闘技場/峠の新pendingが CPU で終端することを確認する。
console.log('=== カード保存則: ランドマーク（帝国・横型・全21種）===');
{
  const LM_PAIRS = [
    ['arena', 'mountain_pass'], ['tomb', 'battlefield'], ['aqueduct', 'defiled_shrine'],
    ['obelisk', 'keep'], ['tower', 'wall'], ['labyrinth', 'basilica'], ['colonnade', 'baths'],
    ['museum', 'fountain'], ['orchard', 'palace'], ['wolf_den', 'triumphal_arch'], ['bandit_fort', 'mountain_pass'],
  ];
  const K = DOM.KINGDOM_EMPIRES;
  let allOk = true;
  for (let i = 0; i < LM_PAIRS.length; i++) {
    for (let sd = 0; sd < 3; sd++) {
      const r = runGame(K, mkPlayers(2 + (sd % 3), sd), LM_PAIRS[i]);
      if (!r.okp) { allOk = false; console.log('    LM ' + LM_PAIRS[i].join('+') + ' sd' + sd + ': ' + r.why); }
    }
  }
  // 全プール混成王国にランドマークを付けて fuzz（landmarkVP/pileVP が保存則の tally に混ざらないことの確認）。
  for (let g = 0; g < 12; g++) {
    const lm = DOM.pickLandmarks(2, DOM.LANDMARKS_EMPIRES);
    const r = runGame(randK(), mkPlayers(2 + (g % 3), g), lm);
    if (!r.okp) { allOk = false; console.log('    LM-MIX' + g + ' [' + lm.join(',') + ']: ' + r.why); }
  }
  ok(allOk, 'ランドマーク各種すべて保存則・不変条件を満たし終局（VPトークンは非カード）');
}

// E2) 帝国：横型イベント（買う横型）。CPU が bestEventBuy で買い、新pending（tax_pile/donate_trash/annex_keep 等）が
//    終端し、負債経済（pileDebt/donateNext は非カード＝保存則に無関係）でも保存則・終局が保たれることを確認する。
console.log('=== カード保存則: 帝国イベント（買う横型・全13種）===');
{
  const EV_PAIRS = [
    ['delve', 'wedding'], ['dominate', 'windfall'], ['conquest', 'triumph'],
    ['salt_the_earth', 'banquet'], ['advance', 'ritual'], ['tax', 'donate'],
    ['annex', 'delve'], ['tax', 'conquest'], ['donate', 'annex'],
  ];
  const K = DOM.KINGDOM_EMPIRES;
  let allOk = true;
  for (let i = 0; i < EV_PAIRS.length; i++) {
    for (let sd = 0; sd < 3; sd++) {
      const r = runGame(K, mkPlayers(2 + (sd % 3), sd), [], EV_PAIRS[i]);
      if (!r.okp) { allOk = false; console.log('    EV ' + EV_PAIRS[i].join('+') + ' sd' + sd + ': ' + r.why); }
    }
  }
  // 全13種を同時に付けて（CPUがどれを買っても）保存則・終局・非ループを確認。
  for (let sd = 0; sd < 6; sd++) {
    const r = runGame(K, mkPlayers(2 + (sd % 3), sd), [], DOM.EVENTS_EMPIRES.slice());
    if (!r.okp) { allOk = false; console.log('    EV-ALL sd' + sd + ': ' + r.why); }
  }
  // 全プール混成王国にイベントを付けて fuzz（pileDebt/負債が保存則の tally に混ざらないことの確認）。
  for (let g = 0; g < 12; g++) {
    const ev = DOM.pickLandmarks(2, DOM.EVENTS_EMPIRES);
    const r = runGame(randK(), mkPlayers(2 + (g % 3), g), [], ev);
    if (!r.okp) { allOk = false; console.log('    EV-MIX' + g + ' [' + ev.join(',') + ']: ' + r.why); }
  }
  ok(allOk, '帝国イベント各種すべて保存則・不変条件を満たし終局（負債/pileDebt は非カード・新pendingが終端）');
}

// E3) 冒険：横型イベント20種（買う横型・トークン中心）。相続の脇置き（p.inherited）はサプライから抜いた
//     物理カード＝保存則の tally に数える。山トークン（pileTokens）・旅/-1カード/-$1トークンは非カード。
//     使節団の追加ターン・財宝ロック（購入後は財宝を出せない）でも CPU が膠着しないことを確認する。
console.log('=== カード保存則: 冒険イベント（買う横型・全20種）===');
{
  const EV_PAIRS = [
    ['alms', 'borrow'], ['quest', 'save'], ['scouting_party', 'travelling_fair'],
    ['bonfire', 'expedition'], ['ferry', 'plan'], ['mission', 'pilgrimage'],
    ['ball', 'raid'], ['seaway', 'trade'], ['lost_arts', 'training'],
    ['inheritance', 'pathfinding'], ['mission', 'inheritance'], ['travelling_fair', 'ball'],
  ];
  const K = DOM.KINGDOM_ADVENTURES;
  let allOk = true;
  for (let i = 0; i < EV_PAIRS.length; i++) {
    for (let sd = 0; sd < 3; sd++) {
      const r = runGame(K, mkPlayers(2 + (sd % 3), sd), [], EV_PAIRS[i]);
      if (!r.okp) { allOk = false; console.log('    AE ' + EV_PAIRS[i].join('+') + ' sd' + sd + ': ' + r.why); }
    }
  }
  // 全20種を同時に付けて（CPUがどれを買っても）保存則・終局・非ループを確認。
  for (let sd = 0; sd < 6; sd++) {
    const r = runGame(K, mkPlayers(2 + (sd % 3), sd), [], DOM.EVENTS_ADVENTURES.slice());
    if (!r.okp) { allOk = false; console.log('    AE-ALL sd' + sd + ': ' + r.why); }
  }
  // 全プール混成王国に冒険イベントを付けて fuzz（相続×他拡張・山トークン×分割山/混合山 の相互作用）。
  for (let g = 0; g < 12; g++) {
    const ev = DOM.pickLandmarks(2, DOM.EVENTS_ADVENTURES);
    const r = runGame(randK(), mkPlayers(2 + (g % 3), g), [], ev);
    if (!r.okp) { allOk = false; console.log('    AE-MIX' + g + ' [' + ev.join(',') + ']: ' + r.why); }
  }
  // 帝国イベント＋冒険イベントの混成（負債経済 × トークン経済）。
  for (let g = 0; g < 6; g++) {
    const ev = [DOM.EVENTS_EMPIRES[g % DOM.EVENTS_EMPIRES.length], DOM.EVENTS_ADVENTURES[g % DOM.EVENTS_ADVENTURES.length]];
    const r = runGame(randK(), mkPlayers(2 + (g % 3), g + 40), [], ev);
    if (!r.okp) { allOk = false; console.log('    AE-EMP' + g + ' [' + ev.join(',') + ']: ' + r.why); }
  }
  ok(allOk, '冒険イベント各種すべて保存則・不変条件を満たし終局（相続の脇置きはカード／山トークンは非カード）');
}

// D) 支配(Possession)を強制して保存則検証（CPUは支配を買わないので手で発動させ、被支配ターンを操作させる）。
// 支配は最も複雑（actorルーティング/gain・trash精算/追加ターン/cleanup）で、通常のCPU対戦では踏まれない。
console.log('=== カード保存則: 支配(Possession)を強制（混成＝外部self-trash＋支配のcleanup精算） ===');
{
  const K = ['possession', 'village', 'smithy', 'market', 'militia', 'chapel', 'remodel', 'mine', 'witch', 'laboratory'];
  let allOk = true;
  for (let sd = 0; sd < 12; sd++) {
    let s = E.createInitialState([{ name: 'P0', isCpu: true, level: 'hard' }, { name: 'P1', isCpu: true, level: 'normal' }], K, { startActive: 0 });
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = s.players[0].hand.concat(['possession']); // 手札に支配を1枚追加（既存は保持）
    const init = tally(s);
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'possession' });
    let step = 0, bad = false;
    while (!s.gameOver && step++ < 20000) {
      s = E.reduce(s, CPU.decide(s));
      if (s.pending) continue;
      const d = diffTally(init, tally(s));
      if (d.length) { allOk = false; bad = true; console.log('    POSS sd' + sd + ' step' + step + ': ' + d.join(' ')); break; }
      if (hasBack(s) || Object.values(s.supply).some((v) => v < 0)) { allOk = false; bad = true; break; }
    }
    if (!bad && !s.gameOver) { allOk = false; console.log('    POSS sd' + sd + ': 未終局'); }
  }
  ok(allOk, '支配強制 12戦すべて保存則・不変条件を満たし終局（gain/trash精算・cleanupが保存則を守る）');
}

console.log('\n========================================');
console.log('不変条件テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
