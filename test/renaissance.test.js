/* ルネサンス（Renaissance）の検証（Node 単体実行）
   使い方: node test/renaissance.test.js
   R1＝共通基盤：村人(Villagers)／プロジェクト(Projects＝買う横型・1人2つまで)／アーティファクト(Artifacts＝奪い合う非カード)。
   R2＝素直な王国15枚。
   正本＝docs/research/renaissance_rules.md */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260713;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;
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
/* --- R2 用の道具 --- */
// アクションフェイズの素の盤面（王国は renaissance 全25種＋基本）。手札/山札/捨て札を直に組む。
function act(kingdom) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || DOM.POOLS.renaissance.slice(0, 10)).slice(), { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  return s;
}
// 王国に任意のカードを供給しておく（サプライに無いカードを効果で使うテスト用）
function withSupply(s, ids) { ids.forEach((id) => { if (s.supply[id] == null) s.supply[id] = 10; }); return s; }
const play = (s, card) => reduce(s, { type: 'PLAY_ACTION', card: card });
const cnt = (arr, id) => arr.filter((c) => c === id).length;
// pending を CPU に解決させ、終端するか（無限ループ検知）
function cpuResolve(s, lim) {
  let g = 0;
  while (s.pending && g++ < (lim || 40)) { const a = CPU.decide(s); if (!a) break; s = reduce(s, a); }
  return s;
}

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

/* ============================================================
   R2＝素直な王国15枚
   ============================================================ */
console.log('=== 追従者（lackeys）===');
{ let s = act(); me(s).hand = ['lackeys']; me(s).deck = ['copper', 'copper', 'estate'];
  s = play(s, 'lackeys');
  ok(me(s).hand.length === 2 && s.turn.actions === 0, '+2カード（ターミナル）'); }
{ let s = act(); s = reduce(s, { type: 'PLAY_ACTION', card: 'lackeys' }); // 手札に無い＝何も起きない
  me(s).hand = []; E.reduce(s, {});
  const before = me(s).villagers || 0;
  s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'lackeys' });
  ok((me(s).villagers || 0) === before + 2, '獲得（購入）で +2村人'); }
{ let s = act(); withSupply(s, ['workshop']); me(s).hand = ['workshop']; s.supply.lackeys = 10;
  s = play(s, 'workshop');
  s = reduce(s, { type: 'WORKSHOP_GAIN', card: 'lackeys' });
  ok((me(s).villagers || 0) === 2, '購入以外の獲得（工房）でも +2村人'); }

console.log('=== 劇団（acting_troupe）===');
{ let s = act(); me(s).hand = ['acting_troupe'];
  s = play(s, 'acting_troupe');
  ok((me(s).villagers || 0) === 4, '+4村人');
  ok(cnt(s.trash, 'acting_troupe') === 1 && me(s).inPlay.length === 0, 'これを廃棄する'); }
{ let s = act(); withSupply(s, ['throne_room']); me(s).hand = ['throne_room', 'acting_troupe']; s.turn.actions = 1;
  s = play(s, 'throne_room');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'acting_troupe' });
  ok((me(s).villagers || 0) === 8, '玉座の間で2回＝+8村人');
  ok(cnt(s.trash, 'acting_troupe') === 1, '廃棄は1回だけ（2回目は場に無い＝lose track）'); }

console.log('=== 実験（experiment）===');
{ let s = act(); me(s).hand = ['experiment']; me(s).deck = ['copper', 'copper', 'estate'];
  const sup0 = s.supply.experiment;
  s = play(s, 'experiment');
  ok(me(s).hand.length === 2 && s.turn.actions === 1, '+2カード+1アクション');
  ok(s.supply.experiment === sup0 + 1 && me(s).inPlay.length === 0, 'これをその山に戻す（獲得でも捨て札でもない）'); }
{ let s = act(); s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  const sup0 = s.supply.experiment;
  s = reduce(s, { type: 'BUY', card: 'experiment' });
  ok(cnt(me(s).discard, 'experiment') === 2, '獲得したとき もう1枚の実験を獲得（合計2枚）');
  ok(s.supply.experiment === sup0 - 2, '山は2枚減る（2枚目では誘発しない＝無限ループしない）'); }
{ let s = act(); withSupply(s, ['throne_room']); me(s).hand = ['throne_room', 'experiment'];
  me(s).deck = ['copper', 'copper', 'copper', 'copper', 'estate'];
  const sup0 = s.supply.experiment;
  s = play(s, 'throne_room');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'experiment' });
  ok(me(s).hand.length === 4, '玉座＝2回とも +2カード');
  ok(s.supply.experiment === sup0 + 1, '山に戻るのは1回だけ（2回目は場に無い）'); }

console.log('=== 根城（hideout）===');
{ let s = act(); me(s).hand = ['hideout', 'copper', 'estate']; me(s).deck = ['silver'];
  s = play(s, 'hideout');
  ok(s.turn.actions === 2 && me(s).hand.length === 3, '+1カード+2アクション');
  ok(s.pending && s.pending.type === 'hideout_trash', '手札1枚を廃棄（強制）');
  s = reduce(s, { type: 'HIDEOUT_TRASH', card: 'copper' });
  ok(cnt(s.trash, 'copper') === 1 && cnt(me(s).discard, 'curse') === 0, '財宝を廃棄＝呪いなし'); }
{ let s = act(); me(s).hand = ['hideout', 'estate']; me(s).deck = ['silver'];
  s = play(s, 'hideout');
  s = reduce(s, { type: 'HIDEOUT_TRASH', card: 'estate' });
  ok(cnt(s.trash, 'estate') === 1 && cnt(me(s).discard, 'curse') === 1, '勝利点を廃棄＝呪い1枚を獲得'); }
{ let s = act(); me(s).hand = ['hideout', 'curse']; me(s).deck = ['silver'];
  s = play(s, 'hideout');
  s = reduce(s, { type: 'HIDEOUT_TRASH', card: 'curse' });
  ok(cnt(s.trash, 'curse') === 1 && cnt(me(s).discard, 'curse') === 0, '呪いは勝利点カードではない＝呪いを得ない'); }
{ let s = act(); me(s).hand = ['hideout']; me(s).deck = [];
  s = play(s, 'hideout');
  ok(!s.pending, '手札0枚なら pending を立てない（終端保証）'); }

console.log('=== 発明家（inventor）===');
{ let s = act(); me(s).hand = ['inventor'];
  s = play(s, 'inventor');
  ok(s.pending && s.pending.type === 'inventor_gain', '獲得の選択待ち');
  ok(s.turn.costReduction === 0, '獲得より前にコスト減は起きない（公領$5は取れない）');
  s = reduce(s, { type: 'INVENTOR_GAIN', card: 'silver' });
  ok(cnt(me(s).discard, 'silver') === 1 && s.turn.costReduction === 1, '獲得の「後」にコストが$1安くなる'); }
{ let s = act(); me(s).hand = ['inventor', 'inventor']; s.turn.actions = 2;
  s = play(s, 'inventor'); s = reduce(s, { type: 'INVENTOR_GAIN', card: 'silver' });
  s = play(s, 'inventor');
  ok(E.cardCost(s, 'duchy') === 4, '2枚目の発明家では公領が$4＝獲得できる');
  s = reduce(s, { type: 'INVENTOR_GAIN', card: 'duchy' });
  ok(cnt(me(s).discard, 'duchy') === 1 && s.turn.costReduction === 2, 'コスト減は累積する'); }

console.log('=== 山村（mountain_village）===');
{ let s = act(); me(s).hand = ['mountain_village']; me(s).discard = ['gold', 'estate']; me(s).deck = ['copper'];
  s = play(s, 'mountain_village');
  ok(s.turn.actions === 2 && s.pending && s.pending.type === 'mountain_village', '+2アクション＋捨て札から1枚（強制）');
  s = reduce(s, { type: 'MOUNTAIN_VILLAGE_TAKE', card: 'gold' });
  ok(me(s).hand.includes('gold') && cnt(me(s).discard, 'gold') === 0, '捨て札から手札へ'); }
{ let s = act(); me(s).hand = ['mountain_village']; me(s).discard = []; me(s).deck = ['gold'];
  s = play(s, 'mountain_village');
  ok(!s.pending && me(s).hand.includes('gold'), '捨て札が空のときだけ +1カード'); }
{ let s = act(); me(s).hand = ['mountain_village']; me(s).discard = ['tunnel']; s.supply.tunnel = 10;
  s = play(s, 'mountain_village');
  s = reduce(s, { type: 'MOUNTAIN_VILLAGE_TAKE', card: 'tunnel' });
  ok(cnt(me(s).discard, 'gold') === 0, '捨て札から取るのは「捨てる」ではない＝トンネルは誘発しない'); }

