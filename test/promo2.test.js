/* 新プロモ（Stash/Prince/Captain/Church/Sauna/Avanto）ゲームロジックの検証（Node 単体実行）
   使い方: node test/promo2.test.js
   対象: サウナ/アヴァント分割山(上のみ購入/獲得・1山カウント) / サウナ連鎖・銀貨廃棄トリガー(累積/玉座) /
         教会(脇置き・戻し・任意廃棄・マスク・玉座バッチ) / 船長(サプライからプレイ・残置・持続・自己移動失敗) /
         王子(脇置き・毎ターン強制プレイ・永続持続・玉座2枚・startQueue安全網) /
         へそくり(配置方針 top/mix/bottom・STASH_SETTING検証・マスクの位置公開) / CPU通し */
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
function count(arr, id) { return arr.filter((c) => c === id).length; }
const reduce = (s, a) => E.reduce(s, a);
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
  return s;
}
function playAct(s, card) { return reduce(s, { type: 'PLAY_ACTION', card }); }
function autoResolve(s, max) { let g = 0; while (s.pending && g++ < (max || 80)) s = reduce(s, CPU.decide(s)); return s; }
// 手番0のターンを終えて手番1をCPUで流し、再び手番0の開始時 pending（あれば）を残した状態にする
function endTurnAndPass(s) {
  if (s.turn.phase === 'action') s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  let g = 0;
  while (!s.gameOver && s.turn.active !== 0 && g++ < 200) s = reduce(s, CPU.decide(s));
  return s;
}
const K = ['moat', 'village', 'militia', 'smithy', 'market', 'stash', 'prince', 'captain', 'church', 'sauna'];

/* ============ CARD_SET 昇格・カタログ ============ */
console.log('=== 新プロモ: CARD_SET 昇格・現行エラッタ種別 ===');
{
  ok(DOM.CARD_SETS.some((x) => x.id === 'promo2-pack' && x.kingdom.length === 10), 'promo2-pack 固定セットが10種で存在');
  ok(DOM.CARD_SETS.some((x) => x.id === 'random-promo' && (x.randomFrom || []).indexOf('promo') >= 0), 'random-promo がプロモプールを参照');
  ok(DOM.POOLS.promo.length === 12, 'プロモプールは12種');
  ok(DOM.CARDS.prince.types.join(',') === 'action,duration,command', '王子=アクション-持続-命令（現行エラッタ）');
  ok(DOM.CARDS.captain.types.join(',') === 'action,duration,command', '船長=アクション-持続-命令（2019エラッタ）');
  // 抽選の正規化: avanto はサウナに一本化される（分割山は1山ぶんの枠しか使わない）
  const pool10 = ['avanto', 'cellar', 'village', 'workshop', 'moat', 'militia', 'smithy', 'remodel', 'market', 'mine'];
  const k10 = DOM.randomKingdom(10, pool10);
  ok(k10.includes('sauna') && !k10.includes('avanto'), '抽選で avanto は sauna に正規化される');
}

