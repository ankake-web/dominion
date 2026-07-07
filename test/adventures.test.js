/* 冒険（Adventures）ゲームロジックの検証（Node 単体実行）
   使い方: node test/adventures.test.js
   対象: CARD_SET昇格（固定10種/random/POOLS.travellers分離/成長山）／トラベラー全系列＋交換／
         champion永続・免疫・アクション毎+1／teacher山トークン／Reserve酒場マット／トークン（旅/-1カード/-$1）／
         持続・リアクション・相手の購入フック・複雑系／敵対レビュー由来の回帰テスト／CPU通し・カード保存則 */
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
function count(arr, id) { return (arr || []).filter((c) => c === id).length; }
const reduce = (s, a) => E.reduce(s, a);
function mk(kingdom, opts) { return E.createInitialState(['A', 'B'], kingdom, Object.assign({ startActive: 0 }, opts || {})); }
function setup(kingdom, hand, deck, opts) {
  const s = mk(kingdom, opts);
  s.players[0].hand = hand.slice();
  s.players[0].deck = (deck || []).slice();
  s.players[0].discard = [];
  if (opts && opts.p1hand) s.players[1].hand = opts.p1hand.slice();
  if (opts && opts.p1deck) s.players[1].deck = opts.p1deck.slice();
  s.turn.phase = 'action'; s.turn.actions = (opts && opts.actions) || 5; s.turn.buys = 3; s.turn.coins = (opts && opts.coins) || 0;
  return s;
}
function play(s, card) { return reduce(s, { type: 'PLAY_ACTION', card }); }
function drive(s, max) { let g = 0; while (s.pending && g++ < (max || 80)) s = reduce(s, CPU.decide(s)); return s; }
const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat', 'princes', 'tavern'];
function tally(s) { const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; }; Object.keys(s.supply).forEach((id) => { if (id === 'ruins' || id === 'knights') return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); }); (s.ruins || []).forEach(a); (s.knights || []).forEach(a); (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a); s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a))); if (s.turn) { (s.turn.possessionGains || []).forEach(a); (s.turn.possessionTrash || []).forEach(a); } return t; }
function tdiff(a, b) { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); const d = []; ks.forEach((k) => { if ((a[k] || 0) !== (b[k] || 0)) d.push(k + ':' + (a[k] || 0) + '→' + (b[k] || 0)); }); return d; }
const ADV = DOM.KINGDOM_ADVENTURES;
const GROWTH = ['treasure_hunter', 'warrior', 'hero', 'champion', 'soldier', 'fugitive', 'disciple', 'teacher'];
// P0 の手番を終え、P1 を回して P0 の手番開始へ戻す（持続の開始時効果を見る）。
function backToP0(s) {
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = drive(s);
  s = reduce(s, { type: 'END_TURN' });      // P0 cleanup → P1
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });      // P1 cleanup → P0 開始
  s = drive(s);
  return s;
}

/* ============ CARD_SET 昇格 ============ */
console.log('=== 冒険: CARD_SET 昇格 ===');
{
  ok(DOM.CARD_SETS.some((x) => x.id === 'adventures' && x.kingdom.length === 10), 'adventures 固定セットが10種で存在');
  ok(DOM.CARD_SETS.some((x) => x.id === 'random-adventures' && (x.randomFrom || []).indexOf('adventures') >= 0), 'random-adventures が存在');
  ok(ADV.every((id) => DOM.POOLS.adventures.includes(id)) && ADV.length === 10, '固定10種は全て adventures プール内');
  ok(GROWTH.every((id) => DOM.POOLS.travellers.includes(id)) && GROWTH.every((id) => !DOM.POOLS.adventures.includes(id)), '成長先8種は POOLS.travellers に分離（adventures プールに無い）');
  ok(DOM.POOLS.adventures.includes('page') && DOM.POOLS.adventures.includes('peasant'), 'page/peasant はサプライ＝adventures プール内');
  // random-adventures は成長先を絶対に抽選しない
  let anyGrowth = false; for (let i = 0; i < 30; i++) { seed = 111 + i * 7; const rk = DOM.kingdomForSet('random-adventures'); if (rk.some((id) => GROWTH.includes(id))) anyGrowth = true; }
  ok(!anyGrowth, 'random-adventures は成長先を抽選しない');
  // 固定セット：page/peasant により成長山が各5枚設置される
  const sf = mk(DOM.kingdomForSet('adventures'));
  ok(GROWTH.every((id) => sf.supply[id] === 5), '冒険セット: 成長先8山が各5枚');
  ok(!E.canBuyCard(sf, 0, 'warrior') && E.canBuyCard(sf, 0, 'page'), '成長先は購入不可・page は購入可');
}

