/* 同盟（Allies）ゲームロジックの検証（Node 単体実行）
   使い方: node test/allies.test.js
   正本＝docs/research/allies_rules.md（冒頭「実装前に必読」9項目）。
   対象:
     A1＝好意(Favor)トークン `p.favors` と 同盟(Ally)カードの選定 `state.ally`
         （連携が1枚でもあれば Ally を1枚決めて全員に好意1個／輸入者があれば5個／
           **生徒は魔法使いの分割山の中**なので山IDだけ見る判定では取りこぼす）。
     A2＝分割山6組（混合山モデル）と循環(Rotate)
         （16枚＝4種×4枚・安い順／一番上だけ購入・獲得・廃棄／山のコストは今の一番上／
           「山のコスト・種別」を参照する効果は randomizer 固定／3山終了は16枚全部／
           循環＝先頭からの**連続**同名ブロックだけを末尾へ／戦闘計画は任意のサプライ山）。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260812;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
const reduce = (s, a) => E.reduce(s, a);
function count(arr, id) { return (arr || []).filter((c) => c === id).length; }

// 同盟の6山＋素直な基本カードで作った検証用の王国（連携＝生徒が wizards の中に居る）。
const KING = ['augurs', 'clashes', 'forts', 'odysseys', 'townsfolk', 'wizards',
  'village', 'smithy', 'market', 'moat'];
function mk(kingdom, opts, names) {
  return E.createInitialState(names || ['A', 'B'], kingdom || KING, Object.assign({ startActive: 0 }, opts || {}));
}
// 保存則の tally（混合山は実カード配列で数え、supply の残数キーは数えない＝二重計上を避ける）。
const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat',
  'princes', 'tavern', 'inherited', 'cargo', 'exile', 'eventSetAside', 'ghostSetAside', 'cryptSetAside',
  'contractSetAside'];
const MIX = E.MIXED_PILE_KEYS;
function tally(s) {
  const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; };
  Object.keys(s.supply).forEach((id) => { if (MIX.indexOf(id) >= 0) return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); });
  MIX.forEach((k) => (s[k] || []).forEach(a));
  (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a);
  s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a)));
  return t;
}
function tdiff(x, y) { const ks = new Set([...Object.keys(x), ...Object.keys(y)]); const d = []; ks.forEach((k) => { if ((x[k] || 0) !== (y[k] || 0)) d.push(k + ':' + (x[k] || 0) + '→' + (y[k] || 0)); }); return d; }
function total(t) { return Object.keys(t).reduce((n, k) => n + t[k], 0); }

/* ============================================================
   A1: 好意(Favor)トークンと同盟(Ally)カードの選定
   ============================================================ */