console.log('=== 司祭（priest）===');
{ let s = act(); me(s).hand = ['priest', 'copper', 'estate'];
  s = play(s, 'priest');
  ok(s.turn.coins === 2, '+2コイン');
  s = reduce(s, { type: 'PRIEST_TRASH', card: 'copper' });
  ok(s.turn.coins === 2, 'この廃棄には +2コインは乗らない（予約はこの廃棄の後）');
  ok(s.turn.priestCount === 1, '以後の廃棄で +2コイン'); }
{ let s = act(); withSupply(s, ['chapel']); me(s).hand = ['priest', 'chapel', 'copper', 'copper', 'estate', 'curse'];
  s.turn.actions = 2;
  s = play(s, 'priest');
  s = reduce(s, { type: 'PRIEST_TRASH', card: 'copper' });
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['copper', 'estate', 'curse'] });
  ok(s.turn.coins === 2 + 6, '礼拝堂で3枚廃棄＝+6コイン（1枚につき +2）'); }
{ let s = act(); me(s).hand = ['priest', 'priest', 'copper', 'copper']; s.turn.actions = 2;
  s = play(s, 'priest'); s = reduce(s, { type: 'PRIEST_TRASH', card: 'copper' });
  s = play(s, 'priest'); s = reduce(s, { type: 'PRIEST_TRASH', card: 'copper' });
  ok(s.turn.coins === 2 + 2 + 2, '司祭2枚＝2枚目の廃棄に1枚目の+2が乗る（合計 $6）');
  ok(s.turn.priestCount === 2, '有効な司祭は2つ'); }
{ let s = act(); me(s).hand = ['priest'];
  s = play(s, 'priest');
  ok(!s.pending && s.turn.priestCount === 1, '手札0枚でも予約は発生する（終端保証）'); }
{ let s = act(); me(s).hand = ['priest', 'copper'];
  s = play(s, 'priest'); s = reduce(s, { type: 'PRIEST_TRASH', card: 'copper' });
  const c0 = s.turn.coins;
  s.turn.phase = 'buy';
  E.reduce(s, {});
  ok(s.turn.priestCount === 1 && s.turn.coins === c0, '購入フェイズでも予約は残る'); }

console.log('=== 絹商人（silk_merchant）===');
{ let s = act(); me(s).hand = ['silk_merchant']; me(s).deck = ['copper', 'copper'];
  s = play(s, 'silk_merchant');
  ok(me(s).hand.length === 2 && s.turn.buys === 2, '+2カード+1購入'); }
{ let s = act(); withSupply(s, ['silk_merchant']); s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'silk_merchant' });
  ok((me(s).coffers || 0) === 1 && (me(s).villagers || 0) === 1, '獲得したとき +1財源+1村人'); }
{ let s = act(); withSupply(s, ['chapel']); me(s).hand = ['chapel', 'silk_merchant'];
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['silk_merchant'] });
  ok((me(s).coffers || 0) === 1 && (me(s).villagers || 0) === 1, '廃棄したとき +1財源+1村人'); }

console.log('=== 学者（scholar）===');
{ let s = act(); me(s).hand = ['scholar', 'copper', 'estate'];
  me(s).deck = ['silver', 'silver', 'silver', 'silver', 'silver', 'silver', 'silver'];
  s = play(s, 'scholar');
  ok(me(s).hand.length === 7 && cnt(me(s).hand, 'silver') === 7, '手札を全部捨てて +7カード');
  ok(cnt(me(s).discard, 'copper') === 1 && cnt(me(s).discard, 'estate') === 1, '捨てた手札は捨て札へ'); }
{ let s = act(); me(s).hand = ['scholar', 'copper', 'copper'];
  me(s).deck = ['silver']; me(s).discard = [];
  s = play(s, 'scholar');
  ok(me(s).hand.length === 3, '先に捨ててから引く＝捨てた銅貨もシャッフルに混ざる（山札1+捨2＝3枚引ける）'); }

console.log('=== 徴募官（recruiter）===');
{ let s = act(); me(s).hand = ['recruiter']; me(s).deck = ['silver', 'estate'];
  s = play(s, 'recruiter');
  ok(me(s).hand.length === 2, '+2カード（引いた札も廃棄対象）');
  s = reduce(s, { type: 'RECRUITER_TRASH', card: 'silver' });
  ok((me(s).villagers || 0) === 3, '銀貨（$3）を廃棄＝+3村人'); }
{ let s = act(); me(s).hand = ['recruiter']; me(s).deck = ['estate', 'copper'];
  s = play(s, 'recruiter');
  s = reduce(s, { type: 'RECRUITER_TRASH', card: 'copper' });
  ok((me(s).villagers || 0) === 0, '銅貨（$0）＝+0村人'); }
{ let s = act(); withSupply(s, ['peddler']); me(s).hand = ['recruiter']; me(s).deck = ['peddler', 'copper'];
  s = play(s, 'recruiter');
  s = reduce(s, { type: 'RECRUITER_TRASH', card: 'peddler' });
  ok((me(s).villagers || 0) === 8, '行商人はアクションフェイズでは$8＝+8村人（公式コンボ）'); }
{ let s = act(); withSupply(s, ['fortress']); me(s).hand = ['recruiter']; me(s).deck = ['fortress', 'copper'];
  s = play(s, 'recruiter');
  s = reduce(s, { type: 'RECRUITER_TRASH', card: 'fortress' });
  ok((me(s).villagers || 0) === 4 && me(s).hand.includes('fortress'), '城塞を廃棄＝+4村人（城塞は手札に戻る）'); }
{ let s = act(); me(s).hand = ['recruiter']; me(s).deck = [];
  s = play(s, 'recruiter');
  ok(!s.pending, '手札0枚なら pending を立てない（終端保証）'); }

console.log('=== 彫刻家（sculptor）===');
{ let s = act(); me(s).hand = ['sculptor'];
  s = play(s, 'sculptor');
  s = reduce(s, { type: 'SCULPTOR_GAIN', card: 'silver' });
  ok(me(s).hand.includes('silver'), '$4以下を「手札に」獲得');
  ok((me(s).villagers || 0) === 1, '財宝を獲得＝+1村人'); }
{ let s = act(); me(s).hand = ['sculptor'];
  s = play(s, 'sculptor');
  s = reduce(s, { type: 'SCULPTOR_GAIN', card: 'lackeys' });
  ok(me(s).hand.includes('lackeys') && (me(s).villagers || 0) === 2, 'アクションなら村人なし（追従者の獲得時+2村人は別）'); }
{ let s = act(); withSupply(s, ['nomad_camp']); me(s).hand = ['sculptor'];
  s = play(s, 'sculptor');
  s = reduce(s, { type: 'SCULPTOR_GAIN', card: 'nomad_camp' });
  ok(me(s).hand.includes('nomad_camp') && !me(s).deck.includes('nomad_camp'), '遊牧民の野営地も手札に入る（獲得先の上書き）'); }

console.log('=== 先見者（seer）===');
{ let s = act(); me(s).hand = ['seer'];
  me(s).deck = ['copper', 'estate', 'silver', 'gold'];
  s = play(s, 'seer');
  // 引く1枚=copper、公開3枚= estate($2)/silver($3)/gold($6) → estate,silver が手札へ、gold は戻す
  ok(me(s).hand.includes('estate') && me(s).hand.includes('silver'), '$2〜$4を手札に加える');
  ok(!s.pending && me(s).deck[0] === 'gold', '戻す札が1枚なら選択なしで山札の上へ');
  ok(s.turn.actions === 1, '+1アクション'); }
{ let s = act(); me(s).hand = ['seer'];
  me(s).deck = ['copper', 'gold', 'province', 'curse'];
  s = play(s, 'seer');
  ok(s.pending && s.pending.type === 'seer_order' && s.pending.cards.length === 3, '該当なし＝3枚とも戻す（順番の選択待ち）');
  s = reduce(s, { type: 'SEER_ORDER', cards: ['curse', 'gold', 'province'] });
  ok(me(s).deck[0] === 'curse' && me(s).deck[1] === 'gold' && me(s).deck[2] === 'province', '選んだ順に山札の上へ'); }
{ let s = act(); withSupply(s, ['engineer']); me(s).hand = ['seer'];
  me(s).deck = ['copper', 'engineer', 'copper', 'copper'];
  s = play(s, 'seer');
  ok(!me(s).hand.includes('engineer'), '負債コスト（技術者）は「$2〜$4」に含まれない'); }

console.log('=== 香辛料（spices）===');
{ let s = act(); withSupply(s, ['spices']); s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 5;
  s = reduce(s, { type: 'BUY', card: 'spices' });
  ok((me(s).coffers || 0) === 2, '獲得したとき +2財源'); }
{ let s = act(); s.turn.phase = 'buy'; me(s).hand = ['spices'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'spices' });
  ok(s.turn.coins === 2 && s.turn.buys === 2, '+2コイン+1購入'); }

console.log('=== 老魔女（old_witch）===');
{ let s = act(); me(s).hand = ['old_witch']; me(s).deck = ['copper', 'copper', 'copper'];
  s.players[1].hand = ['curse', 'copper'];
  s = play(s, 'old_witch');
  ok(me(s).hand.length === 3, '+3カード');
  ok(cnt(s.players[1].discard, 'curse') === 1, '相手は呪いを獲得');
  ok(s.pending && s.pending.type === 'old_witch_trash' && s.pending.player === 1, '相手は手札の呪いを廃棄してよい');
  s = reduce(s, { type: 'OLD_WITCH_TRASH', card: 'curse' });
  ok(cnt(s.players[1].hand, 'curse') === 0 && cnt(s.trash, 'curse') === 1, '手札の呪いを廃棄した'); }
{ let s = act(); me(s).hand = ['old_witch']; s.players[1].hand = ['curse'];
  s.supply.curse = 0;
  s = play(s, 'old_witch');
  ok(s.pending && s.pending.type === 'old_witch_trash', '呪い山が空でも「手札の呪いを廃棄してよい」は行える'); }
{ let s = act(); me(s).hand = ['old_witch']; s.players[1].hand = ['moat', 'curse'];
  s = play(s, 'old_witch');
  ok(s.pending && s.pending.type === 'old_witch' && s.pending.stage === 'react', '堀のリアクション窓');
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(cnt(s.players[1].discard, 'curse') === 0 && !s.pending, '免疫＝呪いを獲得もせず、呪いを廃棄することもできない'); }
{ let s = act(); me(s).hand = ['old_witch']; s.players[1].hand = ['copper'];
  s = play(s, 'old_witch');
  ok(!s.pending && cnt(s.players[1].discard, 'curse') === 1, '手札に呪いが無ければ廃棄の選択は出ない'); }