/* ============ トラベラー交換の全系列 ============ */
console.log('=== 冒険: トラベラー交換の全系列 ===');
function exchangeChain(startCard, chain) {
  // startCard を場に出して END_TURN→交換 を繰り返し、chain の順に成長するか
  let s = setup(ADV, [startCard], Array(8).fill('copper'));
  const init = tally(s);
  let cur = startCard, okAll = true;
  for (const next of chain) {
    s = play(s, cur); s = drive(s); // プレイ（pending があれば解決）
    s = reduce(s, { type: 'END_ACTION_PHASE' });
    s = reduce(s, { type: 'END_TURN' });
    if (!(s.pending && s.pending.type === 'traveller_exchange')) { okAll = false; break; }
    s = reduce(s, { type: 'TRAVELLER_EXCHANGE_RESOLVE', exchange: true });
    // P1 を回して P0 手番へ戻し、次のトラベラーを手札に引く
    s.turn.phase = 'buy'; s = reduce(s, { type: 'END_TURN' }); s = drive(s);
    // 次のトラベラーを手札に用意（成長先は捨て札/山札にある→強制的に手札へ）
    const p = s.players[0]; const all = [].concat(p.deck, p.hand, p.discard);
    if (!all.includes(next)) { okAll = false; break; }
    // 手札に無ければ山札/捨て札から手札へ移す
    if (!p.hand.includes(next)) {
      if (p.deck.includes(next)) { p.deck.splice(p.deck.indexOf(next), 1); p.hand.push(next); }
      else if (p.discard.includes(next)) { p.discard.splice(p.discard.indexOf(next), 1); p.hand.push(next); }
    }
    s.turn.phase = 'action'; s.turn.actions = 5;
    cur = next;
  }
  return { okAll, cons: tdiff(init, tally(s)).length === 0 };
}
{
  const r1 = exchangeChain('page', ['treasure_hunter', 'warrior', 'hero', 'champion']);
  ok(r1.okAll, 'page 系列: page→treasure_hunter→warrior→hero→champion 交換成立');
  ok(r1.cons, 'page 系列: 交換の保存則OK');
  const r2 = exchangeChain('peasant', ['soldier', 'fugitive', 'disciple', 'teacher']);
  ok(r2.okAll, 'peasant 系列: peasant→soldier→fugitive→disciple→teacher 交換成立');
  ok(r2.cons, 'peasant 系列: 交換の保存則OK');
}

/* ============ champion 永続・免疫・アクション毎+1 ============ */
console.log('=== 冒険: champion 永続持続・アタック免疫・アクション毎+1 ===');
{
  const s = setup(ADV, ['champion', 'hireling'], Array(12).fill('copper'));
  let s2 = play(s, 'champion');
  ok(s2.players[0].champions === 1, 'champion: p.champions=1');
  const a0 = s2.turn.actions;
  s2 = play(s2, 'hireling'); // hireling はターミナル（+アクション無し）→champion で+1返る
  ok(s2.turn.actions === a0, 'champion: ターミナル(hireling)でもアクション消費0（+1返る）');
  // 永続：cleanup 跨ぎ
  let s3 = setup(ADV, ['champion'], Array(10).fill('copper'));
  s3 = play(s3, 'champion'); s3 = backToP0(s3);
  ok(s3.players[0].durationCards.includes('champion'), 'champion: cleanup後も durationCards に残る（永続）');
  // 免疫：相手のアタックを受けない（haunted_woods は購入フック＝別途／ここは warrior[攻撃]）。giant相当が無いので警備で確認
  let s4 = setup(ADV, ['haunted_woods'], Array(8).fill('copper'));
  s4.players[1].durationCards = ['champion']; s4.players[1].hand = ['copper', 'copper'];
  s4 = play(s4, 'haunted_woods'); s4 = drive(s4);
  const e = s4.players[0].delayedEffects.find((x) => x.type === 'haunted_woods');
  ok(e && (e.immune || []).includes(1), 'champion: 相手が champion 保持→呪いの森の immune に登録（受動免疫）');
}

