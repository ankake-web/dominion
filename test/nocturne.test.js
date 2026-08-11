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
