/* CPU 対局テスト（Node 単体実行）
   使い方: node test/cpu.test.js
   - 2〜4人・各難易度でCPU対局を最後まで走らせ、必ず終了するか
   - 強い設定が弱い設定より勝ち越すか（難易度の序列）
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
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
    const r = playGame([
      { name: 'A', isCpu: true, level: levelA },
      { name: 'B', isCpu: true, level: levelB },
    ]);
    if (!r.state.gameOver) continue;
    valid++;
    const w = r.state.result.winners;
    if (w.length === 1 && w[0] === 0) aWins++;
  }
  return aWins / valid;
}
const strongVsWeak = winRate('hard', 'easy', 40);
console.log(`  強 vs 弱 勝率: ${(strongVsWeak * 100).toFixed(0)}%`);
ok(strongVsWeak >= 0.6, '強は弱に勝ち越す（>=60%）: ' + (strongVsWeak * 100).toFixed(0) + '%');

const strongVsNormal = winRate('hard', 'normal', 40);
console.log(`  強 vs 普通 勝率: ${(strongVsNormal * 100).toFixed(0)}%`);
ok(strongVsNormal >= 0.45, '強は普通に対して互角以上（>=45%）: ' + (strongVsNormal * 100).toFixed(0) + '%');

const normalVsWeak = winRate('normal', 'easy', 40);
console.log(`  普通 vs 弱 勝率: ${(normalVsWeak * 100).toFixed(0)}%`);
ok(normalVsWeak >= 0.55, '普通は弱に勝ち越す（>=55%）: ' + (normalVsWeak * 100).toFixed(0) + '%');

console.log('\n========================================');
console.log(`CPUテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
