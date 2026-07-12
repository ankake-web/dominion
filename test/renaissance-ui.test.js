/* ルネサンス（Renaissance）UI スモーク（jsdom）
   各 pending の選択モーダルと盤面（村人バッジ・プロジェクト帯＋キューブ・アーティファクト帯）が
   エラー無く描画できるかを確認する。使い方: node test/renaissance-ui.test.js
   ※ 本番に出るセット＝'renaissance' / 'renaissance-projects' の全カード・全pending を網羅する。 */
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
  UI.coffersOpen = false; UI.villagersOpen = false;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const K = DOM.KINGDOM_RENAISSANCE.slice();
// 王国25種すべてを使えるようにした盤面（pendingモーダルの網羅用）
const KALL = DOM.POOLS.renaissance.slice(0, 10);
function mk(opts) { return E.createInitialState(['あなた', '相手'], K.slice(), Object.assign({ startActive: 0 }, opts || {})); }
function mkK(kingdom, opts) { return E.createInitialState(['あなた', '相手'], kingdom.slice(), Object.assign({ startActive: 0 }, opts || {})); }
function showPend(pd, setup, kingdom, opts) {
  const s = kingdom ? mkK(kingdom, opts) : mk(opts);
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}
function modalOk() { return $('.modal') && !runtimeError; }

