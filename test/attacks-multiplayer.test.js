/* 多人数(2-4人)のアタック/リアクションのルール正当性を的に絞って検証（決定論）。
   使い方: node test/attacks-multiplayer.test.js
   対象: 呪い配布(人数ぶん/枯渇で手番順先着)・堀は公開者だけ免疫・灯台免疫・民兵/巾着切り/役人の全相手適用・玉座/王の宮廷での複製 */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 424242; sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + m); } }
const reduce = (s, a) => E.reduce(s, a);
const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat'];
const all = (p) => [].concat.apply([], ZONES.map((z) => p[z] || []));
const cnt = (p, id) => all(p).filter((c) => c === id).length;
const K = ['witch', 'militia', 'cutpurse', 'bureaucrat', 'throne_room', 'kings_court', 'moat', 'village', 'market', 'smithy'];
function mk(n) {
  const s = E.createInitialState(Array.from({ length: n }, (_, i) => 'P' + i), K, { startActive: 0 });
  s.players.forEach((p) => { p.deck = ['copper', 'copper', 'copper', 'copper']; }); // ドロー確保
  return s;
}
function resolveAll(s) { let g = 0; while (s.pending && g++ < 300) s = reduce(s, CPU.decide(s)); return s; }
function playAttack(s, card) { s = reduce(s, { type: 'PLAY_ACTION', card }); return resolveAll(s); }

console.log('=== 魔女: 3人で相手全員(2人)が呪い1枚ずつ・攻撃者は受けない ===');
{
  let s = mk(3);
  s.players[0].hand = ['witch'];
  s.players[1].hand = ['estate', 'estate', 'copper', 'copper', 'copper'];
  s.players[2].hand = ['estate', 'copper', 'copper', 'copper', 'copper'];
  const cBefore = s.supply.curse;
  s = playAttack(s, 'witch');
  ok(cnt(s.players[1], 'curse') === 1 && cnt(s.players[2], 'curse') === 1, '相手2人が呪い1枚ずつ');
  ok(cnt(s.players[0], 'curse') === 0, '攻撃者は呪いを受けない');
  ok(s.supply.curse === cBefore - 2, '呪い山が2減る（実 ' + (cBefore - s.supply.curse) + '）');
}

console.log('=== 魔女: 呪い山枯渇(残2)・4人で手番順の先着2人だけ受ける ===');
{
  let s = mk(4);
  s.players[0].hand = ['witch']; s.supply.curse = 2;
  [1, 2, 3].forEach((i) => { s.players[i].hand = ['estate', 'copper', 'copper', 'copper', 'copper']; });
  s = playAttack(s, 'witch');
  ok(cnt(s.players[1], 'curse') === 1 && cnt(s.players[2], 'curse') === 1, '手番順の先着P1,P2が呪い');
  ok(cnt(s.players[3], 'curse') === 0, '枯渇後のP3は受けない');
  ok(s.supply.curse === 0, '呪い山は0');
}

console.log('=== 魔女: 堀を持つ相手だけ免疫・他は受ける（多人数）===');
{
  let s = mk(3);
  s.players[0].hand = ['witch'];
  s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper'];  // P1は堀
  s.players[2].hand = ['estate', 'copper', 'copper', 'copper', 'copper']; // P2は反応札なし
  s = playAttack(s, 'witch');
  ok(cnt(s.players[1], 'curse') === 0, 'P1は堀を公開して免疫');
  ok(cnt(s.players[2], 'curse') === 1, 'P2は免疫でないので呪いを受ける');
}

console.log('=== 魔女: 灯台の相手は免疫（攻撃者は対象外の判定も）===');
{
  let s = mk(3);
  s.players[0].hand = ['witch'];
  s.players[1].durationCards = ['lighthouse']; s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s.players[2].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s = playAttack(s, 'witch');
  ok(cnt(s.players[1], 'curse') === 0, 'P1は灯台で免疫');
  ok(cnt(s.players[2], 'curse') === 1, 'P2は受ける');
}