/* ============ teacher 山トークン ============ */
console.log('=== 冒険: teacher 山トークン ===');
{
  let s = setup(ADV, [], Array(10).fill('copper'));
  s.players[0].tavern = ['teacher'];
  s.pending = { type: 'tavern_start', player: 0 }; // ターン開始の呼び出し窓を直接立てる（backToP0のdriveはCPUが自動解決するため）
  s = reduce(s, { type: 'TAVERN_START_CALL', card: 'teacher' });
  ok(s.pending && s.pending.type === 'teacher_call' && s.pending.stage === 'token', 'teacher: 呼び出し→トークン選択');
  s = reduce(s, { type: 'TEACHER_TOKEN', token: 'card' });
  s = reduce(s, { type: 'TEACHER_PILE', card: 'lost_city' });
  ok(s.players[0].pileTokens.card === 'lost_city', 'teacher: +1カードトークンを lost_city 山へ');
  // その山のカードをプレイ→ボーナス（lost_city: +2c+2a、トークンで先に+1カード）
  s = drive(s); s.turn.phase = 'action'; s.turn.actions = 5;
  s.players[0].hand = ['lost_city']; s.players[0].deck = Array(6).fill('copper');
  const h0 = s.players[0].hand.length;
  s = play(s, 'lost_city');
  // lost_city +2カード ＋ トークン +1カード ＝ 手札 -1(出す)+3 = h0+2
  ok(s.players[0].hand.length === h0 + 2, 'teacher トークン: lost_city プレイで通常+2に加えトークン+1（手札+2）actual=' + (s.players[0].hand.length - h0));
}

/* ============ 主要カード（プレイ効果の抜き取り）============ */
console.log('=== 冒険: 主要カードのプレイ効果 ===');
{
  // hireling：永続 +1カード/ターン
  let s = setup(ADV, ['hireling'], Array(12).fill('copper'));
  s = play(s, 'hireling'); ok(s.players[0].hirelings === 1, 'hireling: 永続稼働1');
  s = backToP0(s); ok(s.players[0].durationCards.includes('hireling'), 'hireling: 永続で場に残る');
  // ranger：+1購入・旅トークン flip（初回は裏＝+5なし）
  let s2 = setup(ADV, ['ranger', 'ranger'], Array(12).fill('copper'));
  const b0 = s2.turn.buys; s2 = play(s2, 'ranger');
  ok(s2.turn.buys === b0 + 1 && s2.players[0].journeyDown === true, 'ranger: +1購入・旅トークン裏（初回+5なし）');
  s2 = play(s2, 'ranger'); ok(s2.players[0].journeyDown === false, 'ranger: 2回目で旅トークン表（+5カード）');
  // amulet：3択（+$1）
  let s3 = setup(ADV, ['amulet'], Array(8).fill('copper'));
  s3 = play(s3, 'amulet'); ok(s3.pending && s3.pending.type === 'amulet', 'amulet: 3択の pending');
  s3 = reduce(s3, { type: 'AMULET_RESOLVE', mode: 'coin' }); ok(s3.turn.coins === 1, 'amulet: +$1 を選択');
  // guide：Reserve→マット
  let s4 = setup(ADV, ['guide'], Array(8).fill('copper'));
  s4 = play(s4, 'guide'); ok(s4.players[0].tavern.includes('guide'), 'guide: 酒場マットへ');
  // caravan_guard：+1c+1a・次手番+$1
  let s5 = setup(ADV, ['caravan_guard'], Array(8).fill('copper'));
  const a5 = s5.turn.actions; s5 = play(s5, 'caravan_guard');
  ok(s5.turn.actions === a5 && s5.players[0].delayedEffects.some((e) => e.type === 'caravan_guard'), 'caravan_guard: キャントリップ＋次手番予約');
}