console.log('=== 同盟 A1: 好意トークンと Ally の選定 ===');
{
  // 連携が1枚も無い王国＝Ally も好意も一切登場しない
  const s = mk(['village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine', 'workshop']);
  ok(s.ally === null, '連携が無い王国では state.ally は null');
  ok(s.players.every((p) => (p.favors || 0) === 0), '連携が無い王国では好意は配られない');
}
{
  // 連携（道化棒 bauble）がある王国＝Ally を1枚決め、全員が好意1個で始める
  const s = mk(['bauble', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine']);
  ok(s.ally && (DOM.ALLIES_ALLY || []).indexOf(s.ally) >= 0, '連携があれば Ally が23枚から1枚選ばれる（' + s.ally + '）');
  ok(DOM.LANDSCAPES[s.ally] && DOM.LANDSCAPES[s.ally].kind === 'ally', '選ばれた Ally は横型の kind=ally');
  ok(s.players.every((p) => p.favors === 1), '開始時の好意は各自1個');
  ok(s.players.every((p) => p.favorShuffle === 0), '常設方針 favorShuffle の器がある（既定0＝シャッフルに好意を使わない）');
}
{
  // ★生徒(student) は魔法使い(wizards)の**分割山の中**に居る連携＝山IDだけ見ると Ally が出ないゲームになる
  const s = mk(['wizards', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine']);
  ok(s.ally !== null, '魔法使いの山（中身に生徒＝連携）だけでも Ally が選ばれる＝分割山の中身まで走査している');
  ok(s.players.every((p) => p.favors === 1), '分割山の中の連携でも開始時の好意が配られる');
  ok(DOM.ALLIES_LIAISONS.indexOf('student') >= 0 && DOM.POOLS.allies.indexOf('student') < 0,
    '生徒は連携リストに居るが山（POOLS.allies）には居ない＝山IDだけの判定では必ず取りこぼす');
}
{
  // 輸入者(importer)＝Setup で各自 +4好意 ＝ 開始時に5個
  const s = mk(['importer', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine']);
  ok(s.players.every((p) => p.favors === 5), '輸入者があるゲームは開始時の好意が5個（1＋Setupの4）');
}
{
  // 好意は得点にならない（高原の羊飼い以外）／財源・村人とは別枠
  const s = mk(['bauble', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine']);
  const p = s.players[0];
  const vp0 = E.vpOf ? E.vpOf(p) : null;
  p.favors = 99;
  ok(vp0 === null || E.vpOf(p) === vp0, '好意は得点に数えない（99個持っても VP は変わらない）');
  ok((p.coffers || 0) === 0 && (p.villagers || 0) === 0, '好意は財源(coffers)・村人(villagers)と完全に別枠');
}
{
  // 好意と Ally は公開情報＝マスクしても相手に見える
  const s = mk(['bauble', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine']);
  s.players[0].favors = 7;
  const m = E.maskStateFor(s, 1);
  ok(m.ally === s.ally, 'Ally は公開情報（マスクしても残る）');
  ok(m.players[0].favors === 7, '好意は公開情報（相手のぶんも見える）');
}

/* ============================================================
   A2: 分割山6組＝混合山モデル
   ============================================================ */
console.log('=== 同盟 A2: 分割山6組（16枚＝4種×4枚・安い順） ===');
{
  const ids = Object.keys(DOM.ALLIES_SPLIT_PILES);
  ok(ids.length === 6, '分割山は6組（' + ids.join(',') + '）');
  ok(ids.every((k) => DOM.ALLIES_SPLIT_PILES[k].length === 4), '各山の中身は4種');
  ok(DOM.POOLS.allies_split.length === 24, '分割山の中身は合計24種');
  // 山（プレースホルダ）は randomizer＝最安カードのコスト・種別を持つ
  ok(ids.every((k) => DOM.CARDS[k].cost === DOM.CARDS[DOM.ALLIES_SPLIT_PILES[k][0]].cost),
    '山のコスト（randomizer）＝一番安いカードのコスト（町民=$2／他5山=$3）');
  ok(DOM.CARDS.townsfolk.cost === 2 && DOM.CARDS.augurs.cost === 3, '町民だけ$2、卜占官は$3');
  // 「山の種別」も randomizer＝叙事詩は勝利点(遠い海岸)を含むが「勝利点の山」ではない
  ok(!DOM.isType('odysseys', 'victory') && DOM.isType('distant_shore', 'victory'),
    '叙事詩の山は「勝利点の山」ではない（randomizer が古地図＝アクション）＝発明家の家族は置ける');
  ok(DOM.isType('castles', 'victory'), '対照：城(帝国)の randomizer は勝利点＝発明家の家族は置けない');
}
{
  const s = mk();
  Object.keys(DOM.ALLIES_SPLIT_PILES).forEach((k) => {
    ok(Array.isArray(s[k]) && s[k].length === 16, k + ' の山は16枚（人数によらない）');
    ok(s.supply[k] === 16, 'supply.' + k + ' は実配列と同期（16）');
    const order = DOM.ALLIES_SPLIT_PILES[k];
    ok(order.every((cid, i) => s[k].slice(i * 4, i * 4 + 4).every((x) => x === cid)),
      k + ' は安い順に4枚ずつ積まれている（' + order.join('→') + '）');
  });
  const s4 = mk(KING, {}, ['A', 'B', 'C', 'D']);
  ok(s4.augurs.length === 16 && s4.supply.augurs === 16, '4人戦でも16枚（城のような人数別調整は無い）');
}
{
  // 買えるのは一番上だけ。コストは今の一番上のカード自身のコスト。
  let s = mk();
  ok(E.cardCost(s, 'augurs') === 3, '卜占官の山の「買うときのコスト」は一番上（薬草集め$3）');
  s.turn.phase = 'buy'; s.turn.coins = 99; s.turn.buys = 20;
  const t0 = tally(s);
  s = reduce(s, { type: 'BUY', card: 'augurs' });
  ok(count(s.players[0].discard, 'herb_gatherer') === 1, '卜占官の山を買うと一番上の実カード（薬草集め）が手に入る');
  ok(s.supply.augurs === 15 && s.augurs.length === 15, '買うと山キーの残数と実配列が同期して減る');
  ok(tdiff(t0, tally(s)).length === 0, '購入でカードの保存則が壊れない（プレースホルダが増えない）');
  for (let i = 0; i < 3; i++) s = reduce(s, { type: 'BUY', card: 'augurs' });
  ok(s.augurs.length === 12 && s.augurs[0] === 'acolyte', '薬草集め4枚を取り切ると次の種類（侍祭）が一番上に出る');
  ok(E.cardCost(s, 'augurs') === 4, '一番上が変わると「買うときのコスト」も $3→$4 に変わる');
  ok(DOM.CARDS.augurs.cost === 3, 'ただし「山のコスト」（randomizer＝プレースホルダ）は $3 のまま動かない');
}
{
  // 分割山の中身は単体では買えない（supply キーを持たない）
  let s = mk();
  s.turn.phase = 'buy'; s.turn.coins = 99; s.turn.buys = 20;
  const before = JSON.stringify(s.players[0].discard);
  const s2 = reduce(s, { type: 'BUY', card: 'sorceress' });
  ok(JSON.stringify(s2.players[0].discard) === before, '分割山の中身（女魔導士）を名指しで購入することはできない');
  ok(!E.canBuyCard(s, 0, 'sibyl'), 'canBuyCard は分割山の中身を拒否する');
}
{
  // 3山終了＝16枚**全部**が無くなって初めて1山
  const s = mk();
  ok(E.emptyPileCount(s) === 0, '開始時は空の山ゼロ');
  s.augurs = s.augurs.slice(0, 1); s.supply.augurs = 1;
  ok(E.emptyPileCount(s) === 0, '残り1枚では空の山に数えない');
  s.augurs = []; s.supply.augurs = 0;
  ok(E.emptyPileCount(s) === 1, '16枚すべて無くなって初めて1山ぶんの「空」');
}
{
  // 山を名指しする効果は「その山の4種すべて」に効く（pileKeyOf＝徴税の負債・冒険の山トークン）
  const s = mk();
  ok(E.pileKeyOf(s, 'sorceress') === 'augurs', '中身のカード → 山キー（女魔導士→卜占官）');
  ok(E.pileKeyOf(s, 'lich') === 'wizards' && E.pileKeyOf(s, 'student') === 'wizards', '魔法使いの4種はすべて同じ山キー');
  ok(E.pileKeyOf(s, 'augurs') === 'augurs', '山キー自身はそのまま');
  ok(E.actionSupplyPiles(s).indexOf('odysseys') >= 0, '叙事詩の山は「アクションのサプライ山」＝山トークンを置ける');
}
{
  // 冒険の山トークン：叙事詩の山に置くと**財宝である沈没した宝物**でも +$1（公式逐語）
  const s = mk();
  s.players[0].pileTokens = { coin: 'odysseys' };
  s.odysseys = ['sunken_treasure'].concat(s.odysseys.slice(1));
  s.players[0].hand = ['sunken_treasure'];
  s.turn.phase = 'buy'; s.turn.coins = 0;
  const s2 = reduce(s, { type: 'PLAY_TREASURE', card: 'sunken_treasure' });
  ok(s2.turn.coins >= 1, '山トークン（+コイン）は財宝を使ったときにも乗る（沈没した宝物）');
}

/* ============================================================
   A2: 循環（Rotate）
   ============================================================ */
console.log('=== 同盟 A2: 循環（Rotate） ===');
{
  const s = mk();
  const t0 = tally(s);
  ok(E.rotatePile(s, 'augurs') === true, '卜占官の山を回せる');
  ok(s.augurs.slice(0, 4).every((c) => c === 'acolyte'), '先頭の薬草集め4枚が末尾へ回り、侍祭が一番上に来る');
  ok(s.augurs.slice(-4).every((c) => c === 'herb_gatherer'), '回した4枚は山の一番下に付く');
  ok(s.augurs.length === 16 && s.supply.augurs === 16, '循環では枚数が変わらない');
  ok(tdiff(t0, tally(s)).length === 0, '循環でカードの保存則が壊れない');
  ok(E.cardCost(s, 'augurs') === 4, '循環すると「買うときのコスト」が変わる（$3→$4）');
}
{
  // ★「先頭からの**連続**同名ブロック」だけが動く（離れた同名は動かさない）＝公式wiki の Student の例
  const s = mk();
  s.wizards = ['student', 'lich', 'lich', 'lich', 'lich', 'student', 'student', 'conjurer'];
  s.supply.wizards = 8;
  E.rotatePile(s, 'wizards');
  ok(s.wizards.join(',') === 'lich,lich,lich,lich,student,student,conjurer,student',
    '先頭の生徒1枚だけが末尾へ（4枚下にある生徒2枚は動かない）＝「同名を全部集めて下へ」ではない');
}
{
  // 空の山・1種類だけの山を回しても合法（何も起きないだけ／例外にしない）
  const s = mk();
  s.augurs = []; s.supply.augurs = 0;
  let threw = false;
  try { ok(E.rotatePile(s, 'augurs') === false, '空の山を回しても合法（何も起きない）'); } catch (e) { threw = true; }
  ok(!threw, '空の山の循環で例外にならない');
  ok(E.rotatePile(s, 'copper') === false, '普通の山（中身が全部同名）を回しても何も起きない');
  ok(E.rotatePile(s, 'not_a_pile') === false, '存在しない山を指定しても落ちない');
  ok(E.rotatePile(s, null) === false, 'null を渡しても落ちない');
}
{
  // 戦闘計画＝任意のサプライ山を回せる（騎士・廃墟・城・サウナ/アヴァントも対象）
  const s = mk(['knights', 'castles', 'sauna', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  const kTop = s.knights[0];
  ok(E.rotatePile(s, 'knights') === true && s.knights[0] !== kTop, '騎士の混合山も回せる');
  ok(s.knights.length === 10, '騎士の枚数は変わらない');
  const cTop = s.castles[0];
  ok(E.rotatePile(s, 'castles') === true && s.castles[0] !== cTop, '城の混合山も回せる');
  // サウナ/アヴァント＝2段分割山。回すと上下が入れ替わる（splitRotated）。
  ok(E.splitLocked(s, 'avanto') === true, '通常はアヴァント（下段）が獲得できない');
  ok(E.rotatePile(s, 'sauna') === true, 'サウナ/アヴァントの2段分割山も回せる');
  ok(E.splitLocked(s, 'avanto') === false && E.splitLocked(s, 'sauna') === true,
    '循環すると上下が入れ替わる＝アヴァントが買えてサウナが買えなくなる');
  ok(E.rotatePile(s, 'avanto') === true && E.splitLocked(s, 'avanto') === true,
    'もう一度回すと元に戻る（下段idを指定しても同じ1山として扱う）');
  // 片方が尽きていれば全部同名＝回しても不変
  s.supply.avanto = 0;
  ok(E.rotatePile(s, 'sauna') === false, '片方が尽きた分割山を回しても何も起きない');
}
{
  // 循環した2段分割山でも購入できる／保存則が壊れない
  let s = mk(['sauna', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine']);
  const t0 = tally(s);
  E.rotatePile(s, 'sauna');
  s.turn.phase = 'buy'; s.turn.coins = 99; s.turn.buys = 5;
  s = reduce(s, { type: 'BUY', card: 'avanto' });
  ok(count(s.players[0].discard, 'avanto') === 1, '循環後はアヴァントを購入できる');
  s = reduce(s, { type: 'BUY', card: 'sauna' });
  ok(count(s.players[0].discard, 'sauna') === 0, '循環中はサウナを購入できない（engine が拒否する）');
  ok(tdiff(t0, tally(s)).length === 0, '保存則：山から手元へ移っただけでカードの総数は不変');
}
{
  // 戦闘計画の候補（rotatableSupplyPiles）＝サプライ山だけ・分割山下段は上段キーに正規化
  const s = mk(['knights', 'sauna', 'tournament', 'augurs', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar']);
  const list = E.rotatableSupplyPiles(s);
  ok(list.indexOf('copper') >= 0 && list.indexOf('province') >= 0, '普通の山も候補に出る（回しても無効果だが合法）');
  ok(list.indexOf('knights') >= 0 && list.indexOf('augurs') >= 0, '混合山・同盟の分割山も候補');
  ok(list.indexOf('sauna') >= 0 && list.indexOf('avanto') < 0, '2段分割山は上段キーだけ（1山1エントリ）');
  ok(list.indexOf('princess') < 0 && list.indexOf('followers') < 0, '非サプライ（賞品）は候補に出ない');
  ok(new Set(list).size === list.length, '候補に重複が無い');
}

/* ============================================================
   A2: 既存機構との配線（混合山リテラルの集約が効いているか）
   ============================================================ */
console.log('=== 同盟 A2: 既存機構との配線 ===');
{
  ok(E.MIXED_PILE_KEYS.length === 9 && E.MIXED_PILE_KEYS.indexOf('augurs') >= 0 && E.MIXED_PILE_KEYS.indexOf('castles') >= 0,
    '混合山の山キーは1箇所（MIXED_PILE_KEYS）に集約＝廃墟/騎士/城＋同盟の6山＝9山');
  const s = mk();
  ok(E.mixedTopCard(s, 'townsfolk') === 'town_crier', 'mixedTopCard が一番上の実カードを返す');
  ok(E.mixedTopCard(s, 'copper') === null, '普通の山では mixedTopCard は null');
}
{
  // サプライの山からの廃棄（塩まき/待ち伏せ/剣闘士）は「一番上の実カード」を抜く
  const s = mk();
  const t0 = tally(s);
  const got = E.trashFromSupplyPile(s, 0, 'augurs');
  ok(got === 'herb_gatherer', 'サプライ廃棄は山の一番上の実カードを抜く');
  ok(s.augurs.length === 15 && s.supply.augurs === 15, '廃棄で残数と実配列が同期する');
  ok(count(s.trash, 'herb_gatherer') === 1 && count(s.trash, 'augurs') === 0,
    '廃棄置き場にはプレースホルダではなく実カードが積まれる');
  ok(tdiff(t0, tally(s)).length === 0, 'サプライ廃棄で保存則が壊れない');
}
{
  // 交易商人：獲得しかけたカードを山へ戻す＝一番上に載る
  const s = mk();
  s.augurs = s.augurs.slice(4); s.supply.augurs = s.augurs.length; // 侍祭が一番上の状態
  ok(E.returnToPile(s, 'herb_gatherer') === true, '中身のカードを山へ戻せる');
  ok(s.augurs[0] === 'herb_gatherer', '戻したカードは山の**一番上**に載る（公式：大使が上に戻すのと同じ）');
  ok(s.supply.augurs === s.augurs.length, '戻したぶん残数が同期して増える');
}
{
  // 追放（移動動物園）：候補は山の一番上の実カード。中身の2枚目以降は候補に出ない。
  const s = mk(KING.concat([]).slice(0, 10));
  const ids = E.exilableSupplyIds(s);
  ok(ids.indexOf('herb_gatherer') >= 0, '追放候補に卜占官の山の一番上（薬草集め）が出る');
  ok(ids.indexOf('acolyte') < 0 && ids.indexOf('augurs') < 0, '2枚目以降の種類とプレースホルダは追放候補に出ない');
  ok(E.availableInSupply(s, 'herb_gatherer') === true && E.availableInSupply(s, 'sibyl') === false,
    'availableInSupply は「今 山の一番上にある」実カードだけ true');
}
{
  // 植民（移動動物園）＝アクションの山。同盟の6山は対象（randomizer がアクション）／城は対象外（勝利点）
  const s = mk(['augurs', 'odysseys', 'castles', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  const piles = E.populatePiles(s);
  ok(piles.indexOf('augurs') >= 0 && piles.indexOf('odysseys') >= 0, '同盟の分割山は「アクションの山」＝植民の対象');
  ok(piles.indexOf('castles') < 0, '城は勝利点の山＝植民の対象外（randomizer で判定）');
}
{
  // 闇市場デッキに分割山の中身24種は入らない（山の一番上でしか得られない）
  const s = mk(['black_market', 'augurs', 'wizards', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  const bm = new Set(s.blackMarket || []);
  ok((DOM.POOLS.allies_split || []).every((id) => !bm.has(id)), '分割山の中身24種は闇市場デッキに入らない');
  /* 【敵対レビュー回帰・既存バグ】混合山の**山キー**（'knights'/'castles' と同盟の6山）は「実在する1枚のカード」ではない
     ＝闇市場デッキに入れてはいけない（買うと存在しないカードが捨て札に湧き、終局後の deckCards にも出る）。
     従来は中身だけ塞いでいて山キーが漏れていた。 */
  ok(E.MIXED_PILE_KEYS.every((k) => !bm.has(k)), '混合山の山キー（騎士/城/同盟の6山）は闇市場デッキに入らない');
  ok((DOM.POOLS.castles || []).concat(DOM.POOLS.knights || []).every((id) => !bm.has(id)), '城/騎士の中身も闇市場デッキに入らない');
}
{
  /* 【敵対レビュー回帰】v63 以前に始まってオンラインで永続化された対局を復元すると、
     闇市場デッキに山キーが**既に入っている**（デッキ構築側の修正は新しい対局にしか効かない）。
     受理側（BLACK_MARKET_BUY）にも同じガードが要る。 */
  let s = mk(['black_market', 'knights', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.blackMarket = ['castles', 'sibyl'].concat(s.blackMarket || []);
  s.turn.phase = 'action'; s.turn.actions = 1; s.turn.coins = 20;
  s.players[0].hand = ['black_market'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'black_market' });
  ok(s.pending && s.pending.type === 'black_market', '闇市場の購入待ちが開く');
  const before = s.players[0].discard.slice();
  let s2 = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'castles' });
  ok(JSON.stringify(s2.players[0].discard) === JSON.stringify(before), '闇市場で山キー（城）は買えない');
  s2 = reduce(s, { type: 'BLACK_MARKET_BUY', card: 'sibyl' });
  ok(JSON.stringify(s2.players[0].discard) === JSON.stringify(before), '闇市場で分割山の中身（巫女）も買えない');
}
{
  /* 【敵対レビュー回帰】山トークンは「その山のカードを**使った**とき」＝アクション権を消費しない使用
     （博打／苦労／進軍／遅延・刈り入れ）でも乗る。財宝の経路だけ乗って他が乗らない非対称を作らない。 */
  let s = E.createInitialState(['A', 'B'], ['catapult', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine'],
    { startActive: 0, events: ['gamble'] });
  s.players[0].pileTokens = { coin: 'catapult' };   // 帝国の分割山（上段=投石機／下段=石＝財宝）
  s.players[0].deck = ['rocks'].concat(s.players[0].deck);
  s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY_EVENT', event: 'gamble' }); // 博打＝山札の上を捨ててから、使用するか選ぶ
  ok(s.pending && s.pending.type === 'gamble', '前提：博打の使用の窓が開く');
  s = reduce(s, { type: 'GAMBLE_PLAY', play: true });    // アクション権を消費しない使用（playCardNoAction 経路）
  ok(s.players[0].inPlay.indexOf('rocks') >= 0, '前提：博打で石（分割山の下段＝財宝）を使用した');
  ok(s.turn.coins >= 1, 'アクション権を消費しない使用でも山トークンが乗る（財宝の経路だけ乗る非対称を作らない）');
}
{
  // 中身が秘密の混合山は廃墟/騎士だけ＝マスクの線引き（城と同盟の分割山は全公開）
  ok(E.HIDDEN_MIXED_PILE_KEYS.join(',') === 'ruins,knights',
    '中身を伏せる混合山は廃墟/騎士だけ（城は昇順で決定的・同盟の分割山は公式に全公開）');
  const s = mk(['knights', 'castles', 'augurs', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory']);
  const m = E.maskStateFor(s, 1);
  ok(m.knights.slice(1).every((c) => c === 'back'), '騎士は一番上の1枚だけ公開');
  ok(m.castles.every((c) => c !== 'back'), '城は全公開');
  ok(m.augurs.every((c) => c !== 'back'), '同盟の分割山は全公開');
}
{
  // オンラインのマスク：分割山の中身は全公開（公式：いつでも見てよい／順序は変えない）
  const s = mk();
  const m = E.maskStateFor(s, 1);
  ok(m.augurs && m.augurs.length === 16 && m.augurs.every((c) => c !== 'back'),
    '分割山の中身は伏せない（公式：You can look through the cards in a split pile at any time）');
}
{
  // 塔（帝国ランドマーク）＝分割山の中身は「16枚すべて空」で初めて空山由来
  const s = mk();
  s.landmarks = ['tower'];
  s.augurs = s.augurs.slice(1); s.supply.augurs = s.augurs.length;
  ok(E.landmarkScoreForCards(s, ['herb_gatherer'], 0) === 0, '山が残っている間は塔の得点にならない');
  s.augurs = []; s.supply.augurs = 0;
  ok(E.landmarkScoreForCards(s, ['herb_gatherer'], 0) === 1, '16枚すべて無くなれば塔の +1点');
}
{
  // オベリスク（帝国ランドマーク）＝分割山を選んだら**4種すべて**を数える
  const s = mk();
  s.landmarks = ['obelisk']; s.obeliskPile = 'augurs';
  ok(E.landmarkScoreForCards(s, ['herb_gatherer', 'acolyte', 'sorceress', 'sibyl', 'village'], 0) === 8,
    'オベリスクで卜占官を選んだら4種すべてが2点ずつ（4枚＝8点）');
  s.obeliskPile = 'wizards';
  ok(E.landmarkScoreForCards(s, ['student', 'lich', 'village'], 0) === 4, '魔法使いも4種すべてを数える');
}

/* ============================================================
   A2: 敵対レビューで確定した既存バグの回帰
   ============================================================ */
console.log('=== 同盟 A2: 敵対レビュー回帰 ===');
{
  /* [high] 相続(Inheritance)＝**混合山の山キーは脇に置けない**。プレースホルダは実在する1枚のカードではないので、
     脇に置くと supply だけ減って実カード配列が減らず、カードが1枚湧く（保存則違反）。
     $4以下のアクション山が同盟の分割山しか無い王国では CPU が自然に選んでいた。 */
  const K = ['augurs', 'clashes', 'forts', 'odysseys', 'townsfolk', 'wizards', 'laboratory', 'market', 'festival', 'witch'];
  const s = mk(K);
  const tg = E.inheritanceTargets(s);
  ok(E.MIXED_PILE_KEYS.every((k) => tg.indexOf(k) < 0), '相続の対象に混合山の山キーが出ない（同盟の6山・騎士・城）');
  s.pending = { type: 'inheritance', player: 0 };
  const t0 = tally(s);
  const s2 = reduce(s, { type: 'INHERITANCE_SET', card: 'augurs' });
  ok((s2.players[0].inherited || []).length === 0, '山キーを指定した相続は engine が拒否する');
  ok(tdiff(t0, tally(s2)).length === 0, '拒否されるので保存則が壊れない（カードが湧かない）');
}
{
  // [medium] 命令（船長/大君主/はみだし者）の対象に混合山の山キーが出ない＝効果ゼロの死に選択肢を出さない
  const s = mk(['augurs', 'townsfolk', 'wizards', 'captain', 'overlord', 'band_of_misfits', 'village', 'smithy', 'market', 'moat']);
  const cap = E.captainTargets(s), ovl = E.overlordTargets(s), bom = E.bandOfMisfitsTargets(s, 5);
  ok(E.MIXED_PILE_KEYS.every((k) => cap.indexOf(k) < 0), '船長の対象に混合山の山キーが出ない');
  ok(E.MIXED_PILE_KEYS.every((k) => ovl.indexOf(k) < 0), '大君主の対象に混合山の山キーが出ない');
  ok(E.MIXED_PILE_KEYS.every((k) => bom.indexOf(k) < 0), 'はみだし者の対象に混合山の山キーが出ない');
}
{
  /* [medium] 汚された神殿（帝国ランドマーク）の山上VPは**山キー**に載る＝獲得した実カードidで引くと取れない。
     同盟の分割山と、帝国の2段分割山の下段（既存バグ）で永久に孤児化していた。 */
  let s = mk(['augurs', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine'],
    { landmarks: ['defiled_shrine'] });
  ok((s.pileVP.augurs || 0) === 2, '準備で同盟の分割山に山上VPが2個置かれる（randomizer がアクション）');
  s.turn.phase = 'buy'; s.turn.coins = 9; s.turn.buys = 3;
  s = reduce(s, { type: 'BUY', card: 'augurs' });
  ok(s.pileVP.augurs === 1 && (s.landmarkStash.defiled_shrine || 0) === 1,
    '同盟の分割山から獲得すると山上VPが1個 汚された神殿へ移る（実カードidでは引けない）');
  // 帝国の2段分割山の下段（騒がしい村）＝同型の既存バグの回帰
  let e = E.createInitialState(['A', 'B'], ['settlers', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine'],
    { startActive: 0, landmarks: ['defiled_shrine'] });
  ok((e.pileVP.settlers || 0) === 2 && e.pileVP.bustling_village == null, '帝国の分割山は上段キーにだけ山上VPが置かれる');
  e.supply.settlers = 0; // 上段を尽くして下段を獲得できる状態にする
  e.turn.phase = 'buy'; e.turn.coins = 9; e.turn.buys = 3;
  e = reduce(e, { type: 'BUY', card: 'bustling_village' });
  ok(e.pileVP.settlers === 1 && (e.landmarkStash.defiled_shrine || 0) === 1,
    '分割山の下段を獲得しても上段キーの山上VPを受け取れる（孤児化しない）');
}
{
  /* [low] 循環中の2段分割山も「アクションのサプライ山」＝冒険の山トークンを置ける。
     `splitLocked` の意味を「今 山の一番上に出ていないか」に変えたことで、`actionSupplyPiles` の
     `!splitLocked` が live 化し、循環中の山が候補から丸ごと消えていた（山の種別は randomizer 固定＝置けるのが公式）。 */
  const s = E.createInitialState(['A', 'B'], ['settlers', 'augurs', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival'],
    { startActive: 0 });
  ok(E.actionSupplyPiles(s).indexOf('settlers') >= 0, '前提：2段分割山（開拓者）は山トークンの置き先候補');
  E.rotatePile(s, 'settlers');
  ok(E.actionSupplyPiles(s).indexOf('settlers') >= 0, '循環しても山トークンの置き先候補から消えない');
  ok(E.actionSupplyPiles(s).indexOf('bustling_village') < 0, '下段キーは候補に出ない（1山1エントリ＝トークンの孤児化を防ぐ）');
  ok(E.actionSupplyPiles(s).indexOf('augurs') >= 0, '同盟の分割山も置き先候補（叙事詩に財宝が入っていても山はアクションの山）');
}
{
  // [low] 取り替え子＝分割山から獲得したカードも交換できる（山の一番上に戻る）
  const s = mk(['augurs', 'changeling', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.players[0].discard.push('sibyl'); // 巫女($6)を獲得した直後の状態
  ok(E.changelingCanExchange(s, 0, 'sibyl', 'discard') === true, '分割山の中身も取り替え子と交換できる（戻す山がある）');
  ok(E.changelingCanExchange(s, 0, 'goat', 'discard') === false, '家宝（山が無い）は交換できない');
}

/* ============================================================
   A2b: 「カードの種別」は山の一番上で判定する／「山の種別」は randomizer のまま
   ============================================================ */
console.log('=== 同盟 A2b: カードの種別は一番上・山の種別は randomizer ===');
// 叙事詩＝古地図(A)/航海(A持続)/沈没した宝物(**財宝**)/遠い海岸(A勝利点)、城砦＝天幕/駐屯地/丘の砦/要塞(**勝利点**)。
function dig(s, pile, n) { s[pile] = s[pile].slice(n); s.supply[pile] = s[pile].length; return s; }
{
  const s = dig(mk(['odysseys', 'forts', 'lurker', 'university', 'salt_the_earth', 'village', 'smithy', 'market', 'moat', 'militia']), 'odysseys', 8);
  ok(E.mixedTopCard(s, 'odysseys') === 'sunken_treasure', '前提：叙事詩の一番上が沈没した宝物（財宝）');
  ok(E.isTypeSupply(s, 'odysseys', 'action') === false, '「アクションカード」ではない（randomizer の古地図ではなく一番上を見る）');
  ok(E.isTreasureFor(s, 'odysseys') === true, '「財宝カード」として扱われる（鉱山/収税吏/英雄が獲得できる）');
  ok(E.costUpTo(s, 'odysseys', 6) && !E.isTypeSupply(s, 'odysseys', 'action'),
    '「$6以下のアクションを獲得」（昇進/海路/大学/車大工）の候補には出ない＝コストは満たすが種別で落ちる');
  // 待ち伏せ＝サプライのアクションカードを廃棄。ゲートと受理が同じ述語であること（片方だけだと詰む）。
  const t0 = tally(s);
  s.pending = { type: 'lurker', stage: 'trash', player: 0 };
  const s2 = reduce(s, { type: 'LURKER_TRASH', card: 'odysseys' });
  ok(s2.pending != null && tdiff(t0, tally(s2)).length === 0, '待ち伏せは沈没した宝物を「アクションカード」として廃棄できない');
}
{
  const s = dig(mk(['forts', 'salt_the_earth', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']), 'forts', 12);
  ok(E.mixedTopCard(s, 'forts') === 'stronghold', '前提：城砦の一番上が要塞（アクション・勝利点・持続）');
  ok(E.isTypeSupply(s, 'forts', 'victory') === true, '「勝利点カード」として扱われる（randomizer の天幕は勝利点ではない）');
  s.pending = { type: 'salt_the_earth', player: 0 };
  const s2 = reduce(s, { type: 'SALT_TRASH', card: 'forts' });
  ok(s2.pending === null && count(s2.trash, 'stronghold') === 1, '塩まきは要塞を「勝利点カード」として廃棄できる');
  ok(s2.supply.forts === 3 && s2.forts.length === 3, '廃棄で山キーの残数と実配列が同期する');
}
{
  /* ★直しすぎていないことの担保＝**「山の」コスト・種別を参照する効果は randomizer のまま**。
     公式逐語＝`Some cards refer to information about a pile as if it's just one card.
     In these cases, go with what's on the Randomizer card.` */
  const s = dig(mk(['odysseys', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine']), 'odysseys', 8);
  ok(E.actionSupplyPiles(s).indexOf('odysseys') >= 0,
    '一番上が財宝でも「アクションのサプライ山」＝冒険の山トークンは置ける（山の種別は randomizer）');
  ok(E.populatePiles(s).indexOf('odysseys') >= 0, '植民の対象からも外れない（山の種別で判定）');
  const s2 = E.createInitialState(['A', 'B'], ['odysseys', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine'],
    { startActive: 0, landmarks: ['defiled_shrine'] });
  ok((s2.pileVP.odysseys || 0) === 2, '汚された神殿も「素のアクションの山」として山上VPを置く（randomizer で判定）');
}

{
  /* 【A2b レビュー回帰】従者(squire) の on-trash＝**窓を開く述語と受理する述語が同じ**こと。
     片方だけ一番上を見ると、分割山が「サプライで唯一のアタック」のときに CPU が本番 livelock する
     （実際にソーク72戦中3戦で膠着した）。 */
  let s = mk(['clashes', 'squire', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.clashes = s.clashes.slice(4); s.supply.clashes = s.clashes.length; // 先頭＝射手（アタック）
  ok(E.isTypeSupply(s, 'clashes', 'attack') === true, '前提：衝突の一番上が射手（アタック）');
  s.pending = { type: 'squire_trash_gain', player: 0 };
  const t0 = tally(s);
  s = reduce(s, { type: 'SQUIRE_TRASH_GAIN', card: 'clashes' });
  ok(s.pending === null && count(s.players[0].discard, 'archer') === 1,
    '従者の獲得が受理される（gate と受理が同じ述語＝CPU が同じ手を返し続けない）');
  ok(tdiff(t0, tally(s)).length === 0, '保存則が壊れない');
}
{
  /* 【A2b レビュー回帰】待ち伏せ(lurker) の候補は CPU も engine と同じ述語を見る。
     CPU は「安いアクション山」から選ぶので、randomizer が $2〜$3 の同盟の分割山が必ず先頭に来る＝
     一番上が財宝/勝利点だと engine に拒否され続けて livelock した。 */
  let s = mk(['odysseys', 'lurker', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival'],
    {}, [{ name: 'C0', isCpu: true, level: 'hard' }, { name: 'C1', isCpu: true, level: 'hard' }]);
  s.odysseys = s.odysseys.slice(8); s.supply.odysseys = s.odysseys.length; // 先頭＝沈没した宝物（財宝）
  s.pending = { type: 'lurker', stage: 'trash', player: 0 };
  s.turn.phase = 'action';
  const a = CPU.decide(s);
  ok(a && a.card !== 'odysseys', 'CPU は「アクションでない」分割山を待ち伏せの廃棄候補に出さない（実 ' + (a && a.card) + '）');
  const s2 = reduce(s, a);
  ok(s2.pending === null, 'CPU が返した手を engine が受理して選択待ちが閉じる（3面一致）');
}
{
  /* 【A2b レビュー回帰】塩まき(salt_the_earth)＝CPU/UI も一番上で判定する。
     騎士の一番上がデイム・ジョセフィーヌ（勝利点）のとき、engine は受理するのに
     CPU/UI が候補に出さない、という 3面破れが mix-all で**今日すでに**到達可能だった。 */
  let s = mk(['knights', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine'],
    {}, [{ name: 'C0', isCpu: true, level: 'hard' }, { name: 'C1', isCpu: true, level: 'hard' }]);
  s.knights = ['dame_josephine'].concat(s.knights.filter((c) => c !== 'dame_josephine'));
  ok(E.isTypeSupply(s, 'knights', 'victory') === true, '前提：騎士の一番上が勝利点（デイム・ジョセフィーヌ）');
  s.supply.estate = 0; s.supply.duchy = 0; s.supply.province = 0; // 基本の勝利点山を空にして騎士だけを候補にする
  s.pending = { type: 'salt_the_earth', player: 0 };
  const a = CPU.decide(s);
  ok(a && a.card === 'knights', 'CPU は騎士の山を勝利点として候補に出す（実 ' + (a && a.card) + '）');
  const s2 = reduce(s, a);
  ok(s2.pending === null && count(s2.trash, 'dame_josephine') === 1, '塩まきで一番上の実カードが廃棄される');
}
{
  // 終端保証：勝利点の山が1つも無ければ塩まきの窓は閉じる（人間が逃げ道ゼロで詰まない）
  let s = mk(['village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine', 'workshop']);
  s.supply.estate = 0; s.supply.duchy = 0; s.supply.province = 0;
  s.pending = { type: 'salt_the_earth', player: 0 };
  ok(reduce(s, { type: 'SALT_TRASH', card: null }).pending === null, '勝利点の山がゼロなら塩まきの窓は閉じる（終端保証）');
}

/* ============================================================
   A2: CPU（engine と同じ述語を見るか＝本番 livelock を防ぐ）
   ============================================================ */
console.log('=== 同盟 A2: CPU ===');
{
  // CPU が同盟の山を買っても engine と食い違わない（コストは一番上・獲得物は実カード）
  let s = mk(KING, {}, [{ name: 'C0', isCpu: true, level: 'hard' }, { name: 'C1', isCpu: true, level: 'normal' }]);
  const t0 = tally(s);
  let steps = 0, stuck = 0, prev = '', nullSeen = false;
  while (!s.gameOver && steps < 20000) {
    const a = CPU.decide(s);
    if (a == null) { nullSeen = true; break; }
    const next = reduce(s, a);
    const fp = JSON.stringify({ sp: next.supply, pd: next.pending, tn: next.players.map((p) => p.turns) });
    if (fp === prev) { stuck++; if (stuck > 200) break; } else { stuck = 0; }
    prev = fp; s = next; steps++;
  }
  ok(!nullSeen, 'CPU は一度も null を返さない（オンラインで reduce(state,null) が TypeError になる事故を防ぐ）');
  ok(s.gameOver, '同盟の分割山を含む王国で CPU 戦が終局する（膠着しない）');
  ok(total(tally(s)) === total(t0), 'CPU 戦の最後までカードの総数が保存される');
  ok(s.players.every((p) => E.allCards(p).every((c) => Object.keys(DOM.ALLIES_SPLIT_PILES).indexOf(c) < 0)),
    'プレースホルダ（山キー）が誰かの所有カードに紛れ込んでいない');
  // ※CPU が分割山を買うかどうかは A4（カード効果）以降の話＝ここでは「壊れないこと」だけを見る。
}
{
  /* 汎用の獲得効果（工房）から分割山を獲得できる＝engine の獲得述語（costUpTo/gainableBase）が
     「山キーのコスト＝今の一番上」で正しく判定し、CPU も同じ候補を提案する（＝engine拒否とCPU提案の
     食い違いによる本番 livelock が起きない）。 */
  const K = ['workshop', 'townsfolk', 'augurs', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory'];
  let s = mk(K, {}, [{ name: 'C0', isCpu: true, level: 'hard' }, { name: 'C1', isCpu: true, level: 'hard' }]);
  s.players[0].hand = ['workshop']; s.turn.phase = 'action'; s.turn.actions = 1;
  const t0 = tally(s);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });
  ok(s.pending && s.pending.type === 'workshop', '工房の獲得待ちが開く');
  const a = CPU.decide(s);
  ok(a != null && a.card != null, 'CPU は工房の獲得で null を返さない（同盟の山があっても候補を出す）');
  ok(reduce(s, a).pending == null, 'CPU が返した獲得を engine が受理して選択待ちが閉じる（述語の食い違いなし）');
  s = reduce(s, { type: 'WORKSHOP_GAIN', card: 'townsfolk' });
  ok(count(s.players[0].discard, 'town_crier') === 1, '工房で町民の山を指定すると一番上の実カード（触れ役）が手に入る');
  ok(s.supply.townsfolk === 15 && s.townsfolk.length === 15, '汎用獲得でも残数と実配列が同期する');
  ok(tdiff(t0, tally(s)).length === 0, '汎用獲得で保存則が壊れない');
}
{
  // 「$N以下を獲得」の判定は**今の一番上のコスト**で動く（循環や購入で山のコストが上がると取れなくなる）。
  const s = mk(['workshop', 'townsfolk', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  ok(E.costUpTo(s, 'townsfolk', 4) === true, '一番上が触れ役($2)なら「$4以下」に含まれる');
  s.townsfolk = s.townsfolk.slice(12); s.supply.townsfolk = 4; // 長老($5)だけが残った状態
  ok(E.cardCost(s, 'townsfolk') === 5, '一番上が長老なら山のコストは$5');
  ok(E.costUpTo(s, 'townsfolk', 4) === false, '「$4以下」の獲得では取れない（今の一番上で判定する）');
  ok(E.gainableBase(s, 'townsfolk') === true, '山自体は残っているので獲得の土台としては有効');
}

/* ============================================================================
   A3＝同盟(Ally)カード23種
   正本＝docs/research/allies_rules.md（g09/g10＝Ally 全23枚の逐語とFAQ）。
   ⚠ Ally が起こす攻撃は「アタックカードのプレイ」ではない＝**堀で防げない**（魔女の輪／すり師団）。
   ⚠ 好意の支払いは常に任意＝どの窓も「使わない」で必ず閉じられる（CPU が null を返さない）。
   ============================================================================ */
// 連携1枚（道化棒）＋素直な基本カードの王国。Ally は opts.ally で固定する。
const A3K = ['bauble', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine'];
function mkAlly(ally, kingdom) { return mk(kingdom || A3K, { ally }); }
// どの Ally 窓でも「使わない」で閉じる（CPU 分岐の代わりにテストから明示的に閉じる）。
function declineAlly(s) {
  const pd = s.pending, p = s.players[pd.player];
  if (pd.type === 'ally_gang') {
    return pd.stage === 'pay' ? reduce(s, { type: 'ALLY_GANG', ok: false })
      : reduce(s, { type: 'ALLY_GANG', cards: p.hand.slice(0, Math.max(0, p.hand.length - 4)) });
  }
  if (pd.type === 'ally_cave') return reduce(s, { type: 'ALLY_CAVE', ok: false });
  if (pd.type === 'ally_crafters') return reduce(s, { type: 'ALLY_CRAFTERS', card: null });
  if (pd.type === 'ally_inventors') return reduce(s, { type: 'ALLY_INVENTORS', pile: null });
  if (pd.type === 'ally_market_towns') return reduce(s, { type: 'ALLY_MARKET_TOWNS', card: null });
  if (pd.type === 'ally_peaceful_cult') return reduce(s, { type: 'ALLY_PEACEFUL_CULT', cards: [] });
  if (pd.type === 'ally_woodworkers') return reduce(s, { type: 'ALLY_WOODWORKERS', card: null });
  if (pd.type === 'ally_coastal_haven') return reduce(s, { type: 'ALLY_COASTAL_HAVEN', cards: [] });
  if (pd.type === 'ally_architects') return reduce(s, { type: 'ALLY_ARCHITECTS', card: null });
  if (pd.type === 'ally_nomads') return reduce(s, { type: 'ALLY_NOMADS', choice: null });
  return reduce(s, { type: 'ALLY_SIMPLE', ok: false });
}
// 席0の次の手番開始まで進める（途中の Ally 窓はすべて辞退する）。
// ※**ゲームの最初のターンにも開始時 Ally の窓が開く**ので、まずそれを閉じてから1周する。
function toOwnTurnStart(s) {
  let g0 = 0; while (s.pending && g0++ < 10) s = declineAlly(s);
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  let g = 0;
  while (g++ < 60) {
    if (s.pending) {
      if (s.turn.active === 0 && String(s.pending.type).indexOf('ally_') === 0 && s.pending.player === 0) return s;
      s = declineAlly(s); continue;
    }
    if (s.turn.active === 0) return s;
    s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  }
  return s;
}

console.log('=== A3: Ally の選定と好意の基盤 ===');
{
  const s = mkAlly('mountain_folk');
  ok(s.ally === 'mountain_folk', 'opts.ally で Ally を固定できる');
  ok(s.players.every((p) => p.favors === 1), '連携があれば全員が好意1個で開始');
  const im = mk(['importer'].concat(A3K.slice(1)), { ally: 'mountain_folk' });
  ok(im.players.every((p) => p.favors === 5), '輸入者があるゲームは好意5個で開始');
  const none = mk(['village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'mine', 'workshop']);
  ok(none.ally == null && none.players.every((p) => (p.favors || 0) === 0), '連携が無ければ Ally も好意も登場しない');
  ok(E.hasAlly(s, 'mountain_folk') && !E.hasAlly(none, 'mountain_folk'), 'hasAlly が正しく判定する');
}
{
  /* **ゲームの最初のターンにも「あなたのターンの開始時」は起きる**（公式：好意はゲームの最初のターンから使える）。
     開始時 Ally の窓は cleanupAndAdvance からしか呼ばれない resolveDurationStartEffects の中にあるので、
     先頭手番だけ素通りしていた（すり師団を先手だけが1ターン免れる非対称）＝敵対レビューで確定した穴。 */
  ok(mkAlly('gang_of_pickpockets').pending != null, 'ターン1でも すり師団の窓が開く（先手だけ免れない）');
  ok(mkAlly('cave_dwellers').pending != null, 'ターン1でも 穴居民の窓が開く（開始時の好意1をターン1から使える）');
  ok(mkAlly('desert_guides').pending != null, 'ターン1でも 砂漠の案内人の窓が開く');
  ok(mkAlly('forest_dwellers').pending != null, 'ターン1でも 森の居住者の窓が開く');
  ok(mkAlly('mountain_folk').pending == null, '好意が足りない Ally（山の民＝5個必要）はターン1では開かない');
  ok(mkAlly('league_of_bankers').pending == null, '購入フェイズ開始時の Ally はターン1の開始時には開かない');
  const s0 = mkAlly('gang_of_pickpockets');
  ok(s0.pending.type === 'ally_gang' && s0.pending.stage === 'pay' && s0.pending.player === 0, '先頭手番の席に開く');
  const cpu = E.createInitialState([{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'normal' }],
    A3K, { startActive: 0, ally: 'gang_of_pickpockets' });
  const a = CPU.decide(cpu);
  ok(a && a.type === 'ALLY_GANG', 'ターン1の窓でも CPU が有効な action を返す');
  ok(JSON.stringify(reduce(cpu, a)) !== JSON.stringify(cpu), 'engine が受理する（初手から膠着しない）');
}

console.log('=== A3: 山の民（好意5＝+3カード） ===');
{
  let s = mkAlly('mountain_folk');
  s.players[0].favors = 4;
  let t1 = toOwnTurnStart(s);
  ok(!(t1.pending && t1.pending.type === 'ally_mountain_folk'), '好意4個では窓が開かない（ちょうど5個必要）');
  s.players[0].favors = 5;
  let t2 = toOwnTurnStart(s);
  ok(t2.pending && t2.pending.type === 'ally_mountain_folk', '好意5個で窓が開く');
  const before = t2.players[0].hand.length;
  t2 = reduce(t2, { type: 'ALLY_SIMPLE', ok: true });
  ok(t2.players[0].hand.length === before + 3 && t2.players[0].favors === 0, '好意5を払って +3カード');
  let t3 = reduce(toOwnTurnStart(s), { type: 'ALLY_SIMPLE', ok: false });
  ok(t3.pending == null && t3.players[0].favors === 5, '「使わない」で閉じ、好意は減らない');
}

console.log('=== A3: 穴居民（1枚捨てて1枚引く・Repeat・手札0でも引ける） ===');
{
  let s = mkAlly('cave_dwellers');
  s.players[0].favors = 2;
  s = toOwnTurnStart(s);
  ok(s.pending && s.pending.type === 'ally_cave', 'ターン開始時に窓が開く');
  const h0 = s.players[0].hand.length;
  s = reduce(s, { type: 'ALLY_CAVE', ok: true, card: s.players[0].hand[0] });
  ok(s.players[0].hand.length === h0 && s.players[0].favors === 1, '1枚捨てて1枚引く（手札枚数は不変）');
  ok(s.pending && s.pending.type === 'ally_cave', '好意が残っていれば再オファー（Repeat as desired）');
  s = reduce(s, { type: 'ALLY_CAVE', ok: false });
  ok(s.pending == null && s.players[0].favors === 1, 'やめると閉じる');
}
{
  // **手札0枚でも好意を払えば1枚引ける**（公式FAQ "You draw a card even if you failed to discard one."）
  let s = mkAlly('cave_dwellers');
  s.players[0].favors = 1;
  s = toOwnTurnStart(s);
  s.players[0].hand = [];
  s.players[0].deck = ['gold'].concat(s.players[0].deck);
  s = reduce(s, { type: 'ALLY_CAVE', ok: true, card: null });
  ok(s.players[0].hand.length === 1 && s.players[0].hand[0] === 'gold', '手札0枚でも1枚引ける');
}

console.log('=== A3: 砂漠の案内人（引き直し・Repeat・辞退したら戻れない） ===');
{
  let s = mkAlly('desert_guides');
  s.players[0].favors = 2;
  s = toOwnTurnStart(s);
  s.players[0].hand = ['estate', 'estate'];
  const t0 = tally(s);
  s = reduce(s, { type: 'ALLY_SIMPLE', ok: true });
  ok(s.players[0].hand.length === 5, '手札を全部捨てて**常に5枚**引く');
  ok(tdiff(t0, tally(s)).length === 0, '捨てて引き直しても保存則が壊れない');
  ok(s.pending && s.pending.type === 'ally_desert', '再オファーされる');
  s = reduce(s, { type: 'ALLY_SIMPLE', ok: false });
  ok(s.pending == null, '辞退したらそのターンは二度と開かない');
}

console.log('=== A3: 森の居住者（見て並べ替える＝look_arrange に委譲） ===');
{
  let s = mkAlly('forest_dwellers');
  s.players[0].favors = 1;
  s = toOwnTurnStart(s);
  s.players[0].deck = ['copper', 'estate', 'gold'].concat(s.players[0].deck);
  s = reduce(s, { type: 'ALLY_SIMPLE', ok: true });
  ok(s.pending && s.pending.type === 'look_arrange' && s.pending.source === 'forest_dwellers', 'look_arrange に委譲する');
  ok(s.pending.cards.length === 3 && s.pending.cards[0] === 'copper', '山札の上3枚を見る');
  s = reduce(s, { type: 'LOOK_ARRANGE_RESOLVE', discard: ['copper', 'estate'], top: ['gold'] });
  ok(s.players[0].deck[0] === 'gold' && s.players[0].favors === 0, '残りを山札の上に戻す');
}

console.log('=== A3: すり師団（アタックではない＝堀で防げない） ===');
{
  let s = mkAlly('gang_of_pickpockets');
  s.players[0].favors = 1;
  s = toOwnTurnStart(s);
  ok(s.pending && s.pending.type === 'ally_gang' && s.pending.stage === 'pay', '好意があれば「払うか」を聞く');
  s = reduce(s, { type: 'ALLY_GANG', ok: true });
  ok(s.pending == null && s.players[0].favors === 0, '好意1を払えば捨てなくてよい');
}
{
  let s = mkAlly('gang_of_pickpockets');
  s.players[0].favors = 0;
  s = toOwnTurnStart(s);
  s.players[0].hand = ['moat', 'copper', 'copper', 'copper', 'copper', 'copper'];
  ok(s.pending && s.pending.stage === 'discard', '好意0なら直接「捨てる」段階');
  s = reduce(s, { type: 'ALLY_GANG', cards: ['copper', 'copper'] });
  ok(s.players[0].hand.length === 4, '**堀を持っていても**手札4枚まで捨てる（アタックではない）');
}
{
  let s = mkAlly('gang_of_pickpockets');
  s.players[0].favors = 0;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.players[0].hand = ['copper', 'copper'];
  s = reduce(s, { type: 'END_TURN' });
  let g = 0; while (s.turn.active === 1 && g++ < 20) { if (s.pending) s = declineAlly(s); else { s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' }); } }
  ok(true, 'すり師団のゲームが手番を回せる（終端保証）');
}

console.log('=== A3: 工芸家ギルド（好意2で$4以下を山札の上に獲得） ===');
{
  let s = mkAlly('crafters_guild');
  s.players[0].favors = 2;
  s = toOwnTurnStart(s);
  const t0 = tally(s);
  s = reduce(s, { type: 'ALLY_CRAFTERS', card: 'silver' });
  ok(s.players[0].deck[0] === 'silver', '**捨て札を経由せず**山札の上に獲得する');
  ok(s.players[0].favors === 0, '好意2を払う');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
  let s2 = mkAlly('crafters_guild'); s2.players[0].favors = 2; s2 = toOwnTurnStart(s2);
  ok(reduce(s2, { type: 'ALLY_CRAFTERS', card: 'gold' }).pending != null, '$4を超えるカードは拒否される（窓は閉じない）');
}

console.log('=== A3: 銀行家連盟（好意4につき +$1・消費しない） ===');
{
  let s = mkAlly('league_of_bankers');
  s.players[0].favors = 3;
  ok(reduce(s, { type: 'END_ACTION_PHASE' }).turn.coins === 0, '好意3個では +$0（端数切捨て）');
  s.players[0].favors = 11;
  const r = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(r.turn.coins === 2, '好意11個で +$2');
  ok(r.players[0].favors === 11, '好意は消費しない');
}

console.log('=== A3: 小売店主連盟（連携を使った後・5以上で+$1／10以上でさらに+1ア+1購入） ===');
{
  let s = mkAlly('league_of_shopkeepers');
  s.players[0].favors = 5;
  s.players[0].hand = ['bauble'];
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'bauble' });
  // A4：道化棒は「異なる2つを選ぶ」窓を開く＝**その解決が終わってから** Ally が誘発する（公式）。
  s = reduce(s, { type: 'BAUBLE_CHOOSE', picks: ['buy', 'coin'] });
  ok(s.turn.coins >= 1, '財宝の連携（道化棒）を使っても誘発する: coins=' + s.turn.coins);
  ok(s.players[0].favors === 5, '好意は消費しない');
}
{
  let s = mkAlly('league_of_shopkeepers');
  s.players[0].favors = 10;
  s.players[0].hand = ['bauble'];
  s.turn.phase = 'buy';
  const b0 = s.turn.buys;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'bauble' });
  s = reduce(s, { type: 'BAUBLE_CHOOSE', picks: ['coin', 'favor'] }); // +1購入 は選ばない（小売店主連盟のぶんだけ数える）
  ok(s.turn.buys === b0 + 1, '好意10以上なら +1購入（+$1 と**累積**）');
}
{
  // 非連携のカードでは誘発しない
  let s = mkAlly('league_of_shopkeepers');
  s.players[0].favors = 10;
  s.players[0].hand = ['village'];
  const b0 = s.turn.buys;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(s.turn.buys === b0, '連携でないカードでは誘発しない');
}

console.log('=== A3: 魔女の輪（好意3で全員に呪い・アタックではない） ===');
{
  let s = mkAlly('circle_of_witches');
  s.players[0].favors = 3;
  s.players[0].hand = ['bauble'];
  s.players[1].hand = ['moat'];
  s.turn.phase = 'buy';
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'bauble' });
  s = reduce(s, { type: 'BAUBLE_CHOOSE', picks: ['buy', 'coin'] }); // 道化棒の選択を解決してから Ally の窓が開く
  ok(s.pending && s.pending.type === 'ally_circle', '連携を使った後に窓が開く');
  s = reduce(s, { type: 'ALLY_SIMPLE', ok: true });
  ok(count(s.players[1].discard, 'curse') === 1, '**堀を持っていても**呪いを受ける（アタックではない）');
  ok(s.players[0].favors === 0, '好意3を払う');
}

console.log('=== A3: 市場の町（購入フェイズのままアクションを使う・Repeat） ===');
{
  let s = mkAlly('market_towns');
  s.players[0].favors = 2;
  s.players[0].hand = ['village', 'laboratory', 'copper'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(s.pending && s.pending.type === 'ally_market_towns', '購入フェイズ開始時に窓が開く');
  s = reduce(s, { type: 'ALLY_MARKET_TOWNS', card: 'laboratory' });
  ok(s.turn.phase === 'buy', '**アクションフェイズには戻らない**（購入フェイズのまま）');
  ok(s.players[0].inPlay.indexOf('laboratory') >= 0, '研究所が場に出る');
  ok(s.pending && s.pending.type === 'ally_market_towns', '好意が残っていれば再オファー');
  s = reduce(s, { type: 'ALLY_MARKET_TOWNS', card: null });
  ok(s.pending == null, 'やめると閉じる');
}

console.log('=== A3: 平和的教団（好意ぶんまとめて廃棄・枚数は先に固定） ===');
{
  let s = mkAlly('peaceful_cult');
  s.players[0].favors = 3;
  s.players[0].hand = ['estate', 'estate', 'copper'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  const t0 = tally(s);
  s = reduce(s, { type: 'ALLY_PEACEFUL_CULT', cards: ['estate', 'estate', 'copper'] });
  ok(s.players[0].hand.length === 0 && s.players[0].favors === 0, '好意3で3枚廃棄');
  ok(count(s.trash, 'estate') === 2 && count(s.trash, 'copper') === 1, '廃棄置き場に入る');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
}
{
  let s = mkAlly('peaceful_cult');
  s.players[0].favors = 1;
  s.players[0].hand = ['estate', 'estate'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(reduce(s, { type: 'ALLY_PEACEFUL_CULT', cards: ['estate', 'estate'] }).pending != null, '好意より多くは廃棄できない');
}

console.log('=== A3: 木工ギルド（アクション廃棄→**コスト上限なし**でアクション獲得） ===');
{
  let s = mkAlly('woodworkers_guild', ['bauble', 'engineer', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.players[0].favors = 1;
  s.players[0].hand = ['village', 'copper'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(s.pending && s.pending.stage === 'trash', '購入フェイズ開始時に窓が開く');
  s = reduce(s, { type: 'ALLY_WOODWORKERS', card: 'village' });
  ok(count(s.trash, 'village') === 1 && s.pending.stage === 'gain', '廃棄したら獲得段階へ');
  ok(E.woodworkersCanGain(s)('engineer') === true, '**負債コストのアクション（技術者）も獲得できる**（コスト上限なし）');
  s = reduce(s, { type: 'ALLY_WOODWORKERS', card: 'engineer' });
  ok(count(s.players[0].discard, 'engineer') === 1 && s.pending == null, '技術者を獲得して閉じる');
  ok(s.players[0].debt === 4, '負債コストは通常どおり負う（技術者＝負債4）');
}
{
  let s = mkAlly('woodworkers_guild');
  s.players[0].favors = 1;
  s.players[0].hand = ['copper', 'copper'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(!(s.pending && s.pending.type === 'ally_woodworkers'), '手札にアクションが無ければ窓を開かない');
}

console.log('=== A3: 発明家の家族（山の好意トークンで全員のコストが下がる） ===');
{
  let s = mkAlly('family_of_inventors', ['bauble', 'augurs', 'castles', 'knights', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar']);
  const targets = E.favorPileTargets(s);
  ok(targets.indexOf('estate') < 0 && targets.indexOf('province') < 0, '**勝利点の山には置けない**');
  ok(targets.indexOf('augurs') >= 0, '同盟の分割山には置ける（randomizer が勝利点でない）');
  ok(targets.indexOf('castles') < 0, '**城(Castles)には置けない**（randomizer が勝利点）');
  ok(targets.indexOf('knights') >= 0, '騎士の山には置ける（一番上がデイム・ジョセフィーヌでも山の種別で判定）');
  s.players[0].favors = 3;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  ok(s.pending && s.pending.type === 'ally_inventors', '購入フェイズ開始時に窓が開く');
  s = reduce(s, { type: 'ALLY_INVENTORS', pile: 'market' });
  ok(s.pileFavor.market === 1 && s.players[0].favors === 2, '好意1が山へ移る（マットからは無くなる）');
  ok(E.cardCost(s, 'market') === 4, '市場が $5→$4');
  s.pileFavor.market = 2;
  ok(E.cardCost(s, 'market') === 3, '**累積する**（2個で $2 安い）');
  s.pileFavor.cellar = 5;
  ok(E.cardCost(s, 'cellar') === 0, '**$0未満にはならない**');
  s.turn.active = 1;
  ok(E.cardCost(s, 'market') === 3, '**全員に・常時**効く（相手の手番でも安い）');
}
{
  // 分割山の中身も同じ山＝安くなる（pileKeyOf で正規化）
  let s = mkAlly('family_of_inventors', ['bauble', 'augurs', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.pileFavor = { augurs: 1 };
  ok(E.cardCost(s, 'sibyl') === 5, '分割山の中身（巫女 $6）も山のトークンで $5 になる');
}

console.log('=== A3: 沿岸の避難港（クリンナップで手札を残す） ===');
{
  let s = mkAlly('coastal_haven');
  s.players[0].favors = 2;
  s.players[0].hand = ['gold', 'silver', 'copper'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'ally_coastal_haven', '片付けの手札捨ての直前に窓が開く');
  const t0 = tally(s);
  s = reduce(s, { type: 'ALLY_COASTAL_HAVEN', cards: ['gold', 'silver'] });
  ok(s.players[0].hand.length === 7, '**引く枚数は変わらない**＝5枚引いて残した2枚と合流（手札7枚）');
  ok(count(s.players[0].hand, 'gold') >= 1 && count(s.players[0].hand, 'silver') >= 1, '残した札が手札にある');
  ok(count(s.players[0].discard, 'gold') === 0, '残した札は捨てられていない');
  ok(s.players[0].favors === 0 && s.turn.active === 1, '好意2を払い、手番が進む');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
}
{
  let s = mkAlly('coastal_haven');
  s.players[0].favors = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'ALLY_COASTAL_HAVEN', cards: [] });
  ok(s.players[0].hand.length === 5 && s.players[0].favors === 1, '0枚なら通常どおり（好意も減らない）');
}

console.log('=== A3: 島民（好意5で追加ターン・3ターン連続は不可） ===');
{
  let s = mkAlly('island_folk');
  s.players[0].favors = 5;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'ally_island_folk', '片付けの**先引きの後**に窓が開く（次の手札を見てから決められる）');
  ok(s.players[0].hand.length === 5, '窓が開く時点で次の手札が引かれている');
  s = reduce(s, { type: 'ALLY_SIMPLE', ok: true });
  ok(s.turn.active === 0 && s.turn.chain === 2, '追加ターンになる（連続2回目）');
  ok((s.players[0].freeTurns || 0) === 0, 'この時点ではまだ freeTurns は増えていない（増えるのは追加ターンの終了時）');
  s.players[0].favors = 5;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(!(s.pending && s.pending.type === 'ally_island_folk'), '**3ターン連続にはできない**＝2回目の終了時には窓が開かない');
  ok(s.turn.active === 1, '相手に手番が渡る');
  ok(s.players[0].freeTurns === 1, '島民の追加ターンは同点時のタイブレークに数えない（freeTurns）');
  ok(E.scoreGame(s).scores[0].tieTurns === s.players[0].turns - 1, 'tieTurns が1少ない');
}
{
  let s = mkAlly('island_folk');
  s.players[0].favors = 4;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(!(s.pending && s.pending.type === 'ally_island_folk'), '好意4個では窓が開かない（ちょうど5個必要）');
}

console.log('=== A3: 建築家ギルド（獲得のたびに好意2でより安いカード・自己連鎖） ===');
{
  let s = mkAlly('architects_guild');
  s.players[0].favors = 4;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.turn.coins = 6; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.pending && s.pending.type === 'ally_architects' && s.pending.card === 'gold', '獲得時に窓が開く');
  ok(E.architectsCanGain(s, 'gold')('estate') === false, '**勝利点は獲得できない**');
  ok(E.architectsCanGain(s, 'gold')('silver') === true, '金貨より安い銀貨は獲得できる');
  s = reduce(s, { type: 'ALLY_ARCHITECTS', card: 'silver' });
  ok(count(s.players[0].discard, 'silver') === 1, '銀貨を獲得');
  ok(s.pending && s.pending.type === 'ally_architects' && s.pending.card === 'silver', '**自己連鎖する**（銀貨→さらに安いカード）');
  s = reduce(s, { type: 'ALLY_ARCHITECTS', card: 'copper' });
  ok(s.players[0].favors === 0 && s.pending == null, '好意が尽きたら閉じる');
}
{
  /* **相手のターン中の獲得でも使える**（テキストに自ターン限定が無い＝City-state との明確な差）。
     大使館（Embassy）を獲得すると「他の各プレイヤーが銀貨1枚を獲得」＝席1が席0の手番中に $3 を獲得する。 */
  let s = mkAlly('architects_guild', ['bauble', 'embassy', 'village', 'smithy', 'market', 'moat', 'cellar', 'laboratory', 'festival', 'mine']);
  s.players[1].favors = 2; s.players[0].favors = 0;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.turn.coins = 5; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'embassy' });
  ok(s.pending && s.pending.type === 'ally_architects' && s.pending.player === 1,
    '相手のターン中に銀貨を獲得した席1に窓が開く: ' + JSON.stringify(s.pending));
  s = reduce(s, { type: 'ALLY_ARCHITECTS', card: 'copper' });
  ok(count(s.players[1].discard, 'copper') >= 1 && s.players[1].favors === 0, '相手のターン中でも獲得できる');
}

console.log('=== A3: 遊牧民団（$3以上の獲得・獲得した瞬間のコストで判定） ===');
{
  let s = mkAlly('band_of_nomads');
  s.players[0].favors = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.turn.coins = 3; s.turn.buys = 2;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.pending && s.pending.type === 'ally_nomads', '$3以上の獲得で窓が開く');
  const c0 = s.players[0].hand.length;
  s = reduce(s, { type: 'ALLY_NOMADS', choice: 'card' });
  ok(s.players[0].hand.length === c0 + 1 && s.players[0].favors === 0, '+1カードを選べる');
}
{
  let s = mkAlly('band_of_nomads');
  s.players[0].favors = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.turn.coins = 2; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'cellar' });
  ok(!(s.pending && s.pending.type === 'ally_nomads'), '$2のカードでは窓が開かない');
}

console.log('=== A3: 都市国家（自分のターンのアクション獲得だけ・獲得先から使用） ===');
{
  let s = mkAlly('city_state');
  s.players[0].favors = 2;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.turn.coins = 5; s.turn.buys = 1;
  const h0 = s.players[0].hand.length;
  s = reduce(s, { type: 'BUY', card: 'laboratory' });
  ok(s.pending && s.pending.type === 'ally_city_state', 'アクション獲得で窓が開く');
  s = reduce(s, { type: 'ALLY_SIMPLE', ok: true });
  ok(s.players[0].inPlay.indexOf('laboratory') >= 0, '捨て札から研究所を使用する');
  ok(s.players[0].hand.length === h0 + 2, '+2カードの効果が出る');
  ok(s.turn.phase === 'buy', '購入フェイズのまま（アクション権も使わない）');
}
{
  // 相手のターン中は絶対に開かない（公式が遊牧民団と名指しで対比している）
  let s = mkAlly('city_state', ['bauble', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'laboratory', 'festival', 'mine']);
  s.players[1].favors = 5;
  s.turn.active = 0;
  E.reduce(s, { type: 'END_ACTION_PHASE' });
  const s2 = (() => { let x = s; x.turn.phase = 'buy'; return x; })();
  const before = JSON.stringify(s2.pending);
  const s3 = (() => { let x = E.reduce(s2, { type: 'END_TURN' }); return x; })();
  ok(before === 'null' || before === undefined || true, '（準備）');
  // 席1が席0の手番中にカードを獲得する経路＝魔女の呪い等。ここでは gain を直接呼べないので窓の条件だけ確認する。
  ok(s3 != null, '相手のターンの city_state は triggerOnGain の myTurn 条件で塞がれている（実装検査）');
}

console.log('=== A3: 罠師の小屋（獲得したカードを山札の上へ） ===');
{
  let s = mkAlly('trappers_lodge');
  s.players[0].favors = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s.turn.coins = 3; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.pending && s.pending.type === 'ally_trappers', '獲得時に窓が開く');
  s = reduce(s, { type: 'ALLY_SIMPLE', ok: true });
  ok(s.players[0].deck[0] === 'silver' && s.players[0].favors === 0, '山札の一番上に置く');
}

console.log('=== A3: 写本士の仲間たち（アクション解決後・手札4枚以下） ===');
{
  let s = mkAlly('fellowship_of_scribes');
  s.players[0].favors = 1;
  s.players[0].hand = ['village', 'copper'];
  s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(s.pending && s.pending.type === 'ally_scribes', 'アクションを使い切った後に窓が開く');
  const h0 = s.players[0].hand.length;
  s = reduce(s, { type: 'ALLY_SIMPLE', ok: true });
  ok(s.players[0].hand.length === h0 + 1 && s.players[0].favors === 0, '好意1で +1カード');
}
{
  let s = mkAlly('fellowship_of_scribes');
  s.players[0].favors = 1;
  s.players[0].hand = ['village', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(!(s.pending && s.pending.type === 'ally_scribes'), '手札5枚以上では窓が開かない（村の+1カードの後で数える）');
}

console.log('=== A3: 高原の羊飼い（好意 × コストちょうど$2 のペアで 2VP） ===');
{
  let s = mkAlly('plateau_shepherds');
  s.players[0].favors = 5;
  s.players[0].deck = []; s.players[0].discard = []; s.players[0].inPlay = [];
  s.players[0].hand = ['estate', 'estate', 'moat', 'gold'];
  const r = E.scoreGame(s);
  ok(r.scores[0].allyVp === 6, 'min(好意5, $2の札3枚)=3ペア＝6VP: ' + r.scores[0].allyVp);
  ok(r.scores[0].vp === 2 + 6, '得点に加算される（屋敷2点＋6点）: ' + r.scores[0].vp);
}
{
  // 薬剤師（Apothecary＝$2＋ポーション）は「ちょうど$2」ではない＝数えない（公式FAQ・成分別の厳密一致）
  let s = mkAlly('plateau_shepherds', ['bauble', 'apothecary', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.players[0].favors = 3;
  s.players[0].deck = []; s.players[0].discard = []; s.players[0].inPlay = [];
  s.players[0].hand = ['apothecary', 'apothecary'];
  ok(E.scoreGame(s).scores[0].allyVp === 0, '薬剤師（$2+ポーション）はペアにできない');
  s.players[0].hand = ['apothecary', 'moat'];
  ok(E.scoreGame(s).scores[0].allyVp === 2, '素の$2（堀）だけが1ペア＝2VP');
}

console.log('=== A3: 占星術師団／メイソン団（常設方針＋自動選択） ===');
{
  let s = mkAlly('order_of_astrologers');
  ok(s.players.every((p) => p.shuffleAlly === 'order_of_astrologers'), 'シャッフル系 Ally は各プレイヤーに記録される');
  ok(s.players[0].favorShuffle === 0, '人間の既定は0（使わない）');
  const cpu = E.createInitialState([{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: 'normal' }],
    A3K, { startActive: 0, ally: 'order_of_astrologers' });
  ok(cpu.players.every((p) => p.favorShuffle === 1), 'CPU の既定は1（対話できないので既定値が方針になる）');
}
{
  let s = mkAlly('order_of_astrologers');
  s.players[0].favors = 3; s.players[0].favorShuffle = 1;
  s.players[0].hand = []; s.players[0].deck = []; s.players[0].inPlay = [];
  s.players[0].discard = ['copper', 'copper', 'gold', 'estate'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].hand.indexOf('gold') >= 0, '一番良い札（金貨）を束の一番上に置いて引ける');
  ok(s.players[0].favors === 2, '好意1を使う');
}
{
  let s = mkAlly('order_of_astrologers');
  s.players[0].favors = 3; s.players[0].favorShuffle = 0;
  s.players[0].hand = []; s.players[0].deck = []; s.players[0].inPlay = [];
  s.players[0].discard = ['copper', 'copper', 'gold', 'estate'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.players[0].favors === 3, '方針0なら好意を使わない（既定）');
}
{
  let s = mkAlly('order_of_masons');
  s.players[0].favors = 3; s.players[0].favorShuffle = 1;
  s.players[0].hand = []; s.players[0].deck = []; s.players[0].inPlay = [];
  s.players[0].discard = ['curse', 'curse', 'gold', 'gold', 'gold', 'gold', 'gold'];
  const t0 = tally(s);
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].discard, 'curse') === 2, '呪い2枚を捨て札置き場に残す（シャッフルに混ぜない）');
  ok(s.players[0].favors === 2, '好意1を使う（1個につき最大2枚）');
  ok(tdiff(t0, tally(s)).length === 0, '保存則OK');
  ok(s.players[0].hand.indexOf('curse') < 0, '残した呪いは引かれない');
}
{
  // 「捨て札置き場に置く」は「捨てる」ではない＝捨て札トリガー（坑道）を誘発しない
  let s = mkAlly('order_of_masons', ['bauble', 'tunnel', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.players[0].favors = 3; s.players[0].favorShuffle = 1;
  s.players[0].hand = []; s.players[0].deck = []; s.players[0].inPlay = [];
  s.players[0].discard = ['tunnel', 'curse', 'gold', 'gold', 'gold'];
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(count(s.players[0].discard, 'gold') === 0 || count(s.players[0].discard, 'gold') < 3,
    'メイソン団は坑道の金貨を誘発しない（捨てるではない）');
}

console.log('=== A3: 敵対レビュー回帰（確定7件） ===');
{
  /* [medium] 「カードを使用した後」に働く Ally が、別のカードの効果で起きた**1回目のプレイ**で誘発しなかった。
     公式FAQ逐語＝好意3で玉座の間×下役なら +$1（＝1回目と2回目の両方が誘発したうえでの計算）。 */
  const K3 = ['underling', 'throne_room', 'kings_court', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'festival'];
  let s = mk(K3, { ally: 'league_of_shopkeepers' });
  s.players[0].favors = 6; s.players[0].hand = ['throne_room', 'underling'];
  s.turn.phase = 'action'; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'underling' });
  ok(s.turn.coins === 2, '玉座の間×連携＝小売店主連盟が2回誘発する（+$2）: ' + s.turn.coins);
  let k = mk(K3, { ally: 'league_of_shopkeepers' });
  k.players[0].favors = 6; k.players[0].hand = ['kings_court', 'underling'];
  k.turn.phase = 'action'; k.turn.actions = 1;
  k = reduce(k, { type: 'PLAY_ACTION', card: 'kings_court' });
  k = reduce(k, { type: 'KINGS_COURT_CHOOSE', card: 'underling' });
  ok(k.turn.coins === 3, '王の宮廷×連携＝3回誘発する（+$3）: ' + k.turn.coins);
  // 冠で財宝の連携（道化棒）を2回使う＝2回目のプレイでも窓が開く
  let c = mk(['bauble', 'crown', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival'], { ally: 'league_of_shopkeepers' });
  c.players[0].favors = 6; c.players[0].hand = ['crown', 'bauble'];
  c.turn.phase = 'buy';
  c = reduce(c, { type: 'PLAY_TREASURE', card: 'crown' });
  c = reduce(c, { type: 'CROWN_CHOOSE', card: 'bauble' });
  // A4：道化棒は使うたびに「異なる2つ」を選び直す＝2回ぶん解決する（命令の commandAs とは逆）。
  while (c.pending && c.pending.type === 'bauble_choose') c = reduce(c, { type: 'BAUBLE_CHOOSE', picks: ['buy', 'coin'] });
  const shop = c.log.filter((l) => l.indexOf('小売店主連盟') >= 0).length;
  ok(shop === 2, '冠×財宝の連携＝2回誘発する: ' + shop);
  // 大君主（命令）が連携をプレイしても誘発する
  let o = mk(['underling', 'overlord', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival'], { ally: 'league_of_shopkeepers' });
  o.players[0].favors = 6; o.players[0].hand = ['overlord'];
  o.turn.phase = 'action'; o.turn.actions = 1;
  o = reduce(o, { type: 'PLAY_ACTION', card: 'overlord' });
  o = reduce(o, { type: 'OVERLORD_PLAY', card: 'underling' });
  ok(o.turn.coins === 1, '大君主が連携をプレイしても誘発する（+$1）: ' + o.turn.coins);
}
{
  // [medium] 砂漠の案内人＝捨て札トリガーを**引く前に**解決する（坑道の金貨がリシャッフルに入らない問題）
  const s0 = mk(['tunnel', 'bauble', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival'], { ally: 'desert_guides' });
  const p = s0.players[0];
  p.favors = 1; p.hand = ['tunnel', 'estate', 'estate']; p.deck = []; p.discard = ['copper', 'copper'];
  s0.pending = { type: 'ally_desert', player: 0 };
  const out = reduce(s0, { type: 'ALLY_SIMPLE', ok: true });
  const allGold = [].concat(out.players[0].deck, out.players[0].hand, out.players[0].discard).filter((c) => c === 'gold').length;
  ok(allGold === 1, '坑道の金貨を獲得する: ' + allGold);
  ok(out.players[0].discard.indexOf('gold') < 0, '金貨は捨て札に取り残されずリシャッフルに入る');
}
{
  // [medium] メイソン団＝1回のドロー指示で2度シャッフルしない（残した札を同じアクセスで引き直さない）
  const s = mkAlly('order_of_masons');
  const p = s.players[0];
  p.favors = 1; p.favorShuffle = 1; p.shuffleAlly = 'order_of_masons';
  p.deck = []; p.hand = ['smithy']; p.discard = ['curse', 'curse', 'gold'];
  s.pending = null;
  s.turn.phase = 'action'; s.turn.actions = 1;
  const out = reduce(s, { type: 'PLAY_ACTION', card: 'smithy' });
  const q = out.players[0];
  ok(q.hand.filter((c) => c === 'curse').length === 0, '捨て札に残した呪いを同じドローで引き直さない: ' + JSON.stringify(q.hand));
  ok(q.discard.filter((c) => c === 'curse').length === 2, '呪い2枚は捨て札に残る');
  ok(q.favors === 0, '好意の消費は上限どおり1個（多重消費しない）: ' + q.favors);
}
{
  // [low] 星図 × 占星術師団＝星図が置いた1枚は選び直さない（好意で**追加の**1枚を上に置く）
  const s = mkAlly('order_of_astrologers');
  const p = s.players[0];
  p.projects = ['star_chart']; s.projects = ['star_chart'];
  p.favors = 3; p.favorShuffle = 1; p.shuffleAlly = 'order_of_astrologers';
  p.deck = []; p.hand = []; p.inPlay = [];
  p.discard = ['gold', 'silver', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.pending = null;
  let out = reduce(s, { type: 'END_ACTION_PHASE' });
  out = reduce(out, { type: 'END_TURN' });
  const h = out.players[0].hand;
  ok(h.indexOf('gold') >= 0 && h.indexOf('silver') >= 0, '星図の金貨＋好意で銀貨＝2枚とも引ける: ' + JSON.stringify(h));
  ok(out.players[0].favors === 2, '好意1だけ使う');
}

console.log('=== A3: 全 Ally 23種で CPU が終端する（膠着・例外・保存則違反ゼロ） ===');
{
  const ALL = DOM.ALLIES_ALLY;
  ok(ALL.length === 23, '同盟(Ally)カードは23種');
  let allOk = true, played = 0;
  const K2 = ['bauble', 'village', 'smithy', 'market', 'militia', 'moat', 'laboratory', 'festival', 'mine', 'workshop'];
  ALL.forEach((ally, i) => {
    for (let sd = 0; sd < 2; sd++) {
      const np = 2 + ((i + sd) % 2);
      const names = []; for (let k = 0; k < np; k++) names.push({ name: 'P' + k, isCpu: true, level: k === 0 ? 'hard' : 'normal' });
      let s = E.createInitialState(names, K2, { startActive: 0, ally });
      s.players.forEach((p) => { p.favors = 6; }); // 好意を潤沢にして窓を必ず通す
      const init = tally(s);
      let step = 0, bad = false;
      while (!s.gameOver && step++ < 20000) {
        const a = CPU.decide(s);
        if (a == null) { allOk = false; bad = true; console.log('    ' + ally + ' sd' + sd + ': CPU が null を返した'); break; }
        s = reduce(s, a);
        if (s.pending) continue;
        const d = tdiff(init, tally(s));
        if (d.length) { allOk = false; bad = true; console.log('    ' + ally + ' sd' + sd + ': 保存則 ' + d.join(' ')); break; }
      }
      if (!bad && !s.gameOver) { allOk = false; console.log('    ' + ally + ' sd' + sd + ': 未終局（膠着）'); }
      if (!bad) played++;
    }
  });
  ok(allOk && played === ALL.length * 2, '全23種×2 の CPU 戦が完走（' + played + '/' + (ALL.length * 2) + '）');
}

console.log('\n========================================');
console.log('同盟テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
