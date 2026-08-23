/* 旭日（Rising Sun）ゲームロジックの検証（Node 単体実行）
   使い方: node test/risingsun.test.js
   正本＝docs/research/risingsun_rules.md（冒頭「実装前に必読」18項目＋決定 D1〜D5）。
   対象:
     R1＝前兆(Omen)／予言(Prophecy)／Sunトークンの基盤
         （王国に前兆が1枚でもあれば**予言を1枚だけ**配る（前兆が何枚あっても1つ）／
          Sun トークンは **2人5／3人8／4人10／5人12／6人13**／
          「+1 Sun」＝トークンを1個取り除き、**最後の1個を取り除いた瞬間**に予言が有効になり以後ずっと有効／
          **取り除き切るまで予言のテキストは一切効かない**／全部取り除いた後の「+1 Sun」は**何もしない**／
          **予言も Sun トークンも「カード」ではない**＝保存則 tally・allCards に入れない）。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260820;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

// 前兆を含む王国／含まない王国（旭日は CARD_SETS 未参照なので王国は手で組む）
const K_OMEN = ['tea_house', 'poet', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine'];
const K_NONE = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine', 'remodel', 'festival'];
const mk = (kingdom, n, opts) => E.createInitialState(
  Array.from({ length: n }, (_, i) => ({ name: 'P' + i, isCpu: i > 0 })), kingdom, opts || {});

console.log('=== R1: カタログ（前兆6種・影5種・予言15種）===');
{
  const omens = Object.keys(DOM.CARDS).filter((id) => DOM.isType(id, 'omen'));
  const shadows = Object.keys(DOM.CARDS).filter((id) => DOM.isType(id, 'shadow'));
  ok(omens.length === 6, '前兆(Omen)は6種（実: ' + omens.length + ' / ' + omens.join(',') + '）');
  ok(shadows.length === 5, '影(Shadow)は5種（実: ' + shadows.length + ' / ' + shadows.join(',') + '）');
  ok(omens.includes('kitsune') && DOM.isType('kitsune', 'attack'), '狐はアクション-アタック-前兆');
  ok(shadows.includes('ninja') && DOM.isType('ninja', 'attack'), '忍者はアクション-アタック-影');
  ok((DOM.PROPHECIES_RISINGSUN || []).length === 15, '予言は15種（実: ' + (DOM.PROPHECIES_RISINGSUN || []).length + '）');
  // 予言は「カード」ではない＝DOM.CARDS に入っていない
  const inCards = (DOM.PROPHECIES_RISINGSUN || []).filter((id) => DOM.CARDS[id]);
  ok(inCards.length === 0, '予言は DOM.CARDS に入っていない（カードではない。実: ' + inCards.join(',') + '）');
  // 「+1 Sun」は前兆カードの記載の一番最初に必ず来る
  const badFirst = omens.filter((id) => String(DOM.CARDS[id].text || '').split('\n')[0] !== '+1 Sun');
  ok(badFirst.length === 0, '前兆6種とも text の1行目が「+1 Sun」（実: ' + badFirst.join(',') + '）');
}

console.log('=== R1: 予言の選定（王国に前兆があるときだけ1枚）===');
{
  const s = mk(K_OMEN, 2);
  ok(!!s.prophecy, '前兆がある王国では予言が1枚配られる（実: ' + s.prophecy + '）');
  ok((DOM.PROPHECIES_RISINGSUN || []).indexOf(s.prophecy) >= 0, '配られた予言は15種のどれか');
  ok(s.prophecyOn === false, '配られた時点では予言は発動していない');
  const s2 = mk(K_NONE, 2);
  ok(s2.prophecy == null, '前兆が無い王国では予言を配らない（実: ' + s2.prophecy + '）');
  ok((s2.sunTokens || 0) === 0, '前兆が無い王国では Sun トークンも置かない');
  // 前兆6種を1枚ずつ単独で入れた王国＝どれでも予言が配られる（hasOmen が6種すべてを認識するか）
  const OMENS = Object.keys(DOM.CARDS).filter((id) => DOM.isType(id, 'omen'));
  OMENS.forEach((om) => {
    const k = [om].concat(K_NONE.slice(0, 9));
    ok(E.hasOmen(k) === true, 'hasOmen: ' + om + ' 単独の王国で真');
    ok(!!mk(k, 2).prophecy, om + ' 単独の王国でも予言が配られる');
  });
  // 前兆6枚を全部入れても予言は**1つだけ**（`Only use one Prophecy no matter how many Omens you have.`）
  {
    const k6 = OMENS.concat(K_NONE.slice(0, 4));
    const s6 = mk(k6, 3);
    ok(typeof s6.prophecy === 'string' && (DOM.PROPHECIES_RISINGSUN || []).indexOf(s6.prophecy) >= 0,
      '前兆6枚でも予言は1枚だけ配られる');
    ok(s6.sunTokens === 8, '前兆6枚でも Sun は人数どおり（3人＝8個。前兆の枚数で増えない。実: ' + s6.sunTokens + '）');
  }
  // opts で指定できる（テスト・再戦・サーバ権威）
  const s3 = mk(K_OMEN, 2, { prophecy: 'divine_wind' });
  ok(s3.prophecy === 'divine_wind', 'opts.prophecy で予言を指定できる');
  const s4 = mk(K_OMEN, 2, { prophecy: 'moat' });
  ok(s4.prophecy !== 'moat', 'opts.prophecy に予言でない id を渡しても採用しない');
}

console.log('=== R1: Sun トークンの人数別枚数（2人5／3人8／4人10／5人12／6人13）===');
{
  [[2, 5], [3, 8], [4, 10]].forEach(([n, want]) => {
    const s = mk(K_OMEN, n);
    ok(s.sunTokens === want, n + '人戦の Sun トークンは ' + want + '個（実: ' + s.sunTokens + '）');
  });
  ok(E.sunTokensFor(5) === 12, '5人戦は12個');
  ok(E.sunTokensFor(6) === 13, '6人戦は13個（箱の上限）');
}

console.log('=== R1: 「+1 Sun」＝最後の1個を取り除いた瞬間に発動し、以後ずっと有効 ===');
{
  const s = mk(K_OMEN, 2, { prophecy: 'good_harvest' });
  ok(s.sunTokens === 5, '2人戦は5個から始まる');
  for (let i = 1; i <= 4; i++) {
    const removed = E.removeSun(s, 0);
    ok(removed === true, i + '回目の +1 Sun は取り除ける');
    ok(s.sunTokens === 5 - i, i + '回目の後の残りは ' + (5 - i) + '個');
    ok(s.prophecyOn === false, i + '回目の時点ではまだ発動していない（テキストは一切効かない）');
  }
  const last = E.removeSun(s, 1);
  ok(last === true, '5回目（最後の1個）も取り除ける');
  ok(s.sunTokens === 0, '5回目の後は0個');
  ok(s.prophecyOn === true, '**最後の1個を取り除いた瞬間**に発動する');
  ok(E.prophecyActive(s, 'good_harvest') === true, 'prophecyActive が真になる');
  // 全部取り除いた後の「+1 Sun」は何もしない（空振り）
  const after = E.removeSun(s, 0);
  ok(after === false, '全部取り除いた後の +1 Sun は何もしない（戻り値 false）');
  ok(s.sunTokens === 0, '空振りしても残りは0のまま（マイナスにならない）');
  ok(s.prophecyOn === true, '一度発動した予言はゲーム終了までずっと有効（下ろさない）');
}

console.log('=== R1: 【最重要】発動するまで予言のテキストは一切効かない（prophecyActive のゲート）===');
{
  /* ⚠ ここが R3/R4 の全予言のゲート＝`hasProphecy` で効果を書くと「ゲーム開始直後から予言が効く」公式違反になる。
     「予言は配られているが Sun がまだ残っている」状態での**偽**を必ず固定する（レビュー [high] の指摘）。 */
  const s = mk(K_OMEN, 2, { prophecy: 'great_leader' });
  ok(E.hasProphecy(s, 'great_leader') === true, '配られた直後から hasProphecy は真（＝準備処理用の述語）');
  ok(E.prophecyActive(s, 'great_leader') === false, '**配られた直後は prophecyActive が偽**（テキストは効かない）');
  E.removeSun(s, 0); E.removeSun(s, 0); E.removeSun(s, 0); E.removeSun(s, 0);
  ok(s.sunTokens === 1, '残り1個まで取り除いた');
  ok(E.prophecyActive(s, 'great_leader') === false, '**残り1個の時点でもまだ偽**（最後の1個を取り除くまで効かない）');
  E.removeSun(s, 0);
  ok(E.prophecyActive(s, 'great_leader') === true, '最後の1個を取り除いたら真');
  // 「以後ゲーム終了までずっと有効」＝ターンをまたいでも下りない
  let s2 = s;
  for (let i = 0; i < 6; i++) s2 = E.reduce(s2, { type: 'END_TURN' });
  ok(s2.prophecyOn === true, 'ターンを6回またいでも発動したまま（下ろす経路が無い）');
  ok(E.prophecyActive(s2, 'great_leader') === true, 'prophecyActive もターンをまたいで真のまま');
}

