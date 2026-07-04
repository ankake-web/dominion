/* 異郷（Hinterlands）UI スモーク（jsdom）
   各 pending の選択モーダル・番犬リアクション・専用モーダル（地図職人/策謀）が描画できるかを確認。
   使い方: node test/hinterlands-ui.test.js */
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
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.selection = []; UI.amount = null; UI._selKey = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const K = DOM.POOLS.hinterlands.slice(); // 全35種＝全異郷カードがサプライに出る
function mk() { return E.createInitialState(['あなた', '相手'], K, { startActive: 0 }); }
function showPend(pd, setup) {
  const s = mk();
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}
function m(title) { return $('.modal') && !runtimeError && (title ? byText('*', title) : true); }

try {
  console.log('=== 異郷セット・盤面が描画される ===');
  ok(DOM.KINGDOM_HINTERLANDS.length === 10 && DOM.KINGDOM_HINTERLANDS.every((id) => DOM.CARDS[id]), '異郷KINGDOMは10種・全て実在');
  { let s = mk(); s.turn.phase = 'buy'; showAs(s, 0); ok(!runtimeError, '異郷の盤面が描画できる'); }

  console.log('=== 各 pending モーダルが描画される ===');
  showPend({ type: 'oasis', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok(m('オアシス'), 'オアシス 捨てモーダル');
  showPend({ type: 'duchess_look', player: 0, queue: [1] }, (s) => { s.players[0].deck = ['gold', 'copper']; });
  ok(m('公爵夫人'), '公爵夫人 山札の上モーダル');
  showPend({ type: 'develop', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['oasis', 'copper']; });
  ok(m('開発'), '開発 廃棄モーダル');
  showPend({ type: 'develop', stage: 'gain', player: 0, hi: 4, lo: 2, hiDone: false, loDone: false });
  ok(m('開発'), '開発 獲得モーダル');
  showPend({ type: 'oracle', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; });
  ok($('.modal') && byText('button', '受ける') && !runtimeError, '神託 リアクション');
  showPend({ type: 'oracle', stage: 'decide', player: 0, source: 0, victim: 1, cards: ['gold', 'estate'], queue: [] });
  ok(m('神託'), '神託 捨て/戻す 決定モーダル');
  showPend({ type: 'jack', stage: 'look', player: 0 }, (s) => { s.players[0].deck = ['curse', 'copper']; });
  ok(m('何でも屋'), '何でも屋 山札の上モーダル');
  showPend({ type: 'jack', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['estate', 'copper']; });
  ok(m('何でも屋'), '何でも屋 廃棄モーダル');
  showPend({ type: 'noble_brigand', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; });
  ok($('.modal') && byText('button', '受ける') && !runtimeError, '高貴な山賊 リアクション');
  showPend({ type: 'noble_brigand', stage: 'pick', player: 0, source: 0, victim: 1, revealed: ['silver', 'gold'], queue: [] });
  ok(m('高貴な山賊'), '高貴な山賊 廃棄財宝選択');
  showPend({ type: 'spice_merchant', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['copper', 'silver']; });
  ok(m('香辛料商人'), '香辛料商人 財宝廃棄モーダル');
  showPend({ type: 'spice_merchant', stage: 'choose', player: 0 });
  ok(m('香辛料商人'), '香辛料商人 モード選択');
  showPend({ type: 'trader', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['estate', 'copper']; });
  ok(m('交易商人'), '交易商人 廃棄モーダル');
  showPend({ type: 'trader_react', player: 0, card: 'estate', dest: 'discard' });
  ok(m('交易商人'), '交易商人 獲得置換リアクション');
  showPend({ type: 'cartographer', player: 0, cards: ['gold', 'estate', 'silver', 'copper'] });
  ok(m('地図職人'), '地図職人 捨て/並べモーダル');
  showPend({ type: 'embassy', player: 0 }, (s) => { s.players[0].hand = ['copper', 'copper', 'copper', 'estate', 'gold']; });
  ok(m('大使館'), '大使館 3枚捨てモーダル');
  showPend({ type: 'inn', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate', 'gold']; });
  ok(m('宿屋'), '宿屋 2枚捨てモーダル');
  showPend({ type: 'inn_gain', player: 0 }, (s) => { s.players[0].discard = ['oasis', 'margrave', 'copper']; });
  ok(m('宿屋'), '宿屋 捨て札アクション混ぜモーダル');
  showPend({ type: 'mandarin', player: 0 }, (s) => { s.players[0].hand = ['gold', 'estate']; });
  ok(m('役人'), '役人 山札の上に置くモーダル');
  showPend({ type: 'margrave', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; });
  ok($('.modal') && byText('button', '受ける') && !runtimeError, '辺境伯 リアクション');
  showPend({ type: 'margrave', stage: 'discard', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'gold']; });
  ok(m('辺境伯'), '辺境伯 手札捨てモーダル');
  showPend({ type: 'stables', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok(m('厩舎'), '厩舎 財宝捨てモーダル');
  showPend({ type: 'border_village', player: 0, maxCost: 5 });
  ok(m('国境の村'), '国境の村 獲得モーダル');
  showPend({ type: 'weaver', player: 0 });
  ok(m('織工'), '織工 モード選択');
  showPend({ type: 'weaver', stage: 'gain', player: 0 });
  ok(m('織工'), '織工 獲得モーダル');
  showPend({ type: 'souk_trash', player: 0 }, (s) => { s.players[0].hand = ['curse', 'estate', 'copper']; });
  ok(m('スーク'), 'スーク 廃棄モーダル');
  showPend({ type: 'berserker', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; });
  ok($('.modal') && byText('button', '受ける') && !runtimeError, '狂戦士 リアクション');
  showPend({ type: 'berserker', stage: 'discard', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['copper', 'copper', 'copper', 'estate', 'gold']; });
  ok(m('狂戦士'), '狂戦士 手札捨てモーダル');
  showPend({ type: 'berserker', stage: 'gain', player: 0, maxCost: 4 });
  ok(m('狂戦士'), '狂戦士 獲得モーダル');
  showPend({ type: 'wheelwright', stage: 'discard', player: 0 }, (s) => { s.players[0].hand = ['estate', 'copper']; });
  ok(m('車大工'), '車大工 捨てモーダル');
  showPend({ type: 'wheelwright', stage: 'gain', player: 0, maxCost: 5 });
  ok(m('車大工'), '車大工 アクション獲得モーダル');
  showPend({ type: 'witchs_hut', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; });
  ok($('.modal') && byText('button', '受ける') && !runtimeError, '魔女の小屋 リアクション');
  showPend({ type: 'witchs_hut', stage: 'discard', player: 0 }, (s) => { s.players[0].hand = ['oasis', 'margrave', 'copper', 'estate']; });
  ok(m('魔女の小屋'), '魔女の小屋 公開捨てモーダル');
  showPend({ type: 'cauldron', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['moat']; });
  ok($('.modal') && byText('button', '受ける') && !runtimeError, '大釜 リアクション');
  showPend({ type: 'duchess_gain', player: 0 });
  ok(m('公爵夫人'), '公爵夫人 獲得モーダル');
  showPend({ type: 'farmland', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok(m('農地'), '農地 廃棄モーダル');
  showPend({ type: 'farmland', stage: 'gain', player: 0, exactCost: 4 });
  ok(m('農地'), '農地 獲得モーダル');
  showPend({ type: 'haggler', player: 0, remaining: 1, maxCost: 5 });
  ok(m('値切り屋'), '値切り屋 獲得モーダル');
  showPend({ type: 'fools_gold_react', player: 1, queue: [] }, (s) => { s.players[1].hand = ['fools_gold']; });
  ok(m('愚者の黄金'), '愚者の黄金 属州リアクション');
  showPend({ type: 'igg_play', player: 0 });
  ok(m('不正利得'), '不正利得 銅貨獲得モーダル');
  showPend({ type: 'scheme_cleanup', player: 0, max: 1 }, (s) => { s.players[0].inPlay = ['scheme', 'margrave']; });
  ok(m('策謀'), '策謀 片付けモーダル');

  console.log('=== 番犬リアクションが反応窓に出る ===');
  showPend({ type: 'margrave', stage: 'react', player: 1, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['guard_dog', 'copper']; });
  ok($('.modal') && byText('button', '番犬') && !runtimeError, 'アタックの反応窓に「番犬を先に使う」ボタン');

} catch (e) {
  fail++; console.log('  ✗ 例外: ' + (e && e.stack || e));
}

console.log('\n========================================');
console.log('異郷UIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
