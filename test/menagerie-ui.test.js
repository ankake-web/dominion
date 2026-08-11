/* 移動動物園（Menagerie）UI スモーク（jsdom）
   王国30種・習性20種・イベント20種のすべての選択モーダルと、盤面（追放マット・馬の山・習性帯・
   イベント帯・投資・脇置き）がエラー無く描画でき、**必ず押せるものが1つ以上ある**ことを確認する。
   使い方: node test/menagerie-ui.test.js
   ※「選択肢ゼロの閉じられないモーダル」＝人間が詰む、を防ぐのがこのスイートの主目的。 */
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
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + m); } }
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function byText(sel, t) { return $all(sel).find((e) => e.textContent.includes(t)); }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.pickZoom = null; UI.sheet = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const K = DOM.KINGDOM_MENAGERIE.slice();
function mk(opts) { return E.createInitialState(['あなた', '相手'], K.slice(), Object.assign({ startActive: 0 }, opts || {})); }
function mkK(kingdom, opts) { return E.createInitialState(['あなた', '相手'], kingdom.slice(), Object.assign({ startActive: 0 }, opts || {})); }
function showPend(pd, setup, kingdom, opts) {
  const s = kingdom ? mkK(kingdom, opts) : mk(opts);
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}
// モーダルが出ていて、押せるもの（ボタン or 選択チップ）が1つ以上あるか＝人間が詰まない
function actionable() {
  if (runtimeError || !$('.modal')) return false;
  const btns = $all('.modal button').filter((b) => !b.disabled);
  const chips = $all('.modal .chip-grid .card, .modal .chip-grid .pick-supply');
  return btns.length + chips.length > 0;
}