try {
  console.log('=== 盤面（村人バッジ・プロジェクト帯・アーティファクト帯）の描画 ===');
  {
    const s = mk({ projects: ['fair', 'sinister_plot'] });
    s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 2;
    s.players[0].villagers = 3; s.players[0].coffers = 2;
    s.players[0].projects = ['fair']; // キューブは残り1個＝まだ買える
    s.artifacts.horn = 0; s.artifacts.key = 1;
    showAs(s, 0);
    ok(!runtimeError, '盤面が例外なく描画される');
    ok(byText('.badge', '村人'), '村人バッジが出る');
    ok(byText('.badge', '財源'), '財源バッジが出る');
    ok(byText('.sup-title', 'プロジェクト'), 'プロジェクト帯が出る');
    ok(byText('.mat-row', '縁日'), 'プロジェクト（縁日）が並ぶ');
    ok(byText('.mat-row', '●あなた'), '買った人のキューブが出る');
    ok(byText('.sup-title', 'アーティファクト'), 'アーティファクト帯が出る');
    ok(byText('.mat-row', '角笛：あなた が所持'), 'アーティファクトの所有者が出る');
    ok(byText('.mat-row', '鍵：相手 が所持'), '相手の所持も出る');
    const buyBtns = $all('.project-row button').filter((b) => b.textContent.includes('買う'));
    ok(buyBtns.length === 2, 'プロジェクトの購入ボタンが出る');
    ok(buyBtns.some((b) => !b.disabled), '買えるプロジェクトのボタンは有効');
  }
  {
    // 既に2つ買っている＝キューブ切れ→購入ボタンは無効／悪巧みのトークン数が出る
    const s = mk({ projects: ['fair', 'sinister_plot'] });
    s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 2;
    s.players[0].projects = ['fair', 'sinister_plot'];
    s.players[0].sinisterPlot = 2;
    showAs(s, 0);
    ok(byText('.mat-row', '🔘2'), '悪巧みのトークン数が出る');
    const buyBtns = $all('.project-row button').filter((b) => b.textContent.includes('買う'));
    ok(buyBtns.every((b) => b.disabled), 'キューブ切れなら購入ボタンは無効（engine の canBuyProject と一致）');
  }
  {
    // アーティファクト付与カードが無い王国では帯が出ない
    const s = mkK(['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'remodel', 'laboratory']);
    showAs(s, 0);
    ok(!byText('.sup-title', 'アーティファクト'), '付与カードが無ければアーティファクト帯は出ない');
  }

  console.log('=== 村人を使うオーバーレイ ===');
  {
    const s = mk();
    s.turn.phase = 'action';
    s.players[0].villagers = 2;
    showAs(s, 0);
    ok(byText('.actions-bar button', '村人を使う'), 'アクションフェイズに「村人を使う」ボタン');
    UI.villagersOpen = true; DOM.render();
    ok(modalOk() && byText('.modal', '村人を使う'), '村人の数量オーバーレイが描画される');
    UI.villagersOpen = false;
  }
  {
    const s = mk();
    s.turn.phase = 'buy';
    s.players[0].villagers = 2;
    showAs(s, 0);
    ok(!byText('.actions-bar button', '村人を使う'), '購入フェイズには村人ボタンを出さない（engine が拒否する手を出さない）');
  }

  console.log('=== R2：王国15枚の pending モーダル ===');
  const K25 = ['hideout', 'inventor', 'mountain_village', 'priest', 'recruiter', 'sculptor', 'seer', 'old_witch', 'villain', 'scholar'];
  { showPend({ type: 'hideout_trash', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; }, K25);
    ok(modalOk() && byText('.modal', '根城'), '根城 — 廃棄'); }
  { showPend({ type: 'inventor_gain', player: 0 }, null, K25);
    ok(modalOk() && byText('.modal', '発明家'), '発明家 — 獲得'); }
  { showPend({ type: 'mountain_village', player: 0 }, (s) => { s.players[0].discard = ['gold', 'estate']; }, K25);
    ok(modalOk() && byText('.modal', '山村'), '山村 — 捨て札から手札へ'); }
  { showPend({ type: 'priest_trash', player: 0 }, (s) => { s.players[0].hand = ['copper']; }, K25);
    ok(modalOk() && byText('.modal', '司祭'), '司祭 — 廃棄'); }
  { showPend({ type: 'recruiter_trash', player: 0 }, (s) => { s.players[0].hand = ['silver']; }, K25);
    ok(modalOk() && byText('.modal', '徴募官'), '徴募官 — 廃棄'); }
  { showPend({ type: 'sculptor_gain', player: 0 }, null, K25);
    ok(modalOk() && byText('.modal', '彫刻家'), '彫刻家 — 手札に獲得'); }
  { showPend({ type: 'seer_order', player: 0, cards: ['gold', 'province'] }, null, K25);
    ok(modalOk() && byText('.modal', '先見者'), '先見者 — 山札の上に戻す'); }
  { showPend({ type: 'old_witch', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; }, K25);
    ok(modalOk() && byText('.modal', '老魔女'), '老魔女 — リアクション'); }
  { showPend({ type: 'old_witch_trash', player: 1, source: 0, queue: [] }, (s) => { s.players[1].hand = ['curse']; }, K25);
    ok(modalOk() && byText('.modal', '呪い'), '老魔女 — 呪いを廃棄'); }
  { showPend({ type: 'villain', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat', 'silver', 'gold', 'estate', 'copper']; }, K25);
    ok(modalOk() && byText('.modal', '悪党'), '悪党 — リアクション'); }
  { showPend({ type: 'villain_discard', player: 1, source: 0, queue: [] }, (s) => { s.players[1].hand = ['silver', 'gold', 'estate', 'copper', 'copper']; }, K25);
    ok(modalOk() && byText('.modal', '悪党'), '悪党 — 捨てる'); }

  console.log('=== R3：アーティファクト絡みの pending モーダル ===');
  { showPend({ type: 'ducat_trash', player: 0 }, (s) => { s.players[0].hand = ['copper']; });
    ok(modalOk() && byText('.modal', 'ドゥカート金貨'), 'ドゥカート — 銅貨を廃棄'); }
  { showPend({ type: 'border_guard', player: 0, cards: ['village', 'smithy'], allAction: true, lantern: false }, null,
      ['border_guard', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'laboratory']);
    ok(modalOk() && byText('.modal', '国境警備隊'), '国境警備隊 — 手札に加える'); }
  { showPend({ type: 'border_guard_artifact', player: 0 }, null);
    ok(modalOk() && byText('.modal', 'ランタン'), '国境警備隊 — アーティファクトの二択'); }
  { showPend({ type: 'border_guard_artifact', player: 0, only: 'horn' }, null);
    ok(modalOk() && byText('.modal', '角笛'), '国境警備隊 — 角笛（任意）'); }
  { showPend({ type: 'treasurer', stage: 'choose', player: 0 }, null);
    ok(modalOk() && byText('.modal', '出納官'), '出納官 — 3択'); }
  { showPend({ type: 'treasurer', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['gold']; });
    ok(modalOk() && byText('.modal', '財宝を廃棄'), '出納官 — 財宝を廃棄'); }
  { showPend({ type: 'treasurer', stage: 'gain', player: 0 }, (s) => { s.trash = ['gold']; });
    ok(modalOk() && byText('.modal', '廃棄置き場'), '出納官 — 廃棄置き場から獲得'); }

  console.log('=== R4：持続・クリンナップ・再演の pending モーダル ===');
  const K4 = ['cargo_ship', 'research', 'improve', 'scepter', 'village', 'smithy', 'market', 'militia', 'moat', 'laboratory'];
  { showPend({ type: 'research_trash', player: 0 }, (s) => { s.players[0].hand = ['silver']; }, K4);
    ok(modalOk() && byText('.modal', '研究'), '研究 — 廃棄'); }
  { showPend({ type: 'cargo_ship_setaside', player: 0, card: 'gold', dest: 'discard' }, (s) => { s.players[0].discard = ['gold']; }, K4);
    ok(modalOk() && byText('.modal', '貨物船'), '貨物船 — 脇に置く？'); }
  { showPend({ type: 'improve', stage: 'trash', player: 0 }, (s) => { s.players[0].inPlay = ['improve', 'village']; }, K4);
    ok(modalOk() && byText('.modal', '増築'), '増築 — 廃棄（任意）'); }
  { showPend({ type: 'improve', stage: 'gain', player: 0, exact: 4, pot: 0, dbt: 0 }, null, K4);
    ok(modalOk() && byText('.modal', '増築'), '増築 — 獲得'); }
  { showPend({ type: 'scepter', stage: 'choose', player: 0 }, (s) => { s.players[0].inPlay = ['market']; s.turn.phase = 'buy'; }, K4);
    ok(modalOk() && byText('.modal', '王笏'), '王笏 — 二択'); }
  { showPend({ type: 'scepter', stage: 'replay', player: 0 }, (s) => { s.players[0].inPlay = ['market']; s.turn.phase = 'buy'; }, K4);
    ok(modalOk() && byText('.modal', '再度使用'), '王笏 — 再演の対象'); }

  console.log('=== R5：プロジェクトの pending モーダル ===');
  { showPend({ type: 'cathedral', player: 0 }, (s) => { s.players[0].hand = ['copper']; }, K, { projects: ['cathedral'] });
    ok(modalOk() && byText('.modal', '大聖堂'), '大聖堂 — 廃棄'); }
  { showPend({ type: 'city_gate', player: 0 }, (s) => { s.players[0].hand = ['copper']; }, K, { projects: ['city_gate'] });
    ok(modalOk() && byText('.modal', '城門'), '城門 — 山札の上に置く'); }
  { showPend({ type: 'silos', player: 0 }, (s) => { s.players[0].hand = ['copper', 'copper']; }, K, { projects: ['silos'] });
    ok(modalOk() && byText('.modal', 'サイロ'), 'サイロ — 銅貨を捨てる'); }
  { showPend({ type: 'sinister_plot', player: 0 }, (s) => { s.players[0].sinisterPlot = 2; }, K, { projects: ['sinister_plot'] });
    ok(modalOk() && byText('.modal', '悪巧み'), '悪巧み — 二択'); }
  { showPend({ type: 'crop_rotation', player: 0 }, (s) => { s.players[0].hand = ['estate']; }, K, { projects: ['crop_rotation'] });
    ok(modalOk() && byText('.modal', '輪作'), '輪作 — 勝利点を捨てる'); }
  { showPend({ type: 'pageant', player: 0 }, (s) => { s.turn.phase = 'buy'; s.turn.coins = 3; }, K, { projects: ['pageant'] });
    ok(modalOk() && byText('.modal', '野外劇'), '野外劇 — $1を支払う？'); }
  { showPend({ type: 'sewers_trash', player: 0 }, (s) => { s.players[0].hand = ['curse']; }, K, { projects: ['sewers'] });
    ok(modalOk() && byText('.modal', '下水道'), '下水道 — 追加で廃棄'); }
  { showPend({ type: 'innovation', player: 0, card: 'village', dest: 'discard' }, (s) => { s.players[0].discard = ['village']; },
      ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'chapel', 'mine', 'remodel', 'laboratory'], { projects: ['innovation'] });
    ok(modalOk() && byText('.modal', '技術革新'), '技術革新 — 使用？'); }

  console.log('=== 資本主義：財宝としてアクションが光る ===');
  {
    const s = mkK(['improve', 'inventor', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'mine', 'laboratory'],
      { projects: ['capitalism'] });
    s.players[0].projects = ['capitalism'];
    s.turn.phase = 'buy';
    s.players[0].hand = ['improve', 'inventor', 'copper'];
    showAs(s, 0);
    ok(!runtimeError, '資本主義の盤面が例外なく描画される');
    ok(byText('.actions-bar button', '財宝を全部出す') && !byText('.actions-bar button', '財宝を全部出す').disabled,
      '「財宝を全部出す」が有効（アクションも財宝）');
  }

  console.log('=== カード一覧／セット選択 ===');
  {
    runtimeError = null;
    UI.view = 'cardList'; DOM.render();
    ok(!runtimeError, 'カード一覧が例外なく描画される');
    ok(byText('.section-h', '王国カード（ルネサンス）'), 'ルネサンスの王国カード群が出る');
    ok(byText('.section-h', 'プロジェクト（ルネサンス・横型・1人2つまで）'), 'プロジェクト群が出る');
    ok(byText('.section-h', 'アーティファクト（ルネサンス・横型・1人だけが持てる）'), 'アーティファクト群が出る');
    ok($all('.landmark-mini img').length >= DOM.PROJECTS_RENAISSANCE.length + DOM.ARTIFACTS_RENAISSANCE.length,
      '横型のアートが並ぶ');
  }
  {
    ok(DOM.CARD_SETS.some((x) => x.id === 'renaissance'), 'CARD_SETS に renaissance がある');
    ok(DOM.CARD_SETS.some((x) => x.id === 'renaissance-projects'), 'CARD_SETS に renaissance-projects がある');
    ok(DOM.CARD_SETS.some((x) => x.id === 'random-renaissance'), 'CARD_SETS に random-renaissance がある');
    ok(DOM.KINGDOM_RENAISSANCE.length === 10, '固定セットはちょうど10種');
    const pr = DOM.projectsForSet('renaissance-projects');
    ok(pr.length === 2 && pr.every((id) => DOM.LANDSCAPES[id].kind === 'project'), 'renaissance-projects はプロジェクト2枚を抽選する');
    ok(DOM.projectsForSet('renaissance').length === 0, 'renaissance（プロジェクト無し）は0枚');
  }
} catch (e) {
  fail++;
  console.log('  ✗ 例外: ' + (e && e.stack ? e.stack : e));
}

console.log('\n========================================');
console.log(`ルネサンスUIスモーク結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
if (fail > 0) process.exit(1);
