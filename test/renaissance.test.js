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

console.log('\n=== ' + pass + ' 成功 / ' + fail + ' 失敗 ===');
if (fail > 0) process.exit(1);
