/* ルネサンス（Renaissance）の検証（Node 単体実行）
   使い方: node test/renaissance.test.js
   R1＝共通基盤：村人(Villagers)／プロジェクト(Projects＝買う横型・1人2つまで)／アーティファクト(Artifacts＝奪い合う非カード)。
   正本＝docs/research/renaissance_rules.md */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260713;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine;
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  x FAIL: ' + m); } }
const reduce = (s, a) => E.reduce(s, a);
const KING = DOM.POOLS.renaissance.slice(0, 10);
function mk(projects, coins, buys, kingdom) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || KING).slice(), { startActive: 0, projects: projects });
  s.turn.phase = 'buy'; s.turn.coins = coins == null ? 8 : coins; s.turn.buys = buys == null ? 1 : buys;
  return s;
}
const me = (s) => s.players[0];

console.log('=== カタログ ===');
ok(DOM.POOLS.renaissance.length === 25, '王国25種');
ok(DOM.PROJECTS_RENAISSANCE.length === 20, 'プロジェクト20種 (' + DOM.PROJECTS_RENAISSANCE.length + ')');
ok(DOM.ARTIFACTS_RENAISSANCE.length === 5, 'アーティファクト5種');
ok(DOM.POOLS.renaissance.every((id) => DOM.CARDS[id]), '王国25種は DOM.CARDS にある');
ok(DOM.PROJECTS_RENAISSANCE.every((id) => !DOM.CARDS[id]), 'プロジェクトは DOM.CARDS に入れない');
ok(DOM.ARTIFACTS_RENAISSANCE.every((id) => !DOM.CARDS[id]), 'アーティファクトは DOM.CARDS に入れない');
ok(DOM.CARDS.scepter.types.join(',') === 'treasure,command', '王笏＝財宝・命令（2024エラッタ）');
ok(DOM.CARDS.ducat.coin === 0, 'ドゥカート金貨はコインを産まない');
ok(DOM.projectsForSet('empires') .length === 0, 'projectsFrom の無いセットはプロジェクト0');