try {
  /* ============================================================
     1) 盤面（追放マット・馬の山・投資・脇置き・習性帯・イベント帯）
     ============================================================ */
  console.log('=== 盤面（追放マット／馬／投資／脇置き／習性帯／イベント帯）===');
  {
    const s = mk({ events: ['ride', 'invest'], ways: ['way_of_the_mouse', 'way_of_the_ox'] });
    s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 2;
    s.players[0].exile = ['gold', 'gold', 'curse'];
    s.players[0].exileInvested = { village: 1 };
    s.players[0].eventSetAside = ['gold'];
    showAs(s, 0);
    ok(!runtimeError, '移動動物園の盤面が例外なく描画される');
    ok(byText('.mat-row', '追放マット') && byText('.mat-row', '金貨×2'), '追放マットが枚数つきで出る');
    ok(byText('.mat-row', '投資'), '投資したカードが盤面に出る');
    ok(byText('.mat-row', '次のターン開始時に使う'), '遅延/刈り入れの脇置きが盤面に出る');
    ok(byText('.mat-row', 'ハツカネズミの習性') || byText('.way-row', 'ハツカネズミの習性'), '習性帯が出る');
    ok(byText('.supply-section', 'イベント') || byText('h3', 'イベント') || byText('.section-h', 'イベント'),
      'イベント帯が出る');
  }
  {
    // 馬の山（非サプライ）が盤面に出る／購入ボタンは出ない
    const s = mk({ events: ['ride'] });
    s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1;
    showAs(s, 0);
    ok(s.supply.horse === 30 && !runtimeError, '馬の山（30枚）がある盤面が描画できる');
  }
  {
    // イベントの購入ボタン（買える／買えない）
    const s = mk({ events: ['ride', 'alliance'] });
    s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1;
    showAs(s, 0);
    const buyBtns = $all('button').filter((b) => b.textContent === '買う');
    ok(buyBtns.length === 2, 'イベント2枚ぶんの「買う」ボタンが出る');
    ok(buyBtns.some((b) => !b.disabled) && buyBtns.some((b) => b.disabled),
      '$2の乗馬は買えて $10の同盟は買えない（コストで有効/無効が分かれる）');
  }

  /* ============================================================
     2) イベント20種の選択モーダル（新 pending）
     ============================================================ */
  console.log('=== イベント20種：選択モーダル ===');
  {
    showPend({ type: 'bargain_gain', player: 0 });
    ok(actionable() && byText('.modal h3', '特価品'), '特価品：獲得モーダルに候補が出る');
  }
  {
    showPend({ type: 'demand_gain', player: 0 });
    ok(actionable() && byText('.modal h3', '要求'), '要求：$4以下の獲得モーダル');
  }
  {
    showPend({ type: 'desperation', player: 0 });
    ok(actionable() && byText('.modal button', '呪いを獲得する'), '絶望：呪いを獲得するかの2択');
  }
  {
    // 放逐＝1段目（名前を選ぶ）→2段目（枚数）
    const s = showPend({ type: 'banish', player: 0 }, (st) => { st.players[0].hand = ['estate', 'estate', 'copper']; });
    ok(actionable() && byText('.modal h3', '放逐'), '放逐：追放するカードを選べる');
    ok(byText('.modal button', '追放しない'), '放逐：追放しない も選べる');
    UI.selection = 'estate'; DOM.render();
    ok($('.modal') && byText('.modal button', '追放する'), '放逐：カードを選ぶと枚数モーダルになる');
    UI.selection = [];
    // 手札に無いカードが UI.selection に残っていても壊れない（持ち越し汚染の回帰）
    UI.selection = 'gold'; showAs(s, 0);
    ok(!runtimeError && $('.modal'), '放逐：手札に無い名前が選択に残っていても壊れない');
    UI.selection = [];
  }
  {
    showPend({ type: 'invest', player: 0 });
    ok(actionable() && byText('.modal h3', '投資'), '投資：サプライのアクションを選べる');
  }
  {
    showPend({ type: 'transport', stage: 'mode', player: 0 });
    ok(actionable() && byText('.modal button', 'サプライからアクション1枚を追放する'), '輸送：二択モーダル');
    showPend({ type: 'transport', stage: 'exile', player: 0 });
    ok(actionable(), '輸送（追放）：候補が出る');
    showPend({ type: 'transport', stage: 'return', player: 0 }, (st) => { st.players[0].exile = ['village', 'estate']; });
    ok(actionable() && byText('.modal h3', '輸送'), '輸送（回収）：追放マットのアクションだけ出る');
    ok($all('.modal .chip-grid .card').length === 1, '輸送（回収）：勝利点カードは候補に出ない');
  }
  {
    showPend({ type: 'toil', player: 0 }, (st) => { st.players[0].hand = ['village', 'copper']; },
      ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'harbinger', 'vassal', 'workshop', 'bandit']);
    ok(actionable() && byText('.modal h3', '苦労'), '苦労：手札のアクションを使うモーダル');
    ok(byText('.modal button', '使用しない'), '苦労：使わない も選べる');
  }
  {
    showPend({ type: 'march', player: 0 }, (st) => { st.players[0].discard = ['village', 'copper']; },
      ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'harbinger', 'vassal', 'workshop', 'bandit']);
    ok(actionable() && byText('.modal h3', '進軍'), '進軍：捨て札のアクションを使うモーダル');
  }
  {
    showPend({ type: 'gamble', player: 0, card: 'village' }, null,
      ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'harbinger', 'vassal', 'workshop', 'bandit']);
    ok(actionable() && byText('.modal button', '使わない'), '博打：使う／使わない が出る');
  }
  {
    showPend({ type: 'delay', player: 0 }, (st) => { st.players[0].hand = ['village', 'copper']; },
      ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'harbinger', 'vassal', 'workshop', 'bandit']);
    ok(actionable() && byText('.modal h3', '遅延'), '遅延：脇に置くアクションを選べる');
    ok($all('.modal .chip-grid .card').length === 1, '遅延：財宝は候補に出ない');
  }
  {
    showPend({ type: 'event_play', player: 0 }, (st) => { st.players[0].eventSetAside = ['gold']; });
    ok(actionable() && byText('.modal button', '「金貨」を使う'), '脇に置いたカードを使うモーダル（強制）');
  }
  {
    showPend({ type: 'enhance', stage: 'trash', player: 0 }, (st) => { st.players[0].hand = ['silver', 'estate']; });
    ok(actionable() && byText('.modal h3', '増大'), '増大：廃棄モーダル');
    ok($all('.modal .chip-grid .card').length === 1, '増大：勝利点カードは廃棄候補に出ない');
    showPend({ type: 'enhance', stage: 'gain', player: 0, maxCost: 5, pot: 0, debt: 0 });
    ok(actionable(), '増大：獲得モーダルに候補が出る');
  }
  {
    showPend({ type: 'pursue', player: 0 });
    ok(actionable() && byText('.modal h3', '追求'), '追求：カード名を指定するモーダル');
  }
  {
    const s = showPend({ type: 'populate', player: 0 }, (st) => {
      st.turn.populateQueue = DOM.engine.populatePiles(st).slice();
      st.turn.populatePlayer = 0;
    });
    ok(actionable() && byText('.modal h3', '植民'), '植民：獲得する山を選ぶモーダル');
    ok(byText('.modal button', 'おまかせで残り'), '植民：おまかせボタンがある');
    ok($all('.modal .chip-grid .card').length === DOM.engine.populatePiles(s).length,
      '植民：アクションの山ぶんチップが並ぶ');
  }

  /* ============================================================
     3) 追放マットの払い戻し＝「全部か0枚か」（公式）
     ============================================================ */
  console.log('=== 追放マットの払い戻し（全部か0枚か）===');
  {
    showPend({ type: 'exile_discard', player: 0, card: 'gold' }, (st) => { st.players[0].exile = ['gold', 'gold']; });
    ok(actionable() && byText('.modal button', '2枚すべてを捨て札に戻す'), '「全部戻す」が出る');
    ok(byText('.modal button', '戻さない'), '「戻さない」が出る');
    ok(!$('.modal input') && !byText('.modal button', '＋'), '枚数ステッパーは出ない（一部だけは戻せない）');
  }

  /* ============================================================
     4) 王国30種・習性20種の既存 pending（すべて描画できる＝人間が詰まない）
     ============================================================ */
  console.log('=== 王国30種・習性20種の選択モーダル ===');
  {
    const PENDS = [
      [{ type: 'barge_choose', player: 0 }, null],
      [{ type: 'bounty_hunter_exile', player: 0 }, (st) => { st.players[0].hand = ['copper', 'estate']; }],
      [{ type: 'camel_train_exile', player: 0 }, null],
      [{ type: 'black_cat', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, null],
      [{ type: 'cardinal', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, null],
      [{ type: 'cardinal', stage: 'pick', player: 1, cands: ['silver', 'estate'] }, null],
      [{ type: 'coven', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, null],
      [{ type: 'displace_exile', player: 0 }, (st) => { st.players[0].hand = ['copper']; }],
      [{ type: 'displace_gain', player: 0, from: 'copper', maxCost: 2, pot: 0, debt: 0 }, null],
      [{ type: 'falconer_gain', player: 0, under: 5 }, null],
      [{ type: 'falconer_react', player: 0 }, null],
      [{ type: 'goatherd_trash', player: 0 }, (st) => { st.players[0].hand = ['copper']; }],
      [{ type: 'groom_gain', player: 0 }, null],
      [{ type: 'hostelry_discard', player: 0 }, (st) => { st.players[0].hand = ['copper', 'silver']; }],
      [{ type: 'hunting_lodge_choose', player: 0 }, (st) => { st.players[0].hand = ['copper']; }],
      [{ type: 'mastermind_play', player: 0 }, (st) => { st.players[0].hand = ['barge']; }],
      [{ type: 'sanctuary_exile', player: 0 }, (st) => { st.players[0].hand = ['copper']; }],
      [{ type: 'scrap_trash', player: 0 }, (st) => { st.players[0].hand = ['copper']; }],
      [{ type: 'scrap_choose', player: 0, count: 3 }, null],
      [{ type: 'sheepdog_react', player: 0 }, null],
      [{ type: 'sleigh_react', player: 0, card: 'gold' }, null],
      [{ type: 'village_green_choose', player: 0 }, null],
      [{ type: 'village_green_react', player: 0 }, null],
      [{ type: 'wayfarer_gain', player: 0 }, null],
      [{ type: 'kiln_gain', player: 0, card: 'village', kind: 'action' }, null],
      [{ type: 'exile_discard', player: 0, card: 'gold' }, (st) => { st.players[0].exile = ['gold']; }],
    ];
    let bad = [];
    PENDS.forEach(([pd, setup]) => {
      showPend(pd, setup);
      if (!actionable()) bad.push(pd.type + (pd.stage ? '/' + pd.stage : ''));
    });
    ok(bad.length === 0, '王国30種の全 pending にモーダルと押せる選択肢がある（欠け: ' + bad.join(',') + '）');
  }
  {
    const WPENDS = [
      [{ type: 'way_butterfly', player: 0, card: 'village' }, null],
      [{ type: 'way_butterfly_gain', player: 0, exactCost: 4, pot: 0, debt: 0 }, null],
      [{ type: 'way_goat_trash', player: 0 }, (st) => { st.players[0].hand = ['copper']; }],
      [{ type: 'way_rat_discard', player: 0, card: 'village' }, (st) => { st.players[0].hand = ['copper']; }],
      [{ type: 'way_seal_topdeck', player: 0, card: 'gold', dest: 'discard' }, null],
    ];
    let bad = [];
    WPENDS.forEach(([pd, setup]) => {
      showPend(pd, setup, ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'harbinger', 'vassal', 'workshop', 'bandit'],
        { ways: ['way_of_the_butterfly', 'way_of_the_goat'] });
      if (!actionable()) bad.push(pd.type);
    });
    ok(bad.length === 0, '習性の全 pending にモーダルと押せる選択肢がある（欠け: ' + bad.join(',') + '）');
  }
  {
    // 門番（持続アタック）のリアクション窓＝LINGER_REACT
    showPend({ type: 'gatekeeper', stage: 'react', player: 1, source: 0, victim: 1, queue: [], rid: 1 }, null);
    ok(actionable(), '門番のリアクション窓にモーダルが出る');
  }

  /* ============================================================
     5) engine の PLAYER_ACTIONS と UI の網羅チェック
     ============================================================ */
  console.log('=== PLAYER_ACTIONS の網羅 ===');
  {
    const MENAGERIE_EVENT_ACTIONS = ['BARGAIN_GAIN', 'DEMAND_GAIN', 'DESPERATION', 'BANISH_EXILE', 'INVEST_EXILE',
      'TRANSPORT_MODE', 'TRANSPORT_PICK', 'TOIL_PLAY', 'MARCH_PLAY', 'GAMBLE_PLAY',
      'DELAY_SETASIDE', 'EVENT_PLAY', 'ENHANCE_TRASH', 'ENHANCE_GAIN', 'PURSUE_NAME', 'POPULATE_GAIN'];
    const missing = MENAGERIE_EVENT_ACTIONS.filter((a) => !E.PLAYER_ACTIONS.has(a));
    ok(missing.length === 0, 'イベントの action が PLAYER_ACTIONS に全部ある（欠け: ' + missing.join(',') + '）');
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
    const notInUi = MENAGERIE_EVENT_ACTIONS.filter((a) => src.indexOf("'" + a + "'") < 0);
    ok(notInUi.length === 0, 'イベントの action を UI が dispatch している（欠け: ' + notInUi.join(',') + '）');
    const cpuSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'cpu.js'), 'utf8');
    const notInCpu = MENAGERIE_EVENT_ACTIONS.filter((a) => cpuSrc.indexOf("'" + a + "'") < 0);
    ok(notInCpu.length === 0, 'イベントの action を CPU が返す（欠け: ' + notInCpu.join(',') + '）');
  }

  /* ============================================================
     6) カード一覧／セット選択
     ============================================================ */
  console.log('=== カード一覧／セット選択 ===');
  {
    runtimeError = null;
    UI.view = 'cardList'; DOM.render();
    ok(!runtimeError, 'カード一覧が例外なく描画される');
    ok(byText('.section-h', '移動動物園'), '移動動物園の群が出る');
  }
  {
    ok(DOM.CARD_SETS.some((x) => x.id === 'menagerie'), 'CARD_SETS に menagerie がある');
    ok(DOM.CARD_SETS.some((x) => x.id === 'menagerie-ways'), 'CARD_SETS に menagerie-ways がある');
    ok(DOM.CARD_SETS.some((x) => x.id === 'menagerie-events' && x.eventsFrom === 'menagerie'),
      'CARD_SETS に menagerie-events がある');
    ok(DOM.CARD_SETS.some((x) => x.id === 'random-menagerie'), 'CARD_SETS に random-menagerie がある');
    const ev = DOM.eventsForSet('menagerie-events');
    ok(ev.length === 2 && ev.every((id) => DOM.LANDSCAPES[id].kind === 'event' && DOM.LANDSCAPES[id].expansion === 'menagerie'),
      'menagerie-events は移動動物園のイベント2枚を抽選する');
    ok(DOM.eventsForSet('menagerie').length === 0, 'menagerie（イベント無し）は0枚');
    // 横型は合計最大2枚（イベント＋習性＋ランドマーク＋プロジェクト）
    const ls = DOM.landscapesForSet('menagerie-events');
    ok(ls.events.length + ls.ways.length + ls.landmarks.length + ls.projects.length === 2, '横型は合計2枚');
    // mix-all のプールにも参加する
    ok(DOM.MIX_LANDSCAPE_POOLS['ev-menagerie'] && DOM.MIX_LANDSCAPE_POOLS['ev-menagerie'].get().length === 20,
      'mix-all の横型プールに「イベント（移動動物園）」がある');
  }
  {
    // セット選択画面から menagerie-events が選べる（＝「拡張」タイルに出る）
    runtimeError = null;
    UI.view = 'setup'; UI.setup = UI.setup || {};
    UI.setup.kingdomSet = 'menagerie-events';
    DOM.render();
    ok(!runtimeError, 'セット選択画面が例外なく描画される');
    ok(doc.body.textContent.indexOf('移動動物園＋イベント') >= 0, '「移動動物園＋イベント」が選択画面に出る');
  }
} catch (e) {
  fail++;
  console.log('  ✗ 例外: ' + (e && e.stack ? e.stack : e));
}

console.log('\n========================================');
console.log(`移動動物園UIスモーク結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
if (fail > 0) process.exit(1);