console.log('=== 悪党（villain）===');
{ let s = act(); me(s).hand = ['villain'];
  s.players[1].hand = ['copper', 'copper', 'estate', 'silver', 'gold'];
  s = play(s, 'villain');
  ok((me(s).coffers || 0) === 2, '+2財源');
  ok(s.pending && s.pending.type === 'villain_discard' && s.pending.player === 1, '相手は$2以上を1枚捨てる');
  s = reduce(s, { type: 'VILLAIN_DISCARD', card: 'copper' });
  ok(s.pending && s.pending.type === 'villain_discard', '銅貨（$0）は捨てられない＝拒否');
  s = reduce(s, { type: 'VILLAIN_DISCARD', card: 'estate' });
  ok(cnt(s.players[1].discard, 'estate') === 1 && !s.pending, '$2以上を捨てた'); }
{ let s = act(); me(s).hand = ['villain']; s.players[1].hand = ['copper', 'copper', 'copper', 'copper'];
  s = play(s, 'villain');
  ok(!s.pending && (me(s).coffers || 0) === 2, '手札4枚以下は何も起きない（+2財源は得る）'); }
{ let s = act(); me(s).hand = ['villain'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s = play(s, 'villain');
  ok(!s.pending && s.players[1].hand.length === 5, 'コスト$2以上が無ければ手札を公開するだけ（捨てない）'); }
{ let s = act(); me(s).hand = ['villain']; s.players[1].hand = ['moat', 'copper', 'silver', 'gold', 'estate'];
  s = play(s, 'villain');
  s = reduce(s, { type: 'MOAT_REVEAL' });
  ok(!s.pending && s.players[1].hand.length === 5, '堀で無効'); }

console.log('=== CPU：R2 の全 pending が終端する ===');
{
  const PENDS = ['hideout', 'inventor', 'mountain_village', 'priest', 'recruiter', 'sculptor', 'seer', 'old_witch', 'villain'];
  PENDS.forEach((card) => {
    let s = act();
    me(s).hand = [card, 'copper', 'estate', 'silver'];
    me(s).deck = ['copper', 'estate', 'silver', 'gold', 'copper'];
    me(s).discard = ['copper', 'gold'];
    s.players[1].hand = ['copper', 'estate', 'silver', 'gold', 'copper'];
    s = play(s, card);
    s = cpuResolve(s, 40);
    ok(!s.pending, 'CPU が ' + card + ' の選択待ちを終端できる');
  });
}
{ // 玉座の間×司祭×礼拝堂 の混成でも終端する
  let s = act(); withSupply(s, ['throne_room', 'chapel']);
  me(s).hand = ['throne_room', 'priest', 'chapel', 'copper', 'copper', 'estate'];
  s.turn.actions = 2;
  s = play(s, 'throne_room');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'priest' });
  s = cpuResolve(s, 40);
  ok(!s.pending && s.turn.priestCount === 2, '玉座×司祭＝司祭2つぶんの予約');
}

/* ============================================================
   R3＝アーティファクト5種＋パトロンの公開フック
   ============================================================ */
// アーティファクト付与カードを含む王国
const KING_ART = ['border_guard', 'flag_bearer', 'swashbuckler', 'treasurer', 'patron', 'ducat', 'village', 'smithy', 'market', 'militia'];
function actA() { return act(KING_ART); }
// 手番を1周させて自分に戻す（片付け＝先引きが起きる）
function endTurn(s) {
  if (s.pending) return s;
  if (s.turn.phase === 'action') s = reduce(s, { type: 'END_ACTION_PHASE' });
  if (s.pending) return s;
  return reduce(s, { type: 'END_TURN' });
}

console.log('=== ドゥカート金貨（ducat）===');
{ let s = actA(); s.turn.phase = 'buy'; me(s).hand = ['ducat'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'ducat' });
  ok(s.turn.coins === 0 && (me(s).coffers || 0) === 1 && s.turn.buys === 2, 'コインは出ない・+1財源+1購入'); }
{ let s = actA(); s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1; me(s).hand = ['copper', 'copper'];
  s = reduce(s, { type: 'BUY', card: 'ducat' });
  ok(s.pending && s.pending.type === 'ducat_trash', '獲得したとき 手札の銅貨を廃棄してよい');
  s = reduce(s, { type: 'DUCAT_TRASH', trash: true });
  ok(cnt(s.trash, 'copper') === 1 && cnt(me(s).hand, 'copper') === 1, '銅貨1枚を廃棄'); }
{ let s = actA(); s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1; me(s).hand = [];
  s = reduce(s, { type: 'BUY', card: 'ducat' });
  ok(!s.pending, '手札に銅貨が無ければ選択は出ない'); }
{ let s = actA(); withSupply(s, ['workshop']); me(s).hand = ['workshop', 'copper'];
  s = play(s, 'workshop');
  s = reduce(s, { type: 'WORKSHOP_GAIN', card: 'ducat' });
  s = cpuResolve(s, 10);
  ok(!s.pending, '購入以外の獲得（工房）でも onGainQueue 経由で選択が出て終端する'); }

console.log('=== 旗手（flag_bearer）／旗（flag）===');
{ let s = actA(); s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'flag_bearer' });
  ok(s.artifacts.flag === 0, '獲得したとき旗を受け取る'); }
{ let s = actA(); withSupply(s, ['chapel']); me(s).hand = ['chapel', 'flag_bearer'];
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['flag_bearer'] });
  ok(s.artifacts.flag === 0, '廃棄したとき旗を受け取る'); }
{ let s = actA(); s.artifacts.flag = 1;
  s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'flag_bearer' });
  ok(s.artifacts.flag === 0, '相手が持っていても奪う'); }
{ let s = actA(); s.artifacts.flag = 0;
  me(s).deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = endTurn(s);
  ok(s.players[0].hand.length === 6, '旗＝手札を引くとき +1カード（片付けの先引きが6枚）'); }
{ let s = actA(); me(s).deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = endTurn(s);
  ok(s.players[0].hand.length === 5, '旗が無ければ5枚'); }

console.log('=== 剣客（swashbuckler）／宝箱（treasure_chest）===');
{ let s = actA(); me(s).hand = ['swashbuckler']; me(s).deck = ['copper', 'copper', 'copper']; me(s).discard = ['estate'];
  s = play(s, 'swashbuckler');
  ok(me(s).hand.length === 3, '+3カード');
  ok((me(s).coffers || 0) === 1, '捨て札にカードがある＝+1財源');
  ok(s.artifacts.treasure_chest == null, '財源4未満＝宝箱は取らない'); }
{ let s = actA(); me(s).hand = ['swashbuckler']; me(s).deck = ['copper', 'copper', 'copper']; me(s).discard = ['estate'];
  me(s).coffers = 3;
  s = play(s, 'swashbuckler');
  ok((me(s).coffers || 0) === 4 && s.artifacts.treasure_chest === 0, '+1財源の「後」に4個以上を判定＝宝箱を取る'); }
{ let s = actA(); me(s).hand = ['swashbuckler']; me(s).deck = ['copper']; me(s).discard = ['copper', 'copper'];
  me(s).coffers = 3;
  s = play(s, 'swashbuckler');
  ok((me(s).coffers || 0) === 3 && s.artifacts.treasure_chest == null,
    '3枚引く途中でシャッフルして捨て札が空になったら +1財源も宝箱も得られない'); }
{ let s = actA(); s.artifacts.treasure_chest = 0; s.turn.phase = 'action';
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(cnt(me(s).discard, 'gold') === 1, '宝箱＝購入フェイズの開始時に金貨1枚を獲得'); }
{ let s = actA(); s.artifacts.treasure_chest = 1; s.turn.phase = 'action';
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(cnt(me(s).discard, 'gold') === 0, '持っていない人は金貨を得ない'); }

console.log('=== 出納官（treasurer）／鍵（key）===');
{ let s = actA(); me(s).hand = ['treasurer', 'gold'];
  s = play(s, 'treasurer');
  ok(s.turn.coins === 3 && s.pending && s.pending.stage === 'choose', '+3コイン＋3択');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'trash' });
  s = reduce(s, { type: 'TREASURER_TRASH', card: 'gold' });
  ok(cnt(s.trash, 'gold') === 1 && !s.pending, '手札の財宝を廃棄'); }
{ let s = actA(); me(s).hand = ['treasurer']; s.trash = ['gold', 'estate'];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'gain' });
  s = reduce(s, { type: 'TREASURER_GAIN', card: 'gold' });
  ok(me(s).hand.includes('gold') && cnt(s.trash, 'gold') === 0, '廃棄置き場から財宝を手札に獲得'); }
{ let s = actA(); me(s).hand = ['treasurer']; s.trash = ['spices'];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'gain' });
  s = reduce(s, { type: 'TREASURER_GAIN', card: 'spices' });
  ok((me(s).coffers || 0) === 2, '廃棄置き場からの獲得も「獲得」＝香辛料の+2財源が誘発する'); }
{ let s = actA(); me(s).hand = ['treasurer'];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'key' });
  ok(s.artifacts.key === 0 && !s.pending, '鍵を受け取る'); }
{ let s = actA(); me(s).hand = ['treasurer'];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'trash' });
  ok(!s.pending, '遂行できない選択肢（手札に財宝なし）も選べる＝効果なしで閉じる'); }
{ let s = actA(); me(s).hand = ['treasurer']; s.trash = [];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'gain' });
  ok(!s.pending, '遂行できない選択肢（廃棄置き場に財宝なし）も選べる'); }
{ let s = actA(); s.artifacts.key = 0;
  s = endTurn(s); // 相手の手番へ
  s = endTurn(s); // 自分の手番に戻る
  ok(s.turn.active === 0 && s.turn.coins === 1, '鍵＝ターン開始時 +1コイン'); }

