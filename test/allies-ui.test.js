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