/* ============ サウナ/アヴァント: 分割山 ============ */
console.log('=== 分割山: 上5枚サウナ・下5枚アヴァント／1山カウント／上のみ購入・獲得 ===');
{
  let s = mkK(K);
  ok(s.kingdom.includes('avanto'), 'avanto がサプライに自動追加される');
  ok(s.supply.sauna === 5 && s.supply.avanto === 5, 'サウナ5枚＋アヴァント5枚');
  ok(E.canBuyCard(s, 0, 'avanto') === false, 'サウナが残る間アヴァントは購入不可');
  // BUY 拒否（状態不変）
  s.turn.phase = 'buy'; s.turn.coins = 9; s.turn.buys = 1;
  const before = JSON.stringify(s.supply);
  let s2 = reduce(s, { type: 'BUY', card: 'avanto' });
  ok(JSON.stringify(s2.supply) === before && s2.turn.buys === 1, 'BUY avanto は拒否され状態不変');
  s2 = reduce(s, { type: 'BUY', card: 'sauna' });
  ok(s2.supply.sauna === 4 && count(s2.players[0].discard, 'sauna') === 1, 'BUY sauna は成功');
  // サウナが尽きたらアヴァントを購入できる
  s.supply.sauna = 0;
  s2 = reduce(s, { type: 'BUY', card: 'avanto' });
  ok(s2.supply.avanto === 4 && count(s2.players[0].discard, 'avanto') === 1, 'サウナ枯渇後は BUY avanto 成功');
  // 空山カウント: 両方尽きて初めて1山
  s.supply.sauna = 0; s.supply.avanto = 3;
  ok(E.emptyPileCount(s) === 0, 'サウナ0でもアヴァントが残れば空山0');
  s.supply.avanto = 0;
  ok(E.emptyPileCount(s) === 1, '両方0で空山1（1山として数える）');
}
console.log('=== 分割山: 汎用獲得（改築）も上のみ／CPUは塞がれた avanto を提案しない ===');
{
  let s = setup(['remodel', 'sauna', 'village', 'moat', 'militia', 'smithy', 'market', 'stash', 'church', 'captain'],
    ['remodel', 'gold', 'copper', 'copper', 'copper']);
  s = playAct(s, 'remodel');
  s = reduce(s, { type: 'REMODEL_TRASH', card: 'gold' }); // 金貨($6)→$8以下を獲得可
  ok(s.pending && s.pending.type === 'remodel', '改築の獲得ステップ');
  const s3 = reduce(s, { type: 'REMODEL_GAIN', card: 'avanto' });
  ok(s3.pending && s3.pending.type === 'remodel', '獲得でも avanto は拒否（pending 据え置き）');
  const s4 = reduce(s, { type: 'REMODEL_GAIN', card: 'sauna' });
  ok(count(s4.players[0].discard, 'sauna') === 1 && !s4.pending, 'sauna の獲得は成功');
}