console.log('=== 国境警備隊（border_guard）／角笛・ランタン ===');
{ let s = actA(); me(s).hand = ['border_guard']; me(s).deck = ['village', 'smithy', 'gold'];
  s = play(s, 'border_guard');
  ok(s.turn.actions === 1, '+1アクション');
  ok(s.pending && s.pending.type === 'border_guard' && s.pending.cards.length === 2, '上2枚を公開');
  ok(s.pending.allAction === true, '2枚ともアクション');
  s = reduce(s, { type: 'BORDER_GUARD_KEEP', card: 'village' });
  ok(me(s).hand.includes('village') && cnt(me(s).discard, 'smithy') === 1, '1枚を手札・残りを捨て札');
  ok(s.pending && s.pending.type === 'border_guard_artifact', 'ランタンか角笛（強制の二択）');
  s = reduce(s, { type: 'BORDER_GUARD_ARTIFACT', artifact: 'horn' });
  ok(s.artifacts.horn === 0 && !s.pending, '角笛を受け取った'); }
{ let s = actA(); me(s).hand = ['border_guard']; me(s).deck = ['village', 'gold', 'estate'];
  s = play(s, 'border_guard');
  ok(s.pending.allAction === false, 'アクションでない札が混ざると条件を満たさない');
  s = reduce(s, { type: 'BORDER_GUARD_KEEP', card: 'village' });
  ok(!s.pending && s.artifacts.horn == null, 'アーティファクトは取らない'); }
{ let s = actA(); s.artifacts.lantern = 0;
  me(s).hand = ['border_guard']; me(s).deck = ['village', 'smithy', 'market', 'gold'];
  s = play(s, 'border_guard');
  ok(s.pending.cards.length === 3 && s.pending.lantern === true, 'ランタン所持＝3枚公開');
  s = reduce(s, { type: 'BORDER_GUARD_KEEP', card: 'market' });
  ok(cnt(me(s).discard, 'village') === 1 && cnt(me(s).discard, 'smithy') === 1, '2枚を捨て札');
  ok(s.pending && s.pending.type === 'border_guard_artifact' && s.pending.only === 'horn', '3枚ともアクション＝角笛は任意');
  s = reduce(s, { type: 'BORDER_GUARD_ARTIFACT', artifact: null });
  ok(s.artifacts.horn == null && !s.pending, '受け取らないことも選べる'); }
{ let s = actA(); s.artifacts.lantern = 0;
  me(s).hand = ['border_guard']; me(s).deck = ['village', 'smithy', 'gold', 'copper'];
  s = play(s, 'border_guard');
  s = reduce(s, { type: 'BORDER_GUARD_KEEP', card: 'village' });
  ok(!s.pending, 'ランタン所持で3枚すべてアクションでなければ角笛は取れない'); }
{ let s = actA(); me(s).hand = ['border_guard']; me(s).deck = ['village']; me(s).discard = [];
  s = play(s, 'border_guard');
  ok(!s.pending && me(s).hand.includes('village'), '1枚しか公開できなければその1枚を手札へ（アーティファクトなし）'); }
{ // 角笛＝片付けで場の国境警備隊を山札の上に置く（**先引きより前**＝次の手札に入る）
  let s = actA(); s.artifacts.horn = 0;
  me(s).hand = ['border_guard']; me(s).deck = ['gold', 'gold', 'gold', 'gold', 'gold', 'gold'];
  s = play(s, 'border_guard');
  s = reduce(s, { type: 'BORDER_GUARD_KEEP', card: s.pending.cards[0] });
  if (s.pending) s = reduce(s, { type: 'BORDER_GUARD_ARTIFACT', artifact: 'horn' });
  s = endTurn(s);
  ok(s.players[0].hand.includes('border_guard'), '角笛で山札の上に置いた国境警備隊が次の手札に入る（先引きより前に処理）');
  ok(cnt(s.players[0].discard, 'border_guard') === 0, '捨て札には行っていない'); }

console.log('=== パトロン（patron）＝公開フック ===');
{ let s = actA(); me(s).hand = ['patron']; me(s).deck = ['copper'];
  s = play(s, 'patron');
  ok((me(s).villagers || 0) === 1 && s.turn.coins === 2, 'プレイ＝+1村人+2コイン'); }
{ let s = actA(); me(s).hand = ['border_guard']; me(s).deck = ['patron', 'village', 'gold'];
  s = play(s, 'border_guard');
  ok((me(s).coffers || 0) === 1, 'アクションフェイズ中に公開されたら +1財源（国境警備隊）'); }
{ let s = actA(); me(s).hand = ['border_guard']; me(s).deck = ['patron', 'patron', 'gold'];
  s = play(s, 'border_guard');
  ok((me(s).coffers || 0) === 2, '2枚同時公開なら +2財源'); }
{ let s = actA(); withSupply(s, ['vassal']); me(s).hand = ['vassal']; me(s).deck = ['patron'];
  s = play(s, 'vassal');
  ok((me(s).coffers || 0) === 0, '家臣は「捨てる」であって「公開する」ではない＝誘発しない'); }
{ // 相手のアクションフェイズ中に公開させられても +1財源（民兵の手札公開ではなく、役人型の手札公開で検証）
  let s = actA(); withSupply(s, ['bureaucrat']); me(s).hand = ['bureaucrat'];
  s.players[1].hand = ['patron', 'copper', 'copper'];
  s = play(s, 'bureaucrat');
  s = cpuResolve(s, 10);
  ok((s.players[1].coffers || 0) === 1, '相手のアクションフェイズ中の公開でも +1財源（役人：勝利点なしの手札公開）'); }
{ let s = actA(); withSupply(s, ['mint']); s.turn.phase = 'buy'; me(s).hand = ['mint'];
  // 造幣所は購入フェイズに「財宝を公開」＝パトロンは財宝でないので無関係。購入フェイズの公開で誘発しないことを直接確認する
  const before = me(s).coffers || 0;
  E.reduce(s, {});
  s.turn.phase = 'buy';
  // 直接 reveal を呼べないので、購入フェイズでの公開を伴う効果（グレート・ホール等）が無いため、
  // フェイズ判定のガード（turn.phase==='action'）が入っていることをコードパスで担保する
  ok((me(s).coffers || 0) === before, '購入フェイズでは公開しても +1財源にならない（2022エラッタ）'); }

console.log('=== CPU：R3 の全 pending が終端する ===');
{
  const PENDS = ['border_guard', 'treasurer', 'swashbuckler'];
  PENDS.forEach((card) => {
    let s = actA();
    me(s).hand = [card, 'copper', 'estate'];
    me(s).deck = ['village', 'smithy', 'market', 'gold', 'copper'];
    me(s).discard = ['copper'];
    s.trash = ['gold'];
    s = play(s, card);
    s = cpuResolve(s, 40);
    ok(!s.pending, 'CPU が ' + card + ' の選択待ちを終端できる');
  });
}
{ let s = actA(); s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1; me(s).hand = ['copper', 'copper'];
  s = reduce(s, { type: 'BUY', card: 'ducat' });
  s = cpuResolve(s, 10);
  ok(!s.pending, 'CPU が ducat_trash を終端できる'); }

/* ============================================================
   R4＝持続・クリンナップ・再演（貨物船／研究／増築／王笏）
   ============================================================ */
const KING_R4 = ['cargo_ship', 'research', 'improve', 'scepter', 'village', 'smithy', 'market', 'militia', 'moat', 'laboratory'];
function act4() { return act(KING_R4); }
// 片付けの先引きでリシャッフルが起きると「捨て札にあるか」を見られないので、所有枚数（全ゾーン）で数える
function own(s, seat, id) {
  const p = s.players[seat];
  return [].concat(p.deck, p.hand, p.discard, p.inPlay, p.durationCards || [], p.setAside || [], p.cargo || [])
    .filter((c) => c === id).length;
}

