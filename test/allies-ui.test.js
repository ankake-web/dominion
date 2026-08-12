/* 同盟（Allies）UI スモーク（jsdom）
   使い方: node test/allies-ui.test.js
   主目的＝**人間が詰まない／操作できないものが無い**こと：
   - Ally（横型1枚）が盤面に出て、全員の好意の枚数が見えること。
   - 好意(Favor)バッジが出ること（同盟カードがあるゲームだけ）。
   - **A3 で追加した全 pending にモーダルがあり、押せる選択肢が1つ以上あること**
     （engine は好意の支払いを常に任意にしてあるので、必ず「使わない」で閉じられる）。
   - 占星術師団/メイソン団の常設方針ボタンが出て、押すと方針が変わること。
   - 発明家の家族の好意トークンが山に表示され、表示コストが下がること。 */
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
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function byText(sel, t) { return $all(sel).find((e) => e.textContent.includes(t)); }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.pickZoom = null; UI.sheet = null; UI.confirm = null; UI.lmZoom = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
// 連携(Liaison)を1枚入れておかないと Ally は出ない。生徒は魔法使いの分割山の中に居る。
const FILLER = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'];
function mk(ally, kingdom) {
  const k = (kingdom || ['bauble']).concat(FILLER).slice(0, 10);
  const s = E.createInitialState(['あなた', '相手'], k, { startActive: 0, ally });
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
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
  console.log('=== Ally の盤面表示と好意バッジ ===');
  {
    const s = mk('mountain_folk');
    s.players[0].favors = 3; s.players[1].favors = 1;
    showAs(s, 0);
    ok(!runtimeError, '同盟のある盤面が例外なく描画される');
    ok(byText('.sup-title', '同盟（横型'), 'Ally の帯が出る');
    ok(byText('.mat-row', '山の民'), 'Ally 名が出る');
    ok(byText('.mat-row', 'あなた 🤝3'), '自分の好意の枚数が出る');
    ok(byText('.mat-row', '相手 🤝1'), '相手の好意の枚数も出る（公開情報）');
    ok(byText('.badge .k', '好意'), '好意バッジが出る');
    ok(byText('.badge .v', '3'), '好意バッジの値が出る');
  }
  {
    // 連携が無い王国では Ally も好意も一切登場しない
    const s = E.createInitialState(['あなた', '相手'], FILLER.concat(['mine']).slice(0, 10), { startActive: 0 });
    showAs(s, 0);
    ok(!byText('.sup-title', '同盟（横型'), '連携が無ければ Ally の帯を出さない');
    ok(!byText('.badge .k', '好意'), '連携が無ければ好意バッジを出さない');
  }

  console.log('=== A3 の全 pending にモーダルと「押せる選択肢」がある ===');
  const CASES = [
    ['mountain_folk', (s) => { s.players[0].favors = 5; s.pending = { type: 'ally_mountain_folk', player: 0 }; }],
    ['desert_guides', (s) => { s.players[0].favors = 2; s.players[0].hand = ['copper', 'estate']; s.pending = { type: 'ally_desert', player: 0 }; }],
    ['fellowship_of_scribes', (s) => { s.players[0].favors = 1; s.pending = { type: 'ally_scribes', player: 0 }; }],
    ['circle_of_witches', (s) => { s.players[0].favors = 3; s.pending = { type: 'ally_circle', player: 0 }; }],
    ['island_folk', (s) => { s.players[0].favors = 5; s.pending = { type: 'ally_island_folk', player: 0 }; }],
    ['city_state', (s) => { s.players[0].favors = 2; s.players[0].discard = ['village']; s.pending = { type: 'ally_city_state', player: 0, card: 'village', dest: 'discard' }; }],
    ['trappers_lodge', (s) => { s.players[0].favors = 1; s.players[0].discard = ['gold']; s.pending = { type: 'ally_trappers', player: 0, card: 'gold', dest: 'discard' }; }],
    ['forest_dwellers', (s) => { s.players[0].favors = 1; s.pending = { type: 'ally_forest', player: 0 }; }],
    ['gang_of_pickpockets(pay)', (s) => { s.players[0].favors = 1; s.players[0].hand = ['copper', 'copper', 'copper', 'copper', 'copper']; s.pending = { type: 'ally_gang', stage: 'pay', player: 0 }; }],
    ['gang_of_pickpockets(discard)', (s) => { s.players[0].favors = 0; s.players[0].hand = ['copper', 'copper', 'copper', 'copper', 'copper']; s.pending = { type: 'ally_gang', stage: 'discard', player: 0 }; }],
    ['cave_dwellers', (s) => { s.players[0].favors = 2; s.players[0].hand = ['copper', 'estate']; s.pending = { type: 'ally_cave', player: 0 }; }],
    ['cave_dwellers(手札0)', (s) => { s.players[0].favors = 2; s.players[0].hand = []; s.pending = { type: 'ally_cave', player: 0 }; }],
    ['crafters_guild', (s) => { s.players[0].favors = 2; s.pending = { type: 'ally_crafters', player: 0 }; }],
    ['family_of_inventors', (s) => { s.players[0].favors = 1; s.pending = { type: 'ally_inventors', player: 0 }; }],
    ['market_towns', (s) => { s.players[0].favors = 1; s.players[0].hand = ['village', 'copper']; s.turn.phase = 'buy'; s.pending = { type: 'ally_market_towns', player: 0 }; }],
    ['peaceful_cult', (s) => { s.players[0].favors = 2; s.players[0].hand = ['estate', 'copper', 'copper']; s.turn.phase = 'buy'; s.pending = { type: 'ally_peaceful_cult', player: 0 }; }],
    ['woodworkers_guild(trash)', (s) => { s.players[0].favors = 1; s.players[0].hand = ['village', 'copper']; s.turn.phase = 'buy'; s.pending = { type: 'ally_woodworkers', stage: 'trash', player: 0 }; }],
    ['woodworkers_guild(gain)', (s) => { s.turn.phase = 'buy'; s.pending = { type: 'ally_woodworkers', stage: 'gain', player: 0 }; }],
    ['coastal_haven', (s) => { s.players[0].favors = 2; s.players[0].hand = ['gold', 'copper', 'copper']; s.pending = { type: 'ally_coastal_haven', player: 0 }; }],
    ['architects_guild', (s) => { s.players[0].favors = 2; s.pending = { type: 'ally_architects', player: 0, card: 'gold' }; }],
    ['band_of_nomads', (s) => { s.players[0].favors = 1; s.pending = { type: 'ally_nomads', player: 0, card: 'silver' }; }],
  ];
  CASES.forEach(([name, setup]) => {
    const ally = name.replace(/\(.*\)$/, '');
    const s = mk(ally);
    setup(s);
    showAs(s, 0);
    ok(actionable(), name + ' のモーダルに押せる選択肢がある' + (runtimeError ? '（例外: ' + runtimeError + '）' : ''));
  });
  {
    // 森の居住者の2段目＝汎用 look_arrange に委譲している（既存モーダルが出る）
    const s = mk('forest_dwellers');
    s.players[0].favors = 0;
    s.pending = { type: 'look_arrange', player: 0, cards: ['copper', 'estate', 'gold'], source: 'forest_dwellers' };
    showAs(s, 0);
    ok(actionable(), '森の居住者の「見て並べ替える」モーダルが出る');
    ok(byText('.modal h3', '森の居住者'), 'モーダル見出しに Ally 名が出る');
  }

  console.log('=== CPU は全 pending で有効な action を返す（null を返さない） ===');
  CASES.forEach(([name, setup]) => {
    const ally = name.replace(/\(.*\)$/, '');
    const s = mk(ally);
    setup(s);
    const a = DOM.cpu.decide(s);
    ok(a && typeof a.type === 'string', name + ' で CPU が action を返す');
    if (a) {
      const after = E.reduce(s, a);
      ok(JSON.stringify(after) !== JSON.stringify(s), name + ' で CPU の手が engine に受理される（状態が変わる）');
    }
  });

  console.log('=== 占星術師団/メイソン団の常設方針ボタン ===');
  {
    const s = mk('order_of_astrologers');
    s.players[0].favors = 3; s.players[0].favorShuffle = 0;
    showAs(s, 0);
    const btn = byText('.actions-bar button', '占星術師団');
    ok(!!btn, '常設方針ボタンが出る');
    ok(btn && btn.textContent.indexOf('0個') >= 0, '既定は0個（人間は使わない）');
    if (btn) {
      btn.dispatchEvent(new win.Event('click', { bubbles: true }));
      ok((UI.store.state.players[0].favorShuffle || 0) === 1, 'タップで1個に増える');
    }
  }
  {
    const s = mk('mountain_folk');
    showAs(s, 0);
    ok(!byText('.actions-bar button', 'シャッフルに使う好意'), 'シャッフル系でない Ally では方針ボタンを出さない');
  }

  console.log('=== 敵対レビュー回帰：選択の持ち越しで詰まない ===');
  {
    /* [high] `viewPendingModal` の選択リセットは「pending のキー（type+stage）が変わったとき」だけ走るので、
       **毎ターン同じキーで開く窓**（沿岸の避難港／平和的教団／すり師団）では前回の**手札インデックス**が残る。
       残ったインデックスが範囲外になると、そのチップは描画されず＝外す手段が無く、送信しても
       `cards:[undefined]` になって engine が状態不変で拒否し続ける＝人間が完全に詰む（敵対レビューで再現）。
       ⚠ showAs() は毎回 UI.selection をリセットするので、**リセットせずに2回目を描く**形でしか検出できない。 */
    const cases = [
      ['ally_coastal_haven', 'coastal_haven', { type: 'ally_coastal_haven', player: 0 }, 'ALLY_COASTAL_HAVEN'],
      ['ally_peaceful_cult', 'peaceful_cult', { type: 'ally_peaceful_cult', player: 0 }, 'ALLY_PEACEFUL_CULT'],
      ['ally_gang(discard)', 'gang_of_pickpockets', { type: 'ally_gang', stage: 'discard', player: 0 }, 'ALLY_GANG'],
    ];
    cases.forEach(([name, ally, pd, actionType]) => {
      const s = mk(ally);
      s.players[0].favors = 5;
      s.players[0].hand = ['gold', 'silver', 'copper', 'copper', 'copper'];
      s.pending = JSON.parse(JSON.stringify(pd));
      showAs(s, 0);
      // 1回目＝5枚目（index 4）を選んで確定
      const chips = $all('.modal .chip-grid .card');
      ok(chips.length >= 5, name + '：1回目のモーダルに手札が並ぶ');
      if (chips.length >= 5) chips[4].dispatchEvent(new win.Event('click', { bubbles: true }));
      const confirm = $all('.modal button').filter((b) => !b.disabled)[0];
      if (confirm) confirm.dispatchEvent(new win.Event('click', { bubbles: true }));
      ok((UI.selection || []).length === 0, name + '：確定した時点で選択が捨てられる（持ち越さない）');
      // 2回目＝手札が減った状態で同じキーの窓を開く（**UI.selection をリセットしない**）
      const s2 = UI.store.state;
      s2.players[0].hand = ['gold'];
      s2.pending = JSON.parse(JSON.stringify(pd));
      runtimeError = null;
      DOM.render();
      ok(!runtimeError, name + '：2回目の描画で例外が出ない');
      const chips2 = $all('.modal .chip-grid .card');
      const btns2 = $all('.modal button').filter((b) => !b.disabled);
      ok(chips2.length + btns2.length > 0, name + '：2回目も押せる選択肢がある');
      // 押した結果 engine が受理する（＝状態が動く＝詰まない）
      const before = JSON.stringify(UI.store.state);
      if (btns2.length) btns2[btns2.length - 1].dispatchEvent(new win.Event('click', { bubbles: true }));
      ok(JSON.stringify(UI.store.state) !== before, name + '：2回目のボタンで局面が動く（状態不変で拒否されない）');
    });
  }
  {
    // 範囲外に残ったインデックスは描画時にも自己修復される（旧スナップショット復元などの保険）
    const s = mk('peaceful_cult');
    s.players[0].favors = 3;
    s.players[0].hand = ['gold', 'province'];
    s.pending = { type: 'ally_peaceful_cult', player: 0 };
    showAs(s, 0);
    UI.selection = [7]; // 範囲外（前ターンの手札インデックス）
    UI._selKey = 'ally_peaceful_cult';
    runtimeError = null;
    DOM.render();
    ok((UI.selection || []).length === 0, '範囲外のインデックスは描画時に間引かれる');
    const btn = $all('.modal button').filter((b) => !b.disabled)[0];
    ok(btn && btn.textContent.indexOf('廃棄しない') >= 0, '何も選んでいない状態では「廃棄しない」が既定（勝手に廃棄しない）');
  }

  /* ===== A4：王国カード49種の全 pending にモーダルと「押せる選択肢」があるか =====
     強制の窓なら候補が空でないこと／任意の窓なら必ず辞退ボタンがあること。 */
  console.log('=== A4 の全 pending にモーダルと「押せる選択肢」がある ===');
  const SPLIT_K = ['augurs', 'clashes', 'forts', 'odysseys', 'townsfolk', 'wizards'];
  function mkA4(kingdom) {
    // 連携（生徒＝魔法使いの中）を入れて Ally も出るようにする
    const k = (kingdom || SPLIT_K).concat(FILLER).slice(0, 10);
    const s = E.createInitialState(['あなた', '相手'], k, { startActive: 0, ally: 'mountain_folk' });
    s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
    return s;
  }
  const A4_CASES = [
    ['rotate_pile(自分の山)', (s) => { s.pending = { type: 'rotate_pile', player: 0, pile: 'augurs', source: 'tent' }; }],
    ['rotate_pile(任意のサプライ山)', (s) => { s.pending = { type: 'rotate_pile', player: 0, any: true, source: 'battle_plan' }; }],
    ['town_choose', (s) => { s.pending = { type: 'town_choose', player: 0 }; }],
    ['town_choose(長老つき)', (s) => { s.pending = { type: 'town_choose', player: 0, elder: true }; }],
    ['blacksmith_choose', (s) => { s.pending = { type: 'blacksmith_choose', player: 0 }; }],
    ['town_crier_choose', (s) => { s.pending = { type: 'town_crier_choose', player: 0 }; }],
    ['innkeeper_choose', (s) => { s.pending = { type: 'innkeeper_choose', player: 0 }; }],
    ['innkeeper_discard', (s) => { s.players[0].hand = ['copper', 'copper', 'copper', 'estate']; s.pending = { type: 'innkeeper_discard', player: 0, n: 3 }; }],
    ['miller_pick', (s) => { s.pending = { type: 'miller_pick', player: 0, cards: ['copper', 'gold', 'estate'] }; }],
    ['marquis_discard', (s) => { s.players[0].hand = new Array(12).fill('copper'); s.pending = { type: 'marquis_discard', player: 0 }; }],
    ['sycophant_discard', (s) => { s.players[0].hand = ['copper', 'copper', 'copper', 'estate']; s.pending = { type: 'sycophant_discard', player: 0 }; }],
    ['sibyl_place(top)', (s) => { s.players[0].hand = ['copper', 'gold']; s.pending = { type: 'sibyl_place', stage: 'top', player: 0 }; }],
    ['sibyl_place(bottom)', (s) => { s.players[0].hand = ['copper']; s.pending = { type: 'sibyl_place', stage: 'bottom', player: 0 }; }],
    ['capital_city(discard)', (s) => { s.players[0].hand = ['copper', 'estate', 'gold']; s.pending = { type: 'capital_city', stage: 'discard', player: 0 }; }],
    ['capital_city(discard・手札0)', (s) => { s.players[0].hand = []; s.pending = { type: 'capital_city', stage: 'discard', player: 0 }; }],
    ['capital_city(pay)', (s) => { s.turn.coins = 3; s.pending = { type: 'capital_city', stage: 'pay', player: 0 }; }],
    ['hunter_pick', (s) => { s.pending = { type: 'hunter_pick', player: 0, stage: 'action', cards: ['village', 'smithy', 'copper'] }; }],
    ['stronghold_choose', (s) => { s.pending = { type: 'stronghold_choose', player: 0 }; }],
    ['hill_fort_gain', (s) => { s.pending = { type: 'hill_fort_gain', player: 0 }; }],
    ['hill_fort_choose', (s) => { s.players[0].discard = ['silver']; s.pending = { type: 'hill_fort_choose', player: 0, card: 'silver', dest: 'discard' }; }],
    ['allies_topdeck', (s) => { s.players[0].inPlay = ['tent', 'tent']; s.pending = { type: 'allies_topdeck', player: 0, cards: ['tent', 'tent'] }; }],
    ['sunken_treasure', (s) => { s.turn.phase = 'buy'; s.pending = { type: 'sunken_treasure', player: 0 }; }],
    ['bauble_choose', (s) => { s.turn.phase = 'buy'; s.pending = { type: 'bauble_choose', player: 0, picked: [] }; }],
    ['contract_setaside', (s) => { s.players[0].hand = ['village', 'copper']; s.turn.phase = 'buy'; s.pending = { type: 'contract_setaside', player: 0 }; }],
    ['contract_play', (s) => { s.players[0].contractSetAside = ['village']; s.pending = { type: 'contract_play', player: 0 }; }],
    ['importer_gain', (s) => { s.pending = { type: 'importer_gain', player: 0 }; }],
    ['broker_trash', (s) => { s.players[0].hand = ['copper', 'estate']; s.pending = { type: 'broker_trash', player: 0 }; }],
    ['broker_choose', (s) => { s.pending = { type: 'broker_choose', player: 0, n: 3 }; }],
    ['student_trash', (s) => { s.players[0].hand = ['copper', 'estate']; s.pending = { type: 'student_trash', player: 0 }; }],
    ['herb_gatherer_play', (s) => { s.players[0].discard = ['gold', 'estate']; s.pending = { type: 'herb_gatherer_play', player: 0 }; }],
    ['old_map_discard', (s) => { s.players[0].hand = ['copper', 'estate']; s.pending = { type: 'old_map_discard', player: 0 }; }],
    ['battle_plan_reveal', (s) => { s.players[0].hand = ['militia', 'copper']; s.pending = { type: 'battle_plan_reveal', player: 0 }; }],
    ['royal_galley_play', (s) => { s.players[0].hand = ['village', 'copper']; s.pending = { type: 'royal_galley_play', player: 0 }; }],
    ['conjurer_gain', (s) => { s.pending = { type: 'conjurer_gain', player: 0 }; }],
    ['specialist_play', (s) => { s.players[0].hand = ['village', 'copper']; s.pending = { type: 'specialist_play', player: 0 }; }],
    ['specialist_choose', (s) => { s.pending = { type: 'specialist_choose', player: 0, card: 'village' }; }],
    ['elder_play', (s) => { s.players[0].hand = ['village', 'copper']; s.pending = { type: 'elder_play', player: 0 }; }],
    ['modify_trash', (s) => { s.players[0].hand = ['copper', 'estate']; s.pending = { type: 'modify_trash', player: 0 }; }],
    ['modify_choose', (s) => { s.pending = { type: 'modify_choose', player: 0, coin: 3, pot: 0, debt: 0 }; }],
    ['modify_gain', (s) => { s.pending = { type: 'modify_gain', player: 0, coin: 3, pot: 0, debt: 0 }; }],
    ['lich_gain', (s) => { s.trash = ['silver', 'estate']; s.pending = { type: 'lich_gain', player: 0 }; }],
    ['barbarian(react)', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'barbarian', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }; }],
    ['barbarian(gain)', (s) => { s.pending = { type: 'barbarian', stage: 'gain', player: 0, source: 1, victim: 0, queue: [], trashed: 'gold' }; }],
    ['archer(react)', (s) => { s.players[0].hand = ['moat', 'copper', 'copper', 'copper', 'copper']; s.pending = { type: 'archer', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }; }],
    ['archer(hide)', (s) => { s.players[0].hand = ['copper', 'copper', 'copper', 'gold', 'estate']; s.pending = { type: 'archer', stage: 'hide', player: 0, source: 1, victim: 0, queue: [] }; }],
    ['archer(pick)', (s) => { s.pending = { type: 'archer', stage: 'pick', player: 0, source: 0, victim: 1, queue: [], revealed: ['copper', 'gold'] }; }],
    ['sorceress(name)', (s) => { s.pending = { type: 'sorceress', stage: 'name', player: 0 }; }],
    ['sorceress(react)', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'sorceress', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }; }],
    ['sorcerer(react)', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'sorcerer', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }; }],
    ['sorcerer(name)', (s) => { s.pending = { type: 'sorcerer', stage: 'name', player: 0, source: 1, victim: 0, queue: [] }; }],
    ['skirmisher(react)', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'skirmisher', stage: 'react', player: 0, source: 1, victim: 0, queue: [], skIdx: 0 }; }],
    ['highwayman(react)', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'highwayman', stage: 'react', player: 0, source: 1, victim: 0, queue: [], rid: 1 }; }],
    ['warlord(react)', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'warlord', stage: 'react', player: 0, source: 1, victim: 0, queue: [], rid: 1 }; }],
    ['sentinel(trash)', (s) => { s.pending = { type: 'sentinel', stage: 'trash', player: 0, cards: ['copper', 'estate', 'gold', 'silver', 'curse'] }; }],
    ['sentinel(order)', (s) => { s.pending = { type: 'sentinel', stage: 'order', player: 0, cards: ['copper', 'gold', 'silver'] }; }],
    ['carpenter_gain', (s) => { s.pending = { type: 'carpenter_gain', player: 0 }; }],
    ['carpenter_trash', (s) => { s.players[0].hand = ['copper', 'estate']; s.pending = { type: 'carpenter_trash', player: 0 }; }],
    ['carpenter_upgrade', (s) => { s.pending = { type: 'carpenter_upgrade', player: 0, coin: 2, pot: 0, debt: 0 }; }],
    ['courier_play', (s) => { s.players[0].discard = ['village', 'gold']; s.pending = { type: 'courier_play', player: 0 }; }],
    ['swap_return', (s) => { s.players[0].hand = ['village', 'copper']; s.pending = { type: 'swap_return', player: 0 }; }],
    ['swap_gain', (s) => { s.pending = { type: 'swap_gain', player: 0, returned: 'village' }; }],
    ['acolyte_trash', (s) => { s.players[0].hand = ['estate', 'copper']; s.pending = { type: 'acolyte_trash', player: 0 }; }],
    ['acolyte_self', (s) => { s.players[0].inPlay = ['acolyte']; s.pending = { type: 'acolyte_self', player: 0 }; }],
  ];
  A4_CASES.forEach(([name, setup]) => {
    const s = mkA4();
    setup(s);
    showAs(s, 0);
    ok(actionable(), 'A4: ' + name + ' のモーダルに押せる選択肢がある' + (runtimeError ? '（例外: ' + runtimeError + '）' : ''));
  });

  console.log('=== A4: CPU は全 pending で有効な action を返す（null を返さない） ===');
  A4_CASES.forEach(([name, setup]) => {
    const s = mkA4();
    setup(s);
    const a = DOM.cpu.decide(s);
    ok(a && typeof a.type === 'string', 'A4: ' + name + ' で CPU が action を返す');
  });

  /* ===== A4 の回帰：選択（UI.selection）をターンをまたいで持ち越しても詰まないか =====
     A3 の敵対レビューで [high] を踏んだ型（同じ pending キーで2回開くと前回のインデックスが残る）。 */
  console.log('=== A4: 選択の持ち越しで詰まない（takeSelection / pruneSelection） ===');
  {
    const s = mkA4();
    s.players[0].hand = new Array(12).fill('copper');
    s.pending = { type: 'marquis_discard', player: 0 };
    showAs(s, 0);
    // 2枚選んで確定 → UI.selection が空になる
    const chips = $all('.modal .chip-grid .card');
    chips[0].dispatchEvent(new win.Event('click', { bubbles: true }));
    chips[1].dispatchEvent(new win.Event('click', { bubbles: true }));
    ok(UI.selection.length === 2, '2枚選べた');
    const confirm = $all('.modal button').find((b) => !b.disabled);
    if (confirm) confirm.dispatchEvent(new win.Event('click', { bubbles: true }));
    ok((UI.selection || []).length === 0, '確定すると選択が捨てられる（takeSelection）');
  }
  {
    // 範囲外のインデックスが残っていても描画で間引かれる（pruneSelection）
    const s = mkA4();
    s.players[0].hand = ['copper', 'copper', 'copper', 'estate'];
    s.pending = { type: 'sycophant_discard', player: 0 };
    UI.view = 'game'; UI.mode = 'local'; UI.localViewer = 0;
    UI.store = DOM.LocalStore(s);
    UI.selection = [9, 10, 11];   // 手札4枚に対して範囲外
    DOM.render();
    ok(UI.selection.every((i) => i < 4), '範囲外の選択インデックスが間引かれる');
    ok(actionable(), '範囲外の選択が残っていても操作できる（詰まない）');
  }
  {
    // 長老つきの2択モーダル（modalChoice）も選択を持ち越さない
    const s = mkA4();
    s.pending = { type: 'blacksmith_choose', player: 0, elder: true };
    showAs(s, 0);
    const opts = $all('.modal button').filter((b) => !b.disabled);
    ok(opts.length >= 3, '長老つきの3択が全部押せる');
    opts[0].dispatchEvent(new win.Event('click', { bubbles: true }));
    ok(UI.selection.length === 1, '1つ目を選ぶと選択に入る');
  }

  console.log('=== 発明家の家族：山の好意トークンと表示コスト ===');
  {
    const s = mk('family_of_inventors');
    s.pileFavor = { market: 2 };
    showAs(s, 0);
    const pile = $all('.pile').find((e) => e.getAttribute('data-pile') === 'market');
    ok(!!pile, '市場の山が描画される');
    ok(pile && pile.querySelector('.pile-favor'), '山に好意トークンのバッジが出る');
    ok(pile && pile.querySelector('.pile-favor').textContent.indexOf('2') >= 0, 'トークン数が出る');
    ok(pile && pile.querySelector('.pcost').textContent.indexOf('3') >= 0, '表示コストが $5→$3 に下がる');
  }
} catch (e) {
  fail++; console.log('  x 例外: ' + (e && e.stack ? e.stack : e));
}

console.log('\n========================================');
console.log(`同盟UIテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