console.log('=== 民兵: 3人で相手全員が手札3枚まで捨てる（堀持ちは免疫）===');
{
  let s = mk(3);
  s.players[0].hand = ['militia'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate']; // 5枚・反応なし
  s.players[2].hand = ['moat', 'copper', 'copper', 'estate', 'estate'];   // 5枚・堀
  s = playAttack(s, 'militia');
  ok(s.players[1].hand.length === 3, 'P1は手札3枚まで捨てる（実 ' + s.players[1].hand.length + '）');
  ok(s.players[2].hand.length === 5, 'P2は堀で免疫（手札そのまま）');
  ok(s.turn.coins === 2, '民兵 +2コイン');
}

console.log('=== 巾着切り: 3人で相手全員が銅貨1枚を捨てる ===');
{
  let s = mk(3);
  s.players[0].hand = ['cutpurse'];
  s.players[1].hand = ['copper', 'copper', 'estate', 'estate', 'estate'];
  s.players[2].hand = ['copper', 'estate', 'estate', 'estate', 'estate'];
  s = playAttack(s, 'cutpurse');
  ok(s.players[1].discard.filter((c) => c === 'copper').length === 1 && s.players[1].hand.filter((c) => c === 'copper').length === 1, 'P1が銅貨1枚捨て');
  ok(s.players[2].discard.filter((c) => c === 'copper').length === 1 && s.players[2].hand.filter((c) => c === 'copper').length === 0, 'P2が銅貨1枚捨て');
  ok(s.turn.coins === 2, '巾着切り +2コイン');
}

console.log('=== 役人: 3人で相手全員が勝利点1枚を山札の上に置く ===');
{
  let s = mk(3);
  s.players[0].hand = ['bureaucrat'];
  s.players[1].hand = ['estate', 'copper', 'copper', 'copper', 'copper'];
  s.players[2].hand = ['duchy', 'copper', 'copper', 'copper', 'copper'];
  s.players[1].deck = ['copper']; s.players[2].deck = ['copper'];
  s = playAttack(s, 'bureaucrat');
  ok(s.players[1].deck[0] === 'estate', 'P1は勝利点(屋敷)を山札の上へ');
  ok(s.players[2].deck[0] === 'duchy', 'P2は勝利点(公領)を山札の上へ');
  ok(cnt(s.players[0], 'silver') >= 1, '役人: 攻撃者は銀貨を山札の上に獲得');
}

console.log('=== 玉座の間 × 魔女: 相手が呪い2枚（複製で2回攻撃）===');
{
  let s = mk(2);
  s.players[0].hand = ['throne_room', 'witch'];
  s.players[1].hand = ['estate', 'copper', 'copper', 'copper', 'copper'];
  s = playAttack(s, 'throne_room'); // 玉座→魔女を選ぶ→2回
  ok(cnt(s.players[1], 'curse') === 2, '玉座×魔女で相手が呪い2枚（実 ' + cnt(s.players[1], 'curse') + '）');
}

console.log('=== 王の宮廷 × 魔女: 相手が呪い3枚（複製で3回攻撃）===');
{
  let s = mk(2);
  s.players[0].hand = ['kings_court', 'witch'];
  s.players[1].hand = ['estate', 'copper', 'copper', 'copper', 'copper'];
  s = playAttack(s, 'kings_court');
  ok(cnt(s.players[1], 'curse') === 3, '王の宮廷×魔女で相手が呪い3枚（実 ' + cnt(s.players[1], 'curse') + '）');
}

console.log('=== 玉座の間 × 魔女: 呪い山が3枚しか無いなら3枚で打ち止め（枯渇）===');
{
  let s = mk(2);
  s.players[0].hand = ['kings_court', 'witch']; s.supply.curse = 2;
  s.players[1].hand = ['estate', 'copper', 'copper', 'copper', 'copper'];
  s = playAttack(s, 'kings_court');
  ok(cnt(s.players[1], 'curse') === 2 && s.supply.curse === 0, '王の宮廷×魔女でも呪い山ぶんだけ（2枚）で枯渇');
}

console.log('\n========================================');
console.log('多人数アタックテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
