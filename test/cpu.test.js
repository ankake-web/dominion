/* CPU 対局テスト（Node 単体実行）
   使い方: node test/cpu.test.js
   - 2〜4人・各難易度でCPU対局を最後まで走らせ、必ず終了するか
   - 強い設定が弱い設定より勝ち越すか（難易度の序列）
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Object.create(Math), JSON: JSON, console: console };
vm.createContext(sandbox);
// RNG を固定シードにする（他の全テストファイルと同じ流儀）。勝率テストは統計的なので、
// 未シード＋少サンプルだと真の勝率(hard vs normal≈58%)でも 40戦では稀に45%を割って偽陰性になる。
// シード固定＋サンプル増で「決定論的に」序列を検証する（閾値は不変）。
let __seed = 20260701;
sandbox.Math.random = function () { __seed = (__seed * 1103515245 + 12345) & 0x7fffffff; return __seed / 0x7fffffff; };
function load(f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}
load('js/cards.js');
load('js/engine.js');
load('js/cpu.js');
const DOM = sandbox.window.DOM;
const E = DOM.engine;
const CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// 1ゲームを最後まで自動進行。返り値: {state, steps}
function playGame(configs, maxSteps) {
  maxSteps = maxSteps || 4000;
  let s = E.createInitialState(configs);
  let steps = 0;
  while (!s.gameOver && steps < maxSteps) {
    const before = s.version + ':' + s.turn.active + ':' + s.turn.phase + ':' + (s.pending ? s.pending.type + s.pending.player : '-') +
      ':' + s.players.map((p) => p.hand.length + ',' + p.deck.length + ',' + p.discard.length).join('|') + ':' + s.turn.coins + ',' + s.turn.buys + ',' + s.turn.actions;
    const action = CPU.decide(s);
    s = E.reduce(s, action);
    const after = s.turn.active + ':' + s.turn.phase + ':' + (s.pending ? s.pending.type + s.pending.player : '-') +
      ':' + s.players.map((p) => p.hand.length + ',' + p.deck.length + ',' + p.discard.length).join('|') + ':' + s.turn.coins + ',' + s.turn.buys + ',' + s.turn.actions;
    // 進行していない（状態が全く変わらない）なら無限ループ
    if (before.split(':').slice(1).join(':') === after && action.type !== 'PLAY_ALL_TREASURES') {
      return { state: s, steps, stuck: action };
    }
    steps++;
  }
  return { state: s, steps, stuck: null };
}

console.log('=== 終了性: 各人数・難易度でゲームが終わる ===');
const levels = ['easy', 'normal', 'hard'];
let maxStepsSeen = 0;
for (let n = 2; n <= 4; n++) {
  for (const lv of levels) {
    const configs = [];
    for (let i = 0; i < n; i++) configs.push({ name: 'C' + i, isCpu: true, level: lv });
    const r = playGame(configs);
    maxStepsSeen = Math.max(maxStepsSeen, r.steps);
    ok(r.state.gameOver, `${n}人 ${lv}: ゲームが終了する (steps=${r.steps})`);
    ok(!r.stuck, `${n}人 ${lv}: 手詰まりしない` + (r.stuck ? ' stuck=' + JSON.stringify(r.stuck) : ''));
    ok(r.state.result && r.state.result.winners.length >= 1, `${n}人 ${lv}: 勝者が決まる`);
    // サプライ整合（負の在庫が無い）
    ok(Object.values(r.state.supply).every((v) => v >= 0), `${n}人 ${lv}: サプライが負にならない`);
  }
}
console.log(`  （最長 ${maxStepsSeen} ステップで終了）`);

console.log('=== 混在: 人間想定を含む構成でもCPUは止まらない ===');
{
  // 席0は人間想定だが、CPUのdecideは呼ばない。CPU席だけ自動で進むのを模擬するのは複雑なので、
  // ここでは全CPUで「強・普通・弱・普通」の4人を流して整合のみ確認
  const r = playGame([
    { name: '強', isCpu: true, level: 'hard' },
    { name: '弱', isCpu: true, level: 'easy' },
    { name: '普', isCpu: true, level: 'normal' },
    { name: '普2', isCpu: true, level: 'normal' },
  ]);
  ok(r.state.gameOver && !r.stuck, '4人混在難易度でも完走');
}

console.log('=== 難易度の序列: 強は弱に勝ち越す ===');
function winRate(levelA, levelB, games) {
  let aWins = 0, valid = 0;
  for (let g = 0; g < games; g++) {
    const aSeat = g % 2; // 2人戦は先手有利のため、席を交互にして偏りを消す
    const cfgA = { name: 'A', isCpu: true, level: levelA };
    const cfgB = { name: 'B', isCpu: true, level: levelB };
    const r = playGame(aSeat === 0 ? [cfgA, cfgB] : [cfgB, cfgA]);
    if (!r.state.gameOver) continue;
    valid++;
    const w = r.state.result.winners;
    if (w.length === 1 && w[0] === aSeat) aWins++;
  }
  return aWins / valid;
}
const strongVsWeak = winRate('hard', 'easy', 100);
console.log(`  強 vs 弱 勝率: ${(strongVsWeak * 100).toFixed(0)}%`);
ok(strongVsWeak >= 0.6, '強は弱に勝ち越す（>=60%）: ' + (strongVsWeak * 100).toFixed(0) + '%');

const strongVsNormal = winRate('hard', 'normal', 100);
console.log(`  強 vs 普通 勝率: ${(strongVsNormal * 100).toFixed(0)}%`);
ok(strongVsNormal >= 0.45, '強は普通に対して互角以上（>=45%）: ' + (strongVsNormal * 100).toFixed(0) + '%');

const normalVsWeak = winRate('normal', 'easy', 100);
console.log(`  普通 vs 弱 勝率: ${(normalVsWeak * 100).toFixed(0)}%`);
ok(normalVsWeak >= 0.55, '普通は弱に勝ち越す（>=55%）: ' + (normalVsWeak * 100).toFixed(0) + '%');

console.log('=== 選択待ち解決の決定論テスト ===');
function st2(level) {
  return E.createInitialState([
    { name: 'A', isCpu: true, level: level || 'normal' },
    { name: 'B', isCpu: true, level: level || 'normal' },
  ]);
}
// 民兵: 堀があれば公開して無効化
let s = st2();
s.players[0].hand = ['militia', 'copper', 'copper', 'copper', 'copper'];
s.players[1].hand = ['moat', 'gold', 'silver', 'copper', 'estate'];
s = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
ok(CPU.decide(s).type === 'MOAT_REVEAL', '民兵に対し堀があれば公開して無効化');
// 民兵: 呪い・勝利点から捨てる
s = st2();
s.players[0].hand = ['militia', 'copper', 'copper', 'copper', 'copper'];
s.players[1].hand = ['gold', 'silver', 'estate', 'copper', 'curse'];
s = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
let d = CPU.decide(s);
ok(d.type === 'MILITIA_RESOLVE' && d.cards.includes('curse') && d.cards.includes('estate'),
  '民兵の捨て札は呪い・勝利点から: ' + JSON.stringify(d.cards));
// 鉱山: 銀→金 / 獲得は金貨
s = st2();
s.players[0].hand = ['mine', 'silver', 'copper', 'copper', 'copper'];
s = E.reduce(s, { type: 'PLAY_ACTION', card: 'mine' });
ok(CPU.decide(s).card === 'silver', '鉱山: 銀貨を廃棄して格上げ');
s = E.reduce(s, CPU.decide(s));
ok(CPU.decide(s).card === 'gold', '鉱山: 獲得は金貨');
// 堀をアクションとしてプレイする（旧実装は一切プレイしなかった）
s = st2();
s.players[0].hand = ['moat', 'copper', 'copper', 'estate', 'estate'];
d = CPU.decide(s);
ok(d.type === 'PLAY_ACTION' && d.card === 'moat', '堀を+2ドローとしてプレイする');
// 改築: 公領/属州は廃棄しない（銅貨を選ぶ）
s = st2();
s.players[0].hand = ['remodel', 'duchy', 'copper', 'silver', 'gold'];
s = E.reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
d = CPU.decide(s);
ok(d.type === 'REMODEL_TRASH' && d.card === 'copper', '改築: 公領ではなく銅貨を廃棄: ' + d.card);
// 改築: 勝利点しか無ければ公領を選び属州は守る
s = st2();
s.players[0].hand = ['remodel', 'duchy', 'province'];
s = E.reduce(s, { type: 'PLAY_ACTION', card: 'remodel' });
ok(CPU.decide(s).card === 'duchy', '改築: 勝利点のみなら公領を選び属州は守る');

console.log('=== 強CPUの終局認識 ===');
// 負け確定なら最後の属州を買って自滅しない
s = st2('hard');
s.supply.province = 1;
s.players[1].deck = s.players[1].deck.concat(['province', 'province', 'province']); // 相手が大差リード
s.players[0].hand = [];
s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1;
d = CPU.decide(s);
ok(!(d.type === 'BUY' && d.card === 'province'), '負け確定では最後の属州を買わない: ' + JSON.stringify(d));
// リード中なら最後の属州で勝ち切る
s = st2('hard');
s.supply.province = 1;
s.players[0].deck = s.players[0].deck.concat(['province', 'province']); // 自分がリード
s.players[0].hand = [];
s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1;
d = CPU.decide(s);
ok(d.type === 'BUY' && d.card === 'province', 'リード中は最後の属州で勝ち切る');
// 3山目: 大差リードなら安いカードでも閉じて勝つ
s = st2('hard');
s.supply.village = 0; s.supply.smithy = 0; s.supply.moat = 1;
s.players[0].deck = s.players[0].deck.concat(['province', 'province']); // 大差リード
s.players[0].hand = [];
s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1;
d = CPU.decide(s);
ok(d.type === 'BUY' && d.card === 'moat', '3山目を閉じて勝ち確で終局: ' + JSON.stringify(d));

console.log('\n========================================');
console.log(`CPUテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
