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

console.log('=== R1: 旭日はまだ実プレイに出ない（段階1の封じ込め）===');
{
  const sets = (DOM.CARD_SETS || []).map((x) => x.id);
  const leaked = [];
  sets.forEach((id) => {
    for (let i = 0; i < 20; i++) {
      const k = DOM.kingdomForSet(id) || [];
      k.forEach((c) => { if ((DOM.POOLS.risingsun || []).indexOf(c) >= 0) leaked.push(id + ':' + c); });
    }
  });
  ok(leaked.length === 0, 'どの CARD_SET を抽選しても旭日の王国カードは出ない（実: ' + leaked.slice(0, 5).join(',') + '）');
  ok((DOM.STAGE1_POOLS || []).indexOf('risingsun') >= 0, 'STAGE1_POOLS に risingsun が入っている（闇市場から除外）');
  // 横型（イベント10・予言15）も漏れない＝landscapesForSet を全 CARD_SET ×20回まわす
  {
    const rsLs = (DOM.EVENTS_RISINGSUN || []).concat(DOM.PROPHECIES_RISINGSUN || []);
    const lsLeak = [];
    sets.forEach((id) => {
      for (let i = 0; i < 20; i++) {
        const o = DOM.landscapesForSet(id) || {};
        [].concat(o.landmarks || [], o.events || [], o.projects || [], o.ways || [], o.traits || [])
          .forEach((x) => { if (rsLs.indexOf(x) >= 0) lsLeak.push(id + ':' + x); });
      }
    });
    ok(lsLeak.length === 0, 'どの CARD_SET でも旭日の横型（イベント/予言）は出ない（実: ' + lsLeak.slice(0, 5).join(',') + '）');
  }
  // mix-all のプールにも未登録＝mix でも出ない（R7 でここに足す）
  ok(!(DOM.MIX_KINGDOM_POOLS || {}).risingsun, 'MIX_KINGDOM_POOLS に risingsun が未登録（mix-all にも出ない）');
  {
    const lsPools = Object.keys(DOM.MIX_LANDSCAPE_POOLS || {});
    const rsPool = lsPools.filter((k) => /risingsun|proph/.test(k));
    ok(rsPool.length === 0, 'MIX_LANDSCAPE_POOLS に旭日の横型プールが未登録（実: ' + rsPool.join(',') + '）');
  }
  // 闇市場デッキにも入らない（STAGE1_POOLS の実効を state で確認）
  {
    const bmK = ['black_market', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine', 'remodel'];
    const s = mk(bmK, 2);
    const bm = s.blackMarket || [];
    const leak = bm.filter((id) => (DOM.POOLS.risingsun || []).indexOf(id) >= 0);
    ok(bm.length > 0, '闇市場デッキが作られている（' + bm.length + '枚）');
    ok(leak.length === 0, '闇市場デッキに旭日のカードが入らない（実: ' + leak.join(',') + '）');
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

console.log('\n========================================');
console.log('旭日テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail === 0 ? 0 : 1);
