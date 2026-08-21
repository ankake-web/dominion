/* 旭日（Rising Sun）R4＝予言(Prophecy) 15種の検証（Node 単体実行）
   使い方: node test/risingsun-r4.test.js
   正本＝docs/research/risingsun_rules.md（第7・8章＋§E「予言はその瞬間に有効になる」）。

   このスイートが構造的に守っていること：
   - **予言の効果は `prophecyActive` で書く**（`hasProphecy` はゲーム開始直後から真＝準備処理専用）。
     ＝どの予言も「発動前は一切効かない」ことを1件ずつ検査する。
   - **誘発点が「後」の予言（偉大な指導者／来寇）は、最後の Sun を取り除いた前兆自身も恩恵を受ける**／
     **「使用前誘発」の豊作は受けない**。この非対称が §E の最重要の一般則。
   - **病は「ちょうど3枚」**（民兵型の `discardDownEnter` 流用は公式違反）。
   - **好機到来はドロー5枚を普通に行う**（手札は空にならない）。
   - **狼狽の2つの効果は完全に独立**（旗を立てて片付けで見る実装は公式違反）。
   - **神風は `delete state.supply[k]`**（`= 0` にすると3山終了が即成立して即死する）。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260821;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

/* ⚠ **前兆(Omen)が1枚も無い王国では予言が配られない**（`hasOmen` が false＝`createInitialState` が
   prophecy を null にする）。R4 のテスト王国には必ず前兆を1枚入れること（茶屋を先頭に固定）。 */
const K_NONE = ['tea_house', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine', 'remodel'];
const KP = ['tea_house', 'poet', 'kitsune', 'river_shrine', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar'];
const mk = (kingdom, n, opts) => E.createInitialState(
  Array.from({ length: n }, (_, i) => ({ name: 'P' + i, isCpu: i > 0 })), kingdom.slice(), opts || {});
// 予言を「発動済み」にした state（Sun を全部取り除いた状態）。
const on = (pr, kingdom, n) => {
  const s = mk((kingdom || KP).slice(0, 10), n || 2, { prophecy: pr, startActive: 0 });
  s.prophecyOn = true; s.sunTokens = 0; s.prophecyOnBy = 0;
  return s;
};
const off = (pr, kingdom, n) => mk((kingdom || KP).slice(0, 10), n || 2, { prophecy: pr, startActive: 0 });
// 選択待ちを CPU で解決しきる（アタックの被害者処理など）。
const drain = (s) => { let g = 0; while (s.pending && g++ < 200) { const a = DOM.cpu.decide(s); if (!a) break; s = E.reduce(s, a); } return s; };

console.log('=== R4 共通：予言は「カード」ではない／発動前は一切効かない ===');
{
  const s = off('bureaucracy');
  ok(!DOM.CARDS.bureaucracy, '予言は DOM.CARDS に入っていない（カードではない）');
  ok(s.prophecy === 'bureaucracy' && s.prophecyOn === false, '配られてはいるが発動していない');
  s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 1;
  const after = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(after.players[0].discard.filter((c) => c === 'copper').length === 0, '発動前は効かない');
  ok((DOM.PROPHECIES_RISINGSUN || []).length === 15, '予言は15種');
}

/* 川の社(River Shrine) は R3 で漏れていて R4a で足した前兆＝公式FAQ 4件を固定する。
   （予言ではないが、この4件は「クリンナップ開始時」バケツの順序＝好機到来と直接絡む） */
console.log('=== R4a: 川の社（River Shrine）の公式FAQ 4件 ===');
{
  const KR = ['river_shrine', 'tea_house', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine'];
  const mkR = () => E.createInitialState([{ name: 'A' }, { name: 'B', isCpu: true }], KR.slice(), { startActive: 0 });
  /* ① `It's cumulative, two River Shrines will gain you two cards.` */
  {
    let s = mkR();
    s.turn.phase = 'action'; s.turn.actions = 3;
    s.players[0].hand = ['river_shrine', 'river_shrine']; s.players[0].inPlay = []; s.players[0].discard = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'river_shrine' });
    s = E.reduce(s, { type: 'RIVER_SHRINE_TRASH', cards: [] });
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'river_shrine' });
    s = E.reduce(s, { type: 'RIVER_SHRINE_TRASH', cards: [] });
    s = E.reduce(s, { type: 'END_ACTION_PHASE' });
    s = E.reduce(s, { type: 'END_TURN' });
    let n = 0;
    while (s.pending && s.pending.type === 'river_shrine_gain' && n < 5) {
      n++; s = E.reduce(s, { type: 'RIVER_SHRINE_GAIN', card: 'silver' });
    }
    ok(n === 2, '川の社2枚＝**累積**して2回獲得する（実: ' + n + '）');
  }
  /* ② `Trashing cards with this is optional; you can gain a card even if you didn't trash any cards.` */
  {
    let s = mkR();
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['river_shrine', 'estate']; s.players[0].inPlay = []; s.players[0].discard = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'river_shrine' });
    s = E.reduce(s, { type: 'RIVER_SHRINE_TRASH', cards: [] });
    ok(s.trash.length === 0 && s.pending == null, '廃棄は任意＝0枚でも受理する');
    s = E.reduce(s, { type: 'END_ACTION_PHASE' });
    s = E.reduce(s, { type: 'END_TURN' });
    ok(s.pending && s.pending.type === 'river_shrine_gain', '1枚も廃棄しなくても獲得の窓は開く');
  }
  /* ③ `It doesn't matter if you gained cards in your Action phase, only if you did in your Buy phase.` */
  {
    let s = mkR();
    s.turn.phase = 'action'; s.turn.actions = 2;
    s.players[0].hand = ['river_shrine', 'workshop']; s.players[0].inPlay = []; s.players[0].discard = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'river_shrine' });
    s = E.reduce(s, { type: 'RIVER_SHRINE_TRASH', cards: [] });
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'workshop' });   // アクションフェイズに獲得
    let g = 0; while (s.pending && g++ < 30) { const a = DOM.cpu.decide(s); if (!a) break; s = E.reduce(s, a); }
    s = E.reduce(s, { type: 'END_ACTION_PHASE' });
    s = E.reduce(s, { type: 'END_TURN' });
    ok(s.pending && s.pending.type === 'river_shrine_gain', 'アクションフェイズの獲得は関係ない（窓は開く）');
  }
  /* ④ 購入フェイズに1枚でも獲得していたら開かない。
     ⚠ 判定は **`t.buyPhaseGained`**（ターン中一度も落ちない）＝継続(Continue)で購入フェイズが複数あっても
        「そのどれかで獲得したか」になる（公式FAQ #4）。隣の `t.bpGained` を掴むと公式違反。 */
  {
    let s = mkR();
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['river_shrine']; s.players[0].inPlay = []; s.players[0].discard = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'river_shrine' });
    s = E.reduce(s, { type: 'RIVER_SHRINE_TRASH', cards: [] });
    s = E.reduce(s, { type: 'END_ACTION_PHASE' });
    s.turn.coins = 3; s.turn.buys = 1;
    s = E.reduce(s, { type: 'BUY', card: 'silver' });             // 購入フェイズに獲得
    s = E.reduce(s, { type: 'END_TURN' });
    ok(s.pending == null, '購入フェイズに獲得していたら窓は開かない');
  }
  /* ④' 公式FAQ #4＝`If you have multiple Buy phases, such as via Continue, River Shrine only gains you a card
     if you didn't gain a card in **any** of those Buy phases.`
     🛑 これが **`t.bpGained` を掴んではいけない**理由＝`bpGained` は `END_ACTION_PHASE` で 0 に戻るので、
        継続でアクションフェイズに戻ってからもう一度購入フェイズに入ると**リセットされて窓が開いてしまう**
        （`t.buyPhaseGained` はターン中一度も落ちない）。 */
  {
    let s = E.createInitialState([{ name: 'A' }, { name: 'B', isCpu: true }],
      ['river_shrine', 'tea_house', 'workshop', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine'],
      { startActive: 0, events: ['continue'] });
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['river_shrine']; s.players[0].inPlay = []; s.players[0].discard = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'river_shrine' });
    s = E.reduce(s, { type: 'RIVER_SHRINE_TRASH', cards: [] });
    s = E.reduce(s, { type: 'END_ACTION_PHASE' });
    s.turn.coins = 3; s.turn.buys = 3;
    s = E.reduce(s, { type: 'BUY', card: 'silver' });          // 1回目の購入フェイズで獲得した
    ok(s.turn.buyPhaseGained === true, '1回目の購入フェイズで獲得した印が立つ');
    s = E.reduce(s, { type: 'BUY_EVENT', event: 'continue' }); // → アクションフェイズへ戻る
    let g = 0; while (s.pending && g++ < 30) { const a = DOM.cpu.decide(s); if (!a) break; s = E.reduce(s, a); }
    ok(s.turn.phase === 'action', '継続でアクションフェイズに戻っている');
    s = E.reduce(s, { type: 'END_ACTION_PHASE' });             // ← ここで t.bpGained が 0 に戻る
    s = E.reduce(s, { type: 'END_TURN' });
    ok(s.pending == null,
      '継続で購入フェイズが2回になっても「どちらかで獲得した」なら窓は開かない（bpGained を掴むとここで開く）');
  }
}