console.log('=== R1: 発動フックが「その場で・取り除いた本人の席で」走る ===');
{
  /* 神器(Kind Emperor)と神風(Divine Wind)は「最後の Sun を取り除いた瞬間」に即時発火する＝
     `onProphecyActivated` が removeSun の中で**同期的に**呼ばれ、pi は**取り除いた本人**でなければならない
     （`only the player who removed the [Sun] gains an Action then.`）。R4 の実効果はまだ無いので
     観測点はログ（フックが出す1行）で固定する。 */
  const s = mk(K_OMEN, 3, { prophecy: 'kind_emperor' });
  ok(s.sunTokens === 8, '3人戦は8個');
  for (let i = 0; i < 7; i++) E.removeSun(s, 0);
  const before = s.log.length;
  E.removeSun(s, 1); // 席1が最後の1個を取り除く
  const added = s.log.slice(before);
  ok(added.some((l) => /有効になった/.test(l)), '最後の Sun を取り除いた**その場で**発動フックが走る（遅延しない）');
  ok(added[added.length - 1].indexOf('有効になった') >= 0,
    'フックのログは「+1 Sun」のログの直後に出る（同じ呼び出しの中で走っている）');
  ok(s.prophecyOn === true, '発動済み');
  // **フックが受け取った席**＝取り除いた本人（神器はこの席だけが獲得する＝R4 で使う）
  ok(s.prophecyOnBy === 1, '発動させた席が記録される（席1が取り除いた。実: ' + s.prophecyOnBy + '）');
  ok(added[added.length - 1].indexOf(s.players[1].name) >= 0, 'フックのログに取り除いた本人の名前が出る');
  ok(mk(K_OMEN, 2).prophecyOnBy == null, '未発動なら prophecyOnBy は null');
  // 不正な席では何もしない（R4 で state.players[pi].hand を触るので TypeError の元になる）
  const s3 = mk(K_OMEN, 2, { prophecy: 'panic' });
  const sun0 = s3.sunTokens;
  ok(E.removeSun(s3, 99) === false, '存在しない席の +1 Sun は何もしない（戻り値 false）');
  ok(s3.sunTokens === sun0, '不正な席ではトークンを消費しない');
}

console.log('=== R1: 発動フックの窓は pending 直代入でなく prophecyQueue に積む ===');
{
  /* 前兆6種のうち4種（川の社/田舎の村/狐/山の社）は「+1 Sun」の直後に自分の窓を開く＝
     フックが pending を直接立てると握りつぶされる（レビューが実測）。R4 のために受け皿と再開網を先に用意した。 */
  const s = mk(K_OMEN, 2, { prophecy: 'kind_emperor' });
  ok(Array.isArray(s.prophecyQueue), 'state.prophecyQueue が用意されている');
  E.queueProphecy(s, { type: 'kind_emperor_gain', player: 0 });
  ok(s.prophecyQueue.length === 1, 'queueProphecy で積める');
  // reduce 末尾の再開網が pending の空きを見て1件ずつ開く
  const s2 = E.reduce(s, { type: 'END_ACTION_PHASE' });
  ok(s2.pending && s2.pending.type === 'kind_emperor_gain', '再開網が prophecyQueue を pending に昇格させる');
  ok((s2.prophecyQueue || []).length === 0, '昇格したらキューから消える');
}

console.log('=== R1: 予言が無いゲームでは removeSun は何もしない ===');
{
  const s = mk(K_NONE, 2);
  ok(E.removeSun(s, 0) === false, '予言が無ければ +1 Sun は空振り');
  ok(!s.prophecyOn, '予言が無ければ発動もしない');
  ok(E.prophecyActive(s, 'good_harvest') === false, 'prophecyActive は偽');
}

console.log('=== R1: 述語（hasOmen / hasProphecy）===');
{
  ok(E.hasOmen(K_OMEN) === true, 'hasOmen は前兆を含む王国で真');
  ok(E.hasOmen(K_NONE) === false, 'hasOmen は前兆が無い王国で偽');
  ok(E.hasOmen(['wizards']) === false, '分割山の中身に前兆が無ければ偽（旭日に分割山は無い）');
  const s = mk(K_OMEN, 2, { prophecy: 'panic' });
  ok(E.hasProphecy(s, 'panic') === true, 'hasProphecy はそのゲームの予言で真');
  ok(E.hasProphecy(s, 'growth') === false, 'hasProphecy は別の予言で偽');
}

console.log('=== R1: 予言と Sun トークンは「カード」ではない（保存則に混ぜない）===');
{
  const s = mk(K_OMEN, 2, { prophecy: 'progress' });
  const all = E.allCards(s.players[0]).concat(E.allCards(s.players[1]));
  ok(all.indexOf('progress') < 0, '予言は allCards に入らない');
  ok(all.length === 20, '2人戦の所有カードは合計20枚（予言・Sunトークンは数えない。実: ' + all.length + '）');
  // マスク：予言と Sun トークンは公開情報＝相手視点でもそのまま見える
  const masked = E.maskStateFor(s, 1);
  ok(masked.prophecy === 'progress', '予言は相手視点でも見える（公開情報）');
  ok(masked.sunTokens === 5, 'Sun トークンの残数も相手視点で見える');
}

console.log('=== R7: 旭日が実プレイに出る（CARD_SET 昇格）===');
{
  const sets = (DOM.CARD_SETS || []).map((x) => x.id);
  ok(sets.indexOf('risingsun') >= 0 && sets.indexOf('risingsun-events') >= 0 && sets.indexOf('random-risingsun') >= 0,
    '出荷3セット（risingsun / risingsun-events / random-risingsun）が CARD_SETS にある');
  // 固定10種＝カタログに実在し、10種ちょうど・重複なし。
  {
    const K10 = DOM.KINGDOM_RISINGSUN || [];
    ok(K10.length === 10 && new Set(K10).size === 10, '固定10種は重複なしで10種');
    ok(K10.every((id) => (DOM.POOLS.risingsun || []).indexOf(id) >= 0), '固定10種はすべて旭日のカード');
    /* 🛑 **前兆(Omen)が1枚も無いと予言が配られず、旭日の看板機構（Sunトークン）が丸ごと出ない**。
       固定セットは必ず前兆を含むこと（茶屋・歌人）。 */
    ok(K10.some((id) => DOM.isType(id, 'omen')), '固定10種に前兆(Omen)が入っている＝予言が必ず1枚配られる');
    ok(K10.some((id) => DOM.isType(id, 'shadow')), '固定10種に影(Shadow)が入っている');
  }
  // 実際に立てて、予言と Sun トークンが出ることを確認。
  {
    let withProphecy = 0;
    for (let i = 0; i < 8; i++) {
      const s = E.createInitialState([{ name: 'A' }, { name: 'B', isCpu: true }], DOM.kingdomForSet('risingsun'), {});
      if (s.prophecy && s.sunTokens === 5) withProphecy++;
    }
    ok(withProphecy === 8, '固定セットは毎回 予言1枚＋Sunトークン5個（2人）で始まる');
  }
  // risingsun-events は横型イベントを2枚配る（合計2枚制限は既存機構）。
  {
    const o = DOM.landscapesForSet('risingsun-events') || {};
    ok((o.events || []).length === 2, 'risingsun-events はイベントを2枚配る（実: ' + (o.events || []).length + '）');
    ok((o.events || []).every((id) => (DOM.EVENTS_RISINGSUN || []).indexOf(id) >= 0), '配られるのは旭日のイベント');
  }
  // 段階1の封じ込めは解除されている（R7 でここを反転させた）。
  ok((DOM.STAGE1_POOLS || []).indexOf('risingsun') < 0, 'STAGE1_POOLS から risingsun が外れた（闇市場にも出る）');
  ok(!!(DOM.MIX_KINGDOM_POOLS || {}).risingsun, 'MIX_KINGDOM_POOLS に risingsun が登録された（mix-all に参加）');
  ok(Object.keys(DOM.MIX_LANDSCAPE_POOLS || {}).indexOf('ev-risingsun') >= 0, 'MIX_LANDSCAPE_POOLS に ev-risingsun が登録された');
  // 闇市場デッキに旭日の王国カードが入る（＝どれも効果が実装済み＝死に札にならない）。
  {
    const bmK = ['black_market', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine', 'remodel'];
    const s = mk(bmK, 2);
    const bm = s.blackMarket || [];
    ok(bm.length > 0, '闇市場デッキが作られている（' + bm.length + '枚）');
    ok(bm.some((id) => (DOM.POOLS.risingsun || []).indexOf(id) >= 0), '闇市場デッキに旭日のカードが入る');
  }
  /* 🛑 **`DOM.CARDS` に載っている旭日25種すべてに engine の実装がある**（＝闇市場で買っても死に札にならない）。
     カタログにあるのに `applyEffect` / `applyTreasureEffect` に case が無いカードを構造的に捕まえる。 */
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js/engine.js'), 'utf8');
    /* ⚠ **財宝の効果は `applyTreasureEffect` に `if (card === 'id')` の形で書く**（`applyEffect` は財宝では
       呼ばれない＝§0-25 で実際に空振りさせた）。両方の書き方を許す。 */
    const missing = (DOM.POOLS.risingsun || []).filter((id) =>
      src.indexOf("case '" + id + "'") < 0 && src.indexOf("card === '" + id + "'") < 0);
    ok(missing.length === 0, '旭日25種すべてに engine の実装がある（実装漏れ: ' + missing.join(',') + '）');
  }
  // 予言15種・イベント10種も同様に「効果が空でない」ことを構造的に確認。
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js/engine.js'), 'utf8');
    const noPro = (DOM.PROPHECIES_RISINGSUN || []).filter((id) => src.indexOf("'" + id + "'") < 0);
    ok(noPro.length === 0, '予言15種すべてが engine から参照されている（未実装: ' + noPro.join(',') + '）');
    const noEv = (DOM.EVENTS_RISINGSUN || []).filter((id) => src.indexOf("case '" + id + "'") < 0);
    ok(noEv.length === 0, 'イベント10種すべてに applyEventEffect の case がある（未実装: ' + noEv.join(',') + '）');
  }
}