console.log('=== 貨物船（cargo_ship）===');
{ let s = act4(); me(s).hand = ['cargo_ship'];
  s = play(s, 'cargo_ship');
  ok(s.turn.coins === 2 && s.turn.cargoCharges === 1, '+2コイン＋このターン1回の権利');
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 3;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.pending && s.pending.type === 'cargo_ship_setaside' && s.pending.card === 'silver', '獲得したとき脇に置ける');
  s = reduce(s, { type: 'CARGO_SHIP_SETASIDE', set: true });
  ok(me(s).cargo.join() === 'silver' && cnt(me(s).discard, 'silver') === 0, '表向きで脇へ');
  s = endTurn(s); // 相手へ
  ok(s.players[0].durationCards.includes('cargo_ship'), '脇に置いたので持続として場に残る');
  s = endTurn(s); // 自分に戻る
  ok(s.players[0].hand.includes('silver') && s.players[0].cargo.length === 0, '次の手番開始時に手札へ'); }
{ let s = act4(); me(s).hand = ['cargo_ship'];
  me(s).deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = play(s, 'cargo_ship');
  s = endTurn(s);
  ok(!s.players[0].durationCards.includes('cargo_ship') && cnt(s.players[0].discard, 'cargo_ship') === 1,
    '1枚も脇に置かなければ持続として残らず捨て札になる'); }
{ let s = act4(); me(s).hand = ['cargo_ship'];
  s = play(s, 'cargo_ship');
  s.turn.phase = 'buy'; s.turn.buys = 2; s.turn.coins = 6;
  s = reduce(s, { type: 'BUY', card: 'copper' });
  s = reduce(s, { type: 'CARGO_SHIP_SETASIDE', set: false }); // 1枚目は見送る
  ok(s.turn.cargoCharges === 1, '見送っても権利は残る（最初の獲得である必要はない）');
  s = reduce(s, { type: 'BUY', card: 'gold' });
  s = reduce(s, { type: 'CARGO_SHIP_SETASIDE', set: true });
  ok(me(s).cargo.join() === 'gold' && s.turn.cargoCharges === 0, '2枚目の獲得を脇に置けた'); }
{ // マスク：貨物船の脇置きは表向き＝相手にも見える
  let s = act4(); me(s).cargo = ['gold'];
  const v = E.maskStateFor(s, 1);
  ok(v.players[0].cargo.join() === 'gold', '貨物船の脇置きは公開情報'); }

console.log('=== 研究（research）===');
{ let s = act4(); me(s).hand = ['research', 'silver'];
  me(s).deck = ['copper', 'estate', 'gold', 'copper'];
  s = play(s, 'research');
  ok(s.turn.actions === 1 && s.pending && s.pending.type === 'research_trash', '+1アクション＋廃棄（強制）');
  s = reduce(s, { type: 'RESEARCH_TRASH', card: 'silver' });
  ok(cnt(s.trash, 'silver') === 1, '銀貨を廃棄');
  ok(me(s).setAside.length === 3, 'コイン費用$3＝山札の上から3枚を脇へ');
  ok(me(s).deck.length === 1, '山札から3枚抜けた');
  s = endTurn(s); s = endTurn(s);
  ok(s.players[0].hand.filter((c) => c === 'copper' || c === 'estate' || c === 'gold').length >= 3,
    '次の手番開始時に脇の3枚が手札へ'); }
{ let s = act4(); me(s).hand = ['research', 'copper'];
  me(s).deck = ['gold', 'gold', 'gold', 'gold', 'gold', 'gold'];
  s = play(s, 'research');
  s = reduce(s, { type: 'RESEARCH_TRASH', card: 'copper' });
  ok(me(s).setAside.length === 0, '銅貨（$0）＝脇置き0枚');
  s = endTurn(s);
  ok(cnt(s.players[0].discard, 'research') === 1 && !s.players[0].durationCards.includes('research'),
    '脇置き0枚なら持続として場に残らず捨て札になる'); }
{ let s = act4(); me(s).hand = ['research']; me(s).deck = ['gold'];
  s = play(s, 'research');
  ok(!s.pending, '手札0枚なら pending を立てない（終端保証）'); }
{ // 裏向き＝相手にはマスクされる
  let s = act4(); me(s).hand = ['research', 'silver']; me(s).deck = ['gold', 'gold', 'gold'];
  s = play(s, 'research');
  s = reduce(s, { type: 'RESEARCH_TRASH', card: 'silver' });
  const v = E.maskStateFor(s, 1);
  ok(v.players[0].setAside.every((c) => c === 'back'), '研究の脇置きは裏向き＝相手にはマスクされる'); }

console.log('=== 増築（improve）===');
{ let s = act4(); me(s).hand = ['improve', 'village']; s.turn.actions = 2;
  s = play(s, 'improve');
  ok(s.turn.coins === 2, '+2コイン');
  s = play(s, 'village');
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'improve' && s.pending.stage === 'trash', 'クリンナップ開始時に廃棄の選択');
  s = reduce(s, { type: 'IMPROVE_TRASH', card: 'village' });
  ok(cnt(s.trash, 'village') === 1 && s.pending.stage === 'gain', '$3の村を廃棄→ちょうど$4を獲得');
  ok(s.pending.exact === 4, 'ちょうど+$1');
  s = reduce(s, { type: 'IMPROVE_GAIN', card: 'militia' });
  ok(own(s, 0, 'militia') === 1, '$4を獲得');
  ok(s.turn.active === 1, '獲得のあと片付けが進む'); }
{ let s = act4(); me(s).hand = ['improve'];
  s = play(s, 'improve');
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'improve', '増築自身も対象になる');
  s = reduce(s, { type: 'IMPROVE_TRASH', card: null });
  ok(!s.pending && s.turn.active === 1, '辞退できる'); }
{ let s = act4(); me(s).hand = ['improve', 'moat']; s.turn.actions = 2;
  s = play(s, 'improve'); s = play(s, 'moat');
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'IMPROVE_TRASH', card: 'moat' });
  ok(s.pending && s.pending.exact === 3, '堀($2)→ちょうど$3'); }
{ // 持続（このターン場に残り続ける貨物船）は対象外
  let s = act4(); me(s).hand = ['improve', 'cargo_ship']; s.turn.actions = 2;
  s = play(s, 'improve'); s = play(s, 'cargo_ship');
  s.turn.phase = 'buy'; s.turn.buys = 1; s.turn.coins = 3;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  s = reduce(s, { type: 'CARGO_SHIP_SETASIDE', set: true }); // 脇に置いた＝持続として残る
  s = reduce(s, { type: 'END_TURN' });
  const tg = E.improveTargets(s, 0);
  ok(tg.indexOf('cargo_ship') < 0, '場に残る持続は「このターン捨て札にする」に含まれない');
  ok(tg.indexOf('improve') >= 0, '増築自身は対象'); }
{ // 城塞を廃棄＝手札に戻るが廃棄は成立＝$5を獲得できる
  let s = act4(); withSupply(s, ['fortress', 'laboratory']);
  me(s).hand = ['improve', 'fortress']; s.turn.actions = 2;
  s = play(s, 'improve'); s = play(s, 'fortress');
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'IMPROVE_TRASH', card: 'fortress' });
  ok(s.pending && s.pending.exact === 5, '城塞($4)→ちょうど$5');
  s = reduce(s, { type: 'IMPROVE_GAIN', card: 'laboratory' });
  ok(own(s, 0, 'laboratory') === 1, '$5を獲得（城塞は手札に戻るが廃棄は成立）');
  ok(own(s, 0, 'fortress') === 1 && cnt(s.trash, 'fortress') === 0, '城塞は廃棄置き場に残らず手札に戻る'); }

console.log('=== 王笏（scepter）===');
{ let s = act4(); s.turn.phase = 'buy'; me(s).hand = ['scepter'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'scepter' });
  ok(s.pending && s.pending.type === 'scepter' && s.pending.stage === 'choose', '二択');
  s = reduce(s, { type: 'SCEPTER_CHOOSE', mode: 'coins' });
  ok(s.turn.coins === 2 && !s.pending, '+2コイン'); }
{ let s = act4(); me(s).hand = ['market', 'scepter']; s.turn.actions = 1;
  s = play(s, 'market'); // 場に市場（+1カード+1アクション+1購入+1コイン）
  s.turn.phase = 'buy';
  const c0 = s.turn.coins, b0 = s.turn.buys;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'scepter' });
  s = reduce(s, { type: 'SCEPTER_CHOOSE', mode: 'replay' });
  ok(s.pending && s.pending.stage === 'replay', '再演の対象を選ぶ');
  s = reduce(s, { type: 'SCEPTER_REPLAY', card: 'market' });
  ok(s.turn.coins === c0 + 1 && s.turn.buys === b0 + 1, '市場をもう一度使用した（+1コイン+1購入）'); }
{ let s = act4(); s.turn.phase = 'buy'; me(s).hand = ['scepter'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'scepter' });
  s = reduce(s, { type: 'SCEPTER_CHOOSE', mode: 'replay' });
  ok(!s.pending && s.turn.coins === 0, '対象が無くても「再度使用」を選べる（何も起きない＝engineは拒否しない）'); }
{ let s = act4(); withSupply(s, ['band_of_misfits']);
  me(s).inPlay = ['band_of_misfits']; s.turn.phase = 'buy'; me(s).hand = ['scepter'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'scepter' });
  const cand = E.scepterTargets(s, 0);
  ok(cand.indexOf('band_of_misfits') < 0, '命令カード（はみだし者）は再演できない（2024エラッタ）');
  s = reduce(s, { type: 'SCEPTER_CHOOSE', mode: 'coins' }); }
{ let s = act4(); me(s).inPlay = ['scepter']; s.turn.phase = 'buy';
  const cand = E.scepterTargets(s, 0);
  ok(cand.indexOf('scepter') < 0, '王笏（財宝）は再演対象にならない'); }

