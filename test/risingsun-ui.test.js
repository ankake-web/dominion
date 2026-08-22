/* 旭日（Rising Sun）UI スモーク（jsdom）
   使い方: node test/risingsun-ui.test.js
   主目的＝**人間が詰まない／見えないと困るものが見えている**こと。
   R1＝予言(Prophecy)と Sun トークンの残数が盤面に出ること（**どちらも公開情報**＝
        「あと何回『+1 Sun』で発動するか」は全員の戦略に直結する）。 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = '<!DOCTYPE html><html><body><div id="app"></div></body></html>';
const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
const timers = []; let timerId = 1;
win.setTimeout = (fn) => { const id = timerId++; timers.push({ id, fn }); return id; };
win.clearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
win.requestAnimationFrame = (fn) => { fn(); return 1; };
let runtimeError = null;
win.addEventListener('error', (e) => { runtimeError = e.error || e.message; });
function load(f) { win.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')); }
['js/cards.js', 'js/engine.js', 'js/cpu.js', 'js/store.js', 'js/net.js', 'js/audio.js', 'js/ui.js'].forEach(load);
win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

const doc = win.document;
const DOM = win.DOM;
const UI = DOM.UI;
const E = DOM.engine;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  x FAIL: ' + m); } }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.pickZoom = null; UI.sheet = null; UI.confirm = null; UI.lmZoom = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const FILLER = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'];

console.log('=== R1: 予言の盤面表示（前兆がある王国）===');
{
  const s = E.createInitialState(['あなた', '相手'], ['tea_house'].concat(FILLER),
    { startActive: 0, prophecy: 'good_harvest' });
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
  const txt = doc.body.textContent;
  ok(txt.indexOf('予言') >= 0, '盤面に「予言」の行が出る');
  ok(txt.indexOf('豊作') >= 0, '配られた予言の名前（豊作）が見える');
  ok(txt.indexOf('残り 5個') >= 0, 'Sun トークンの残数（2人戦＝5個）が見える');
  ok(txt.indexOf('発動中') < 0, 'まだ発動していないので「発動中」とは出ない');
  ok(doc.querySelector('.prophecy-row') != null, '予言の行（.prophecy-row）が描画される');
  const thumb = doc.querySelector('.prophecy-row img');
  ok(thumb && /good_harvest\.webp$/.test(thumb.getAttribute('src') || ''), '予言のサムネ画像が出る');
}

console.log('=== R1: Sun が減ると残数表示が追随し、発動すると表示が変わる ===');
{
  let s = E.createInitialState(['あなた', '相手'], ['tea_house'].concat(FILLER),
    { startActive: 0, prophecy: 'great_leader' });
  E.removeSun(s, 0); E.removeSun(s, 0);
  showAs(s, 0);
  ok(doc.body.textContent.indexOf('残り 3個') >= 0, '2回取り除いたら「残り 3個」になる');
  E.removeSun(s, 0); E.removeSun(s, 0); E.removeSun(s, 0);
  showAs(s, 0);
  const txt = doc.body.textContent;
  ok(s.prophecyOn === true, '5回で発動している（前提）');
  ok(txt.indexOf('発動中') >= 0, '発動したら「発動中（ゲーム終了まで有効）」と出る');
  // ⚠ 盤面全体には「残り 0」（アクション権の初心者ガイド）も出るので、**予言の行の中だけ**を見る。
  const row = doc.querySelector('.prophecy-row');
  ok(row && row.textContent.indexOf('残り') < 0, '発動後は予言の行に残数を出さない（実: ' + (row ? row.textContent.slice(0, 40) : 'なし') + '）');
}

console.log('=== R1: 前兆が無いゲームでは予言ブロックを出さない ===');
{
  const s = E.createInitialState(['あなた', '相手'], FILLER.concat(['mine']), { startActive: 0 });
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
  ok(s.prophecy == null, '前兆が無いので予言は配られていない（前提）');
  ok(doc.querySelector('.prophecy-row') == null, '予言の行が描画されない');
  ok(doc.body.textContent.indexOf('Sunトークンが尽きると発動') < 0, '予言の見出しも出ない');
}

console.log('=== R1: マスク済み state（オンライン配信の形）でも予言と残数が見える（公開情報）===');
{
  /* 予言と Sun の残数は**全員に見える公開情報**。オンラインではサーバが席ごとにマスクした state を配るので、
     マスクを通した後でも盤面に出ることを確かめる（相手の手札のように伏せてはいけない）。
     ※ローカル対戦で「手番でない席」を viewer にすると目隠し画面（端末を渡してください）になるので、
       ここは手番プレイヤーの視点でマスク済み state を描く＝オンラインで実際に届く形。 */
  const s = E.createInitialState(['あなた', '相手'], ['kitsune'].concat(FILLER),
    { startActive: 0, prophecy: 'panic' });
  E.removeSun(s, 0);
  const masked = E.maskStateFor(s, 0);
  ok(masked.prophecy === 'panic', 'マスクしても予言は残る（公開情報）');
  ok(masked.sunTokens === 4, 'マスクしても Sun の残数は残る');
  showAs(masked, 0);
  ok(!runtimeError, 'マスク済み state の描画で例外が出ない: ' + (runtimeError || ''));
  const txt = doc.body.textContent;
  ok(txt.indexOf('狼狽') >= 0, 'マスク済み state でも予言の名前が見える');
  ok(txt.indexOf('残り 4個') >= 0, 'マスク済み state でも Sun の残数が見える');
  // 相手の手札は伏せられている（マスクが効いていることの対照）
  ok(masked.players[1].hand.every((c) => c === 'back'), '対照：相手の手札は伏せられている');
}