console.log('=== R4: 官僚制（Bureaucracy）===');
{
  let s = on('bureaucracy');
  s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 2;
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.players[0].discard.filter((c) => c === 'copper').length === 1, 'コスト0でない獲得で銅貨1枚');
  const c0 = s.players[0].discard.filter((c) => c === 'copper').length;
  s = E.reduce(s, { type: 'BUY', card: 'copper' });
  ok(s.players[0].discard.filter((c) => c === 'copper').length === c0 + 1,
    '銅貨($0)の獲得では配らない（コスト0＝対象外。獲得した1枚だけ増える）');
  /* 🛑 「ちょうど $0 か」は**3成分すべてが0か**（日本語wiki 逐語＝
     `コストがポーションだけのカード(ブドウ園など) や 負債だけのカード(絵師など) は、コスト0でないカード`）。
     **コイン成分だけ見ると負債コストとポーション費用を丸ごと取りこぼす**（実際に取りこぼしていた）。 */
  {
    const KB = ['tea_house', 'daimyo', 'artist', 'mountain_shrine', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar'];
    let sb = on('bureaucracy', KB, 2);
    const cop = (st) => st.players[0].discard.filter((c) => c === 'copper').length;
    sb.turn.phase = 'buy'; sb.turn.coins = 20; sb.turn.buys = 6;
    let b = cop(sb); sb = E.reduce(sb, { type: 'BUY', card: 'daimyo' });
    ok(cop(sb) - b === 1, '負債のみのカード（大名 $0+負債6）でも銅貨が付く（実: ' + (cop(sb) - b) + '）');
    sb.players[0].debt = 0; b = cop(sb); sb = E.reduce(sb, { type: 'BUY', card: 'artist' });
    ok(cop(sb) - b === 1, '絵師（$0+負債8）でも銅貨が付く');
    // ポーション費用（$0+P）＝ブドウ園。
    const KV = ['tea_house', 'vineyard', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine'];
    let sv = on('bureaucracy', KV, 2);
    sv.turn.phase = 'buy'; sv.turn.coins = 20; sv.turn.potions = 2; sv.turn.buys = 3;
    const bv = cop(sv); sv = E.reduce(sv, { type: 'BUY', card: 'vineyard' });
    ok(cop(sv) - bv === 1, 'ポーション費用のみのカード（ブドウ園 $0+P）でも銅貨が付く（実: ' + (cop(sv) - bv) + '）');
    // コストは**獲得した瞬間の現在値**＝軽減で $0 になっていれば付かない。
    let sr = on('bureaucracy', ['tea_house', 'bridge'].concat(K_NONE).slice(0, 10), 2);
    sr.turn.phase = 'buy'; sr.turn.coins = 10; sr.turn.buys = 3;
    sr.turn.costReduction = 3;              // 屋敷($2)が $0 になる
    const br = cop(sr); sr = E.reduce(sr, { type: 'BUY', card: 'estate' });
    ok(cop(sr) - br === 0, 'コスト軽減で $0 になったカードには付かない（獲得時の現在値で見る）');
  }
}

console.log('=== R4: 成長（Growth）＝財宝を獲得したとき、それより安いカード1枚を獲得（強制）===');
{
  let s = on('growth');
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = E.reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.pending && s.pending.type === 'growth_gain', '財宝の獲得で窓が開く');
  ok(s.pending.coin === 6, '基準は獲得した財宝のコスト（金貨＝$6）');
  const bad = E.reduce(s, { type: 'GROWTH_GAIN', card: 'gold' });
  ok(bad.pending && bad.pending.type === 'growth_gain', '同コストは受理しない（**厳密に安い**）');
  const good = E.reduce(s, { type: 'GROWTH_GAIN', card: 'silver' });
  ok(good.players[0].discard.indexOf('silver') >= 0, 'より安い財宝を獲得できる');
  /* ⚠ 獲得した銀貨自身がまた財宝＝成長がもう一度誘発する（**連鎖する**）。
     暴走は `triggerOnGain` の `_gainDepth > 6` ガードが止める（公式どおり＝止める必要は無い）。 */
  ok(good.pending && good.pending.type === 'growth_gain' && good.pending.coin === 3,
    '獲得した財宝がまた財宝なら連鎖する（次の基準＝銀貨の $3）');
  const cheap = E.reduce(good, { type: 'GROWTH_GAIN', card: 'copper' });
  ok(cheap.pending == null, '銅貨($0)を獲得すれば連鎖が止まる（$0 より安いカードは無い）');
  let s2 = on('growth');
  s2.turn.phase = 'buy'; s2.turn.coins = 6; s2.turn.buys = 1;
  s2 = E.reduce(s2, { type: 'BUY', card: 'estate' });
  ok(!(s2.pending && s2.pending.type === 'growth_gain'), '財宝でない獲得では窓を開かない');
}

console.log('=== R4: 進歩（Progress）＝獲得したカードを山札の上へ（強制・非対話）===');
{
  let s = on('progress');
  s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  const d0 = s.players[0].deck.length;
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.players[0].deck[0] === 'silver' && s.players[0].deck.length === d0 + 1, '獲得したカードが山札の一番上に乗る');
  ok(s.players[0].discard.indexOf('silver') < 0, '捨て札には行かない');
  ok(s.pending == null, '非対話＝窓を開かない');
}

console.log('=== R4: 偉大な指導者（Great Leader）＝アクションを使った「後」に +1アクション ===');
{
  let s = on('great_leader');
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['village']; s.players[0].inPlay = [];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(s.turn.actions === 3, '村＝1-1（使用）+2（村）+1（指導者）＝3アクション');
  let s2 = off('great_leader');
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  s2.players[0].hand = ['village']; s2.players[0].inPlay = [];
  s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'village' });
  ok(s2.turn.actions === 2, '発動前は +1アクションが付かない');
  /* 🛑 公式が名指しした唯一の例外＝雪深い村（このターン以降の +アクション をすべて無視）。
     日本語wiki の逐語＝「1アクション権所持の状態から雪深い村を使用した場合、残りアクション権は**4**」。
     ＝`t.actions += 1` を直書きすると落ちる（`addActions` を通している証明）。 */
  if (DOM.CARDS.snowy_village) {
    let s3 = on('great_leader', ['snowy_village'].concat(K_NONE).slice(0, 10), 2);
    s3.turn.phase = 'action'; s3.turn.actions = 1;
    s3.players[0].hand = ['snowy_village']; s3.players[0].inPlay = []; s3.players[0].deck = ['copper', 'copper'];
    s3 = E.reduce(s3, { type: 'PLAY_ACTION', card: 'snowy_village' });
    ok(s3.turn.actions === 4, '雪深い村＝1-1+4+0（指導者の+1は無視）＝4');
  }
  /* 🛑 最後の Sun を取り除いた前兆**自身も** +1アクションを受ける（公式 Other rules clarifications 逐語＝
     `the Omen that removed the last token will receive +1 Action.`）。
     ＝有効判定を「使用開始時にスナップショット」すると落ちる。 */
  let s4 = off('great_leader');
  s4.sunTokens = 1;
  s4.turn.phase = 'action'; s4.turn.actions = 1;
  s4.players[0].hand = ['tea_house']; s4.players[0].inPlay = []; s4.players[0].deck = ['copper', 'copper'];
  s4 = E.reduce(s4, { type: 'PLAY_ACTION', card: 'tea_house' });
  ok(s4.prophecyOn === true, '茶屋の +1 Sun で予言が有効になった');
  ok(s4.turn.actions === 2, 'その茶屋自身も +1アクションを受ける（1-1+1+1＝2）');
}

console.log('=== R4: 豊作（Good Harvest）＝名前の異なる財宝を初めて使うたび「先に」+1購入 +$1 ===');
{
  let s = on('good_harvest');
  s.turn.phase = 'buy'; s.players[0].hand = ['copper', 'copper', 'silver']; s.players[0].inPlay = [];
  const b0 = s.turn.buys;
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.buys === b0 + 1 && s.turn.coins === 2, '銅貨1枚目＝+1購入 +$1（＋銅貨の$1）');
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.buys === b0 + 1 && s.turn.coins === 3, '同名の2枚目は誘発しない（名前ごとに1ターン1回）');
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.turn.buys === b0 + 2 && s.turn.coins === 6, '名前が違えば誘発する（$1+$1+$2＋豊作$2）');
  /* 🛑 豊作は「**使用前**誘発」なので、最後の Sun を取り除いた前兆自身は受けない（日本語wiki 逐語）。
     ＝偉大な指導者／来寇と**結論が逆**になる非対称。 */
  let s2 = off('good_harvest');
  s2.sunTokens = 1;
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  s2.players[0].hand = ['tea_house']; s2.players[0].inPlay = []; s2.players[0].deck = ['copper', 'copper'];
  const b1 = s2.turn.buys;
  s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'tea_house' });
  ok(s2.prophecyOn === true && s2.turn.buys === b1, '起動した前兆自身は豊作を受けない（使用前誘発）');
}

console.log('=== R4: 来寇（Approaching Army）＝準備の11山目＋アタックの後に +$1 ===');
{
  // ① 準備＝11山目。**予言が発動しなくても追加される**（公式逐語）。
  let found = null;
  for (let i = 0; i < 12 && !found; i++) {
    const s = off('approaching_army', K_NONE, 2);
    if (s.armyCard) found = s;
  }
  ok(!!found, '来寇の11山目が立つ');
  if (found) {
    ok(DOM.isType(found.armyCard, 'attack'), '11山目は**アタックの王国カード**（' + found.armyCard + '）');
    ok(found.kingdom.length === 11, '王国が11山になる');
    ok((found.supply[found.armyCard] || 0) > 0, '普通のサプライ山＝購入も獲得もできる');
    ok(found.prophecyOn === false, '**予言が発動していなくても**山は追加されている');
    ok(K_NONE.indexOf(found.armyCard) < 0, '既に王国にあるカードは選ばない');
  }
  // ② +$1＝アタックを使った「後」。
  let s = on('approaching_army', ['militia'].concat(K_NONE).slice(0, 10), 2);
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['militia']; s.players[0].inPlay = [];
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper'];
  const c0 = s.turn.coins;
  s = drain(E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' }));
  ok(s.turn.coins === c0 + 2 + 1, '民兵＝+$2 ＋来寇の +$1');
  // ③ アタックでないアクションでは出ない。
  let s2 = on('approaching_army');
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  s2.players[0].hand = ['village']; s2.players[0].inPlay = [];
  const c1 = s2.turn.coins;
  s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'village' });
  ok(s2.turn.coins === c1, 'アタックでなければ +$1 は出ない');
  // ④ 最後の Sun を取り除いた前兆自身がアタック（狐）なら +$1 を受ける（誘発点が「後」）。
  let s3 = off('approaching_army');
  s3.sunTokens = 1;
  s3.turn.phase = 'action'; s3.turn.actions = 1;
  s3.players[0].hand = ['kitsune']; s3.players[0].inPlay = [];
  const c2 = s3.turn.coins;
  s3 = E.reduce(s3, { type: 'PLAY_ACTION', card: 'kitsune' });
  s3 = drain(E.reduce(s3, { type: 'KITSUNE_CHOOSE', choices: ['actions', 'silver'] }));
  ok(s3.prophecyOn === true && s3.turn.coins === c2 + 1, '起動した狐自身も +$1 を受ける');
}

console.log('=== R4: 厳冬（Harsh Winter）＝山に負債があれば取る／無ければ2個置く ===');
{
  let s = on('harsh_winter');
  s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 3;
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok((s.pileDebt || {}).silver === 2, '負債の無い山＝その山に負債2を置く');
  ok((s.players[0].debt || 0) === 0, 'このときプレイヤーは負債を負わない');
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok((s.pileDebt || {}).silver === 0 && (s.players[0].debt || 0) === 2, '次に同じ山から獲得＝山の負債を全部受け取る');
  // 🛑 「あなたのターン」＝相手のターンの獲得では置きも取りもしない（成長と共通化してはいけない）。
  let s2 = on('harsh_winter');
  s2.turn.active = 1;
  E.reduce(s2, { type: 'END_TURN' });
  ok(Object.keys(s2.pileDebt || {}).length === 0, '手番でないプレイヤーの獲得では何も起きない');
}