console.log('=== CPU：R4 の全 pending が終端する ===');
{
  const PENDS = ['research', 'cargo_ship'];
  PENDS.forEach((card) => {
    let s = act4();
    me(s).hand = [card, 'copper', 'estate'];
    me(s).deck = ['silver', 'gold', 'copper', 'estate', 'copper'];
    s = play(s, card);
    s = cpuResolve(s, 40);
    ok(!s.pending, 'CPU が ' + card + ' の選択待ちを終端できる');
  });
}
{ let s = act4(); me(s).hand = ['improve', 'village']; s.turn.actions = 2;
  s = play(s, 'improve'); s = play(s, 'village');
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  s = cpuResolve(s, 40);
  ok(!s.pending, 'CPU が増築のクリンナップ窓を終端できる'); }
{ let s = act4(); me(s).hand = ['market', 'scepter']; s.turn.actions = 1;
  s = play(s, 'market'); s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'scepter' });
  s = cpuResolve(s, 40);
  ok(!s.pending, 'CPU が王笏の選択待ちを終端できる'); }

/* ============================================================
   R5＝プロジェクト19種
   ============================================================ */
// プロジェクトを採用し、席0がそれを買った状態の盤面（アクションフェイズ）
function proj(ids, kingdom) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'remodel', 'laboratory']).slice(),
    { startActive: 0, projects: ids });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].projects = ids.slice(0, 2);
  return s;
}
// 自分の手番開始まで進める（相手→自分）。相手の選択待ちだけ CPU に解かせ、**自分のターン開始時の pending は残す**。
function toMyTurn(s) {
  s = endTurn(s); s = cpuResolve(s, 40); // 相手の手番へ
  s = endTurn(s);                        // 相手の手番終了 → 自分のターン開始（pending はそのまま）
  return s;
}

console.log('=== 縁日／兵舎（自動）===');
{ let s = proj(['fair', 'barracks']); s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = toMyTurn(s);
  ok(s.turn.active === 0 && s.turn.buys === 2 && s.turn.actions === 2, '縁日＝+1購入／兵舎＝+1アクション（ターン開始時）'); }

console.log('=== 大聖堂（強制廃棄）===');
{ let s = proj(['cathedral']); s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'estate'];
  s = toMyTurn(s);
  ok(s.pending && s.pending.type === 'cathedral', 'ターン開始時に廃棄（強制）');
  s = reduce(s, { type: 'CATHEDRAL_TRASH', card: 'copper' });
  ok(cnt(s.trash, 'copper') === 1 && !s.pending, '手札1枚を廃棄'); }

console.log('=== 城門（+1カード→1枚を山札の上へ）===');
{ let s = proj(['city_gate']); s.players[0].deck = ['gold', 'copper', 'copper', 'copper', 'copper', 'estate'];
  s = toMyTurn(s);
  ok(s.pending && s.pending.type === 'city_gate' && s.players[0].hand.length === 6, '先に+1カード（手札6枚）');
  s = reduce(s, { type: 'CITY_GATE_TOPDECK', card: 'gold' });
  ok(s.players[0].deck[0] === 'gold' && s.players[0].hand.length === 5, '手札1枚を山札の上へ'); }

console.log('=== サイロ（銅貨を引き直す）===');
{ let s = proj(['silos']);
  s.players[0].deck = ['copper', 'copper', 'estate', 'estate', 'estate', 'gold', 'gold'];
  s = toMyTurn(s);
  ok(s.pending && s.pending.type === 'silos', 'ターン開始時に銅貨捨ての選択');
  const h0 = s.players[0].hand.length;
  s = reduce(s, { type: 'SILOS_DISCARD', count: 2 });
  ok(s.players[0].hand.length === h0 && cnt(s.players[0].hand, 'copper') === 0, '銅貨2枚を捨てて2枚引く'); }

console.log('=== 悪巧み（トークンを溜めて引く）===');
{ let s = proj(['sinister_plot']); s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = toMyTurn(s);
  s = reduce(s, { type: 'SINISTER_PLOT_RESOLVE', mode: 'add' });
  ok(s.players[0].sinisterPlot === 1, 'トークンを置く');
  s = toMyTurn(s);
  s = reduce(s, { type: 'SINISTER_PLOT_RESOLVE', mode: 'add' });
  ok(s.players[0].sinisterPlot === 2, 'トークンが累積する');
  s = toMyTurn(s);
  const h0 = s.players[0].hand.length;
  s = reduce(s, { type: 'SINISTER_PLOT_RESOLVE', mode: 'take' });
  ok(s.players[0].sinisterPlot === 0 && s.players[0].hand.length === h0 + 2, 'トークンを全部取り除いて +2カード'); }

console.log('=== 輪作（勝利点を捨てて+2カード）===');
{ let s = proj(['crop_rotation']);
  s.players[0].deck = ['estate', 'copper', 'copper', 'copper', 'copper', 'gold', 'gold'];
  s = toMyTurn(s);
  ok(s.pending && s.pending.type === 'crop_rotation', '手札に勝利点があれば選択');
  const h0 = s.players[0].hand.length;
  s = reduce(s, { type: 'CROP_ROTATION_RESOLVE', card: 'estate' });
  ok(s.players[0].hand.length === h0 + 1 && cnt(s.players[0].discard, 'estate') === 1, '勝利点1枚を捨てて +2カード'); }
{ let s = proj(['crop_rotation']); s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = toMyTurn(s);
  ok(!s.pending, '手札に勝利点が無ければ何も起きない'); }

console.log('=== 野外劇／探査（購入フェイズ終了時）===');
{ let s = proj(['pageant']); s.turn.phase = 'buy'; s.turn.coins = 3;
  s = reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'pageant', '$1以上残っていれば選択');
  s = reduce(s, { type: 'PAGEANT_PAY', pay: true });
  ok(s.players[0].coffers === 1, '$1を支払って +1財源'); }
{ let s = proj(['exploration']); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].coffers === 1 && s.players[0].villagers === 1, 'カードを1枚も獲得しなかった＝+1財源+1村人'); }
{ let s = proj(['exploration']); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  s = reduce(s, { type: 'END_TURN' });
  ok((s.players[0].coffers || 0) === 0, 'カードを獲得したら発動しない'); }

console.log('=== 学園／ギルド集会所／道路網（獲得トリガー）===');
{ let s = proj(['academy']); s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'village' });
  ok(s.players[0].villagers === 1, '学園＝アクション獲得で +1村人'); }
{ let s = proj(['guildhall']); s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.players[0].coffers === 1, 'ギルド集会所＝財宝獲得で +1財源'); }
{ let s = proj(['road_network']);
  s.players[1].deck = ['copper', 'copper', 'copper'];
  s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  const h1 = s.players[1].hand.length;
  s = reduce(s, { type: 'BUY', card: 'duchy' });
  ok(s.players[1].hand.length === h1, '道路網を持っていない相手は引かない');
  s.players[1].projects = ['road_network'];
  s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'duchy' });
  ok(s.players[1].hand.length === h1 + 1, '他のプレイヤーが勝利点を獲得したとき +1カード（自分のターンでなくても）'); }

console.log('=== 技術革新（獲得したアクションを使用）===');
{ let s = proj(['innovation']); s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s.players[0].deck = ['gold', 'gold'];
  s = reduce(s, { type: 'BUY', card: 'village' });
  ok(s.pending && s.pending.type === 'innovation', 'アクションを獲得したとき使用してよい');
  s = reduce(s, { type: 'INNOVATION_PLAY', play: true });
  ok(s.players[0].inPlay.includes('village') && s.players[0].hand.includes('gold'), '獲得した村を使用した（+1カード）');
  ok(s.turn.innovationUsed === true, '各ターン1回'); }
{ let s = proj(['innovation']); s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 2;
  s = reduce(s, { type: 'BUY', card: 'village' });
  s = reduce(s, { type: 'INNOVATION_PLAY', play: false });
  ok(!s.turn.innovationUsed, '使わなければ権利は消費しない');
  s = reduce(s, { type: 'BUY', card: 'village' });
  ok(s.pending && s.pending.type === 'innovation', '2枚目の獲得でも使える'); }

console.log('=== 運河（コスト-$1）===');
{ let s = proj(['canal']);
  ok(E.cardCost(s, 'province') === 7 && E.cardCost(s, 'copper') === 0, '自分のターン中は全カード$1安い（$0未満にならない）');
  ok(E.cardCost(s, 'estate') === 1, '屋敷は$1（$0ではない）');
  s.turn.active = 1;
  ok(E.cardCost(s, 'province') === 8, '相手のターン中は元のコストに戻る'); }

console.log('=== 下水道（廃棄のたびに追加廃棄）===');
{ let s = proj(['sewers']);
  s.players[0].hand = ['chapel', 'copper', 'copper', 'estate', 'curse'];
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['copper', 'estate'] });
  ok(s.pending && s.pending.type === 'sewers_trash', '廃棄のたびに追加廃棄の選択');
  s = reduce(s, { type: 'SEWERS_TRASH', card: 'curse' });
  ok(cnt(s.trash, 'curse') === 1, '追加で手札1枚を廃棄');
  ok(s.pending && s.pending.type === 'sewers_trash', '2枚同時廃棄＝枚数ぶん誘発');
  s = reduce(s, { type: 'SEWERS_TRASH', card: null });
  ok(!s.pending, '辞退できる'); }
{ let s = proj(['sewers']);
  s.players[0].hand = ['chapel', 'copper', 'estate'];
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['copper'] });
  s = reduce(s, { type: 'SEWERS_TRASH', card: 'estate' });
  ok(!s.pending, '下水道の追加廃棄では再誘発しない'); }

