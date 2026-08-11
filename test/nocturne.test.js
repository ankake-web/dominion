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

/* ============================================================
   N1＝祝福(Boon)12 ／ 呪詛(Hex)12 ／ 状態(State)5
   詩人(bard)＝+2コイン＋祝福1つ／暗躍者(skulk)＝+1購入＋他全員が次の呪詛 を試験台にする。
   ============================================================ */
const KN1 = king(['bard', 'skulk']);
function mk3(kingdom) {
  const s = E.createInitialState(['あなた', '相手', '3人目'], (kingdom || KN1).slice(), { startActive: 0 });
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  return s;
}
// 祝福 id を1つだけ山に積んで詩人を使う
function playBoon(id, setup) {
  const s = mk(KN1);
  me(s).hand = ['bard']; s.boons.deck = [id];
  if (setup) setup(s);
  return reduce(s, { type: 'PLAY_ACTION', card: 'bard' });
}
// 呪詛 id を1つだけ山に積んで暗躍者を使う
function playHex(id, setup, three) {
  const s = three ? mk3() : mk(KN1);
  me(s).hand = ['skulk']; s.hexes.deck = [id];
  if (setup) setup(s);
  return reduce(s, { type: 'PLAY_ACTION', card: 'skulk' });
}

console.log('\n=== N1: 祝福の共通機構 ===');
{
  const t = playBoon('the_seas_gift', (s) => { me(s).deck = ['gold', 'silver']; });
  ok(t.turn.coins === 2 && me(t).hand.includes('gold'), '詩人＝+2コイン＋祝福（海の恵み＝+1カード）');
  ok(t.boons.discard[0] === 'the_seas_gift', '受けた祝福は祝福の捨て札へ');
  ok(t.boons.deck.length === 0, '山からめくったぶん減る');
}
{
  const t = playBoon('the_fields_gift');
  ok(t.turn.coins === 3 && t.turn.actions === 1, '田畑の恵み＝+1アクション+1コイン');
  ok(me(t).boonsInFront[0] === 'the_fields_gift', '「クリンナップまで持つ」祝福は受け手の前に置く');
  ok(t.boons.discard.length === 0, '前に置く祝福は（まだ）捨て札に行かない');
}
{
  const t = playBoon('the_forests_gift');
  ok(t.turn.buys === 2 && t.turn.coins === 3, '森の恵み＝+1購入+1コイン');
}
{
  // 山が空なら捨て札をシャッフルして作り直す／両方空なら「受けない」
  const s = mk(KN1);
  me(s).hand = ['bard', 'bard'];
  s.boons.deck = []; s.boons.discard = ['the_mountains_gift'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'bard' });
  ok(me(t).discard.includes('silver'), '祝福の山が空なら捨て札をシャッフルして作り直す');
  s.boons.deck = []; s.boons.discard = [];
  t = reduce(s, { type: 'PLAY_ACTION', card: 'bard' });
  ok(t.turn.coins === 2 && !t.pending, '山も捨て札も空なら祝福を受けない（選択待ちも立てない）');
}
{
  // 大地の恵み＝財宝を捨てて $4以下を獲得（2段）
  let t = playBoon('the_earths_gift', (s) => { me(s).hand.push('copper', 'estate'); });
  ok(t.pending && t.pending.type === 'boon_earth', '大地の恵み＝財宝を捨てる選択');
  t = reduce(t, { type: 'BOON_EARTH_DISCARD', card: 'copper' });
  ok(t.pending && t.pending.type === 'boon_earth_gain', '捨てたら獲得の窓が開く');
  t = reduce(t, { type: 'BOON_EARTH_GAIN', card: 'village' });
  ok(me(t).discard.includes('village') && me(t).discard.includes('copper'), 'コスト4以下を獲得し、捨てた銅貨も捨て札にある');
  // 辞退できる
  let u = playBoon('the_earths_gift', (s) => { me(s).hand.push('copper'); });
  u = reduce(u, { type: 'BOON_EARTH_DISCARD', card: null });
  ok(!u.pending && me(u).hand.includes('copper'), '大地の恵みは辞退できる');
}
{
  // 空の恵み＝3枚捨てて金貨／3枚未満なら捨てるだけで金貨は得られない（公式）
  let t = playBoon('the_skys_gift', (s) => { me(s).hand.push('copper', 'copper', 'copper', 'estate'); });
  t = reduce(t, { type: 'BOON_SKY_DISCARD', cards: ['copper', 'copper', 'copper'] });
  ok(me(t).discard.includes('gold'), '空の恵み＝手札3枚を捨てて金貨を獲得');
  let u = playBoon('the_skys_gift', (s) => { me(s).hand.push('copper', 'estate'); });
  u = reduce(u, { type: 'BOON_SKY_DISCARD', cards: ['copper', 'estate'] });
  ok(!me(u).discard.includes('gold') && me(u).hand.length === 0,
    '手札が3枚未満なら全部捨てるが金貨は得られない');
  let v = playBoon('the_skys_gift', (s) => { me(s).hand.push('gold', 'gold', 'gold'); });
  v = reduce(v, { type: 'BOON_SKY_DISCARD', cards: null });
  ok(me(v).hand.length === 3, '空の恵みは辞退できる');
}
{
  // 風の恵み＝+2カード→手札2枚を捨てる（強制）
  let t = playBoon('the_winds_gift', (s) => { me(s).deck = ['gold', 'silver', 'copper']; });
  ok(t.pending && t.pending.type === 'boon_wind' && me(t).hand.length === 2, '風の恵み＝+2カードして捨てる選択');
  const h = me(t).hand.slice();
  t = reduce(t, { type: 'BOON_WIND_DISCARD', cards: [h[0]] });
  ok(t.pending, '2枚未満の指定は拒否される（強制）');
  t = reduce(t, { type: 'BOON_WIND_DISCARD', cards: h });
  ok(!t.pending && me(t).hand.length === 0, '2枚捨てると解決する');
}
{
  // 太陽の恵み＝山札の上4枚を見て捨てる/戻す
  let t = playBoon('the_suns_gift', (s) => { me(s).deck = ['copper', 'gold', 'estate', 'silver', 'village']; });
  ok(t.pending && t.pending.type === 'look_arrange' && t.pending.cards.length === 4, '太陽の恵み＝山札の上4枚を見る');
  t = reduce(t, { type: 'LOOK_ARRANGE_RESOLVE', discard: ['copper', 'estate'], top: ['gold', 'silver'] });
  ok(me(t).deck[0] === 'gold' && me(t).deck[1] === 'silver' && me(t).discard.length === 2,
    '好きな枚数を捨て、残りを好きな順で山札の上に戻す');
}
{
  // 公式の準備：**幸運(Fate)が1枚でもあればウィル・オ・ウィスプの山も置く**（沼の恵みの獲得先）。
  const t = playBoon('the_swamps_gift');
  ok(t.supply.will_o_wisp === 12 - 1, '幸運カードがある対局には必ずウィル・オ・ウィスプの山がある');
  ok(me(t).discard.includes('will_o_wisp'), '沼の恵み＝ウィル・オ・ウィスプ1枚を獲得');
  const u = playBoon('the_swamps_gift', (s) => { s.supply.will_o_wisp = 0; });
  ok(!me(u).discard.includes('will_o_wisp'), '山が空なら何も起きない');
}
{
  // 川の恵み＝**次の手札を先引きした後**に +1カード（このエンジン固有の順序）
  const s = mk(KN1);
  me(s).hand = ['bard']; s.boons.deck = ['the_rivers_gift'];
  me(s).deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'gold'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'bard' });
  ok(me(t).boonsInFront[0] === 'the_rivers_gift', '川の恵みは前に置く');
  t = reduce(reduce(t, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(me(t).hand.length === 6, '川の恵み＝先引き5枚の**後**に +1カード（計6枚）');
  ok((me(t).boonsInFront || []).length === 0 && t.boons.discard.includes('the_rivers_gift'),
    '前に置いた祝福はクリンナップで祝福の捨て札へ戻る');
}

console.log('\n=== N1: 呪詛の共通機構（1枚だけめくって全員に同じ1枚） ===');
{
  const t = playHex('poverty', (s) => { s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper']; });
  ok(t.turn.buys === 2, '暗躍者＝+1購入');
  ok(t.pending && t.pending.type === 'hex_poverty' && t.pending.player === 1, '相手が呪詛（貧困）を受ける');
  const u = reduce(t, { type: 'HEX_POVERTY_DISCARD', cards: ['copper', 'copper'] });
  ok(u.players[1].hand.length === 3 && u.hexes.discard[0] === 'poverty', '解決後は呪詛の捨て札へ');
}
{
  // 3人戦＝**同じ1枚**を手番順に適用する（人数分めくらない）
  let t = playHex('poverty', (s) => {
    s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
    s.players[2].hand = ['estate', 'estate', 'estate', 'estate', 'estate'];
  }, true);
  ok(t.hexes.deck.length === 0, '呪詛は1枚だけめくる（3人でも1枚）');
  ok(t.pending.player === 1, '手番順（左隣）から適用する');
  t = reduce(t, { type: 'HEX_POVERTY_DISCARD', cards: ['copper', 'copper'] });
  ok(t.pending && t.pending.player === 2, '次の被害者に同じ呪詛を適用する');
  t = reduce(t, { type: 'HEX_POVERTY_DISCARD', cards: ['estate', 'estate'] });
  ok(t.players[1].hand.length === 3 && t.players[2].hand.length === 3 && !t.pending, '全員が同じ呪詛を受ける');
  ok(t.hexes.discard.length === 1, '呪詛の捨て札に入るのは1枚だけ');
}
{
  // リアクションを全員ぶん閉じてから1枚めくる／堀で防いでも呪詛は1枚めくって捨てる
  let t = playHex('poverty', (s) => { s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper']; });
  ok(t.pending && t.pending.type === 'hex' && t.pending.stage === 'react', 'リアクション窓が先に開く');
  ok(t.hexes.deck.length === 1 && !t.turn.currentHex, '**リアクションを閉じるまで呪詛をめくらない**');
  t = reduce(t, { type: 'MOAT_REVEAL' });
  ok(t.players[1].hand.length === 5, '堀を公開した相手は呪詛を受けない');
  ok(t.hexes.deck.length === 0 && t.hexes.discard.length === 1, '全員が免疫でも呪詛は1枚めくって捨てる');
}
{
  // 灯台（受動免疫）でも同じ
  const t = playHex('poverty', (s) => {
    s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
    s.players[1].durationCards = ['lighthouse'];
  });
  ok(t.players[1].hand.length === 5 && !t.pending, '灯台の相手は呪詛を受けない');
}

console.log('\n=== N1: 呪詛12種の裁定 ===');
{
  const t = playHex('greed', (s) => { s.players[1].deck = ['gold']; });
  ok(t.players[1].deck[0] === 'copper', '貪欲＝銅貨を山札の上に獲得（捨て札を経由しない）');
}
{
  const t = playHex('plague', (s) => { s.players[1].hand = ['copper']; });
  ok(t.players[1].hand.filter((c) => c === 'curse').length === 1, '疫病＝呪いを手札に獲得');
}
{
  const t = playHex('misery');
  ok(t.players[1].misery === 1, 'みじめな生活＝1回目は生活苦');
  const u = playHex('misery', (s) => { s.players[1].misery = 1; });
  ok(u.players[1].misery === 2, '2回目は二重苦');
  const v = playHex('misery', (s) => { s.players[1].misery = 2; });
  ok(v.players[1].misery === 2, '3回目は何も起きない（二重苦のまま）');
}
{
  const t = playHex('delusion', (s) => { s.players[1].envious = true; });
  ok(t.players[1].deluded === false, '幻惑＝すでに嫉妬を持っていれば錯乱を取らない');
}
{
  // 恐怖＝手札5枚以上のときだけ／アクションも財宝も無ければ手札を公開するだけ
  const t = playHex('fear', (s) => { s.players[1].hand = ['estate', 'estate', 'estate', 'estate']; });
  ok(!t.pending, '恐怖＝手札4枚以下なら何も起きない');
  const u = playHex('fear', (s) => { s.players[1].hand = ['estate', 'estate', 'estate', 'estate', 'estate']; });
  ok(!u.pending, '恐怖＝アクションも財宝も無ければ手札を公開するだけ（選択待ちにしない）');
  let v = playHex('fear', (s) => { s.players[1].hand = ['estate', 'estate', 'estate', 'estate', 'village']; });
  ok(v.pending && v.pending.type === 'hex_fear', '恐怖＝手札5枚以上でアクション/財宝があれば捨てる');
  v = reduce(v, { type: 'HEX_FEAR_DISCARD', card: 'estate' });
  ok(v.pending, '恐怖で屋敷（アクションでも財宝でもない）は捨てられない');
  v = reduce(v, { type: 'HEX_FEAR_DISCARD', card: 'village' });
  ok(!v.pending && v.players[1].discard.includes('village'), 'アクションを捨てると解決する');
}
{
  const t = playHex('haunting', (s) => { s.players[1].hand = ['copper', 'copper', 'copper']; });
  ok(!t.pending, '憑依＝手札3枚以下なら何も起きない');
  let u = playHex('haunting', (s) => { s.players[1].hand = ['copper', 'copper', 'copper', 'gold']; });
  ok(u.pending && u.pending.type === 'hex_haunting', '憑依＝手札4枚以上なら1枚を山札の上へ');
  u = reduce(u, { type: 'HEX_HAUNTING_TOPDECK', card: 'copper' });
  ok(u.players[1].deck[0] === 'copper' && u.players[1].hand.length === 3, '選んだ1枚が山札の上に乗る');
}
{
  // 蝗害＝銅貨/屋敷なら呪い／それ以外は「同じ種別でより安い」カードを獲得
  const t = playHex('locusts', (s) => { s.players[1].deck = ['copper', 'gold']; });
  ok(t.trash.includes('copper') && t.players[1].discard.includes('curse'), '蝗害＝銅貨を廃棄したら呪い');
  let u = playHex('locusts', (s) => { s.players[1].deck = ['gold', 'copper']; });
  ok(u.trash.includes('gold') && u.pending && u.pending.type === 'hex_locusts', '蝗害＝金貨を廃棄したら「同じ種別で安い」を獲得');
  const okc = (id) => DOM.engine.costUnder(u, id, 6) && DOM.engine.sharesType(id, 'gold');
  ok(okc('silver') && !okc('village'), '候補は「種別を共有し、かつ安い」もの（銀貨は可・村は不可）');
  u = reduce(u, { type: 'HEX_LOCUSTS_GAIN', card: 'silver' });
  ok(u.players[1].discard.includes('silver') && !u.pending, '蝗害の獲得で解決する');
  const v = playHex('locusts', (s) => { s.players[1].deck = ['curse', 'copper']; });
  ok(v.trash.includes('curse') && !v.pending, '呪いを廃棄した場合は「安い同種別」が無いので何も獲得しない');
}
{
  // 戦争＝コスト3か4が出るまで公開し、それを廃棄して残りを捨てる
  const t = playHex('war', (s) => { s.players[1].deck = ['gold', 'copper', 'village', 'estate']; });
  ok(t.trash.includes('village'), '戦争＝コスト3のカードを廃棄する');
  ok(t.players[1].discard.includes('gold') && t.players[1].discard.includes('copper'), '手前に公開したカードは捨てる');
  ok(t.players[1].deck.length === 1, '見つけた時点で止まる');
  const u = playHex('war', (s) => { s.players[1].deck = ['gold', 'copper']; });
  ok(u.trash.length === 0 && u.players[1].deck.length === 0 && u.players[1].discard.length === 2,
    'コスト3〜4が無ければ全部捨てて廃棄は起きない');
}
{
  // 凶兆＝山札を捨て札に置き、捨て札から銅貨2枚を山札の上へ
  const t = playHex('bad_omens', (s) => { s.players[1].deck = ['gold', 'copper', 'copper', 'village']; });
  ok(t.players[1].deck.length === 2 && t.players[1].deck.every((c) => c === 'copper'), '凶兆＝銅貨2枚が山札の上に来る');
  ok(t.players[1].discard.length === 2, '残りは捨て札');
  const u = playHex('bad_omens', (s) => { s.players[1].deck = ['gold', 'village']; });
  ok(u.players[1].deck.length === 0 && u.players[1].discard.length === 2, '銅貨が無ければ山札は空のまま（捨て札を公開）');
}
{
  // 飢饉＝上3枚を公開しアクションを捨て、残りを山札に混ぜてシャッフル
  const t = playHex('famine', (s) => { s.players[1].deck = ['village', 'gold', 'smithy', 'copper', 'copper']; });
  ok(t.players[1].discard.filter((c) => c === 'village' || c === 'smithy').length === 2, '飢饉＝公開したアクションを捨てる');
  ok(t.players[1].deck.length === 3, 'アクション以外は山札に戻る（シャッフルされる）');
}

console.log('\n=== N1: 状態（錯乱／嫉妬）＝購入フェイズ開始時に「返して」発動する2階建て ===');
{
  // 錯乱＝返すまでは何も起きない／返したらそのターンはアクションカードを買えない
  const s = mk(KN1);
  me(s).deluded = true;
  ok(E.canBuyCard(s, 0, 'village') === true, '錯乱を持っているだけではアクションを購入できる（まだ効いていない）');
  const t = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(me(t).deluded === false && t.turn.cantBuyActions === true, '購入フェイズ開始時に錯乱を返して発動する');
  ok(E.canBuyCard(t, 0, 'village') === false, '発動後はアクションカードを購入できない');
  ok(E.canBuyCard(t, 0, 'silver') === true, 'アクションでないカードは購入できる');
  t.turn.coins = 8; t.turn.buys = 1;
  const u = reduce(t, { type: 'BUY', card: 'village' });
  ok(!me(u).discard.includes('village'), 'engine もアクションカードの購入を拒否する');
  const v = reduce(t, { type: 'BUY', card: 'silver' });
  ok(me(v).discard.includes('silver'), '銀貨は買える');
}
{
  // 購入フェイズ中に得た錯乱はそのターンは発動しない（＝次に購入フェイズへ入るときに返す）
  const s = mk(KN1);
  const t = reduce(s, { type: 'END_ACTION_PHASE' });
  t.players[0].deluded = true;                      // 購入フェイズ中に錯乱を得た
  ok(t.turn.cantBuyActions === false, 'その購入フェイズでは発動しない');
  t.turn.phase = 'action';                          // ヴィラでアクションフェイズに戻った
  const u = reduce(t, { type: 'END_ACTION_PHASE' });
  ok(u.players[0].deluded === false && u.turn.cantBuyActions === true,
    '同じターンでも購入フェイズに入り直せば返して発動する（ヴィラ）');
}
{
  // 一度立った旗は同じターン中に下ろさない
  const s = mk(KN1);
  me(s).deluded = true;
  let t = reduce(s, { type: 'END_ACTION_PHASE' });
  t.turn.phase = 'action';
  t = reduce(t, { type: 'END_ACTION_PHASE' });
  ok(t.turn.cantBuyActions === true, '購入フェイズに入り直しても効果は続く（そのターンの残り全部）');
}
{
  // 嫉妬＝返した後は銀貨と金貨が $1 しか生まない（他の財宝には効かない）
  const s = mk(KN1);
  me(s).envious = true;
  me(s).hand = ['silver', 'gold', 'copper'];
  let t = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(me(t).envious === false && t.turn.enviousActive === true, '購入フェイズ開始時に嫉妬を返して発動する');
  t = reduce(t, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(t.turn.coins === 1, '銀貨は $1 しか生まない');
  t = reduce(t, { type: 'PLAY_TREASURE', card: 'gold' });
  ok(t.turn.coins === 2, '金貨も $1 しか生まない');
  t = reduce(t, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(t.turn.coins === 3, '銅貨は通常どおり $1（他の財宝には効かない）');
}
{
  // 嫉妬を「持っているだけ」では銀貨は $2 のまま（＝アクションフェイズに語り部等で出したぶんは対象外）
  const s = mk(KN1);
  me(s).envious = true;
  s.turn.phase = 'buy'; // 返さずに購入フェイズにした状態（END_ACTION_PHASE を通していない）
  me(s).hand = ['silver'];
  const t = reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(t.turn.coins === 2, '嫉妬を返す前の銀貨は $2 のまま');
}
{
  // 状態は「カード」ではない＝得点にも所有カードにも数えない（生活苦/二重苦だけが得点を下げる）
  const s = mk(KN1);
  me(s).deluded = true; me(s).envious = false; s.lostInTheWoods = 0;
  ok(E.allCards(me(s)).length === 0, '状態は所有カードに数えない');
}

console.log('\n=== N1: 森の迷子（状態・ターン開始時の任意効果） ===');
{
  const s = mk(KN1);
  s.lostInTheWoods = 0;
  me(s).hand = ['copper', 'estate'];
  s.boons.deck = ['the_mountains_gift'];
  // 手番を1周させて自分のターン開始時にする
  let t = reduce(reduce(s, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  t = reduce(reduce(t, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(t.pending && t.pending.type === 'lost_in_the_woods' && t.pending.player === 0,
    '森の迷子の持ち主はターン開始時に窓が開く');
  const before = me(t).hand.length;
  const u = reduce(t, { type: 'LOST_IN_WOODS', card: me(t).hand[0] });
  ok(me(u).hand.length === before - 1 && me(u).discard.includes('silver'),
    '手札1枚を捨てて祝福を1つ受ける（山の恵み＝銀貨）');
  const v = reduce(t, { type: 'LOST_IN_WOODS', card: null });
  ok(!v.pending && me(v).hand.length === before, '使わなくてもよい（任意）');
}
{
  const s = mk(KN1);
  s.lostInTheWoods = 1; // 相手が持っている
  let t = reduce(reduce(s, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(!(t.pending && t.pending.type === 'lost_in_the_woods' && t.pending.player === 0),
    '持っていないプレイヤーには窓が開かない');
}

console.log('\n=== N1: CPU が祝福/呪詛の選択待ちで詰まらない ===');
{
  const BOONS = DOM.BOONS_NOCTURNE, HEXES = DOM.HEXES_NOCTURNE;
  let bad = 0;
  BOONS.forEach((b) => {
    let t = playBoon(b, (s) => {
      me(s).hand.push('copper', 'estate', 'silver');
      me(s).deck = ['gold', 'duchy', 'copper', 'estate', 'village'];
      me(s).discard = ['militia', 'moat'];
    });
    let guard = 0;
    while (t.pending && guard++ < 8) {
      const a = CPU.decide(t, t.pending.player);
      if (!a) { bad++; console.log('   (' + b + ' で CPU が null)'); break; }
      const n = reduce(t, a);
      if (JSON.stringify(n) === JSON.stringify(t)) { bad++; console.log('   (' + b + ' で CPU の手が拒否された)'); break; }
      t = n;
    }
    if (t.pending) { bad++; console.log('   (' + b + ' の選択待ちが閉じない)'); }
  });
  ok(bad === 0, '祝福12種すべてで CPU が選択待ちを閉じられる');
  bad = 0;
  HEXES.forEach((x) => {
    let t = playHex(x, (s) => {
      s.players[1].hand = ['copper', 'estate', 'silver', 'village', 'smithy'];
      s.players[1].deck = ['gold', 'duchy', 'copper', 'estate', 'village'];
      s.players[1].discard = ['militia'];
    });
    let guard = 0;
    while (t.pending && guard++ < 8) {
      const a = CPU.decide(t, t.pending.player);
      if (!a) { bad++; console.log('   (' + x + ' で CPU が null)'); break; }
      const n = reduce(t, a);
      if (JSON.stringify(n) === JSON.stringify(t)) { bad++; console.log('   (' + x + ' で CPU の手が拒否された)'); break; }
      t = n;
    }
    if (t.pending) { bad++; console.log('   (' + x + ' の選択待ちが閉じない)'); }
  });
  ok(bad === 0, '呪詛12種すべてで CPU が選択待ちを閉じられる');
}

/* ============================================================
   N2＝素直な王国カード（夜行でない17種）＋家宝7種
   ============================================================ */
console.log('\n=== N2: 幸運（Fate）の王国カード ===');
{
  // 恵みの村＝獲得時に祝福を「取る」（中身を見てから、今受けるか次のターンに受けるかを選ぶ）
  const s = mk(king(['blessed_village']));
  s.turn.phase = 'buy'; s.turn.coins = 4; s.boons.deck = ['the_seas_gift'];
  let t = reduce(s, { type: 'BUY', card: 'blessed_village' });
  ok(t.pending && t.pending.type === 'blessed_village_boon' && t.pending.boon === 'the_seas_gift',
    '恵みの村の獲得で祝福を取る（中身が見えている）');
  const later = reduce(t, { type: 'BLESSED_VILLAGE_BOON', now: false });
  ok(later.players[0].boonsHeld.length === 1, '「次のターンに受ける」を選ぶと祝福を手元に持つ');
  let n = reduce(reduce(later, { type: 'END_TURN' }), { type: 'END_ACTION_PHASE' });
  n = reduce(n, { type: 'END_TURN' });
  ok(me(n).boonsHeld.length === 0, '次の自分のターン開始時に受ける');
  const now = reduce(t, { type: 'BLESSED_VILLAGE_BOON', now: true });
  ok(!now.players[0].boonsHeld.length, '「今受ける」も選べる');
}
{
  const s = mk(king(['druid']));
  me(s).hand = ['druid'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'druid' });
  ok(t.pending && t.pending.type === 'druid_boon', 'ドルイド＝脇の祝福3枚から1つ（強制）');
  const b = t.boons.druid[0];
  t = reduce(t, { type: 'DRUID_BOON', boon: b });
  ok(t.boons.druid.length === 3 && t.boons.druid.includes(b), '受けた祝福は脇に置いたまま（何度でも受けられる）');
  ok(t.turn.buys === 2, '+1購入');
}
{
  const s = mk(king(['fool']));
  me(s).hand = ['fool'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'fool' });
  ok(t.lostInTheWoods === 0, '愚者＝森の迷子を受け取る');
  ok(t.pending && t.pending.type === 'boon_choose' && t.turn.boonChoice.boons.length === 3,
    '祝福3枚を取り、好きな順番で受ける');
  let g = 0;
  while (t.pending && g++ < 12) { const a = CPU.decide(t, t.pending.player); if (!a) break; t = reduce(t, a); }
  ok(!t.pending && !t.turn.boonChoice, '3枚とも受け終わる');
  const u = mk(king(['fool'])); u.players[0].hand = ['fool']; u.lostInTheWoods = 0;
  const before = u.boons.deck.length;
  const v = reduce(u, { type: 'PLAY_ACTION', card: 'fool' });
  ok(v.boons.deck.length === before && !v.pending, 'すでに森の迷子を持っていたら完全に空振り（祝福も取らない）');
}
{
  // ピクシー＝祝福を捨て、これを廃棄すればその祝福を2回受けられる
  const s = mk(king(['pixie']));
  me(s).hand = ['pixie']; me(s).deck = ['gold']; s.boons.deck = ['the_mountains_gift'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'pixie' });
  ok(t.pending && t.pending.type === 'pixie_trash', 'ピクシー＝廃棄するか選ぶ');
  const no = reduce(t, { type: 'PIXIE_TRASH', trash: false });
  ok(!me(no).discard.includes('silver') && no.boons.discard.includes('the_mountains_gift'),
    '廃棄しなければ祝福は捨てられるだけで受けない');
  t = reduce(t, { type: 'PIXIE_TRASH', trash: true });
  ok(t.trash.includes('pixie'), 'ピクシーを廃棄する');
  ok(me(t).discard.filter((c) => c === 'silver').length === 2, '同じ祝福を2回受ける（銀貨2枚）');
}
{
  const s = mk(king(['tracker']));
  me(s).hand = ['tracker']; s.boons.deck = ['the_mountains_gift'];
  const t = reduce(s, { type: 'PLAY_ACTION', card: 'tracker' });
  ok(t.turn.coins === 1 && t.turn.trackerTurn === true, '追跡者＝+1コイン、このターンの獲得を山札の上に置ける');
  ok(t.pending && t.pending.type === 'travelling_fair', '祝福（山の恵み）の銀貨獲得で山札上に置く窓が開く');
}
{
  // 聖なる木立ち＝+コインを与えない祝福なら他プレイヤーも受けてよい（同じ1枚）
  let t = reduce(Object.assign(mk3(king(['sacred_grove'])), {}), { type: 'PLAY_ACTION', card: 'sacred_grove' });
  ok(!t.players[0].inPlay.includes('sacred_grove'), '（手札に無ければ使えない）');
  const s = mk3(king(['sacred_grove']));
  s.players[0].hand = ['sacred_grove']; s.boons.deck = ['the_mountains_gift'];
  t = reduce(s, { type: 'PLAY_ACTION', card: 'sacred_grove' });
  ok(t.turn.coins === 3 && t.turn.buys === 2, '聖なる木立ち＝+1購入+3コイン');
  ok(t.pending && t.pending.type === 'grove_offer' && t.pending.player === 1, '他プレイヤーに同じ祝福を提供する');
  t = reduce(t, { type: 'GROVE_OFFER', take: true });
  ok(t.players[1].discard.includes('silver'), '受けたプレイヤーは同じ祝福を得る');
  t = reduce(t, { type: 'GROVE_OFFER', take: false });
  ok(!t.players[2].discard.includes('silver') && !t.pending, '断ることもできる（任意）');
  const u = mk3(king(['sacred_grove']));
  u.players[0].hand = ['sacred_grove']; u.boons.deck = ['the_fields_gift'];
  const v = reduce(u, { type: 'PLAY_ACTION', card: 'sacred_grove' });
  ok(!v.pending && v.turn.coins === 4, '+コインを与える祝福（田畑/森の恵み）は共有しない');
}
{
  // 偶像＝場の偶像が奇数なら祝福／偶数なら他プレイヤーに呪い（財宝＝applyTreasureEffect）
  const s = mk(king(['idol']));
  me(s).hand = ['idol']; s.turn.phase = 'buy'; s.boons.deck = ['the_mountains_gift'];
  const t = reduce(s, { type: 'PLAY_TREASURE', card: 'idol' });
  ok(t.turn.coins === 2 && me(t).discard.includes('silver'), '偶像1枚（奇数）＝祝福を受ける');
  const u = mk(king(['idol']));
  u.players[0].hand = ['idol']; u.players[0].inPlay = ['idol']; u.turn.phase = 'buy';
  const v = reduce(u, { type: 'PLAY_TREASURE', card: 'idol' });
  ok(v.players[1].discard.includes('curse'), '偶像2枚（偶数）＝他プレイヤーが呪いを獲得');
  const w = mk(king(['idol']));
  w.players[0].hand = ['idol']; w.players[0].inPlay = ['idol']; w.players[1].hand = ['moat']; w.turn.phase = 'buy';
  let x = reduce(w, { type: 'PLAY_TREASURE', card: 'idol' });
  ok(x.pending && x.pending.type === 'idol', '偶像はアタック＝リアクション窓が開く');
  x = reduce(x, { type: 'MOAT_REVEAL' });
  ok(!x.players[1].discard.includes('curse'), '堀で防げる');
}

console.log('\n=== N2: 不運（Doom）とその他の王国カード ===');
{
  const s = mk(king(['cursed_village']));
  me(s).hand = ['cursed_village', 'copper'];
  me(s).deck = ['gold', 'gold', 'gold', 'gold', 'gold', 'gold'];
  const t = reduce(s, { type: 'PLAY_ACTION', card: 'cursed_village' });
  ok(me(t).hand.length === 6 && t.turn.actions === 2, '呪われた村＝+2アクション、手札6枚になるまで引く');
  const u = mk(king(['cursed_village']));
  u.turn.phase = 'buy'; u.turn.coins = 5; u.hexes.deck = ['greed'];
  const v = reduce(u, { type: 'BUY', card: 'cursed_village' });
  ok(v.players[0].deck[0] === 'copper', '獲得したとき**自分が**呪詛を受ける（貪欲＝銅貨を山札の上に）');
}
{
  const s = mk(king(['leprechaun']));
  me(s).hand = ['leprechaun'];
  me(s).inPlay = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  const t = reduce(s, { type: 'PLAY_ACTION', card: 'leprechaun' });
  ok(me(t).discard.includes('gold'), 'レプラコーン＝金貨1枚を獲得');
  ok(me(t).discard.includes('wish'), '**金貨の獲得後**に場がちょうど7枚なら願い1枚');
  const u = mk(king(['leprechaun']));
  u.players[0].hand = ['leprechaun']; u.hexes.deck = ['greed'];
  const v = reduce(u, { type: 'PLAY_ACTION', card: 'leprechaun' });
  ok(v.players[0].deck[0] === 'copper', '7枚でなければ呪詛を受ける');
}
{
  const s = mk(king(['tormentor']));
  me(s).hand = ['tormentor'];
  const t = reduce(s, { type: 'PLAY_ACTION', card: 'tormentor' });
  ok(t.turn.coins === 2 && me(t).discard.includes('imp'), '迫害者＝他のカードが場に無ければインプ1枚');
  const u = mk(king(['tormentor']));
  u.players[0].hand = ['tormentor']; u.players[0].inPlay = ['copper']; u.hexes.deck = ['greed'];
  const v = reduce(u, { type: 'PLAY_ACTION', card: 'tormentor' });
  ok(v.players[1].deck[0] === 'copper' && !v.players[0].discard.includes('imp'),
    '他のカードが場にあれば他プレイヤー全員が呪詛を受ける');
}
{
  // コンクラーベ＝場に同名が無いアクションを使う→**その解決の後で** +1アクション
  const s = mk(king(['conclave']));
  me(s).hand = ['conclave', 'village', 'smithy']; me(s).deck = ['gold', 'gold', 'gold', 'gold'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'conclave' });
  ok(t.turn.coins === 2 && t.pending && t.pending.type === 'conclave', 'コンクラーベ＝+2コイン＋手札のアクション');
  t = reduce(t, { type: 'CONCLAVE_PLAY', card: 'village' });
  ok(me(t).inPlay.includes('village') && t.turn.actions === 3, 'アクション権を使わずにプレイし、その後 +1アクション');
  // 場に同名があるものは選べない
  const u = mk(king(['conclave']));
  u.players[0].hand = ['conclave', 'village']; u.players[0].inPlay = ['village'];
  const v = reduce(u, { type: 'PLAY_ACTION', card: 'conclave' });
  ok(!v.pending, '場に同名のカードしか無ければ選択待ちを開かない');
  // 雪深い村＝以後の +アクション を無視する（コンクラーベの +1 は入らない）
  const w = mk(king(['conclave', 'snowy_village']));
  w.players[0].hand = ['conclave', 'snowy_village']; w.players[0].deck = ['gold', 'gold'];
  let x = reduce(w, { type: 'PLAY_ACTION', card: 'conclave' });
  x = reduce(x, { type: 'CONCLAVE_PLAY', card: 'snowy_village' });
  ok(x.turn.actions === 4, 'コンクラーベで雪深い村を使うと +1アクションが無視される（4のまま）');
}
{
  // 墓地＝獲得時に手札から最大4枚を「まとめて同時に」廃棄
  const s = mk(king(['cemetery']));
  me(s).hand = ['copper', 'estate', 'curse', 'gold'];
  s.turn.phase = 'buy'; s.turn.coins = 4;
  let t = reduce(s, { type: 'BUY', card: 'cemetery' });
  ok(t.pending && t.pending.type === 'cemetery_trash', '墓地の獲得で廃棄の窓が開く');
  ok(t.supply.ghost === 6, '墓地を使うゲームでは幽霊の山（6枚）を置く');
  const zero = reduce(t, { type: 'CEMETERY_TRASH', cards: [] });
  ok(!zero.pending && zero.trash.length === 0, '0枚でもよい');
  t = reduce(t, { type: 'CEMETERY_TRASH', cards: ['copper', 'curse'] });
  ok(t.trash.length === 2 && me(t).hand.length === 2, '選んだ枚数を廃棄する');
  const s2 = E.createInitialState(['あなた', '相手'], king(['cemetery']), { startActive: 0 });
  ok(E.allCards(s2.players[0]).includes('haunted_mirror'), '墓地の家宝＝呪いの鏡が開始デッキに入る');
}
{
  const s = mk(king(['pooka']));
  me(s).hand = ['pooka', 'copper', 'cursed_gold']; me(s).deck = ['gold', 'gold', 'gold', 'gold'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'pooka' });
  const bad = reduce(t, { type: 'POOKA_TRASH', card: 'cursed_gold' });
  ok(bad.pending, 'プーカで呪われた金貨は廃棄できない');
  t = reduce(t, { type: 'POOKA_TRASH', card: 'copper' });
  ok(me(t).hand.length === 5 && t.trash.includes('copper'), '財宝を廃棄して +4カード');
}
{
  const s = mk(king(['secret_cave']));
  me(s).hand = ['secret_cave', 'copper', 'estate', 'curse']; me(s).deck = ['gold'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'secret_cave' });
  ok(t.pending && t.pending.type === 'secret_cave', '秘密の洞窟＝手札3枚を捨てるか選ぶ');
  const no = reduce(t, { type: 'SECRET_CAVE_DISCARD', cards: null });
  ok(!no.players[0].delayedEffects.length, '捨てなければ持続にならない');
  t = reduce(t, { type: 'SECRET_CAVE_DISCARD', cards: ['copper', 'estate', 'curse'] });
  t = reduce(reduce(t, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  t = reduce(reduce(t, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(t.turn.coins === 3, '3枚捨てたら次の自分のターン開始時に +3コイン');
}
{
  const s = mk(king(['shepherd']));
  me(s).hand = ['shepherd', 'estate', 'duchy', 'copper'];
  me(s).deck = ['gold', 'gold', 'gold', 'gold', 'gold'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'shepherd' });
  t = reduce(t, { type: 'SHEPHERD_DISCARD', cards: ['estate', 'duchy'] });
  ok(me(t).hand.length === 5 && t.turn.actions === 1, '羊飼い＝勝利点2枚を捨てて +4カード');
  const s2 = E.createInitialState(['あなた', '相手'], king(['shepherd']), { startActive: 0 });
  ok(E.allCards(s2.players[0]).includes('pasture'), '羊飼いの家宝＝牧草地が開始デッキに入る');
}
{
  const s = mk(king(['tragic_hero']));
  me(s).hand = ['tragic_hero', 'copper', 'copper', 'copper', 'copper', 'copper'];
  me(s).deck = ['gold', 'gold', 'gold'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'tragic_hero' });
  ok(t.trash.includes('tragic_hero'), '悲劇のヒーロー＝引いた後に手札8枚以上ならこれを廃棄');
  t = reduce(t, { type: 'TRAGIC_HERO_GAIN', card: 'gold' });
  ok(me(t).discard.includes('gold'), '財宝1枚を獲得する');
  const u = mk(king(['tragic_hero']));
  u.players[0].hand = ['tragic_hero']; u.players[0].deck = ['gold', 'gold', 'gold'];
  const v = reduce(u, { type: 'PLAY_ACTION', card: 'tragic_hero' });
  ok(!v.trash.includes('tragic_hero') && v.turn.buys === 2, '手札が8枚未満なら廃棄しない（+3カード+1購入）');
}
{
  // 忠犬＝クリンナップ以外で捨てられたら脇に置き、**そのターンの終了時（先引きの後）**に手札へ戻る
  const s = mk(king(['faithful_hound', 'oasis']));
  me(s).hand = ['oasis', 'faithful_hound']; me(s).deck = ['gold', 'gold'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'oasis' });
  t = reduce(t, { type: 'OASIS_RESOLVE', card: 'faithful_hound' });
  ok(t.pending && t.pending.type === 'faithful_hound_react', '忠犬＝捨てられたら脇に置くか選ぶ');
  const no = reduce(t, { type: 'FAITHFUL_HOUND_REACT', setAside: false });
  ok(no.players[0].discard.includes('faithful_hound'), '脇に置かない選択もできる');
  t = reduce(t, { type: 'FAITHFUL_HOUND_REACT', setAside: true });
  ok(me(t).setAside.includes('faithful_hound'), '脇に置く');
  t = reduce(reduce(t, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });
  ok(me(t).hand.includes('faithful_hound') && !(me(t).setAside || []).includes('faithful_hound'),
    'ターンの終了時＝**次の手札を先引きした後**に手札へ戻る');
}

console.log('\n=== N2: 家宝（Heirloom）7種 ===');
{
  const t2 = (kingdomCard, card, setup) => {
    const s = mk(king([kingdomCard]));
    me(s).hand = [card]; s.turn.phase = 'buy';
    if (setup) setup(s);
    return reduce(s, { type: 'PLAY_TREASURE', card });
  };
  let t = t2('pooka', 'cursed_gold');
  ok(t.turn.coins === 3 && me(t).discard.includes('curse'), '呪われた金貨＝+3コイン＋呪い1枚');
  t = t2('fool', 'lucky_coin');
  ok(t.turn.coins === 1 && me(t).discard.includes('silver'), '幸運のコイン＝+1コイン＋銀貨1枚');
  t = t2('tracker', 'pouch');
  ok(t.turn.coins === 1 && t.turn.buys === 2, '革袋＝+1コイン+1購入');
  t = t2('pixie', 'goat', (s) => { me(s).hand.push('curse'); });
  ok(t.pending && t.pending.type === 'goat_trash', 'ヤギ＝手札1枚を廃棄してもよい');
  t = reduce(t, { type: 'GOAT_TRASH', card: 'curse' });
  ok(t.trash.includes('curse') && t.turn.coins === 1, 'ヤギの廃棄');
  const sk = mk(king(['shepherd']));
  me(sk).hand = ['pasture', 'estate', 'estate']; sk.turn.phase = 'buy';
  ok(E.vpOf(me(sk)) === 2 + 2, '牧草地＝所有する屋敷1枚につき1勝利点');
  // 魔法のランプ＝場に1枚だけのカードが6種類以上なら廃棄して願い3枚
  const ml = mk(king(['secret_cave']));
  me(ml).hand = ['magic_lamp']; me(ml).inPlay = ['copper', 'silver', 'gold', 'estate', 'village'];
  ml.turn.phase = 'buy';
  const mt = reduce(ml, { type: 'PLAY_TREASURE', card: 'magic_lamp' });
  ok(mt.trash.includes('magic_lamp') && me(mt).discard.filter((c) => c === 'wish').length === 3,
    '魔法のランプ＝1枚だけのカードが6種類以上なら廃棄して願い3枚');
  const ml2 = mk(king(['secret_cave']));
  me(ml2).hand = ['magic_lamp']; me(ml2).inPlay = ['copper', 'copper', 'silver'];
  ml2.turn.phase = 'buy';
  const mt2 = reduce(ml2, { type: 'PLAY_TREASURE', card: 'magic_lamp' });
  ok(!mt2.trash.includes('magic_lamp') && mt2.turn.coins === 1, '条件を満たさなければ +1コインだけ');
}
{
  // 呪いの鏡＝廃棄したとき、手札のアクション1枚を捨てて幽霊1枚を獲得してもよい
  const s = mk(king(['cemetery', 'chapel']));
  me(s).hand = ['chapel', 'haunted_mirror', 'village'];
  let t = reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
  t = reduce(t, { type: 'CHAPEL_RESOLVE', cards: ['haunted_mirror'] });
  ok(t.pending && t.pending.type === 'haunted_mirror', '呪いの鏡の廃棄で窓が開く');
  const no = reduce(t, { type: 'HAUNTED_MIRROR_GHOST', card: null });
  ok(!no.players[0].discard.includes('ghost'), '任意（何もしなくてよい）');
  t = reduce(t, { type: 'HAUNTED_MIRROR_GHOST', card: 'village' });
  ok(me(t).discard.includes('ghost') && me(t).discard.includes('village'), 'アクションを捨てて幽霊1枚を獲得');
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
