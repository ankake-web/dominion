/* 夜想曲（Nocturne）の検証（Node 単体実行）
   使い方: node test/nocturne.test.js
   N0 ＝ 夜フェイズ／家宝／非サプライ5山／祝福・呪詛デッキ／状態／脇札。
   N0b＝ UI から夜行カードを使う経路（UI 側の描画検証は test/nocturne-ui.test.js）。
   正本＝docs/research/nocturne_rules.md（冒頭の「実装前に必読」18項目を先に読むこと） */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260812;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  x FAIL: ' + m); } }
const reduce = (s, a) => E.reduce(s, a);
const me = (s) => s.players[0];
const foe = (s) => s.players[1];
// 夜想曲の素の盤面（手札/山札/捨て札を直に組む）。kingdom は夜想曲＋基本の混成でよい。
function mk(kingdom, opts) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || []).slice(), Object.assign({ startActive: 0 }, opts || {}));
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  return s;
}
const FILLER = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'mine'];
function king(cards) { return cards.concat(FILLER).slice(0, 10); }

try {

console.log('\n=== N0: 夜フェイズ（アクション→購入→夜→片付け） ===');
{
  const s = mk(king(['guardian', 'monastery']));
  me(s).hand = ['guardian', 'copper'];
  let t = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(t.turn.phase === 'buy', 'アクションフェイズ終了で購入フェイズになる');
  t = reduce(t, { type: 'END_TURN' });
  ok(t.turn.phase === 'night', '手札に夜行カードがあれば購入フェイズの後に夜フェイズへ入る');
  ok(t.turn.active === 0, '夜フェイズはまだ自分の手番');
  const played = reduce(t, { type: 'PLAY_NIGHT', card: 'guardian' });
  ok(played.players[0].inPlay.includes('guardian'), '夜行カードは場に出る');
  ok(played.turn.actions === 1 && played.turn.buys === 1, '夜行カードはアクション権も購入権も消費しない');
  const done = reduce(played, { type: 'END_TURN' });
  ok(done.turn.active === 1, '夜フェイズで「ターン終了」＝片付けて手番が移る');
}
{
  const s = mk(king(['guardian']));
  me(s).hand = ['copper', 'estate'];
  const t = reduce(reduce(s, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(t.turn.active === 1, '手札に夜行カードが1枚も無ければ夜フェイズで止まらない');
}
{
  // 夜行カードでないカードは夜フェイズに使えない／夜行カードは他フェイズで PLAY_NIGHT できない
  const s = mk(king(['guardian']));
  me(s).hand = ['guardian', 'village'];
  const night = reduce(reduce(s, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(reduce(night, { type: 'PLAY_NIGHT', card: 'village' }) === night ||
     !reduce(night, { type: 'PLAY_NIGHT', card: 'village' }).players[0].inPlay.includes('village'),
    '夜フェイズに夜行でないカードは使えない');
  const inAction = mk(king(['guardian'])); inAction.players[0].hand = ['guardian'];
  ok(!reduce(inAction, { type: 'PLAY_NIGHT', card: 'guardian' }).players[0].inPlay.includes('guardian'),
    'アクションフェイズに PLAY_NIGHT は通らない');
}
{
  // 夜フェイズは購入フェイズではない（誤爆の最大リスク）
  const s = mk(king(['guardian']));
  me(s).hand = ['guardian', 'copper'];
  const night = reduce(reduce(s, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  const buy = reduce(night, { type: 'BUY', card: 'copper' });
  ok(buy.players[0].discard.filter((c) => c === 'copper').length === 0, '夜フェイズではカードを購入できない');
  const tre = reduce(night, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(!tre.players[0].inPlay.includes('copper'), '夜フェイズでは財宝を出せない');
}
{
  // 人狼＝アクションでもある夜行カード。夜に使うと共謀者の数え／山トークンは普通に働く（公式）
  const s = mk(king(['werewolf', 'conspirator']));
  me(s).hand = ['werewolf']; me(s).deck = ['copper', 'copper', 'copper'];
  const night = reduce(reduce(s, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(night.turn.phase === 'night', '人狼は夜行カード＝夜フェイズに入る');
  const t = reduce(night, { type: 'PLAY_NIGHT', card: 'werewolf' });
  ok(t.turn.actionsPlayed === 1, 'アクションでもある夜行カードを夜に使うと「使ったアクション数」に数える');
  ok(t.turn.nightPlayed === 1, '夜行カードの使用枚数を数える');
}

console.log('\n=== N0: 家宝（Heirloom）＝開始デッキの銅貨と置き換わる ===');
{
  const s = E.createInitialState(['あなた', '相手'], king(['fool', 'pixie']), { startActive: 0 });
  const all = E.allCards(s.players[0]);
  ok(all.filter((c) => c === 'copper').length === 5, '家宝2種なら開始デッキの銅貨は5枚');
  ok(all.includes('lucky_coin') && all.includes('goat'), '対応する家宝が開始デッキに入る（愚者＝幸運のコイン／ピクシー＝ヤギ）');
  ok(all.length === 10, '開始デッキは10枚のまま（銅貨と置き換わる）');
  ok(s.supply.lucky_coin === undefined, '家宝は山を持たない（サプライに現れない）');
  ok(E.canBuyCard(s, 0, 'lucky_coin') === false, '家宝は購入できない');
}
{
  // 家宝7種が全部立つと銅貨0枚スタート（mix-all で起こり得る＝保存則が壊れないこと）
  const kingdom = ['fool', 'pixie', 'pooka', 'secret_cave', 'shepherd', 'tracker', 'cemetery', 'village', 'smithy', 'market'];
  const s = E.createInitialState(['あなた', '相手'], kingdom, { startActive: 0 });
  const all = E.allCards(s.players[0]);
  ok(all.filter((c) => c === 'copper').length === 0, '家宝7種なら銅貨0枚スタート');
  ok(all.length === 10, 'それでも開始デッキは10枚');
}

console.log('\n=== N0: 非サプライ5山（精霊3／願い／コウモリ） ===');
{
  const s = mk(king(['exorcist']));
  ok(s.supply.will_o_wisp === 12 && s.supply.imp === 13 && s.supply.ghost === 6, '悪魔祓いは精霊3山すべてを用意する（12/13/6）');
  ['will_o_wisp', 'imp', 'ghost'].forEach((id) => ok(E.canBuyCard(s, 0, id) === false, id + ' は購入できない'));
  const before = E.emptyPileCount(s);
  s.supply.will_o_wisp = 0; s.supply.imp = 0; s.supply.ghost = 0;
  ok(E.emptyPileCount(s) === before, '非サプライ山が空でも3山終了に数えない');
}
{
  const s = mk(king(['leprechaun'])); ok(s.supply.wish === 12, 'レプラコーンは願いの山12枚を用意する');
  const v = mk(king(['vampire'])); ok(v.supply.bat === 10, '吸血鬼はコウモリの山10枚を用意する');
  const c = mk(king(['cemetery'])); ok(c.supply.ghost === 6, '墓地（呪いの鏡）は幽霊の山6枚を用意する');
}
{
  // 闇市場デッキに非サプライ札・家宝が漏れない（$0 で買えてしまう事故）
  const s = mk(['black_market'].concat(FILLER).slice(0, 10));
  const bm = s.blackMarket || [];
  ['will_o_wisp', 'imp', 'ghost', 'wish', 'bat', 'goat', 'lucky_coin', 'pouch', 'pasture',
    'cursed_gold', 'haunted_mirror', 'magic_lamp', 'zombie_spy', 'zombie_mason', 'zombie_apprentice']
    .forEach((id) => ok(bm.indexOf(id) < 0, '闇市場デッキに ' + id + ' が入らない'));
}

console.log('\n=== N0: 祝福／呪詛デッキと状態（すべて非カード） ===');
{
  const s = mk(king(['bard']));
  ok(s.boons && s.boons.deck.length === 12, '幸運(Fate)カードがあれば祝福12枚をシャッフルして置く');
  ok(s.hexes === null, '不運(Doom)カードが無ければ呪詛デッキは無い');
  const d = mk(king(['druid']));
  ok(d.boons.druid.length === 3 && d.boons.deck.length === 9, 'ドルイドは祝福3枚を表向きで脇に置く（山は9枚）');
  const h = mk(king(['skulk']));
  ok(h.hexes && h.hexes.deck.length === 12, '不運(Doom)カードがあれば呪詛12枚を置く');
}
{
  // 祝福・呪詛・状態は「カード」ではない＝所有カードにも得点にも影響しない
  const s = mk(king(['bard', 'skulk']));
  me(s).boonsInFront = ['the_fields_gift']; me(s).boonHeld = 'the_seas_gift';
  me(s).deluded = true; me(s).envious = false; me(s).misery = 0;
  ok(E.allCards(me(s)).length === 0, '祝福・状態は所有カードに数えない');
}
{
  // 生活苦/二重苦は得点を下げる（下限クランプ禁止）
  const s = mk(king(['skulk']));
  me(s).hand = ['estate']; me(s).misery = 1;
  ok(E.vpOf(me(s)) === 1 - 2, '生活苦は -2点');
  me(s).misery = 2;
  ok(E.vpOf(me(s)) === 1 - 4, '二重苦は -4点');
  me(s).hand = []; me(s).misery = 2;
  ok(E.vpOf(me(s)) === -4, '得点は負になり得る（下限クランプしない）');
}

console.log('\n=== N0: ネクロマンサー＝ゾンビ3枚を廃棄置き場に置く ===');
{
  const s = mk(king(['necromancer']));
  ok(s.trash.length === 3 && s.trash.includes('zombie_spy') && s.trash.includes('zombie_mason') && s.trash.includes('zombie_apprentice'),
    '準備でゾンビ3枚が廃棄置き場に置かれる');
  const n = mk(king(['village']));
  ok(n.trash.length === 0, 'ネクロマンサーが無ければゾンビは置かれない');
  ok(E.canBuyCard(s, 0, 'zombie_spy') === false, 'ゾンビは購入できない');
}

console.log('\n=== N0: 脇札2種（幽霊＝公開／納骨堂＝所有者のみ） ===');
{
  const s = mk(king(['ghost_town']));
  me(s).ghostSetAside = ['village']; me(s).cryptSetAside = ['gold'];
  ok(E.allCards(me(s)).includes('village') && E.allCards(me(s)).includes('gold'), '脇札2種は物理カード＝所有カードに数える');
  const masked = E.maskStateFor(s, 1);
  ok(masked.players[0].ghostSetAside[0] === 'village', '幽霊の脇札は公開情報（相手にも見える）');
  ok(masked.players[0].cryptSetAside[0] === 'back', '納骨堂の脇札は所有者だけが見られる');
  const mine = E.maskStateFor(s, 0);
  ok(mine.players[0].cryptSetAside[0] === 'gold', '納骨堂の脇札は自分には見える');
}
{
  // 祝福/呪詛の山は完全に秘密・捨て札は一番上の1枚だけ公開
  const s = mk(king(['bard', 'skulk']));
  s.boons.deck = ['the_seas_gift', 'the_suns_gift', 'the_moons_gift'];
  s.boons.discard = ['the_flames_gift', 'the_winds_gift'];
  s.hexes.deck = ['war', 'famine']; s.hexes.discard = ['greed'];
  const m = E.maskStateFor(s, 1);
  ok(m.boons.deck.every((x) => x === 'back') && m.boons.deck.length === 3, '祝福の山は中身も順序も伏せる（枚数だけ）');
  ok(m.boons.discard[m.boons.discard.length - 1] === 'the_winds_gift', '祝福の捨て札は一番上の1枚だけ公開');
  ok(m.boons.discard[0] === 'back', '祝福の捨て札の2枚目以降は伏せる（順序が漏れると残りが読める）');
  ok(m.hexes.deck.every((x) => x === 'back'), '呪詛の山も伏せる');
}

console.log('\n=== N0b: CPU が夜フェイズで詰まらない ===');
{
  const s = mk(king(['guardian', 'monastery']));
  s.players[1].isCpu = true; s.players[1].cpuLevel = 'normal';
  const t = mk(king(['guardian', 'monastery']));
  t.players[0].isCpu = true; t.players[0].cpuLevel = 'normal';
  t.players[0].hand = ['guardian', 'copper'];
  let cur = reduce(reduce(t, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(cur.turn.phase === 'night', 'CPU も夜フェイズに入る');
  let guard = 0;
  while (cur.turn.active === 0 && guard++ < 30) {
    const a = CPU.decide(cur, 0);
    ok(a != null, 'CPU は夜フェイズで null を返さない');
    if (!a) break;
    cur = reduce(cur, a);
  }
  ok(cur.turn.active === 1, 'CPU は夜フェイズを自力で抜ける（無限ループしない）');
}

} catch (e) {
  fail++; console.log('  x 例外: ' + (e && e.stack ? e.stack : e));
}

console.log('\n========================================');
console.log(`夜想曲テスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