console.log('=== R1: 予言の拡大表示が「予言 / Prophecy」になる ===');
{
  const s = E.createInitialState(['あなた', '相手'], ['poet'].concat(FILLER),
    { startActive: 0, prophecy: 'divine_wind' });
  showAs(s, 0);
  UI.lmZoom = 'divine_wind';
  DOM.render();
  const txt = doc.body.textContent;
  ok(txt.indexOf('予言 / Prophecy') >= 0, '拡大表示の種別ラベルが「予言 / Prophecy」（ランドマークと誤表示されない）');
  ok(txt.indexOf('神風') >= 0, '拡大表示に予言の名前が出る');
  UI.lmZoom = null;
}

console.log('=== R1: 横型の kind ラベルが全種そろっている（既存の誤表示の回帰）===');
{
  const MAP = (UI && UI.LS_KIND_LABEL) || {};
  const kinds = new Set();
  Object.values(DOM.LANDSCAPES || {}).forEach((ls) => { if (ls && ls.kind) kinds.add(ls.kind); });
  const missing = [...kinds].filter((k) => !MAP[k]);
  ok(missing.length === 0, 'LS_KIND_LABEL に全 kind がある（欠け: ' + (missing.join(',') || 'なし') + '）');
  ['ally', 'trait', 'boon', 'hex', 'state', 'prophecy'].forEach((k) => {
    ok(MAP[k] && MAP[k].indexOf('ランドマーク') < 0, k + ' が「ランドマーク」と誤表示されない（実: ' + MAP[k] + '）');
  });
}

console.log('=== R1: 旭日のカード一覧（王国25／イベント10／予言15）===');
{
  runtimeError = null;
  UI.view = 'cardList'; UI.lmZoom = null; UI.sheet = null;
  DOM.render();
  ok(!runtimeError, 'カード一覧の描画で例外が出ない: ' + (runtimeError || ''));
  const txt = doc.body.textContent;
  ok(txt.indexOf('王国カード（旭日）') >= 0, '「王国カード（旭日）」の群が出る');
  ok(txt.indexOf('イベント（旭日') >= 0, '「イベント（旭日…）」の群が出る');
  ok(txt.indexOf('予言（旭日') >= 0, '「予言（旭日…）」の群が出る');
  // 代表カードの名前が並ぶ（前兆・影・負債・予言）
  ['茶屋', '忍者', '大名', '神風', '継続'].forEach((n) => {
    ok(txt.indexOf(n) >= 0, 'カード一覧に「' + n + '」が出る');
  });
  UI.view = 'game';
}

/* ===== R4〜R6：新 pending 全種にモーダルと「押せる選択肢」があるか（人間が詰まないことの担保）=====
   🛑 本プロジェクトで最も再発する事故＝**engine と CPU は受理するのに UI に導線が無く人間だけ詰む**
   （§0-29 A4 の [high]「追いはぎ/将軍のリアクション窓に UI が無い」／§0-30 P1b の「盾のボタンが無い」）。
   pending を**直接注入して**描画し、`.modal` が出て**押せるボタンかカードチップが1つ以上ある**ことを見る。 */