console.log('=== R1: 実ゲームループ（reduce）で3フィールドが生き残る・CPU が壊れない ===');
{
  /* テストが reduce を通っていないと「createInitialState では正しいがゲーム中に消える」を見逃す（レビュー指摘）。
     前兆入りの王国で CPU 同士を走らせ、終局まで prophecy / sunTokens / prophecyOn が保たれるかを見る。 */
  let s = E.createInitialState(
    [{ name: 'A', isCpu: true }, { name: 'B', isCpu: true }], K_OMEN, { prophecy: 'progress' });
  const CPU = DOM.cpu;
  let steps = 0, err = null;
  try {
    while (!s.gameOver && steps < 4000) {
      const a = CPU.decide(s);
      if (!a) break;
      const next = E.reduce(s, a);
      if (JSON.stringify(next) === JSON.stringify(s)) break; // engine が拒否＝膠着
      s = next; steps++;
    }
  } catch (e) { err = e; }
  ok(err === null, 'CPU ソークで例外が出ない（実: ' + (err ? (err.message || err) : 'なし') + '）');
  ok(s.gameOver === true, '前兆入りの王国で終局まで進む（steps=' + steps + '）');
  ok(s.prophecy === 'progress', '終局時も state.prophecy が残っている');
  ok(typeof s.sunTokens === 'number', '終局時も sunTokens が数値（消えない）');
  ok(s.prophecyOn === false, '前兆の効果が未実装なので Sun は減らない＝発動しない（R3 で減り始める）');
  // 保存則：予言・Sun は非カードなので所有カード合計は増減しない
  const all = E.allCards(s.players[0]).concat(E.allCards(s.players[1]));
  ok(all.indexOf('progress') < 0, '終局時も予言は allCards に混ざらない');
}

console.log('=== R1: 旧スナップショット互換（v78以前＝3フィールドを持たない state）===');
{
  /* サーバは state をそのまま Upstash に保存し無変換で復元する（PROGRESS §0-17）＝
     フィールドを足したら「持たない state」でも壊れないことを必ず確かめる（部屋が固まる事故クラス）。 */
  let s = mk(K_NONE, 2);
  const old = JSON.parse(JSON.stringify(s));
  delete old.prophecy; delete old.sunTokens; delete old.prophecyOn; delete old.prophecyQueue;
  let err = null, out = null;
  try { out = E.reduce(old, { type: 'END_TURN' }); } catch (e) { err = e; }
  ok(err === null, '3フィールドを持たない旧 state を reduce に通しても例外が出ない');
  ok(out && !out.prophecyOn, '旧 state では予言は発動していない扱い');
  ok(E.removeSun(old, 0) === false, '旧 state で removeSun を呼んでも空振り（sunTokens undefined でも安全）');
  ok(E.prophecyActive(old, 'panic') === false, '旧 state で prophecyActive は偽');
  // マスクと JSON 往復（オンライン配信経路）
  const m = E.maskStateFor(old, 1);
  ok(JSON.parse(JSON.stringify(m)) != null, '旧 state のマスクが JSON 往復できる');
}

console.log('=== R1: 前兆が無い王国では予言のために乱数を消費しない（既存の決定論を壊さない）===');
{
  /* createInitialState で Math.random を余分に引くと、同一シードで完全並走する既存の回帰テスト群と
     出荷 CARD_SET の抽選結果が全部ズレる（＝出荷済みの挙動が変わる）。前兆が無ければ引かないことを実測する。 */
  const count = () => {
    let n = 0; const real = sandbox.Math.random;
    sandbox.Math.random = function () { n++; return real.call(this); };
    mk(K_NONE, 2);
    sandbox.Math.random = real;
    return n;
  };
  const a = count();
  const b = count();
  ok(a === b, '前兆が無い王国では乱数消費が毎回同じ（実: ' + a + ' / ' + b + '）');
  // 前兆があるときだけ1回多く引く（予言の抽選ぶん）
  const countOmen = () => {
    let n = 0; const real = sandbox.Math.random;
    sandbox.Math.random = function () { n++; return real.call(this); };
    mk(K_OMEN, 2);
    sandbox.Math.random = real;
    return n;
  };
  ok(countOmen() > 0, '前兆がある王国では予言の抽選で乱数を引く（＝前兆が無ければ引かない側が守られている）');
  // opts.prophecy を指定したら抽選しない
  const countFixed = () => {
    let n = 0; const real = sandbox.Math.random;
    sandbox.Math.random = function () { n++; return real.call(this); };
    mk(K_OMEN, 2, { prophecy: 'growth' });
    sandbox.Math.random = real;
    return n;
  };
  ok(countFixed() < countOmen(), 'opts.prophecy を指定すると抽選ぶんの乱数を引かない');
}

console.log('=== R2: 影(Shadow)＝シャッフルするとき「シャッフルした束の一番下」に置く ===');
{
  const s = mk(K_NONE, 2);
  const p = s.players[0];
  // 捨て札に影札2枚＋普通の札6枚を置いてシャッフル（山札は空＝束＝捨て札まるごと）
  p.deck = []; p.hand = [];
  p.discard = ['copper', 'ninja', 'estate', 'alley', 'silver', 'village', 'copper', 'smithy'];
  E.reshuffleDeck(p, s);
  ok(p.deck.length === 8, 'シャッフル後の山札は8枚');
  const tail = p.deck.slice(-2);
  ok(tail.every((c) => DOM.isType(c, 'shadow')), '影札2枚が**一番下**に来る（実: ' + tail.join(',') + '）');
  ok(p.deck.slice(0, 6).every((c) => !DOM.isType(c, 'shadow')), '上6枚に影札は混ざらない');
  ok(s.log.some((l) => /影カード2枚を山札の一番下/.test(l)), 'ログに出る');
}
{
  /* 「獲得したときは底に置かない」＝シャッフル以外では動かさない。
     公開APIだけで確かめる＝望楼(watchtower)で山札の上に置く経路を使う。 */
  const K = ['ninja', 'watchtower'].concat(K_NONE.slice(0, 8));
  let s = mk(K, 2);
  s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  s.players[0].hand = ['watchtower'];
  s.players[0].deck = ['copper', 'copper'];
  s = E.reduce(s, { type: 'BUY', card: 'ninja' });
  // 望楼の窓（公開して山札の上へ）が開く
  if (s.pending && /watchtower/.test(s.pending.type)) {
    s = E.reduce(s, { type: 'WATCHTOWER_CHOOSE', mode: 'deck' });
  }
  ok(s.players[0].deck[0] === 'ninja' || s.players[0].discard.indexOf('ninja') >= 0,
    '獲得した影札は獲得先に置かれる（**獲得時は底に送らない**。実: deck[0]=' + s.players[0].deck[0] + '）');
  ok(s.players[0].deck[s.players[0].deck.length - 1] !== 'ninja' || s.players[0].deck.length === 1,
    '獲得した影札が勝手に山札の一番下へ移動しない');
}
{
  // 底に置かれた後も普通に動く（`will not necessarily stay on the bottom`）＝引ける
  const K = ['ninja'].concat(K_NONE.slice(0, 9));
  let s = mk(K, 2);
  s.players[0].deck = ['ninja']; s.players[0].hand = []; s.players[0].discard = [];
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['smithy'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'smithy' }); // +3カード（山札は ninja 1枚だけ）
  ok(s.players[0].hand.indexOf('ninja') >= 0, '底の影札も普通に引ける（手札に来る）');
}

