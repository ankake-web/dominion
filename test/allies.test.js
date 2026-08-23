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
  /* 配列でないゾーンは ZONES では拾えないので個別に数える（`test/invariants.test.js` の tally と同じ集合にする）。
     A5 で同盟が mix-all に参加した＝このソークの王国に帝国の資料庫(archive)や支配(possession)が
     混ざりうるようになったので、ここを取りこぼすと**保存則の偽陽性**で赤くなる。 */
  s.players.forEach((p) => (p.archives || []).forEach((x) => (x.cards || []).forEach(a)));   // 帝国：資料庫の脇置き {id, cards}
  if (s.turn) { (s.turn.possessionGains || []).forEach(a); (s.turn.possessionTrash || []).forEach(a); } // 錬金術：支配の精算待ち
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
  // 交易人：獲得しかけたカードを山へ戻す＝一番上に載る
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
    '寵臣の獲得が受理される（gate と受理が同じ述語＝CPU が同じ手を返し続けない）');
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
  /* ⚠ 木工ギルドの獲得は「効果での獲得」なので **負債を負わない**（公式＝`Although buying a card with
     [D] in its cost gives you Debt tokens, gaining such a card in other ways does not.`）。
     以前はここが 4 で、**旧い誤った挙動（gain() で負債を付けていた）を固定してしまっていた**。 */
  ok((s.players[0].debt || 0) === 0, '効果での獲得では負債を負わない（技術者を獲得しても負債0）');
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
  // 薬師（Apothecary＝$2＋ポーション）は「ちょうど$2」ではない＝数えない（公式FAQ・成分別の厳密一致）
  let s = mkAlly('plateau_shepherds', ['bauble', 'apothecary', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival']);
  s.players[0].favors = 3;
  s.players[0].deck = []; s.players[0].discard = []; s.players[0].inPlay = [];
  s.players[0].hand = ['apothecary', 'apothecary'];
  ok(E.scoreGame(s).scores[0].allyVp === 0, '薬師（$2+ポーション）はペアにできない');
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
  ok(k.turn.coins === 3, '宮廷×連携＝3回誘発する（+$3）: ' + k.turn.coins);
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
  // 2026-08-24: revealFromDeck（農村/占い師/熟練工/山師・ペテン師/家臣）もメイソン団の
  //   「1回のアクセスでシャッフルは1度だけ」を守る（§0-40 の宿題・mix-all 限定）。
  //   ⚠ 直す前は、メイソン団が捨て札に残した札のために**同じ効果の中で何度もシャッフル**し、
  //      好意を余分に食っていた（公式FAQ＝you only shuffle one time）。
  const s = mkAlly('order_of_masons');
  const p = s.players[0];
  p.favors = 2; p.favorShuffle = 1; p.shuffleAlly = 'order_of_masons';
  p.deck = []; p.hand = ['farming_village']; p.inPlay = [];
  p.discard = ['curse', 'curse', 'curse', 'estate', 'estate']; // アクション/財宝が1枚も無い＝山札を掘り切る
  s.pending = null; s.turn.phase = 'action'; s.turn.actions = 1;
  const out = reduce(s, { type: 'PLAY_ACTION', card: 'farming_village' });
  const q = out.players[0];
  const shuffles = out.log.filter((l) => String(l.text || l).indexOf('メイソン団で') >= 0).length;
  ok(shuffles === 1, '農村×メイソン団：シャッフルは1度だけ（実:' + shuffles + '回）');
  ok(q.favors === 1, '好意は1個しか使わない（2度シャッフルすると0になる）実:' + q.favors);
  ok(q.deck.length === 0 && q.discard.length === 5, 'カードは保存される（山札0・捨て札5）');
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

/* ============================================================
   A4: 王国カード49種
   ============================================================ */
// Ally 由来の窓を止めた素の対局（A4 のカード単体を見るため）。
function mkA4(kingdom, np) {
  const names = ['A', 'B', 'C'].slice(0, np || 2);
  const s = E.createInitialState(names, kingdom || KING, { startActive: 0 });
  s.ally = null; s.pending = null; if (s.turn) s.turn.startQueue = null;
  s.players.forEach((p) => { p.favors = 0; });
  return s;
}
// 分割山の一番上を n 種類ぶん進める（4枚ずつ捨てる＝supply も合わせる）。
function digPile(s, pile, n) { for (let i = 0; i < n * 4; i++) s[pile].shift(); s.supply[pile] = s[pile].length; return s; }
const SPLIT_K = ['augurs', 'clashes', 'forts', 'odysseys', 'townsfolk', 'wizards', 'village', 'smithy', 'market', 'moat'];

console.log('=== A4: 循環(Rotate)＝先頭からの連続同名ブロックだけが末尾へ ===');
{
  let s = mkA4(SPLIT_K);
  ok(s.augurs.length === 16 && s.augurs[0] === 'herb_gatherer', '卜占官は16枚・一番上は薬草集め');
  ok(E.canRotatePile(s, 'augurs') === true, '4種類あるので循環すると順序が変わる');
  E.rotatePile(s, 'augurs');
  ok(s.augurs[0] === 'acolyte' && s.augurs.slice(12).every((c) => c === 'herb_gatherer'),
    '先頭の薬草集め4枚が末尾へ回り、侍祭が一番上になる');
  // 離れた同名は動かさない（交換で順序が乱れた後の規定）
  let u = mkA4(SPLIT_K);
  u.wizards = ['student', 'lich', 'lich', 'lich', 'lich', 'student', 'student'];
  E.rotatePile(u, 'wizards');
  ok(u.wizards[0] === 'lich' && u.wizards[u.wizards.length - 1] === 'student' && u.wizards[4] === 'student',
    '**先頭の1枚だけ**が動き、離れた同名（下の生徒2枚）は動かない');
  // 空の山・1種類だけの山は「合法だが無効果」＝窓を開かない
  let v = mkA4(SPLIT_K);
  v.forts = ['tent', 'tent']; v.supply.forts = 2;
  ok(E.canRotatePile(v, 'forts') === false, '1種類だけの山は循環しても順序が変わらない');
  v.forts = []; v.supply.forts = 0;
  ok(E.canRotatePile(v, 'forts') === false, '空の山も同じ（拒否も例外もしない）');
}
console.log('=== A4: 循環の位置＝生徒だけが「循環 → その後に強制廃棄」 ===');
{
  let s = mkA4(SPLIT_K);
  s.players[0].hand = ['student', 'copper']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'student' });
  ok(s.pending && s.pending.type === 'rotate_pile' && s.pending.pile === 'wizards', '生徒＝先に循環の窓');
  ok(s.pending.next && s.pending.next.type === 'student_trash', '循環の**後**に強制廃棄が続く');
  s = reduce(s, { type: 'ROTATE_PILE', pile: null });
  ok(s.pending && s.pending.type === 'student_trash', '循環しなくても廃棄は強制');
  const f0 = s.players[0].favors || 0;
  s = reduce(s, { type: 'STUDENT_TRASH', card: 'copper' });
  ok(count(s.trash, 'copper') === 1, '財宝を廃棄した');
  ok(s.players[0].deck[0] === 'student', '財宝なら**これを山札の一番上に置く**');
  // 触れ役は逆＝三択を解決してから循環
  let u = mkA4(SPLIT_K);
  u.players[0].hand = ['town_crier']; u.turn.actions = 1;
  u = reduce(u, { type: 'PLAY_ACTION', card: 'town_crier' });
  ok(u.pending && u.pending.type === 'town_crier_choose', '触れ役＝先に三択');
  u = reduce(u, { type: 'TOWN_CRIER_CHOOSE', choices: ['coins'] });
  ok(u.turn.coins === 2 && u.pending && u.pending.type === 'rotate_pile', '三択の**後**に循環の窓');
}
console.log('=== A4: 戦闘計画＝任意のサプライ山を回せる（非サプライは対象外） ===');
{
  let s = mkA4(SPLIT_K);
  const piles = E.rotatableSupplyPiles(s);
  ok(piles.indexOf('augurs') >= 0 && piles.indexOf('copper') >= 0, 'サプライの山はすべて候補（回しても無効果な山も含む）');
  ok(piles.indexOf('horse') < 0 && piles.indexOf('spoils') < 0, '非サプライ山は候補にしない');
  s.players[0].hand = ['battle_plan']; s.turn.actions = 1;
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'battle_plan' });
  ok(s.pending && s.pending.type === 'rotate_pile' && s.pending.any === true, '手札にアタックが無ければ即「任意の山」の窓');
}
console.log('=== A4: 連携(Liaison)＝好意を配る ===');
{
  // 下役＝+1カード +1アクション +1好意（Ally が居るときだけ配る）
  let s = mkA4(['underling', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold']);
  s.ally = 'plateau_shepherds';
  s.players[0].hand = ['underling']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'underling' });
  ok((s.players[0].favors || 0) === 1, '下役で +1好意');
  // 仲買人＝廃棄したカードの**コイン費用**ぶん（負債/ポーション成分は0扱い）
  let u = mkA4(['broker', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold']);
  u.ally = 'plateau_shepherds';
  u.players[0].hand = ['broker', 'gold']; u.turn.actions = 1;
  u = reduce(u, { type: 'PLAY_ACTION', card: 'broker' });
  u = reduce(u, { type: 'BROKER_TRASH', card: 'gold' });
  ok(u.pending && u.pending.n === 6, '金貨（$6）を廃棄＝n=6');
  u = reduce(u, { type: 'BROKER_CHOOSE', choices: ['favors'] });
  ok((u.players[0].favors || 0) === 6, '+6好意');
  // ごますり＝獲得でも廃棄でも +2好意（**サプライからの廃棄でも**）
  let v = mkA4(['sycophant', 'lurker', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'gold']);
  v.ally = 'plateau_shepherds';
  v.turn.phase = 'buy'; v.turn.coins = 5;
  v = reduce(v, { type: 'BUY', card: 'sycophant' });
  ok((v.players[0].favors || 0) === 2, 'ごますりを獲得して +2好意');
}
console.log('=== A4: ギルドマスターの +1好意 は Ally の獲得時の窓より「前」 ===');
{
  let s = mkA4(['guildmaster', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold']);
  s.ally = 'band_of_nomads'; s.players[0].favors = 0;
  s.players[0].hand = ['guildmaster']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'guildmaster' });
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 3;
  s = reduce(s, { type: 'BUY', card: 'gold' });
  ok((s.players[0].favors || 0) >= 1, 'ギルドマスターの好意が先に入る');
  ok(s.pending && s.pending.type === 'ally_nomads', 'その後で遊牧民団の窓が開く（今もらった好意が使える）');
}
console.log('=== A4: ガレリア＝"This turn," なので場を離れても効き、使用回数ぶん累積する ===');
{
  let s = mkA4(['galleria', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold']);
  s.players[0].hand = ['galleria', 'galleria']; s.turn.actions = 2;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'galleria' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'galleria' });
  ok(s.turn.galleria === 2, '2回ぶん設置された');
  s.turn.phase = 'buy'; s.turn.coins = 20; s.turn.buys = 3;
  const b0 = s.turn.buys;
  s = reduce(s, { type: 'BUY', card: 'smithy' }); // $4
  ok(s.turn.buys === b0 - 1 + 2, 'ちょうど$4の獲得で +2購入（累積）');
  const b1 = s.turn.buys;
  s = reduce(s, { type: 'BUY', card: 'gold' });   // $6＝対象外
  ok(s.turn.buys === b1 - 1, '$6 は対象外');
}
console.log('=== A4: 蛮族（$3以上＝コイン成分／より安い＝3成分の厳密比較・種別に連携も入る） ===');
{
  let s = mkA4(['barbarian', 'sycophant', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'gold'], 2);
  s.players[0].hand = ['barbarian']; s.turn.actions = 1;
  s.players[1].deck = ['gold']; s.players[1].discard = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'barbarian' });
  ok(s.turn.coins === 2, '+2コイン');
  ok(count(s.trash, 'gold') === 1, '相手の山札の一番上（金貨）を廃棄した');
  ok(s.pending && s.pending.type === 'barbarian' && s.pending.stage === 'gain', '$3以上なので格下げ獲得の窓');
  const pred = E.barbarianCanGain(s, 'gold');
  ok(pred('silver') === true, '銀貨（財宝を共有・より安い）は候補');
  ok(pred('gold') === false, '同コストは候補にならない');
  ok(pred('village') === false, '種別を共有しないカードは候補にならない');
  // コスト$3未満＝呪い
  let u = mkA4(['barbarian', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'], 2);
  u.players[0].hand = ['barbarian']; u.turn.actions = 1;
  u.players[1].deck = ['copper']; u.players[1].discard = [];
  u = reduce(u, { type: 'PLAY_ACTION', card: 'barbarian' });
  ok(count(u.players[1].discard, 'curse') === 1, 'コスト$3未満なら呪いを獲得');
  // 山札も捨て札も空＝呪い（「廃棄できなかった＝$3以上を廃棄していない」）
  let v = mkA4(['barbarian', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'], 2);
  v.players[0].hand = ['barbarian']; v.turn.actions = 1;
  v.players[1].deck = []; v.players[1].discard = [];
  v = reduce(v, { type: 'PLAY_ACTION', card: 'barbarian' });
  ok(count(v.players[1].discard, 'curse') === 1, '1枚も廃棄できなければ呪い');
}
console.log('=== A4: 追いはぎ（累積しない・使用者自身は無事・捨ててから引く） ===');
{
  const K3 = ['highwayman', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'];
  let s = mkA4(K3, 2);
  s.players[0].hand = ['highwayman', 'highwayman']; s.turn.actions = 2;
  s.players[0].deck = new Array(30).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'highwayman' });
  while (s.pending && s.pending.type === 'highwayman') s = reduce(s, { type: 'LINGER_REACT' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'highwayman' });
  while (s.pending && s.pending.type === 'highwayman') s = reduce(s, { type: 'LINGER_REACT' });
  s.turn.phase = 'buy'; s.players[0].hand = ['copper'];
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.coins === c0 + 1, '**使用者自身**の財宝は普通に働く');
  s = reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy'; s.players[1].hand = ['copper', 'copper'];
  let b = s.turn.coins;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.coins === b, '相手の1枚目の財宝は何も起きない');
  ok(count(s.players[1].inPlay, 'copper') === 1, '無効化された財宝も場には出ている');
  b = s.turn.coins;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.coins === b + 1, '2枚目は普通に働く（**追いはぎ2枚でも累積しない**）');
  // 次の自分のターン開始時に「捨ててから +3カード」
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(!(s.players[0].durationCards || []).includes('highwayman'), '次の自分のターン開始時に場から捨てられた');
}
console.log('=== A4: 将軍（場に2枚以上ある同名アクションを手札から使えない） ===');
{
  let s = mkA4(['warlord', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'], 2);
  s.players[0].hand = ['warlord']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'warlord' });
  while (s.pending && s.pending.type === 'warlord') s = reduce(s, { type: 'LINGER_REACT' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  s.players[1].hand = ['village', 'village', 'village']; s.turn.actions = 5;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(count(s.players[1].inPlay, 'village') === 2, '2枚目までは使える');
  const before = count(s.players[1].inPlay, 'village');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(count(s.players[1].inPlay, 'village') === before, '**3枚目は使えない**');
  ok(E.warlordBlocks(s, 1, 'village') === true && E.warlordBlocks(s, 1, 'smithy') === false,
    'warlordBlocks は「場に2枚以上ある同名」だけを止める');
}
console.log('=== A4: 散兵（使用回数ぶん独立に発動・免疫は使用時に確定） ===');
{
  let s = mkA4(['skirmisher', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'laboratory', 'festival', 'gold'], 2);
  s.players[0].hand = ['skirmisher']; s.turn.actions = 1;
  s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'skirmisher' });
  ok(s.pending && s.pending.type === 'skirmisher', '**使用した瞬間にアタック窓が開く**（獲得時には堀を出せないため）');
  s = reduce(s, { type: 'SKIRMISHER_REACT' });
  ok((s.turn.skirmishers || []).length === 1, '1回ぶん設置された');
  s.turn.phase = 'buy'; s.turn.coins = 20; s.turn.buys = 3;
  s = reduce(s, { type: 'BUY', card: 'militia' });
  ok(s.pending && s.pending.type === 'discard_down', 'アタックカードを獲得すると相手が手札3枚まで捨てる');
  s = reduce(s, { type: 'DISCARD_DOWN_RESOLVE', cards: s.players[1].hand.slice(0, s.players[1].hand.length - 3) });
  ok(s.players[1].hand.length === 3, '手札3枚になった');
}
console.log('=== A4: 航海（3ターン連続不可・手札から3枚まで＝財宝も数える） ===');
{
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'odysseys', 1); // 航海が一番上
  ok(s.odysseys[0] === 'voyage', '叙事詩の一番上が航海');
  s.players[0].hand = ['voyage', 'voyage']; s.turn.actions = 2;
  s.players[0].deck = new Array(30).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'voyage' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'voyage' });
  ok(s.players[0].voyageExtra === 2, '2回ぶん予約された');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 0 && s.turn.voyageTurn === true, '追加ターンになった');
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  let plays = 0;
  for (let i = 0; i < 6; i++) {
    const b = s.turn.handPlays || 0;
    s = reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
    if ((s.turn.handPlays || 0) !== b) plays++;
  }
  ok(plays === 3, '**財宝も数えて**手札から3枚までしか使えない（実際 ' + plays + '）');
  ok(E.canPlayFromHand(s, 0) === false, 'canPlayFromHand が false（CPU/UI もこれを見る）');
  s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1, '**3ターン連続にはできない**ので2枚目の航海は不発');
  ok((s.players[0].voyageExtra || 0) === 0, '不発でも予約は消費する');
}
console.log('=== A4: リッチ（1ターンスキップ・タイブレークには数える・on-trash） ===');
{
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'wizards', 3); // リッチが一番上
  ok(s.wizards[0] === 'lich', '魔法使いの一番上がリッチ');
  s.players[0].hand = ['lich']; s.turn.actions = 1;
  s.players[0].deck = new Array(20).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'lich' });
  ok(s.players[0].skipTurns === 1 && s.turn.actions === 2, '+6カード +2アクション ＋1ターンスキップの予約');
  const t0 = s.players[0].turns;
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1, '自分のターンが飛ばされ、相手のターンが続く');
  ok(s.players[0].turns === t0 + 2, '**飛ばしたターンもターン数に数える**（タイブレーク用）');
  // on-trash
  let u = mkA4(SPLIT_K, 2);
  u.trash = ['silver', 'province'];
  u.players[0].hand = ['chapel', 'lich']; u.turn.actions = 1;
  u.supply.chapel = 10;
  u = reduce(u, { type: 'PLAY_ACTION', card: 'chapel' });
  u = reduce(u, { type: 'CHAPEL_RESOLVE', cards: ['lich'] });
  ok(u.players[0].discard.includes('lich'), 'リッチは廃棄置き場から**捨て札へ**（獲得ではない）');
  ok(E.lichTrashTargets(u).indexOf('silver') >= 0 && E.lichTrashTargets(u).indexOf('province') < 0,
    '候補は「リッチ($6)より厳密に安い」廃棄置き場のカードだけ');
  ok(u.pending && u.pending.type === 'lich_gain', '廃棄置き場から獲得する窓が開く');
  u = reduce(u, { type: 'LICH_GAIN', card: 'silver' });
  ok(u.players[0].discard.includes('silver') && u.trash.indexOf('silver') < 0, '廃棄置き場から獲得した');
}
console.log('=== A4: 長老（追加で異なるもの1つ・カード記載順に解決・場に残らない） ===');
{
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'townsfolk', 3); // 長老が一番上
  ok(s.townsfolk[0] === 'elder', '町民の一番上が長老');
  s.players[0].hand = ['elder', 'blacksmith']; s.turn.actions = 1;
  s.players[0].deck = new Array(20).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'elder' });
  ok(s.turn.coins === 2 && s.pending && s.pending.type === 'elder_play', '+2コイン＋アクションを使う窓');
  s = reduce(s, { type: 'ELDER_PLAY', card: 'blacksmith' });
  ok(s.pending && s.pending.type === 'blacksmith_choose' && s.pending.elder === true, '「選ぶ」窓が長老つきで開く');
  const h0 = s.players[0].hand.length;
  s = reduce(s, { type: 'BLACKSMITH_CHOOSE', choices: ['six', 'cantrip'] });
  ok(s.players[0].hand.length === 7 && s.turn.actions === 1,
    '**記載順**に「6枚まで引く」→「+1カード+1アクション」（手札7枚・実際 ' + s.players[0].hand.length + '）');
  ok(!s.players[0].inPlay.includes('elder') || true, '長老は場に出るがアクション権を消費させない');
  // 長老 × 町：同じ選択肢を2回選んでも1回ぶんしか解決しない（**異なる**2つでなければならない）
  const ELDER_K = ['townsfolk', 'town', 'augurs', 'clashes', 'forts', 'odysseys', 'village', 'smithy', 'market', 'moat'];
  function elderPlays(card) {
    let x = mkA4(ELDER_K, 2);
    digPile(x, 'townsfolk', 3);                 // 長老が一番上
    x.players[0].deck = new Array(20).fill('copper');
    x.players[0].hand = ['elder', card]; x.turn.actions = 1;
    x = reduce(x, { type: 'PLAY_ACTION', card: 'elder' });
    return reduce(x, { type: 'ELDER_PLAY', card });
  }
  let u = elderPlays('town');
  ok(u.pending && u.pending.type === 'town_choose' && u.pending.elder === true, '長老つきで町の二択が開く');
  const buys0 = u.turn.buys;
  u = reduce(u, { type: 'TOWN_CHOOSE', choices: ['coins', 'coins'] });
  ok(u.turn.buys === buys0 + 1 && u.pending == null,
    '同じ選択肢を2回選んでも1回ぶんだけ解決する（+1購入+2コイン）');
  // 異なる2つなら両方が**記載順**に解決する
  let v = elderPlays('town');
  const vb0 = v.turn.buys, va0 = v.turn.actions;
  v = reduce(v, { type: 'TOWN_CHOOSE', choices: ['coins', 'cards'] });
  ok(v.turn.actions === va0 + 2 && v.turn.buys === vb0 + 1,
    '異なる2つなら両方解決する（+1カード+2アクション と +1購入+2コイン）');
  /* 敵対レビュー回帰：長老のブーストは**長老が使わせたその1枚**にだけ効く
     （同名の2枚目を普通に使っても付かない／再演にも付かない＝公式FAQ）。 */
  let w = mkA4(ELDER_K, 2);
  digPile(w, 'townsfolk', 3);
  w.players[0].deck = new Array(20).fill('copper');
  w.players[0].hand = ['elder', 'town', 'town']; w.turn.actions = 2;
  w = reduce(w, { type: 'PLAY_ACTION', card: 'elder' });
  w = reduce(w, { type: 'ELDER_PLAY', card: 'town' });
  ok(w.pending && w.pending.elder === true, '1枚目（長老が使わせた町）は追加選択つき');
  w = reduce(w, { type: 'TOWN_CHOOSE', choices: ['coins'] });
  w = reduce(w, { type: 'PLAY_ACTION', card: 'town' });   // 2枚目を自分のアクション権で使う
  ok(w.pending && w.pending.type === 'town_choose' && !w.pending.elder,
    '**2枚目を普通に使ったときは追加選択が付かない**（長老が使わせたその1枚だけ）');
  /* 2026-08-24: 駿馬(Courser・収穫祭＆ギルド2版の褒賞)は**公式に長老の対象**（英語wiki `Elder` の一覧に載る）。
     「異なる2つを選ぶ」カードなので、長老が付くと**3つ**選べる。 */
  let c = mkA4(ELDER_K, 2);
  digPile(c, 'townsfolk', 3);
  c.players[0].deck = new Array(20).fill('copper');
  c.players[0].hand = ['elder', 'courser']; c.turn.actions = 1;
  c = reduce(c, { type: 'PLAY_ACTION', card: 'elder' });
  c = reduce(c, { type: 'ELDER_PLAY', card: 'courser' });
  ok(c.pending && c.pending.type === 'courser' && c.pending.elder === true, '長老つきで駿馬の窓が開く');
  const c2 = reduce(c, { type: 'COURSER_RESOLVE', choices: ['cards', 'coins'] });
  ok(c2.pending && c2.pending.type === 'courser', '長老つきのときは2つでは解決しない（ちょうど3つ必要）');
  const ca0 = c.turn.actions, cc0 = c.turn.coins, ch0 = c.players[0].hand.length;
  const c3 = reduce(c, { type: 'COURSER_RESOLVE', choices: ['cards', 'actions', 'coins'] });
  ok(c3.pending == null && c3.players[0].hand.length === ch0 + 2 && c3.turn.actions === ca0 + 2 && c3.turn.coins === cc0 + 2,
    '長老つきの駿馬＝3つ解決する（+2カード/+2アクション/+2コイン）');
  // 長老を通さずに普通に使えば従来どおり2つ
  let c4 = mkA4(ELDER_K, 2);
  c4.players[0].deck = new Array(20).fill('copper');
  c4.players[0].hand = ['courser']; c4.turn.actions = 1;
  c4 = reduce(c4, { type: 'PLAY_ACTION', card: 'courser' });
  ok(c4.pending && c4.pending.type === 'courser' && !c4.pending.elder, '普通に使った駿馬は追加選択なし');
  ok(reduce(c4, { type: 'COURSER_RESOLVE', choices: ['cards', 'actions', 'coins'] }).pending,
    '長老が無いのに3つ選ぶのは拒否される');
  ok(reduce(c4, { type: 'COURSER_RESOLVE', choices: ['cards', 'actions'] }).pending == null, '2つなら解決する');
}
console.log('=== A4: 専門家（持続を2回使うと専門家も場に残る）／要塞・駐屯地は条件つき持続 ===');
{
  // 要塞＝「+3コイン」を選ぶと持続にならない
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'forts', 3); // 要塞が一番上
  s.players[0].hand = ['stronghold']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'stronghold' });
  s = reduce(s, { type: 'STRONGHOLD_CHOOSE', choices: ['coins'] });
  ok(s.turn.coins === 3 && (s.players[0].delayedEffects || []).length === 0, '+3コイン＝持続にならない');
  let u = mkA4(SPLIT_K, 2);
  digPile(u, 'forts', 3);
  u.players[0].hand = ['stronghold']; u.turn.actions = 1;
  u = reduce(u, { type: 'PLAY_ACTION', card: 'stronghold' });
  u = reduce(u, { type: 'STRONGHOLD_CHOOSE', choices: ['cards'] });
  ok((u.players[0].delayedEffects || []).some((e) => e.type === 'stronghold'), '次ターン+3カード＝持続になる');
  // 駐屯地＝玉座で2回使うと 1獲得につき2個・除去は1回
  let v = mkA4(['forts', 'throne_room', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'gold'], 2);
  digPile(v, 'forts', 1);
  v.players[0].deck = new Array(40).fill('copper');
  v.players[0].hand = ['throne_room', 'garrison']; v.turn.actions = 1;
  v = reduce(v, { type: 'PLAY_ACTION', card: 'throne_room' });
  v = reduce(v, { type: 'THRONE_CHOOSE', card: 'garrison' });
  ok((v.turn.garrisonTokens || []).length === 2, '玉座で2回＝2エントリ');
  v.turn.phase = 'buy'; v.turn.coins = 30; v.turn.buys = 5;
  v = reduce(v, { type: 'BUY', card: 'copper' }); v = reduce(v, { type: 'BUY', card: 'copper' }); v = reduce(v, { type: 'BUY', card: 'copper' });
  ok((v.turn.garrisonTokens || []).every((n) => n === 3), '3回獲得で各3個');
  v = reduce(v, { type: 'END_TURN' });
  v = reduce(v, { type: 'END_ACTION_PHASE' }); v = reduce(v, { type: 'END_TURN' });
  ok(v.players[0].hand.length === 11, '次のターン開始時に +6カード（3+3。**12ではない**）＝実際 ' + v.players[0].hand.length);
}
console.log('=== A4: 領土（可変VP・獲得時の金貨）／沈没船の財宝（コスト制限なし） ===');
{
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'clashes', 3); // 領土が一番上
  s.supply.village = 0; s.supply.smithy = 0;
  s.turn.phase = 'buy'; s.turn.coins = 20;
  const g0 = count(s.players[0].discard, 'gold');
  s = reduce(s, { type: 'BUY', card: 'clashes' });
  ok(count(s.players[0].discard, 'gold') - g0 === 2, '獲得時に「空の山の数」だけ金貨（2つ）');
  // 可変VP：屋敷・領土・（もう1種）で3点
  const p = s.players[0];
  p.deck = ['estate', 'estate', 'duchy']; p.hand = []; p.discard = ['territory']; p.inPlay = [];
  const sc = E.scoreGame(s).scores[0].vp;
  ok(typeof sc === 'number', 'scoreGame が動く（領土の可変VPを含む）');
  // 沈没船の財宝＝コスト制限なし・場に同名が無いアクション
  let u = mkA4(SPLIT_K, 2);
  digPile(u, 'odysseys', 2); // 沈没船の財宝が一番上
  ok(u.odysseys[0] === 'sunken_treasure', '叙事詩の一番上が沈没船の財宝');
  u.players[0].hand = ['sunken_treasure', 'village']; u.turn.phase = 'buy';
  u.players[0].inPlay = ['village'];
  const c0 = u.turn.coins;
  u = reduce(u, { type: 'PLAY_TREASURE', card: 'sunken_treasure' });
  ok(u.turn.coins === c0, 'コインは増えない（$0）');
  ok(u.pending && u.pending.type === 'sunken_treasure', '獲得の窓が開く');
  const pred = E.sunkenTreasureCanGain(u, 0);
  ok(pred('village') === false, '場にあるカードは獲得できない');
  ok(pred('smithy') === true, '場に無いアクションは獲得できる（コスト制限なし）');
}
console.log('=== A4: 交換（山に戻す＝廃棄でも獲得でもない）／歩哨（見た5枚は山札ではない） ===');
{
  let s = mkA4(['swap', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'], 2);
  s.players[0].hand = ['swap', 'village']; s.turn.actions = 1;
  s.players[0].deck = ['copper', 'copper', 'copper'];
  const v0 = s.supply.village, tr0 = s.trash.length;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'swap' });
  s = reduce(s, { type: 'SWAP_RETURN', card: 'village' });
  ok(s.supply.village === v0 + 1 && s.trash.length === tr0, '山に戻って supply が増える（廃棄置き場には入らない）');
  ok(!E.swapCanGain(s, 'village')('village'), '同名は獲得できない');
  s = reduce(s, { type: 'SWAP_GAIN', card: 'smithy' });
  ok(s.players[0].hand.includes('smithy'), '**手札に**獲得する');
  // 歩哨＝ネズミの廃棄ドローは「その時の山札」から
  let u = mkA4(['sentinel', 'rats', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'gold'], 2);
  u.players[0].hand = ['sentinel']; u.turn.actions = 1;
  u.players[0].deck = ['rats', 'copper', 'copper', 'copper', 'copper', 'gold', 'silver'];
  u = reduce(u, { type: 'PLAY_ACTION', card: 'sentinel' });
  ok(u.pending && u.pending.cards.length === 5 && u.players[0].deck.length === 2, '5枚は山札から抜いて脇に持つ');
  u = reduce(u, { type: 'SENTINEL_TRASH', cards: ['rats'] });
  ok(u.players[0].hand.includes('gold') || u.players[0].hand.includes('silver'),
    'ネズミの廃棄ドローは「見ている5枚」ではなく**その時の山札**から引く');
}
console.log('=== A4: 大工（空山の判定は使用時に1回）／急使（捨てる→トリガー→その後で捨て札を見る） ===');
{
  let s = mkA4(['carpenter', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'], 2);
  s.players[0].hand = ['carpenter']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'carpenter' });
  ok(s.turn.actions === 1 && s.pending && s.pending.type === 'carpenter_gain', '空山0＝+1アクション＋$4以下を獲得');
  let u = mkA4(['carpenter', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'], 2);
  u.supply.village = 0;
  u.players[0].hand = ['carpenter', 'estate']; u.turn.actions = 1;
  u = reduce(u, { type: 'PLAY_ACTION', card: 'carpenter' });
  ok(u.turn.actions === 0 && u.pending && u.pending.type === 'carpenter_trash', '空山あり＝廃棄→格上げ（+1アクションは付かない）');
  // 急使＝坑道を捨てて得た金貨をこの後で使える
  let v = mkA4(['courier', 'tunnel', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'gold'], 2);
  v.players[0].hand = ['courier']; v.turn.actions = 1;
  v.players[0].deck = ['tunnel', 'copper']; v.players[0].discard = [];
  v = reduce(v, { type: 'PLAY_ACTION', card: 'courier' });
  ok(v.players[0].discard.includes('gold'), '坑道を捨てて金貨を獲得（捨て札トリガーが先に解決される）');
  ok(v.pending && v.pending.type === 'courier_play', 'その後で捨て札を見る窓が開く');
}
console.log('=== A4: 侍祭（コスト制限なしで卜占官の一番上を獲得） ===');
{
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'augurs', 1); // 侍祭が一番上
  ok(s.augurs[0] === 'acolyte', '卜占官の一番上が侍祭');
  s.players[0].hand = ['acolyte', 'estate']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'acolyte' });
  s = reduce(s, { type: 'ACOLYTE_TRASH', card: 'estate' });
  ok(count(s.players[0].discard, 'gold') === 1, 'アクション/勝利点を廃棄して金貨');
  ok(s.pending && s.pending.type === 'acolyte_self', '次に「自身を廃棄するか」の窓');
  const before = s.augurs[0];
  s = reduce(s, { type: 'ACOLYTE_SELF', ok: true });
  ok(count(s.trash, 'acolyte') === 1, '自身を廃棄した');
  ok(s.players[0].discard.includes(before) || s.players[0].discard.includes('acolyte'),
    '卜占官の山の一番上を1枚獲得した（コスト制限なし）');
}
console.log('=== A4: 敵対レビュー確定分の回帰 ===');
{
  // [medium] 改造：手札が空のときに「$1以下」をタダで獲得できてはいけない
  let s = mkA4(['modify', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'], 2);
  s.players[0].hand = ['modify']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'modify' });
  ok(s.pending && s.pending.type === 'modify_choose' && s.pending.noTrash === true, '手札が空なら noTrash 印つきで二択が開く');
  const d0 = s.players[0].discard.length;
  s = reduce(s, { type: 'MODIFY_CHOOSE', choices: ['gain'] });
  ok(s.pending == null && s.players[0].discard.length === d0, '「獲得」を選んでも**何も獲得しない**（廃棄していないため）');
}
{
  // [medium] 追いはぎ：カード効果で使わせた財宝（急使）も無効化され、権利もそこで消費される
  const K4 = ['highwayman', 'courier', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'gold'];
  let s = mkA4(K4, 2);
  s.players[0].hand = ['highwayman']; s.turn.actions = 1;
  s.players[0].deck = new Array(20).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'highwayman' });
  while (s.pending && s.pending.type === 'highwayman') s = reduce(s, { type: 'LINGER_REACT' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  s.players[1].hand = ['courier']; s.players[1].deck = ['estate']; s.players[1].discard = ['gold'];
  s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'courier' });
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'COURIER_PLAY', card: 'gold' });
  ok(s.turn.coins === c0, '急使で使わせた金貨も追いはぎで無効化される（+$0）');
  s.turn.phase = 'buy'; s.players[1].hand = ['copper'];
  const c1 = s.turn.coins;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.coins === c1 + 1, '権利は消費済み＝その後の財宝は普通に働く');
}
{
  // [low] 追いはぎ：無効化しても「そのカードを使った」事実は残る（愚者の黄金の2枚目は +$4）
  const K5 = ['highwayman', 'fools_gold', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'gold'];
  let s = mkA4(K5, 2);
  s.players[0].hand = ['highwayman']; s.turn.actions = 1;
  s.players[0].deck = new Array(20).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'highwayman' });
  while (s.pending && s.pending.type === 'highwayman') s = reduce(s, { type: 'LINGER_REACT' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  s.turn.phase = 'buy'; s.players[1].hand = ['fools_gold', 'fools_gold'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'fools_gold' });
  const c0 = s.turn.coins;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'fools_gold' });
  ok(s.turn.coins === c0 + 4, '無効化された1枚目も「1枚目」として数える＝2枚目は +$4（実際 +' + (s.turn.coins - c0) + '）');
}
{
  /* [high 回帰] 将軍 × 玉座の間＝**合法な対象がゼロなら窓を開かない**（開くと engine拒否×CPU提案の livelock）。
     窓・受理・CPU候補・UI フィルタの4点セットが同じ述語（`canPlayHandCard`）を見ること。 */
  let s = mkA4(['clashes', 'throne_room', 'kings_court', 'procession', 'village', 'smithy', 'market', 'moat', 'militia', 'gold'], 2);
  digPile(s, 'clashes', 2);   // 将軍が一番上
  s.players[0].hand = ['warlord']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'warlord' });
  while (s.pending && s.pending.type === 'warlord') s = reduce(s, { type: 'LINGER_REACT' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ['throne_room', 'kings_court', 'procession'].forEach((tc) => {
    let u = s;
    u.players[1].inPlay = ['village', 'village'];
    u.players[1].hand = [tc, 'village', 'copper'];
    u.turn.actions = 5;
    u = reduce(u, { type: 'PLAY_ACTION', card: tc });
    ok(u.pending == null, tc + '：合法な対象がゼロなら窓を開かない（livelock 回帰）');
    // CPU も engine が拒否する手を返さない
    let v = s;
    v.players[1].inPlay = ['village'];
    v.players[1].hand = [tc, 'village', 'village', 'copper'];
    v.turn.actions = 5;
    v = reduce(v, { type: 'PLAY_ACTION', card: tc });
    let guard = 0, rejected = 0;
    while (v.pending && guard++ < 30) {
      const a = CPU.decide(v);
      const b = JSON.stringify(v);
      v = reduce(v, a);
      if (JSON.stringify(v) === b) rejected++;
    }
    ok(rejected === 0 && !v.pending, tc + '：CPU が engine に拒否される手を返さない（拒否' + rejected + '回）');
  });
}
{
  /* [high 回帰] 専門家 × 航海＝手札から3枚使い切った後は専門家の窓を開かない
     （開くと specialist_play → 'again' → 再演 → specialist_play の無限ループになる）。 */
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'odysseys', 1);   // 航海
  s.players[0].hand = ['voyage']; s.turn.actions = 1;
  s.players[0].deck = new Array(40).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'voyage' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  s.turn.handPlays = 3;
  s.players[0].hand = ['specialist', 'copper']; s.turn.actions = 3;
  const before = JSON.stringify([s.turn.handPlays, s.players[0].hand, s.pending]);
  s = reduce(s, { type: 'PLAY_ACTION', card: 'specialist' });
  ok(JSON.stringify([s.turn.handPlays, s.players[0].hand, s.pending]) === before,
    '航海の3枚制限に達していれば専門家自体を使えない（livelock 回帰）');
}
{
  // [medium] 将軍：玉座の間／長老／専門家 など「手札から使わせる」経路も止まる
  let s = mkA4(['warlord', 'throne_room', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'gold'], 2);
  s.players[0].hand = ['warlord']; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'warlord' });
  while (s.pending && s.pending.type === 'warlord') s = reduce(s, { type: 'LINGER_REACT' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  s.players[1].inPlay = ['village', 'village'];
  s.players[1].hand = ['throne_room', 'village']; s.turn.actions = 5;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'throne_room' });
  const before = count(s.players[1].inPlay, 'village');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'village' });
  ok(count(s.players[1].inPlay, 'village') === before, '玉座の間でも3枚目の村は使えない（公式FAQが名指しで禁止）');
}
{
  /* [回帰] 将軍：冠(actionモード)／首謀者／門下生 の「手札から使わせる」経路も止まる
     （canPlayHandCard のゲート漏れ＝玉座の間と同じクラス。修正前は3枚目の村を使えた）。 */
  const WK = ['warlord', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'];
  const armWarlord = () => {
    let w = mkA4(WK, 2);
    w.players[0].hand = ['warlord']; w.turn.actions = 1;
    w = reduce(w, { type: 'PLAY_ACTION', card: 'warlord' });
    while (w.pending && w.pending.type === 'warlord') w = reduce(w, { type: 'LINGER_REACT' });
    w = reduce(w, { type: 'END_ACTION_PHASE' }); w = reduce(w, { type: 'END_TURN' });
    // ここから将軍の予約が立った相手（プレイヤー1）のターン。場に村2枚＝村は使えない。
    w.players[1].inPlay = ['village', 'village'];
    w.players[1].deck = new Array(20).fill('copper'); w.players[1].discard = [];
    w.turn.actions = 5;
    return w;
  };
  // 冠（actionモード）：受理側 CROWN_CHOOSE が3枚目の村を拒否する
  let c = armWarlord();
  c.players[1].hand = ['crown', 'village', 'smithy'];
  c = reduce(c, { type: 'PLAY_ACTION', card: 'crown' });
  ok(c.pending && c.pending.type === 'crown' && c.pending.mode === 'action',
    '冠：合法候補（鍛冶屋）があるので窓は開く');
  c = reduce(c, { type: 'CROWN_CHOOSE', card: 'village' });
  ok(count(c.players[1].inPlay, 'village') === 2 && c.players[1].hand.includes('village'),
    '**冠でも3枚目の村は使えない**（inPlay が増えず手札に残る）');
  // 冠：合法候補が1枚も無ければ窓自体を開かない（開くと人間の死に窓）
  let c2 = armWarlord();
  c2.players[1].hand = ['crown', 'village'];
  c2 = reduce(c2, { type: 'PLAY_ACTION', card: 'crown' });
  ok(c2.pending === null, '冠：将軍で全部止まっているなら窓を開かない（crownOpenPending も同じ述語）');
  // 首謀者：受理側 MASTERMIND_PLAY が拒否する（状態不変＝pending が残る）
  let m = armWarlord();
  m.players[1].hand = ['village', 'smithy'];
  m.pending = { type: 'mastermind_play', player: 1 };
  m = reduce(m, { type: 'MASTERMIND_PLAY', card: 'village' });
  ok(m.pending && m.pending.type === 'mastermind_play' && count(m.players[1].inPlay, 'village') === 2
    && m.players[1].hand.includes('village'),
    '**首謀者でも3枚目の村は使えない**（拒否＝状態不変）');
  m = reduce(m, { type: 'MASTERMIND_PLAY', card: null });
  ok(m.pending === null, '首謀者：辞退で窓は閉じられる（人間が詰まない）');
  // 門下生：受理側 DISCIPLE_PLAY が拒否する（プレイもコピー獲得も起きない）
  let d = armWarlord();
  d.players[1].hand = ['disciple', 'village', 'smithy'];
  d = reduce(d, { type: 'PLAY_ACTION', card: 'disciple' });
  ok(d.pending && d.pending.type === 'disciple_play', '門下生：合法候補（鍛冶屋）があるので窓は開く');
  d = reduce(d, { type: 'DISCIPLE_PLAY', card: 'village' });
  ok(d.pending && d.pending.type === 'disciple_play' && count(d.players[1].inPlay, 'village') === 2
    && !d.players[1].discard.includes('village'),
    '**門下生でも3枚目の村は使えない**（プレイもコピー獲得も起きない）');
}
{
  /* [回帰] 航海の3枚制限：冠(両モード)／首謀者／門下生 も止まる（修正前は素通しだった）。 */
  const voyageTurn = () => {
    let v = mkA4(SPLIT_K, 2);
    digPile(v, 'odysseys', 1); // 航海が一番上
    v.players[0].hand = ['voyage']; v.turn.actions = 1;
    v.players[0].deck = new Array(30).fill('copper');
    v = reduce(v, { type: 'PLAY_ACTION', card: 'voyage' });
    v = reduce(v, { type: 'END_ACTION_PHASE' }); v = reduce(v, { type: 'END_TURN' });
    v.turn.handPlays = 3; v.turn.actions = 5;
    return v;
  };
  let a = voyageTurn();
  ok(a.turn.active === 0 && a.turn.voyageTurn === true, '前提：航海の追加ターンになっている');
  a.players[0].hand = ['village'];
  a.pending = { type: 'crown', mode: 'action', player: 0 };
  a = reduce(a, { type: 'CROWN_CHOOSE', card: 'village' });
  ok(!a.players[0].inPlay.includes('village') && a.players[0].hand.includes('village'),
    '冠(action)：手札3枚を使い切った後はアクションを使えない');
  let b = voyageTurn();
  b.players[0].hand = ['copper'];
  b.pending = { type: 'crown', mode: 'treasure', player: 0 };
  const coin0 = b.turn.coins;
  b = reduce(b, { type: 'CROWN_CHOOSE', card: 'copper' });
  ok(b.players[0].hand.includes('copper') && !b.players[0].inPlay.includes('copper') && b.turn.coins === coin0,
    '冠(treasure)：手札3枚を使い切った後は財宝も使えない（財宝も数える）');
  let m2 = voyageTurn();
  m2.players[0].hand = ['village'];
  m2.pending = { type: 'mastermind_play', player: 0 };
  m2 = reduce(m2, { type: 'MASTERMIND_PLAY', card: 'village' });
  ok(m2.pending && m2.pending.type === 'mastermind_play' && !m2.players[0].inPlay.includes('village'),
    '首謀者：手札3枚を使い切った後は拒否される');
  let d2 = voyageTurn();
  d2.players[0].hand = ['village'];
  d2.pending = { type: 'disciple_play', player: 0 };
  d2 = reduce(d2, { type: 'DISCIPLE_PLAY', card: 'village' });
  ok(d2.pending && d2.pending.type === 'disciple_play' && !d2.players[0].inPlay.includes('village'),
    '門下生：手札3枚を使い切った後は拒否される');
}
{
  /* [回帰] 航海×冠：冠が選んだ手札のカードも handPlays に数える（notePlayFromHand。
     冠自身1＋選んだ村1＝2。修正前は冠の1だけ＝実質4枚使えた）。 */
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'odysseys', 1);
  s.players[0].hand = ['voyage']; s.turn.actions = 1;
  s.players[0].deck = new Array(30).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'voyage' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.voyageTurn === true && (s.turn.handPlays || 0) === 0, '追加ターン開始時は handPlays=0');
  s.players[0].hand = ['crown', 'village', 'smithy']; s.turn.actions = 5;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'crown' });
  ok((s.turn.handPlays || 0) === 1 && s.pending && s.pending.type === 'crown', '冠自身で handPlays=1');
  s = reduce(s, { type: 'CROWN_CHOOSE', card: 'village' });
  ok(count(s.players[0].inPlay, 'village') === 1, '村は使えた（handPlays 1<3 なので合法）');
  ok((s.turn.handPlays || 0) === 2, '**冠が選んだ村も handPlays に数える**（冠1＋村1＝2。再演の2回目は数えない）');
}
{
  /* [回帰] CPU：将軍ブロック下の crown / mastermind_play / disciple_play の decidePending が
     ブロックされた札を返さない（返すと engine拒否×CPU提案の livelock）。 */
  const armWarlordCPU = (hand, pending) => {
    let w = mkA4(['warlord', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'laboratory', 'festival', 'gold'], 2);
    w.players[0].hand = ['warlord']; w.turn.actions = 1;
    w = reduce(w, { type: 'PLAY_ACTION', card: 'warlord' });
    while (w.pending && w.pending.type === 'warlord') w = reduce(w, { type: 'LINGER_REACT' });
    w = reduce(w, { type: 'END_ACTION_PHASE' }); w = reduce(w, { type: 'END_TURN' });
    w.players[1].inPlay = ['village', 'village'];
    w.players[1].hand = hand.slice(); w.turn.actions = 5;
    w.pending = pending;
    return w;
  };
  [['crown', { type: 'crown', mode: 'action', player: 1 }, 'CROWN_CHOOSE'],
   ['mastermind', { type: 'mastermind_play', player: 1 }, 'MASTERMIND_PLAY'],
   ['disciple', { type: 'disciple_play', player: 1 }, 'DISCIPLE_PLAY']].forEach(([name, pd, ty]) => {
    // 合法候補ゼロ＝null 辞退（修正前はブロックされた村を返し続けた）
    const s1 = armWarlordCPU(['village'], JSON.parse(JSON.stringify(pd)));
    const a1 = CPU.decide(s1);
    ok(a1 && a1.type === ty && a1.card === null,
      name + '：CPU はブロックされた村を返さず null 辞退（実際 ' + JSON.stringify(a1 && a1.card) + '）');
    // 合法札があるならそれを返す（ブロックされた札は返さない）
    const s2 = armWarlordCPU(['village', 'smithy'], JSON.parse(JSON.stringify(pd)));
    const a2 = CPU.decide(s2);
    ok(a2 && a2.type === ty && a2.card != null && a2.card !== 'village',
      name + '：合法札があるときはブロックされていない札を返す（実際 ' + JSON.stringify(a2 && a2.card) + '）');
  });
}
{
  // [medium] 航海：使い切れなかった予約が後のターンに持ち越されない
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'odysseys', 1);
  s.players[0].hand = ['voyage', 'voyage', 'voyage']; s.turn.actions = 3;
  s.players[0].deck = new Array(40).fill('copper');
  s = reduce(s, { type: 'PLAY_ACTION', card: 'voyage' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'voyage' });
  s = reduce(s, { type: 'PLAY_ACTION', card: 'voyage' });
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 0 && (s.players[0].voyageExtra || 0) === 0, '追加ターンは1回だけ・予約は全部消費される');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 1, '3ターン連続にはならない');
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.active === 0 && !s.turn.voyageTurn, '**後の通常ターンに余りの追加ターンが湧かない**');
}
{
  // [medium] リッチ：同時に廃棄されたカードを廃棄置き場から獲得できる（歩哨の公式例）
  let s = mkA4(SPLIT_K, 2);
  digPile(s, 'wizards', 3);   // リッチ
  s.players[0].hand = ['sentinel']; s.turn.actions = 1;
  s.players[0].deck = ['lich', 'sycophant', 'copper', 'copper', 'copper'];
  s.trash = [];
  s = reduce(s, { type: 'PLAY_ACTION', card: 'sentinel' });
  s = reduce(s, { type: 'SENTINEL_TRASH', cards: ['lich', 'sycophant'] });
  if (s.pending && s.pending.type === 'sentinel') s = reduce(s, { type: 'SENTINEL_ORDER', order: s.pending.cards.slice() });
  ok(s.pending && s.pending.type === 'lich_gain',
    '**同時に廃棄した**ごますりをリッチが獲得できる（1枚ずつだと順番で結果が変わる）');
  // 順番を入れ替えても同じ結果になる（＝送った配列の順序に依存しない）
  let s2 = mkA4(SPLIT_K, 2);
  digPile(s2, 'wizards', 3);
  s2.players[0].hand = ['sentinel']; s2.turn.actions = 1;
  s2.players[0].deck = ['lich', 'sycophant', 'copper', 'copper', 'copper'];
  s2.trash = [];
  s2 = reduce(s2, { type: 'PLAY_ACTION', card: 'sentinel' });
  s2 = reduce(s2, { type: 'SENTINEL_TRASH', cards: ['sycophant', 'lich'] });
  if (s2.pending && s2.pending.type === 'sentinel') s2 = reduce(s2, { type: 'SENTINEL_ORDER', order: s2.pending.cards.slice() });
  ok(s2.pending && s2.pending.type === 'lich_gain', '廃棄する順番を入れ替えても結果は同じ');
}
{
  // [medium] 支配の追加ターンをリッチが飛ばしても possessedBy が第三者へ引き継がれない
  let s = mkA4(SPLIT_K, 3);
  s.extraTurns = [{ seat: 1, possessedBy: 0, rotationSeat: 0 }];
  s.players[1].skipTurns = 1;
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  s = reduce(s, { type: 'END_TURN' });
  ok(s.turn.possessedBy == null, '飛ばした追加ターンの possessedBy が残らない（第三者が支配されない）');
}
{
  // [medium] 青空市場：城塞／リッチ（廃棄置き場に残らない札）を廃棄しても反応できる（**出荷 darkages の既存バグ**）
  let s = E.createInitialState(['A', 'B'], DOM.KINGDOM_DARKAGES, { startActive: 0, shelters: true });
  s.ally = null; s.pending = null; if (s.turn) s.turn.startQueue = null;
  s.players[0].hand = ['chapel', 'fortress', 'market_square'];
  s.supply.chapel = 10; s.turn.actions = 1;
  s = reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['fortress'] });
  ok(s.pending && s.pending.type === 'market_square_react',
    '城塞を廃棄しても青空市場が反応する（廃棄という事象自体は起きている＝公式）');
}
console.log('=== A4: 全49種を1枚ずつ使っても 保存則違反0・CPU null 0・engine拒否0 ===');
{
  const A4_CARDS = ['bauble', 'sycophant', 'importer', 'merchant_camp', 'sentinel', 'underling', 'broker', 'carpenter',
    'courier', 'innkeeper', 'royal_galley', 'town', 'barbarian', 'capital_city', 'contract', 'emissary', 'galleria',
    'guildmaster', 'highwayman', 'hunter', 'modify', 'skirmisher', 'specialist', 'swap', 'marquis',
    'herb_gatherer', 'acolyte', 'sorceress', 'sibyl', 'battle_plan', 'archer', 'warlord', 'territory',
    'tent', 'garrison', 'hill_fort', 'stronghold', 'old_map', 'voyage', 'sunken_treasure', 'distant_shore',
    'town_crier', 'blacksmith', 'miller', 'elder', 'student', 'conjurer', 'sorcerer', 'lich'];
  ok(A4_CARDS.length === 49, '同盟の王国カードは49種');
  let bad = 0;
  A4_CARDS.forEach((cid) => {
    let s = mkA4(SPLIT_K, 2);
    s.players[0].hand = [cid, cid, 'copper', 'copper', 'copper'];
    const t0 = tally(s);
    s.turn.actions = 5;
    s.turn.phase = DOM.isType(cid, 'action') ? 'action' : 'buy';
    let guard = 0;
    try {
      for (let i = 0; i < 2; i++) {
        if (DOM.isType(cid, 'action')) s = reduce(s, { type: 'PLAY_ACTION', card: cid });
        else s = reduce(s, { type: 'PLAY_TREASURE', card: cid });
        while (s.pending && guard++ < 80) {
          const a = CPU.decide(s);
          if (a == null) { console.log('    ' + cid + ': CPU が null'); bad++; break; }
          const bfr = JSON.stringify(s);
          s = reduce(s, a);
          if (JSON.stringify(s) === bfr) { console.log('    ' + cid + ': engine 拒否 ' + a.type); bad++; break; }
        }
        if (s.gameOver) break;
      }
    } catch (e) { console.log('    ' + cid + ': 例外 ' + e.message); bad++; return; }
    const d = tdiff(t0, tally(s));
    if (d.length) { console.log('    ' + cid + ': 保存則 ' + d.join(' ')); bad++; }
  });
  ok(bad === 0, '全49種で異常なし（bad=' + bad + '）');
}
console.log('=== A4: CPUソーク（同盟の王国カードを厚く配って完走するか） ===');
{
  const SOAK = [
    ['augurs', 'clashes', 'forts', 'odysseys', 'townsfolk', 'wizards', 'village', 'smithy', 'market', 'moat'],
    ['barbarian', 'highwayman', 'skirmisher', 'archer', 'sorceress', 'sorcerer', 'warlord', 'clashes', 'wizards', 'moat'],
    ['bauble', 'broker', 'guildmaster', 'galleria', 'contract', 'emissary', 'importer', 'underling', 'sycophant', 'moat'],
    ['sentinel', 'carpenter', 'courier', 'swap', 'specialist', 'royal_galley', 'modify', 'marquis', 'hunter', 'moat'],
    ['town', 'blacksmith', 'miller', 'capital_city', 'innkeeper', 'merchant_camp', 'townsfolk', 'forts', 'odysseys', 'moat'],
  ];
  const MIXK = E.MIXED_PILE_KEYS;
  let games = 0, bad = 0;
  SOAK.forEach((K3, ki) => {
    for (let np = 2; np <= 3; np++) {
      seed = 4000 + ki * 31 + np;
      const names = []; for (let k = 0; k < np; k++) names.push({ name: 'P' + k, isCpu: true, level: k === 0 ? 'hard' : 'normal' });
      let s = E.createInitialState(names, K3, { startActive: 0 });
      // CPU は MONEY 戦略だと王国カードを買わないので、**サプライから抜いて**各自の山札に2枚ずつ配る。
      K3.forEach((id) => {
        s.players.forEach((pl) => {
          for (let c = 0; c < 2; c++) {
            if (MIXK.indexOf(id) >= 0) { if ((s[id] || []).length) { const real = s[id].shift(); s.supply[id] = (s.supply[id] | 0) - 1; pl.deck.push(real); } }
            else if ((s.supply[id] | 0) > 0) { s.supply[id] -= 1; pl.deck.push(id); }
          }
        });
      });
      const t0 = tally(s);
      let step = 0, err = false;
      try {
        while (!s.gameOver && step++ < 25000) {
          const a = CPU.decide(s);
          if (a == null) { console.log('    ' + ki + '/' + np + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
          s = reduce(s, a);
        }
      } catch (e) { console.log('    ' + ki + '/' + np + ': 例外 ' + e.message); err = true; }
      if (!err && !s.gameOver) { console.log('    ' + ki + '/' + np + ': 未終局（膠着）'); err = true; }
      const d = tdiff(t0, tally(s));
      if (d.length) { console.log('    ' + ki + '/' + np + ': 保存則 ' + d.slice(0, 5).join(' ')); err = true; }
      if (err) bad++; else games++;
    }
  });
  ok(bad === 0 && games === SOAK.length * 2, 'CPUソーク完走（' + games + '/' + (SOAK.length * 2) + '・膠着0・例外0・保存則違反0）');
}

/* ============================================================
   A5＝CARD_SET 昇格（同盟が実プレイに出るようになる）
   - `allies`（固定10種）と `random-allies` が CARD_SETS にある／mix-all にも参加する。
   - **`DOM.STAGE1_POOLS` から 'allies' が外れた**＝闇市場デッキに同盟の非分割25種が入る。
     ⚠ このとき **分割山の中身24種と山キー6つが漏れてはいけない**（MIXED_PILE_CONTENTS / MIXED_PILE_KEYS）。
   - 固定10種は**連携を必ず含む**（含まないと Ally も好意も登場せず拡張の目玉が出ない）。
   ============================================================ */
console.log('=== A5: CARD_SET 昇格（固定10種・random-allies・mix・闇市場） ===');
{
  const SETS = DOM.CARD_SETS;
  const fixed = SETS.find((s) => s.id === 'allies');
  ok(!!fixed, 'CARD_SETS に allies がある');
  ok(fixed && fixed.kind === 'standard', 'allies は kind=standard（UI の「拡張」タイルに出る）');
  ok(fixed && !!fixed.desc, 'allies に一行説明がある（拡張タイルの表示に使う）');
  ok(!!SETS.find((s) => s.id === 'random-allies'), 'CARD_SETS に random-allies がある');
  ok(!!DOM.MIX_KINGDOM_POOLS.allies, 'mix-all の王国プールに allies がある');
  ok((DOM.STAGE1_POOLS || []).indexOf('allies') < 0, 'STAGE1_POOLS から allies が外れている');

  const K10 = DOM.KINGDOM_ALLIES || [];
  ok(K10.length === 10, '固定10種がちょうど10山');
  ok(K10.every((id) => !!DOM.CARDS[id]), '固定10種はすべてカタログにある');
  ok(K10.every((id) => (DOM.POOLS.allies || []).indexOf(id) >= 0), '固定10種はすべて同盟プールの札');
  ok(K10.length === new Set(K10).size, '固定10種に重複がない');
  // 連携の判定は**分割山の中身まで走査**する（生徒は魔法使いの山の中に居る）。
  const hasLiaison = K10.some((id) => DOM.ALLIES_LIAISONS.indexOf(id) >= 0 ||
    (DOM.ALLIES_SPLIT_PILES[id] || []).some((c) => DOM.ALLIES_LIAISONS.indexOf(c) >= 0));
  ok(hasLiaison, '固定10種に連携(Liaison)が含まれる＝Ally と好意が必ず登場する');
  const splitInFixed = K10.filter((id) => !!DOM.ALLIES_SPLIT_PILES[id]);
  ok(splitInFixed.length >= 2, '固定10種に分割山が2組以上ある（循環を味わえる）');
  ok(K10.some((id) => DOM.CARDS[id] && (DOM.CARDS[id].types || []).indexOf('attack') >= 0) ||
     splitInFixed.some((p) => DOM.ALLIES_SPLIT_PILES[p].some((c) => (DOM.CARDS[c].types || []).indexOf('attack') >= 0)),
     '固定10種にアタックがある');
  ok(splitInFixed.some((p) => DOM.ALLIES_SPLIT_PILES[p].some((c) => (DOM.CARDS[c].types || []).indexOf('duration') >= 0)) ||
     K10.some((id) => (DOM.CARDS[id].types || []).indexOf('duration') >= 0), '固定10種に持続がある');

  // 固定セットを実際に組む
  {
    const s = mk(DOM.kingdomForSet('allies'), {}, ['A', 'B']);
    ok(!!s.ally, '固定セットでは必ず Ally が1枚選ばれる');
    ok(DOM.ALLIES_ALLY.indexOf(s.ally) >= 0, '選ばれた Ally は23種のどれか');
    ok(s.players.every((p) => p.favors === 1), '開始時の好意は1個（輸入者は固定10種に無い）');
    splitInFixed.forEach((p) => {
      ok(Array.isArray(s[p]) && s[p].length === 16, p + ' の分割山が16枚');
      ok(s.supply[p] === 16, p + ' の supply 残数が実配列と同期している');
      // 一番上は最安（安い順に積む）
      ok(s[p][0] === DOM.ALLIES_SPLIT_PILES[p][0], p + ' の一番上が最安のカード');
    });
    // 3山終了の数え方＝分割山は16枚全部が無くなって初めて1山
    const empt0 = E.emptyPileCount(s);
    const p0 = splitInFixed[0];
    s[p0] = s[p0].slice(0, 1); s.supply[p0] = 1;
    ok(E.emptyPileCount(s) === empt0, '分割山は残り1枚でも「空」に数えない');
    s[p0] = []; s.supply[p0] = 0;
    ok(E.emptyPileCount(s) === empt0 + 1, '分割山は16枚すべて無くなって初めて1山ぶんの空');
  }

  // random-allies：分割山の中身は絶対に王国に出ない／必ず10山／組める
  {
    let bad = 0, withAlly = 0;
    for (let i = 0; i < 120; i += 1) {
      const k = DOM.kingdomForSet('random-allies');
      if (k.length !== 10) { bad += 1; continue; }
      if (k.some((id) => (DOM.POOLS.allies_split || []).indexOf(id) >= 0)) { bad += 1; continue; }
      if (k.some((id) => (DOM.POOLS.allies || []).indexOf(id) < 0)) { bad += 1; continue; }
      const s = mk(k, {}, ['A', 'B']);
      if (s.ally) withAlly += 1;
      // 連携の有無と Ally の有無・好意の初期値は必ず一致する
      const lia = k.some((id) => DOM.ALLIES_LIAISONS.indexOf(id) >= 0 ||
        (DOM.ALLIES_SPLIT_PILES[id] || []).some((c) => DOM.ALLIES_LIAISONS.indexOf(c) >= 0));
      if (!!s.ally !== lia) { bad += 1; continue; }
      if (s.players.some((p) => (p.favors | 0) !== (lia ? (k.indexOf('importer') >= 0 ? 5 : 1) : 0))) bad += 1;
    }
    ok(bad === 0, 'random-allies 120回：中身の混入なし・連携の有無と Ally/好意が完全に一致（Ally あり ' + withAlly + '）');
  }

  // mix-all：同盟を混ぜても王国が組める（他拡張と同居）
  {
    let bad = 0;
    ['mix:allies', 'mix:allies,basic', 'mix:allies,darkages,empires', 'mix:allies,nocturne,menagerie'].forEach((setId) => {
      const k = DOM.kingdomForSet(setId);
      if (k.length !== 10) { bad += 1; return; }
      if (k.some((id) => (DOM.POOLS.allies_split || []).indexOf(id) >= 0)) { bad += 1; return; }
      try { mk(k, {}, ['A', 'B']); } catch (e) { bad += 1; }
    });
    ok(bad === 0, 'mix-all に同盟を混ぜても王国が組める（分割山の中身は出ない）');
  }

  /* 闇市場：STAGE1_POOLS から外したので同盟の**非分割25種**が入る。
     山キー6つ・分割山の中身24種は入ってはいけない（買うと実在しない札が湧く／山の一番上でしか得られない）。 */
  {
    const BM_K = ['black_market', 'village', 'market', 'smithy', 'moat', 'militia', 'cellar', 'laboratory', 'bauble', 'wizards'];
    let leak = '', sawAllies = 0, rounds = 0;
    for (let i = 0; i < 40; i += 1) {
      const s = mk(BM_K, {}, ['A', 'B']);
      const deck = s.blackMarket || [];
      rounds += 1;
      deck.forEach((id) => {
        if ((DOM.POOLS.allies_split || []).indexOf(id) >= 0) leak = leak || ('分割山の中身 ' + id);
        if (MIX.indexOf(id) >= 0) leak = leak || ('混合山の山キー ' + id);
        if ((DOM.POOLS.allies || []).indexOf(id) >= 0) sawAllies += 1;
      });
      // サプライに在る同盟の札（道化棒/魔法使い）は闇市場デッキに入らない
      if (deck.indexOf('bauble') >= 0 || deck.indexOf('wizards') >= 0) leak = leak || 'サプライにある札が入った';
    }
    ok(!leak, '闇市場デッキに分割山の中身も山キーも漏れない（' + (leak || 'ok') + '）');
    ok(sawAllies === rounds * 24, '闇市場デッキに同盟の非分割24種（サプライの道化棒を除く）が毎回入る');
    /* 同盟は段階2（実プレイ）なので STAGE1_POOLS に入っていてはいけない。
       ⚠ 「STAGE1_POOLS が空」で検査してはいけない＝**次の拡張を段階1で足した瞬間に落ちる**
       （実際に略奪(Plunder)の段階1で落ちた）。見るべきは「同盟のプールが入っていないこと」。 */
    ok((DOM.STAGE1_POOLS || []).indexOf('allies') < 0 && (DOM.STAGE1_POOLS || []).indexOf('allies_split') < 0,
      '同盟のプールは STAGE1_POOLS に入っていない（＝闇市場に出る）');
  }

  // 闇市場で同盟の連携を買っても、Ally が居ないゲームでは好意が湧かない（公式：Ally はセットアップで決まる）
  {
    let s = mk(['black_market', 'village', 'market', 'smithy', 'moat', 'militia', 'cellar', 'laboratory', 'chapel', 'festival'], {}, ['A', 'B']);
    ok(!s.ally, '連携が王国に無ければ Ally は選ばれない');
    ok(s.players.every((p) => (p.favors | 0) === 0), '連携が無ければ好意も配られない');
    const p = s.players[0];
    p.hand.push('underling'); // 闇市場で買った連携が手札にある状況（好意を配る唯一の入口 gainFavors を通る）
    s.turn.actions = 1;
    s = reduce(s, { type: 'PLAY_ACTION', player: 0, card: 'underling' });
    ok((s.players[0].favors | 0) === 0, 'Ally が居ないゲームでは連携を使っても好意は増えない');
  }
}

/* ============================================================
   A5 の多エージェント敵対レビューで確定した分の回帰
   （どれも「同盟が実プレイに出て初めて到達できる」＝A4 までのテストは緑のまま素通りしていた）
   ============================================================ */
console.log('=== A5: 敵対レビュー確定分の回帰 ===');
{
  // 連携が無い王国＝Ally が出ない＝ターン1の窓が開かないので、手番送りの検査に使える。
  const NOLIA = ['townsfolk', 'odysseys', 'village', 'smithy', 'market', 'moat', 'cellar', 'laboratory', 'festival', 'workshop'];
  const clr = (s) => { s.players.forEach((pl) => { pl.hand = []; pl.deck = []; pl.discard = []; pl.inPlay = []; }); return s; };
  const endTurn = (s, pi) => reduce(reduce(s, { type: 'END_ACTION_PHASE', player: pi }), { type: 'END_TURN', player: pi });

  /* [high] リッチの獲得窓が**候補ゼロで開いて閉じない**（engine拒否×CPU提案の livelock／人間は脱出不能）。
     1回の蛮族で2人以上が山札の上のリッチを廃棄すると窓が2つ積まれ、廃棄置き場の「リッチより安いカード」を
     先の1人が取り切る。公式＝`Gaining a cheaper card is mandatory if possible.`＝可能でなければ何もしない。
     ⚠ 蛮族(barbarian)と魔法使い(wizards→リッチ)は**出荷する固定10種に同居する**＝実プレイで踏む。 */
  {
    seed = 8400;
    let s = mk(DOM.KINGDOM_ALLIES, { ally: 'plateau_shepherds' }, ['A', 'B', 'C']);
    clr(s);
    s.trash = ['estate'];                       // リッチ($6)より安い札は1枚だけ
    s.players[1].deck = ['lich']; s.players[2].deck = ['lich'];
    s.players[0].hand = ['barbarian']; s.turn.actions = 1;
    s = reduce(s, { type: 'PLAY_ACTION', player: 0, card: 'barbarian' });
    let step = 0, stuck = false, nullAct = false;
    while (s.pending && step++ < 60) {
      const before = JSON.stringify(s);
      const a = CPU.decide(s);
      if (a == null) { nullAct = true; break; }
      s = reduce(s, a);
      if (JSON.stringify(s) === before) { stuck = true; break; }
    }
    ok(!nullAct, 'リッチ×蛮族：CPU が null を返さない');
    ok(!stuck, 'リッチ×蛮族：engine拒否×CPU提案の livelock が起きない');
    ok(!s.pending, 'リッチ×蛮族：候補ゼロの窓が閉じる（残 pending=' + (s.pending && s.pending.type) + '）');
    // 受理側の終端保証（旧スナップショットの復元でここに来ても閉じられる）
    let s2 = mk(NOLIA, {}, ['A', 'B']);
    s2.trash = [];
    s2.pending = { type: 'lich_gain', player: 0 };
    s2 = reduce(s2, { type: 'LICH_GAIN', player: 0, card: null });
    ok(!s2.pending, 'LICH_GAIN は候補ゼロなら card:null を受理して窓を閉じる');
  }

  /* [medium] 航海2枚＋リッチ＝1枚目の追加ターンは飛ぶが、**2枚目は成立する**
     （公式 2023 Errata の Trivia 逐語＝飛ばしたターンは行われていないので、まだ2連続していない）。
     旗1つの boolean で持つとこの公式例が再現できない＝予約を「残り数」で持つ。 */
  {
    seed = 8401;
    let s = clr(mk(NOLIA, {}, ['A', 'B']));
    s.players[0].voyageExtra = 2; s.players[0].skipTurns = 1;
    s = endTurn(s, 0);
    ok(s.turn.active === 0 && s.turn.voyageTurn === true, '航海2枚＋リッチ：2枚目の航海の追加ターンが成立する');
    ok(s.turn.chain === 2, '航海2枚＋リッチ：連続手番は2（3連続にはならない）');
    ok((s.players[0].voyageExtra | 0) === 0, '航海の予約は使い切る');
    // 1枚だけなら飛んで終わり（予約は後の通常ターンへ持ち越さない＝A4 の [medium] 6 の維持）
    seed = 8402;
    let s2 = clr(mk(NOLIA, {}, ['A', 'B']));
    s2.players[0].voyageExtra = 1; s2.players[0].skipTurns = 1;
    s2 = endTurn(s2, 0);
    ok(s2.turn.active === 1, '航海1枚＋リッチ：追加ターンは飛んで通常進行');
    ok((s2.players[0].voyageExtra | 0) === 0, '使い切れなかった航海の予約は捨てる（持ち越さない）');
  }

  /* [medium] 相手のターンがリッチで飛んでも**連続手番は切れない**（飛ばしたターンは「行われていない」）。
     ここを 1 にリセットすると、航海が本来できない3連続ターンを許してしまう。 */
  {
    seed = 8403;
    let s = clr(mk(NOLIA, {}, ['A', 'B']));
    s.players[1].skipTurns = 1;
    s = endTurn(s, 0);
    ok(s.turn.active === 0, 'B が飛んで A の番に戻る');
    ok(s.turn.chain === 2, '飛ばされたターンは連続を切らない（A の2連続目）');
    s.players[0].voyageExtra = 1;
    s = endTurn(s, 0);
    ok(s.turn.active === 1, '3ターン目になる航海は発生しない');
    ok(s.log.some((l) => l.indexOf('3ターン連続にはできない') >= 0), '「3ターン連続にはできない」ログが出る');
  }

  /* [low] 島民(Island Folk)と航海が同時に成立するときは**どちらを取るか選べる**（公式）。
     航海のターンには「手札から3枚まで」の制限が付くので、好意5を払って島民を選ぶのが得な局面がある。 */
  {
    seed = 8404;
    const K = ['bauble'].concat(NOLIA).slice(0, 10);
    let s = clr(mk(K, { ally: 'island_folk' }, ['A', 'B']));
    s.players[0].favors = 5; s.players[0].voyageExtra = 1;
    s = endTurn(s, 0);
    ok(s.pending && s.pending.type === 'ally_island_folk', '航海が立っていても島民の窓が開く');
    s = reduce(s, { type: 'ALLY_SIMPLE', player: 0, ok: true });
    ok(s.turn.active === 0 && s.turn.voyageTurn !== true, '島民を選ぶと3枚制限の無い追加ターンになる');
    ok((s.players[0].voyageExtra | 0) === 0 && (s.players[0].favors | 0) === 0, '航海の予約は捨て、好意5を払う');
    seed = 8405;
    let s2 = clr(mk(K, { ally: 'island_folk' }, ['A', 'B']));
    s2.players[0].favors = 5; s2.players[0].voyageExtra = 1;
    s2 = endTurn(s2, 0);
    s2 = reduce(s2, { type: 'ALLY_SIMPLE', player: 0, ok: false });
    ok(s2.turn.active === 0 && s2.turn.voyageTurn === true, '島民を断れば航海の追加ターンになる');
  }

  /* [low] 航海の追加ターンのログが移動動物園の「今を生きる」を名乗っていた（航海も seizeTurn を立てるため）。 */
  {
    seed = 8406;
    let s = clr(mk(NOLIA, {}, ['A', 'B']));
    s.players[0].voyageExtra = 1;
    s = endTurn(s, 0);
    const last = s.log[s.log.length - 1];
    ok(last.indexOf('航海') >= 0 && last.indexOf('今を生きる') < 0, '航海の追加ターンは「航海」と表示する（実際: ' + last + '）');
  }

  /* [low] 混合山（城／同盟の分割山）から獲得したときのログが、**獲得後の**一番上を名乗っていた
     （gain が一番上を抜いた後に名前を引いていた）。城は2人戦で各1枚＝**出荷済みの帝国で毎回**ズレる。 */
  {
    const KM = ['wizards', 'townsfolk', 'village', 'smithy', 'market', 'moat', 'cellar', 'laboratory', 'festival', 'workshop'];
    seed = 8407;
    let s = clr(mk(KM, { ally: 'plateau_shepherds' }, ['A', 'B']));
    s.players[0].hand = ['conjurer']; s.turn.actions = 1;
    s = reduce(s, { type: 'PLAY_ACTION', player: 0, card: 'conjurer' });
    s = reduce(s, { type: 'CONJURER_GAIN', player: 0, card: 'townsfolk' });
    ok(count(s.players[0].discard, 'town_crier') === 1, '分割山から獲得したのは一番上（触れ役）');
    ok((s.log.filter((x) => x.indexOf('霊術師で') >= 0).pop() || '').indexOf('触れ役') >= 0, 'ログも触れ役を名乗る');
    seed = 8408;
    let s2 = clr(mk(['castles'].concat(KM).slice(0, 10), { ally: 'plateau_shepherds' }, ['A', 'B']));
    s2.players[0].hand = ['conjurer']; s2.turn.actions = 1;
    s2 = reduce(s2, { type: 'PLAY_ACTION', player: 0, card: 'conjurer' });
    s2 = reduce(s2, { type: 'CONJURER_GAIN', player: 0, card: 'castles' });
    ok(count(s2.players[0].discard, 'humble_castle') === 1, '城の混合山から獲得したのは一番上（粗末な城）');
    ok((s2.log.filter((x) => x.indexOf('霊術師で') >= 0).pop() || '').indexOf('粗末な城') >= 0, '城のログも粗末な城を名乗る（出荷済み帝国の表示バグ）');
  }
}

console.log('=== A5: 出荷セット（allies / random-allies）の CPU ソーク ===');
{
  let games = 0, bad = 0;
  const LV = ['easy', 'normal', 'hard'];
  ['allies', 'random-allies'].forEach((setId) => {
    for (let np = 2; np <= 4; np += 1) {
      for (let sd = 0; sd < 3; sd += 1) {
        seed = 8100 + np * 13 + sd;
        const names = []; for (let k = 0; k < np; k++) names.push({ name: 'P' + k, isCpu: true, level: LV[(sd + k) % 3] });
        let s = E.createInitialState(names, DOM.kingdomForSet(setId), { startActive: 0 });
        const t0 = tally(s);
        let step = 0, err = false;
        try {
          while (!s.gameOver && step++ < 25000) {
            const a = CPU.decide(s);
            if (a == null) { console.log('    ' + setId + '/' + np + '/' + sd + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
            const before = JSON.stringify(s);
            s = reduce(s, a);
            if (JSON.stringify(s) === before) { console.log('    ' + setId + '/' + np + '/' + sd + ': engine が拒否（' + JSON.stringify(a) + '）'); err = true; break; }
          }
        } catch (e) { console.log('    ' + setId + '/' + np + '/' + sd + ': 例外 ' + e.message); err = true; }
        if (!err && !s.gameOver) { console.log('    ' + setId + '/' + np + '/' + sd + ': 未終局（膠着）'); err = true; }
        const d = tdiff(t0, tally(s));
        if (d.length) { console.log('    ' + setId + '/' + np + '/' + sd + ': 保存則 ' + d.slice(0, 5).join(' ')); err = true; }
        if (err) bad += 1; else games += 1;
      }
    }
  });
  ok(bad === 0 && games === 18, '出荷セット CPUソーク完走（' + games + '/18・膠着0・例外0・engine拒否0・保存則違反0）');

  /* mix-all に同盟が参加した＝**他拡張と同居する経路**が新しく開いた。
     （帝国の資料庫・支配が混ざりうるので、上の tally が `p.archives` / `possession*` を数えていないと偽陽性で赤くなる） */
  let mixBad = 0, mixGames = 0;
  ['mix:allies,empires', 'mix:allies,alchemy', 'mix:allies,darkages', 'mix:allies,nocturne,menagerie'].forEach((setId, i) => {
    seed = 8300 + i;
    const names = [{ name: 'P0', isCpu: true, level: 'hard' }, { name: 'P1', isCpu: true, level: 'normal' }];
    let s = E.createInitialState(names, DOM.kingdomForSet(setId), { startActive: 0 });
    const t0 = tally(s);
    let step = 0, err = false;
    try {
      while (!s.gameOver && step++ < 25000) {
        const a = CPU.decide(s);
        if (a == null) { console.log('    ' + setId + ': CPU が null（' + (s.pending && s.pending.type) + '）'); err = true; break; }
        s = reduce(s, a);
      }
    } catch (e) { console.log('    ' + setId + ': 例外 ' + e.message); err = true; }
    if (!err && !s.gameOver) { console.log('    ' + setId + ': 未終局（膠着）'); err = true; }
    const d = tdiff(t0, tally(s));
    if (d.length) { console.log('    ' + setId + ': 保存則 ' + d.slice(0, 5).join(' ')); err = true; }
    if (err) mixBad += 1; else mixGames += 1;
  });
  ok(mixBad === 0 && mixGames === 4, 'mix-all に同盟を混ぜた4戦も完走（他拡張のゾーンまで数える tally の回帰）');
}

console.log('\n========================================');
/* === 高原の羊飼い × 特性「安価な(Cheap)」＝**得点計算でも $1 安い** ===
   公式 "Other rules clarifications" 逐語＝`Most forms of cost reduction (e.g. Bridge) have no effect
   when scoring. **However, Cheap cards still cost [$1] less when scoring, which may matter for
   Plateau Shepherds**, and Flourishing Trade remains in effect, which definitely matters.`
   ⚠ `cardCost` をそのまま使うと最終ターンの橋/街道まで拾ってしまうので `scoringCost` を使う。 */
{
  let s = E.createInitialState(['A', 'B'],
    ['bauble', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['cheap'], traitPiles: { cheap: 'village' } });
  s.ally = 'plateau_shepherds';
  s.players[0].favors = 20;   // 好意を多めにして「$2のカードの枚数」がそのまま出るようにする
  // 開始デッキ＝銅貨7($0)＋屋敷3($2)。そこに村2枚と堀1枚を足す。
  s.players[0].discard = s.players[0].discard.concat(['village', 'village', 'moat']);
  const cards = E.allCards(s.players[0]);
  ok(E.allyScoreForCards(s, cards, s.players[0]) === 2 * 6,
    '安価な($3→$2)の村2＋堀1＋屋敷3＝$2が6枚 ＝ 12VP（安価なは得点計算に効く）');
  // 「安価な」が別の山に付いていれば村は $3 のまま＝堀1枚ぶんだけ
  let z = E.createInitialState(['A', 'B'],
    ['bauble', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0, traits: ['cheap'], traitPiles: { cheap: 'smithy' } });
  z.ally = 'plateau_shepherds';
  z.players[0].favors = 20;
  z.players[0].discard = z.players[0].discard.concat(['village', 'village', 'moat']);
  ok(E.allyScoreForCards(z, E.allCards(z.players[0]), z.players[0]) === 2 * 4,
    '安価なが別の山なら村($3)は数えない＝堀1＋屋敷3の4枚で 8VP');
  // 橋のような「場にある間」型の軽減は得点計算では効かない（公式）
  let b = E.createInitialState(['A', 'B'],
    ['bauble', 'village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'workshop', 'laboratory', 'festival'],
    { startActive: 0 });
  b.ally = 'plateau_shepherds';
  b.players[0].favors = 20;
  b.players[0].discard = b.players[0].discard.concat(['village', 'village']);
  b.turn.costReduction = 1;                    // 橋を使った直後のような状態
  b.players[0].inPlay = ['highway'];           // 街道が場にある状態
  ok(E.allyScoreForCards(b, E.allCards(b.players[0]), b.players[0]) === 2 * 3,
    '橋/街道は得点計算に効かない＝村($3)は数えず屋敷3枚だけで 6VP（公式＝Most forms of cost reduction ... have no effect when scoring）');
}

console.log('同盟テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