console.log('=== R4〜R6: 旭日の新 pending にモーダルと押せる選択肢がある ===');
{
  const K = ['tea_house', 'kitsune', 'river_shrine', 'riverboat', 'artist', 'rice', 'samurai', 'daimyo', 'ninja', 'litter'];
  const PENDINGS = [
    // R4：予言
    { p: { type: 'growth_gain', player: 0, coin: 6, pot: 0, debt: 0 }, jp: '成長' },
    { p: { type: 'kind_emperor_gain', player: 0 }, jp: '神器' },
    { p: { type: 'sickness', player: 0 }, jp: '病' },
    // R3/R4：前兆（R3 で漏れていた2種）
    { p: { type: 'kitsune', stage: 'choose', player: 0 }, jp: '狐' },
    { p: { type: 'river_shrine_trash', player: 0 }, jp: '川の社（廃棄）' },
    { p: { type: 'river_shrine_gain', player: 0 }, jp: '川の社（獲得）' },
    // R6：川船
    { p: { type: 'riverboat_play', player: 0 }, jp: '川船' },
    // R5：イベント
    { p: { type: 'amass_gain', player: 0 }, jp: '蓄積' },
    { p: { type: 'asceticism_pay', player: 0, max: 3 }, jp: '苦行（額）' },
    { p: { type: 'asceticism_trash', player: 0, need: 2 }, jp: '苦行（廃棄）' },
    { p: { type: 'credit_gain', player: 0 }, jp: '信用' },
    { p: { type: 'kintsugi_trash', player: 0 }, jp: '金継ぎ（廃棄）' },
    { p: { type: 'kintsugi_gain', player: 0, coin: 4, pot: 0, debt: 0 }, jp: '金継ぎ（獲得）' },
    { p: { type: 'practice_play', player: 0 }, jp: '稽古' },
    { p: { type: 'sea_trade_trash', player: 0, max: 2 }, jp: '海上交易' },
    { p: { type: 'receive_tribute_gain', player: 0, gained: [] }, jp: '賛辞' },
    { p: { type: 'gather_gain', player: 0, need: 4 }, jp: '参集' },
    { p: { type: 'continue_gain', player: 0 }, jp: '継続' },
  ];
  PENDINGS.forEach((row) => {
    const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0, prophecy: 'good_harvest' });
    // どの窓でも「押せる候補」が作れるように手札を整える（廃棄/使用の窓は手札が要る）。
    s.players[0].hand = ['village', 'copper', 'estate', 'smithy', 'militia'];
    s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.actions = 1;
    s.pending = row.p;
    showAs(s, 0);
    ok(!runtimeError, row.jp + '：描画で例外が出ない: ' + (runtimeError || ''));
    const modal = doc.querySelector('.modal');
    ok(modal != null, row.jp + '：モーダルが出る');
    if (modal) {
      const btns = modal.querySelectorAll('button:not([disabled])').length;
      const chips = modal.querySelectorAll('.card, .chip, .choose-tile').length;
      ok(btns + chips > 0, row.jp + '：押せる選択肢が1つ以上ある（ボタン' + btns + '／チップ' + chips + '）');
    }
  });
}

/* 稽古（群A）＝**山札の影(Shadow)カードもチップに並ぶ**／
   川の社の廃棄（群B）＝**山札の影札は並ばない**（影札は手札ではない＝公式）。 */
console.log('=== R5: 稽古（群A）は山札の影札を選べる／川の社の廃棄（群B）は選べない ===');
{
  const K = ['tea_house', 'ninja', 'river_shrine', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'litter'];
  const mkS = (pend) => {
    const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0, prophecy: 'good_harvest' });
    s.players[0].hand = ['village'];
    s.players[0].deck = ['ninja', 'copper', 'copper'];   // 山札の影札
    s.turn.phase = 'buy'; s.turn.actions = 1;
    s.pending = pend;
    showAs(s, 0);
    return doc.querySelector('.modal');
  };
  {
    const m = mkS({ type: 'practice_play', player: 0 });
    ok(m != null && /忍者/.test(m.textContent), '稽古（群A）：山札の影札「忍者」が選べる');
  }
  {
    const m = mkS({ type: 'river_shrine_trash', player: 0 });
    ok(m != null && !/忍者/.test(m.textContent), '川の社の廃棄（群B）：山札の影札は並ばない');
  }
}

console.log('=== R4: 好機到来の脇札と洞察の脇札が盤面に出る ===');
{
  const s = E.createInitialState(['あなた', '相手'], ['tea_house'].concat(FILLER),
    { startActive: 0, prophecy: 'biding_time' });
  s.players[0].bidingAside = ['copper', 'estate'];
  s.players[0].foresightAside = ['village'];
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
}

/* 任意の窓は**0枚選択のまま辞退できる**こと。
   🛑 `modalMultiHand` の `allowZero` を false にすると「捨てたくないのに札を1枚選ばないと閉じられない」
      ＝確定ボタンが `disabled` のまま出る（ハードロックではないが導線が壊れている）。
      旭日の中で **田舎の村が false・川の社が true** と食い違っていたので恒久検査にする。 */
console.log('=== R3/R4: 任意の窓は最初から辞退ボタンを押せる ===');
{
  const K = ['rustic_village', 'river_shrine', 'mountain_shrine', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'tea_house'];
  const openable = (pend) => {
    const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
    s.players[0].hand = ['copper', 'estate', 'silver', 'gold'];
    s.turn.phase = 'action'; s.turn.actions = 1;
    s.pending = pend;
    showAs(s, 0);
    const m = doc.querySelector('.modal');
    if (!m) return { err: 'モーダルが無い' };
    const btns = Array.from(m.querySelectorAll('button'));
    return { any: btns.some((b) => !b.disabled), labels: btns.map((b) => (b.textContent || '').trim() + (b.disabled ? '(無効)' : '')) };
  };
  [['rustic_village', '田舎の村'], ['river_shrine_trash', '川の社']].forEach(([ty, jp]) => {
    const r = openable({ type: ty, player: 0 });
    ok(r.any, `${jp}：1枚も選ばない状態で押せるボタンがある（実: ${(r.labels || []).join(' / ') || r.err}）`);
  });
}

console.log('\n========================================');
console.log('旭日UIテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
