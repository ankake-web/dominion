/* 第二版＋プロモ 追加カードの UI スモーク（jsdom）
   各カードの選択モーダルが「描画でき・操作で正しくdispatchできる」かを確認。
   使い方: node test/edition2-ui.test.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = '<!DOCTYPE html><html><body><div id="app"></div></body></html>';
const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
const timers = [];
let timerId = 1;
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

// 指定状態を「pendingの当事者の視点」で描画する
function show(s) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null;
  UI.localViewer = s.pending ? s.pending.player : (s.turn ? s.turn.active : 0);
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
function mk(kingdom) { return E.createInitialState(['あなた', '相手'], kingdom, { startActive: 0 }); }
function play(s, card) { return E.reduce(s, { type: 'PLAY_ACTION', card }); }

try {
  const K = ['harbinger', 'merchant', 'vassal', 'poacher', 'bandit', 'sentry', 'artisan',
    'courtier', 'diplomat', 'lurker', 'mill', 'patrol', 'replace', 'secret_passage',
    'walled_village', 'envoy', 'governor', 'dismantle', 'black_market', 'hoard', 'moat', 'witch'];

  // --- 前駆者 ---
  { let s = mk(K); s.players[0].hand = ['harbinger']; s.players[0].discard = ['gold']; s.players[0].deck = ['copper', 'copper'];
    s = play(s, 'harbinger'); show(s);
    ok($('.modal') && !runtimeError, '前駆者モーダルが描画される'); }

  // --- 家臣 ---
  { let s = mk(K); s.players[0].hand = ['vassal']; s.players[0].deck = ['smithy', 'copper'];
    s = play(s, 'vassal'); show(s);
    ok($('.modal') && byText('button', '使う'), '家臣モーダル: 使う/使わない'); }

  // --- 密猟者 ---
  { let s = mk(K); s.supply.village = 0; s.players[0].hand = ['poacher', 'estate', 'copper']; s.players[0].deck = ['copper', 'copper'];
    s = play(s, 'poacher'); show(s);
    ok($('.modal') && !runtimeError, '密猟者モーダル（捨て札選択）'); }

  // --- 山賊（反応＆選択）---
  { let s = mk(K); s.players[0].hand = ['bandit']; s.players[1].hand = ['moat']; s.players[1].deck = ['gold', 'silver'];
    s = play(s, 'bandit'); show(s);
    ok($('.modal') && byText('button', '堀'), '山賊: 反応モーダル（堀）'); }
  { let s = mk(K); s.players[0].hand = ['bandit']; s.players[1].deck = ['gold', 'silver', 'estate'];
    s = play(s, 'bandit'); show(s);
    ok($('.modal') && (byText('button', '金貨') || byText('button', '銀貨')), '山賊: 廃棄財宝の選択モーダル'); }

  // --- 衛兵 ---
  { let s = mk(K); s.players[0].hand = ['sentry']; s.players[0].deck = ['copper', 'curse', 'gold', 'estate', 'estate'];
    s = play(s, 'sentry'); show(s);
    ok($('.modal') && byText('div', '山札の上'), '衛兵モーダル（振り分け）');
    // タップで振り分けが変わる
    const card = $('.chip-grid .card'); if (card) card.click();
    ok(!runtimeError, '衛兵: カードタップで例外なし'); }

  // --- 職人 ---
  { let s = mk(K); s.players[0].hand = ['artisan', 'copper']; s = play(s, 'artisan'); show(s);
    ok($('.modal') && !runtimeError, '職人: 獲得モーダル'); }

  // --- 廷臣 ---
  { let s = mk(K); s.players[0].hand = ['courtier', 'nobles']; s = play(s, 'courtier'); show(s);
    ok($('.modal') && !runtimeError, '廷臣: 公開モーダル');
    s = E.reduce(s, { type: 'COURTIER_REVEAL', card: 'nobles' }); show(s);
    ok($('.modal') && $all('.choose-tile').length === 4, '廷臣: 効果選択（4択）'); }

  // --- 外交官（リアクション）---
  { let s = mk(K); s.players[0].hand = ['witch'];
    s.players[1].hand = ['diplomat', 'copper', 'copper', 'copper', 'estate']; s.players[1].deck = ['silver', 'gold', 'copper'];
    s = play(s, 'witch'); show(s);
    ok($('.modal') && byText('button', '外交官'), '外交官: 反応モーダルに外交官の選択肢');
    s = E.reduce(s, { type: 'DIPLOMAT_REVEAL' }); show(s);
    ok($('.modal') && !runtimeError, '外交官: 3枚捨てモーダル'); }

  // --- 待ち伏せ ---
  { let s = mk(K); s.players[0].hand = ['lurker']; s = play(s, 'lurker'); show(s);
    ok($('.modal') && byText('button', 'サプライ'), '待ち伏せ: 選択モーダル');
    s = E.reduce(s, { type: 'LURKER_CHOOSE', choice: 'trash' }); show(s);
    ok($('.modal') && !runtimeError, '待ち伏せ: サプライ廃棄モーダル'); }

  // --- 風車 ---
  { let s = mk(K); s.players[0].hand = ['mill', 'estate', 'copper']; s.players[0].deck = ['copper', 'copper'];
    s = play(s, 'mill'); show(s);
    ok($('.modal') && byText('button', '捨てない'), '風車: 捨てる/捨てないモーダル'); }

  // --- パトロール ---
  { let s = mk(K); s.players[0].hand = ['patrol'];
    s.players[0].deck = ['copper', 'copper', 'copper', 'silver', 'gold', 'estate', 'curse'];
    s = play(s, 'patrol'); show(s);
    ok($('.modal') && !runtimeError, 'パトロール: 並べ替えモーダル'); }

  // --- 身代わり ---
  { let s = mk(K); s.players[0].hand = ['replace', 'estate']; s = play(s, 'replace'); show(s);
    ok($('.modal') && !runtimeError, '身代わり: 廃棄モーダル'); }

  // --- 隠し通路 ---
  { let s = mk(K); s.players[0].hand = ['secret_passage']; s.players[0].deck = ['copper', 'silver', 'gold', 'estate'];
    s = play(s, 'secret_passage'); show(s);
    ok($('.modal') && !runtimeError, '隠し通路: カード選択モーダル');
    const card = $('.chip-grid .card'); if (card) card.click(); // pickZoom→確定
    if (byText('button', '選ぶ')) byText('button', '選ぶ').click();
    show(UI.store.state);
    ok(!runtimeError, '隠し通路: place段階へ進んでも例外なし'); }

  // --- 使者（左隣＝席1の視点）---
  { let s = mk(K); s.players[0].hand = ['envoy']; s.players[0].deck = ['copper', 'silver', 'gold', 'estate', 'duchy', 'copper'];
    s = play(s, 'envoy'); show(s); // show は pending.player(=1) 視点で描画
    ok($('.modal') && !runtimeError, '使者: 左隣の捨てさせ選択モーダル'); }

  // --- 総督（3モード）---
  { let s = mk(K); s.players[0].hand = ['governor']; s = play(s, 'governor'); show(s);
    ok($('.modal') && byText('button', 'カードを引く'), '総督: モード選択モーダル');
    s = E.reduce(s, { type: 'GOVERNOR_CHOOSE', choice: 'remodel' });
    s.players[0].hand = ['estate']; show(s);
    ok($('.modal') && !runtimeError, '総督: 改築モード（廃棄モーダル）'); }

  // --- 取り壊し ---
  { let s = mk(K); s.players[0].hand = ['dismantle', 'estate']; s = play(s, 'dismantle'); show(s);
    ok($('.modal') && !runtimeError, '取り壊し: 廃棄モーダル'); }

  // --- 闇市場 ---
  { let s = mk(K); s.players[0].hand = ['black_market', 'copper', 'copper']; s = play(s, 'black_market'); show(s);
    ok($('.modal') && (byText('button', '財宝') || byText('button', '買わずに')), '闇市場モーダル'); }

  console.log('\n========================================');
  console.log('第二版＋プロモ UIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
  console.log('========================================');
  if (runtimeError) { console.log('実行時エラー:', runtimeError); process.exit(1); }
  if (fail > 0) process.exit(1);
} catch (e) {
  console.log('テスト中に例外:', e && e.stack || e);
  process.exit(1);
}
