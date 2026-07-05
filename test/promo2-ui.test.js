/* 新プロモ（王子/船長/教会/サウナ/アヴァント/へそくり）UI スモーク（jsdom）
   各 pending の選択モーダル・へそくり配置トグル・王子の脇チップが描画できるかを確認。
   使い方: node test/promo2-ui.test.js */
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
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null;
  UI.coffersOpen = false; UI.amount = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const K = ['moat', 'village', 'militia', 'smithy', 'market', 'stash', 'prince', 'captain', 'church', 'sauna'];
function mk() { return E.createInitialState(['あなた', '相手'], K, { startActive: 0 }); }
function play(s, card) { return E.reduce(s, { type: 'PLAY_ACTION', card }); }
function showPend(pd, setup) {
  const s = mk();
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}

try {
  console.log('=== promo2-pack: 盤面描画（分割山サウナ/アヴァントが両方見える） ===');
  {
    const s = mk();
    showAs(s, 0);
    ok(!runtimeError, '盤面描画で例外なし');
    ok(byText('*', 'サウナ') != null, 'サウナの山が見える');
    ok(byText('*', 'アヴァント') != null, 'アヴァントの山が見える');
  }

  console.log('=== 王子: 脇置きモーダル ===');
  {
    let s = mk(); s.players[0].hand = ['prince', 'smithy', 'copper'];
    s = play(s, 'prince'); showAs(s, 0);
    ok($('.modal') && byText('*', '王子') && !runtimeError, '王子の脇置きモーダル');
    ok(byText('button', '脇に置かない'), '「脇に置かない」ボタンがある');
  }
  console.log('=== 王子: ターン開始時のプレイモーダル・脇チップ ===');
  {
    const s = showPend({ type: 'prince_play', player: 0, idx: 0, card: 'smithy' },
      (x) => { x.players[0].princes = ['smithy']; });
    ok($('.modal') && byText('*', '王子') && byText('button', '鍛冶屋') && !runtimeError, '王子のターン開始時モーダル（強制1ボタン）');
  }
  {
    const s = mk(); s.players[0].princes = ['smithy'];
    showAs(s, 0);
    ok(byText('*', '👑') != null && byText('*', '鍛冶屋') != null && !runtimeError, '場に王子の脇チップ（👑鍛冶屋）が出る');
  }

  console.log('=== 船長: サプライからプレイのモーダル ===');
  {
    let s = mk(); s.players[0].hand = ['captain', 'copper'];
    s = play(s, 'captain'); showAs(s, 0);
    ok($('.modal') && byText('*', '船長') && !runtimeError, '船長の対象選択モーダル');
    ok(byText('*', '鍛冶屋') || byText('*', '村'), '$4以下のアクションが候補に出る');
  }

  console.log('=== 教会: 脇置き（最大3枚）と廃棄モーダル ===');
  {
    let s = mk(); s.players[0].hand = ['church', 'gold', 'copper', 'estate'];
    s = play(s, 'church'); showAs(s, 0);
    ok($('.modal') && byText('*', '教会') && !runtimeError, '教会の脇置きモーダル');
    ok(byText('button', '確定'), '0枚でも確定できるボタン');
  }
  showPend({ type: 'church_trash', player: 0 });
  ok($('.modal') && byText('*', '教会') && byText('button', '廃棄しない') && !runtimeError, '教会の廃棄（任意）モーダル');

  console.log('=== サウナ/アヴァント: 連鎖と銀貨廃棄モーダル ===');
  showPend({ type: 'sauna_chain', player: 0, next: 'avanto' }, (s) => { s.players[0].hand = ['avanto']; });
  ok($('.modal') && byText('*', 'アヴァント') && byText('button', '使う') && byText('button', '使わない') && !runtimeError, 'サウナ→アヴァント連鎖モーダル');
  showPend({ type: 'sauna_chain', player: 0, next: 'sauna' }, (s) => { s.players[0].hand = ['sauna']; });
  ok($('.modal') && byText('*', 'サウナ') && !runtimeError, 'アヴァント→サウナ連鎖モーダル');
  showPend({ type: 'sauna_trash', player: 0, remaining: 2 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok($('.modal') && byText('*', 'サウナ') && byText('*', 'あと2回') && byText('button', '廃棄しない') && !runtimeError, 'サウナの銀貨廃棄モーダル（残回数表示）');

  console.log('=== へそくり: 配置トグルが出る・押すと設定が変わる ===');
  {
    const s = mk();
    s.players[0].hand = ['stash', 'copper', 'copper'];
    s.turn.phase = 'buy';
    showAs(s, 0);
    const btn = byText('button', 'へそくり配置');
    ok(btn != null && !runtimeError, '購入フェイズに「へそくり配置」トグルが出る');
    ok(btn && btn.textContent.includes('山札の上'), '既定は「山札の上」');
    if (btn) {
      btn.click();
      const st = UI.store.state;
      ok(st.players[0].stashPlacement === 'mix', 'タップで 混ぜる に変わる');
      DOM.render(); // テストハーネスは store 購読が無いので明示的に再描画
      const btn2 = byText('button', 'へそくり配置');
      ok(btn2 && btn2.textContent.includes('混ぜる'), 'ラベルも追従する');
    }
    // 所持していなければ出ない
    const s2 = mk(); s2.turn.phase = 'buy';
    s2.players[0].hand = ['copper']; s2.players[0].deck = []; s2.players[0].discard = [];
    showAs(s2, 0);
    ok(byText('button', 'へそくり配置') == null, '未所持なら出ない');
  }

  console.log('=== アヴァント: サウナが残る間は買えない見た目（affordable が拒否） ===');
  {
    const s = mk(); s.turn.phase = 'buy'; s.turn.coins = 9; s.turn.buys = 1;
    showAs(s, 0);
    ok(!runtimeError, '購入フェイズ描画OK');
    // canBuyCard が false のため、UI の購入試行は engine 側で拒否される（描画だけ確認）
    ok(E.canBuyCard(s, 0, 'avanto') === false && E.canBuyCard(s, 0, 'sauna') === true, 'UIが参照する canBuyCard の判定');
  }
} catch (e) {
  fail++;
  console.log('  ✗ EXCEPTION: ' + (e && e.stack || e));
}

console.log('\n========================================');
console.log('新プロモUIテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