console.log('=== R4: 神器（Kind Emperor）＝ターン開始時＋最後の Sun を取り除いた瞬間 ===');
{
  // ① ターン開始時にアクション1枚を手札に獲得（コスト上限なし）。
  let s = on('kind_emperor');
  s = drain(E.reduce(s, { type: 'END_ACTION_PHASE' }));
  s = drain(E.reduce(s, { type: 'END_TURN' }));   // 相手の番
  s = drain(E.reduce(s, { type: 'END_ACTION_PHASE' }));
  s = E.reduce(s, { type: 'END_TURN' });          // 自分の番に戻る
  ok(s.pending && s.pending.type === 'kind_emperor_gain', 'ターン開始時に窓が開く');
  if (s.pending && s.pending.type === 'kind_emperor_gain') {
    const h0 = s.players[0].hand.length;
    const g = E.reduce(s, { type: 'KIND_EMPEROR_GAIN', card: 'market' });
    ok(g.players[0].hand.length === h0 + 1 && g.players[0].hand.indexOf('market') >= 0, '**手札に**獲得する');
    ok(g.players[0].discard.indexOf('market') < 0, '捨て札を経由しない');
    const bad = E.reduce(s, { type: 'KIND_EMPEROR_GAIN', card: 'silver' });
    ok(bad.pending && bad.pending.type === 'kind_emperor_gain', '財宝は受理しない（アクションだけ）');
  }
  // ② 最後の Sun を取り除いた瞬間にも1枚＝**同じターンに2枚あり得る**（1ターン1回のガードを入れてはいけない）。
  let s3 = off('kind_emperor');
  s3.sunTokens = 1;
  s3.turn.phase = 'action'; s3.turn.actions = 1;
  s3.players[0].hand = ['tea_house']; s3.players[0].inPlay = []; s3.players[0].deck = ['copper', 'copper'];
  s3 = E.reduce(s3, { type: 'PLAY_ACTION', card: 'tea_house' });
  ok(s3.prophecyOn === true, '茶屋で予言が有効になった');
  ok(s3.pending && s3.pending.type === 'kind_emperor_gain', 'その瞬間に窓が開く（prophecyQueue 経由＝上書きされない）');
}

console.log('=== R4: 病（Sickness）＝ちょうど3枚（民兵型の流用は公式違反）===');
{
  let s = on('sickness');
  s.turn.startQueue = null;
  s.pending = { type: 'sickness', player: 0 };
  s.players[0].hand = ['copper', 'copper', 'estate', 'estate', 'estate'];
  s.players[0].discard = [];
  const two = E.reduce(s, { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: ['copper', 'copper'] });
  ok(two.pending && two.pending.type === 'sickness', '**2枚では受理しない**（ちょうど3枚）');
  const four = E.reduce(s, { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: ['copper', 'copper', 'estate', 'estate'] });
  ok(four.pending && four.pending.type === 'sickness', '4枚でも受理しない');
  const three = E.reduce(s, { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: ['copper', 'copper', 'estate'] });
  ok(three.players[0].hand.length === 2 && three.players[0].discard.length === 3,
    '3枚ちょうど捨てる（手札5→2。「3枚になるまで」なら手札3で止まる）');
  const curse = E.reduce(s, { type: 'SICKNESS_CHOOSE', mode: 'curse' });
  ok(curse.players[0].deck[0] === 'curse', '呪いは**山札の上に**獲得する');
  ok(curse.players[0].discard.indexOf('curse') < 0, '捨て札を経由しない');
  // 手札3枚未満なら「あるだけ」。
  let s2 = on('sickness');
  s2.turn.startQueue = null;
  s2.pending = { type: 'sickness', player: 0 };
  s2.players[0].hand = ['copper', 'estate']; s2.players[0].discard = [];
  const both = E.reduce(s2, { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: ['copper', 'estate'] });
  ok(both.players[0].hand.length === 0 && both.pending == null, '手札が3枚未満なら**あるだけ**捨てる');
  // 呪いの山が空でも「呪いを獲得」を選べる（遂行できない選択肢も選べる＝終端保証）。
  let s3 = on('sickness');
  s3.turn.startQueue = null;
  s3.pending = { type: 'sickness', player: 0 };
  s3.supply.curse = 0;
  const empty = E.reduce(s3, { type: 'SICKNESS_CHOOSE', mode: 'curse' });
  ok(empty.pending == null, '呪いの山が空でも選べて窓は閉じる（人間が詰まない）');
}

console.log('=== R4: 急速拡大（Rapid Expansion）＝略奪の「せっかちな」と同じ器 ===');
{
  let s = on('rapid_expansion');
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = E.reduce(s, { type: 'BUY', card: 'market' });
  ok((s.players[0].eventSetAside || []).indexOf('market') >= 0, 'アクションの獲得＝脇に置く');
  ok(s.players[0].discard.indexOf('market') < 0, '捨て札には行かない');
  let s2 = on('rapid_expansion');
  s2.turn.phase = 'buy'; s2.turn.coins = 6; s2.turn.buys = 1;
  s2 = E.reduce(s2, { type: 'BUY', card: 'estate' });
  ok((s2.players[0].eventSetAside || []).length === 0, '勝利点は対象外（アクションか財宝だけ）');
  let s3 = on('rapid_expansion');
  s3.turn.phase = 'buy'; s3.turn.coins = 6; s3.turn.buys = 1;
  s3 = E.reduce(s3, { type: 'BUY', card: 'silver' });
  ok((s3.players[0].eventSetAside || []).indexOf('silver') >= 0, '財宝も対象');
  // 次の自分のターンの開始時に使用する（既存の event_play が強制使用する）。
  s = drain(E.reduce(s, { type: 'END_TURN' }));
  s = drain(E.reduce(s, { type: 'END_ACTION_PHASE' }));
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'event_play', '次の自分のターンの開始時に「使用する」窓が開く');
}

console.log('=== R4: 好機到来（Biding Time）＝ドロー5枚は普通に行う ===');
{
  let s = on('biding_time');
  s.turn.phase = 'buy';
  s.players[0].hand = ['copper', 'copper', 'estate'];
  s = E.reduce(s, { type: 'END_TURN' });
  ok((s.players[0].bidingAside || []).length === 3, 'クリンナップ開始時に手札3枚が脇へ');
  ok(s.players[0].hand.length === 5, '🛑 **ドロー5枚は普通に行う**（手札は空にならない＝相手のターンもリアクションできる）');
  s = drain(E.reduce(s, { type: 'END_ACTION_PHASE' }));
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.players[0].hand.length === 8, '次の自分のターンの開始時に手札へ加える＝**5枚＋脇の枚数**');
  ok((s.players[0].bidingAside || []).length === 0, '脇は空になる');
  // 脇札は所有カード（保存則・得点に数える）。
  let s2 = on('biding_time');
  s2.players[0].bidingAside = ['province'];
  ok(E.allCards(s2.players[0]).indexOf('province') >= 0, '脇札は allCards に入る（保存則 tally の対象）');
  // 相手には伏せて配信される。
  const masked = E.maskStateFor(s2, 1);
  ok((masked.players[0].bidingAside || [])[0] === 'back', '相手には中身が見えない（伏せ札）');
}

console.log('=== R4: 狼狽（Panic）＝2つの効果は完全に独立 ===');
{
  let s = on('panic');
  s.turn.phase = 'buy'; s.players[0].hand = ['copper', 'copper']; s.players[0].inPlay = [];
  const b0 = s.turn.buys;
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.buys === b0 + 2, '財宝を使うたび +2購入');
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.buys === b0 + 4, '**毎回**（名前ごとではない）');
  const sup0 = s.supply.copper;
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.supply.copper === sup0 + 2, '場から捨てるとき**その山に戻る**');
  ok(s.players[0].discard.filter((c) => c === 'copper').length === 0, '捨て札には残らない');
  /* 🛑 2つの効果は独立＝場に出した**後**に発動しても「戻す」だけは起きる（公式FAQ逐語＝
     `you don't get the +2 Buys but do return the Treasure to its pile.`）。
     ＝「使用時に旗を立てて片付けで見る」実装だと落ちる。 */
  let s2 = off('panic');
  s2.turn.phase = 'buy'; s2.players[0].hand = ['copper']; s2.players[0].inPlay = [];
  s2 = E.reduce(s2, { type: 'PLAY_TREASURE', card: 'copper' });
  const b1 = s2.turn.buys;
  s2.prophecyOn = true; s2.sunTokens = 0;   // 場に出した**後**に発動
  const sup1 = s2.supply.copper;
  s2 = E.reduce(s2, { type: 'END_TURN' });
  ok(b1 === 1, '発動前に使った財宝には +2購入は付かない');
  ok(s2.supply.copper === sup1 + 1, 'それでも「山に戻す」だけは起きる（2つの効果は独立）');
}

console.log('=== R4: 盛大な取引（Flourishing Trade）===');
{
  const s = on('flourishing_trade');
  ok(E.cardCost(s, 'province') === 7, 'すべてのカードのコストが $1 下がる（属州 $8→$7）');
  ok(E.cardCost(s, 'copper') === 0, '$0未満にはならない');
  ok(E.scoringCost(s, 'estate').coin === 1, '**得点計算にも効く**（屋敷 $2→$1）＝高原の羊飼いが動く');
  const s0 = off('flourishing_trade');
  ok(E.cardCost(s0, 'province') === 8 && E.scoringCost(s0, 'estate').coin === 2, '発動前は下がらない');
  // アクション権を購入権として使う（置換型）。
  let s2 = on('flourishing_trade');
  s2.turn.phase = 'buy'; s2.turn.coins = 20; s2.turn.buys = 1; s2.turn.actions = 2;
  ok(E.buysAvailable(s2, 0) === 3, '購入権1＋アクション権2＝3回買える');
  s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
  ok(s2.turn.buys === 0 && s2.turn.actions === 2, '1回目は購入権から消費する');
  s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
  ok(s2.turn.buys === 0 && s2.turn.actions === 1, '購入権が尽きたらアクション権を消費する');
  s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
  s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
  ok(s2.players[0].discard.filter((c) => c === 'silver').length === 3, '4回目は拒否される（合計3回）');
  // アクションフェイズでは変換しない（購入フェイズだけ）。
  let s3 = on('flourishing_trade');
  s3.turn.phase = 'action'; s3.turn.buys = 0; s3.turn.actions = 3;
  ok(E.buysAvailable(s3, 0) === 0, 'アクションフェイズでは購入権に回せない');
}

console.log('=== R4: 悟り（Enlightenment）===');
{
  let s = on('enlightenment');
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['copper']; s.players[0].inPlay = []; s.players[0].deck = ['estate', 'estate'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'copper' });
  ok(s.players[0].inPlay.indexOf('copper') >= 0, '財宝をアクションフェイズに使える');
  ok(s.turn.coins === 0, '🛑 **コインは出ない**（指示に従う「代わりに」）');
  ok(s.turn.actions === 1 && s.players[0].hand.length === 1, '+1カード +1アクション（＝キャントリップ）');
  let s2 = off('enlightenment');
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  s2.players[0].hand = ['copper']; s2.players[0].inPlay = [];
  const r = E.reduce(s2, { type: 'PLAY_ACTION', card: 'copper' });
  ok(r.players[0].inPlay.length === 0, '発動前は財宝をアクションとして使えない');
  // 購入フェイズでは通常どおり。
  let s3 = on('enlightenment');
  s3.turn.phase = 'buy'; s3.players[0].hand = ['copper']; s3.players[0].inPlay = [];
  s3 = E.reduce(s3, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s3.turn.coins === 1, '購入フェイズでは通常どおり +$1');
  ok(E.isActionFor(on('enlightenment'), 'copper') === true, '`isActionFor`＝悟り下では銅貨もアクション');
  ok(E.isActionFor(off('enlightenment'), 'copper') === false, '発動前は静的判定と同じ');
  // 得点計算＝ブドウ園が財宝も数える（資本主義とは真逆に「得点にも効く」）。
  if (DOM.CARDS.vineyard) {
    const score = (pr) => {
      const st = pr ? on(pr, ['vineyard'].concat(K_NONE).slice(0, 10), 2) : off('bureaucracy', ['vineyard'].concat(K_NONE).slice(0, 10), 2);
      st.players.forEach((pl) => { pl.deck = []; pl.hand = []; pl.discard = []; pl.inPlay = []; pl.durationCards = []; });
      st.players[0].discard = ['vineyard', 'copper', 'copper', 'copper', 'village', 'village', 'village'];
      return E.scoreGame(st).scores[0].vp;
    };
    ok(score('enlightenment') === 2, '悟り下＝アクション3＋財宝3＝6枚→2点');
    ok(score(null) === 1, '悟り無し＝アクション3枚→1点');
  }
}