/* ============ 回帰テスト（敵対レビュー由来）============ */
console.log('=== 冒険: 回帰テスト（敵対レビュー由来）===');
// R1. throne/KC/procession × Reserve の保存則（putOnTavern 自己移動）
{
  const K = ['throne_room', 'kings_court', 'procession', 'guide', 'ratcatcher', 'transmogrify', 'royal_carriage', 'distant_lands', 'wine_merchant', 'duplicate'];
  function reservePlay(thrower, reserve) {
    let s = setup(K, [thrower, reserve], Array(10).fill('copper'));
    const init = tally(s);
    s = play(s, thrower); s = drive(s);
    // 玉座/王の宮廷/行進の対象選択（reserve を選ぶ）
    if (s.pending && (s.pending.type === 'throne' || s.pending.type === 'kings_court')) s = reduce(s, { type: s.pending.type === 'throne' ? 'THRONE_CHOOSE' : 'KINGS_COURT_CHOOSE', card: reserve });
    else if (s.pending && s.pending.type === 'procession') s = reduce(s, { type: 'PROCESSION_CHOOSE', card: reserve });
    s = drive(s, 120);
    return tdiff(init, tally(s)).length === 0;
  }
  ok(reservePlay('throne_room', 'guide'), 'R1: 玉座×案内人 保存則OK（マット複製なし）');
  ok(reservePlay('kings_court', 'ratcatcher'), 'R1: 王の宮廷×鼠取り 保存則OK');
  ok(reservePlay('throne_room', 'duplicate'), 'R1: 玉座×複製 保存則OK');
  ok(reservePlay('procession', 'transmogrify'), 'R1: 行進×変容 保存則OK');
}
// R2. page/peasant × upgrade で$4がトラベラー成長先のみ→獲得なし終了（デッドロック回帰・remake/forge/governorも同型の修正）
{
  const K = ['page', 'peasant', 'upgrade', 'village', 'chapel', 'cellar', 'moat', 'witch', 'market', 'laboratory'];
  // $4の非成長サプライが無い（$4の受け皿は warrior/fugitive[非サプライ]のみ）
  let s = setup(K, ['upgrade', 'silver'], Array(6).fill('copper'));
  s = play(s, 'upgrade');
  s = reduce(s, { type: 'UPGRADE_TRASH', card: 'silver' }); // $3廃棄→exact$4
  ok(!s.pending, 'R2: upgrade で$4が成長先のみ→獲得なしで pending 解消（デッドロック回避）');
  ok(s.supply.warrior === 5 && s.supply.fugitive === 5, 'R2: 成長先を獲得していない');
  // CPU戦フルループでデッドロックしない
  let g = E.createInitialState([{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'normal' }], K, { startActive: 0 });
  let step = 0; while (!g.gameOver && step++ < 20000) g = reduce(g, CPU.decide(g));
  ok(g.gameOver, 'R2: upgrade×page/peasant CPU戦が終局（デッドロックしない）');
}
// R3. swindler × page/peasant で成長先が被害者に渡らない
{
  const K = ['page', 'peasant', 'swindler', 'village', 'chapel', 'cellar', 'moat', 'witch', 'market', 'smithy'];
  let s = mk(K); s.turn.phase = 'action';
  s.pending = { type: 'swindler', stage: 'gain', player: 0, source: 0, victim: 1, cost: 3, queue: [] };
  const th0 = s.supply.treasure_hunter;
  s = reduce(s, { type: 'SWINDLER_GAIN', card: 'treasure_hunter' }); // $3の成長先
  ok(s.supply.treasure_hunter === th0 && s.pending, 'R3: 詐欺師で成長先の贈与は拒否（据え置き）');
}
// R4. 呪いの森×農地で詰まない・沼の妖婆×過払いで呪い発動・免疫の反応順独立
{
  const K = ['haunted_woods', 'swamp_hag', 'farmland', 'masterpiece', 'throne_room', 'moat', 'village', 'market', 'witch', 'smithy'];
  // 呪いの森×農地：デッドロックしない
  let s = mk(K);
  s.players[0].delayedEffects = [{ card: 'haunted_woods', type: 'haunted_woods', immune: [], rid: 1 }]; s.players[0].durationCards = ['haunted_woods']; s.supply.haunted_woods -= 1;
  s.turn.active = 1; s.turn.phase = 'buy'; s.turn.coins = 20; s.turn.buys = 5; s.players[1].hand = ['estate', 'copper', 'copper'];
  s = reduce(s, { type: 'BUY', card: 'farmland' }); s = drive(s, 40);
  ok(!s.pending, 'R4: 呪いの森×農地でデッドロックしない（農地は空手札で終端）');
  // 沼の妖婆×名品（過払い）：呪い発動
  let s2 = mk(K);
  s2.players[0].delayedEffects = [{ card: 'swamp_hag', type: 'swamp_hag', immune: [], rid: 1 }]; s2.players[0].durationCards = ['swamp_hag']; s2.supply.swamp_hag -= 1;
  s2.turn.active = 1; s2.turn.phase = 'buy'; s2.turn.coins = 20; s2.turn.buys = 5; s2.players[1].hand = ['copper'];
  const c0 = s2.supply.curse;
  s2 = reduce(s2, { type: 'BUY', card: 'masterpiece' });
  ok(s2.supply.curse === c0 - 1, 'R4: 沼の妖婆×名品（過払い）で呪いが発動');
  // 免疫の反応順独立：玉座×沼の妖婆で 受け→堀 と 堀→受け が同じ呪い1枚
  function throneSwamp(order) {
    let s = setup(K, ['throne_room', 'swamp_hag'], Array(6).fill('copper'), { p1hand: ['moat', 'copper'], p1deck: ['copper'] });
    s = play(s, 'throne_room'); s = reduce(s, { type: 'THRONE_CHOOSE', card: 'swamp_hag' });
    const react = (r) => reduce(s, r === 'moat' ? { type: 'MOAT_REVEAL' } : { type: 'LINGER_REACT' });
    s = react(order[0]); s = react(order[1]);
    s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
    const c = s.supply.curse; s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
    s = reduce(s, { type: 'BUY', card: 'copper' });
    return c - s.supply.curse;
  }
  ok(throneSwamp(['accept', 'moat']) === 1 && throneSwamp(['moat', 'accept']) === 1, 'R4: 玉座×沼の妖婆 免疫が反応順に依らず呪い1枚');
}
// R5. 玉座×語り部×水晶玉で基本+1×2（引き枚数）
{
  const K = ['throne_room', 'storyteller', 'crystal_ball', 'village', 'market', 'smithy', 'witch', 'moat', 'laboratory', 'gold'];
  let s = setup(K, ['throne_room', 'storyteller', 'crystal_ball', 'silver'], Array(20).fill('estate'));
  const init = tally(s);
  s = play(s, 'throne_room'); s = reduce(s, { type: 'THRONE_CHOOSE', card: 'storyteller' });
  s = reduce(s, { type: 'STORYTELLER_PLAY', cards: ['crystal_ball', 'silver'] });
  if (s.pending && s.pending.type === 'crystal_ball') s = reduce(s, { type: 'CRYSTAL_BALL', mode: 'discard' });
  s = drive(s, 20); // 2回目の storyteller（財宝なし→基本+1）を処理
  ok(s.players[0].hand.length === 5 && s.turn.coins === 0, 'R5: 玉座×語り部×水晶玉 で両プレイの基本+1が入り 手札5・coins0');
  ok(tdiff(init, tally(s)).length === 0, 'R5: 保存則OK');
}
// R6. 使者の初回配布（他Pもコピー獲得）
{
  const K = ['messenger', 'village', 'market', 'smithy', 'militia', 'moat', 'witch', 'laboratory', 'gold', 'silver'];
  let s = mk(K); const init = tally(s);
  s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 3;
  const vil0 = s.supply.village;
  s = reduce(s, { type: 'BUY', card: 'messenger' });
  ok(s.pending && s.pending.type === 'messenger_gain', 'R6: 使者を最初に購入→配布の pending');
  s = reduce(s, { type: 'MESSENGER_GAIN', card: 'village' });
  ok(s.supply.village === vil0 - 2 && s.players[0].discard.includes('village') && s.players[1].discard.includes('village'), 'R6: village を両者が獲得（山-2）');
  ok(tdiff(init, tally(s)).length === 0, 'R6: 保存則OK');
}