console.log('=== 星図（シャッフルの一番上）===');
{ let s = proj(['star_chart']);
  s.players[0].deck = []; s.players[0].discard = ['copper', 'copper', 'gold', 'estate'];
  E.reduce(s, {});
  const p0 = s.players[0];
  // draw を起こす：手札を引く
  s.players[0].hand = [];
  s = proj(['star_chart']);
  s.players[0].deck = []; s.players[0].discard = ['copper', 'copper', 'gold', 'estate'];
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' }); // 片付けで5枚引く＝リシャッフル
  ok(s.players[0].hand.includes('gold'), '星図＝シャッフルした束の一番上に最良の札（金貨）が来る'); }

console.log('=== 山砦（最初のアクションを再演）===');
{ let s = proj(['citadel']);
  s.players[0].hand = ['market', 'village'];
  s.players[0].deck = ['gold', 'gold', 'gold'];
  s.turn.actions = 2;
  s = play(s, 'market');
  ok(s.turn.coins === 2 && s.turn.buys === 3, '市場を2回使用した（+2コイン+2購入）');
  ok(s.turn.citadelUsed === true, 'このターンは発動済み');
  const c0 = s.turn.coins;
  s = play(s, 'village');
  ok(s.turn.coins === c0, '2枚目のアクションは再演されない'); }

console.log('=== ピアッツァ（ターン開始時に山札の上のアクションを使用）===');
// ※このエンジンは前ターンの片付けで次の手札を先引きする＝ターン開始時の「山札の一番上」は6枚目のカード。
{ let s = proj(['piazza']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'market', 'gold'];
  s = toMyTurn(s);
  ok(s.players[0].inPlay.includes('market'), '山札の一番上のアクションを使用');
  ok(s.turn.actions === 2, 'アクション権を消費しない（市場の+1アクションで2）');
  ok(s.turn.phase === 'action', 'ターン開始時はアクションフェイズ（帝国の冠が壊れない）'); }
{ let s = proj(['piazza']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'gold'];
  s = toMyTurn(s);
  ok(s.players[0].deck[0] === 'gold', 'アクションでなければ山札の上に残す（捨てない）'); }
{ // ピアッツァ×山砦＝ターン開始時のアクションも「そのターン最初のアクション使用」
  let s = proj(['piazza', 'citadel']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'market', 'gold', 'gold'];
  s = toMyTurn(s);
  ok(s.turn.citadelUsed === true && s.turn.buys === 3, 'ピアッツァでプレイしたアクションも山砦で再演される'); }

console.log('=== 艦隊（終了後の追加ターン）===');
{ let s = proj(['fleet']);
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.players[1].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.supply.province = 1;
  s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'province' }); // 属州の山が尽きる
  s = reduce(s, { type: 'END_TURN' });
  ok(!s.gameOver, '艦隊を持つプレイヤーがいるのでまだ終わらない');
  ok(s.turn.active === 0, '艦隊の追加ターン（席0＝艦隊の所有者）');
  s = endTurn(s); s = cpuResolve(s, 40);
  ok(s.gameOver === true, '艦隊ターンが終わったらゲーム終了'); }
{ let s = proj(['fleet']);
  s.players[0].projects = []; // 誰も艦隊を持っていない
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.supply.province = 1;
  s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'province' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.gameOver === true, '艦隊を誰も持っていなければ通常どおり終了'); }

console.log('=== CPU：R5 の全 pending が終端する ===');
{
  const P5 = ['cathedral', 'city_gate', 'silos', 'sinister_plot', 'crop_rotation'];
  P5.forEach((id) => {
    let s = proj([id]);
    s.players[0].deck = ['copper', 'copper', 'estate', 'copper', 'copper', 'gold', 'gold'];
    s = toMyTurn(s);
    s = cpuResolve(s, 40);
    ok(!s.pending, 'CPU が ' + id + ' の選択待ちを終端できる');
  });
}
{ let s = proj(['pageant']); s.turn.phase = 'buy'; s.turn.coins = 3;
  s = reduce(s, { type: 'END_TURN' });
  s = cpuResolve(s, 20);
  ok(!s.pending, 'CPU が野外劇を終端できる'); }
{ let s = proj(['innovation']); s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s.players[0].deck = ['gold', 'gold'];
  s = reduce(s, { type: 'BUY', card: 'village' });
  s = cpuResolve(s, 20);
  ok(!s.pending, 'CPU が技術革新を終端できる'); }
{ let s = proj(['sewers']); s.players[0].hand = ['chapel', 'copper', 'estate', 'curse'];
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['copper'] });
  s = cpuResolve(s, 20);
  ok(!s.pending, 'CPU が下水道を終端できる'); }

/* ============================================================
   R5b＝資本主義（Capitalism）＝唯一の「種別を動的に書き換える」プロジェクト
   ============================================================ */
console.log('=== 資本主義（capitalism）===');
{ let s = proj(['capitalism'], ['improve', 'inventor', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory']);
  ok(E.isTreasureFor(s, 'improve') === true, '増築（+$2）は財宝になる');
  ok(E.isTreasureFor(s, 'inventor') === false, '発明家（+$なし）は財宝にならない');
  ok(E.isTreasureFor(s, 'village') === false, '村（+$なし）は財宝にならない');
  ok(E.isTreasureFor(s, 'market') === true, '市場（+$1）は財宝になる');
  ok(E.isTreasureFor(s, 'copper') === true, '銅貨は当然 財宝');
  s.turn.active = 1;
  ok(E.isTreasureFor(s, 'improve') === false, '相手のターン中は無効'); }
{ let s = proj(['capitalism'], ['improve', 'inventor', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory']);
  ok(E.isTreasureFor(s, 'coppersmith') === false, '銅細工師は英語原文に「+$」記号が無い＝除外（誤判定しない）'); }
{ // 財宝として購入フェイズに使える（アクション権を消費しない）＋効果は全部解決する
  let s = proj(['capitalism'], ['improve', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].hand = ['market'];
  s.players[0].deck = ['gold'];
  s.turn.phase = 'buy'; s.turn.actions = 0;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'market' });
  ok(s.players[0].inPlay.includes('market'), '購入フェイズにアクションを財宝として使える');
  ok(s.turn.coins === 1 && s.turn.buys === 2 && s.players[0].hand.includes('gold'), '効果は全部解決する（+1カード+1アクション+1購入+1コイン）');
  ok(s.turn.actions === 1, 'アクション権は消費しない（市場の +1アクション だけ増える）'); }
{ // アタックも購入フェイズで発動する
  let s = proj(['capitalism'], ['improve', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].hand = ['militia'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'estate'];
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'militia' });
  ok(s.turn.coins === 2 && s.pending && s.pending.type === 'militia', '購入フェイズでもアタックが発動しリアクション窓が開く'); }
{ // 山賊で相手の「財宝になったアクション」を廃棄できる
  let s = proj(['capitalism'], ['improve', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'bandit']);
  s.players[0].hand = ['bandit'];
  s.players[1].deck = ['market', 'estate'];
  s = play(s, 'bandit');
  s = cpuResolve(s, 20);
  ok(cnt(s.trash, 'market') === 1, '山賊が相手の市場（資本主義で財宝）を廃棄した'); }
{ // 出納官で廃棄置き場から「財宝になったアクション」を獲得できる
  let s = proj(['capitalism'], ['improve', 'treasurer', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].hand = ['treasurer'];
  s.trash = ['improve'];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'gain' });
  s = reduce(s, { type: 'TREASURER_GAIN', card: 'improve' });
  ok(s.players[0].hand.includes('improve'), '廃棄置き場の増築を財宝として手札に獲得できた'); }
{ // ギルド集会所＝「財宝の獲得」に数える
  let s = proj(['capitalism', 'guildhall'], ['improve', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'improve' });
  ok(s.players[0].coffers === 1, '資本主義で財宝になった増築の獲得＝ギルド集会所が発動'); }
{ // 財宝を全部出す＝資本主義の財宝も出る
  let s = proj(['capitalism'], ['improve', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].hand = ['copper', 'improve'];
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_ALL_TREASURES' });
  ok(s.turn.coins === 3, '銅貨$1＋増築$2＝$3'); }
{ // 資本主義を持っていなければ何も起きない（既存挙動）
  let s = proj([], ['improve', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].hand = ['market'];
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'market' });
  ok(!s.players[0].inPlay.includes('market') && s.turn.coins === 0, '資本主義が無ければアクションは財宝ではない'); }

/* ============================================================
   敵対レビュー（多エージェント・5観点）で確定したバグの回帰テスト（H1/H2/M1/M2/M3/L1/L2/L4/L5）
   ============================================================ */
console.log('=== 回帰 H1：増築が誘発した対話は「片付け（先引き・手番交代）より前」に解決する ===');
{ // 技術革新：増築の格上げ獲得したアクションを、**自分の手番のうちに**使う
  let s = proj(['innovation', 'fair'], ['improve', 'research', 'old_witch', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'laboratory']);
  s.players[0].projects = ['innovation'];
  s.players[0].hand = ['improve'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate']; // 民兵のアタック対象
  s = play(s, 'improve');
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'improve', 'クリンナップ開始時に増築の窓');
  s = reduce(s, { type: 'IMPROVE_TRASH', card: 'improve' }); // $3 → ちょうど$4
  s = reduce(s, { type: 'IMPROVE_GAIN', card: 'militia' });
  ok(s.pending && s.pending.type === 'innovation', '技術革新の窓が開く');
  ok(s.turn.active === 0, '**まだ自分の手番**（片付けは保留されている）');
  s = reduce(s, { type: 'INNOVATION_PLAY', play: true });
  ok(s.pending && s.pending.player === 1 && s.turn.active === 0,
    '獲得した民兵を**自分の手番のうちに**使い、相手がアタックを受けた');
  s = cpuResolve(s, 30);
  ok(s.turn.active === 1, 'その後で片付けが進み手番が移る'); }
{ // 下水道：追加廃棄の対象は「先引きした次の手札」ではなく、いまの手札
  let s = proj(['sewers'], ['improve', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'laboratory']);
  s.players[0].projects = ['sewers'];
  s.players[0].hand = ['improve', 'estate'];
  s.players[0].deck = ['gold', 'gold', 'gold', 'gold', 'gold', 'gold'];
  s = play(s, 'improve');
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'IMPROVE_TRASH', card: 'improve' });
  s = reduce(s, { type: 'IMPROVE_GAIN', card: 'militia' });
  ok(s.pending && s.pending.type === 'sewers_trash', '下水道の窓が開く');
  ok(s.turn.active === 0 && s.players[0].hand.includes('estate') && !s.players[0].hand.includes('gold'),
    '対象は「捨てる前の手札」＝先引きした金貨ではない'); }