console.log('=== state.projects / アーティファクトの器 ===');
{ const s = mk(['fair', 'canal']); ok(s.projects.length === 2 && s.projects[0] === 'fair', 'state.projects スロット'); }
{ const s = mk(['fair', 'cathedral'], 8, 1, ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'remodel', 'laboratory']);
  ok(JSON.stringify(s.artifacts) === '{}', '付与カードが無ければ artifacts は空'); }
{ const s = mk([], 8, 1, ['border_guard', 'flag_bearer', 'swashbuckler', 'treasurer', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar']);
  ok(Object.keys(s.artifacts).sort().join(',') === 'flag,horn,key,lantern,treasure_chest', '付与カード4種で5アーティファクトが出る');
  ok(Object.values(s.artifacts).every((v) => v === null), '最初は誰も持っていない'); }
{ const s = mk([], 8, 1, ['border_guard', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'remodel']);
  ok(Object.keys(s.artifacts).sort().join(',') === 'horn,lantern', '国境警備隊だけなら角笛とランタンだけ'); }
{ const s = mk(['fair']); ok(s.players.every((p) => p.villagers === 0 && p.projects.length === 0), 'villagers/projects の初期化'); }

console.log('=== BUY_PROJECT ===');
{ let s = mk(['fair'], 4, 1); s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  ok(me(s).projects.join(',') === 'fair' && s.turn.coins === 0 && s.turn.buys === 0, '購入＝コイン支払い＋購入権1消費');
  ok(s.turn.treasuresLocked === true, '購入したらそのターンは財宝を出せない');
  ok(s.turn.buysMade === 1, '使者の「最初の購入」に数える'); }
{ let s = mk(['fair'], 3, 1); s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  ok(me(s).projects.length === 0 && s.turn.coins === 3, 'コイン不足＝拒否'); }
{ let s = mk(['fair'], 8, 0); s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  ok(me(s).projects.length === 0, '購入権0＝拒否'); }
{ let s = mk(['fair'], 8, 2); me(s).debt = 1; s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  ok(me(s).projects.length === 0, '負債>0＝拒否'); }
{ let s = mk(['fair'], 8, 1); s.turn.phase = 'action'; s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  ok(me(s).projects.length === 0, 'アクションフェイズでは買えない'); }
{ let s = mk(['fair'], 20, 3); s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  ok(me(s).projects.length === 1 && s.turn.buys === 2, '同じプロジェクトは2回買えない（購入権も減らない）'); }
{ let s = mk(['fair', 'canal', 'barracks'], 30, 4);
  s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  s = reduce(s, { type: 'BUY_PROJECT', project: 'canal' });
  s = reduce(s, { type: 'BUY_PROJECT', project: 'barracks' });
  ok(me(s).projects.length === 2, 'キューブは2個＝3つ目は買えない'); }
{ let s = mk(['fair'], 8, 1); s = reduce(s, { type: 'BUY_PROJECT', project: 'cathedral' });
  ok(me(s).projects.length === 0, '採用されていないプロジェクトは買えない'); }
{ let s = mk(['fair'], 8, 1); s = reduce(s, { type: 'BUY_PROJECT', project: 'village' });
  ok(me(s).projects.length === 0, 'カードidをプロジェクトとして買えない'); }
{ let s = mk(['fair', 'canal'], 20, 3);
  s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  s = reduce(s, { type: 'BUY_PROJECT', project: 'canal' });
  ok(s.players[1].projects.length === 0, '相手のキューブは減っていない');
  ok(E.canBuyProject(s, 1, 'fair') === false, '相手は購入フェイズでないので買えない');
  ok(E.hasMyProject(s, 0, 'fair') === true && E.hasMyProject(s, 1, 'fair') === false, 'hasMyProject は席ごと'); }
{ // 複数人が同じプロジェクトを買える
  let s = mk(['fair'], 4, 1); s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  s.turn.active = 1; s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  ok(s.players[0].projects.join() === 'fair' && s.players[1].projects.join() === 'fair', '複数人が同じプロジェクトを買える'); }

console.log('=== SPEND_VILLAGER ===');
{ let s = mk([]); s.turn.phase = 'action'; s.turn.actions = 1; me(s).villagers = 3;
  s = reduce(s, { type: 'SPEND_VILLAGER', amount: 2 });
  ok(me(s).villagers === 1 && s.turn.actions === 3, '村人2個＝+2アクション'); }
{ let s = mk([]); s.turn.phase = 'action'; s.turn.actions = 0; me(s).villagers = 1;
  s = reduce(s, { type: 'SPEND_VILLAGER', amount: 1 });
  ok(me(s).villagers === 0 && s.turn.actions === 1, 'アクション権0でも使える'); }
{ let s = mk([]); s.turn.phase = 'buy'; me(s).villagers = 2;
  s = reduce(s, { type: 'SPEND_VILLAGER', amount: 1 });
  ok(me(s).villagers === 2, '購入フェイズでは使えない'); }
{ let s = mk([]); s.turn.phase = 'action'; me(s).villagers = 1;
  s = reduce(s, { type: 'SPEND_VILLAGER', amount: 5 });
  ok(me(s).villagers === 1, '所持数を超えては使えない'); }
{ let s = mk([]); s.turn.phase = 'action'; me(s).villagers = 1;
  s = reduce(s, { type: 'SPEND_VILLAGER', amount: 0 });
  ok(me(s).villagers === 1, '0個は拒否'); }
{ let s = mk([]); s.turn.phase = 'action'; me(s).villagers = 2; const a0 = s.turn.actions;
  s = reduce(s, { type: 'END_TURN' }); // アクションフェイズでは END_TURN 不可 → 変わらない
  s.turn.phase = 'buy'; s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].villagers === 2, '村人はターンを跨いで持ち越す'); }

console.log('=== マスク（公開情報）===');
{ let s = mk(['fair'], 4, 1); me(s).villagers = 3; s = reduce(s, { type: 'BUY_PROJECT', project: 'fair' });
  const v = E.maskStateFor(s, 1);
  ok(v.players[0].villagers === 3, '相手の村人は見える（公開）');
  ok(v.players[0].projects.join() === 'fair', '相手のプロジェクトは見える（公開）');
  ok(Array.isArray(v.projects) && v.projects.join() === 'fair', 'state.projects はマスク後も残る'); }
{ let s = mk([], 8, 1, ['flag_bearer', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'remodel']);
  s.artifacts.flag = 0;
  const v = E.maskStateFor(s, 1);
  ok(v.artifacts && v.artifacts.flag === 0, 'state.artifacts はマスク後も残る（公開）'); }

console.log('\n=== ' + pass + ' 成功 / ' + fail + ' 失敗 ===');
if (fail > 0) process.exit(1);