console.log('=== R2: 影は山札のどこにあっても手札と同じように使える（アクション権は消費する）===');
{
  const K = ['fishmonger'].concat(K_NONE.slice(0, 9));
  let s = mk(K, 2);
  const p = s.players[0];
  s.turn.phase = 'action'; s.turn.actions = 1;
  p.hand = ['estate']; p.deck = ['copper', 'fishmonger', 'copper']; p.inPlay = [];
  const before = s.turn.buys;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'fishmonger' });
  ok(s.players[0].inPlay.indexOf('fishmonger') >= 0, '山札の途中にある影札を使える（場に出る）');
  ok(s.players[0].deck.indexOf('fishmonger') < 0, '使った影札は山札から消える');
  ok(s.players[0].deck.length === 2, '山札の他の札は減らない');
  ok(s.turn.actions === 0, '**アクション権を普通に消費する**（Donald X. 逐語）');
  // R3 で魚屋の効果（+1購入 +$1）が入った＝山札から使っても効果は普通に解決する。
  ok(s.turn.buys === before + 1, '山札から使っても効果（+1購入）が普通に解決する');
  ok((s.turn.actionsPlayed || 0) === 1, '「アクションを使った」と数える（共謀者・チャンピオン等が正しく効く）');
}
{
  // アクション権0では使えない（`you have to be allowed to play an Action, it doesn't get around that`）
  const K = ['fishmonger'].concat(K_NONE.slice(0, 9));
  let s = mk(K, 2);
  s.turn.phase = 'action'; s.turn.actions = 0;
  s.players[0].deck = ['fishmonger', 'copper'];
  const out = E.reduce(s, { type: 'PLAY_ACTION', card: 'fishmonger' });
  ok(out.players[0].deck.indexOf('fishmonger') >= 0, 'アクション権0では山札の影札を使えない（state 不変で拒否）');
}
{
  // 手札にある影札は普通に手札から出す（山札を先に食わない）
  const K = ['fishmonger'].concat(K_NONE.slice(0, 9));
  let s = mk(K, 2);
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['fishmonger']; s.players[0].deck = ['fishmonger', 'copper']; s.players[0].inPlay = [];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'fishmonger' });
  ok(s.players[0].hand.indexOf('fishmonger') < 0, '手札の影札が使われる');
  ok(s.players[0].deck.filter((c) => c === 'fishmonger').length === 1, '山札の影札は残ったまま（手札を優先）');
}
{
  // 述語（engine/CPU/UI の3面が同じものを見る）
  const K = ['fishmonger'].concat(K_NONE.slice(0, 9));
  const s = mk(K, 2);
  s.players[0].hand = ['village']; s.players[0].deck = ['fishmonger', 'copper'];
  ok(E.canPlayFromHandOrShadow(s, 0, 'village') === true, '手札の札は真');
  ok(E.canPlayFromHandOrShadow(s, 0, 'fishmonger') === true, '山札の影札は真');
  ok(E.canPlayFromHandOrShadow(s, 0, 'copper') === false, '山札の**影でない**札は偽（普通は使えない）');
  ok(E.deckShadows(s, 0).join(',') === 'fishmonger', 'deckShadows が山札の影札だけ返す');
  ok(E.handPlayable(s, 0).indexOf('fishmonger') >= 0, 'handPlayable に山札の影札が入る');
  ok(E.handPlayable(s, 0).indexOf('copper') < 0, 'handPlayable に山札の普通の札は入らない');
}

console.log('=== R2/R3: 資本主義で財宝になった影札は購入フェイズに山札から出せる（1枚タップのみ）===');
{
  /* 公式 Other rules clarifications 逐語＝`If you have bought Capitalism, you can also play Fishmonger
     from your deck whenever you could normally play Treasures from your hand.`
     ⚠ **「財宝を全部出す」（PLAY_ALL_TREASURES）には入れない**＝ボタン1つで山札の影札まで出す事故を避ける
       （§0-24 の playAllResume の轍）。 */
  const KC = ['fishmonger'].concat(K_NONE.slice(0, 9));
  const mkc = (bought) => {
    const st = E.createInitialState([{ name: 'A' }, { name: 'B', isCpu: true }], KC,
      { projects: ['capitalism', 'pageant'] });
    if (bought !== false) st.players[0].projects = ['capitalism'];
    st.turn.phase = 'buy'; st.turn.coins = 0; st.turn.buys = 1;
    return st;
  };
  const base = mkc();
  ok(E.isTreasureFor(base, 'fishmonger') === true, '資本主義を買っていれば魚屋は財宝（前提）');
  // ① 1枚タップ＝山札から出せる
  let a = mkc(); a.players[0].hand = []; a.players[0].deck = ['fishmonger', 'copper'];
  a = E.reduce(a, { type: 'PLAY_TREASURE', card: 'fishmonger' });
  ok(a.players[0].inPlay.indexOf('fishmonger') >= 0, '購入フェイズに山札の影札を1枚タップで出せる');
  ok(a.turn.coins === 1 && a.turn.buys === 2, '効果（+1購入 +$1）も普通に解決する');
  // ② 一括ボタンは巻き込まない
  let b = mkc(); b.players[0].hand = ['copper', 'copper']; b.players[0].deck = ['fishmonger', 'estate'];
  b = E.reduce(b, { type: 'PLAY_ALL_TREASURES' });
  ok(b.players[0].deck.indexOf('fishmonger') >= 0, '「財宝を全部出す」は山札の影札を出さない（事故防止）');
  // ③ 資本主義を買っていなければ出せない
  let c = mkc(false); c.players[0].hand = []; c.players[0].deck = ['fishmonger', 'copper'];
  const before = JSON.stringify(c);
  ok(JSON.stringify(E.reduce(c, { type: 'PLAY_TREASURE', card: 'fishmonger' })) === before,
    '資本主義を買っていなければ購入フェイズに山札から出せない（魚屋は財宝ではない）');
  // ④ 手札を優先
  let d = mkc(); d.players[0].hand = ['fishmonger']; d.players[0].deck = ['fishmonger', 'copper'];
  d = E.reduce(d, { type: 'PLAY_TREASURE', card: 'fishmonger' });
  ok(d.players[0].deck.filter((x) => x === 'fishmonger').length === 1, '手札にあれば手札を優先して出す');
}

console.log('=== R2: 影は「手札」ではない（数えない）／「所有カード」には数える ===');
{
  const s = mk(K_NONE, 2);
  const p = s.players[0];
  p.hand = ['copper', 'estate']; p.deck = ['ninja', 'alley']; p.discard = []; p.inPlay = [];
  ok(p.hand.length === 2, '山札の影札は手札の枚数に数えない（手札は2枚のまま）');
  // 所有カードには数える（庭園/品評会/シルクロードは allCards を見る）
  const all = E.allCards(p);
  ok(all.indexOf('ninja') >= 0 && all.indexOf('alley') >= 0, '**所有カードには数える**（山札の底も所有カード）');
  ok(all.length === 4, '所有カード合計は4枚');
}
{
  // 自分の山札の「どの位置にどの影札があるか」は自分に見える（見えないと操作できない）
  const s = mk(K_NONE, 2);
  s.players[0].deck = ['copper', 'ninja', 'estate', 'alley'];
  s.players[1].deck = ['copper', 'ninja', 'estate'];
  const me = E.maskStateFor(s, 0);
  ok(me.players[0].deck[1] === 'ninja' && me.players[0].deck[3] === 'alley',
    '**自分**の山札は影札の位置と種類が見える（実: ' + me.players[0].deck.join(',') + '）');
  ok(me.players[0].deck.filter((c) => c === 'copper' || c === 'estate').length === 2,
    '影でない札は中身だけ（順序はソートで消える）');
  ok(me.players[1].deck.every((c) => c === 'back'),
    '**相手**の山札は影札も伏せたまま（公式が許すのは自分の山札の裏面を見ることだけ＝許容簡略化）');
}

/* ============================================================================
   R2：群A（手札から「使用させる」窓）の **4面整合** を機械検査する
   ----------------------------------------------------------------------------
   本プロジェクトで最も再発する事故は「engine の窓・engine の受理・CPU の候補・UI のフィルタ」の
   **4面のうち1面だけ直す**ことで、engine拒否×CPU提案の**本番 livelock**／人間が詰む になる
   （§0-29 A4 [high] 12＝将軍×玉座で60戦中11戦が膠着／§0-23「engine の受理側だけを締めるのが
   最も再発する事故」）。旭日 R2 は**18窓すべて**に同じ改修を入れたので、
   「1窓ずつ手で確かめる」のではなく**表を回して構造的に**守る。

   検査する4面（各窓を「**手札にアクション0枚・山札に影札1枚**」の局面で駆動する）：
     ① engine が受理する ＝ その action で state が変わり（拒否＝状態不変にならない）、
        影札が**山札から出て実際に使われる**（ログに「使った」が出る）。
     ② CPU が提案する ＝ `decide` が影札を指す action を返し、engine がそれを受理する
        （＝同じ手を返し続ける livelock にならない。実際に数手回して進むことも確かめる）。
     ③ UI が選べる ＝ jsdom でモーダルを描いて影札のチップが出る（下の jsdom 節）。
     ④ 群B に漏れていない ＝「手札から捨てる/廃棄する/脇に置く/山に戻す」窓では影札を選べない
        （公式逐語＝`this does not mean the Shadow card is in your hand`）。

   ⚠ この表に窓を足したら4面すべてが自動で検査される。**新しい「手札から使わせる」窓を作ったら
      必ずここに1行足すこと**（足さないと次の実装者が1面だけ直しても誰も気づかない）。
   ============================================================================ */
console.log('=== R2: 群A＝「手札から使用させる」18窓 × engine受理／CPU の整合 ===');