console.log('=== 回帰 H2：出納官 × 資本主義（人間が詰まない＝終端保証）===');
{ let s = proj(['capitalism'], ['improve', 'treasurer', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].projects = ['capitalism'];
  s.players[0].hand = ['treasurer', 'inventor', 'estate']; // 本物の財宝も「+$を持つアクション」も無い
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'trash' });
  ok(!s.pending, '手札に（動的にも）財宝が無ければ trash ステージは即終端する'); }
{ let s = proj(['capitalism'], ['improve', 'treasurer', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].projects = ['capitalism'];
  s.players[0].hand = ['treasurer'];
  s.trash = ['estate'];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'gain' });
  ok(!s.pending, '廃棄置き場に財宝が無ければ gain ステージは即終端する'); }
{ let s = proj(['capitalism'], ['improve', 'treasurer', 'village', 'smithy', 'market', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].projects = ['capitalism'];
  s.players[0].hand = ['treasurer', 'improve'];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'trash' });
  ok(s.pending && s.pending.stage === 'trash', '資本主義で財宝になった増築があるので trash ステージが開く');
  s = reduce(s, { type: 'TREASURER_TRASH', card: 'improve' });
  ok(cnt(s.trash, 'improve') === 1 && !s.pending, '増築を財宝として廃棄できる'); }

console.log('=== 回帰 M1：「1回だけ」の窓は解決時に再検査する（実験の on-gain で窓が2件積まれる）===');
{ let s = proj(['innovation'], ['experiment', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'laboratory']);
  s.players[0].projects = ['innovation'];
  s.players[0].deck = ['gold', 'gold', 'gold', 'gold'];
  s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'experiment' }); // 実験を獲得→もう1枚の実験も獲得＝窓が2件
  s = reduce(s, { type: 'INNOVATION_PLAY', play: true });
  const played = s.players[0].inPlay.filter((c) => c === 'experiment').length + (s.turn.actionsPlayed || 0);
  if (s.pending && s.pending.type === 'innovation') s = reduce(s, { type: 'INNOVATION_PLAY', play: true });
  ok(s.turn.innovationUsed === true, '各ターン1回だけ使える');
  ok((s.turn.actionsPlayed || 0) === 1, '2回目の窓を受諾しても2枚目は使用されない（actionsPlayed=1）'); }
{ let s = proj([], ['cargo_ship', 'experiment', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'laboratory']);
  s.players[0].hand = ['cargo_ship'];
  s = play(s, 'cargo_ship');
  s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'experiment' });
  s = reduce(s, { type: 'CARGO_SHIP_SETASIDE', set: true });
  if (s.pending && s.pending.type === 'cargo_ship_setaside') s = reduce(s, { type: 'CARGO_SHIP_SETASIDE', set: true });
  ok(s.players[0].cargo.length === 1, '貨物船1枚で脇に置けるのは1枚だけ');
  ok((s.players[0].delayedEffects || []).filter((e) => e.type === 'cargo_ship').length === 1, '持続の予約も1件だけ'); }

console.log('=== 回帰 M2：増築の窓は「プレイ回数」で数える（山砦/玉座の再演を落とさない）===');
{ let s = proj(['citadel'], ['improve', 'lackeys', 'experiment', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'laboratory']);
  s.players[0].projects = ['citadel'];
  s.players[0].hand = ['improve'];
  s.players[0].inPlay = ['village']; // 2回目の格上げ対象（場のアクション）
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = play(s, 'improve');
  ok(s.turn.coins === 4 && s.turn.improvePlays === 2, '山砦で増築を2回使った（+$4・プレイ回数2）');
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'IMPROVE_TRASH', card: 'improve' });
  s = reduce(s, { type: 'IMPROVE_GAIN', card: 'militia' });
  ok(s.pending && s.pending.type === 'improve', '2回目の増築の窓が開く（場の物理枚数で数えていない）');
  s = reduce(s, { type: 'IMPROVE_TRASH', card: null });
  ok(s.turn.active === 1, '辞退で片付けが進む'); }

console.log('=== 回帰 M3：CPU が増築でポーション費用の札を廃棄しても無限ループしない ===');
{ let s = proj([], ['improve', 'university', 'alchemist', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'laboratory']);
  s.players[0].inPlay = ['improve', 'university'];
  s.turn.improvePlays = 1;
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'IMPROVE_TRASH', card: 'university' }); // $2P → ちょうど $3P（錬金術師）
  ok(s.pending && s.pending.stage === 'gain' && s.pending.pot === 1, 'ポーション費用の窓');
  const a = CPU.decide(s);
  ok(a && a.type === 'IMPROVE_GAIN' && a.card === 'alchemist', 'CPU はポーション費用の一致する札を選ぶ');
  s = cpuResolve(s, 20);
  ok(!s.pending, 'CPU が終端できる（engine が拒否し続けない）'); }

console.log('=== 回帰 L1/L2：資本主義の財宝を2回使う／-$1トークンが食い込む ===');
{ let s = proj(['capitalism'], ['improve', 'market', 'village', 'smithy', 'militia', 'moat', 'cellar', 'mine', 'laboratory', 'counterfeit']);
  s.players[0].projects = ['capitalism'];
  s.players[0].hand = ['counterfeit', 'market'];
  s.players[0].deck = ['gold', 'gold', 'gold'];
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'counterfeit' });
  s = reduce(s, { type: 'COUNTERFEIT_PLAY', card: 'market' });
  ok(s.turn.coins === 3 && s.turn.buys === 4, '偽造通貨で市場を2回使った（$1+$1＋偽造通貨$1／+1購入×2）');
  ok(s.players[0].hand.filter((c) => c === 'gold').length === 2, '2回とも +1カード'); }
{ let s = proj(['capitalism'], ['improve', 'market', 'village', 'smithy', 'militia', 'moat', 'cellar', 'mine', 'laboratory', 'inventor']);
  s.players[0].projects = ['capitalism'];
  s.players[0].hand = ['market'];
  s.players[0].deck = ['gold'];
  s.players[0].minusCoin = true;
  s = reduce(s, { type: 'END_ACTION_PHASE' }); // -$1トークンを coinPenalty に変換
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'market' });
  ok(s.turn.coins === 0, '-$1トークンが資本主義の財宝（市場の+$1）にも食い込む'); }

console.log('=== 回帰 L4：ピアッツァでターン開始時に出納官→鍵を取ると +$1 が入る ===');
{ let s = proj(['piazza'], ['treasurer', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'laboratory']);
  s.players[0].projects = ['piazza'];
  s.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'treasurer', 'gold'];
  s = toMyTurn(s);
  ok(s.pending && s.pending.type === 'treasurer', 'ピアッツァが出納官を使用した');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'key' });
  ok(s.artifacts.key === 0 && s.turn.coins === 4, '鍵を受け取り、開始時トリガーとして +$1（出納官の$3＋鍵の$1）'); }
{ let s = proj([], ['treasurer', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'laboratory']);
  s.players[0].hand = ['treasurer'];
  s = play(s, 'treasurer');
  s = reduce(s, { type: 'TREASURER_CHOOSE', mode: 'key' });
  ok(s.turn.coins === 3, '通常は取ったターンには +$1 が入らない'); }

console.log('=== 回帰 L5：CPU が村人を使う ===');
{ let s = act(['lackeys', 'acting_troupe', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine', 'laboratory']);
  me(s).hand = ['smithy', 'market'];
  me(s).deck = ['gold', 'gold', 'gold', 'gold'];
  me(s).villagers = 2;
  s.turn.actions = 0;
  const a = CPU.decide(s);
  ok(a && a.type === 'SPEND_VILLAGER', 'アクション権0＋手札にアクション＋村人あり → 村人を使う');
  s = reduce(s, a);
  ok(s.turn.actions === 1 && me(s).villagers === 1, '+1アクション'); }
{ let s = act(['lackeys', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine', 'remodel', 'laboratory']);
  me(s).hand = ['copper', 'copper'];
  me(s).villagers = 2;
  s.turn.actions = 0;
  const a = CPU.decide(s);
  ok(a && a.type === 'END_ACTION_PHASE', '手札にアクションが無ければ村人を無駄遣いしない（非ループ）'); }

console.log('\n=== ' + pass + ' 成功 / ' + fail + ' 失敗 ===');
if (fail > 0) process.exit(1);