/* ============ サウナ: 効果・連鎖・銀貨廃棄 ============ */
console.log('=== サウナ: +1カード+1アクション、アヴァント連鎖 ===');
{
  let s = setup(K, ['sauna', 'avanto', 'copper', 'copper', 'estate'], ['silver', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'sauna');
  ok(s.players[0].hand.length === 5 && s.turn.actions === 1, 'サウナ: +1カード+1アクション');
  ok(s.pending && s.pending.type === 'sauna_chain' && s.pending.next === 'avanto', 'アヴァント連鎖の選択が出る');
  const declined = reduce(s, { type: 'SAUNA_CHAIN', play: false });
  ok(!declined.pending && count(declined.players[0].inPlay, 'avanto') === 0, '連鎖を辞退できる');
  s = reduce(s, { type: 'SAUNA_CHAIN', play: true });
  ok(count(s.players[0].inPlay, 'avanto') === 1, 'アヴァントを（アクション消費なしで）プレイ');
  ok(s.turn.actions === 1, '連鎖はアクション権を消費しない');
  ok(s.turn.actionsPlayed === 2, '連鎖プレイも「使ったアクション数」に数える（共謀者用）');
}
console.log('=== サウナ: 銀貨を使うたび手札1枚を廃棄してよい（使用回数ぶん累積） ===');
{
  let s = setup(K, ['sauna', 'sauna', 'silver', 'silver', 'estate'], ['copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'sauna'); // 連鎖なし（手札にアヴァント無し）
  s = playAct(s, 'sauna');
  ok((s.turn.saunaPlays || 0) === 2, 'サウナ使用回数=2');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.turn.coins === 2, '銀貨の+2コインは即時');
  ok(s.pending && s.pending.type === 'sauna_trash' && s.pending.remaining === 2, '廃棄機会=サウナ2回ぶん');
  const trashLen = s.trash.length;
  s = reduce(s, { type: 'SAUNA_TRASH', card: 'estate' });
  ok(s.trash.length === trashLen + 1 && s.pending && s.pending.remaining === 1, '1枚廃棄して残り1回');
  s = reduce(s, { type: 'SAUNA_TRASH', card: null });
  ok(!s.pending, '残りをまとめて辞退できる');
  // 2枚目の銀貨でも再度誘発する
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.pending && s.pending.type === 'sauna_trash' && s.pending.remaining === 2, '銀貨ごとに毎回誘発');
  s = reduce(s, { type: 'SAUNA_TRASH', card: null });
  ok(!s.pending, '辞退で閉じる');
}
console.log('=== サウナ: 全部出すボタンでも銀貨で止まって選択が出る ===');
{
  let s = setup(K, ['sauna', 'silver', 'copper', 'copper', 'estate'], ['copper']);
  s = playAct(s, 'sauna');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(s.pending && s.pending.type === 'sauna_trash', '全部出すの途中で sauna_trash が立つ');
  s = reduce(s, { type: 'SAUNA_TRASH', card: 'estate' });
  ok(!s.pending, '廃棄1回で解決（remaining=1）');
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(s.turn.coins >= 4 && !s.pending, '残りの財宝も出せる（銅貨は誘発しない）');
}
console.log('=== サウナ×玉座の間: 使用回数2＝銀貨1枚で2枚まで廃棄 ===');
{
  const K2 = ['throne_room', 'sauna', 'village', 'moat', 'militia', 'smithy', 'market', 'stash', 'church', 'captain'];
  let s = setup(K2, ['throne_room', 'sauna', 'silver', 'estate', 'estate'], ['copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'throne_room');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'sauna' });
  ok((s.turn.saunaPlays || 0) === 2, '玉座でサウナ2回使用');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.pending && s.pending.remaining === 2, '銀貨1枚で廃棄機会2回');
  s = reduce(s, { type: 'SAUNA_TRASH', card: 'estate' });
  s = reduce(s, { type: 'SAUNA_TRASH', card: 'estate' });
  ok(!s.pending && count(s.trash, 'estate') === 2, '2枚とも廃棄できた');
}

/* ============ アヴァント ============ */
console.log('=== アヴァント: +3カード、サウナ連鎖 ===');
{
  let s = setup(K, ['avanto', 'sauna', 'copper', 'copper', 'estate'], ['silver', 'copper', 'copper', 'copper']);
  s = playAct(s, 'avanto');
  ok(s.players[0].hand.length === 7, 'アヴァント: +3カード');
  ok(s.pending && s.pending.type === 'sauna_chain' && s.pending.next === 'sauna', 'サウナ連鎖の選択');
  s = reduce(s, { type: 'SAUNA_CHAIN', play: true });
  ok(count(s.players[0].inPlay, 'sauna') === 1 && (s.turn.saunaPlays || 0) === 1, '連鎖サウナも使用回数に数える');
  ok(s.turn.actions === 1, '連鎖サウナの+1アクションも付く（0+1）');
}

/* ============ 教会 ============ */
console.log('=== 教会: 脇置き→次ターン戻し→任意廃棄 ===');
{
  let s = setup(K, ['church', 'gold', 'curse', 'copper', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'church');
  ok(s.turn.actions === 1, '教会: +1アクション');
  ok(s.pending && s.pending.type === 'church', '脇置き選択が出る');
  s = reduce(s, { type: 'CHURCH_SETASIDE', cards: ['gold', 'curse'] });
  ok(count(s.players[0].setAside, 'gold') === 1 && count(s.players[0].setAside, 'curse') === 1, '2枚を脇に置いた');
  // 相手からは伏せられる（枚数のみ）
  const masked = E.maskStateFor(s, 1);
  ok(masked.players[0].setAside.every((c) => c === 'back'), '教会の脇置きは相手に伏せる');
  s = endTurnAndPass(s);
  ok(s.turn.active === 0 && s.pending && s.pending.type === 'church_trash', '次ターン開始時に廃棄の選択');
  ok(count(s.players[0].hand, 'gold') === 1 && count(s.players[0].hand, 'curse') === 1, '脇のカードが手札に戻っている');
  ok(s.players[0].setAside.length === 0, '脇は空');
  const trashLen = s.trash.length;
  s = reduce(s, { type: 'CHURCH_TRASH', card: 'curse' });
  ok(s.trash.length === trashLen + 1 && count(s.trash, 'curse') >= 1, '呪いを廃棄できた');
  ok(!s.pending, '解決後は通常の手番へ');
  ok(count(s.players[0].durationCards, 'church') === 1, '教会はこのターンの間まだ場（持続）にある');
  s = endTurnAndPass(s);
  const P0 = s.players[0];
  ok(count(P0.durationCards, 'church') === 0 &&
     (count(P0.discard, 'church') + count(P0.deck, 'church') + count(P0.hand, 'church')) === 1,
    '役目を終えた教会はクリンナップで場を離れる');
}
console.log('=== 教会: 0枚でも次ターンに廃棄の機会はある ===');
{
  let s = setup(K, ['church', 'copper', 'copper', 'copper', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'church');
  s = reduce(s, { type: 'CHURCH_SETASIDE', cards: [] });
  ok(!s.pending, '0枚で確定できる');
  s = endTurnAndPass(s);
  ok(s.pending && s.pending.type === 'church_trash', '0枚でも廃棄プロンプトは出る（公式）');
  s = reduce(s, { type: 'CHURCH_TRASH', card: null });
  ok(!s.pending, '廃棄しない選択で閉じる');
}
console.log('=== 教会×玉座の間: 2回の脇置き→次ターン2回の廃棄機会 ===');
{
  const K2 = ['throne_room', 'sauna', 'village', 'moat', 'militia', 'smithy', 'market', 'stash', 'church', 'captain'];
  let s = setup(K2, ['throne_room', 'church', 'gold', 'silver', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'throne_room');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'church' });
  ok(s.pending && s.pending.type === 'church', '1回目の脇置き');
  s = reduce(s, { type: 'CHURCH_SETASIDE', cards: ['gold'] });
  ok(s.pending && s.pending.type === 'church', '2回目の脇置き（replay）');
  s = reduce(s, { type: 'CHURCH_SETASIDE', cards: ['silver'] });
  ok(s.players[0].setAside.length === 2, '2バッチが脇にある');
  s = endTurnAndPass(s);
  ok(s.pending && s.pending.type === 'church_trash', '廃棄プロンプト1回目');
  ok(count(s.players[0].hand, 'gold') === 1 && count(s.players[0].hand, 'silver') === 1, '両バッチとも手札に戻る');
  s = reduce(s, { type: 'CHURCH_TRASH', card: null });
  ok(s.pending && s.pending.type === 'church_trash', '廃棄プロンプト2回目（玉座ぶん）');
  s = reduce(s, { type: 'CHURCH_TRASH', card: null });
  ok(!s.pending, '両方解決で通常の手番へ');
}

/* ============ 船長 ============ */
console.log('=== 船長: サプライの$4以下アクションを（サプライに残したまま）使用 ===');
{
  let s = setup(K, ['captain', 'copper', 'copper', 'copper', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  const smithyBefore = s.supply.smithy;
  s = playAct(s, 'captain');
  ok(s.pending && s.pending.type === 'captain', '対象選択が出る');
  const played = s.turn.actionsPlayed;
  s = reduce(s, { type: 'CAPTAIN_PLAY', card: 'smithy' });
  ok(s.players[0].hand.length === 7, '鍛冶屋の+3カードが発動');
  ok(s.supply.smithy === smithyBefore, '鍛冶屋はサプライに残る');
  ok(count(s.players[0].inPlay, 'smithy') === 0, '鍛冶屋は場に出ない');
  ok(s.turn.actionsPlayed === played + 1, '「使ったアクション数」に数える');
  // 対象があるうちはスキップ不可（強制）
  let s2 = setup(K, ['captain', 'copper', 'copper', 'copper', 'estate']);
  s2 = playAct(s2, 'captain');
  const s3 = reduce(s2, { type: 'CAPTAIN_PLAY', card: null });
  ok(s3.pending && s3.pending.type === 'captain', '対象があるうちは null を拒否（使用必須）');
  // $5 のカード（market）は選べない
  const s4 = reduce(s2, { type: 'CAPTAIN_PLAY', card: 'market' });
  ok(s4.pending && s4.pending.type === 'captain', '$5のカードは拒否');
  const s5 = reduce(s2, { type: 'CAPTAIN_PLAY', card: 'church' });
  ok(s5.pending && s5.pending.type === 'captain', '持続（教会）は拒否');
}
console.log('=== 船長: 次のターン開始時にもう一度／その後は捨て札へ ===');
{
  let s = setup(K, ['captain', 'copper', 'copper', 'copper', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'captain');
  s = reduce(s, { type: 'CAPTAIN_PLAY', card: 'moat' });
  s = endTurnAndPass(s);
  ok(count(s.players[0].durationCards, 'captain') === 1, '船長は持続として場に残る');
  ok(s.pending && s.pending.type === 'captain', '次ターン開始時にも対象選択');
  s = reduce(s, { type: 'CAPTAIN_PLAY', card: 'militia' });
  ok(s.pending && s.pending.type === 'militia' && s.pending.player === 1, 'サプライから民兵＝攻撃も通常どおり機能');
  s = reduce(s, CPU.decide(s)); // 相手が3枚まで捨てる
  ok(!s.pending && s.players[1].hand.length === 3, '攻撃解決');
  ok(s.supply.militia === 10, '民兵はサプライに残っている');
  s = endTurnAndPass(s);
  ok(count(s.players[0].durationCards, 'captain') === 0, '役目を終えた船長は場を離れた');
}
console.log('=== 船長: 鉱山の村をサプライからプレイ→自己廃棄は失敗し+2コインも出ない ===');
{
  const K2 = ['mining_village', 'sauna', 'village', 'moat', 'militia', 'smithy', 'market', 'stash', 'church', 'captain'];
  let s = setup(K2, ['captain', 'copper', 'copper', 'copper', 'estate'], ['copper', 'copper']);
  s = playAct(s, 'captain');
  s = reduce(s, { type: 'CAPTAIN_PLAY', card: 'mining_village' });
  ok(s.pending && s.pending.type === 'mining_village', '鉱山の村の廃棄選択が出る');
  const coins = s.turn.coins;
  s = reduce(s, { type: 'MINING_VILLAGE_RESOLVE', trash: true });
  ok(s.turn.coins === coins, '廃棄できないので+2コインは出ない（公式）');
  ok(s.supply.mining_village === 10 && count(s.trash, 'mining_village') === 0, '鉱山の村はサプライに残り廃棄されない');
}
console.log('=== 船長: 対象が無ければ何も起きず、次ターンに再試行 ===');
{
  // 王国の全アクションを $5以上 か 持続（教会）にする＝船長の対象が最初から存在しない
  const K3 = ['captain', 'church', 'market', 'festival', 'laboratory', 'mine', 'library', 'witch', 'council_room', 'minion'];
  let s = setup(K3, ['captain', 'copper', 'copper', 'copper', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'captain');
  ok(!s.pending, '対象が無ければ選択は出ない（教会は持続なので対象外）');
  s = endTurnAndPass(s);
  ok(count(s.players[0].durationCards, 'captain') === 1, 'それでも船長は場に残る');
  ok(s.pending && s.pending.type === 'captain', '次ターン開始時に再試行の選択');
  s = reduce(s, { type: 'CAPTAIN_PLAY', card: null });
  ok(!s.pending, '対象ゼロなら null で解決できる');
}

/* ============ 王子 ============ */
console.log('=== 王子: 脇置き→毎ターン開始時に（動かさずに）使用／王子は場に残り続ける ===');
{
  let s = setup(K, ['prince', 'smithy', 'copper', 'copper', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'prince');
  ok(s.pending && s.pending.type === 'prince', '脇置き選択が出る');
  // 持続（教会）は置けない／手札に適格が1枚も無ければ選択自体が出ない
  let sx = setup(K, ['prince', 'church', 'smithy', 'copper', 'estate']);
  sx = playAct(sx, 'prince');
  const sxr = reduce(sx, { type: 'PRINCE_SETASIDE', card: 'church' });
  ok(sxr.pending && sxr.pending.type === 'prince', '持続（教会）の脇置きは拒否（pending 据え置き）');
  let sy = setup(K, ['prince', 'church', 'copper', 'copper', 'estate']);
  sy = playAct(sy, 'prince');
  ok(!sy.pending, '適格カードが手札に無ければ選択は出ない');
  s = reduce(s, { type: 'PRINCE_SETASIDE', card: 'smithy' });
  ok(!s.pending, '脇置きで解決');
  ok((s.players[0].princes || []).join(',') === 'smithy', '王子の脇に鍛冶屋');
  ok(count(s.players[0].hand, 'smithy') === 0, '鍛冶屋は手札から消えた');
  s = endTurnAndPass(s);
  ok(count(s.players[0].durationCards, 'prince') === 1, '王子は場に残り続ける');
  ok(s.pending && s.pending.type === 'prince_play', 'ターン開始時に王子のプレイ');
  const handBefore = s.players[0].hand.length;
  s = reduce(s, { type: 'PRINCE_PLAY' });
  ok(s.players[0].hand.length === handBefore + 3, '鍛冶屋の+3カード');
  ok(count(s.players[0].inPlay, 'smithy') === 0 && (s.players[0].princes || []).join(',') === 'smithy', '鍛冶屋は脇に置いたまま（場に出ない）');
  // 2巡目も繰り返す
  s = endTurnAndPass(s);
  ok(s.pending && s.pending.type === 'prince_play', '2巡目のターン開始時もプレイ');
  s = reduce(s, { type: 'PRINCE_PLAY' });
  ok(count(s.players[0].durationCards, 'prince') === 1, '王子はまだ場に残っている');
  // VP: 脇のカードも所有カード（scoreGame の deckSize に入る）
  const sc = E.scoreGame(s);
  ok(sc.scores[0].deckSize === [].concat(s.players[0].deck, s.players[0].hand, s.players[0].discard, s.players[0].inPlay,
    s.players[0].durationCards, s.players[0].setAside, s.players[0].islandMat, s.players[0].nativeVillageMat).length + 1,
    '王子の脇のカードも所有カード数に入る');
}
console.log('=== 王子: 置かない選択→王子は普通にクリンナップで捨て札 ===');
{
  let s = setup(K, ['prince', 'smithy', 'copper', 'copper', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'prince');
  s = reduce(s, { type: 'PRINCE_SETASIDE', card: null });
  ok(!s.pending, '置かない選択で閉じる');
  s = endTurnAndPass(s);
  ok(count(s.players[0].durationCards, 'prince') === 0, '王子は場に残らない');
  ok(!s.pending || s.pending.type !== 'prince_play', 'ターン開始時のプレイも無い');
}
console.log('=== 王子×玉座の間: 2枚を脇置き→毎ターン2枚プレイ（現行公式） ===');
{
  const K2 = ['throne_room', 'sauna', 'village', 'moat', 'militia', 'smithy', 'market', 'stash', 'church', 'prince'];
  let s = setup(K2, ['throne_room', 'prince', 'smithy', 'moat', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'throne_room');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'prince' });
  ok(s.pending && s.pending.type === 'prince', '1回目の脇置き');
  s = reduce(s, { type: 'PRINCE_SETASIDE', card: 'smithy' });
  ok(s.pending && s.pending.type === 'prince', '2回目の脇置き（replay）');
  s = reduce(s, { type: 'PRINCE_SETASIDE', card: 'moat' });
  ok((s.players[0].princes || []).length === 2, '2枚とも脇置きできた');
  s = endTurnAndPass(s);
  ok(count(s.players[0].durationCards, 'prince') === 1, '物理の王子は1枚だけ場に残る');
  ok(s.pending && s.pending.type === 'prince_play', '1枚目のプレイ');
  s = reduce(s, { type: 'PRINCE_PLAY' });
  ok(s.pending && s.pending.type === 'prince_play', '2枚目のプレイ（startQueue）');
  s = reduce(s, { type: 'PRINCE_PLAY' });
  ok(!s.pending, '両方プレイして通常の手番へ');
}
console.log('=== 王子×民兵×複数開始時効果: 攻撃解決後も後続の開始時効果が続く（安全網） ===');
{
  const K2 = ['throne_room', 'sauna', 'village', 'moat', 'militia', 'smithy', 'market', 'stash', 'church', 'prince'];
  let s = setup(K2, ['throne_room', 'prince', 'militia', 'smithy', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper'],
    { p1hand: ['copper', 'copper', 'copper', 'estate', 'estate'] });
  s = playAct(s, 'throne_room');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'prince' });
  s = reduce(s, { type: 'PRINCE_SETASIDE', card: 'militia' });
  s = reduce(s, { type: 'PRINCE_SETASIDE', card: 'smithy' });
  s = endTurnAndPass(s);
  ok(s.pending && s.pending.type === 'prince_play' && s.pending.card === 'militia', '開始時: まず民兵のプレイ');
  s = reduce(s, { type: 'PRINCE_PLAY' });
  ok(s.pending && s.pending.type === 'militia' && s.pending.player === 1, '民兵の攻撃が相手に飛ぶ');
  s = reduce(s, CPU.decide(s)); // 相手が捨てる
  ok(s.pending && s.pending.type === 'prince_play' && s.pending.card === 'smithy', '攻撃解決後、2枚目（鍛冶屋）が取り残されない');
  s = reduce(s, { type: 'PRINCE_PLAY' });
  ok(!s.pending, '全開始時効果を消化');
}

/* ============ へそくり ============ */
console.log('=== へそくり: 財宝+2コイン／シャッフル時の配置方針 ===');
{
  let s = setup(K, ['stash', 'copper', 'copper', 'copper', 'estate']);
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'stash' });
  ok(s.turn.coins === 2, 'へそくり=+2コイン');
  // 配置: top（既定）
  let s2 = mkK(K);
  const p = s2.players[0];
  p.deck = []; p.hand = []; p.discard = ['copper', 'stash', 'copper', 'copper', 'stash'];
  p.stashPlacement = 'top';
  let s3 = JSON.parse(JSON.stringify(s2));
  s3.turn.phase = 'buy';
  s3 = reduce(s3, { type: 'END_TURN' }); // クリンナップで5枚引く（シャッフル発生）
  // クリンナップで hand に5枚（=全部）引かれる。top なら stash が最初に引かれている
  ok(s3.players[0].hand.slice(0, 2).join(',') === 'stash,stash' ||
     (s3.players[0].hand[0] === 'stash' && s3.players[0].hand[1] === 'stash'),
     'top: へそくり2枚が山札の上（=最初に引かれる）');
  // 配置: bottom
  let s4 = JSON.parse(JSON.stringify(s2));
  s4.players[0].stashPlacement = 'bottom';
  s4.turn.phase = 'buy';
  s4 = reduce(s4, { type: 'END_TURN' });
  ok(s4.players[0].hand.slice(3).join(',') === 'stash,stash', 'bottom: へそくり2枚が最後に引かれる');
}
console.log('=== へそくり: STASH_SETTING の検証（本人のみ・値検証） ===');
{
  let s = mkK(K);
  s = reduce(s, { type: 'STASH_SETTING', player: 0, value: 'bottom' });
  ok(s.players[0].stashPlacement === 'bottom', '手番の本人は変更できる');
  s = reduce(s, { type: 'STASH_SETTING', player: 1, value: 'bottom' });
  ok(s.players[1].stashPlacement === 'top', '他人の設定は変更できない（actor検証）');
  s = reduce(s, { type: 'STASH_SETTING', player: 0, value: 'evil' });
  ok(s.players[0].stashPlacement === 'bottom', '不正な値は拒否');
}
console.log('=== へそくり: 裏面が違う＝山札内の位置は公開（マスク） ===');
{
  let s = mkK(K);
  s.players[1].deck = ['copper', 'stash', 'estate', 'stash'];
  const m0 = E.maskStateFor(s, 0);
  ok(m0.players[1].deck.join(',') === 'back,stash,back,stash', '相手のへそくり位置は見える（他は back）');
  const m1 = E.maskStateFor(s, 1);
  ok(m1.players[1].deck.filter((c) => c === 'stash').length === 2 &&
     m1.players[1].deck[1] === 'stash' && m1.players[1].deck[3] === 'stash',
     '自分の山札もへそくり位置だけ保存されソートで順序は消える');
  ok(m1.players[1].deck.length === 4, '枚数は不変');
}

/* ============ 敵対的レビューで発見した確定バグの回帰テスト ============ */
console.log('=== 回帰(island×prince): 王子で島を動かさず使用しても複製されない（保存則） ===');
{
  // 海辺の島＋王子＝混成（黒市場経由で到達可能）。王子で island を脇置きし毎ターン使うと、
  // 旧実装では inPlay に島が無いのに islandMat へ push され、幻の島が毎ターン増殖した（VP無限増殖）。
  const K2 = ['island', 'prince', 'village', 'moat', 'militia', 'smithy', 'market', 'stash', 'church', 'sauna'];
  const countIsland = (st) => {
    let n = st.supply.island || 0;
    st.players.forEach((p) => ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'princes']
      .forEach((z) => n += count(p[z] || [], 'island')));
    (st.trash || []).forEach((c) => { if (c === 'island') n++; });
    return n;
  };
  let s = setup(K2, ['prince', 'island', 'copper', 'copper', 'estate'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  const total = countIsland(s);
  s = playAct(s, 'prince');
  s = reduce(s, { type: 'PRINCE_SETASIDE', card: 'island' });
  ok((s.players[0].princes || []).join(',') === 'island', '島を王子の脇に置いた');
  ok(countIsland(s) === total, '脇置き直後も島の総数は不変');
  s = endTurnAndPass(s);
  ok(s.pending && s.pending.type === 'prince_play' && s.pending.card === 'island', '開始時に島のプレイ');
  s = autoResolve(s); // PRINCE_PLAY→island→ISLAND_PICK を CPU が解決
  ok(countIsland(s) === total, '1巡目後も島は複製されない');
  ok((s.players[0].princes || []).join(',') === 'island', '島は王子の脇に残っている（自身は移動しない）');
  s = endTurnAndPass(s); s = autoResolve(s);
  ok(countIsland(s) === total, '2巡目後も島は複製されない（保存則維持）');
}
console.log('=== 回帰(sauna×tiara): ティアラで銀貨を2回使用→廃棄機会が2回ぶん立つ ===');
{
  // サウナ＋ティアラ（繁栄）＝黒市場経由で到達可能。ティアラの2回目は playTreasureCard を通らないため
  // 旧実装では銀貨の2回目でサウナの廃棄トリガーが漏れ、廃棄機会が1回しか立たなかった。
  const K2 = ['tiara', 'sauna', 'village', 'moat', 'militia', 'smithy', 'market', 'stash', 'church', 'captain'];
  let s = setup(K2, ['sauna', 'tiara', 'silver', 'estate', 'estate'], ['copper', 'copper', 'copper', 'copper']);
  s = playAct(s, 'sauna'); // saunaPlays=1（手札にアヴァント無し＝連鎖なし）
  ok(!s.pending && (s.turn.saunaPlays || 0) === 1, 'サウナ使用回数=1');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'tiara' });
  ok(s.pending && s.pending.type === 'tiara_play', 'ティアラの財宝2回使用の選択');
  s = reduce(s, { type: 'TIARA_PLAY', card: 'silver' });
  // 2回目のプレイは state.replay に積まれ、1回目が立てた廃棄機会が解決してから適用される
  //（＝「銀貨を使うたび」1回ずつ窓が開く。合計は 銀貨2回ぶん＝2回の廃棄機会・+4コイン）。
  ok(s.turn.coins === 2 && s.pending && s.pending.type === 'sauna_trash' && s.pending.remaining === 1, '1回目の銀貨＝+2コイン＋廃棄機会1回');
  s = reduce(s, { type: 'SAUNA_TRASH', card: 'estate' });
  ok(s.turn.coins === 4, '銀貨を2回使用＝+4コイン');
  ok(s.pending && s.pending.type === 'sauna_trash' && s.pending.remaining === 1, '2回目の銀貨でも廃棄機会が立つ（合計2回）');
  s = reduce(s, { type: 'SAUNA_TRASH', card: 'estate' });
  ok(!s.pending && count(s.trash, 'estate') === 2, '2回とも廃棄できた');
}

/* ============ CPU: 新プロモ入りの通しプレイ（stuck・例外なし） ============ */
console.log('=== CPU通し: promo2-pack 2人×6シード＋4人×2シード＋random-promo×4 ===');
{
  function runCpuGame(setId, nPlayers) {
    const kingdom = DOM.kingdomForSet(setId);
    const players = [];
    for (let i = 0; i < nPlayers; i++) players.push({ name: 'CPU' + i, isCpu: true, level: i % 2 ? 'normal' : 'hard' });
    let s = E.createInitialState(players, kingdom, { startActive: 0 });
    let step = 0;
    while (!s.gameOver && step++ < 20000) {
      const a = CPU.decide(s);
      if (!a) return { done: false, why: 'decide null' };
      const before = JSON.stringify([s.pending, s.turn.active, s.turn.phase, s.turn.actions, s.turn.buys, s.turn.coins, s.players.map((p) => p.hand.length)]);
      s = reduce(s, a);
      const after = JSON.stringify([s.pending, s.turn.active, s.turn.phase, s.turn.actions, s.turn.buys, s.turn.coins, s.players.map((p) => p.hand.length)]);
      if (before === after && step > 1) {
        // 完全に同一の状態が続くのは停滞の兆候（1回は許容＝乱数で変わらないことがある）
        s._same = (s._same || 0) + 1;
        if (s._same > 50) return { done: false, why: 'stuck step' + step + ' ' + JSON.stringify(a) };
      } else s._same = 0;
    }
    return { done: !!s.gameOver, why: 'steps=' + step };
  }
  for (let i = 0; i < 6; i++) {
    const r = runCpuGame('promo2-pack', 2);
    ok(r.done, 'promo2-pack 2人 #' + i + ' 完走（' + r.why + '）');
  }
  for (let i = 0; i < 2; i++) {
    const r = runCpuGame('promo2-pack', 4);
    ok(r.done, 'promo2-pack 4人 #' + i + ' 完走（' + r.why + '）');
  }
  for (let i = 0; i < 4; i++) {
    const r = runCpuGame('random-promo', 2);
    ok(r.done, 'random-promo 2人 #' + i + ' 完走（' + r.why + '）');
  }
}

console.log('\n========================================');
console.log('新プロモテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