const A_KINGDOM = ['gondola', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'];
// 既定の影札＝魚屋（アクション-影・アタックではない＝相手のリアクション窓を開かないので判定が濁らない）。
const A_SH = 'fishmonger';
/* 群Aの局面を作る：**手札にアクションは置かず**、山札の3枚目に影札1枚だけを仕込む。
   ＝「その窓で選べるアクションは山札の影札だけ」という、影対応が効いていなければ必ず破綻する局面。 */
function mkA(shadow, extraHand) {
  const s = E.createInitialState([{ name: 'あなた' }, { name: '相手', isCpu: true }], A_KINGDOM, { startActive: 0 });
  s.turn.active = 0;
  const p = s.players[0];
  p.hand = [];
  p.deck = shadow ? ['copper', 'copper', shadow, 'copper'] : ['copper', 'copper', 'copper', 'copper'];
  p.discard = []; p.inPlay = [];
  s.turn.phase = 'action'; s.turn.actions = 1; s.turn.buys = 1; s.turn.coins = 0;
  s._extraHand = extraHand || [];   // 対照局面（手札の普通のアクションを使う）用の追加手札
  return s;
}
// setup が手札を組むときの唯一の入口（対照局面の追加手札を必ず混ぜる）
const setHand = (s, arr) => { s.players[0].hand = arr.concat(s._extraHand || []); return s; };
const PLAY = (s, card) => E.reduce(s, { type: 'PLAY_ACTION', card });
const ENDTURN = (s) => E.reduce(E.reduce(s, { type: 'END_ACTION_PHASE' }), { type: 'END_TURN' });

/* 18窓の表。setup は「その窓が開いた state」を返す（＝窓を開く面も一緒に検査される）。
   shadow を省略すると魚屋。侵略だけは**アタック**の影札が要るので忍者。 */
const A_WINDOWS = [
  { key: 'throne', jp: '玉座の間', pending: 'throne', act: 'THRONE_CHOOSE',
    setup: (s) => PLAY(setHand(s, ['throne_room']), 'throne_room') },
  { key: 'kings_court', jp: '宮廷', pending: 'kings_court', act: 'KINGS_COURT_CHOOSE',
    setup: (s) => PLAY(setHand(s, ['kings_court']), 'kings_court') },
  { key: 'procession', jp: '行進', pending: 'procession', act: 'PROCESSION_CHOOSE',
    setup: (s) => PLAY(setHand(s, ['procession']), 'procession') },
  { key: 'first_mate', jp: '一等航海士', pending: 'first_mate', act: 'FIRST_MATE_PLAY',
    setup: (s) => PLAY(setHand(s, ['first_mate']), 'first_mate') },
  { key: 'royal_galley', jp: '王家のガレー船', pending: 'royal_galley_play', act: 'ROYAL_GALLEY_PLAY',
    setup: (s) => PLAY(setHand(s, ['royal_galley']), 'royal_galley') },
  { key: 'specialist', jp: '専門家', pending: 'specialist_play', act: 'SPECIALIST_PLAY',
    setup: (s) => PLAY(setHand(s, ['specialist']), 'specialist') },
  { key: 'elder', jp: '長老', pending: 'elder_play', act: 'ELDER_PLAY',
    setup: (s) => PLAY(setHand(s, ['elder']), 'elder') },
  { key: 'market_towns', jp: '市場の町', pending: 'ally_market_towns', act: 'ALLY_MARKET_TOWNS',
    setup: (s) => { s.ally = 'market_towns'; s.players[0].favors = 3; setHand(s, []); return E.reduce(s, { type: 'END_ACTION_PHASE' }); } },
  /* ゴンドラ／苦労／侵略は「手札にアクション（アタック）が1枚もない」と**窓自体を開かない**ので、
     影札だけの局面を作れない＝手札にも1枚置く（`needsHandAction`）。
     この3窓では「CPU が影札を選ぶ」は要求しない（手札の札を選ぶのも正しい）＝
     engine が受理する集合の**部分集合**であることだけ確かめる。 */
  { key: 'gondola', jp: 'ゴンドラ', pending: 'gondola_play', act: 'GONDOLA_PLAY', needsHandAction: true,
    setup: (s) => {
      setHand(s, ['village']); s.turn.phase = 'buy'; s.turn.coins = 4;
      return E.reduce(s, { type: 'BUY', card: 'gondola' });
    } },
  { key: 'toil', jp: '苦労', pending: 'toil', act: 'TOIL_PLAY', needsHandAction: true,
    setup: (s) => {
      s.events = ['toil']; setHand(s, ['village']); s.turn.phase = 'buy'; s.turn.coins = 2;
      return E.reduce(s, { type: 'BUY_EVENT', event: 'toil' });
    } },
  { key: 'conclave', jp: 'コンクラーベ', pending: 'conclave', act: 'CONCLAVE_PLAY',
    setup: (s) => PLAY(setHand(s, ['conclave']), 'conclave') },
  { key: 'imp', jp: 'インプ', pending: 'imp_play', act: 'IMP_PLAY',
    setup: (s) => PLAY(setHand(s, ['imp']), 'imp') },
  { key: 'staff', jp: '杖', pending: 'staff_play', act: 'STAFF_PLAY',
    setup: (s) => { setHand(s, ['staff']); s.turn.phase = 'buy'; return E.reduce(s, { type: 'PLAY_TREASURE', card: 'staff' }); } },
  { key: 'crown', jp: '冠（アクションモード）', pending: 'crown', act: 'CROWN_CHOOSE',
    setup: (s) => PLAY(setHand(s, ['crown']), 'crown') },
  { key: 'mastermind', jp: '首謀者', pending: 'mastermind_play', act: 'MASTERMIND_PLAY',
    setup: (s, sh) => {
      const p = s.players[0];
      /* 次のターン開始時に開く窓＝クリンナップで5枚引かせてから手番を戻す。
         影札の局面＝5枚とも銅貨を引かせ**山札に残るのは影札だけ**／
         対照局面＝鍛冶屋を引かせて**手札に普通のアクション**を持たせる。 */
      setHand(s, ['mastermind']);
      p.deck = sh ? ['copper', 'copper', 'copper', 'copper', 'copper', sh]
        : ['smithy', 'copper', 'copper', 'copper', 'copper'];
      let x = ENDTURN(PLAY(s, 'mastermind'));
      let n = 0;
      while (x.turn.active !== 0 && !x.gameOver && n++ < 5) x = ENDTURN(x);
      return x;
    } },
  { key: 'disciple', jp: '門下生', pending: 'disciple_play', act: 'DISCIPLE_PLAY',
    setup: (s) => PLAY(setHand(s, ['disciple']), 'disciple') },
  { key: 'invasion', jp: '侵略', pending: 'invasion', act: 'INVASION_ATTACK', shadow: 'ninja',
    needsHandAction: true, handAlt: 'militia',
    setup: (s) => {
      s.events = ['invasion']; setHand(s, ['militia']); s.turn.phase = 'buy'; s.turn.coins = 10;
      return E.reduce(s, { type: 'BUY_EVENT', event: 'invasion' });
    } },
  { key: 'inspiring', jp: '鼓舞する', pending: 'inspiring_play', act: 'INSPIRING_PLAY',
    setup: (s) => { s.traits = { inspiring: 'village' }; return PLAY(setHand(s, ['village']), 'village'); } },
  /* 旭日 R5：稽古（Practice・イベント）＝手札のアクション1枚を2回使用してよい＝**群A の新設窓**
     （正本の群A表に新設行として明記／必読18項目にも `本拡張の Practice も同じ` とある）。 */
  { key: 'practice', jp: '稽古', pending: 'practice_play', act: 'PRACTICE_PLAY',
    setup: (s) => {
      s.events = ['practice']; s.turn.phase = 'buy'; s.turn.coins = 10;
      return E.reduce(s, { type: 'BUY_EVENT', event: 'practice' });
    } },
];

ok(A_WINDOWS.length === 19, '群Aの窓は19個ぜんぶ表に載っている（実: ' + A_WINDOWS.length + '）');

const J = (x) => JSON.stringify(x);
// 「その影札が実際に使われたか」＝**山札から**減り、かつログに「〜を使った」が出ている。
function shadowWasPlayed(before, after, sh) {
  const cnt = (s) => s.players[0].deck.filter((c) => c === sh).length;
  const nm = DOM.CARDS[sh].name;
  return cnt(after) < cnt(before) && (after.log || []).some((l) => l.indexOf(nm) >= 0 && /使/.test(l));
}
// 対照局面用＝「手札からでも山札の影札からでも、とにかくその1枚が使われたか」。
function cardWasPlayed(before, after, id) {
  const cnt = (s) => s.players[0].deck.concat(s.players[0].hand).filter((c) => c === id).length;
  const nm = DOM.CARDS[id].name;
  return cnt(after) < cnt(before) && (after.log || []).some((l) => l.indexOf(nm) >= 0 && /使/.test(l));
}
/* 窓を開いた state を作る（jsdom 節・対照局面でも使い回す）。
   mode='shadow'（既定）＝山札に影札1枚・手札にアクション0（needsHandAction の窓だけ1枚）。
   mode='hand'  ＝影札を1枚も置かず、代わりに**手札に普通のアクション**を持たせた対照局面。 */
function openA(w, mode) {
  const useShadow = mode !== 'hand';
  const sh = useShadow ? (w.shadow || A_SH) : null;
  const alt = w.handAlt || 'smithy';
  let s;
  try { s = w.setup(mkA(sh, useShadow ? [] : [alt]), sh); } catch (e) { return { err: e.message || String(e) }; }
  return { s, sh: useShadow ? sh : alt, opened: !!(s && s.pending && s.pending.type === w.pending) };
}

A_WINDOWS.forEach((w) => {
  const r = openA(w);
  const tag = w.jp + '(' + w.key + ')';
  if (r.err) { ok(false, tag + '：局面の準備で例外＝' + r.err); return; }
  // --- 窓を開く面 ---
  ok(r.opened, tag + '：手札にアクション0＋山札に影札1 で窓が開く（実 pending: '
    + (r.s.pending ? r.s.pending.type : 'null') + '）');
  if (!r.opened) return;
  const s = r.s, sh = r.sh, before = J(s);
  ok(E.handPlayable(s, 0).indexOf(sh) >= 0, tag + '：handPlayable に山札の影札が入っている（前提）');

  // --- ① engine が受理する ---
  let after = s, err = null;
  try { after = E.reduce(s, { type: w.act, card: sh }); } catch (e) { err = e.message || String(e); }
  ok(err === null, tag + '：影札を指定した ' + w.act + ' で例外が出ない（実: ' + err + '）');
  ok(J(after) !== before, tag + '：engine が影札を**状態不変で拒否しない**（拒否＝pending が閉じず人間が詰む）');
  ok(shadowWasPlayed(s, after, sh), tag + '：影札が**山札から出て実際に使われる**（空振りしない）');

  // --- ② CPU が提案する（＝engine が受理する集合の部分集合／livelock しない）---
  let ca = null, cerr = null;
  try { ca = DOM.cpu.decide(s); } catch (e) { cerr = e.message || String(e); }
  ok(cerr === null, tag + '：CPU が例外を出さない（実: ' + cerr + '）');
  ok(ca != null, tag + '：CPU が null を返さない（オンラインは reduce(state,null) で部屋が固まる）');
  if (ca) {
    ok(J(E.reduce(s, ca)) !== before,
      tag + '：CPU の手を engine が受理する（engine拒否×CPU提案の livelock を作らない。実: '
      + ca.type + ':' + ca.card + '）');
    /* 「CPU が影札を選ぶ」を要求できるのは**影札しか選べない局面を作れる窓**だけ。
       needsHandAction の3窓は手札のアクションが無いと窓が開かないので、手札の札を選ぶのも正しい
       ＝ここでは「engine が受理する手を返す（＝部分集合）」で十分。 */
    if (!w.needsHandAction) {
      ok(ca.card === sh, tag + '：CPU が**山札の影札**を提案する（実: ' + ca.card + '）');
    }
  }
  // CPU に数手まかせても局面が必ず前に進む（同じ state を返し続けない＝膠着の直接検出）。
  {
    let x = s, stuckAt = -1;
    for (let i = 0; i < 8 && !x.gameOver; i++) {
      const a = DOM.cpu.decide(x);
      if (!a) { stuckAt = i; break; }
      const nx = E.reduce(x, a);
      if (J(nx) === J(x)) { stuckAt = i; break; }
      x = nx;
    }
    ok(stuckAt < 0, tag + '：窓が開いた局面から CPU に8手まかせても膠着しない（実: ' + stuckAt + '手目で停止）');
  }
});

console.log('=== R2: 群B＝「手札から捨てる/廃棄する/脇に置く/山に戻す」窓に影札が漏れない ===');
{
  /* 公式逐語＝`this does not mean the Shadow card is in your hand`。
     群Aと同じ `handPlayable` をうっかり群Bに使うと、**山札の影札を捨てたり廃棄したりできてしまう**。
     ここは「窓を開いた状態で影札を指定しても、影札が山札から1枚も減らない」ことを直接見る。 */
  const B_WINDOWS = [
    ['figurine_discard', '小像', 'FIGURINE_DISCARD'],
    ['ally_woodworkers', '木工ギルド', 'ALLY_WOODWORKERS'],
    ['zombie_apprentice', 'ゾンビの弟子', 'ZOMBIE_APPRENTICE'],
    ['swap_return', '交換', 'SWAP_RETURN'],
    ['arena', '闘技場', 'ARENA_RESOLVE'],
    ['cellar', '地下貯蔵庫', 'CELLAR_RESOLVE'],
    ['chapel', '礼拝堂', 'CHAPEL_RESOLVE'],
    ['discard_down', '民兵型の捨て札', 'DISCARD_DOWN_RESOLVE'],
  ];
  B_WINDOWS.forEach(([type, jp, act]) => {
    const s = mkA(A_SH);
    const p = s.players[0];
    p.hand = ['village', 'copper', 'copper']; p.deck = ['copper', A_SH, 'copper'];
    p.favors = 3;
    s.pending = { type, player: 0, stage: type === 'ally_woodworkers' ? 'trash' : undefined, n: 3 };
    let out = s, err = null;
    try { out = E.reduce(s, { type: act, card: A_SH, cards: [A_SH] }); } catch (e) { err = e.message || String(e); }
    ok(err === null, jp + '(' + type + ')：影札を指定しても例外が出ない（実: ' + err + '）');
    const n0 = s.players[0].deck.filter((c) => c === A_SH).length;
    const n1 = out.players[0].deck.filter((c) => c === A_SH).length;
    ok(n1 === n0, jp + '(' + type + ')：**山札の影札が動かない**（群Bは影札を受け付けない）');
    const q = out.players[0];
    const leaked = ['discard', 'inPlay', 'setAside', 'hand'].filter((z) => (q[z] || []).indexOf(A_SH) >= 0)
      .concat((out.trash || []).indexOf(A_SH) >= 0 ? ['trash'] : []);
    ok(leaked.length === 0, jp + '(' + type + ')：影札が捨て札/廃棄/脇/手札へ漏れない（実: ' + leaked.join(',') + '）');
  });
  // 述語そのものが分かれていること（市場の町＝群A／木工ギルド＝群B を同じ関数で判定しない）
  {
    const s = mkA(A_SH);
    s.players[0].hand = ['copper']; s.players[0].deck = ['copper', A_SH];
    ok(E.handPlayable(s, 0).indexOf(A_SH) >= 0, 'handPlayable（群A用）は山札の影札を含む');
    ok((s.players[0].hand || []).indexOf(A_SH) < 0, '手札そのもの（群B用）は影札を含まない');
  }
}

console.log('=== R2: playPlayable の対称性＝航海(Voyage)の3枚制限・将軍(Warlord)が山札の影札にも効く ===');
{
  /* ⚠ `playCardNoAction` に素で `p.deck` を渡すと `fromHand` が偽になり、
     **航海の3枚制限・将軍・`t.handPlays` の計上が黙って全部スキップされる**
     （＝「玉座経由なら航海の3枚制限を突破できる」抜け道）。`PLAY_ACTION` と対称でなければならない。 */
  // (a) PLAY_ACTION で山札の影札を使うと handPlays が増える
  {
    let s = mkA(A_SH); s.turn.voyageTurn = true; s.turn.handPlays = 0;
    s = PLAY(s, A_SH);
    ok(s.players[0].inPlay.indexOf(A_SH) >= 0, '航海ターンでも山札の影札を使える（前提）');
    ok(s.turn.handPlays === 1, 'PLAY_ACTION の影札は「手札から使った1枚」に数える（実: ' + s.turn.handPlays + '）');
  }
  // (b) 3枚使い切ったら山札の影札も使えない
  {
    const s = mkA(A_SH); s.turn.voyageTurn = true; s.turn.handPlays = 3;
    ok(E.canPlayHandCard(s, 0, A_SH) === false, '航海で3枚使い切ったら canPlayHandCard(影札) は偽');
    const before = J(s);
    ok(J(PLAY(s, A_SH)) === before, '航海で3枚使い切ったら山札の影札を使えない（state 不変で拒否）');
  }
  // (c) 将軍＝場に同名が2枚あると山札の影札も使えない
  {
    const s = mkA(A_SH);
    s.players[1].durationCards = ['warlord'];
    s.players[1].delayedEffects = [{ card: 'warlord', type: 'warlord' }];
    s.players[0].inPlay = [A_SH, A_SH];
    ok(E.warlordBlocks(s, 0, A_SH) === true, '将軍は山札の影札にも効く述語を返す（前提）');
    const before = J(s);
    ok(J(PLAY(s, A_SH)) === before, '将軍が場に2枚ある同名の影札を止める（state 不変で拒否）');
  }
  /* (d) 群Aの各窓：**影札を使ったときの handPlays の増分**が、
         **同じ窓で手札の普通のアクションを使ったときの増分**と等しいこと（＝差分検査）。
     絶対値で「必ず +1」とは書かない：宮廷/行進など、もともと handPlays を数えない窓が
     既存の許容簡略化として在り（§0-29 A4「主要経路にだけ通してある」）、それを赤にしても意味がないため。
     ここで守りたいのは**「影札のときだけ数えない抜け道ができていないか」**という対称性そのもの。 */
  A_WINDOWS.forEach((w) => {
    const rs = openA(w), rh = openA(w, 'hand');
    if (rs.err || !rs.opened || rh.err || !rh.opened) return; // 窓が開かない不整合は上の節が赤にしている
    const delta = (r) => {
      const s = r.s;
      s.turn.voyageTurn = true;
      const h0 = s.turn.handPlays || 0;
      let after = s;
      try { after = E.reduce(s, { type: w.act, card: r.sh }); } catch (e) { return null; }
      if (!cardWasPlayed(s, after, r.sh)) return null;        // 使えていない＝上の節が赤にしている
      return (after.turn.handPlays || 0) - h0;
    };
    const dS = delta(rs), dH = delta(rh);
    if (dS == null || dH == null) return;
    ok(dS === dH,
      w.jp + '(' + w.key + ')：航海の「手札から使った枚数」を**影札でも手札の札と同じだけ**数える'
      + '（影札 +' + dS + ' / 手札 +' + dH + '）');
  });
}

/* ============================================================================
   UI 面（jsdom）＝影札のチップが実際にモーダルに出るか。
   engine と CPU が正しくても、UI のフィルタが手札だけを見ていると**人間だけが影札を使えない**
   （§0-30 P1b の「盾のボタンが embedded 型アタックの3モーダルに無かった」と同じクラス）。
   逆に UI だけが影札を出して engine が拒否すると**人間が押しても何も起きない／詰む**。
   ============================================================================ */
console.log('=== R2: 群A窓の UI（jsdom）＝影札のチップが出る／群Bには出ない ===');
{
  const { JSDOM } = require('jsdom');
  const jd = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>',
    { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = jd.window;
  let tid = 1;
  win.setTimeout = () => tid++; win.clearTimeout = () => {};
  win.requestAnimationFrame = (fn) => { fn(); return 1; };
  let uiErr = null;
  win.addEventListener('error', (e) => { uiErr = e.error || e.message; });
  ['js/cards.js', 'js/engine.js', 'js/cpu.js', 'js/store.js', 'js/net.js', 'js/audio.js', 'js/ui.js']
    .forEach((f) => win.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  const WDOM = win.DOM, UI = WDOM.UI, doc = win.document;

  // vm sandbox で作った state を jsdom 側の realm の素のオブジェクトに移してから描画する
  // （配列の生成 realm が混ざると ui.js 側の判定で事故りうるため。JSON 往復＝オンライン配信と同じ経路）。
  /* ⚠ render() の同期例外は window の 'error' では拾えない＝ここで捕まえないと
     **テストプロセスごと落ちて残りの検査が1件も走らない**（＝スイート全体の感度が消える）。 */
  function showPending(s) {
    uiErr = null;
    UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
    UI.pickZoom = null; UI.sheet = null; UI.confirm = null; UI.lmZoom = null;
    UI.localViewer = s.pending ? s.pending.player : (s.turn ? s.turn.active : 0);
    try {
      UI.store = WDOM.LocalStore(win.JSON.parse(JSON.stringify(s)));
      WDOM.render();
    } catch (e) {
      uiErr = e.message || String(e);
      doc.getElementById('app').innerHTML = '';
    }
  }
  // モーダルの中で「押せるカードのチップ」として並んでいるカード名の一覧
  const modalChipNames = () => Array.from(doc.querySelectorAll('.modal .card.selectable .cname'))
    .map((el) => el.textContent);

  A_WINDOWS.forEach((w) => {
    const r = openA(w);
    const tag = w.jp + '(' + w.key + ')';
    if (r.err || !r.opened) return;             // 窓が開かない不整合は engine 節が既に赤にしている
    const nm = WDOM.CARDS[r.sh].name;
    showPending(r.s);
    ok(!uiErr, tag + '：モーダルの描画で例外が出ない（実: ' + (uiErr || '') + '）');
    ok(doc.querySelector('.modal') != null, tag + '：モーダルが描画される（人間が操作できる）');
    ok(modalChipNames().indexOf(nm) >= 0,
      tag + '：**山札の影札「' + nm + '」のチップが押せる状態で並ぶ**（実: ' + modalChipNames().join(',') + '）');
  });

  // 群B は逆＝影札のチップが**出てはいけない**（出ると engine が拒否して人間が詰む）
  [['cellar', '地下貯蔵庫', 3], ['chapel', '礼拝堂', 0], ['figurine_discard', '小像', 0],
    ['zombie_apprentice', 'ゾンビの弟子', 0], ['discard_down', '民兵型の捨て札', 3]].forEach(([type, jp, n]) => {
    const s = mkA(A_SH);
    s.players[0].hand = ['village', 'copper', 'copper'];
    s.players[0].deck = ['copper', A_SH, 'copper'];
    s.pending = { type, player: 0, n };
    showPending(s);
    ok(!uiErr, jp + '(' + type + ')：描画で例外が出ない（実: ' + (uiErr || '') + '）');
    ok(modalChipNames().indexOf(WDOM.CARDS[A_SH].name) < 0,
      jp + '(' + type + ')：群Bのモーダルに**山札の影札を出さない**（実: ' + modalChipNames().join(',') + '）');
  });
}

console.log('=== R3: 王国カードの効果（影5種・前兆6種・素直な9種）===');
{
  const play = (kingdom, setup, card, act) => {
    let s = mk(kingdom.concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1; s.turn.coins = 0; s.turn.buys = 1;
    s.players[0].hand = []; s.players[0].deck = []; s.players[0].discard = []; s.players[0].inPlay = [];
    setup(s);
    if (s.players[0].hand.indexOf(card) < 0 && s.players[0].deck.indexOf(card) < 0) s.players[0].hand.push(card);
    s = E.reduce(s, { type: 'PLAY_ACTION', card });
    if (act) s = E.reduce(s, act);
    return s;
  };
  // 茶屋＝+1 Sun／+1カード／+1アクション／+2コイン（Sun が減ることも確認）
  {
    const s = play(['tea_house'], (st) => { st.players[0].deck = ['copper', 'copper']; }, 'tea_house');
    ok(s.turn.coins === 2 && s.turn.actions === 1, '茶屋＝+1カード +1アクション +2コイン');
    ok(s.sunTokens === 4, '茶屋で Sun が1個減る（前兆＝効果の一番最初）');
  }
  // 勅使＝+5カード +1購入 +2負債（強制）
  {
    const s = play(['imperial_envoy'], (st) => { st.players[0].deck = ['copper', 'copper', 'copper', 'copper', 'copper']; }, 'imperial_envoy');
    ok(s.players[0].hand.length === 5, '勅使＝+5カード');
    ok(s.turn.buys === 2 && s.players[0].debt === 2, '勅使＝+1購入 と 負債2（強制）');
  }
  // 公家＝場の枚数で分岐（1枚目＝+3アクション／2枚目＝+3カード）
  {
    const s1 = play(['aristocrat', 'village'], (st) => { st.players[0].deck = ['copper', 'copper', 'copper']; }, 'aristocrat');
    ok(s1.turn.actions === 3, '公家1枚目＝+3アクション（1 - 1 + 3）');
    let s2 = mk(['aristocrat'].concat(K_NONE).slice(0, 10), 2);
    s2.turn.phase = 'action'; s2.turn.actions = 1;
    s2.players[0].hand = ['aristocrat']; s2.players[0].inPlay = ['aristocrat'];
    s2.players[0].deck = ['copper', 'copper', 'copper']; s2.players[0].discard = [];
    s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'aristocrat' });
    ok(s2.players[0].hand.length === 3, '公家2枚目＝+3カード（場に2枚）');
  }
  // 浪人＝手札が7枚になるまで引く（影札は手札に数えない）
  {
    let s = mk(['ronin'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['copper', 'copper'];
    s.players[0].deck = ['ronin', 'estate', 'estate', 'estate', 'estate', 'estate', 'estate', 'estate'];
    s.players[0].discard = []; s.players[0].inPlay = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'ronin' });   // 山札から使う
    ok(s.players[0].hand.length === 7, '浪人＝手札が7枚になるまで引く（実: ' + s.players[0].hand.length + '）');
  }
  // 小路＝+1カード +1アクション → 手札1枚を捨てる。⚠ 山札の影札は候補に出ない（群B）
  {
    let s = mk(['alley'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['alley', 'estate'];
    s.players[0].deck = ['copper', 'ninja']; s.players[0].discard = []; s.players[0].inPlay = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'alley' });
    ok(s.pending && s.pending.type === 'alley', '小路＝捨てる窓が開く');
    const before = JSON.stringify(s);
    const bad = E.reduce(s, { type: 'ALLEY_DISCARD', card: 'ninja' }); // 山札の影札は捨てられない
    ok(JSON.stringify(bad) === before, '**山札の影札は小路で捨てられない**（公式が名指しで禁止）');
    s = E.reduce(s, { type: 'ALLEY_DISCARD', card: 'estate' });
    ok(s.pending == null && s.players[0].discard.indexOf('estate') >= 0, '手札の札は普通に捨てられる');
  }
  // 忍者＝+1カード＋民兵型アタック（down は 3）。影札は被害者の手札に数えない
  {
    let s = mk(['ninja'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['ninja']; s.players[0].deck = ['copper']; s.players[0].inPlay = [];
    s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'estate'];
    s.players[1].deck = ['alley']; // 相手の山札の影札は手札に数えない
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'ninja' });
    ok(s.pending && /discard_down/.test(s.pending.type), '忍者＝手札を捨てさせる窓（民兵型）');
    ok(s.pending.down === 3, '**down は 3**（剣の4ではない。実: ' + s.pending.down + '）');
  }
  // 狸＝廃棄して最大+$2高いカードを獲得。⚠ 獲得では負債を負わない
  {
    let s = mk(['tanuki'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['tanuki', 'estate']; s.players[0].deck = []; s.players[0].inPlay = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'tanuki' });
    s = E.reduce(s, { type: 'TANUKI_TRASH', card: 'estate' });   // 屋敷($2)を廃棄 → $4まで
    ok(s.pending && s.pending.type === 'tanuki' && s.pending.stage === 'gain', '狸＝獲得の窓');
    ok(s.pending.maxCost === 4, '上限は廃棄したカードのコイン+2（実: ' + s.pending.maxCost + '）');
    s = E.reduce(s, { type: 'TANUKI_GAIN', card: 'silver' });
    ok(s.players[0].discard.indexOf('silver') >= 0, '銀貨を獲得できる');
    ok((s.players[0].debt || 0) === 0, '**獲得では負債を負わない**（2024エラッタ＝購入だけ）');
  }
  // 名匠＝+2負債してコスト5以下を獲得（強制）。⚠ finishGain は boolean（state を壊さない）
  {
    let s = mk(['craftsman'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['craftsman']; s.players[0].deck = []; s.players[0].inPlay = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'craftsman' });
    ok(s.players[0].debt === 2, '名匠＝+2負債');
    ok(s.pending && s.pending.type === 'craftsman', '獲得の窓が開く');
    s = E.reduce(s, { type: 'CRAFTSMAN_GAIN', card: 'silver' });
    ok(s && s.supply, '**reduce が state を返す**（finishGain は boolean＝return してはいけない）');
    ok(s.players[0].discard.indexOf('silver') >= 0 && s.pending == null, '銀貨を獲得して窓が閉じる');
  }
  // 札差＝財宝なら+2／アクションなら+5／**両方なら両方**
  {
    const mkRB = (trash) => {
      let s = mk(['rice_broker'].concat(K_NONE).slice(0, 10), 2);
      s.turn.phase = 'action'; s.turn.actions = 1;
      s.players[0].hand = ['rice_broker', trash];
      s.players[0].deck = new Array(9).fill('copper'); s.players[0].inPlay = []; s.players[0].discard = [];
      s = E.reduce(s, { type: 'PLAY_ACTION', card: 'rice_broker' });
      return E.reduce(s, { type: 'RICE_BROKER_TRASH', card: trash });
    };
    ok(mkRB('copper').players[0].hand.length === 2, '札差×財宝＝+2カード');
    ok(mkRB('village').players[0].hand.length === 5, '札差×アクション＝+5カード');
  }
  // 金山＝金貨と負債4はセット（金貨だけは取れない）／山が空でも「やる」を選べる
  {
    let s = mk(['gold_mine'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['gold_mine']; s.players[0].deck = ['copper']; s.players[0].inPlay = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'gold_mine' });
    ok(s.pending && s.pending.type === 'gold_mine', '金山＝二択の窓');
    const yes = E.reduce(s, { type: 'GOLD_MINE_CHOOSE', doIt: true });
    ok(yes.players[0].discard.indexOf('gold') >= 0 && yes.players[0].debt === 4, '「やる」＝金貨と負債4がセット');
    const no = E.reduce(s, { type: 'GOLD_MINE_CHOOSE', doIt: false });
    ok(no.players[0].discard.indexOf('gold') < 0 && (no.players[0].debt || 0) === 0, '「やらない」＝どちらも無し');
  }
  // 交替＝負債があれば+$3／なければ廃棄して「コインコストが厳密に高い」札を獲得＋差ぶんの負債
  {
    let s = mk(['change'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['change']; s.players[0].debt = 3; s.players[0].deck = []; s.players[0].inPlay = [];
    const withDebt = E.reduce(s, { type: 'PLAY_ACTION', card: 'change' });
    ok(withDebt.turn.coins === 3 && withDebt.pending == null, '交替＝負債があれば +3コインだけ');
    let s2 = mk(['change'].concat(K_NONE).slice(0, 10), 2);
    s2.turn.phase = 'action'; s2.turn.actions = 1;
    s2.players[0].hand = ['change', 'estate']; s2.players[0].debt = 0; s2.players[0].deck = []; s2.players[0].inPlay = []; s2.players[0].discard = [];
    s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'change' });
    s2 = E.reduce(s2, { type: 'CHANGE_TRASH', card: 'estate' });      // 屋敷＝$2
    ok(s2.pending && s2.pending.stage === 'gain' && s2.pending.ref === 2, '交替＝廃棄したコインコストを覚える');
    const bad = E.reduce(s2, { type: 'CHANGE_GAIN', card: 'estate' }); // 同コストは不可（**厳密に高い**）
    ok(JSON.stringify(bad) === JSON.stringify(s2), '同じコインコストのカードは獲得できない（厳密比較）');
    s2 = E.reduce(s2, { type: 'CHANGE_GAIN', card: 'silver' });        // 銀貨＝$3（差1）
    ok(s2.players[0].discard.indexOf('silver') >= 0, '銀貨を獲得できる');
    ok(s2.players[0].debt === 1, '**コインコストの差ぶん**の負債（$3-$2=1。実: ' + s2.players[0].debt + '）');
  }
  // 山の社＝+1 Sun／+2コイン／廃棄は任意だが**判定は必ず走る**
  {
    let s = mk(['mountain_shrine'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    // 手札が山の社1枚だけ＝使うと手札0枚＝廃棄の窓は開かず、判定だけが走る
    s.players[0].hand = ['mountain_shrine']; s.players[0].deck = ['copper', 'copper']; s.players[0].inPlay = [];
    s.trash = ['village'];   // 廃棄置き場にアクションがある
    const solo = E.reduce(s, { type: 'PLAY_ACTION', card: 'mountain_shrine' });
    ok(solo.turn.coins === 2, '山の社＝+2コイン');
    ok(solo.sunTokens === 4, '+1 Sun');
    ok(solo.pending == null, '手札0枚なら廃棄の窓を開かない（人間が詰まない）');
    ok(solo.players[0].hand.length === 2, '**廃棄しなくても判定は走る**（+2カード）');
    // 手札が残っていれば廃棄の窓が開く（任意）
    let s2 = mk(['mountain_shrine'].concat(K_NONE).slice(0, 10), 2);
    s2.turn.phase = 'action'; s2.turn.actions = 1;
    s2.players[0].hand = ['mountain_shrine', 'estate']; s2.players[0].deck = ['copper', 'copper'];
    s2.players[0].inPlay = []; s2.trash = ['village'];
    s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'mountain_shrine' });
    ok(s2.pending && s2.pending.type === 'mountain_shrine', '手札があれば廃棄の窓（任意）');
    const noTrash = E.reduce(s2, { type: 'MOUNTAIN_SHRINE_TRASH', card: null });
    ok(noTrash.pending == null && noTrash.players[0].hand.length === 3, '廃棄しなくても +2カード（1枚＋2枚）');
    const didTrash = E.reduce(s2, { type: 'MOUNTAIN_SHRINE_TRASH', card: 'estate' });
    ok(didTrash.trash.indexOf('estate') >= 0, '廃棄も選べる');
  }
  // 濡女＝手札が全部異なれば山に戻して相手に呪い
  {
    let s = mk(['snake_witch'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['snake_witch']; s.players[0].deck = ['estate']; s.players[0].inPlay = [];
    s.players[1].hand = []; // リアクション無し
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'snake_witch' });
    ok(s.pending && s.pending.type === 'snake_witch', '濡女＝山に戻すかの窓（手札が全部異なる）');
    const before = s.supply.snake_witch;
    s = E.reduce(s, { type: 'SNAKE_WITCH_RESOLVE', doIt: true });
    ok(s.supply.snake_witch === before + 1, '山に戻る（獲得でも廃棄でもない＝supply が増える）');
    ok(s.players[1].discard.indexOf('curse') >= 0, '他のプレイヤーが呪いを獲得する');
  }
  // 歌人＝山札の一番上がコスト3以下なら手札へ（サプライと無関係＝costUpTo を使わない）
  {
    let s = mk(['poet'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['poet']; s.players[0].deck = ['copper', 'silver', 'gold']; s.players[0].inPlay = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'poet' });   // +1カード→銅貨／次の上＝銀貨($3)
    ok(s.players[0].hand.indexOf('silver') >= 0, '山札の上が$3以下なら手札に加える');
    let s2 = mk(['poet'].concat(K_NONE).slice(0, 10), 2);
    s2.turn.phase = 'action'; s2.turn.actions = 1;
    s2.players[0].hand = ['poet']; s2.players[0].deck = ['copper', 'gold', 'estate']; s2.players[0].inPlay = [];
    s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'poet' });  // 次の上＝金貨($6)
    ok(s2.players[0].deck[0] === 'gold', '$3より高ければ**山札の上に残す**（捨て札を経由しない）');
  }
  // 田舎の村＝ちょうど2枚捨てて+1カード（任意）
  {
    let s = mk(['rustic_village'].concat(K_NONE).slice(0, 10), 2);
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.players[0].hand = ['rustic_village', 'estate', 'estate'];
    s.players[0].deck = ['copper', 'copper']; s.players[0].inPlay = []; s.players[0].discard = [];
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'rustic_village' });
    ok(s.turn.actions === 2 && s.sunTokens === 4, '田舎の村＝+2アクション（+1 Sun 済み）');
    const one = E.reduce(s, { type: 'RUSTIC_VILLAGE_DISCARD', cards: ['estate'] });
    ok(JSON.stringify(one) === JSON.stringify(s), '**1枚では受理しない**（ちょうど2枚）');
    const two = E.reduce(s, { type: 'RUSTIC_VILLAGE_DISCARD', cards: ['estate', 'estate'] });
    ok(two.players[0].discard.length === 2 && two.pending == null, '2枚捨てて窓が閉じる');
    const none = E.reduce(s, { type: 'RUSTIC_VILLAGE_DISCARD', cards: [] });
    ok(none.pending == null, '捨てない（任意）も選べる');
  }
}

console.log('\n========================================');
console.log('旭日テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail === 0 ? 0 : 1);