console.log('=== R4: 神風（Divine Wind）＝準備手順がゲーム中に再走する唯一の機構 ===');
{
  const KD = ['tea_house', 'village', 'smithy', 'market', 'laboratory', 'festival', 'militia', 'moat', 'cellar', 'mine'];
  let s = off('divine_wind', KD, 2);
  s.sunTokens = 1;
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['tea_house']; s.players[0].inPlay = []; s.players[0].deck = ['copper', 'copper'];
  const old = s.kingdom.slice();
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'tea_house' });
  ok(s.kingdomEpoch === 1, '王国が入れ替わった印（保存則ハーネスが基準を取り直す）');
  ok(s.kingdom.length >= 10, '新しく10山が配られた');
  ok(old.every((k) => s.kingdom.indexOf(k) < 0), '旧10山は1つも残っていない');
  ok(old.every((k) => s.supply[k] === undefined),
    '🛑 `supply[k]=0` ではなく **delete**（0 だと `emptyPileCount` が「空」と数えて3山終了が即成立する）');
  ok(E.emptyPileCount(s) === 0, '撤去した山は「空の山」に数えない（公式）');
  ok(s.players[0].inPlay.indexOf('tea_house') >= 0, '既に自分のものになったカードはそのまま使い続けられる');
  ok(s.supply.copper != null && s.supply.province != null && s.supply.curse != null, '基本カードの山は撤去しない');
  ok(s.prophecy === 'divine_wind' && s.prophecyOn === true, '**予言は配り直さない**（公式は Ally しか名指ししていない）');
  ok(!E.canReturnToPile(s, old[1]), '撤去した山にはカードを戻せない（濡女／狼狽が湧かない）');
  /* 🛑 **保存則ハーネスの盲点を塞ぐ独立した不変条件**（敵対レビューの指摘）。
     `test/invariants.test.js` は神風が起きたら `state.kingdomEpoch` を見て **基準を全面リセット**するので、
     「神風による正当な撤去」と「同時に起きた別の複製/消失バグ」を**原理的に区別できない**。
     そこで別軸で固定する＝**神風はサプライしか触らない**＝
     「全プレイヤーの所有カード＋廃棄置き場は1枚も動かない」。 */
  {
    const KD2 = ['tea_house', 'village', 'smithy', 'market', 'laboratory', 'festival', 'militia', 'moat', 'cellar', 'mine'];
    const tallyOwned = (st) => {
      const t = {};
      st.players.forEach((pl) => E.allCards(pl).forEach((c) => { t[c] = (t[c] || 0) + 1; }));
      (st.trash || []).forEach((c) => { t[c] = (t[c] || 0) + 1; });
      return JSON.stringify(Object.keys(t).sort().map((k) => k + ':' + t[k]));
    };
    let bad = 0, fired = 0;
    for (let i = 0; i < 12; i++) {
      let g = E.createInitialState([{ name: 'A', isCpu: true }, { name: 'B', isCpu: true }], KD2.slice(),
        { prophecy: 'divine_wind', startActive: 0 });
      // 数ターン進めてデッキ・捨て札・廃棄置き場に中身を作ってから発動させる。
      let step = 0;
      while (!g.gameOver && step++ < 40) { const a = DOM.cpu.decide(g); if (!a) break; g = E.reduce(g, a); }
      if (g.gameOver) continue;
      g.sunTokens = 1;
      const before = tallyOwned(g);
      const who = g.turn.active;
      E.removeSun(g, who);            // ← ここで神風が発火する
      if ((g.kingdomEpoch || 0) === 0) continue;
      fired++;
      if (tallyOwned(g) !== before) bad++;
    }
    ok(fired > 0, '神風の発動をソークで再現できた（' + fired + '回）');
    ok(bad === 0, '神風は「全プレイヤーの所有カード＋廃棄置き場」を1枚も動かさない（違反 ' + bad + '件）');
  }
  // CPU が神風の後も最後まで走れる（人間が詰まない／livelock しない）。
  let done = 0;
  for (let np = 2; np <= 4; np++) {
    let g = E.createInitialState(Array.from({ length: np }, (_, i) => ({ name: 'P' + i, isCpu: true })), KD.slice(),
      { prophecy: 'divine_wind', startActive: 0 });
    g.sunTokens = 1;
    g.players[0].hand.push('tea_house'); g.turn.actions = Math.max(1, g.turn.actions);
    g = E.reduce(g, { type: 'PLAY_ACTION', card: 'tea_house' });
    if ((g.kingdomEpoch || 0) === 0) continue;
    let step = 0;
    while (!g.gameOver && step++ < 20000) { const a = DOM.cpu.decide(g); if (!a) break; g = E.reduce(g, a); }
    if (g.gameOver) done++;
  }
  ok(done === 3, '神風発動後に CPU が 2〜4人とも最後まで走れる（膠着0）');
}

/* ===== 敵対レビュー（多エージェント・node/jsdom で再現確定）の回帰 =====
   ここに載っているのは**全部いちど本当に壊れていた**もの。次に壊したら赤くなる。 */
console.log('=== R5/R6 敵対レビューの回帰 ===');
{
  const F2 = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'];
  const mk2 = (K, opt) => E.createInitialState([{ name: 'A' }, { name: 'B', isCpu: true }], K.slice(),
    Object.assign({ startActive: 0 }, opt || {}));

  /* ① 継続＝カード文の順序（`… play it. **+1 Action and +1 Buy.**`）＝ボーナスは**使用の後**。
     雪深い村（このターン以降の +アクションを全部無視）で観測できる唯一の窓。 */
  if (DOM.CARDS.snowy_village) {
    let s1 = mk2(['snowy_village', 'poet'].concat(F2).slice(0, 10), { events: ['continue'] });
    s1.turn.phase = 'buy'; s1.turn.coins = 0; s1.turn.buys = 1; s1.turn.actions = 1;
    s1.players[0].hand = []; s1.players[0].deck = new Array(8).fill('copper'); s1.players[0].discard = [];
    s1 = E.reduce(s1, { type: 'BUY_EVENT', event: 'continue' });
    s1 = E.reduce(s1, { type: 'CONTINUE_GAIN', card: 'snowy_village' });
    ok(s1.turn.actions === 5, '継続×雪深い村＝1+4＝5アクション（継続の +1 は無視される。実: ' + s1.turn.actions + '）');
  }
  /* ①' 普通のカードなら +1アクション +1購入 はちゃんと入る（①だけだと「ボーナスを消しても緑」になる）。 */
  {
    let s1b = mk2(['poet'].concat(F2).slice(0, 10), { events: ['continue'] });
    s1b.turn.phase = 'buy'; s1b.turn.coins = 0; s1b.turn.buys = 1; s1b.turn.actions = 1;
    s1b.players[0].hand = []; s1b.players[0].deck = new Array(8).fill('copper'); s1b.players[0].discard = [];
    s1b = E.reduce(s1b, { type: 'BUY_EVENT', event: 'continue' });
    const b1 = s1b.turn.buys;
    s1b = E.reduce(s1b, { type: 'CONTINUE_GAIN', card: 'village' });
    ok(s1b.turn.actions === 1 - 0 + 2 + 1, '継続×村＝1+2（村）+1（継続）＝4アクション（実: ' + s1b.turn.actions + '）');
    ok(s1b.turn.buys === b1 + 1, '継続で +1購入（実: ' + (s1b.turn.buys - b1) + '）');
    ok(s1b.turn.phase === 'action', 'アクションフェイズに戻っている');
  }
  /* ② 継続＝「購入フェイズ終了時」窓（ワイン商）は**戻る瞬間**に判定する（使用で増えたコインを含めない）。 */
  if (DOM.CARDS.wine_merchant && DOM.CARDS.poacher) {
    let s2 = mk2(['wine_merchant', 'poacher'].concat(F2).slice(0, 10), { events: ['continue'] });
    s2.turn.phase = 'buy'; s2.turn.coins = 1; s2.turn.buys = 1;
    s2.players[0].tavern = ['wine_merchant']; s2.players[0].hand = [];
    s2.players[0].deck = new Array(8).fill('copper'); s2.players[0].discard = [];
    s2 = E.reduce(s2, { type: 'BUY_EVENT', event: 'continue' });
    s2 = E.reduce(s2, { type: 'CONTINUE_GAIN', card: 'poacher' });
    ok(!(s2.pending && s2.pending.type === 'wine_merchant'),
      '継続×ワイン商＝$1 の時点で判定するので窓は開かない（密猟者の +$1 を含めない）');
  }
  /* ③④ 悟り＝場の財宝もアクション。海上交易と蓄積は**同じ述語**を共有する（公式FAQ が両者を結んでいる）。 */
  {
    let s3 = mk2(DOM.KINGDOM_RISINGSUN, { events: ['sea_trade'], prophecy: 'enlightenment' });
    s3.prophecyOn = true; s3.sunTokens = 0;
    s3.turn.phase = 'buy'; s3.turn.coins = 4; s3.turn.buys = 1;
    s3.players[0].inPlay = ['copper', 'copper', 'copper'];
    s3.players[0].hand = new Array(5).fill('estate');
    s3.players[0].deck = new Array(6).fill('silver'); s3.players[0].discard = [];
    s3 = E.reduce(s3, { type: 'BUY_EVENT', event: 'sea_trade' });
    ok(s3.players[0].hand.length - 5 === 3, '海上交易×悟り＝場の銅貨3枚で +3カード（実: ' + (s3.players[0].hand.length - 5) + '）');
    ok(s3.pending && s3.pending.max === 3, '廃棄の上限も3（最初に数えた場のアクション枚数）');
    let s4 = mk2(DOM.KINGDOM_RISINGSUN, { events: ['amass'], prophecy: 'enlightenment' });
    s4.prophecyOn = true; s4.sunTokens = 0;
    s4.turn.phase = 'buy'; s4.turn.coins = 4; s4.turn.buys = 1;
    s4.players[0].inPlay = ['copper', 'copper'];
    s4 = E.reduce(s4, { type: 'BUY_EVENT', event: 'amass' });
    ok(s4.pending == null, '蓄積×悟り＝場に財宝があれば「アクションがある」＝獲得しない（逆向きの同じ穴）');
  }
  /* ⑤ 稽古＝相続(Inheritance)した屋敷も対象（「手札から使わせる」窓は全部これを通す）。 */
  {
    let s5 = mk2(F2.concat(['mine']).slice(0, 10), { events: ['inheritance', 'practice'] });
    s5.turn.phase = 'buy'; s5.turn.coins = 7; s5.turn.buys = 2;
    s5 = E.reduce(s5, { type: 'BUY_EVENT', event: 'inheritance' });
    s5 = E.reduce(s5, { type: 'INHERITANCE_SET', card: 'village' });
    s5.players[0].hand = ['estate', 'estate', 'copper'];
    ok(E.practiceTargets(s5, 0).indexOf('estate') >= 0, '稽古の候補に相続した屋敷が入る');
  }
  /* ⑥ 参集＝**pending を先に閉じてから獲得する**（植民 Populate 型）＝獲得時リアクション窓を潰さない。
     finishGain を使うと望楼などの「pending が無いときだけ」ゲートに引っかかり、1回の購入で3窓潰れる。 */
  if (DOM.CARDS.watchtower) {
    let s6 = mk2(['watchtower'].concat(F2).slice(0, 10), { events: ['gather'] });
    s6.turn.phase = 'buy'; s6.turn.coins = 7; s6.turn.buys = 1;
    s6.players[0].hand = ['watchtower'];
    s6 = E.reduce(s6, { type: 'BUY_EVENT', event: 'gather' });
    s6 = E.reduce(s6, { type: 'GATHER_GAIN', card: 'village' });
    ok(s6.pending && s6.pending.type === 'watchtower', '参集の獲得で望楼の窓が開く（実: ' + (s6.pending && s6.pending.type) + '）');
  }
  /* ⑦ 稽古×悟り＝財宝を選んだら**2回とも効果が出る**（素の replay は applyEffect＝財宝では case が無く空振り）。 */
  {
    let s7 = mk2(DOM.KINGDOM_RISINGSUN, { events: ['practice'], prophecy: 'enlightenment' });
    s7.prophecyOn = true; s7.sunTokens = 0;
    s7.turn.phase = 'buy'; s7.turn.coins = 10; s7.turn.buys = 3;
    s7.players[0].hand = ['silver'];
    s7 = E.reduce(s7, { type: 'BUY_EVENT', event: 'practice' });
    const c0 = s7.turn.coins;
    s7 = E.reduce(s7, { type: 'PRACTICE_PLAY', card: 'silver' });
    ok(s7.turn.coins - c0 === 4, '稽古×悟り×銀貨＝$2×2＝+$4（実: ' + (s7.turn.coins - c0) + '）');
  }
  /* ⑧ 神風の一意カード除外＝川船の脇札は**トップレベル `state.riverboatCard`**（`pl.riverboatCard` は常に undefined）。 */
  {
    let hit = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const st = E.createInitialState(['P0', 'P1'], ['riverboat', 'tea_house'].concat(F2).slice(0, 10),
        { startActive: 0, prophecy: 'divine_wind' });
      if (!st.riverboatCard) continue;
      n++;
      const rc = st.riverboatCard;
      let g = 0; while (!st.prophecyOn && g++ < 40) E.removeSun(st, 0);
      if ((st.kingdom || []).includes(rc)) hit++;
    }
    ok(n > 0 && hit === 0, '神風は川船の脇札を新しい王国山に選ばない（' + hit + '/' + n + '）');
  }
  /* ⑨ 金継ぎの「このゲーム中に金貨を獲得したか」＝普通の獲得で記録され、**廃棄しても消えない**（獲得歴）。
     ⚠ engine 側ではこのフラグを `_gainDepth > 6` の暴走防止ガードより**前**に置いてある
        （深くネストした獲得の金貨を取りこぼすと金継ぎが過小判定になる）。 */
  {
    let s9 = mk2(DOM.KINGDOM_RISINGSUN, { events: ['kintsugi'] });
    ok(!s9.players[0].gainedGoldThisGame, '開始時は金貨を獲得していない');
    s9.turn.phase = 'buy'; s9.turn.coins = 20; s9.turn.buys = 3;
    s9 = E.reduce(s9, { type: 'BUY', card: 'gold' });
    ok(s9.players[0].gainedGoldThisGame === true, '金貨を獲得すると記録される');
    // 廃棄しても消えない（所持ではなく獲得歴）。
    s9.players[0].hand = ['gold', 'estate'];
    s9.pending = { type: 'kintsugi_trash', player: 0 };
    const s9b = E.reduce(s9, { type: 'KINTSUGI_TRASH', card: 'gold' });
    ok(s9b.players[0].gainedGoldThisGame === true, '金貨を廃棄しても獲得歴は消えない');
    // 再開網は同じ reduce の末尾で消化されるので、返ってきた時点では獲得段が開いている。
    ok(s9b.pending && s9b.pending.type === 'kintsugi_gain',
      '金貨を獲得済みなら獲得段が開く（実: ' + (s9b.pending && s9b.pending.type) + '）');
    // 金貨を1枚も獲得していなければ獲得段は開かない。
    let s9c = mk2(DOM.KINGDOM_RISINGSUN, { events: ['kintsugi'] });
    s9c.turn.phase = 'buy'; s9c.turn.coins = 3; s9c.turn.buys = 1;
    s9c.players[0].hand = ['estate'];
    s9c = E.reduce(s9c, { type: 'BUY_EVENT', event: 'kintsugi' });
    s9c = E.reduce(s9c, { type: 'KINTSUGI_TRASH', card: 'estate' });
    ok(s9c.pending == null, '金貨を獲得していなければ廃棄だけで終わる（獲得段は開かない）');
  }
}