/* ============ CPU通し・カード保存則（出荷2セット）============ */
console.log('=== 冒険: CPU通し・カード保存則（adventures/random-adventures）===');
{
  let allOk = true, games = 0;
  const setsList = ['adventures', 'random-adventures'];
  for (const setId of setsList) {
    for (let sd = 0; sd < 8; sd++) {
      seed = 900 + sd * 13;
      const k = DOM.kingdomForSet(setId); if (!k) continue;
      const n = 2 + (sd % 3);
      const players = Array.from({ length: n }, (_, i) => ({ name: 'C' + i, isCpu: true, level: ['easy', 'normal', 'hard'][(sd + i) % 3] }));
      let s = E.createInitialState(players, k, { startActive: sd % n });
      const init = tally(s); let step = 0, bad = false;
      while (!s.gameOver && step++ < 20000) { s = reduce(s, CPU.decide(s)); if (s.pending) continue; if (tdiff(init, tally(s)).length) { bad = true; console.log('  保存則違反 ' + setId + ' sd' + sd + ' step' + step + ': ' + tdiff(init, tally(s)).join(',')); break; } }
      games++;
      if (bad || !s.gameOver) { allOk = false; if (!s.gameOver) console.log('  未終局 ' + setId + ' sd' + sd); }
    }
  }
  ok(allOk, 'CPU通し ' + games + '戦: 保存則OK＆全終局（adventures/random-adventures）');
}

console.log('\n========================================');
console.log('冒険テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
