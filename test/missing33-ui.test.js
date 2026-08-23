/* 未実装33種（§0-40）の段階2＝UI スモーク（jsdom）
   使い方: node test/missing33-ui.test.js
   主目的＝**engine と CPU は受理するのに UI に導線が無く人間だけ詰む**（本プロジェクト最頻の事故）を構造的に防ぐ。
   新 pending を**直接注入して**描画し、`.modal` が出て**押せるボタンかカードチップが1つ以上ある**ことを見る。 */
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

console.log('=== 第1バッチ：新 pending 10種にモーダルと押せる選択肢がある ===');
{
  const K = ['pearl_diver', 'navigator', 'explorer', 'ghost_ship', 'counting_house', 'mountebank', 'marchland', 'village', 'smithy', 'moat'];
  const PENDINGS = [
    { p: { type: 'pearl_diver', player: 0, card: 'gold' }, jp: '真珠採り' },
    { p: { type: 'navigator', player: 0, cards: ['copper', 'estate', 'silver', 'gold', 'curse'] }, jp: '航海士' },
    { p: { type: 'explorer', player: 0 }, jp: '探検家' },
    { p: { type: 'ghost_ship', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, jp: '幽霊船（反応）' },
    { p: { type: 'ghost_ship', stage: 'put', player: 0, source: 1, victim: 0, queue: [] }, jp: '幽霊船（置く）' },
    { p: { type: 'counting_house', player: 0, max: 3 }, jp: '会計所' },
    { p: { type: 'loan', player: 0, card: 'silver' }, jp: '借金' },
    { p: { type: 'mountebank', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, jp: '香具師（反応）' },
    { p: { type: 'mountebank', stage: 'choose', player: 0, source: 1, victim: 0, queue: [] }, jp: '香具師（二択）' },
    { p: { type: 'marchland_discard', player: 0 }, jp: '境界地' },
  ];
  PENDINGS.forEach((row) => {
    const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
    s.players[0].hand = ['village', 'copper', 'estate', 'moat', 'curse'];
    s.players[0].discard = ['copper', 'copper', 'copper'];
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

/* 任意の窓は**0枚選択のまま辞退できる**（§0-39 の田舎の村で踏んだ穴＝`allowZero:false` だと確定ボタンが無効のまま）。 */
console.log('=== 任意の窓（境界地・会計所）は最初から押せるボタンがある ===');
{
  const K = ['marchland', 'counting_house', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory'];
  [[{ type: 'marchland_discard', player: 0 }, '境界地'], [{ type: 'counting_house', player: 0, max: 2 }, '会計所']].forEach(([pend, jp]) => {
    const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
    s.players[0].hand = ['copper', 'estate', 'silver']; s.players[0].discard = ['copper', 'copper'];
    s.turn.phase = 'buy'; s.pending = pend;
    showAs(s, 0);
    const m = doc.querySelector('.modal');
    const btns = m ? Array.from(m.querySelectorAll('button')) : [];
    ok(btns.some((b) => !b.disabled), jp + '：1枚も選ばない状態で押せるボタンがある（実: ' + btns.map((b) => (b.textContent || '').trim() + (b.disabled ? '(無効)' : '')).join(' / ') + '）');
  });
}

/* 真珠採り・航海士・借金の「見ている札」は**相手には伏せる**（オンライン配信＝maskStateFor）＝
   UI 側も相手視点で描いたときにカード名を出さない。 */
console.log('=== 相手視点では見ている札の名前が出ない（真珠採り／航海士）===');
{
  const K = ['pearl_diver', 'navigator', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory'];
  const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
  s.players[0].hand = ['copper']; s.turn.phase = 'action';
  s.pending = { type: 'navigator', player: 0, cards: ['gold', 'gold', 'gold', 'gold', 'gold'] };
  const m = E.maskStateFor(s, 1);
  ok(m.pending.cards.every((x) => x === 'back'), '航海士：相手への配信では5枚が back');
  s.pending = { type: 'pearl_diver', player: 0, card: 'gold' };
  ok(E.maskStateFor(s, 1).pending.card === 'back', '真珠採り：相手への配信では1枚が back');
}

console.log('\n========================================');
console.log('未実装33種 UIテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