console.log('=== R5: イベントの公式FAQ 検算（蓄積／苦行／信用／海上交易）===');
{
  const KR = DOM.KINGDOM_RISINGSUN;
  const mk2 = (K, opt) => E.createInitialState([{ name: 'A' }, { name: 'B', isCpu: true }], K.slice(),
    Object.assign({ startActive: 0 }, opt || {}));
  const buyEv = (s, ev) => { s.turn.phase = 'buy'; s.turn.buys = 1; return E.reduce(s, { type: 'BUY_EVENT', event: ev }); };

  /* 蓄積（Amass）＝公式FAQ 逐語
     `Duration cards in play that were played on previous turns will stop Amass from gaining an Action card.`
     `Cards you played this turn but which are no longer in play, such as Horse, will not.`
     ＝**場の実物だけを見る**（`inPlay` ＋ `durationCards`）。プレイ履歴カウンタを見てはいけない。 */
  {
    let s = mk2(KR, { events: ['amass'] }); s.turn.coins = 2;
    s.players[0].inPlay = []; s.players[0].durationCards = [];
    s = buyEv(s, 'amass');
    ok(s.pending && s.pending.type === 'amass_gain', '蓄積：場にアクション0枚 → 窓が開く');

    let s2 = mk2(KR, { events: ['amass'] }); s2.turn.coins = 2;
    s2.players[0].inPlay = []; s2.players[0].durationCards = ['fishmonger'];
    s2 = buyEv(s2, 'amass');
    ok(s2.pending == null, '蓄積：**前のターンに使った持続**が場にあると空振り（公式FAQ が名指し）');

    /* 🛑 `p.durationCards` には永続持続（雇人／チャンピオン／尽きぬ杯／操舵手／王子）が**居座る**＝
       1枚でも場に出したら蓄積はそれ以降ほぼ永久に空振りする（逆に海上交易は永久に強くなる）。 */
    let s3 = mk2(KR, { events: ['amass'] }); s3.turn.coins = 2;
    s3.players[0].inPlay = []; s3.players[0].durationCards = ['hireling'];
    s3 = buyEv(s3, 'amass');
    ok(s3.pending == null, '蓄積：永続持続（雇人）でも空振り');

    let s4 = mk2(KR, { events: ['amass'] }); s4.turn.coins = 2;
    s4.players[0].inPlay = ['gold', 'silver']; s4.players[0].durationCards = [];
    s4 = buyEv(s4, 'amass');
    ok(s4.pending && s4.pending.type === 'amass_gain', '蓄積：場が財宝だけなら獲得できる（悟り無し）');

    // 悟り(Enlightenment) が発動していれば場の財宝も「アクション」＝空振り（海上交易と同じ述語 `isActionFor`）。
    let s5 = mk2(KR, { events: ['amass'] });
    s5.prophecy = 'enlightenment'; s5.sunTokens = 0; s5.prophecyOn = true;
    s5.turn.coins = 2; s5.players[0].inPlay = ['gold']; s5.players[0].durationCards = [];
    s5 = buyEv(s5, 'amass');
    ok(s5.pending == null, '蓄積：悟り発動中は場の財宝もアクション＝空振り');
  }

  /* 苦行（Asceticism）＝`Pay any amount of $ to trash that many cards from your hand.`
     公式FAQ＝`you could pay an additional $3 — so $5 total — and trash 3 cards`（$2 を払った**後**の追加）。
     🛑 過払い(Overpay) 機構に乗せてはいけない（wiki が `its text doesn't use that term` と明示）。
     ⚠ 【裁定未確認】手札枚数を超えて払えるかの公式文が無い＝`min(残コイン, 手札枚数)` に丸める安全側。 */
  {
    let s = mk2(KR, { events: ['asceticism'] }); s.turn.coins = 7;
    s.players[0].hand = ['copper', 'estate'];
    s = buyEv(s, 'asceticism');
    ok(s.pending && s.pending.type === 'asceticism_pay' && s.pending.max === 2,
      '苦行：上限は min(残コイン5, 手札2)=2（実: ' + (s.pending && s.pending.max) + '）');
    const z = E.reduce(s, { type: 'ASCETICISM_PAY', amount: 0 });
    ok(z.pending == null && z.turn.coins === 5, '苦行：0 を選べる（"any amount"＝払わないのも合法）');
    ok(E.reduce(s, { type: 'ASCETICISM_PAY', amount: 3 }).pending.type === 'asceticism_pay', '苦行：上限超えは拒否');
    const p2 = E.reduce(s, { type: 'ASCETICISM_PAY', amount: 2 });
    ok(p2.turn.coins === 3 && p2.pending.type === 'asceticism_trash' && p2.pending.need === 2,
      '苦行：追加$2 を支払って2段目が need=2 で開く');
    ok(E.reduce(p2, { type: 'ASCETICISM_TRASH', cards: ['copper'] }).pending.type === 'asceticism_trash',
      '苦行：ちょうど N 枚でなければ拒否（強制）');
    const p3 = E.reduce(p2, { type: 'ASCETICISM_TRASH', cards: ['copper', 'estate'] });
    ok(p3.pending == null && p3.players[0].hand.length === 0, '苦行：ちょうど2枚廃棄された');

    let s6 = mk2(KR, { events: ['asceticism'] }); s6.turn.coins = 7; s6.players[0].hand = [];
    s6 = buyEv(s6, 'asceticism');
    ok(s6.pending == null, '苦行：手札0枚なら窓を開かない');

    // 廃棄は1枚ずつ（礼拝堂/神殿と揃える）＝`trashCard` を通るので城塞が手札に戻る。
    let s7 = mk2(['fortress', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine', 'laboratory', 'festival'],
      { events: ['asceticism'] });
    s7.turn.coins = 4; s7.players[0].hand = ['fortress', 'copper'];
    s7 = buyEv(s7, 'asceticism');
    s7 = E.reduce(s7, { type: 'ASCETICISM_PAY', amount: 2 });
    s7 = E.reduce(s7, { type: 'ASCETICISM_TRASH', cards: ['fortress', 'copper'] });
    ok(s7.players[0].hand.indexOf('fortress') >= 0, '苦行：城塞は廃棄されても手札に戻る（trashCard を通っている）');
  }

  /* 信用（Credit）＝`Gain an Action or Treasure costing up to $8. +D equal to its cost.`
     公式FAQ＝`This can't gain cards with D in the cost.` / `It also can't gain cards with P in the cost.`
     🛑 **夜行カードの除外リストを書いてはいけない**＝人狼（アクション+夜行+アタック+不運）は
        `Gain an Action or Treasure` に合致する＝**取れるのが正しい**（mix-all で今日到達可能）。 */
  {
    let s = mk2(['werewolf', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine', 'laboratory', 'festival'],
      { events: ['credit'] });
    s.turn.coins = 2; s = buyEv(s, 'credit');
    const okC = E.creditCanGain(s);
    ok(okC('werewolf'), '信用：人狼（アクション+夜行）は取れる＝夜行の除外リストを書いていない');
    ok(okC('gold') && !okC('province'), '信用：財宝は取れる／勝利点は取れない');
    ok(E.reduce(s, { type: 'CREDIT_GAIN', card: 'werewolf' }).players[0].debt === 5, '信用：人狼($5)で負債5');

    ok(!E.creditCanGain(mk2(['engineer', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine',
      'laboratory', 'festival'], { events: ['credit'] }))('engineer'), '信用：負債コスト（技術者）は取れない（公式）');
    ok(!E.creditCanGain(mk2(['transmute', 'vineyard', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar',
      'mine', 'laboratory'], { events: ['credit'] }))('transmute'), '信用：ポーション費用（変成）は取れない（公式）');

    /* 公式FAQ 逐語＝`If the gained card's cost changes when you gain it (e.g., the card is Destrier),
       take D based on the **new** cost, not the old cost.`
       ⚠ 本アプリの既存慣行（現場監督＝獲得**前**のコスト）と**逆**＝共通ヘルパに寄せてはいけない。 */
    let s5 = mk2(['destrier', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine', 'laboratory',
      'festival'], { events: ['credit'] });
    s5.turn.coins = 2; s5.turn.gainedThisTurn = [];
    const before = E.cardCost(s5, 'destrier');
    s5 = buyEv(s5, 'credit');
    s5 = E.reduce(s5, { type: 'CREDIT_GAIN', card: 'destrier' });
    ok(before === 6 && E.cardCost(s5, 'destrier') === 5, 'デストリエは獲得でコストが 6→5 に下がる');
    ok(s5.players[0].debt === 5, '信用：負債は**獲得後**の 5（獲得前の6ではない）＝公式');

    /* 公式FAQ 逐語＝`If you play Possession and have them buy Credit, they don't gain the card (you do),
       which means there's **no D given to any player**.` ＝§0-23 の「負債は支配者が負う」と正面から逆。 */
    let s6 = mk2(['werewolf', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine', 'laboratory',
      'festival'], { events: ['credit'] });
    s6.turn.coins = 2; s6.turn.possessedBy = 1;
    s6 = buyEv(s6, 'credit');
    s6 = E.reduce(s6, { type: 'CREDIT_GAIN', card: 'werewolf' });
    ok((s6.players[0].debt || 0) === 0 && (s6.players[1].debt || 0) === 0,
      '信用：支配(Possession) 中は**どのプレイヤーも**負債を負わない（公式）');
  }

  /* 海上交易（Sea Trade）＝`+1 Card per Action card you have in play. Trash up to that many cards from your hand.`
     🛑 公式FAQ 逐語＝`Draw that many cards, then trash up to **that many** cards`
        ＝廃棄の上限は「**最初に数えた場のアクション枚数**」であって「実際に引けた枚数」ではない。
        ここを「引いた枚数」で書くと**静かに弱くなり、テストでも気づきにくい**（正本が回帰テストを名指し）。 */
  {
    let s = mk2(KR, { events: ['sea_trade'] }); s.turn.coins = 4;
    s.players[0].inPlay = ['village', 'smithy', 'market'];
    s.players[0].hand = ['copper', 'copper', 'estate', 'estate'];
    s.players[0].deck = []; s.players[0].discard = [];      // 山札も捨て札も空＝1枚も引けない
    s = buyEv(s, 'sea_trade');
    ok(s.pending && s.pending.max === 3,
      '海上交易：1枚も引けなくても廃棄の上限は3（実: ' + (s.pending && s.pending.max) + '）');
    ok(E.reduce(s, { type: 'SEA_TRADE_TRASH', cards: ['copper', 'copper', 'estate'] }).players[0].hand.length === 1,
      '海上交易：上限どおり3枚廃棄できる');

    // -1カードトークン（遺物／借入）は `draw()` 冒頭で1枚食う＝引けるのは2枚。それでも上限は3。
    let s2 = mk2(KR, { events: ['sea_trade'] }); s2.turn.coins = 4;
    s2.players[0].inPlay = ['village', 'smithy', 'market'];
    s2.players[0].hand = ['copper', 'copper', 'estate'];
    s2.players[0].deck = ['gold', 'gold', 'gold', 'gold']; s2.players[0].discard = [];
    s2.players[0].minusCard = true;
    const h0 = s2.players[0].hand.length;
    s2 = buyEv(s2, 'sea_trade');
    ok(s2.players[0].hand.length - h0 === 2, '海上交易：-1カードトークンで3枚指示のうち2枚しか引けない');
    ok(s2.pending && s2.pending.max === 3, '海上交易：それでも廃棄の上限は3（正本が名指しした回帰）');
    ok((s2.players[0].minusCard || false) === false, '海上交易：-1カードトークンは消費される');
    ok(E.reduce(s2, { type: 'SEA_TRADE_TRASH', cards: [] }).pending == null, '海上交易：0枚で確定できる（任意）');
    ok(E.reduce(s2, { type: 'SEA_TRADE_TRASH', cards: ['copper', 'copper', 'estate', 'gold'] }).pending != null,
      '海上交易：上限超えは拒否');

    let s5 = mk2(KR, { events: ['sea_trade'] }); s5.turn.coins = 4;
    s5.players[0].inPlay = ['gold']; s5.players[0].durationCards = [];
    s5 = buyEv(s5, 'sea_trade');
    ok(s5.pending == null, '海上交易：場にアクション0枚なら窓を開かない（開くと閉じられず人間が詰む）');

    let s6 = mk2(KR, { events: ['sea_trade'] }); s6.turn.coins = 4;
    s6.players[0].inPlay = []; s6.players[0].durationCards = ['hireling', 'hireling'];
    s6.players[0].hand = ['copper']; s6.players[0].deck = ['gold', 'gold', 'gold'];
    s6 = buyEv(s6, 'sea_trade');
    ok(s6.pending && s6.pending.max === 2, '海上交易：持続カードも「場のアクション」に数える（蓄積の裏返し）');
  }
}

console.log('=== R4 敵対レビュー（予言15種・2体）の回帰 11件 ===');
{
  const KR = DOM.KINGDOM_RISINGSUN;
  const mk3 = (K, opt) => E.createInitialState([{ name: 'A' }, { name: 'B', isCpu: true }], K.slice(),
    Object.assign({ startActive: 0 }, opt || {}));
  const on3 = (pr, K) => { const s = mk3(K, { prophecy: pr }); s.prophecyOn = true; s.sunTokens = 0; s.prophecyOnBy = 0; return s; };
  const drain3 = (s) => { let g = 0; while (s.pending && g++ < 200) { const a = DOM.cpu.decide(s); if (!a) break; s = E.reduce(s, a); } return s; };
  const count = (s, id) => { let m = 0;
    s.players.forEach((p) => E.allCards(p).forEach((c) => { if (c === id) m++; }));
    (s.trash || []).forEach((c) => { if (c === id) m++; });
    Object.keys(s.supply).forEach((k) => { if (k === id && typeof s.supply[k] === 'number') m += s.supply[k]; });
    return m; };
  const F3 = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'mine'];

  /* 【1】[high] 山に戻せないカードを場から抜いてはいけない（保存則違反）＝3箇所。
     公式（神風）逐語＝`The removed piles are gone; … cards can't be returned to those piles.`
     🛑 `canReturnToPile` を確認せずに `removeOne` すると**カードが1枚ゲームから消滅する**
        （オンラインは state をそのまま配信・永続化するので部屋のカード総数が恒久的に狂う）。 */
  {
    let s = on3('divine_wind', ['snake_witch', 'tea_house', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine']);
    s.prophecyOn = false; s.sunTokens = 1;
    s.players[0].hand = ['snake_witch', 'copper', 'estate', 'silver'];
    s.players[0].deck = ['gold', 'province', 'duchy'];
    s.supply.snake_witch -= 1; s.turn.phase = 'action'; s.turn.actions = 1;
    E.removeSun(s, 0);                                   // 神風＝王国10山を撤去
    const t0 = count(s, 'snake_witch');
    let x = E.reduce(s, { type: 'PLAY_ACTION', card: 'snake_witch' });
    x = E.reduce(x, { type: 'SNAKE_WITCH_RESOLVE', doIt: true });
    ok(count(x, 'snake_witch') === t0, `濡女：神風で山が消えても総数が保たれる（${t0}→${count(x, 'snake_witch')}）`);
    ok((x.players[1].discard || []).filter((c) => c === 'curse').length === 0,
      '濡女：**戻せなかったら呪いを配らない**（"return this to its pile. If you do…"）');

    // 馬の習性（出荷済みの穴）＝闇市場で買った札のように山が無いと消える。
    let s3 = mk3(F3, { ways: ['way_of_the_horse'] });
    s3.players[0].hand = ['candlestick_maker']; s3.turn.phase = 'action'; s3.turn.actions = 1;
    const v0 = count(s3, 'candlestick_maker');
    const z = E.reduce(s3, { type: 'PLAY_ACTION', card: 'candlestick_maker', way: 'way_of_the_horse' });
    ok(count(z, 'candlestick_maker') === v0, `馬の習性：山が無い札でも総数が保たれる（${v0}→${count(z, 'candlestick_maker')}）`);

    /* チョウの習性も同型＝**窓を開く側**（`applyWay`）と**受理側**（`WAY_BUTTERFLY`）の両方を
       `canReturnToPile` に寄せてある。窓が開かないので受理側のガードは旧スナップショット互換の保険。
       ⚠ 山が無い札は「戻す/戻さない」の窓自体を開かない＝押しても何も起きない死に選択肢を出さない。 */
    let s4 = mk3(F3, { ways: ['way_of_the_butterfly'] });
    s4.players[0].hand = ['candlestick_maker']; s4.turn.phase = 'action'; s4.turn.actions = 1;
    const w0 = count(s4, 'candlestick_maker');
    let z2 = E.reduce(s4, { type: 'PLAY_ACTION', card: 'candlestick_maker', way: 'way_of_the_butterfly' });
    ok(z2.pending == null, 'チョウの習性：山が無い札では窓を開かない');
    z2 = E.reduce(z2, { type: 'WAY_BUTTERFLY', ret: true });   // 旧スナップショット互換の受理側ガード
    ok(count(z2, 'candlestick_maker') === w0, 'チョウの習性：山が無い札でも総数が保たれる');
    // 山がある札なら従来どおり窓が開く（退行が無いことの対照）。
    let s5 = mk3(F3, { ways: ['way_of_the_butterfly'] });
    s5.players[0].hand = ['village']; s5.turn.phase = 'action'; s5.turn.actions = 1;
    const z3 = E.reduce(s5, { type: 'PLAY_ACTION', card: 'village', way: 'way_of_the_butterfly' });
    ok(z3.pending && z3.pending.type === 'way_butterfly', 'チョウの習性：山がある札では従来どおり窓が開く');
  }

  /* 【2】[medium] 神風の新10山は `initSupply` の**外**にある派生セットアップも走らせる。
     公式逐語＝`Deal out 10 new Kingdom cards. **Do any Setup for them that they require**, including
     things like putting out the Potions if necessary.` */
  {
    const K = ['tea_house', 'poet', 'fairgrounds', 'harvest', 'ironmonger', 'sage', 'barge', 'black_cat', 'village', 'smithy'];
    let miss = 0, n = 0;
    for (let sd = 1; sd <= 120; sd++) {
      const s = on3('divine_wind', K); s.prophecyOn = false; s.sunTokens = 1; E.removeSun(s, 0);
      const k = s.kingdom || []; n++;
      if (k.some((c) => DOM.isType(c, 'looter')) && !Array.isArray(s.ruins)) miss++;
      if (k.some((c) => (DOM.HORSE_GIVERS || []).indexOf(c) >= 0) && s.supply.horse == null) miss++;
      if (k.indexOf('young_witch') >= 0 && !(s.baneCard && s.supply[s.baneCard] != null)) miss++;
      if (k.indexOf('riverboat') >= 0 && !s.riverboatCard) miss++;
    }
    ok(miss === 0, `神風${n}回：廃墟／馬／災いカード／川船の脇札が毎回そろう（未設置 ${miss} 件）`);
  }

  /* 【3】[medium] 進歩(Progress) は **stop-moving** を尊重する。
     公式 Other rules clarifications 逐語＝
     `you may use a Sleigh to move a gained card into your hand; **if you do, Progress will no longer be
      able to move it onto your deck.**` ／ `Ghost Town is gained **to** the hand (and must be moved to the
      deck by Progress), whereas **Villa moves itself to the hand after being gained (which can overrule
      Progress).**` ＝「獲得**先**が特殊」なら進歩が勝ち、「獲得**後**に動かした」なら進歩が負ける。 */
  {
    let v = on3('progress', ['tea_house', 'villa', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine']);
    v.turn.phase = 'buy'; v.turn.coins = 6; v.turn.buys = 1;
    v = E.reduce(v, { type: 'BUY', card: 'villa' }); v = drain3(v);
    ok(v.players[0].hand.indexOf('villa') >= 0, 'ヴィラは獲得**後**に自分で手札へ動くので進歩に奪われない');
    ok(v.players[0].deck[0] !== 'villa', 'ヴィラが山札の上に置かれない');

    let g = on3('progress', ['tea_house', 'ghost_town', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine']);
    g.turn.phase = 'buy'; g.turn.coins = 6; g.turn.buys = 1;
    g = E.reduce(g, { type: 'BUY', card: 'ghost_town' }); g = drain3(g);
    ok(g.players[0].deck[0] === 'ghost_town', 'ゴーストタウンは獲得**先**が手札なので進歩が勝つ（公式の対照例）');
  }

  /* 【4】[medium] 豊作／狼狽は `playCardNoAction` を通る財宝でも誘発する。
     🛑 `playTreasureCard` にしかフックが無いと、薬草集め／急使／宝珠／呪符の巻物／博打／苦労／進軍／
        突貫／侵略 などが全部空振りする（＝予言が静かに効かなくなる）。 */
  {
    const KA = ['tea_house', 'augurs', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine'];
    let s = on3('good_harvest', KA);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['herb_gatherer']; s.players[0].discard = ['copper']; s.players[0].deck = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'herb_gatherer' });
    const b0 = s.turn.buys, c0 = s.turn.coins;
    s = E.reduce(s, { type: 'HERB_GATHERER_PLAY', card: 'copper' });
    ok(s.turn.buys - b0 === 1 && s.turn.coins - c0 - 1 === 1, '豊作：薬草集めで出した銅貨にも +1購入 +$1');

    let p = on3('panic', KA);
    p.turn.phase = 'action'; p.turn.actions = 1;
    p.players[0].hand = ['herb_gatherer']; p.players[0].discard = ['copper']; p.players[0].deck = [];
    p = E.reduce(p, { type: 'PLAY_ACTION', card: 'herb_gatherer' });
    const pb = p.turn.buys;
    p = E.reduce(p, { type: 'HERB_GATHERER_PLAY', card: 'copper' });
    ok(p.turn.buys - pb === 2, '狼狽：薬草集めで出した銅貨にも +2購入');
  }

  /* 【5】[medium] 悟り／狼狭は **アクションフェイズに使った Action-Treasure** にも効く。
     公式（悟り）逐語＝`Enlightenment **even applies to Treasure cards that are already Actions**; if you
     play **Crown** … or **an Action affected by Capitalism** in the Action phase, you still get +1 Card and
     +1 Action instead of the card's usual effect.`
     公式（狼狭）逐語＝`This applies even to **Action-Treasures that are played during the Action phase**.` */
  {
    const KC = ['crown', 'tea_house', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine'];
    let s = on3('enlightenment', KC);
    s.players[0].hand = ['crown', 'village', 'copper', 'copper', 'estate'];
    s.players[0].deck = ['gold', 'silver', 'province']; s.turn.phase = 'action'; s.turn.actions = 1;
    const x = E.reduce(s, { type: 'PLAY_ACTION', card: 'crown' });
    ok(x.pending == null, '悟り：アクションフェイズの冠は「2回使う」窓を開かない');
    ok(x.players[0].hand.length === 5 && x.turn.actions === 1, '悟り：代わりに +1カード +1アクション');

    let p = on3('panic', KC);
    p.players[0].hand = ['crown', 'village', 'copper', 'copper', 'estate'];
    p.players[0].deck = ['gold', 'silver', 'province']; p.turn.phase = 'action'; p.turn.actions = 1;
    const pb = p.turn.buys;
    const y = E.reduce(p, { type: 'PLAY_ACTION', card: 'crown' });
    ok(y.turn.buys - pb === 2, '狼狭：アクションフェイズの冠でも +2購入');
  }

  /* 【6】[low] 豊作は「**このターン**初めて使う名前」＝発動前に使った名前も記録しておく。
     日本語wiki 逐語＝「語り部の効果で銅貨を使用した後に前兆カードを使用し豊作が発動し、その後銅貨を
     使用した」場合、**追加のコインは発生しない**。英語FAQ＝`it doesn't retroactively give you +1 Buy and +$1.` */
  {
    let s = on3('good_harvest', ['tea_house', 'poet', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine']);
    s.prophecyOn = false; s.sunTokens = 1; s.events = ['continue'];
    s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 2;
    s.players[0].hand = ['copper', 'copper'];
    s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });      // ① 発動前に1枚目
    s = E.reduce(s, { type: 'BUY_EVENT', event: 'continue' });
    s = E.reduce(s, { type: 'CONTINUE_GAIN', card: 'poet' }); s = drain3(s);
    ok(s.prophecyOn === true, '継続→詩人で豊作が発動する（純・旭日で到達する経路）');
    s = E.reduce(s, { type: 'END_ACTION_PHASE' });
    const b0 = s.turn.buys, c0 = s.turn.coins;
    s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });      // ② 発動後に2枚目
    ok(s.turn.buys - b0 === 0 && s.turn.coins - c0 - 1 === 0,
      '発動前に使った銅貨も記録されているので、2枚目には恩恵が出ない（遡らない）');
  }

  /* 【7】[low] 偉大な指導者は**相続した屋敷**もアクションとして数える
     （積む側の `notePlunderPlay` は `inheritedEstate` を見ているので、消化側を静的判定にすると食い違う）。 */
  {
    let s = on3('great_leader', ['tea_house', 'poet', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'throne_room', 'laboratory']);
    s.players[0].inherited = ['village'];
    s.turn.phase = 'action'; s.turn.actions = 1; s.players[0].hand = ['estate'];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'estate' }); s = drain3(s);
    ok(s.turn.actions === 3, `相続の屋敷（村）＝1 -1(使用) +2(村) +1(偉大な指導者)＝3（実: ${s.turn.actions}）`);
  }

  /* 【8】[low] 成長は「財宝か」を**動的**に見る（資本主義で財宝になったアクションの獲得でも誘発）。 */
  {
    let s = on3('growth', ['tea_house', 'poet', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine']);
    s.projects = ['capitalism']; s.players[0].projects = ['capitalism'];
    s.turn.phase = 'buy'; s.turn.coins = 9; s.turn.buys = 2;
    s = E.reduce(s, { type: 'BUY', card: 'market' });
    ok(E.isTreasureFor(s, 'market'), '前提：資本主義で市場は財宝');
    ok(s.pending && s.pending.type === 'growth_gain',
      `成長：資本主義で財宝になったアクションの獲得でも窓が開く（実: ${s.pending && s.pending.type}）`);
  }

  /* 【9】[low] 悟り × カメレオンの習性＝**カメレオンだけは悟りが勝つ**。
     公式逐語＝`If you play a Treasure as Way of the Chameleon, it makes you follow **its instructions**
     (unlike the other Ways), which means **Enlightenment will stop that** … **This only applies for your
     Action phase.**` 一律に習性を先に返すと**アクション権を1消費して何も起きない**（丸損）。 */
  {
    let s = on3('enlightenment', ['tea_house', 'poet', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine']);
    s.ways = ['way_of_the_chameleon'];
    s.players[0].hand = ['gold']; s.players[0].deck = ['silver', 'silver', 'silver'];
    s.turn.phase = 'action'; s.turn.actions = 1;
    const x = E.reduce(s, { type: 'PLAY_ACTION', card: 'gold', way: 'way_of_the_chameleon' });
    ok(x.players[0].hand.length === 1 && x.turn.actions === 1,
      `カメレオン×悟り＝+1カード +1アクション（実: 手札${x.players[0].hand.length} アクション${x.turn.actions}）`);
    // 悟りが無ければ従来どおり習性が勝つ（退行が無いことの対照）。
    let n = mk3(['tea_house', 'poet', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine'],
      { ways: ['way_of_the_chameleon'] });
    n.players[0].hand = ['smithy']; n.players[0].deck = ['silver', 'silver', 'silver'];
    n.turn.phase = 'action'; n.turn.actions = 1;
    const y = E.reduce(n, { type: 'PLAY_ACTION', card: 'smithy', way: 'way_of_the_chameleon' });
    ok(y.turn.coins === 3 && y.players[0].hand.length === 0,
      `予言なしのカメレオンは従来どおり（鍛冶屋の+3カード→+$3・実: $${y.turn.coins}）`);
  }

  /* 【10】[low] 病／神器は「**開始時効果の途中で予言が発動した**」ターンにも当ターンぶんが働く。
     公式（病）＝「**川船**の効果などでターンの開始時中に病が効果を発揮した場合は、**そのターンの開始時にも
     病の効果を処理する。**」／公式（神器）＝`If you remove the last [Sun] at the start of your turn
     (e.g. you play a Poet with Delay), you'll gain **2 Actions** to your hand.` */
  {
    const startFire = (pr, side) => {
      let s = on3(pr, ['tea_house', 'riverboat', 'poet', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop']);
      s.prophecyOn = false; s.sunTokens = 1; s.prophecyOnBy = null;
      s.riverboatCard = side;                                     // 川船が脇に置いた $5 の非持続アクション＝前兆
      s.players[0].delayedEffects = [{ card: 'riverboat', type: 'riverboat' }];
      s.turn.phase = 'buy';
      s = E.reduce(s, { type: 'END_TURN' });
      let g = 0; while (!s.gameOver && g++ < 300) { if (s.turn.active === 0) break; const a = DOM.cpu.decide(s); if (!a) break; s = E.reduce(s, a); }
      return s;
    };
    let s = startFire('sickness', 'tea_house');
    let saw = false, h = 0;
    while (h++ < 30 && s.pending) {
      if (s.pending.type === 'sickness') { saw = true; break; }
      const a = DOM.cpu.decide(s); if (!a) break; s = E.reduce(s, a);
    }
    ok(s.prophecyOn === true, '前提：川船が開始時に前兆（茶屋）を使って病が発動する');
    ok(saw, '病：開始時に発動したターンにも当ターンぶんの窓が開く');

    let k = startFire('kind_emperor', 'poet');
    let gains = 0, h2 = 0;
    while (h2++ < 40 && k.pending) {
      if (k.pending.type === 'kind_emperor_gain') gains++;
      const a = DOM.cpu.decide(k); if (!a) break; k = E.reduce(k, a);
    }
    ok(k.prophecyOn === true, '前提：川船が開始時に前兆（歌人）を使って神器が発動する');
    ok(gains === 2, `神器：発動の瞬間ぶん＋開始時ぶんで2回獲得する（実: ${gains}）`);
  }
}

console.log('=== R4/R5: maskStateFor（オンラインの情報漏洩）と旧スナップショット互換 ===');
/* §0-21 偵察隊／§0-28 夜警／§0-29 A4 粉屋・歩哨 と**3回続けて同じクラスの漏れ**を出している箇所。
   旭日で足した state を「公開すべきもの／伏せるべきもの」に分けて固定する。 */
{
  const KR = DOM.KINGDOM_RISINGSUN;
  const mk4 = (opt) => E.createInitialState([{ name: 'A' }, { name: 'B' }], KR.slice(),
    Object.assign({ startActive: 0 }, opt || {}));

  // ① 公開＝予言id／Sun残数／発動済みか／川船の脇札／洞察の脇札（"Reveal … Set it aside"）
  {
    let s = mk4({ prophecy: 'good_harvest' });
    s.sunTokens = 3; s.prophecyOn = false; s.riverboatCard = 'tea_house';
    s.players[0].foresightAside = ['village', 'smithy'];
    const m = E.maskStateFor(s, 1);
    ok(m.prophecy === 'good_harvest' && m.sunTokens === 3 && m.prophecyOn === false,
      '予言id・Sun残数・発動済みかは公開情報（相手にも見える）');
    ok(m.riverboatCard === 'tea_house', '川船の脇札は公開（"set a **copy** of it aside"）');
    ok((m.players[0].foresightAside || []).join() === 'village,smithy',
      '洞察の脇札は公開（配達 Deliver と同じ扱い・パズルボックスとは逆）');
  }
  // ② 伏せる＝好機到来の脇札（クリンナップで**伏せて**置いた手札）＝枚数だけ見える
  {
    let s = mk4({});
    s.players[0].bidingAside = ['gold', 'province', 'estate'];
    const m1 = E.maskStateFor(s, 1), m0 = E.maskStateFor(s, 0);
    const ba = m1.players[0].bidingAside || [];
    ok(ba.length === 3 && ba.every((c) => c === 'back'), '好機到来の脇札は枚数だけ見えて中身は伏せる');
    ok((m0.players[0].bidingAside || []).join() === 'gold,province,estate', '本人には中身が見える');
  }
  // ③ 影＝**自分の**山札はどの位置に何があるか見える／相手の山札は伏せたまま（決定D3の許容簡略化）
  {
    let s = mk4({});
    s.players[0].deck = ['copper', 'fishmonger', 'estate', 'ninja', 'silver'];
    const m0 = E.maskStateFor(s, 0), m1 = E.maskStateFor(s, 1);
    ok(m0.players[0].deck.join() === 'copper,fishmonger,estate,ninja,silver',
      '自分の山札は影札の位置まで見える（見えないと山札から使う操作ができない）');
    ok((m1.players[0].deck || []).every((c) => c === 'back'),
      '相手の山札は影札も含めて伏せたまま（公式は「自分の山札の裏面を見てよい」だけ＝許容簡略化）');
  }
  // ④ 窓が開いている最中でも脇札の中身は漏れない
  {
    let s = mk4({ prophecy: 'biding_time' });
    s.prophecyOn = true; s.sunTokens = 0;
    s.players[0].bidingAside = ['gold'];
    s.pending = { type: 'sickness', player: 0 };
    ok((E.maskStateFor(s, 1).players[0].bidingAside || []).every((c) => c === 'back'),
      '窓が開いていても好機到来の脇札は漏れない');
  }
  // ⑤ 神風で王国が入れ替わった後もマスクできる（`state[混合山] = null` が Array.isArray ガードを通る）
  {
    let s = mk4({ prophecy: 'divine_wind' });
    s.prophecyOn = false; s.sunTokens = 1;
    E.removeSun(s, 0);
    let threw = null, m = null;
    try { m = E.maskStateFor(s, 1); } catch (e) { threw = e; }
    ok(threw == null && m && (m.kingdom || []).length >= 10,
      `神風後も maskStateFor が例外を出さない（${threw ? threw.message : '新王国' + (m.kingdom || []).length + '山'}）`);
  }
  /* ⑥ オンラインの永続化＝**サーバは state を無変換で保存・復元する**（§0-17 で `pending.self` の欠落で
     livelock を踏んでいる）。JSON 往復した state がそのまま動くこと。 */
  {
    let s = mk4({ prophecy: 'kind_emperor', events: ['foresight', 'gather'] });
    s.players[0].foresightAside = ['village'];
    s.players[0].bidingAside = ['gold'];
    s.riverboatCard = 'tea_house';
    let s2 = null, threw = null;
    try {
      s2 = E.reduce(JSON.parse(JSON.stringify(s)), { type: 'END_ACTION_PHASE' });
      s2 = E.reduce(s2, { type: 'END_TURN' });
    } catch (e) { threw = e; }
    ok(threw == null, `JSON を往復した state で reduce できる（${threw && threw.message}）`);
    ok(s2 && (s2.players[0].foresightAside || []).length === 0 && s2.players[0].hand.indexOf('village') >= 0,
      '洞察の脇札は**先引きの後**に手札へ入る（手札6枚になる）');
  }
  /* ⑦ 旧スナップショット互換＝v78 以前（旭日のフィールドを1つも持たない state）を復元しても壊れない。
     🛑 サーバは state を無変換で復元するので、ここが抜けると**部屋が固まる**事故クラスになる。 */
  {
    let s = mk4({});
    delete s.prophecy; delete s.sunTokens; delete s.prophecyOn; delete s.prophecyOnBy;
    delete s.riverboatCard; delete s.kingdomEpoch;
    s.players.forEach((p) => { delete p.foresightAside; delete p.bidingAside; delete p.gainedGoldThisGame; });
    let s2 = null, threw = null, threw2 = null;
    try { s2 = E.reduce(s, { type: 'END_ACTION_PHASE' }); s2 = E.reduce(s2, { type: 'END_TURN' }); } catch (e) { threw = e; }
    ok(threw == null && s2 && s2.turn.active === 1, `旭日のフィールドが無い state でもターンが進む（${threw && threw.message}）`);
    try { E.maskStateFor(s, 1); } catch (e) { threw2 = e; }
    ok(threw2 == null, `旭日のフィールドが無い state でも maskStateFor できる（${threw2 && threw2.message}）`);
  }
}

console.log('=== R5: CPU が買う旭日イベント3種は「買っても何も起きない」局面で買わない ===');
/* 正本は各イベントに「CPU は条件を見てから買え。さもないと $N をドブに捨て続ける」と書いている。
   ⚠ 残り7種は意図的に買わない（`ritual`/`banquet`/`windfall`/`tax` と同じ扱い＝正本が明示的に許容）。 */
{
  const KR = DOM.KINGDOM_RISINGSUN;
  const mkc = (evs) => E.createInitialState([{ name: 'A', isCpu: true }, { name: 'B', isCpu: true }],
    KR.slice(), { startActive: 0, events: evs });
  // 参集＝ちょうど $3/$4/$5 が全部空
  {
    let s = mkc(['gather']); s.turn.phase = 'buy'; s.turn.coins = 7; s.turn.buys = 1;
    Object.keys(s.supply).forEach((k) => {
      if (E.costExact(s, k, 3) || E.costExact(s, k, 4) || E.costExact(s, k, 5)) s.supply[k] = 0;
    });
    const a = DOM.cpu.decide(s);
    ok(!(a && a.type === 'BUY_EVENT' && a.event === 'gather'), '参集：$3/$4/$5 が全部空なら買わない');
  }
  // 蓄積＝$5以下のアクションが1つも無い
  {
    let s = mkc(['amass']); s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1;
    s.players[0].inPlay = []; s.players[0].durationCards = [];
    Object.keys(s.supply).forEach((k) => { if (E.costUpTo(s, k, 5) && DOM.isType(k, 'action')) s.supply[k] = 0; });
    const a = DOM.cpu.decide(s);
    ok(!(a && a.type === 'BUY_EVENT' && a.event === 'amass'), '蓄積：$5以下のアクションが無ければ買わない');
  }
  // 信用＝獲得候補ゼロ
  {
    let s = mkc(['credit']); s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1;
    const okC = E.creditCanGain(s);
    Object.keys(s.supply).forEach((k) => { if (okC(k)) s.supply[k] = 0; });
    const a = DOM.cpu.decide(s);
    ok(!(a && a.type === 'BUY_EVENT' && a.event === 'credit'), '信用：獲得候補ゼロなら買わない');
  }
  // CPU が買わない7種でも膠着・拒否・null が起きない（＝本番 livelock の芽が無い）
  {
    let bad = 0;
    ['asceticism', 'foresight', 'kintsugi', 'practice', 'sea_trade', 'receive_tribute', 'continue'].forEach((ev) => {
      let s = mkc([ev]), step = 0;
      while (!s.gameOver && step++ < 3000) {
        const a = DOM.cpu.decide(s);
        if (!a) { bad++; break; }
        const ns = E.reduce(s, a);
        if (JSON.stringify(ns) === JSON.stringify(s)) { bad++; break; }
        s = ns;
      }
      if (!s.gameOver && step >= 3000) bad++;
    });
    ok(bad === 0, 'CPU が買わない7種でも膠着・engine 拒否・CPU null が起きない');
  }
}

console.log('\n========================================');
console.log('旭日R4テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail === 0 ? 0 : 1);
